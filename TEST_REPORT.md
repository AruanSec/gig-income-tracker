# Test report

## API reliability and Docker recovery verification (2026-10-15)

Implemented on `feature/api-reliability-and-deployment-verification` and verified
on `staging`. Node 22.22.1, PostgreSQL 16.15 and Playwright 1.64.0 were used;
Docker builds use Node 22 Bookworm. All databases and volumes were disposable.

| Check on staging | Result |
|---|---|
| `npm test` with disposable `TEST_DATABASE_URL` | PASS: original four groups and all 20 tests, no skips |
| `npm run typecheck` | PASS |
| `npm run build` | PASS; existing approximately 1.20 MB JavaScript bundle warning |
| `npm run test:api`, SQLite and PostgreSQL | PASS on each: 13 scenarios plus production startup failure check |
| `npm run test:deployment` | PASS: real image build, clean `npm ci`, fresh-volume startup and recovery |
| Compose, deployment-script syntax, README shell examples, workflow YAML and whitespace | PASS |

API coverage verifies safe validation/parser responses, generic internal errors,
conflict handling, admin input validation and JSON API 404s. Proxy tests verify
ignored untrusted forwarding headers, explicit trusted proxies, distinct client
limits, spoofed-chain rejection and bounded limiter state. Rate limits remain
per process; multiple instances require a shared limiter.

The deployment check verifies private ports, a non-root runtime, signup, financial
CRUD, custom rates and browser CSV export in Toronto time. App restart and
Compose recreation preserve records. Stopping PostgreSQL causes readiness 503
and Docker unhealthy status while liveness remains 200; the same process
recovers when the database returns. Only readiness queries have a query timeout;
financial writes and migrations have no new client-side query timeout.

A custom-format PostgreSQL dump was restored into a separate database. Both
accounts could log in, and JSON backups and browser CSV reports matched exactly.
Test containers, networks and volumes were removed afterward.

Initial builds failed because HTTP package repositories were unreachable and the
slim builder lacked HTTPS certificates. The final builder uses the standard
Node Bookworm image with compiler tools and certificates; runtime remains slim.
The full 21-case browser suite from the financial verification below was not
repeated; the current deployment check exercises real-image browser CSV export.
Hosted CI, intended-server deployment/HTTPS/reboot checks, scheduled off-server
backups and qualified Canadian tax review remain open. Local Docker verification
is not a deployment to a staging server.

## Financial accuracy verification (2026-10-14)

Implemented on `feature/exact-money-and-reporting-policy` and integrated into
`staging` before promotion. Runtime: Node 22.22.1, PostgreSQL 16.15 and
Playwright 1.64.0. Test services used disposable data; the normal development
database was not opened or migrated.

| Check on staging | Result |
|---|---|
| `npm test` with `TEST_DATABASE_URL` targeting disposable PostgreSQL | PASS: original four groups plus 15 calculation/migration tests, no skips |
| `npm run typecheck` | PASS |
| `npm run build` | PASS; existing bundle-size warning remains (approximately 1.20 MB JavaScript) |
| `npm run test:api` with isolated SQLite | PASS: 11 API scenarios plus production startup failure check |
| `npm run test:api` with disposable PostgreSQL | PASS: same API coverage using the final production server build |
| `npm run test:e2e` | PASS: 21 Chromium checks |
| Workflow YAML, dependency lockfile agreement and `git diff --check` | PASS |

Money regressions cover exact decimal sums, positive/negative rounding ties,
sub-cent rejection, numeric API round trips and signed profit. Both database
migration suites preserve records, recalculate legacy earnings, repeat safely
and roll back both financial tables after an invalid legacy amount.

Boundary coverage includes annual tier resets, fractional crossing trips,
stable same-day ordering, missing-year exclusions, and late-night presets in
UTC/Toronto/Vancouver. Browser checks verify monthly and quarterly reports,
multi-day income assigned to its start year, receipt-level business use,
calculator agreement, retained annual usage after trip-list filtering,
and visible/exported incomplete-rate warnings.

The initial browser attempt timed out during server startup under concurrent
checks. A subsequent preliminary run passed the six financial checks and one
save regression before being intentionally stopped to integrate review fixes.
The final complete run above passed. Local Chromium used the existing temporary
library/font configuration documented by the prior test environment.

