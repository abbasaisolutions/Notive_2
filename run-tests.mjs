#!/usr/bin/env node

/**
 * Unified test runner for Notive.
 *
 * Usage:
 *   node run-tests.mjs              # Run all offline checks
 *   node run-tests.mjs --online     # Also run the production smoke that hits live URLs
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const online = process.argv.includes('--online');

const run = (label, cwd, command, options = {}) => {
    console.log(`\n══════════ ${label} ══════════`);
    try {
        execSync(command, {
            cwd: path.resolve(__dirname, cwd),
            stdio: 'inherit',
            env: {
                ...process.env,
                ...(options.env || {}),
            },
        });
        console.log(`✔ ${label} passed`);
        return true;
    } catch {
        console.error(`✘ ${label} FAILED`);
        return false;
    }
};

let ok = true;

ok = run('Frontend typecheck', 'frontend', 'npm run typecheck') && ok;
ok = run('Frontend unit tests', 'frontend', 'npm test') && ok;
ok = run('Frontend API path audit', 'frontend', 'npm run api:audit') && ok;
ok = run('Frontend UI audit', 'frontend', 'node scripts/ui-audit.js', { env: { CI_UI_STRICT: '1' } }) && ok;
ok = run('Frontend link audit', 'frontend', 'npm run link:audit') && ok;
ok = run('Backend typecheck', 'backend', 'npm run typecheck') && ok;
ok = run('Backend lint', 'backend', 'npm run lint') && ok;
ok = run('Backend unit + integration tests', 'backend', 'npm test') && ok;
ok = run('Android readiness audit', 'frontend', 'node scripts/android-readiness.mjs --launch') && ok;

if (online) {
    ok = run('Production smoke tests', 'frontend', 'node scripts/production-smoke.mjs') && ok;
} else {
    console.log('\n── Skipping online production smoke tests (pass --online to include) ──');
}

console.log(ok ? '\n✔ All tests passed' : '\n✘ Some tests failed');
process.exitCode = ok ? 0 : 1;
