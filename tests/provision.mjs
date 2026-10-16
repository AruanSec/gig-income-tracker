import { execFileSync } from 'node:child_process';

export const adminEmail = 'test-admin@example.test';
export const adminPassword = 'Disposable-admin-password-2026';
export function provisionAdmin(env, built = true) {
  execFileSync(process.execPath, built ? ['dist/create-admin.cjs'] : ['--import', 'tsx', 'scripts/create-admin.ts'],
    { env, input: JSON.stringify({ email: adminEmail, password: adminPassword }), stdio: ['pipe', 'pipe', 'pipe'] });
}
