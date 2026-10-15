// Builds and exercises an isolated Compose project. Never uses the operator's volume.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(path.join(tmpdir(), 'gig-deployment-'));
const project = `gig-verify-${Date.now()}`;
const override = path.join(tmp, 'compose.verify.yml');
const envfile = path.join(tmp, 'verify.env');
const env = { ...process.env, TRUST_PROXY: '' };
const recoveryContainer = `${project}-recovery`;
let browser;
function docker(args, options = {}) { return execFileSync('docker', args, { cwd: root, env, maxBuffer: 30 * 1024 * 1024, ...options }); }
const compose = ['compose', '--project-name', project, '--env-file', envfile, '-f', path.join(root, 'docker-compose.yml'), '-f', override];
function dc(args, options) { return docker([...compose, ...args], options); }
function id(service) { return dc(['ps', '-q', service]).toString().trim(); }
function inspect(container) { return JSON.parse(docker(['inspect', container]).toString())[0]; }
async function freePort() {
  const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port;
}
async function waitFor(check, label, timeout = 90_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { try { if (await check()) return; } catch {} await new Promise(resolve => setTimeout(resolve, 500)); }
  throw new Error(`Timed out: ${label}`);
}
async function health(base, endpoint = '/api/health') {
  return fetch(base + endpoint, { signal: AbortSignal.timeout(12_000) });
}
async function api(base, method, endpoint, token, data) {
  const response = await fetch(base + endpoint, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(15_000) });
  const body = await response.json(); assert.ok(response.ok, `${method} ${endpoint}: ${response.status} ${JSON.stringify(body)}`); return body;
}
async function report(base, token) {
  const context = await browser.newContext({ acceptDownloads: true, timezoneId: 'America/Toronto' });
  try {
    await context.addInitScript(value => localStorage.setItem('gig_auth_token', value), token);
    const page = await context.newPage(); await page.goto(base);
    await page.locator('#tab-tax-trigger').click();
    await page.locator('#tax-tab-view select').first().selectOption('2026');
    const pending = page.waitForEvent('download'); await page.locator('#export-csv-btn').click();
    return readFileSync(await (await pending).path(), 'utf8');
  } finally { await context.close(); }
}