See [docs/FINANCIAL_POLICY.md](docs/FINANCIAL_POLICY.md) for migration and rounding
rules. Back up before upgrade: legacy sub-cent rounding requires the original
backup to reverse. Existing saved rates remain unchanged and need review; new
accounts configure their own matching-year rates. A qualified Canadian tax review,
current-rate certification, hosted CI execution and deployment remain pending.

## Earlier verification before the financial-accuracy follow-up (2026-10-14)

All ten behaviors that failed in the original baseline now have passing targeted checks. The original 54-check results are retained below as historical evidence, not as the current failure count.

Changes were implemented on `feature/reliable-record-saves`, `feature/validated-records-and-complete-backups`, and `feature/canadian-financial-reporting`, integrated into `staging`, and tested there before promotion to `main`.

| Check | Result |
|---|---|
| `npm test` | PASS: the original four groups and five calendar/currency/mileage regression tests |
| `npm run typecheck` | PASS |
| `npm run build` | PASS; the approximately 1.17 MB JavaScript bundle still produces a size warning |
| `npm run test:api` with isolated SQLite | PASS: nine API scenarios plus the production startup check |
| `npm run test:api` with disposable PostgreSQL 16 | PASS: nine API scenarios plus the production startup check; exercised the production server build |
| `npm run test:e2e` | PASS: 18 Chromium checks |

The maintained API suite covers empty new accounts, authentication and ownership, strict numeric/date/rate validation, versioned backups with CRA rates, legacy backup compatibility, invalid-restore atomicity, password validation, session revocation, and production startup failure. The browser suite covers create/edit failures and retries, pending-submission locks, and reports in UTC, Toronto, and Vancouver. CSV checks retain cents and negative profit, escape embedded quotes and hash characters, identify CAD, and verify explicit planning-method selection.

GitHub Actions is configured to run unit, type, build, SQLite API, PostgreSQL API, and Chromium checks. This configuration has not yet been executed on GitHub. Local Chromium needed temporary library/font configuration in this environment; the documented `playwright install --with-deps chromium` command supplies browser dependencies on supported CI hosts.

Existing preview records were preserved. Regression servers used separate temporary/in-memory databases; the disposable PostgreSQL container was removed. The broader release work in [EXIT_CRITERIA.md](EXIT_CRITERIA.md), including exact monetary storage, deployment/recovery testing, and readiness/proxy configuration, remains open.

## Original baseline before fixes

Executed against the baseline code on 2026-10-14. No application source changes were made during that baseline run.

## Standard checks

- `npm test`: PASS (all four test groups).
- `npm run typecheck`: PASS.
- `npm run build`: PASS; Vite warns about the 1.17 MB JavaScript bundle (approximately 310 KB gzip).

## Additional checks

54 checks: 37 passed, 17 failed.

The same 24 API checks ran against an isolated SQLite database and an isolated PostgreSQL 16 container. Additional checks exercised PostgreSQL rollback and restart behavior, production startup failure, and Chromium with the America/Toronto timezone.

Failure expectations reflect the recommendations from the review; they are not a previously agreed acceptance specification. In particular, empty onboarding records is a proposed product requirement.

## Confirmed failures

| Behavior | Evidence |
|---|---|
| New accounts contain sample financial records | Signup creates three income entries instead of an empty ledger; both databases. |
| Impossible dates are accepted | `2026-02-30` is stored with HTTP 201; both databases. |
| Null amounts are accepted | `netFare: null` becomes zero with HTTP 201; both databases. |
| Negative CRA rates are accepted | `tier1_rate: -0.5` is stored with HTTP 200; both databases. |
| Backups omit custom calculation settings | Backup response omits CRA rates after a custom rate is saved; both databases. |
| Password validation uses the wrong HTTP status | A short new password returns HTTP 500 instead of 400; both databases. |
| Admin password reset leaves existing sessions active | The old session still accesses `/api/auth/me` with HTTP 200 after reset; both databases. |
| Failed income save discards input | Chromium intercepts POST `/api/income` with HTTP 500; the form closes and entered data disappears. |
| Calendar dates move across reporting years | A single January 1, 2026 income record with gross income 100 exports as gross income 0.00 in the annual 2026 report in Toronto. |
| Failed production startup reports success to the OS | An unavailable PostgreSQL URL logs an error but the process exits with status 0. |

## Passing coverage

