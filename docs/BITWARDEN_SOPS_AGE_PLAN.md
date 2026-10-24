# Bitwarden Bootstrap Token Encryption Plan (SOPS + age)

## Purpose

Use Bitwarden Secrets Manager as the source of truth for application secrets while
keeping its bootstrap access token encrypted at rest with Mozilla SOPS and age.
The repository may contain the encrypted bootstrap file, but it must never contain
the plaintext token or the age private key.

This plan assumes Bitwarden Secrets Manager and its `bws` CLI. Its token variable is
`BWS_ACCESS_TOKEN`. Do not substitute a long-lived Password Manager `BW_SESSION`
token: it is a temporary login session with different security and lifecycle
properties. If Password Manager is intentionally required, redesign the bootstrap
flow around `BW_CLIENTID` and `BW_CLIENTSECRET` rather than treating `BW_SESSION` as
a durable deployment credential.

## Target design

```text
Git repository
  encrypted/bitwarden-bootstrap.sops.env
       │ encrypted to the deployment age recipient
       ▼
Deployment host
  /etc/sops/age/keys.txt (private key, root-only)
       │ SOPS decrypts only for process startup
       ▼
  BWS_ACCESS_TOKEN in a short-lived process environment
       │ bws secret list/get
       ▼
Bitwarden Secrets Manager
  APP_DATABASE_PASSWORD, POSTGRES_PASSWORD, GEMINI_API_KEY, ...
       │ rendered into a root-only runtime file or injected into the service
       ▼
Docker Compose / application
```

The age key is the root trust credential. Anyone with both the encrypted file and
the matching age private key can recover the Bitwarden token. The Bitwarden token
must be a dedicated machine-account token restricted to only the projects and
secrets required by this deployment.

## Files and locations

| Item | Proposed location | Source control | Required permissions |
| --- | --- | --- | --- |
| SOPS policy | `.sops.yaml` | Yes | Normal repository file |
| Encrypted token | `encrypted/bitwarden-bootstrap.sops.env` | Yes | Ciphertext only |
| age public recipient | `.sops.yaml` and operations records | Yes | Public information |
| age private identity | `/etc/sops/age/keys.txt` | No | Root-owned, mode `0600` |
| Rendered runtime environment | `/run/gig-income-tracker/app.env` | No; tmpfs preferred | Root-owned, mode `0600` |

Add plaintext secret output patterns to `.gitignore`, but do not treat ignore rules
as the primary control. The bootstrap workflow must explicitly verify that staged
files contain SOPS metadata and no plaintext token.

## Phase 1: Define scope and access

1. Inventory every secret currently required by `docker-compose.yml` and the
   production environment. At minimum, evaluate:
   `APP_DATABASE_PASSWORD`, `POSTGRES_PASSWORD`, `GEMINI_API_KEY`, and deployment
   administration credentials.
2. Create a dedicated Bitwarden Secrets Manager project for this application.
3. Create a deployment-specific machine account. Grant read-only access only to
   the required project or secrets; do not reuse a personal or organization-wide
   token.
4. Decide whether the deployment host may fetch secrets during every start. If
   Bitwarden availability is required at boot, document that dependency. If an
   offline restart is required, define an encrypted or tmpfs-backed cache with a
   clear expiration policy rather than silently persisting plaintext.
5. Record token ownership, approvers, expiry/rotation interval, and emergency
   revocation contacts without recording the token itself.

## Phase 2: Provision age identities

Install `age` and `sops` from verified, pinned release artifacts or the host's
trusted package repository. Record the installed versions.

Generate one identity per deployment environment on the destination host:

```bash
sudo install -d -m 0700 /etc/sops/age
sudo age-keygen -o /etc/sops/age/keys.txt
sudo chmod 0600 /etc/sops/age/keys.txt
sudo chown root:root /etc/sops/age/keys.txt
sudo age-keygen -y /etc/sops/age/keys.txt
```

The last command prints the public recipient (`age1...`). It is safe to place that
recipient in `.sops.yaml`. Never copy the private `AGE-SECRET-KEY-...` line into the
repository, Bitwarden project, shell history, CI logs, tickets, or chat.

Back up the private identity using an approved offline recovery mechanism. Test the
backup on an isolated system before relying on it. Use distinct recipients for
development, staging, and production so compromise or removal of one environment
does not expose the others.

## Phase 3: Configure SOPS

Create `.sops.yaml` with an explicit path rule. Replace the example recipient with
the real public recipient; add multiple recipients only when every listed operator
or host is intentionally authorized.

```yaml
creation_rules:
  - path_regex: ^encrypted/bitwarden-bootstrap\.sops\.env$
    age: >-
      age1REPLACE_WITH_DEPLOYMENT_PUBLIC_RECIPIENT
```

Create the bootstrap file without putting the token in command-line arguments:

```bash
umask 077
mkdir -p encrypted
read -rsp 'Bitwarden machine access token: ' BWS_ACCESS_TOKEN
printf '\n'
export BWS_ACCESS_TOKEN
sops --encrypt --input-type dotenv --output-type dotenv /dev/stdin \
  > encrypted/bitwarden-bootstrap.sops.env <<EOF
BWS_ACCESS_TOKEN=$BWS_ACCESS_TOKEN
EOF
unset BWS_ACCESS_TOKEN
```

Before committing, confirm that the file contains SOPS metadata, an `ENC[...]`
value, and no recognizable portion of the token:

