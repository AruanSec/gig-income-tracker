# Database Backup and Restore Runbook

## Status and scope

The application already supports two distinct backup and restore workflows:

1. **Per-user JSON export/restore** through the authenticated application. This
   covers one user's income, mileage, expenses, and custom CRA rates.
2. **Full PostgreSQL backup/restore** with `pg_dump` and `pg_restore`. This covers
   all accounts, password hashes, sessions, financial records, and CRA rates.

Use JSON export for user-controlled portability and correction. Use PostgreSQL
dumps for operational backups, disaster recovery, migrations, and server recovery.
JSON export is not a substitute for a full database backup because it does not
contain accounts, roles, password hashes, sessions, or other users' data.

SQLite is a development fallback only. Production is configured to require
PostgreSQL, so this runbook treats PostgreSQL as the authoritative database.

## Recovery objectives and ownership

Before automating the workflow, record these deployment-specific decisions:

| Decision | Recommended starting point |
| --- | --- |
| Recovery point objective (RPO) | 24 hours, plus a pre-deployment backup |
| Recovery time objective (RTO) | 2 hours after host/database availability |
| Daily retention | 14 days |
| Weekly retention | 8 weeks |
| Monthly retention | 12 months, subject to legal/accounting policy |
| Restore drill | Quarterly and before material schema changes |
| Backup owner | Named operator or operations team |
| Restore approver | Separate named owner for production replacement |

Adjust retention for Canadian tax-record obligations and obtain professional advice
for the applicable province, business type, and record category. A retention policy
must cover both database dumps and any exported reports or receipts stored elsewhere.

## Security requirements

- Treat every dump and JSON export as highly sensitive financial and authentication
  data.
- Store backups outside the repository, application build context, and Docker volume.
- Create files with `umask 077`; plaintext backups must never be group/world readable.
- Encrypt backups before copying them off-host. An age recipient dedicated to backup
  recovery is preferable to reusing the deployment SOPS identity.
- Keep the age private identity outside Git, the backup location, and the application
  host when practical. Maintain a tested offline recovery copy.
- Do not include database passwords, Bitwarden access tokens, age private keys, or
  decrypted environment files in backup archives.
- Restrict listing, download, retention deletion, and restore privileges separately
  where the storage provider supports it.
- Enable immutable/object-lock retention for at least one off-host copy to reduce
  ransomware and operator-error risk.

## Prerequisites

Run commands from the project directory. Define the same Compose wrapper used by
the deployment, replacing the environment-file location when necessary:

```bash
dc() {
  docker compose --env-file ../gig-income-tracker.env \
    -f docker-compose.yml -f compose.server.yml "$@"
}
```

Confirm the deployment and database are healthy before a routine backup:

```bash
dc ps
dc exec -T postgres sh -c \
  'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Install `age` on the host if encrypted off-host backups are required. Obtain only
the public recovery recipient (`age1...`) for the backup job; the job does not need
the private identity.

## Workflow A: Per-user JSON export and restore

### Export

1. Sign in as the account whose records will be backed up.
2. Open the application's data-management controls and choose the backup/export
   action.
3. Save the downloaded file outside shared download folders. Its expected name is
   similar to `revenue_mileage_tracker_backup_YYYY-MM-DD.json`.
4. Confirm it is nonempty and parses as JSON:

   ```bash
   backup_json=/secure/path/revenue_mileage_tracker_backup_YYYY-MM-DD.json
   test -s "$backup_json"
   node -e 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))' \
     "$backup_json"
   ```

5. Protect or encrypt the file before long-term storage.

A current export has `schemaVersion: 1` and arrays named `income`, `mileage`,
`expenses`, and `craRates`. It contains at most the authenticated user's records.

### Restore

Restoring JSON is destructive for that account: it replaces the user's income,
mileage, and expense rows. A versioned export also replaces CRA rates. A legacy
unversioned export preserves the account's current rates.

1. Take a fresh JSON export of the current account before restoring.
2. Confirm the target account and inspect the source filename/date.
3. Use the application's restore action and acknowledge the replacement warning.
4. After success, verify record counts, totals, date ranges, GST/HST fields, and CRA
   rate years in the UI and an exported report.
5. Retain the pre-restore export until the result has been accepted.

The server validates the complete import before changing data and applies it in a
transaction. Invalid records roll back the restore. Imports are limited to 10,000
financial records and 200 CRA rate rows.

## Workflow B: Full PostgreSQL backup

### Create and validate a dump

Use PostgreSQL's custom format (`-Fc`), which supports selective inspection and
`pg_restore`. The shell must stop if `pg_dump` fails; a nonempty partial file is not
a valid backup.

```bash
set -eu
umask 077

