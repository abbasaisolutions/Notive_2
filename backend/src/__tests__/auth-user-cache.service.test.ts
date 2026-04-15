import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findUnique, store } = vi.hoisted(() => ({
    findUnique: vi.fn(),
    store: new Map<string, string>(),
}));

vi.mock('../config/prisma', () => ({
    default: {
        user: {
            findUnique,
        },
    },
}));

vi.mock('../config/redis', () => ({
    getRedisClient: () => ({
        get: async (key: string) => store.get(key) ?? null,
        set: async (key: string, value: string) => {
            store.set(key, value);
        },
        del: async (keys: string | string[]) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            for (const key of keyList) {
                store.delete(key);
            }
            return keyList.length;
        },
    }),
}));

import {
    getAuthUserSnapshot,
    invalidateAuthUserCache,
    primeAuthUserCache,
} from '../services/auth-user-cache.service';

describe('auth user cache service', () => {
    beforeEach(() => {
        store.clear();
        findUnique.mockReset();
    });

    it('reuses cached users instead of hitting Prisma on every lookup', async () => {
        findUnique.mockResolvedValue({
            id: 'user-1',
            email: 'person@example.com',
            isBanned: false,
        });

        const first = await getAuthUserSnapshot('user-1');
        const second = await getAuthUserSnapshot('user-1');

        expect(first).toEqual({
            id: 'user-1',
            email: 'person@example.com',
            isBanned: false,
        });
        expect(second).toEqual(first);
        expect(findUnique).toHaveBeenCalledTimes(1);
    });

    it('supports explicit cache invalidation after account changes', async () => {
        await primeAuthUserCache({
            id: 'user-2',
            email: 'before@example.com',
            isBanned: false,
        });

        findUnique.mockResolvedValue({
            id: 'user-2',
            email: 'after@example.com',
            isBanned: false,
        });

        await invalidateAuthUserCache('user-2');
        const snapshot = await getAuthUserSnapshot('user-2');

        expect(snapshot?.email).toBe('after@example.com');
        expect(findUnique).toHaveBeenCalledTimes(1);
    });
});
