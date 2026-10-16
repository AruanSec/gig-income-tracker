import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { provisionAdmin } from './provision.mjs';

const tmp = mkdtempSync(path.join(tmpdir(), 'gig-browser-'));
const env = { ...process.env, DB_PATH: path.join(tmp, 'browser.sqlite') };
provisionAdmin(env, false);
const app = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], { env, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => app.kill(signal));
app.on('exit', code => { rmSync(tmp, { recursive: true, force: true }); process.exit(code || 0); });
