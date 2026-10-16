import { execFileSync } from 'node:child_process';

export const adminEmail = 'test-admin@example.test';
export const adminPassword = 'Disposable-admin-password-2026';
export function provisionAdmin(env, built = true, email = adminEmail) {
  execFileSync(process.execPath, built ? ['dist/create-admin.cjs'] : ['--import', 'tsx', 'scripts/create-admin.ts'],
    { env, input: JSON.stringify({ email, password: adminPassword }), stdio: ['pipe', 'pipe', 'pipe'] });
}
