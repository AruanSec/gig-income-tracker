# Upgrade an existing deployment after security remediation

Back up PostgreSQL and keep the previous release and environment file before upgrading.
These are operator commands for the intended server; repository testing does not execute
them against a live deployment. Use the `dc` helper and protected external environment
file described in [README.md](../README.md).

## Database role migration

New volumes initialize `gig_app` as a non-superuser that owns the application schema
and tables. Existing volumes do not rerun PostgreSQL initialization scripts. Before
starting the upgraded app against an existing volume:

1. Stop the app with `dc stop tax-mileage-app` and take a successful database dump.
2. Add `APP_DATABASE_PASSWORD` to the external environment file using a different,
   securely generated hexadecimal password. Preserve the administrator credentials.
3. Check out the upgraded source, including `scripts/init-app-db.sh`.
4. Run the following commands to recreate only the database container with the same
   volume and updated environment/mount, then create the app role and transfer table
   ownership. Do not use `down -v`.

```bash
dc config --quiet
dc up -d --wait postgres
dc exec -T postgres sh /docker-entrypoint-initdb.d/10-app-user.sh
dc up -d --build tax-mileage-app
dc ps
curl --fail https://tracker.example.com/api/health
```

The script is repeatable and resets `gig_app`'s password to the configured value.
It transfers only the application's six tables and public schema, grants database
CONNECT, and revokes public schema CREATE. It does not change the PostgreSQL
administrator password. A custom deployment with different table ownership or
schema requirements must review these SQL grants before applying them.

Verify application role flags without printing credentials:

```bash
dc exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT rolname, rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = '\''gig_app'\''"'
```

All three privilege flags should be `f`. The base Compose file now publishes no
database port, binds the app to `127.0.0.1`, and requires both database passwords.
It mounts the initialization script read-only; keep that file with the deployment.

## Administrator and session changes

Public signup is disabled. Existing administrators continue to manage accounts in
the admin portal. If no usable administrator exists, provision a new one locally:

```bash
read -r -p "Administrator email: " tracker_admin_email
IFS= read -r -s -p "Administrator password: " tracker_admin_password
printf '\n'
printf '%s\n%s\n' "$tracker_admin_email" "$tracker_admin_password" | dc exec -T tax-mileage-app node dist/create-admin.cjs
unset tracker_admin_email tracker_admin_password
```

This command cannot overwrite an existing email. Use a new administrator email
if necessary, then reset the affected account's password through the admin portal.
Legacy PBKDF2 credentials are no longer accepted and require a reset; scrypt
credentials remain usable. New administrator-created accounts have empty ledgers.

Users must sign in again in the browser: the app removes the old localStorage token
and uses HttpOnly cookies. Production cookies require HTTPS. New sessions expire
after eight hours. Existing raw session IDs are migrated atomically to digests;
existing API tokens retain their original expiry and work until revoked or expired.
Administrators should reset credentials/revoke sessions if compromise is suspected.
Database dumps now contain digests, not reusable session tokens.

For programmatic clients, send `X-Auth-Mode: bearer` at login to receive a token,
then use the Authorization header. Default login responses contain no token.
Cookie writes require an exact matching Origin; cross-site and missing-Origin
cookie writes fail. Preserve Host and configure the exact trusted Caddy proxy so
HTTPS scheme/origin checks work correctly. HSTS is emitted only for HTTPS requests
as recognized through that trusted topology. CSP permits the existing Google font
hosts and inline styles; scripts remain restricted to this origin.

## Logs, restore and rollback

Capture JSON events with `type=security` from app stdout. The configured local
rotation bounds disk use but does not provide off-host retention or alerting.
Configure collector access, retention and alerts on the intended host. Investigate
repeated failures/limits, CSRF denials, admin changes and local admin provisioning.
Never add credentials or full financial requests to logs.

When restoring a dump to a separate empty database, create/initialize `gig_app`,
make it the public schema owner, and restore with `--role=gig_app --no-owner
--no-privileges` as the database administrator. This ensures the app can migrate
and query its restored tables. Do not use a superuser as the application identity.

Old application builds cannot authenticate migrated session digests. A rollback
therefore signs users out; their password-based login creates new sessions. Keep
the new role and private network protections when rehearsing a rollback. Never
restore an old dump into a running application, and validate ownership and financial
records in a separate database before switching traffic.
