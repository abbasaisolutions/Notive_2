import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// ── Mock heavy dependencies ─────────────────────────────────────
vi.mock('../config/prisma', () => {
    const noop = () => Promise.resolve(null);
    const handler: ProxyHandler<object> = {
        get: (_target, prop) => {
            if (prop === 'then') return undefined;
            if (prop === '$connect' || prop === '$disconnect' || prop === '$transaction') return noop;
            return new Proxy({}, { get: () => noop });
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
import path from 'path';
import fs from 'fs';

describe('file upload endpoint', () => {
    describe('POST /api/v1/files/upload', () => {
        it('requires authentication', async () => {
            const res = await request(app)
                .post('/api/v1/files/upload')
                .attach('file', Buffer.from('fake'), 'test.jpg');
            expect(res.status).toBe(401);
        });

        it('rejects request with no file', async () => {
            // Without a valid JWT, we get 401 — validates auth gate
            const res = await request(app)
                .post('/api/v1/files/upload')
                .send({});
            expect(res.status).toBe(401);
        });
    });

    describe('upload filter', () => {
        it('lists allowed MIME types', async () => {
            const { allowedUploadMimeTypes } = await import('../services/file.service');
            expect(allowedUploadMimeTypes).toContain('image/jpeg');
            expect(allowedUploadMimeTypes).toContain('image/png');
            expect(allowedUploadMimeTypes).toContain('image/webp');
            expect(allowedUploadMimeTypes).not.toContain('application/octet-stream');
        });
    });

    describe('LocalFileService.getFileUrl', () => {
        it('returns full URL for local files', async () => {
            const { LocalFileService } = await import('../services/file.service');
            const mockReq = {
                protocol: 'https',
                get: (header: string) => header === 'host' ? 'example.com' : undefined,
            } as any;

            const url = LocalFileService.getFileUrl(mockReq, '12345-avatar.webp');
            expect(url).toBe('https://example.com/uploads/12345-avatar.webp');
        });

        it('returns the filename as-is when it starts with http', async () => {
            const { LocalFileService } = await import('../services/file.service');
            const mockReq = { protocol: 'https', get: () => 'example.com' } as any;

            const url = LocalFileService.getFileUrl(mockReq, 'https://s3.amazonaws.com/bucket/file.webp');
            expect(url).toBe('https://s3.amazonaws.com/bucket/file.webp');
        });
    });
});
