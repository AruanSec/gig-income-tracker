# Canadian Gig Worker Tax & Mileage Tracker

A full-stack web application designed for Canadian gig workers (Uber, Lyft, DoorDash, SkipTheDishes, and independent contractors) to log income, track vehicle mileage, record expenses, and prepare tax-planning summaries.

---

## 🚀 Key Features & Recent Updates

### 1. Income List Search & Instant Filtering
- **Provider & Notes Filter**: Search income entries by provider name (*Uber, Lyft, DoorDash, etc.*), specific trip notes, dates, or dollar amounts.
- **Quick Filter Chips**: One-click tags to quickly filter entries by top platforms or keywords.

### 2. Seasonal Trend Analysis (Monthly Revenue vs. Expenses)
- **12-Month Ledger & Visual Chart**: Located within the **Tax & Profit Summary** tab, compare gross revenue against total vehicle expenses side-by-side.
- **Seasonal Metric Badges**: Automatically highlight Peak Revenue Month, Highest Expense Month, and Most Profitable Month.
- **Quarterly Summaries**: Analyze Q1–Q4 net profit margins and performance ratios.
- **CSV & Print Export**: Export monthly ledgers for accounting and tax-preparation review.

### 3. Tax & Mileage Planning
- **Configurable Per-Kilometre Estimates**: Applies year-specific rates to mileage for planning and comparison.
- **Actual Expense Comparison**: Compares kilometre-based estimates with tracked vehicle expenses. Select the planning method explicitly; the app does not determine deduction eligibility.
- **Canadian Reports**: Displays CAD, retains cents and losses in exports, and groups calendar dates consistently across time zones. Multi-day income is assigned to its start date.

> **Tax disclaimer**: This application is a record-keeping and planning tool, not tax advice. CRA prescribed per-kilometre allowance rates are not automatically a deduction method for every self-employed worker. Confirm the applicable method, rates, GST/HST treatment, and documentation requirements with current CRA guidance or a qualified Canadian tax professional before filing.

---

## Deploy to a Linux server

The recommended deployment runs the application and PostgreSQL with Docker Compose, with Tailscale Serve on the host providing HTTPS. The multi-stage Dockerfile uses Node 22 and runs the application as the unprivileged `node` user. PostgreSQL data lives in the `postgres_data` Docker volume; SQLite is a development fallback only.

### 1. Prepare the server and source code

These instructions assume an Ubuntu or Debian server, a user with SSH and sudo access, and Tailscale installed on the same host as Docker. Access uses the server's HTTPS `*.ts.net` name. Replace repository and hostname placeholders with your own values.

