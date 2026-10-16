# OWASP Top 10 security assessment

> Historical assessment. The eight application findings were subsequently addressed;
> see [Security remediation](SECURITY_REMEDIATION.md) for changes, verification and
> remaining deployment responsibilities. The findings below describe the original baseline.

Assessed 2026-10-16 UTC. Application baseline: `588ffd8d40213bfc38d90b3e544d59798736e738`.
Final probes ran on `staging` at `e6ccd1b317de4af312508dec73c81925a271d2c0`.
Only the assessment runner was added to the application baseline during testing.

**Release security remains open.** The local assessment found weaknesses requiring
remediation. No critical vulnerability or unauthenticated cross-account compromise
was demonstrated. The highest-priority finding is an unsafe deployment default;
its severity depends on deploying without the documented server override.
No application security fixes are included in this assessment.

## Scope and evidence

Used the [OWASP Top 10:2025](https://owasp.org/Top10/2025/) categories, with a
2021 mapping below. This is a targeted source review and local dynamic assessment,
not certification or exhaustive penetration testing. The reference site could not
be retrieved in this environment (403; the GitHub mirror returned 502).

The production server bundle ran against a fresh PostgreSQL 16.15 container with
disposable accounts. Chromium tested stored HTML, CSV output and browser token
storage. External AI was disabled. The runner creates its own database and app;
it accepts no remote target URL. No production data or external host was attacked.
Fixture-only database changes established an admin, expired a session and
temporarily renamed a table to test failure handling. Containers and test volumes
were removed after execution.

Environment: Node 22.22.1, npm 9.2.0, Playwright 1.64.0, Docker 29.7.2, Compose 5.5.0.
The final run completed **21 probe groups: 14 PASS, 7 GAP, 0 ERROR**.
A GAP is a diagnostic finding, so exit code 0 does not mean the application is secure.
Grouped probes contain multiple requests; these counts are not vulnerability counts.

- [Raw probe results](security/owasp-probe-results.json): exact staging SHA, outcomes and observations; no bearer tokens or database passwords.
- [Dependency audit results](security/npm-audit.json): `npm audit --json` reported zero known advisories at assessment time. This does not rule out undisclosed or unreported vulnerabilities.
- [Reproducible runner](../tests/security.audit.mjs).

## Prioritized findings

Severity is qualitative, based on prerequisites and observed impact; CVSS scores
were not calculated. Static/configuration findings are distinguished from runtime
reproductions. Missing defense-in-depth controls alone do not prove exploitation.

### SEC-01 — High, conditional: unsafe base deployment defaults

**A02 Security Misconfiguration.** `docker-compose.yml:7` defaults to the
standard database user and password; lines 11 and 29 publish database and app
ports without a loopback binding. `docker compose config --format json` with
credential variables unset confirmed these defaults. The initial PostgreSQL user
is a superuser under the official image, and the app uses that same account.

If deployed unchanged on a reachable host, an attacker could access PostgreSQL
using the published default credentials, compromising records and sessions.
No real server exposure was tested. README instructions provide strong credentials
and a private-port override; deployments following them reduce this risk.

**Remediation:** require explicitly supplied credentials, make private ports the
default, and use a separate least-privileged application database role. Verify
firewall rules and the actual production configuration.

### SEC-02 — Medium: database stores reusable bearer tokens

**A04 Cryptographic Failures / A07 Authentication Failures.**
`server.ts:161` and `server.ts:194` store the bearer token itself in `sessions.id`;
`server.ts:86` authenticates with that value. The probe read its own disposable
account's token through the database and successfully replayed it to
`GET /api/auth/me` (200). A database-read compromise therefore also compromises
unexpired sessions without needing password cracking. This is conditional on
database access, not an unauthenticated token disclosure endpoint.

**Remediation:** persist only a digest of a high-entropy token; hash incoming
tokens before lookup and migrate or revoke existing sessions.

### SEC-03 — Medium: password verification outside login has no throttling

**A07 Authentication Failures / A06 Insecure Design.**
`POST /api/auth/change-password` (`server.ts:228`) is authenticated but has no
rate limiter. All 22 deliberately incorrect current passwords returned 400;
none returned 429. A stolen session can repeatedly guess the current password
and consume scrypt resources. Distributed load and denial of service were not tested.
Login/signup do have a bounded per-process IP limiter; rotating untrusted
`X-Forwarded-For` values did not bypass it.

**Remediation:** apply bounded per-account and per-client limits to password
verification and privileged credential changes; use shared state before scaling.

### SEC-04 — Medium: no application security-event audit trail

**A09 Security Logging and Alerting Failures.** A successful admin password reset
emitted zero log characters in the production process. Source review found
generic error logging but no security event sink for failed authentication,
password/role changes, resets or destructive admin actions. Reverse-proxy access
logs alone would not identify the affected account or credential-change outcome.

**Remediation:** add structured actor/action/target/outcome events, protect and
retain them, and configure alerts. Exclude passwords, bearer tokens and financial notes.
External logging/monitoring infrastructure was not available for assessment.

### SEC-05 — Medium, conditional: browser-readable persistent session token

**A07 Authentication Failures / A06 Insecure Design.** `src/App.tsx:167` stores
the bearer token in localStorage. The browser probe confirmed same-origin
JavaScript can retrieve it. Any future same-origin XSS or compromised frontend
dependency could steal a session. The tested stored-XSS payload did not execute;
no XSS exploit is claimed. Sessions are configured for 30 days.

**Remediation:** consider Secure, HttpOnly, appropriately SameSite cookies with
explicit CSRF defenses, plus suitable expiry and reauthentication policies.
A cookie migration requires coordinated frontend and backend changes.

### SEC-06 — Low: unauthenticated backend source disclosure

**A02 Security Misconfiguration.** `GET /server.cjs` and
`GET /server.cjs.map` both returned 200 without authentication. The map included
backend `sourcesContent`. `server.ts:1032` serves the entire `dist` directory,
which also contains the backend output from the build script.
This reveals implementation details; no embedded production secret was demonstrated.

**Remediation:** place the public frontend and private server output in separate
directories, serve only the frontend directory, and restrict server source maps.

### SEC-07 — Low: missing private-response cache policy and CSP

**A02 Security Misconfiguration.** An authenticated `GET /api/backup` returned
no Cache-Control policy. HTML returned no Content-Security-Policy header.
`nosniff`, frame denial and a no-referrer policy were present.
No actual shared-cache disclosure or CSP-bypass exploit was demonstrated.

**Remediation:** apply `Cache-Control: no-store` to auth/private API responses and
deploy a tested CSP. HSTS was absent at the direct HTTP app endpoint; its presence
at the intended HTTPS proxy remains an operational check, not a proven TLS defect.

### SEC-08 — Low: account enumeration through signup

**A07 Authentication Failures.** Submitting an existing email to signup returned
400 with `User already exists with this email`; new addresses receive 201.
This exposes account existence and can assist targeted attacks. Login errors are
generic; signup enumeration is constrained by the authentication IP limiter.

**Remediation:** use a verification-based registration flow with consistent public
responses where account privacy is required. Changing only the message while
preserving distinguishable status/behavior would be insufficient.

## Coverage of all ten categories

| OWASP 2025 category | Evidence and result |
|---|---|
| A01 Broken Access Control | PASS for tested unauthenticated requests, cross-user list/update/delete, owner mass assignment, admin read/write authorization, backup and custom-rate isolation. Forged signup role ignored. No user-controlled outbound URL sink identified in reviewed routes; SSRF not demonstrated. |
| A02 Security Misconfiguration | Findings SEC-01, SEC-06, SEC-07. Project-file probes returned the SPA shell rather than file contents. No permissive CORS response observed. HTTPS proxy and server configuration untested. |
| A03 Software Supply Chain Failures | npm audit: zero advisories. npm lockfile and `npm ci` are used. Static gaps: Actions use version tags rather than commit SHAs, base images use mutable tags, and CI has no dedicated advisory scan. No supply-chain compromise demonstrated; container OS packages and build provenance were not scanned. |
| A04 Cryptographic Failures | SEC-02. New passwords used salted scrypt; distinct salts/hashes for identical fixture passwords. Source also permits legacy PBKDF2 with 1,000 iterations until successful-login upgrade; presence of legacy hashes in real databases is unknown. At-rest encryption and remote PostgreSQL TLS were not verified. |
| A05 Injection | Tested SQL payloads remained data; ID injection did not alter records. Stored HTML rendered as text and did not create an event-handler element. CSV category `=1+1` was emitted after a fixed label, not at the beginning of the field; no spreadsheet application was exercised. No exploitable SQL/XSS injection demonstrated in tested paths. |
| A06 Insecure Design | SEC-03, SEC-05. Optional AI route forwards financial notes into a prompt and has no dedicated quota/rate limiter; privacy, prompt manipulation, provider errors and cost controls require review before enabling it. No external AI calls were made. |
| A07 Authentication Failures | SEC-02, SEC-03, SEC-05, SEC-08. PASS for token shape/distinctness, expired-session rejection, logout revocation, login/signup limiting, and rejection of forwarding-header spoofing with proxy trust disabled. Token randomness was reviewed at source, not statistically proven. MFA and breached-password screening are absent at source; requirements depend on deployment risk. |
| A08 Software or Data Integrity Failures | Malformed restore rejected without changes; caller-supplied owner/role did not override server ownership. JSON restore is parsed/validated, not executable deserialization. No signing/provenance verification for build artifacts observed. A fully malicious but valid backup can replace the caller's own records by design. |
| A09 Security Logging and Alerting Failures | SEC-04. Application error logs exist; no application security-event audit sink identified. Off-host retention, alerts and incident response not tested. |
| A10 Mishandling of Exceptional Conditions | PASS for malformed/null/array JSON, oversized body (413), continued liveness, atomic invalid restore, generic 500 on induced database query failure, and recovery after restoring the table. No stack/SQL details returned in that error response. Sustained resource exhaustion, races and process-level chaos were not tested. |

For OWASP 2021: A01 maps to 2025 A01; A02 to A04; A03 to A05; A04 to A06;
A05 to A02; A06 to A03; A07 to A07; A08 to A08; A09 to A09; SSRF A10 is
covered by the A01 sink review. The new 2025 A10 exceptional-condition coverage
is additional. No category receives a blanket security clearance.

## Reproduction and validation

Prerequisites: Docker access, Node 22, installed dependencies, and Playwright Chromium
with its operating-system libraries. Run from the repository root:

```bash
npm ci
npm run build
node tests/security.audit.mjs
npm audit --json
```

The runner writes sanitized results to `/tmp/gig-security-results.json`; set
`SECURITY_AUDIT_OUTPUT` to choose another output file. It binds disposable service
ports on loopback; the temporary app listens on all interfaces as the existing
server does, so run in an isolated development environment. Cleanup removes only
its randomly named container and attached anonymous volume. Concurrent runs use
independent containers, accounts and ports.

This host required these existing temporary browser dependencies:

```bash
LD_LIBRARY_PATH=/tmp/gig-browser-libs/usr/lib/x86_64-linux-gnu \
FONTCONFIG_FILE=/tmp/gig-browser-libs/fonts.conf \
node tests/security.audit.mjs
```

Staging checks: `npm test` passed four original groups and 19 regressions, with
one PostgreSQL migration test skipped in that command because TEST_DATABASE_URL
was unset. `npm run typecheck` and `npm run build` passed (existing bundle-size
warning). The new security runner itself used PostgreSQL and production mode.
Its initial browser selector did not account for literal quotation marks around
notes; the corrected runner completed all 21 groups with zero errors on staging.
`node --check`, evidence JSON, document links, table structure and whitespace
are checked on staging before promotion.

No production deployment, remote scan, TLS scan, ZAP scan, sustained load test,
external AI test or hosted CI execution occurred. No Git remote is configured,
so upstream freshness could not be verified. Remediation should follow SEC-01
through SEC-05 first, then disclosure/cache/CSP/account privacy, with regression
verification on staging before any release.