backup_dir=/srv/backups/gig-income-tracker
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
plain_dump="$backup_dir/database-$timestamp.dump"
encrypted_dump="$plain_dump.age"
backup_recipient='age1REPLACE_WITH_BACKUP_RECOVERY_RECIPIENT'

install -d -m 0700 "$backup_dir"
dc exec -T postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$plain_dump"
test -s "$plain_dump"
pg_restore --list "$plain_dump" >/dev/null

age --recipient "$backup_recipient" --output "$encrypted_dump" "$plain_dump"
test -s "$encrypted_dump"
shred -u "$plain_dump" 2>/dev/null || rm -f "$plain_dump"
printf '%s\n' "$encrypted_dump"
```

`shred` is not reliable on every filesystem, snapshot, or SSD. The stronger design
is to stream the dump directly into age so plaintext never reaches persistent disk:

```bash
set -o pipefail
umask 077
dc exec -T postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  | age --recipient "$backup_recipient" \
      --output "/srv/backups/gig-income-tracker/database-$(date -u +%Y%m%dT%H%M%SZ).dump.age"
```

The streamed form must still be restore-tested; encryption success alone does not
prove that the upstream dump was complete. `set -o pipefail` is mandatory.

### Record backup evidence

For each successful backup, record without exposing secrets:

- UTC timestamp and deployment identifier;
- application release commit/tag;
- PostgreSQL major version;
- encrypted filename, size, and SHA-256 checksum;
- off-host copy status and retention class;
- last successful restore-drill date.

Generate the checksum over ciphertext so integrity can be checked before decryption:

```bash
sha256sum "$encrypted_dump" > "$encrypted_dump.sha256"
sha256sum --check "$encrypted_dump.sha256"
```

Copy the encrypted dump and checksum to off-host storage. A backup remaining only on
the application server does not protect against host loss.

## Workflow C: Restore drill into a separate database

This is the preferred verification method because it does not overwrite production.
Run it at least quarterly and after changing the backup automation.

1. Copy the encrypted dump and checksum to an isolated recovery host or controlled
   recovery directory.
2. Verify the ciphertext checksum.
3. Decrypt to a protected temporary file or stream using the offline recovery
   identity:

   ```bash
   umask 077
   encrypted_dump=/secure/recovery/database-YYYYMMDDTHHMMSSZ.dump.age
   recovery_dump=/secure/recovery/database.restore.dump
   sha256sum --check "$encrypted_dump.sha256"
   age --decrypt --identity /secure/offline/backup-age-key.txt \
     --output "$recovery_dump" "$encrypted_dump"
   pg_restore --list "$recovery_dump" >/dev/null
   ```

4. Create a separate database and make the application role own its public schema:

   ```bash
   dc exec -T postgres sh -c \
     'createdb -U "$POSTGRES_USER" gig_income_recovery'
   dc exec -T postgres sh -c \
     'psql -U "$POSTGRES_USER" -d gig_income_recovery -v ON_ERROR_STOP=1 \
       -c "ALTER SCHEMA public OWNER TO gig_app"'
   ```

5. Restore with ownership and privilege controls:

   ```bash
   dc exec -T postgres sh -c \
     'pg_restore -U "$POSTGRES_USER" -d gig_income_recovery \
       --no-owner --no-privileges --role=gig_app \
       --single-transaction --exit-on-error' < "$recovery_dump"
   ```

6. Connect an isolated application instance to the recovery database. Do not point
   the public production service at it.
7. Verify all acceptance criteria below, then destroy the recovery database and
   plaintext dump according to policy.

## Workflow D: In-place production restore

An in-place restore replaces the production database and causes downtime. Require an
approved incident/change record, identify the exact recovery point, and preserve a
final pre-restore dump whenever the database is readable.

```bash
set -eu
umask 077

