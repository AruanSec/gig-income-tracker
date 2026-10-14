# Exit criteria

Status as of 2026-10-14. This checklist records completed work and proposes the remaining criteria for a production release. The release criteria below have not previously been agreed as a formal acceptance specification.

**Current status: review, testing, deployment documentation, and npm cleanup are complete. Application fixes and server deployment remain open.** The review findings have not been fixed by the documentation or package-manager changes.

## Completed work

- [x] Review the backend, frontend, database layer, authentication, financial calculations, and deployment configuration; prioritize recommendations.
- [x] Run the existing unit tests: all four test groups passed.
- [x] Run TypeScript checking and the production build: both passed. The build still reports a bundle-size warning.
- [x] Exercise the API against isolated SQLite and PostgreSQL databases and run targeted Chromium checks. Of 54 additional checks, 37 passed and 17 failed, representing 10 distinct issues. See [TEST_REPORT.md](TEST_REPORT.md).
- [x] Verify income, mileage, and expense CRUD, record ownership, server-calculated derived values, and basic validation.
- [x] Verify login/logout, ordinary-user restrictions, and revocation of other sessions after a user changes their own password.
- [x] Verify financial-entry backup/restore, PostgreSQL transaction rollback after an injected restore failure, and persistence across an application process restart.
- [x] Document server setup, Docker Compose, credentials, private ports, Caddy HTTPS, database backups/restores, upgrades, and troubleshooting in [README.md](README.md).
- [x] Validate README shell syntax and the merged Compose configuration, including private database access and loopback-only application access. The server override is documented for the operator to create; it is not a committed deployment file.
- [x] Standardize on npm: remove `bun.lock`, retain `package-lock.json`, document the choice, verify the lockfile matches the manifest, and complete an `npm ci --dry-run` check.
- [x] Remove the temporary test services without using existing user data.

These are results from the recorded test run, not evidence that every workflow or every deployment environment passes.

## Remaining fixes for the proposed release

Each item needs implementation and a passing regression check before it is marked complete.

| Done | ID | Work remaining | Exit condition |
|---|---|---|---|
| [ ] | R1 | Correct calendar-date handling | January 1, month boundaries, and year boundaries remain in the correct accounting period in UTC and Canadian time zones. The Toronto annual-report case exports gross income 100.00 rather than 0.00. |
| [ ] | R2 | Preserve input after failed saves | A rejected or failed save keeps the form and entered values, shows an actionable error, and allows retry. Pending submissions cannot create duplicate records. Verify income, mileage, and expense forms. |
| [ ] | R3 | Reject impossible dates | Values such as `2026-02-30` return HTTP 400 without changing records. Valid leap days are accepted. Apply the same rules to restore input. |
| [ ] | R4 | Reject invalid numeric types | Required amounts reject null, empty strings, booleans, and non-finite values with HTTP 400. Explicit numeric zero remains valid where allowed. |
| [ ] | R5 | Validate CRA rate settings | Year, threshold, and rates have explicit validation. Negative or non-finite rates and malformed years are rejected without changing saved settings. |
| [ ] | R6 | Restore all report inputs | Versioned backups include custom CRA rates as well as financial entries. A restore reproduces those settings and calculated reports; invalid input or a database failure preserves the previous data. Define handling for older backups. |
| [ ] | R7 | Return correct validation statuses | A short new password returns HTTP 400, not 500. Expected validation failures consistently use client-error responses; internal failures do not expose database or stack details. |
| [ ] | R8 | Revoke sessions after an admin password reset | Password reset and session revocation happen transactionally. Existing tokens are rejected afterward, and login with the replacement password succeeds. |
| [ ] | R9 | Separate demo and real records | New real accounts begin with empty income, mileage, and expense ledgers. Loading sample data is an explicit action and cannot silently contaminate real reports. This is a proposed product change to the current onboarding behavior. |
| [ ] | R10 | Signal unsuccessful production startup | An unavailable production database prevents the app from serving, produces a useful log, and exits with a nonzero status. SQLite is never selected as the production fallback. |