- Authentication rejects missing/invalid sessions and wrong passwords.
- Duplicate signup is rejected; regular users cannot access admin endpoints.
- Income, mileage, and expense create/update/delete work and enforce cross-user isolation.
- Derived earnings and mileage are calculated by the server.
- Reversed date/odometer ranges, excessive active time, and excessive GST/HST are rejected.
- Financial-entry backup/restore round trips work.
- Invalid restore input leaves existing records unchanged.
- An injected database failure after deletion and a successful insert rolls back the entire PostgreSQL restore.
- User password changes revoke other sessions while preserving the current session.
- Admin endpoints accept an authorized admin; logout invalidates its session.
- PostgreSQL data and sessions survive an application process restart.
- The authenticated production dashboard renders in Chromium.

## Individual results

| Check | Result |
|---|---|
| SQLite: unauthenticated data denied | PASS |
| SQLite: invalid session denied | PASS |
| SQLite: signup starts with empty financial records | FAIL |
| SQLite: duplicate signup rejected | PASS |
| SQLite: wrong password rejected | PASS |
| SQLite: regular user cannot access admin | PASS |
| SQLite: income CRUD, derived values, and cross-user isolation | PASS |
| SQLite: mileage CRUD, derived values, and cross-user isolation | PASS |
| SQLite: expenses CRUD, derived values, and cross-user isolation | PASS |
| SQLite: invalid date ordering rejected | PASS |
| SQLite: active time over online time rejected | PASS |
| SQLite: invalid odometer range rejected | PASS |
| SQLite: GST greater than expense rejected | PASS |
| SQLite: impossible calendar date rejected | FAIL |
| SQLite: null numeric field rejected | FAIL |
| SQLite: negative CRA rate rejected | FAIL |
| SQLite: backup and restore round trip financial entries | PASS |
| SQLite: invalid restore preserves existing data | PASS |
| SQLite: backup includes calculation settings | FAIL |
| SQLite: password change revokes other sessions | PASS |
| SQLite: short new password returns validation error | FAIL |
| SQLite: admin endpoint available to admin | PASS |
| SQLite: admin password reset revokes existing sessions | FAIL |
| SQLite: logout invalidates session | PASS |
| PostgreSQL: unauthenticated data denied | PASS |
| PostgreSQL: invalid session denied | PASS |
| PostgreSQL: signup starts with empty financial records | FAIL |
| PostgreSQL: duplicate signup rejected | PASS |
| PostgreSQL: wrong password rejected | PASS |
| PostgreSQL: regular user cannot access admin | PASS |
| PostgreSQL: income CRUD, derived values, and cross-user isolation | PASS |
| PostgreSQL: mileage CRUD, derived values, and cross-user isolation | PASS |
| PostgreSQL: expenses CRUD, derived values, and cross-user isolation | PASS |
| PostgreSQL: invalid date ordering rejected | PASS |
| PostgreSQL: active time over online time rejected | PASS |
| PostgreSQL: invalid odometer range rejected | PASS |
| PostgreSQL: GST greater than expense rejected | PASS |
| PostgreSQL: impossible calendar date rejected | FAIL |
| PostgreSQL: null numeric field rejected | FAIL |
| PostgreSQL: negative CRA rate rejected | FAIL |
| PostgreSQL: backup and restore round trip financial entries | PASS |
| PostgreSQL: invalid restore preserves existing data | PASS |
| PostgreSQL: backup includes calculation settings | FAIL |
| PostgreSQL: password change revokes other sessions | PASS |
| PostgreSQL: short new password returns validation error | FAIL |
| PostgreSQL: admin endpoint available to admin | PASS |
| PostgreSQL: admin password reset revokes existing sessions | FAIL |
| PostgreSQL: logout invalidates session | PASS |
| PostgreSQL restore rolls back after failure midway through inserts | PASS |
| PostgreSQL data and sessions survive application restart | PASS |
| production startup failure exits with nonzero status | FAIL |
| authenticated dashboard renders | PASS |
| failed save keeps form and user input | FAIL |
| January 1 income stays in correct tax year in Toronto | FAIL |

## Scope and artifacts

- Existing user data was not used. SQLite used a temporary file; PostgreSQL used a separate disposable container without a persistent host volume.
- API scripts and raw results are in `/tmp/gig-tracker-*test*`. Browser evidence is `/tmp/gig-tracker-failed-save.png` and `/tmp/gig-tracker-toronto-export.csv`. Temporary artifacts may disappear after the session.
- Browser checks used headless Chromium; other browsers, mobile layouts, and accessibility were not exhaustively tested.
- External AI calls were disabled. Full Docker application image deployment and database-container restart persistence were not tested.
- Test services were removed after execution.
