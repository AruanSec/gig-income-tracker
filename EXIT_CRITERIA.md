# Production Release Exit Criteria

Status: 2026-10-16 UTC. Locally verified candidate: `fcb6528`.

**Release readiness remains open.** Application fixes and local Docker recovery
checks have passed. Hosted CI, tax review, production operations and remaining
user workflows still require evidence. These are proposed release gates; checked
items describe recorded verification, not a guarantee for every environment.
See [TEST_REPORT.md](TEST_REPORT.md) for results and limitations.

## Verified application criteria

- [x] **R1 — Calendar accuracy:** records remain in the correct accounting period
  across year/month boundaries in UTC, Toronto and Vancouver.
- [x] **R2 — Failed saves:** income, mileage and expense forms retain drafts,
  display errors, permit retry and prevent repeat submission while pending.
- [x] **R3–R5 — Input validation:** impossible dates, invalid numeric types and
  malformed or negative CRA settings return client errors without changing data.
- [x] **R6 — Complete backups:** versioned backups restore financial records and
  custom rates; legacy backups preserve existing rates; invalid restores are atomic.
- [x] **R7 — Safe API errors:** parser and validation failures return appropriate
  client errors, conflicts return 409 and internal failures expose no database details.
- [x] **R8 — Session revocation:** administrator password resets revoke existing
  sessions transactionally; replacement credentials work.
- [x] **R9 — Clean onboarding:** real accounts start empty; sample data requires
  an explicit action.
- [x] **R10 — Production startup:** unavailable PostgreSQL causes a nonzero exit;
  production never falls back to SQLite.

## Financial acceptance

- [x] **F1 — Exact CAD values:** decimal arithmetic, cent validation, database
  storage and transactional migrations preserve financial values.
- [ ] **F2 — Canadian tax review:** a qualified reviewer checks eligibility,
  kilometre versus receipt comparisons, GST/HST assumptions and saved annual
  rates against current CRA guidance. Record reviewer, date, sources, findings
  and resolution of any corrections in [docs/FINANCIAL_POLICY.md](docs/FINANCIAL_POLICY.md).
- [x] **F3 — Losses:** reports and exports preserve negative profit.
- [x] **F4 — Calculation boundaries:** annual tiers, crossing trips, same-day
  ordering, matching-year rates, missing-rate warnings and receipt rounding pass.
- [x] **F5 — Current defaults:** report periods use current dates or available records.

## Verification and operational gates

| Status | ID | Exit condition and required evidence |
|---|---|---|
| Open | V1 | Run the maintained GitHub Actions workflow successfully. Record the workflow URL and tested commit; both database backends, migrations, Chromium and Docker deployment checks must pass. |
| Passed locally | V2 | Candidate `fcb6528` verified from clean `npm ci` on staging `8c4069c` with an identical tracked tree: unit/migration tests (no skips), TypeScript, production build, both API suites and all 21 Chromium checks passed. Docker recovery also passed on retry. Versions and evidence are in [TEST_REPORT.md](TEST_REPORT.md). Repeat for any subsequent application change. |
| Passed locally | V3 | Actual image build, fresh PostgreSQL volume, signup, financial CRUD, custom rates and browser CSV export pass. Records survive app restart, database outage/recovery and Compose recreation without deleting the volume. |
| Partial | V4 | Local dump/restore already reproduces accounts, records, rates and CSV exactly. Establish scheduled off-server backups, retention, protected backup access and failure alerts; restore an off-server copy and record recovery time and acceptable data loss. |
| Open | V5 | On the intended server, verify DNS, HTTPS and certificate renewal, private database access, loopback app access, restart after reboot and an upgrade/rollback rehearsal. Record commands, outcomes and deployed image/commit. No server deployment has occurred. |
| Partial | V6 | Local readiness 503 during database outage, liveness 200, reconnection and independent proxy client limits pass. Repeat using the intended Caddy topology and actual trusted proxy addresses; prove spoofed forwarding headers cannot bypass limits. |
| Open | V7 | Record passing successful/failed saves, search/filter behavior, CSV escaping and spreadsheet-formula safety, downloads, printing, mobile layouts and keyboard navigation. If AI is enabled, verify its success/failure behavior, privacy assumptions and usage limits; otherwise document that it is disabled. |

Use only disposable databases for automated API and migration tests. Follow
[README.md](README.md) for test dependencies, proxy configuration and recovery.
Local staging-branch checks do not establish a staging-server deployment.

## Release decision and evidence

Release when all open gates above pass, or the release owner explicitly records
an accepted deferral with scope, impact and follow-up owner/date. Do not mark
partial items complete based on documentation alone.

For each newly completed gate, add the date, exact commit/image, environment,
command or procedure, outcome and evidence link to `TEST_REPORT.md`. Resolve
failures on a feature branch, integrate and verify on `staging`, then promote
only the tested changes to `main` as required by [AGENTS.md](AGENTS.md).

Module refactoring, broader TypeScript strictness, session-storage redesign and
bundle-size reduction remain follow-up improvements. Shared rate limiting is
required before running multiple application instances; current limits are per
process. The existing approximately 1.20 MB JavaScript bundle warning remains.
