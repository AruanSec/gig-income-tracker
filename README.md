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
- **CSV & Print Export**: Export monthly tax ledgers directly for CRA filing or personal accounting.

### 3. Tax & Mileage Planning
- **Configurable Per-Kilometre Estimates**: Applies year-specific rates to mileage for planning and comparison.
- **Actual Expense Comparison**: Compares kilometre-based estimates with tracked vehicle expenses.

> **Tax disclaimer**: This application is a record-keeping and planning tool, not tax advice. CRA prescribed per-kilometre allowance rates are not automatically a deduction method for every self-employed worker. Confirm the applicable method, rates, GST/HST treatment, and documentation requirements with current CRA guidance or a qualified Canadian tax professional before filing.

---

## Deploy to a Linux server

The recommended deployment runs the application and PostgreSQL with Docker Compose, with Caddy on the host providing HTTPS. The multi-stage Dockerfile uses Node 22 and runs the application as the unprivileged `node` user. PostgreSQL data lives in the `postgres_data` Docker volume; SQLite is a development fallback only.

### 1. Prepare the server and source code

These instructions assume an Ubuntu or Debian server, a user with SSH and sudo access, and a domain such as `tracker.example.com` pointing to the server's public IP. Replace example domains and repository placeholders with your own values.

- Install [Docker Engine and the Compose plugin](https://docs.docker.com/engine/install/). Use Docker Compose **2.24.4 or newer**; the server override below uses `!override` and `!reset`.
- Install Caddy using its [Linux installation instructions](https://caddyserver.com/docs/install#debian-ubuntu-raspbian).
- Allow inbound TCP ports **80 and 443** in the server/provider firewall and preserve your SSH access. Ports 3000 and 5432 do not need public access. Configure any domain AAAA record to reach this server as well, or remove an incorrect AAAA record.
- Enable Docker at boot: `sudo systemctl enable --now docker`. Run the commands below as a user authorized to use Docker.

Copy the project source to `~/apps/gig-income-tracker`, or clone your repository:

```bash
mkdir -p ~/apps
# Replace YOUR_REPOSITORY_URL with the repository containing this project.
git clone YOUR_REPOSITORY_URL ~/apps/gig-income-tracker
cd ~/apps/gig-income-tracker
docker compose version
```

If uploading files, include `package-lock.json`, `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `index.html`, the build configuration, `server.ts`, and `src/`. Exclude local `node_modules`, `dist`, database files, and secrets. Node.js does not need to be installed on the host for this deployment.

### 2. Configure credentials

From the project directory, create a restricted environment file **outside the Docker build context**:

```bash
umask 077
cat > ../gig-income-tracker.env <<EOF
POSTGRES_USER=gig_tracker
POSTGRES_PASSWORD=$(openssl rand -hex 32)
POSTGRES_DB=tax_mileage_db
GEMINI_API_KEY=
EOF
chmod 600 ../gig-income-tracker.env
```

Run this step once for a new deployment. Keep the file for later restarts and upgrades. Hexadecimal passwords work directly in the connection URL assembled by Compose. Changing `POSTGRES_PASSWORD` after PostgreSQL has initialized does not change the database user's password; rotate it in PostgreSQL and update the file together.

Leave `GEMINI_API_KEY` empty to use local statistical insights, or set a real key to enable external AI analysis. The application sends income information, including notes, to Gemini when that analysis runs.

Compose reads this file through `--env-file` and supplies the application with `DATABASE_URL`, `NODE_ENV=production`, and `PORT=3000`. Keep credentials out of source control and the project directory; the current `.dockerignore` does not exclude environment files.

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

The base Compose file publishes both ports on all interfaces. This override removes PostgreSQL's published port and restricts the application to the host's loopback interface. Containers still reach PostgreSQL over the private Compose network.

Define this shell helper in each new SSH session, after changing to `~/apps/gig-income-tracker`. Use it for all server operations so the environment file and port override are always applied:

```bash
dc() {
  docker compose --env-file ../gig-income-tracker.env \
    -f docker-compose.yml -f compose.server.yml "$@"
}
```

### 4. Build, start, and verify

```bash
dc config --quiet
dc up -d --build
dc ps
dc logs --tail=100 tax-mileage-app postgres
curl --fail http://127.0.0.1:3000/api/health
```

The health response should contain `"status":"ok"` and `"database":"PostgreSQL"`. Compose waits for PostgreSQL's startup health check before starting the app. Tables are created automatically on application startup. The health endpoint reports the configured database engine; it does not execute a database query on every request.

Both services use `restart: unless-stopped`. Keep the project directory/name consistent across deployments so Compose reuses the same named volume. `dc down` preserves database data; **`dc down -v` deletes the database volume**.

### 5. Enable HTTPS with Caddy

For a dedicated Caddy installation, put the following in `/etc/caddy/Caddyfile`, replacing the domain. If Caddy already serves other sites, add this site block to its existing configuration:

```caddyfile
tracker.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl enable --now caddy
sudo systemctl reload caddy
curl --fail https://tracker.example.com/api/health
```

Caddy obtains and renews the TLS certificate and redirects HTTP to HTTPS. Its certificate setup requires correct DNS and inbound access to ports 80/443. Open `https://tracker.example.com` and create an account. New accounts currently receive sample financial records; remove them before entering real records. See [TEST_REPORT.md](TEST_REPORT.md) for the current functional findings.

### Back up and restore PostgreSQL

Run backups from the project directory with `dc` defined as above. A database dump includes accounts, financial records, and custom CRA rates. The application's JSON export currently omits CRA rates.

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
dc exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges --single-transaction --exit-on-error' < "$backup_file"
# Continue only after pg_restore succeeds.
dc start tax-mileage-app
curl --fail https://tracker.example.com/api/health
```

### Update or stop the application

Back up the database before each update. For a Git checkout, fetch and select the release you intend to deploy; for an uploaded project, upload the new source while preserving `compose.server.yml` and the external environment file.

```bash
git fetch --tags origin
# Replace YOUR_RELEASE_TAG_OR_COMMIT with the desired version.
git checkout YOUR_RELEASE_TAG_OR_COMMIT
dc config --quiet
dc up -d --build
dc ps
dc logs --tail=100 tax-mileage-app
curl --fail https://tracker.example.com/api/health
```

A single application container can have a brief interruption during an update. To roll back, check out the previous compatible release and rebuild. If a release changed the database schema incompatibly, restore its matching pre-update backup too.

```bash
# Stop the services and keep the database volume.
dc down
```

### Troubleshooting

- **Caddy returns 502:** check `dc ps`, application logs, and the local health URL. Confirm the app publishes `127.0.0.1:3000:3000`.
- **PostgreSQL authentication fails:** check the environment file and database logs. Existing volumes keep their original database credentials even if the environment file changes.
- **Application repeatedly exits:** production requires reachable PostgreSQL and does not fall back to SQLite. Startup failures currently exit with status 0, so inspect logs and the health URL instead of relying only on the exit code.
- **All users receive authentication rate limits:** the current app uses an in-memory IP limiter and does not configure Express to trust a reverse proxy, so requests through Caddy can share its IP-based limit. Configure proxy trust for your specific network before relying on per-user IP limits at scale.
- **Certificate setup fails:** check DNS, firewall rules, and `sudo journalctl -u caddy --no-pager -n 100`.

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
| `POSTGRES_PASSWORD` | `postgres` in Compose | Set a strong password before the first startup |
| `POSTGRES_DB` | `tax_mileage_db` | Database name |
| `POSTGRES_HOST` / `POSTGRES_PORT` | Host-dependent / `5432` | Alternative database connection configuration; Compose supplies these |
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
The browser suite starts its own server on port 4173 with an in-memory SQLite
database and external AI disabled. Keep that port free. It checks financial-form
save failures, retained drafts, retries, and repeated submissions. It does not use
or alter the normal development database.