```bash
sops filestatus encrypted/bitwarden-bootstrap.sops.env
git diff --cached -- encrypted/bitwarden-bootstrap.sops.env
```

Avoid `sops --decrypt ...` directly to the terminal during routine operation because
terminal capture and scrollback may retain the token.

## Phase 4: Build the runtime fetch workflow

Create a root-owned deployment script or `systemd` oneshot unit with this sequence:

1. Set `SOPS_AGE_KEY_FILE=/etc/sops/age/keys.txt` and a restrictive `umask 077`.
2. Decrypt the bootstrap file into the process environment or an anonymous pipe.
   Do not write it to the repository, `/tmp`, or a persistent home directory.
3. Validate `bws` authentication and the expected Bitwarden project before fetching
   any application secrets.
4. Fetch secrets by immutable secret ID where possible. Maintain an explicit mapping
   from Bitwarden IDs to environment-variable names; do not export every secret the
   token can see.
5. Validate that every required value exists and is non-empty. Fail closed before
   starting or modifying the application if any lookup fails.
6. Render `/run/gig-income-tracker/app.env` atomically with mode `0600`, or inject
   values directly through the service manager. `/run` is normally tmpfs and is
   cleared on reboot.
7. Start Docker Compose with that explicit environment file. Ensure Compose does not
   echo resolved variables and that application logging never prints its environment.
8. Remove temporary files and unset `BWS_ACCESS_TOKEN` on every success and failure
   path. The token should not be passed into the application or PostgreSQL containers.

Prefer a `systemd` unit with `After=network-online.target docker.service`,
`RequiresMountsFor=/etc/sops/age`, a restrictive `UMask=0077`, and hardened service
options. Do not place the token directly in the unit file or Docker Compose YAML.

## Phase 5: Developer and CI workflows

- Developers receive their own age recipient and narrowly scoped Bitwarden machine
  account. Do not share the production age identity or token.
- CI should use the CI platform's protected secret store for its age identity, write
  it to an ephemeral file with mode `0600`, and delete it after use. Fork-based jobs
  and untrusted pull requests must never receive deployment identities.
- Pull-request checks should verify SOPS file structure and scan commits for likely
  age private keys, Bitwarden tokens, `.env` files, and high-entropy credentials.
- Logs may include secret identifiers and status, but never secret values, decrypted
  files, CLI debug output, or complete environment dumps.

## Phase 6: Rotation and access removal

### Bitwarden token rotation

1. Create a replacement machine-account token with the same or narrower scope.
2. Validate it with a read-only lookup on the target host.
3. Edit the encrypted file with `sops encrypted/bitwarden-bootstrap.sops.env` and
   replace only `BWS_ACCESS_TOKEN`.
4. Deploy and verify secret retrieval and application health.
5. Revoke the previous token immediately after successful cutover.
6. Record the rotation date, operator, and verification result without recording
   either token.

### age identity rotation

1. Generate a new identity and securely back it up.
2. Add its public recipient to `.sops.yaml`.
3. Run `sops updatekeys encrypted/bitwarden-bootstrap.sops.env` and review the diff.
4. Confirm decryption with the new identity on the target host.
5. Remove the old recipient, run `sops updatekeys` again, deploy, then destroy or
   archive the old private identity according to the recovery policy.

Removing a SOPS recipient does not erase plaintext already recovered by that party.
If an age identity is suspected compromised, rotate both the age identity and the
Bitwarden machine token.

## Phase 7: Verification and acceptance criteria

The design is ready for production only when all of the following pass:

- The repository and complete Git history contain no real token or age private key.
- `sops filestatus` reports the bootstrap file as encrypted.
- The authorized deployment age identity decrypts the token; an unrelated identity
  cannot.
- The Bitwarden token can read only the intended project/secrets and cannot write.
- Startup fails without changing the running deployment when SOPS decryption,
  Bitwarden authentication, or any required lookup fails.
- The rendered environment exists only under `/run`, is mode `0600`, and is removed
  after shutdown or reboot according to policy.
- Neither the host journal, shell history, process arguments, Docker inspection,
  application logs, nor CI artifacts reveal the bootstrap token or fetched secrets.
- Application health, database connectivity, restart, backup, and restore checks pass
  using Bitwarden-sourced values.
- Token rotation and age-key recovery have both been rehearsed successfully.

## Incident response

If the token or age private identity may have leaked:

1. Revoke the Bitwarden machine token first.
2. Stop automated secret-fetch jobs that use it.
3. Rotate every Bitwarden secret accessible to that token based on scope and evidence;
   do not assume encrypting a new copy of the same token resolves exposure.
4. Generate a new age identity, replace authorized recipients, and re-encrypt the new
   bootstrap token.
5. Purge exposed runtime files and investigate logs, process history, CI artifacts,
   backups, and Git history.
6. Restore service, verify least privilege, and document the incident and follow-up
   controls without including secret values.

## Recommended implementation order

1. Inventory and scope Bitwarden secrets and machine-account permissions.
2. Provision and recover-test environment-specific age identities.
3. Add `.sops.yaml`, ignore rules, and the encrypted bootstrap file.
4. Implement the fail-closed runtime fetch script and `systemd` integration.
5. Add secret scanning and SOPS structure checks to CI.
6. Test on `staging`, including Bitwarden outage and invalid-token scenarios.
7. Promote the exact tested configuration to production.
8. Revoke superseded credentials and rehearse rotation quarterly.