encrypted_dump=/secure/recovery/database-YYYYMMDDTHHMMSSZ.dump.age
recovery_dump=/run/database.restore.dump

sha256sum --check "$encrypted_dump.sha256"
age --decrypt --identity /secure/offline/backup-age-key.txt \
  --output "$recovery_dump" "$encrypted_dump"
pg_restore --list "$recovery_dump" >/dev/null

dc stop tax-mileage-app
dc exec -T postgres sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    --clean --if-exists --no-owner --no-privileges --role=gig_app \
    --single-transaction --exit-on-error' < "$recovery_dump"

rm -f "$recovery_dump"
dc start tax-mileage-app
dc ps
curl --fail https://your-server.your-tailnet.ts.net/api/health
```

Do not start the application if `pg_restore` fails. Preserve logs and investigate
before retrying. Because `--single-transaction` is used, a restore error should not
leave a partially restored transaction, but operators must still verify database
state before reopening service.

## Restore acceptance criteria

A restore is complete only when all applicable checks pass:

- `/api/live` and `/api/health` return success.
- An administrator and a non-administrator account can authenticate as expected.
- User and role counts match recorded expectations.
- Income, mileage, expense, and CRA-rate row counts are plausible.
- Representative records retain dates and exact cents.
- Cross-user isolation and administrator authorization still work.
- A versioned per-user JSON export matches expected records and rates.
- A tax CSV/report retains expected totals and explicit CAD formatting.
- The application survives restart and reconnects after a controlled PostgreSQL
  restart.
- No plaintext dump, recovery credential, or decrypted environment file remains in
  an unintended location.

The repository's deployment integration test automates a representative separate-
database restore and validates accounts, records, rates, and CSV output:

```bash
npm run test:deployment
```

This test uses an isolated Docker Compose project and must never be redirected to a
production volume.

## Automation and monitoring plan

1. Run the backup script from a root-owned `systemd` service and timer, not a user
   crontab containing secrets.
2. Fetch any required backup-storage credential from Bitwarden at runtime using the
   separately documented SOPS + age bootstrap workflow.
3. Alert when a scheduled backup fails, is unexpectedly small, is not copied
   off-host, or exceeds the RPO.
4. Monitor free space before creating local files and after retention cleanup.
5. Apply retention only after a newer backup is encrypted, checksummed, copied, and
   recorded successfully.
6. Never delete the last known restore-tested backup automatically.
7. Run a scheduled restore drill in an isolated environment and alert when validation
   fails.

## Failure and incident handling

- **`pg_dump` fails:** retain diagnostic logs, delete the incomplete output, and do
  not advance retention or success timestamps.
- **Encryption or upload fails:** protect the plaintext dump, correct the failure,
  then encrypt/upload promptly; do not leave it unattended.
- **Checksum mismatch:** quarantine the object and restore from another verified copy.
- **age identity unavailable:** invoke the documented offline recovery process; do
  not weaken encryption or copy private identities through unapproved channels.
- **Restore fails:** keep the application stopped, preserve the original database and
  failure logs, and retry only after identifying the cause.
- **Backup exposure:** revoke exposed storage credentials, assess whether plaintext
  or decryption keys were accessible, rotate affected application credentials, and
  follow the incident-response process.

## Operator checklist

### Routine backup

- [ ] Database is reachable.
- [ ] Dump command exited successfully.
- [ ] Dump structure was readable by `pg_restore --list` or a restore drill.
- [ ] Backup is encrypted and plaintext removed.
- [ ] Ciphertext checksum is recorded and valid.
- [ ] Off-host copy completed.
- [ ] Monitoring success timestamp advanced.
- [ ] Retention completed without deleting the last restore-tested copy.

### Production restore

- [ ] Restore approval and target recovery point are recorded.
- [ ] Backup checksum and decryption succeeded.
- [ ] Final pre-restore backup was taken when possible.
- [ ] Application was stopped before replacement.
- [ ] `pg_restore` completed with `--exit-on-error`.
- [ ] Health, authentication, data, authorization, and reporting checks passed.
- [ ] Plaintext recovery files were removed.
- [ ] Outcome and actual RPO/RTO were recorded.
