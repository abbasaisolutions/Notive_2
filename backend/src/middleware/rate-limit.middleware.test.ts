import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';

// Mock Redis with in-memory store before importing the rate limiter
const store = new Map<string, { value: string; expiresAt: number }>();

vi.mock('../config/redis', () => ({
    getRedisClient: () => ({
        isOpen: true,
        get: async (key: string) => store.get(key)?.value ?? null,
        set: async (key: string, value: string, opts?: { EX?: number }) => {
            store.set(key, {
                value,
                expiresAt: opts?.EX
                    ? Date.now() + opts.EX * 1000
                    : Date.now() + 86_400_000,
            });
        },
    }),
}));

import { createRateLimiter } from './rate-limit.middleware';

function buildApp(limiterOpts: Parameters<typeof createRateLimiter>[0], withAuth = false) {
    const app = express();
    app.set('trust proxy', 1);

    if (withAuth) {
        app.use((req: Request, _res, next) => {
            (req as any).userId = req.headers['x-user-id'] as string || undefined;
            next();
        });
    }

    const limiter = createRateLimiter(limiterOpts);
    app.get('/test', limiter, (_req: Request, res: Response) => {
        res.json({ ok: true });
    });
    return app;
}

describe('rate-limit middleware', () => {
    beforeEach(() => {
        store.clear();
    });

    // ─── IP-only strategy ────────────────────────────────────────────

    describe('strategy: ip (default)', () => {
        const opts = {
            keyPrefix: 'test-ip',
            windowMs: 60_000,
            max: 3,
            message: 'Too many requests',
        } as const;

        it('allows requests under the limit', async () => {
            const app = buildApp(opts);
            const res = await request(app).get('/test');
            expect(res.status).toBe(200);
            expect(res.headers['x-ratelimit-limit']).toBe('3');
            expect(res.headers['x-ratelimit-remaining']).toBe('2');
            expect(res.headers['x-ratelimit-reset']).toBeDefined();
        });

        it('rejects requests over the limit with 429 and correct headers', async () => {
            const app = buildApp(opts);
            for (let i = 0; i < 3; i++) {
                await request(app).get('/test');
            }
            const res = await request(app).get('/test');
            expect(res.status).toBe(429);
            expect(res.body.message).toBe('Too many requests');
            expect(res.body.retryAfterSeconds).toBeGreaterThan(0);
            expect(res.headers['retry-after']).toBeDefined();
            expect(res.headers['x-ratelimit-remaining']).toBe('0');
        });

        it('keys by IP — different IPs get independent buckets', async () => {
            const app = buildApp(opts);
            // Exhaust from one "IP"
            for (let i = 0; i < 3; i++) {
                await request(app).get('/test').set('X-Forwarded-For', '1.1.1.1');
            }
            const blocked = await request(app).get('/test').set('X-Forwarded-For', '1.1.1.1');
            expect(blocked.status).toBe(429);

            // Different IP still works
            const ok = await request(app).get('/test').set('X-Forwarded-For', '2.2.2.2');
            expect(ok.status).toBe(200);
        });
    });

    // ─── User-only strategy ──────────────────────────────────────────

    describe('strategy: user', () => {
        const opts = {
            keyPrefix: 'test-user',
            windowMs: 60_000,
            max: 2,
            message: 'Too many requests',
            strategy: 'user' as const,
        };

        it('keys by userId when present', async () => {
            const app = buildApp(opts, true);
            await request(app).get('/test').set('X-User-Id', 'alice');
            await request(app).get('/test').set('X-User-Id', 'alice');
            const blocked = await request(app).get('/test').set('X-User-Id', 'alice');
            expect(blocked.status).toBe(429);

            // Different user is not affected
            const ok = await request(app).get('/test').set('X-User-Id', 'bob');
            expect(ok.status).toBe(200);
        });

        it('falls back to IP when no userId', async () => {
            const app = buildApp(opts, true);
            await request(app).get('/test');
            await request(app).get('/test');
            const blocked = await request(app).get('/test');
            expect(blocked.status).toBe(429);
        });
    });

    // ─── Dual strategy (ip-and-user) ────────────────────────────────

    describe('strategy: ip-and-user', () => {
        const opts = {
            keyPrefix: 'test-dual',
            windowMs: 60_000,
            max: 3,       // per-user max
            ipMax: 5,     // per-IP max
            message: 'Too many requests',
            strategy: 'ip-and-user' as const,
        };

        it('sets both IP and User rate-limit headers', async () => {
            const app = buildApp(opts, true);
            const res = await request(app).get('/test').set('X-User-Id', 'alice');
            expect(res.status).toBe(200);
            expect(res.headers['x-ratelimit-ip-limit']).toBe('5');
            expect(res.headers['x-ratelimit-user-limit']).toBe('3');
        });

        it('blocks when per-user limit exceeded even if IP has headroom', async () => {
            const app = buildApp(opts, true);
            for (let i = 0; i < 3; i++) {
                await request(app).get('/test').set('X-User-Id', 'alice').set('X-Forwarded-For', '3.3.3.3');
            }
            const blocked = await request(app).get('/test').set('X-User-Id', 'alice').set('X-Forwarded-For', '3.3.3.3');
            expect(blocked.status).toBe(429);
            // IP bucket: 4 of 5 used — not exceeded
            // User bucket: 4 of 3 used — exceeded
        });

        it('blocks when per-IP limit exceeded even if user has headroom', async () => {
            const app = buildApp(opts, true);
            // 5 requests from different users, same IP
            const users = ['u1', 'u2', 'u3', 'u4', 'u5'];
            for (const uid of users) {
                await request(app).get('/test').set('X-User-Id', uid).set('X-Forwarded-For', '4.4.4.4');
            }
            // 6th request — new user but same IP → blocked by IP bucket
            const blocked = await request(app).get('/test').set('X-User-Id', 'u6').set('X-Forwarded-For', '4.4.4.4');
            expect(blocked.status).toBe(429);
        });

        it('allows different users on different IPs independently', async () => {
            const app = buildApp(opts, true);
            for (let i = 0; i < 3; i++) {
                await request(app).get('/test').set('X-User-Id', 'alice').set('X-Forwarded-For', '5.5.5.5');
            }
            // Alice blocked
            const blocked = await request(app).get('/test').set('X-User-Id', 'alice').set('X-Forwarded-For', '5.5.5.5');
            expect(blocked.status).toBe(429);

            // Bob on different IP is fine
            const ok = await request(app).get('/test').set('X-User-Id', 'bob').set('X-Forwarded-For', '6.6.6.6');
            expect(ok.status).toBe(200);
        });

        it('defaults ipMax to 3x max when not specified', async () => {
            const app = buildApp({ ...opts, ipMax: undefined }, true);
            const res = await request(app).get('/test').set('X-User-Id', 'alice');
            expect(res.headers['x-ratelimit-ip-limit']).toBe('9'); // 3 * 3
        });
    });

    // ─── Skip option ────────────────────────────────────────────────

    describe('skip option', () => {
        it('bypasses rate limiting when skip returns true', async () => {
            const app = buildApp({
                keyPrefix: 'test-skip',
                windowMs: 60_000,
                max: 1,
                message: 'Too many requests',
                skip: () => true,
            });

            const res1 = await request(app).get('/test');
            const res2 = await request(app).get('/test');
            expect(res1.status).toBe(200);
            expect(res2.status).toBe(200);
        });
    });

    // ─── Redis fallback (fail-open) ─────────────────────────────────

    describe('Redis failure (fail-open)', () => {
        it('allows request through when Redis throws', async () => {
            // Temporarily make getRedisClient throw
            const { getRedisClient } = await import('../config/redis');
            const originalGet = (getRedisClient() as any).get;
            (getRedisClient() as any).get = async () => { throw new Error('Redis down'); };

            const app = buildApp({
                keyPrefix: 'test-failopen',
                windowMs: 60_000,
                max: 1,
                message: 'Too many requests',
            });

            const res = await request(app).get('/test');
            expect(res.status).toBe(200);

            // Restore
            (getRedisClient() as any).get = originalGet;
        });
    });

    // ─── Reset window ───────────────────────────────────────────────

    describe('reset window', () => {
        it('resets counter after bucket expiry', async () => {
            const app = buildApp({
                keyPrefix: 'test-reset',
                windowMs: 100, // 100ms window
                max: 1,
                message: 'Too many requests',
            });

            await request(app).get('/test');
            const blocked = await request(app).get('/test');
            expect(blocked.status).toBe(429);

            // Wait for window to expire
            await new Promise((r) => setTimeout(r, 150));

            const ok = await request(app).get('/test');
            expect(ok.status).toBe(200);
        });
    });
});