- Install [Docker Engine and the Compose plugin](https://docs.docker.com/engine/install/). Use Docker Compose **2.24.4 or newer**; the server override below uses `!override` and `!reset`.
- Install [Tailscale](https://tailscale.com/download/linux), connect the server to your tailnet with `sudo tailscale up`, and confirm it appears in `tailscale status`.
- Enable MagicDNS and HTTPS certificates in the tailnet DNS settings if needed. Client devices must join the tailnet and have permission to reach the service under its access rules.
- Preserve your SSH access. This private Serve deployment needs no public domain records or public inbound ports 80, 443, 3000 or 5432. Tailscale handles connectivity through its own networking.
- Enable Docker at boot: `sudo systemctl enable --now docker`. Run the commands below as a user authorized to use Docker.

Copy the project source to `~/apps/gig-income-tracker`, or clone your repository:

```bash
mkdir -p ~/apps
# Replace YOUR_REPOSITORY_URL with the repository containing this project.
git clone YOUR_REPOSITORY_URL ~/apps/gig-income-tracker
cd ~/apps/gig-income-tracker
docker compose version
```

If uploading files, include `package-lock.json`, `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `index.html`, the build configuration, `server.ts`, and `src/` plus `scripts/`. Exclude local `node_modules`, `dist`, database files, and secrets. Node.js does not need to be installed on the host for this deployment.

### 2. Configure credentials

From the project directory, create a restricted environment file **outside the Docker build context**:

```bash
umask 077
cat > ../gig-income-tracker.env <<EOF
POSTGRES_USER=gig_tracker
POSTGRES_PASSWORD=$(openssl rand -hex 32)
APP_DATABASE_PASSWORD=$(openssl rand -hex 32)
POSTGRES_DB=tax_mileage_db
GEMINI_API_KEY=
EOF
chmod 600 ../gig-income-tracker.env
```

Run this step once for a new deployment. Keep the file for later restarts and upgrades. Compose requires both passwords and gives the app its own non-superuser `gig_app` role; the PostgreSQL administrator password is not passed to the application. Hexadecimal passwords work directly in the connection URL assembled by Compose. Changing `POSTGRES_PASSWORD` after PostgreSQL has initialized does not change the database user's password; rotate it in PostgreSQL and update the file together.

Leave `GEMINI_API_KEY` empty to use local statistical insights, or set a real key to enable external AI analysis. The application sends income information, excluding free-text notes, to Gemini when that analysis runs.

Compose reads this file through `--env-file` and supplies the application with `DATABASE_URL`, `NODE_ENV=production`, and `PORT=3000`. Keep credentials out of source control and the project directory. The Docker build context excludes `.env*` (except `.env.example`), `.npmrc`, and database dumps.

### 3. Keep application and database ports private

Create `compose.server.yml` in the project directory:

```yaml
services:
  postgres:
    ports: !reset []
  tax-mileage-app:
    ports: !override
      - "127.0.0.1:3000:3000"
```

The base Compose file already keeps PostgreSQL unpublished and binds the app to loopback. This explicit server override preserves those defaults when composing additional configuration. Containers still reach PostgreSQL over the private Compose network.

Define this shell helper in each new SSH session, after changing to `~/apps/gig-income-tracker`. Use it for all server operations so the environment file and port override are always applied:

```bash
dc() {
  docker compose --env-file ../gig-income-tracker.env \
    -f docker-compose.yml -f compose.server.yml "$@"
}
```

### 4. Configure the trusted host proxy

`TRUST_PROXY` defaults to empty: forwarded headers are ignored. For the documented
host-Tailscale Serve → loopback-published Docker app topology, trust only the Docker bridge
gateway seen by the app. Start the database to create the network, then inspect it:

```bash
dc up -d postgres
db_container_id=$(dc ps -q postgres)
docker inspect "$db_container_id" --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{end}}'
```

Add the displayed gateway as an exact address to the external environment file,
for example `TRUST_PROXY=172.18.0.1/32`. Use the actual result, not this example.
Then build/start the app below. If you recreate the network, check the gateway
again and recreate the app if it changed. For a direct Node.js app behind Tailscale Serve
on the same host, use the exact loopback addresses, for example
`TRUST_PROXY=127.0.0.1/32,::1/128`.

Only explicit IP addresses and nonzero CIDR ranges are accepted. Never use
`true`, a hop count, or a blanket subnet to trust arbitrary forwarding headers.
Keep the app port private: a caller reaching it from a trusted proxy address can
supply forwarded client addresses. With the documented single Tailscale Serve proxy, each
client has its own authentication limit (20 attempts per 15 minutes); a spoofed
address prepended to an untrusted client address cannot bypass that limit.
The bounded limiter is per process and resets after restart; multiple app
instances require a shared limiter before scaling out.

### 5. Build, start, and verify

```bash
dc config --quiet
dc up -d --build
dc ps
dc logs --tail=100 tax-mileage-app postgres
curl --fail http://127.0.0.1:3000/api/health
```

The health response should contain `"status":"ok"` and `"database":"PostgreSQL"`. Compose waits for PostgreSQL's startup health check before starting the app. Tables are created automatically on application startup. `/api/health` executes a database query and returns HTTP 503 during an outage; responses are not cached. Compose uses it to mark app readiness. `/api/live` checks only that the HTTP process responds. Idle database connection failures do not terminate the process; the pool reconnects when PostgreSQL returns. An unhealthy status alone does not make Docker restart a running container.

Both services use `restart: unless-stopped`. Keep the project directory/name consistent across deployments so Compose reuses the same named volume. `dc down` preserves database data; **`dc down -v` deletes the database volume**.

### 6. Enable HTTPS with Tailscale Serve

Run on the same host as Docker:

```bash
tailscale status
sudo tailscale serve --bg http://127.0.0.1:3000
tailscale serve status
```

Follow any setup link printed by Tailscale to enable HTTPS certificates. Serve
terminates TLS and forwards requests to the local app. The `--bg` configuration
persists across restarts. If this Tailscale device already serves other applications,
review `tailscale serve status` before changing its root route.

Use the exact HTTPS address printed by Serve, for example
`https://your-server.your-tailnet.ts.net`. From a permitted tailnet device, verify:

```bash
curl --fail https://your-server.your-tailnet.ts.net/api/health
```

Serve is private to your tailnet, subject to its access rules. Tailscale Funnel is
a separate public-access feature and is not needed here. No `APP_URL`, certificate
path or TLS key is required in the app environment. Production session cookies
require HTTPS, so use the Serve URL for browser sign-in.

This topology assumes Tailscale and Docker run on the same server. If Docker runs
inside Docker Sandboxes while Tailscale runs on the outer host, forward sandbox
port 3000 to that host first and point Serve at the forwarded address. The sandbox
override at the end of this README publishes the port inside the sandbox; it does
not configure the outer host's forwarding or trusted proxy address.

Open the HTTPS URL and sign in using an administrator-created account. Public
signup is disabled. To provision the first administrator after starting the app:

```bash
read -r -p "Administrator email: " tracker_admin_email
IFS= read -r -s -p "Administrator password (10–128 characters): " tracker_admin_password
printf '\n'
printf '%s\n%s\n' "$tracker_admin_email" "$tracker_admin_password" | dc exec -T tax-mileage-app node dist/create-admin.cjs
unset tracker_admin_email tracker_admin_password
```

The command reads credentials from standard input and refuses to overwrite an existing account. Use the admin portal to create subsequent accounts. New accounts start with empty financial ledgers. Use the explicit sample-data action only for demonstrations; it replaces that account's entries. See [TEST_REPORT.md](TEST_REPORT.md) for the current functional findings.

### Back up and restore PostgreSQL

Run backups from the project directory with `dc` defined as above. A database dump includes accounts, financial records, and custom CRA rates. The application's versioned JSON export also includes custom CRA rates. Restoring older, unversioned exports preserves the account's current rates.

```bash
umask 077
mkdir -p ../gig-income-tracker-backups
backup_file="../gig-income-tracker-backups/database-$(date -u +%Y%m%dT%H%M%SZ).dump"
dc exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup_file"
test -s "$backup_file"
```

Only use a dump if `pg_dump` exits successfully; a nonempty file alone does not verify a backup. Schedule regular backups, copy them off the server, and periodically test restoring to a separate database. Keep backups outside the project/build directory and retain the environment file securely as well.

To replace this deployment's data with a known backup, set its path and stop the application while restoring:

```bash
backup_file=../gig-income-tracker-backups/database-YYYYMMDDTHHMMSSZ.dump
dc stop tax-mileage-app
dc exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges --role=gig_app --single-transaction --exit-on-error' < "$backup_file"
# Continue only after pg_restore succeeds.
dc start tax-mileage-app
curl --fail https://your-server.your-tailnet.ts.net/api/health
```

### Update or stop the application

Back up the database before each update. Existing deployments upgrading from the previous shared database role must first follow [the security upgrade guide](docs/SECURITY_UPGRADE.md). For a Git checkout, fetch and select the release you intend to deploy; for an uploaded project, upload the new source while preserving `compose.server.yml` and the external environment file.

```bash
git fetch --tags origin
# Replace YOUR_RELEASE_TAG_OR_COMMIT with the desired version.
git checkout YOUR_RELEASE_TAG_OR_COMMIT
dc config --quiet
dc up -d --build
dc ps
dc logs --tail=100 tax-mileage-app
curl --fail https://your-server.your-tailnet.ts.net/api/health
```

A single application container can have a brief interruption during an update. To roll back, check out the previous compatible release and rebuild. If a release changed the database schema incompatibly, restore its matching pre-update backup too.

```bash
# Stop the services and keep the database volume.
dc down
```

### Troubleshooting

- **Serve cannot reach the app:** check `dc ps`, application logs, and the local health URL. Confirm the app publishes `127.0.0.1:3000:3000`.
- **PostgreSQL authentication fails:** check the environment file and database logs. Existing volumes keep their original database credentials even if the environment file changes.
- **Application repeatedly exits:** production requires reachable PostgreSQL and does not fall back to SQLite. Startup failures exit with a nonzero status; inspect logs and the health URL to diagnose the cause.
- **All users receive authentication rate limits:** verify `TRUST_PROXY` matches the actual gateway/proxy address and recreate the app after changing it. Keep direct access private. Limits are per process; restart clears them. Multi-instance deployments need a shared limiter.
- **HTTPS or tailnet access fails:** check `tailscale status`, `tailscale serve status`, MagicDNS, HTTPS certificate settings and tailnet access rules. Use the exact HTTPS hostname shown by Serve.
- **Login works but writes return 403:** verify the trusted proxy address and use the HTTPS Serve URL consistently so forwarded scheme, Host and Origin agree.

---

## 💻 Local Development Setup

Use Node.js 22 and **npm**. This project uses `package-lock.json` as its only dependency lockfile; Docker also installs dependencies with `npm ci`. Use `npm install <package>` to add dependencies and commit the updated `package.json` and `package-lock.json` together.

### Installation & Run

1. **Install Dependencies**:
   ```bash
   npm ci
   ```

2. **Start Dev Server**:
   ```bash
   npm run dev
   ```

3. **Production Build**:
   ```bash
   npm run build
   NODE_ENV=production DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/tax_mileage_db npm start
   ```

---

## 🛠️ Environment Variables

Compose deployment uses the external environment file described above. For direct Node.js execution, export variables in the shell or use Node 22's `--env-file` option, for example `node --env-file=../gig-income-tracker.env dist/server.cjs`. Direct execution requires `DATABASE_URL` and `NODE_ENV=production` in that file; the Compose example file alone does not set them. The backend does not automatically load `.env`. `.env.example` also contains AI Studio placeholders; `APP_URL` is not read by the current application.

| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `3000` | HTTP Server port |
| `NODE_ENV` | Unset | Set to `production` to serve the built app and require PostgreSQL |
| `DATABASE_URL` | — | PostgreSQL connection URL; required for production |
| `POSTGRES_USER` | `postgres` in Compose | Database user; set explicitly for server deployment |
| `POSTGRES_PASSWORD` | Required in Compose | PostgreSQL administrator password; never given to the app |
| `APP_DATABASE_PASSWORD` | Required in Compose | Separate password for the restricted `gig_app` role; hexadecimal recommended |
| `POSTGRES_DB` | `tax_mileage_db` | Database name |
| `POSTGRES_HOST` / `POSTGRES_PORT` | Host-dependent / `5432` | Alternative database connection configuration; Compose supplies these |
| `HOST` | `127.0.0.1`; `0.0.0.0` in Compose | Listen interface; keep direct host execution private |
| `TRUST_PROXY` | Empty (forwarded headers ignored) | Comma-separated trusted proxy IP addresses/CIDRs; configure for the actual topology |
| `DB_PATH` | `database.db` | Development-only SQLite fallback path |
| `GEMINI_API_KEY` | — | Optional; enables external AI insights |

---

## 📂 Project Structure

```
├── Dockerfile              # Multi-stage Node 22 Debian Docker build
├── docker-compose.yml      # Container service & volume persistence definition
├── .dockerignore           # Excluded files for Docker build
├── server.ts               # Express backend API and production static files
├── src/
│   ├── App.tsx             # Main dashboard shell & navigation
│   ├── components/
│   │   ├── IncomeList.tsx  # Income records table with provider search
│   │   ├── TaxProfitSummary.tsx # Tax calculator & monthly breakdown analysis
│   │   ├── IncomeForm.tsx  # Income entry modal
│   │   └── MileageForm.tsx # Mileage log entry modal
│   ├── db.ts               # PostgreSQL / development SQLite database layer
│   └── types.ts            # Shared TypeScript interfaces
└── package.json            # Project dependencies and build scripts
```

## Regression tests

Run `npm test`, `npm run typecheck`, and `npm run build` for the standard checks.
For browser regression tests, install Chromium once with
`npx playwright install --with-deps chromium`, then run `npm run test:e2e`.
The browser suite provisions a disposable administrator and starts its own server on port 4173 with a temporary SQLite
database and external AI disabled. Keep that port free. It checks financial-form
save failures, retained drafts, retries, repeated submissions, and failed edits.
It also checks CAD reports, year boundaries, losses, and planning-method changes
in UTC, Toronto, and Vancouver. It does not use
or alter the normal development database.

Run `npm run test:api` after building to exercise API validation, ownership,
backup/restore, and session revocation. It uses a disposable SQLite database by
default. To test PostgreSQL, set `TEST_DATABASE_URL` to a dedicated disposable test
database; the suite creates accounts and records there. Never point it at a live
database. GitHub Actions runs the standard checks and both regression suites on
feature branches, staging, and main.

## Financial calculation policy

See [docs/FINANCIAL_POLICY.md](docs/FINANCIAL_POLICY.md) for decimal storage,
legacy-data migration, rounding, period allocation, missing-year rates and tax
assumptions. Back up the database before upgrading: startup migrates existing
financial values to decimal storage and recomputes earnings from rounded inputs.
New accounts must configure verified rates for each mileage year. Existing saved
rates are preserved and should be reviewed; another year's rate is never reused.

## Deployment and recovery regression

After `npm ci` and `npx playwright install --with-deps chromium`, run
`npm run test:deployment` with Docker Engine and Compose 2.24.4 or newer available.
The test builds the real production image and creates a unique Compose project,
a fresh PostgreSQL volume, private ports, and disposable accounts. It checks
CRUD, browser CSV reports, gateway proxy trust, database outage/readiness,
restarts and Compose recreation, then restores a dump into a separate database
and compares accounts, records, custom rates and reports. It removes only its
own containers, network, temporary dump and test volume, even after a failure.
No live database or normal development database is used. Hosted CI has a separate
job for this test; configuration alone is not evidence of a completed hosted run.

The verified dump/restore path does not configure scheduled off-server backups.
Operators still need to schedule dumps, encrypt and copy them off-server, set a
retention policy, monitor failures and periodically restore into a separate
non-production database. Server DNS, HTTPS, reboot and rollback checks must be
performed on the intended host before release.


## Security controls and regression

See [the security upgrade guide](docs/SECURITY_UPGRADE.md) before upgrading an existing server.
Browser sessions use HttpOnly, SameSite=Strict cookies, with Secure required in production;
production browser access therefore requires HTTPS (loopback is used only by local tests).
New sessions expire after eight hours. Startup hashes legacy session IDs transactionally;
browser tokens previously stored in localStorage are removed and users must sign in again.
Legacy PBKDF2 passwords require an administrator reset. API clients can request a bearer
token at login with `X-Auth-Mode: bearer`; the UI never requests or persists one.
Cookie-authenticated writes require a matching Origin. Configure the actual trusted proxy
so HTTPS origin checks and HSTS work behind Tailscale Serve.

Run `npm run test:security` after building, with Docker and Chromium available. It creates
its own PostgreSQL container and tests production-mode controls; any GAP or ERROR fails
the command. Results default to `/tmp/gig-security-results.json`. CI runs this check and
an npm advisory audit. See [the original assessment](docs/SECURITY_ASSESSMENT.md) for scope
and historical findings; recorded remediation evidence is in [TEST_REPORT.md](TEST_REPORT.md).

Structured security events go to stdout without passwords, session tokens or financial
notes. Compose rotates local app logs (five 10 MB files). Configure off-host retention,
access control and alerts for repeated authentication failures, CSRF denials and admin
credential changes on your intended server; local rotation does not provide alert delivery.
Images and Actions are pinned; review advisory results and update pins deliberately.
The optional external AI call excludes free-text notes, has a 15-second request timeout,
a bounded output, and a per-account five-request/hour limit. Credential changes have
per-account limits, and password changes also have a client-IP limit. Limits are per
process; multiple app instances need shared state.

### Docker Sandboxes port access

Inside Docker Sandboxes, publish the app on the sandbox interfaces using the
optional override (requires Docker Compose 2.24.4 or later):

```bash
docker compose --env-file ../gig-income-tracker.env \
  -f docker-compose.yml -f docker-compose.sandbox.yml up -d --wait
```

This replaces the localhost binding with `0.0.0.0:3000` inside the sandbox.
Use the sandbox forwarding mechanism to reach port 3000 from your host.
PostgreSQL remains unpublished. The base Compose file retains its localhost
binding for deployments behind a reverse proxy.
