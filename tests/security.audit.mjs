import { provisionAdmin, adminEmail, adminPassword } from './provision.mjs';
// Diagnostic assessment: PASS = checked control; GAP = observed weakness, not a test failure.
// Run after npm run build. Creates its own disposable PostgreSQL container and local app.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import pg from 'pg';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');
const container = `gig-security-${crypto.randomBytes(6).toString('hex')}`;
const tmp = await mkdtemp(path.join(tmpdir(), 'gig-security-'));
const results = [];
let app, pool, browser;
let logs = '';
const docker = args => execFileSync('docker', args, { encoding: 'utf8' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(check) {
  for (let i = 0; i < 240; i++) {
    try { if (await check()) return; } catch {}
    await delay(500);
  }
  throw new Error('Disposable test service did not become ready');
}
async function check(id, run) {
  try {
    const observation = await run();
    results.push({ id, status: observation?.gap ? 'GAP' : 'PASS', detail: observation?.detail || 'Expected security control observed' });
  } catch (error) {
    results.push({ id, status: 'ERROR', detail: error.message });
  }
  console.log(`${results.at(-1).status}: ${id}`);
}
try {
  const dbPassword = crypto.randomBytes(24).toString('hex');
  docker(['run', '-d', '--name', container, '-e', 'POSTGRES_USER=security', '-e', `POSTGRES_PASSWORD=${dbPassword}`,
    '-e', 'POSTGRES_DB=security', '-p', '127.0.0.1::5432', 'postgres:16-alpine']);
  const dbPort = docker(['port', container, '5432']).trim().split(':').at(-1);
  const databaseUrl = `postgresql://security:${dbPassword}@127.0.0.1:${dbPort}/security`;
  pool = new pg.Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 1000 });
  await waitFor(async () => (await pool.query('SELECT 1')).rowCount === 1);
  const socket = net.createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  provisionAdmin({ ...process.env, NODE_ENV: 'production', DATABASE_URL: databaseUrl });
  let adminToken;
  app = spawn(process.execPath, ['dist/server.cjs'], { cwd: root,
    env: { ...process.env, NODE_ENV: 'production', DATABASE_URL: databaseUrl, PORT: String(port), TRUST_PROXY: '', GEMINI_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'] });
  app.stdout.on('data', data => { logs += data; });
  app.stderr.on('data', data => { logs += data; });
  async function request(method, endpoint, data, token, extra = {}) {
    if (endpoint === '/__fixture/create-account') {
      if (!adminToken) adminToken = (await request('POST', '/api/auth/login', { email: adminEmail, password: adminPassword })).body.token;
      const created = await request('POST', '/api/admin/users', { ...data, role: 'user' }, adminToken);
      if (created.status !== 201) return created;
      return { ...(await request('POST', '/api/auth/login', data)), status: 201 };
    }
    const response = await fetch(base + endpoint, { method, signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', 'X-Auth-Mode': 'bearer', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra },
      body: data === undefined ? undefined : JSON.stringify(data) });
    const text = await response.text();
    let body; try { body = JSON.parse(text); } catch { body = text; }
    return { status: response.status, headers: response.headers, body };
  }
  await waitFor(async () => app.exitCode === null && (await request('GET', '/api/health')).status === 200);
  const password = 'Disposable-security-password-2026';
  const a = await request('POST', '/__fixture/create-account', { email: 'a@example.test', password, role: 'admin' });
  const b = await request('POST', '/__fixture/create-account', { email: 'b@example.test', password });
  assert.equal(a.status, 201); assert.equal(b.status, 201);
  const token = a.body.token, otherToken = b.body.token;
  const user = (await pool.query('SELECT * FROM users WHERE email=$1', ['a@example.test'])).rows[0];
  const other = (await pool.query('SELECT * FROM users WHERE email=$1', ['b@example.test'])).rows[0];
  const payload = '<img src=x onerror="window.__securityXss=1">';
  const records = {
    income: { startDate: '2026-10-16', endDate: '2026-10-16', trips: 1, onlineMinutes: 60, activeMinutes: 30, netFare: 10, tips: 0, taxes: 0, notes: payload },
    mileage: { date: '2026-10-16', purpose: "' OR 1=1; --", startOdometer: 1, endOdometer: 2, tripType: 'Delivery' },
    expenses: { date: '2026-10-16', category: '=1+1', amount: 2, description: payload, gstHstEligible: false },
  };
  for (const [resource, data] of Object.entries(records)) {
    await check(`access-${resource}`, async () => {
      assert.equal((await request('GET', `/api/${resource}`)).status, 401);
      const saved = await request('POST', `/api/${resource}`, { ...data, user_id: other.id }, token);
      assert.equal(saved.status, 201); assert.equal(saved.body.user_id, user.id);
      assert.deepEqual((await request('GET', `/api/${resource}`, undefined, otherToken)).body, []);
      for (const method of ['PUT', 'DELETE']) assert.equal((await request(method, `/api/${resource}/${saved.body.id}`, method === 'PUT' ? data : undefined, otherToken)).status, 404);
      assert.equal((await request('DELETE', `/api/${resource}/${encodeURIComponent("' OR 1=1 --")}`, undefined, token)).status, 404);
      assert.equal((await request('GET', `/api/${resource}`, undefined, token)).body.length, 1);
    });
  }
  await check('admin-authorization-and-role-mass-assignment', async () => {
    assert.equal((await request('GET', '/api/auth/me', undefined, token)).body.role, 'user');
    for (const endpoint of ['/api/admin/users', '/api/admin/stats', '/api/admin/data/income', '/api/admin/data/mileage', '/api/admin/data/expenses']) {
      assert.equal((await request('GET', endpoint, undefined, token)).status, 403);
    }
    for (const [method, endpoint, data] of [['POST', '/api/admin/users', { email: 'evil@example.test', password, role: 'admin' }],
      ['PUT', `/api/admin/users/${user.id}`, { email: user.email, role: 'admin' }], ['DELETE', `/api/admin/users/${other.id}`],
      ...['income', 'mileage', 'expenses'].map(r => ['DELETE', `/api/admin/data/${r}/anything`])]) {
      assert.equal((await request(method, endpoint, data, token)).status, 403);
    }
  });
  await check('backup-and-rate-isolation', async () => {
    assert.equal((await request('GET', '/api/backup')).status, 401);
    assert.equal((await request('POST', '/api/restore', {})).status, 401);
    await request('POST', '/api/settings/cra-rates', { year: '2026', tier1_threshold: 5000, tier1_rate: .7, tier2_rate: .6, user_id: other.id }, token);
    assert.deepEqual((await request('GET', '/api/settings/cra-rates', undefined, otherToken)).body, []);
    const backup = (await request('GET', '/api/backup', undefined, otherToken)).body;
    assert.equal(backup.income.length + backup.mileage.length + backup.expenses.length, 0);
  });
  await check('sql-injection-login-and-stored-text', async () => {
    assert.equal((await request('POST', '/api/auth/login', { email: "'or'1'='1@example.test", password })).status, 400);
    assert.equal((await request('GET', '/api/mileage', undefined, token)).body[0].purpose, records.mileage.purpose);
  });
  await check('malformed-json-and-request-size', async () => {
    for (const [body, expected] of [['{broken', 400], ['[]', 400], ['null', 400], [JSON.stringify({ x: 'x'.repeat(2 * 1024 * 1024) }), 413]]) {
      const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      assert.equal(r.status, expected); assert.deepEqual(Object.keys(await r.json()), ['error']);
    }
    assert.equal((await request('GET', '/api/live')).status, 200);
  });
  await check('restore-validation-is-atomic', async () => {
    const before = (await request('GET', '/api/backup', undefined, token)).body;
    const invalid = { ...before, income: [{ ...records.income, netFare: null }] };
    assert.equal((await request('POST', '/api/restore', invalid, token)).status, 400);
    assert.deepEqual((await request('GET', '/api/backup', undefined, token)).body, before);
  });
  await check('cross-origin-policy-and-form-csrf', async () => {
    const r = await request('OPTIONS', '/api/restore', undefined, undefined, { Origin: 'https://attacker.example', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' });
    assert.equal(r.headers.get('access-control-allow-origin'), null);
    const form = await fetch(base + '/api/restore', { method: 'POST', headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'income=[]&mileage=[]&expenses=[]' });
    assert.equal(form.status, 403);
  });
  await check('password-storage-and-token-entropy', async () => {
    assert.match(user.password_hash, /^scrypt\$[a-f0-9]{128}$/); assert.match(user.salt, /^[a-f0-9]{32}$/);
    assert.notEqual(user.salt, other.salt); assert.notEqual(user.password_hash, other.password_hash);
    assert.match(token, /^[a-f0-9]{64}$/); assert.notEqual(token, otherToken);
  });
  await check('raw-bearer-token-in-database', async () => {
    const r = await pool.query('SELECT id FROM sessions WHERE user_id=$1', [user.id]);
    assert.equal((await request('GET', '/api/auth/me', undefined, r.rows[0].id)).status, 401);
    assert.ok(r.rows.every(row => row.id.startsWith('sha256$') && row.id !== token));
    return { detail: 'Only SHA-256 session digests persisted; replaying a database value is rejected' };
  });
  await check('security-headers-and-private-response-cache', async () => {
    const r = await request('GET', '/api/backup', undefined, token);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff'); assert.equal(r.headers.get('x-frame-options'), 'DENY');
    const html = await request('GET', '/');
    const missing = ['content-security-policy'].filter(h => !html.headers.get(h));
    return { gap: missing.length > 0 || !r.headers.get('cache-control')?.includes('no-store'), detail: `CSP present: ${!missing.length}; authenticated backup Cache-Control: ${r.headers.get('cache-control')}; HSTS requires HTTPS and is checked with trusted-proxy fixtures` };
  });
  await check('public-backend-bundle-and-source-map', async () => {
    const js = await request('GET', '/server.cjs'); const map = await request('GET', '/server.cjs.map');
    const exposed = js.status === 200 && typeof js.body === 'string' && js.body.includes('password_hash') && map.status === 200 && map.body.sourcesContent?.some(s => s.includes('startServer'));
    assert.equal(exposed, false);
    return { gap: exposed, detail: `Unauthenticated backend bundle ${js.status}; source map ${map.status}; embedded backend source exposed: ${Boolean(exposed)}` };
  });
  await check('sensitive-project-files-not-served', async () => {
    for (const endpoint of ['/.env', '/.git/config', '/package.json', '/src/db.ts', '/%2e%2e/package.json']) {
      const r = await request('GET', endpoint);
      assert.ok(r.status === 404 || (typeof r.body === 'string' && r.body.includes('<!doctype html>')),
        `Unexpected project-file response at ${endpoint}`);
    }
  });
  await check('expired-and-revoked-sessions', async () => {
    const expired = crypto.randomBytes(32).toString('hex');
    await pool.query('INSERT INTO sessions(id,user_id,expires_at) VALUES($1,$2,$3)', ['sha256$' + crypto.createHash('sha256').update(expired).digest('hex'), user.id, '2000-01-01T00:00:00.000Z']);
    assert.equal((await request('GET', '/api/auth/me', undefined, expired)).status, 401);
    assert.equal((await request('POST', '/api/auth/logout', {}, otherToken)).status, 200);
    assert.equal((await request('GET', '/api/auth/me', undefined, otherToken)).status, 401);
  });
  await check('cookie-login-and-csrf', async () => {
    const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base },
      body: JSON.stringify({ email: user.email, password }) });
    assert.equal(login.status, 200); assert.equal((await login.json()).token, undefined);
    const setCookie = login.headers.get('set-cookie');
    assert.ok(setCookie.includes('HttpOnly') && setCookie.includes('Secure') && setCookie.includes('SameSite=Strict'));
    const cookie = setCookie.split(';')[0];
    for (const origin of [null, 'https://attacker.example', base]) {
      const response = await fetch(base + '/api/settings/cra-rates', { method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
        body: JSON.stringify({ year: '2026', tier1_threshold: 5000, tier1_rate: .7, tier2_rate: .6 }) });
      assert.equal(response.status, origin === base ? 200 : 403);
    }
  });
  await check('password-change-guessing-limit', async () => {
    const statuses = [];
    for (let i = 0; i < 22; i++) statuses.push((await request('POST', '/api/auth/change-password', { oldPassword: 'wrong-old-password', newPassword: password }, token)).status);
    assert.ok(statuses.every(s => s === 400 || s === 429));
    assert.ok(statuses.includes(429));
    return { gap: !statuses.includes(429), detail: `${statuses.filter(s => s === 400).length}/22 wrong-current-password requests accepted for verification; ${statuses.filter(s => s === 429).length} rate limited` };
  });
  await check('account-enumeration', async () => {
    const a = await request('POST', '/api/auth/signup', { email: user.email, password });
    const b = await request('POST', '/api/auth/signup', { email: 'unknown@example.test', password });
    assert.equal(a.status, 403); assert.equal(b.status, 403); assert.deepEqual(a.body, b.body);
    return { detail: 'Public signup is disabled with the same response for existing and unknown addresses' };
  });
  await check('stored-xss-csv-and-browser-token-storage', async () => {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ acceptDownloads: true });

    const page = await context.newPage();
    await page.goto(base);
    await page.locator('#email').fill(user.email);
    await page.locator('#password').fill(password);
    await page.locator('#auth-submit-btn').click();
    await page.getByText(`"${payload}"`, { exact: true }).first().waitFor({ state: 'visible', timeout: 45000 });
    assert.equal(await page.evaluate(() => window.__securityXss), undefined);
    assert.equal(await page.locator('img[onerror]').count(), 0);
    await page.locator('#tab-tax-trigger').click();
    await page.locator('#tax-tab-view select').first().selectOption('2026');
    const downloading = page.waitForEvent('download'); await page.locator('#export-csv-btn').click();
    const csv = await readFile(await (await downloading).path(), 'utf8');
    assert.ok(csv.includes('  - =1+1')); assert.ok(!csv.split('\r\n').some(line => line.startsWith('"=1+1')));
    assert.equal(await page.evaluate(() => localStorage.getItem('gig_auth_token')), null);
    assert.ok(!(await page.evaluate(() => document.cookie)).includes('gig_session'));
    const cookie = (await context.cookies()).find(c => c.name === 'gig_session');
    assert.ok(cookie?.httpOnly && cookie.secure && cookie.sameSite === 'Strict');
    await context.close();
    return { detail: 'Stored HTML remained text; tested category CSV prefixed; browser session cookie is HttpOnly and no token is in localStorage' };
  });
  await check('authentication-rate-limit-and-forwarding-spoof', async () => {
    let last;
    for (let i = 0; i < 23; i++) last = await request('POST', '/api/auth/login', { email: 'missing@example.test', password }, undefined, { 'X-Forwarded-For': `192.0.2.${i + 1}` });
    assert.equal(last.status, 429); assert.ok(Number(last.headers.get('retry-after')) > 0);
    assert.equal((await request('GET', '/api/live')).status, 200);
  });
  await check('database-failure-is-generic-and-recovers', async () => {
    await pool.query('ALTER TABLE income_entries RENAME TO security_failure_fixture');
    try {
      const r = await request('GET', '/api/income', undefined, token);
      assert.equal(r.status, 500);
      assert.deepEqual(r.body, { error: 'An unexpected server error occurred.' });
      assert.equal((await request('GET', '/api/live')).status, 200);
    } finally {
      await pool.query('ALTER TABLE security_failure_fixture RENAME TO income_entries');
    }
    assert.equal((await request('GET', '/api/income', undefined, token)).status, 200);
  });
  await check('security-audit-trail', async () => {
    await pool.query('UPDATE users SET role=$1 WHERE id=$2', ['admin', user.id]);
    const offset = logs.length;
    const r = await request('PUT', `/api/admin/users/${other.id}`, { email: other.email, role: 'user', password: 'Reset-security-password-2026' }, token);
    assert.equal(r.status, 200);
    await delay(100);
    const eventOutput = logs.slice(offset);
    assert.ok(eventOutput.includes('admin_user_put'));
    assert.ok(!eventOutput.includes('Reset-security-password-2026'));
    assert.ok(!eventOutput.includes(token));
    return { gap: eventOutput.trim().length === 0, detail: `Successful admin password reset emitted ${eventOutput.length} log characters; structured event excludes the supplied password` };
  });
  await check('private-compose-and-required-credentials', async () => {
    const env = { ...process.env, POSTGRES_PASSWORD: 'disposable-admin-check', APP_DATABASE_PASSWORD: 'disposable-app-check' };
    const config = JSON.parse(execFileSync('docker', ['compose', 'config', '--format', 'json'], { cwd: root, env, encoding: 'utf8' }));
    assert.equal((config.services.postgres.ports || []).length, 0);
    assert.ok(config.services['tax-mileage-app'].ports.every(p => p.host_ip === '127.0.0.1'));
    const appEnv = config.services['tax-mileage-app'].environment;
    assert.equal(new URL(appEnv.DATABASE_URL).username, 'gig_app');
    assert.notEqual(appEnv.POSTGRES_PASSWORD, env.POSTGRES_PASSWORD);
    delete env.POSTGRES_PASSWORD; delete env.APP_DATABASE_PASSWORD;
    assert.throws(() => execFileSync('docker', ['compose', 'config', '--quiet'], { cwd: root, env, stdio: 'ignore' }));
  });
  await check('hsts-behind-explicit-trusted-proxy', async () => {
    const stopped = once(app, 'exit'); app.kill('SIGTERM'); await stopped;
    app = spawn(process.execPath, ['dist/server.cjs'], { cwd: root,
      env: { ...process.env, NODE_ENV: 'production', DATABASE_URL: databaseUrl, PORT: String(port), TRUST_PROXY: '127.0.0.1/32', GEMINI_API_KEY: '' },
      stdio: ['ignore', 'pipe', 'pipe'] });
    app.stdout.on('data', data => { logs += data; }); app.stderr.on('data', data => { logs += data; });
    await waitFor(async () => (await request('GET', '/api/live')).status === 200);
    const r = await request('GET', '/api/live', undefined, undefined, { 'X-Forwarded-Proto': 'https' });
    assert.equal(r.headers.get('strict-transport-security'), 'max-age=31536000');
    assert.equal((await request('GET', '/api/auth/me', undefined, token)).status, 200);
  });
} catch (error) {
  results.push({ id: 'assessment-runner', status: 'ERROR', detail: error.message });
} finally {
  await browser?.close();
  if (app && app.exitCode === null) {
    const stopped = once(app, 'exit'); app.kill('SIGTERM');
    const timer = setTimeout(() => app.kill('SIGKILL'), 5000);
    await stopped; clearTimeout(timer);
  }
  await pool?.end();
  try { docker(['rm', '-f', '-v', container]); } catch { /* Container may not have started. */ }
  await rm(tmp, { recursive: true, force: true });
}
const output = { testedAt: new Date().toISOString(), sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  environment: { node: process.version, mode: 'production', database: 'disposable PostgreSQL 16', externalAI: 'disabled' },
  interpretation: 'Diagnostic only: GAP means a weakness was observed; exit 0 is not a security clearance.', results };
const destination = process.env.SECURITY_AUDIT_OUTPUT || path.join(tmpdir(), 'gig-security-results.json');
await writeFile(destination, JSON.stringify(output, null, 2) + '\n');
console.log(`Results: ${destination}`);
console.log(JSON.stringify(results.reduce((counts, r) => ({ ...counts, [r.status]: (counts[r.status] || 0) + 1 }), {})));
if (results.some(r => r.status === 'ERROR' || r.status === 'GAP')) process.exitCode = 1;