## Financial correctness identified during review

These recommendations still need implementation and focused tests; they were not all covered by the 54 additional checks.

- [ ] **F1 — Use Canadian currency consistently.** Screens and exports identify CAD. Store and calculate money with exact cents or an equivalent decimal strategy, including a verified migration for existing values.
- [ ] **F2 — Make deduction comparisons conditional on eligibility.** Reports and exports distinguish planning estimates from eligible filing deductions. A larger calculated value alone does not establish that a method is allowed. Document and review the assumptions, including GST/HST treatment and business use.
- [ ] **F3 — Preserve financial losses.** Profit calculations and exports retain negative profit when expenses exceed revenue. Any zero floor for an estimated tax calculation is applied separately and explained.
- [ ] **F4 — Verify calculation boundaries.** Tests cover annual mileage-threshold resets, a trip crossing the threshold, filtered-period totals, missing-year rate behavior, and income spanning reporting periods. The policy for assigning multi-day income to periods is explicit.
- [ ] **F5 — Remove stale reporting defaults.** Reporting defaults use the current date or available records rather than fixed June/Q2/2026 selections.

## Verification and deployment still to complete

- [ ] **V1 — Make regression testing repeatable.** Move the relevant temporary API/browser checks into maintained project tests, document their dependencies, and run them in CI. Existing failures must become passing checks; the permanent `npm test` currently runs only the small unit-test runner.
- [ ] **V2 — Reverify the final code.** Run `npm ci`, `npm test`, `npm run typecheck`, and `npm run build`, plus the maintained API/browser checks, against the release candidate. Record versions, results, and any intentionally deferred checks.
- [ ] **V3 — Exercise the full Docker deployment.** Build the actual application image and start the documented stack with a fresh PostgreSQL volume. Verify startup, signup, CRUD, exports, logs, and health behavior. Confirm financial data survives application and database-container restarts and Compose recreation without volume deletion.
- [ ] **V4 — Verify recovery.** Create a PostgreSQL dump and restore it into a separate database. Compare accounts, entries, custom rates, and resulting reports. Establish scheduled off-server backups and a tested recovery procedure.
- [ ] **V5 — Verify server operation.** On the intended server, confirm DNS, HTTPS/certificate renewal, private database access, loopback application access, service restart after reboot, and an upgrade/rollback procedure. No server has been deployed in this work.
- [ ] **V6 — Make readiness and proxy behavior accurate.** Database unavailability causes readiness to fail. Configure proxy trust for the actual deployment topology and verify that one user's authentication attempts do not incorrectly exhaust every user's IP limit.
- [ ] **V7 — Check remaining user workflows.** Verify successful and failed saves, searching/filtering, CSV escaping and safe downloads, printing, and key mobile/keyboard workflows. Validate external AI behavior separately if it will be enabled; the recorded tests disabled external AI calls.

## Follow-up improvements

These are recommended improvements rather than additional confirmed failures from the recorded test run. Decide their release priority separately.

- [ ] Split large server and React modules into routes, data hooks, and pure calculation functions; progressively enable TypeScript strictness.
- [ ] Add versioned database migrations and constraints for financial invariants.
- [ ] Review session storage: HttpOnly/Secure/SameSite cookies with appropriate CSRF protection, hashed session tokens, and expired-session cleanup.
- [ ] Add bounded/shared rate limiting where needed and usage limits for paid AI calls; distinguish generic fallback advice from data-derived findings.
- [ ] Lazy-load heavy screens/charts and measure whether the current approximately 1.17 MB JavaScript bundle meets the intended performance target.

## Release decision

The proposed release is complete when R1–R10, F1–F5, and V1–V7 pass with recorded evidence, or any deferred item has an explicit agreed scope and acceptance decision. Documentation completion and a successful build alone do not establish production readiness. Update this checklist and the test report when fixes are verified.
