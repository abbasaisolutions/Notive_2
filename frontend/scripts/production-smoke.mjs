import assert from 'node:assert/strict';

const FRONTEND_URL = (process.env.SMOKE_FRONTEND_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const API_URL = (process.env.SMOKE_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1').replace(/\/$/, '');
const BACKEND_BASE_URL = API_URL.replace(/\/api\/v1$/, '');
const SMOKE_EMAIL = (process.env.SMOKE_EMAIL || '').trim();
const SMOKE_PASSWORD = process.env.SMOKE_PASSWORD || '';
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || '15000', 10);

const PUBLIC_PAGES = [
    { path: '/', marker: 'Notive.' },
    { path: '/login', marker: 'Sign in' },
    { path: '/register', marker: 'Create your account' },
    { path: '/privacy', marker: 'Privacy' },
    { path: '/terms', marker: 'Terms' },
];

const escapeForRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const fetchWithTimeout = async (url, options = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                Accept: 'application/json, text/html;q=0.9',
                ...(options.headers || {}),
            },
        });
    } finally {
        clearTimeout(timeout);
    }
};

const expectOk = async (url, options = {}) => {
    const response = await fetchWithTimeout(url, options);
    const body = await response.text();
    assert.equal(response.ok, true, `Expected ${url} to succeed, received ${response.status}.\n${body}`);
    return body;
};

const runCheck = async (label, task) => {
    process.stdout.write(`- ${label}... `);
    await task();
    process.stdout.write('ok\n');
};

const run = async () => {
    console.log('Running Notive production smoke checks');

    await runCheck('public app routes', async () => {
        for (const page of PUBLIC_PAGES) {
            const html = await expectOk(`${FRONTEND_URL}${page.path}`);
            assert.match(
                html.toLowerCase(),
                new RegExp(escapeForRegex(page.marker.toLowerCase())),
                `Expected ${page.path} to include "${page.marker}"`,
            );
        }
    });

    await runCheck('backend root', async () => {
        const body = await expectOk(`${BACKEND_BASE_URL}/`);
        assert.match(body.toLowerCase(), /notive api is running/);
    });

    if (!(SMOKE_EMAIL && SMOKE_PASSWORD)) {
        console.log('- authenticated API checks... skipped (set SMOKE_EMAIL and SMOKE_PASSWORD to enable)');
        return;
    }

    await runCheck('authenticated API checks', async () => {
        const loginResponse = await fetchWithTimeout(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: SMOKE_EMAIL,
                password: SMOKE_PASSWORD,
            }),
        });

        const loginPayload = await loginResponse.json().catch(() => null);
        assert.equal(
            loginResponse.ok,
            true,
            `Expected authenticated smoke login to succeed, received ${loginResponse.status}: ${JSON.stringify(loginPayload)}`,
        );
        assert.equal(typeof loginPayload?.accessToken, 'string', 'Expected accessToken from smoke login');

        const authHeaders = {
            Authorization: `Bearer ${loginPayload.accessToken}`,
        };

        const meResponse = await fetchWithTimeout(`${API_URL}/auth/me`, { headers: authHeaders });
        const mePayload = await meResponse.json().catch(() => null);
        assert.equal(meResponse.ok, true, `Expected /auth/me to succeed, received ${meResponse.status}`);
        assert.equal(typeof mePayload?.user?.id, 'string', 'Expected /auth/me user payload');

        const entriesResponse = await fetchWithTimeout(`${API_URL}/entries?limit=1`, { headers: authHeaders });
        const entriesPayload = await entriesResponse.json().catch(() => null);
        assert.equal(entriesResponse.ok, true, `Expected /entries to succeed, received ${entriesResponse.status}`);
        assert.equal(Array.isArray(entriesPayload?.entries), true, 'Expected entries payload array');

        const aiStatusResponse = await fetchWithTimeout(`${API_URL}/ai/status`, { headers: authHeaders });
        const aiStatusPayload = await aiStatusResponse.json().catch(() => null);
        assert.equal(aiStatusResponse.ok, true, `Expected /ai/status to succeed, received ${aiStatusResponse.status}`);
        assert.equal(typeof aiStatusPayload?.provider, 'string', 'Expected AI status provider');

        const profileResponse = await fetchWithTimeout(`${API_URL}/user/profile`, { headers: authHeaders });
        const profilePayload = await profileResponse.json().catch(() => null);
        assert.equal(profileResponse.ok, true, `Expected /user/profile to succeed, received ${profileResponse.status}`);
        assert.equal(typeof profilePayload?.user?.email, 'string', 'Expected profile payload');
    });
};

run().catch((error) => {
    console.error('\nProduction smoke failed');
    console.error(error instanceof Error ? error.stack || error.message : error);
    process.exitCode = 1;
});
