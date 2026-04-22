import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSharedCountStore } from '@/hooks/create-shared-count-store';

const flushPromises = async () => {
    await Promise.resolve();
    await Promise.resolve();
};

describe('createSharedCountStore', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('dedupes refresh work across multiple active connections', async () => {
        const apiFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ unreadCount: 7 }),
        });

        const store = createSharedCountStore({
            endpoint: '/notifications?unreadOnly=true&limit=1',
            getCount: (data) => data.unreadCount ?? 0,
        });

        const disconnectOne = store.connect({
            accessToken: 'token',
            apiFetch,
            intervalMs: 60_000,
        });
        const disconnectTwo = store.connect({
            accessToken: 'token',
            apiFetch,
            intervalMs: 60_000,
        });

        await flushPromises();

        expect(apiFetch).toHaveBeenCalledTimes(1);
        expect(store.getSnapshot()).toBe(7);

        disconnectOne();
        disconnectTwo();
    });

    it('uses the smallest requested interval while connected', async () => {
        const apiFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ unreadCount: 3 }),
        });

        const intervalSpy = vi.spyOn(globalThis, 'setInterval');

        const store = createSharedCountStore({
            endpoint: '/memory-share/received?limit=1',
            getCount: (data) => data.unreadCount ?? 0,
        });

        const disconnectSlow = store.connect({
            accessToken: 'token',
            apiFetch,
            intervalMs: 60_000,
        });
        const disconnectFast = store.connect({
            accessToken: 'token',
            apiFetch,
            intervalMs: 15_000,
        });

        await flushPromises();

        expect(intervalSpy).toHaveBeenCalled();
        expect(intervalSpy.mock.calls.at(-1)?.[1]).toBe(15_000);

        disconnectSlow();
        disconnectFast();
    });

    it('clears the snapshot when access is removed', async () => {
        const apiFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ unreadCount: 5 }),
        });

        const store = createSharedCountStore({
            endpoint: '/notifications?unreadOnly=true&limit=1',
            getCount: (data) => data.unreadCount ?? 0,
        });

        const disconnect = store.connect({
            accessToken: 'token',
            apiFetch,
            intervalMs: 60_000,
        });

        await flushPromises();
        expect(store.getSnapshot()).toBe(5);

        disconnect();
        store.connect({
            accessToken: null,
            apiFetch,
            intervalMs: 60_000,
        });

        expect(store.getSnapshot()).toBe(0);
    });
});
