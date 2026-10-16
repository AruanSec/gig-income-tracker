# Security remediation

The application findings from [the OWASP assessment](SECURITY_ASSESSMENT.md) have
been addressed on `feature/security-gap-remediation` and verified locally on
`staging`. The original assessment and its evidence are retained as a historical
record. No production server was deployed or scanned.

## Changes

| Finding | Remediation |
|---|---|
| SEC-01: deployment defaults | Compose requires separate administrator and application passwords, leaves PostgreSQL unpublished, binds the app to loopback, and initializes a restricted `gig_app` role. The app does not receive administrator credentials. |
| SEC-02: raw database session tokens | Only SHA-256 digests of 256-bit random tokens are stored. Startup converts legacy IDs transactionally and repeated startup preserves existing digests. A stored digest cannot authenticate a request. |
| SEC-03: password guessing | Password changes have per-client and per-account limits. Privileged account changes have a separate per-actor limit. All limiter maps have bounded state and return Retry-After. |
| SEC-04: security audit trail | Structured events cover authentication, denials, admin operations, backups/restores and local admin provisioning. Events contain actor, action, target and outcome, excluding bodies, credentials and financial notes. Compose rotates app logs locally. |
| SEC-05: browser-readable tokens | Default login sets an HttpOnly, SameSite=Strict cookie, Secure in production, with eight-hour expiry. Responses contain no token. The UI removes old localStorage credentials and uses cookies. Cookie writes require an exact matching Origin. Explicit bearer mode remains available to password-authenticated API clients. |
| SEC-06: backend source exposure | Vite output is in `dist/public`; Express serves only that directory. Backend bundles and maps remain outside it. Requests for `.cjs` and `.map` files return 404. |
| SEC-07: cache policy/CSP | Private APIs use no-store. Production HTML has CSP restricting scripts to this origin; inline styles and existing Google fonts remain permitted for the current UI. HTTPS requests recognized through an explicitly trusted proxy receive HSTS. |
| SEC-08: signup enumeration | Public signup is disabled with an identical response for existing and unknown emails, as requested. Operators provision the first administrator locally; the admin portal creates subsequent accounts. |

Additional hardening pins production image digests and GitHub Action SHAs, adds
an npm advisory audit and the security regression to CI, rejects weak legacy
PBKDF2 credentials until an administrator reset, and caps login password length.
The optional external AI request omits free-text notes, has a 15-second provider
timeout and bounded output, and is limited to five calls per account per hour.

## Verification evidence

Final command results and tested revisions are recorded in
[TEST_REPORT.md](../TEST_REPORT.md), with sanitized probe results in
[security/owasp-remediation-results.json](security/owasp-remediation-results.json).
The runner exits unsuccessfully for any GAP or ERROR, so a completed diagnostic
run with findings can no longer appear as a passing security regression.

Testing covers production HTTP routes and Chromium against a disposable PostgreSQL
database, both API database backends, financial/save browser workflows, and the
real Docker image with a non-superuser application role. It exercises session
digest migration/replay, cookie flags and browser storage, CSRF, password limits,
public-file restrictions, audit output, failure recovery and proxy/HSTS behavior.
The deployment regression verifies restart persistence and restores a dump into a
separate database owned by the restricted role before comparing records and CSV.

## Upgrade and operational boundaries

Follow [SECURITY_UPGRADE.md](SECURITY_UPGRADE.md) before upgrading an existing
deployment. It covers the database-role migration, first administrator, required
legacy password resets and browser sign-in changes. Preserve backups and rehearse
the upgrade on disposable data first. Existing API sessions retain their previous
expiry after their IDs are hashed; new sessions expire after eight hours.

Local security tests do not prove the intended server's DNS, HTTPS certificates,
firewall, at-rest encryption, off-host log retention, alerts or backup operations.
Configure and verify those controls on that host. Local log rotation is not an
alerting service. Per-process limits require shared storage before multiple app
instances are used. External AI provider calls were disabled in testing; provider
success/failure and privacy acceptance remain deployment requirements if enabled.
Pinned components still need deliberate security updates. There is no claim of
exhaustive penetration testing, container OS vulnerability scanning or hosted CI
execution; the checkout has no Git remote configured.