try {
  const port = await freePort(); const recoveryPort = await freePort(); const base = `http://127.0.0.1:${port}`;
  writeFileSync(envfile, 'POSTGRES_USER=gig_verify\nPOSTGRES_PASSWORD=isolated-deployment-test-only\nPOSTGRES_DB=gig_verify\nGEMINI_API_KEY=\n', { mode: 0o600 });
  writeFileSync(override, `services:
  postgres:
    container_name: !reset null
    ports: !reset []
  tax-mileage-app:
    container_name: !reset null
    ports: !override
      - "127.0.0.1:${port}:3000"
`, { mode: 0o600 });
  dc(['config', '--quiet']);
  dc(['build', 'tax-mileage-app'], { stdio: 'inherit' });
  dc(['up', '-d', '--wait', 'postgres'], { stdio: 'inherit' });
  const network = Object.entries(inspect(id('postgres')).NetworkSettings.Networks)[0];
  env.TRUST_PROXY = `${network[1].Gateway}/32`;
  dc(['up', '-d', '--wait'], { stdio: 'inherit' });
  await waitFor(async () => (await health(base)).status === 200, 'initial readiness');
  const dbInspect = inspect(id('postgres')); const appInspect = inspect(id('tax-mileage-app'));
  assert.deepEqual(dbInspect.HostConfig.PortBindings || {}, {});
  assert.equal(appInspect.HostConfig.PortBindings['3000/tcp'][0].HostIp, '127.0.0.1');
  assert.equal(appInspect.Config.User, 'node');
  assert.equal(appInspect.State.Health.Status, 'healthy');
  assert.equal((await health(base, '/')).status, 200);
  console.log('PASS: image, private ports, non-root runtime and readiness');

  const password = 'Deployment-check-password-2026'; const email = 'deployment@example.test';
  const { token } = await api(base, 'POST', '/api/auth/signup', null, { email, password });
  await api(base, 'POST', '/api/auth/signup', null, { email: 'second@example.test', password });
  const records = {
    income: { startDate: '2026-01-01', endDate: '2026-01-01', trips: 1, onlineMinutes: 60, activeMinutes: 30, netFare: 100.10, tips: .20, taxes: .10 },
    mileage: { date: '2026-01-01', purpose: 'Deployment test', startOdometer: 100, endOdometer: 125, tripType: 'Delivery' },
    expenses: { date: '2026-01-01', category: 'Fuel', amount: 25, gstHstAmount: 2.5, gstHstEligible: true, description: 'Deployment receipt' },
  };
  for (const [resource, data] of Object.entries(records)) {
    const entry = await api(base, 'POST', `/api/${resource}`, token, data);
    await api(base, 'PUT', `/api/${resource}/${entry.id}`, token, { ...data, ...(resource === 'income' ? { netFare: 110.10 } : {}) });
    const scratch = await api(base, 'POST', `/api/${resource}`, token, data);
    await api(base, 'DELETE', `/api/${resource}/${scratch.id}`, token);
    assert.equal((await api(base, 'GET', `/api/${resource}`, token)).length, 1);
  }
  await api(base, 'POST', '/api/settings/cra-rates', token, { year: '2026', tier1_threshold: 5000, tier1_rate: .81, tier2_rate: .71 });
  const before = await api(base, 'GET', '/api/backup', token);
  browser = await chromium.launch({ headless: true });
  const csvBefore = await report(base, token);
  assert.ok(csvBefore.includes('"Gross Income (Net Fare + Tips)","110.30"'));
  console.log('PASS: signup, CRUD, custom rates and browser CSV export from the image');
  const loginAttempt = forwarded => fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': forwarded }, body: JSON.stringify({ email: 'missing@example.test', password }) });
  for (let i = 0; i < 20; i++) assert.equal((await loginAttempt('198.51.100.1')).status, 400);
  assert.equal((await loginAttempt('198.51.100.1')).status, 429);
  assert.equal((await loginAttempt('198.51.100.2')).status, 400);
  assert.equal((await loginAttempt('203.0.113.1, 198.51.100.1')).status, 429);
  console.log('PASS: host-proxy bridge trust isolates client limits and rejects a spoofed forwarding chain');

  dc(['restart', 'tax-mileage-app'], { stdio: 'inherit' });
  await waitFor(async () => (await health(base)).status === 200, 'app restart');
  assert.deepEqual(await api(base, 'GET', '/api/backup', token), before);
  const appId = id('tax-mileage-app');
  await waitFor(() => inspect(appId).State.Health.Status === 'healthy', 'healthy app after restart');
  dc(['stop', 'postgres'], { stdio: 'inherit' });
  assert.equal((await health(base, '/api/live')).status, 200);
  await waitFor(async () => (await health(base)).status === 503, 'readiness during database outage');
  await waitFor(() => inspect(appId).State.Health.Status === 'unhealthy', 'container marks database outage unhealthy', 60_000);
  assert.equal(inspect(appId).State.Running, true);
  dc(['start', 'postgres'], { stdio: 'inherit' });
  await waitFor(async () => (await health(base)).status === 200, 'database reconnection');
  assert.equal(id('tax-mileage-app'), appId);
  await waitFor(() => inspect(appId).State.Health.Status === 'healthy', 'healthy container after database recovery');
  assert.deepEqual(await api(base, 'GET', '/api/backup', token), before);
  dc(['down'], { stdio: 'inherit' }); // Preserve this test project's fresh volume.
  dc(['up', '-d', '--wait', 'postgres'], { stdio: 'inherit' });
  env.TRUST_PROXY = `${Object.values(inspect(id('postgres')).NetworkSettings.Networks)[0].Gateway}/32`;
  dc(['up', '-d', '--wait'], { stdio: 'inherit' });
  assert.deepEqual(await api(base, 'GET', '/api/backup', token), before);
  console.log('PASS: app restart, database outage/recovery and Compose recreation preserve data');

  const dump = dc(['exec', '-T', 'postgres', 'pg_dump', '-U', 'gig_verify', '-d', 'gig_verify', '-Fc']);
  const dumpFile = path.join(tmp, 'database.dump'); writeFileSync(dumpFile, dump, { mode: 0o600 });
  assert.ok(dump.length > 0);
  dc(['exec', '-T', 'postgres', 'createdb', '-U', 'gig_verify', 'gig_recovery']);
  dc(['exec', '-T', 'postgres', 'pg_restore', '-U', 'gig_verify', '-d', 'gig_recovery', '--no-owner', '--no-privileges', '--single-transaction', '--exit-on-error'], { input: readFileSync(dumpFile) });
  for (const db of ['gig_verify', 'gig_recovery']) {
    const count = dc(['exec', '-T', 'postgres', 'psql', '-U', 'gig_verify', '-d', db, '-Atc', 'SELECT count(*) FROM users']).toString().trim();
    assert.equal(count, '2');
  }
  const currentNetwork = Object.keys(inspect(id('postgres')).NetworkSettings.Networks)[0];
  docker(['run', '-d', '--name', recoveryContainer, '--network', currentNetwork, '-p', `127.0.0.1:${recoveryPort}:3000`,
    '-e', 'DATABASE_URL=postgresql://gig_verify:isolated-deployment-test-only@postgres:5432/gig_recovery',
    dc(['images', '-q', 'tax-mileage-app']).toString().trim()]);
  const recovered = `http://127.0.0.1:${recoveryPort}`;
  await waitFor(async () => (await health(recovered)).status === 200, 'restored database app');
  const login = await api(recovered, 'POST', '/api/auth/login', null, { email, password });
  assert.deepEqual(await api(recovered, 'GET', '/api/backup', login.token), before);
  assert.equal(await report(recovered, login.token), csvBefore);
  await api(recovered, 'POST', '/api/auth/login', null, { email: 'second@example.test', password });
  console.log('PASS: pg_dump/pg_restore into a separate database preserves accounts, records, rates and CSV reports');
  console.log(`Deployment verification passed for isolated project ${project}.`);
} catch (error) {
  try { dc(['logs', '--no-color', '--tail=80'], { stdio: 'inherit' }); } catch {}
  throw error;
} finally {
  await browser?.close();
  try { docker(['rm', '-f', recoveryContainer], { stdio: 'ignore' }); } catch {}
  try { dc(['down', '-v', '--remove-orphans'], { stdio: 'inherit' }); } finally { rmSync(tmp, { recursive: true, force: true }); }
}
