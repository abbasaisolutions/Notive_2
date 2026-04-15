import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';

// ── Mock heavy dependencies before any app import ─────────────────
vi.mock('../config/prisma', () => {
    const noop = () => Promise.resolve(null);
    const handler: ProxyHandler<object> = {
        get: (_target, prop) => {
            if (prop === 'then') return undefined; // prevent Promise-like behavior
            if (prop === '$connect' || prop === '$disconnect' || prop === '$transaction') return noop;
            // Return a proxy for any model (user, entry, etc.) with CRUD stubs
            return new Proxy({}, {
                get: () => noop,
            });
        },
    };
    return { default: new Proxy({}, handler) };
});

vi.mock('../config/redis', () => {
    const store = new Map<string, { value: string; expiresAt: number }>();
    const client = {
        isOpen: true,
        get: async (key: string) => store.get(key)?.value ?? null,
        set: async (key: string, value: string, opts?: { EX?: number }) => {
            store.set(key, {
                value,
                expiresAt: opts?.EX ? Date.now() + opts.EX * 1000 : Date.now() + 86_400_000,
            });
        },
        del: async () => 0,
        incr: async () => 1,
        expire: async () => 1,
    };
    return {
        initRedis: async () => client,
        getRedisClient: () => client,
        closeRedis: async () => {},
    };
});

vi.mock('firebase-admin', () => ({
    default: {
        initializeApp: vi.fn(),
        credential: { cert: vi.fn(() => ({})) },
        messaging: vi.fn(() => ({ send: vi.fn(), sendEachForMulticast: vi.fn() })),
    },
    initializeApp: vi.fn(),
    credential: { cert: vi.fn(() => ({})) },
}));

import app from '../app';

describe('backend smoke tests', () => {

    // ─── Health / root ──────────────────────────────────────────────

    describe('GET /', () => {
        it('returns API running message', async () => {
            const res = await request(app).get('/');
            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/notive api is running/i);
        });
    });

    // ─── Auth input validation ──────────────────────────────────────

    describe('POST /api/v1/auth/register', () => {
        it('rejects empty body with 400 or 422', async () => {
            const res = await request(app).post('/api/v1/auth/register').send({});
            expect([400, 422]).toContain(res.status);
        });

        it('rejects weak password', async () => {
            const res = await request(app)
                .post('/api/v1/auth/register')
                .send({ email: 'test@example.com', password: '123', name: 'Test' });
            expect([400, 422]).toContain(res.status);
        });
    });

    describe('POST /api/v1/auth/login', () => {
        it('rejects empty body', async () => {
            const res = await request(app).post('/api/v1/auth/login').send({});
            expect([400, 422]).toContain(res.status);
        });

        it('rejects missing password', async () => {
            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({ email: 'test@example.com' });
            expect([400, 422]).toContain(res.status);
        });
    });

    // ─── Protected routes return 401 ────────────────────────────────

    describe('unauthenticated access', () => {
        const protectedRoutes = [
            ['GET', '/api/v1/auth/me'],
            ['GET', '/api/v1/entries'],
            ['GET', '/api/v1/entries/search?q=test'],
            ['POST', '/api/v1/ai/chat'],
            ['POST', '/api/v1/voice/transcribe'],
            ['POST', '/api/v1/device/tokens'],
            ['GET', '/api/v1/user'],
            ['GET', '/api/v1/user/profile'],
            ['GET', '/api/v1/notifications'],
        ];

        for (const [method, path] of protectedRoutes) {
            it(`${method} ${path} → 401`, async () => {
                const res = method === 'GET'
                    ? await request(app).get(path)
                    : await request(app).post(path).send({});
                expect(res.status).toBe(401);
            });
        }
    });

    // ─── Rate-limit headers present ─────────────────────────────────

    describe('rate-limit headers on auth endpoints', () => {
        it('POST /api/v1/auth/login includes X-RateLimit-* headers', async () => {
            const res = await request(app)
                .post('/api/v1/auth/login')
                .send({ email: 'test@example.com', password: 'SomePass1' });
            expect(res.headers['x-ratelimit-limit']).toBeDefined();
            expect(res.headers['x-ratelimit-remaining']).toBeDefined();
            expect(res.headers['x-ratelimit-reset']).toBeDefined();
        });
    });

    // ─── Device token registration validation ───────────────────────

    describe('POST /api/v1/device/tokens', () => {
        it('requires authentication', async () => {
            const res = await request(app)
                .post('/api/v1/device/tokens')
                .send({ token: 'fcm-token-abc', platform: 'android' });
            expect(res.status).toBe(401);
        });
    });

    // ─── Spotify OAuth state flow ───────────────────────────────────

    describe('GET /api/v1/device/spotify/callback', () => {
        it('requires authentication', async () => {
            const res = await request(app).get('/api/v1/device/spotify/callback?code=abc&state=xyz');
            expect(res.status).toBe(401);
        });
    });

    // ─── 404 for unknown routes ─────────────────────────────────────

    describe('unknown routes', () => {
        it('GET /api/v1/nonexistent → 404', async () => {
            const res = await request(app).get('/api/v1/nonexistent');
            expect(res.status).toBe(404);
        });
    });
});
