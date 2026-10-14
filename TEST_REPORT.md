# Test report

Executed against the current code on 2026-10-14. No application source changes were made.

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
