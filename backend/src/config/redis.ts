import { createClient, RedisClientType } from 'redis';
import { serverLogger } from '../utils/server-logger';

let redisClient: RedisClientType | null = null;
const REDIS_CONNECT_TIMEOUT_MS = 4000;

const createFallbackClient = (): any => {
    const store = new Map<string, { value: string; expiresAt: number }>();

    const cleanup = setInterval(() => {
        const now = Date.now();
        for (const [key, data] of store.entries()) {
            if (data.expiresAt <= now) {
                store.delete(key);
            }
        }
    }, 60 * 1000);

    cleanup.unref();

    return {
        __notiveClientType: 'fallback',
        isOpen: true,
        get: async (key: string) => store.get(key)?.value ?? null,
        set: async (key: string, value: string, opts?: any) => {
            if (opts?.NX && store.has(key)) {
                const existing = store.get(key);
                if (!existing || existing.expiresAt > Date.now()) {
                    return null;
                }
            }

            store.set(key, {
                value,
                expiresAt: opts?.EX
                    ? Date.now() + opts.EX * 1000
                    : opts?.PX
                      ? Date.now() + opts.PX
                      : Date.now() + 24 * 60 * 60 * 1000,
            });
            return 'OK';
        },
        del: async (keys: string | string[]) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            let deleted = 0;
            for (const key of keyList) {
                if (store.delete(key)) deleted += 1;
            }
            return deleted;
        },
        incr: async (key: string) => {
            const current = parseInt(store.get(key)?.value ?? '0', 10);
            const next = current + 1;
            store.set(key, {
                value: String(next),
                expiresAt: store.get(key)?.expiresAt ?? Date.now() + 24 * 60 * 60 * 1000,
            });
            return next;
        },
        expire: async (key: string, seconds: number) => {
            const data = store.get(key);
            if (!data) return 0;
            data.expiresAt = Date.now() + seconds * 1000;
            return 1;
        },
        ping: async () => 'PONG',
        quit: async () => {
            cleanup.unref();
            clearInterval(cleanup);
            store.clear();
        },
    };
};

export const initRedis = async (): Promise<RedisClientType> => {
    if (redisClient && redisClient.isOpen) {
        return redisClient;
    }

    const redisUrl = (process.env.REDIS_URL || '').trim();

    if (!redisUrl) {
        serverLogger.warn('redis.unconfigured', {
            message: 'REDIS_URL not set; using in-memory fallback client.',
        });
        redisClient = createFallbackClient();
        return redisClient as RedisClientType;
    }

    redisClient = createClient({
        url: redisUrl,
        socket: {
            connectTimeout: 5000,
            reconnectStrategy: (retries) => retries >= 2 ? false : Math.min(retries * 50, 250),
        },
    });
    (redisClient as any).__notiveClientType = 'redis';

    redisClient.on('error', (err) => {
        serverLogger.error('redis.connection_error', {
            message: err.message,
        });
    });

    redisClient.on('connect', () => {
        serverLogger.info('redis.connected', {
            url: redisUrl,
        });
    });

    try {
        await Promise.race([
            redisClient.connect(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Redis connection timed out')), REDIS_CONNECT_TIMEOUT_MS)),
        ]);
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        serverLogger.warn('redis.connection_failed', {
            message: err.message,
            url: redisUrl,
        });
        try {
            redisClient.disconnect();
        } catch {
            // Ignore cleanup issues and fall back.
        }
        // Continue gracefully — rate limiting will degrade to in-memory if Redis unavailable
        redisClient = createFallbackClient();
    }

    if (!redisClient) {
        redisClient = createFallbackClient();
    }

    return redisClient as RedisClientType;
};

export const getRedisClient = (): RedisClientType | any => {
    if (!redisClient) {
        throw new Error('Redis not initialized. Call initRedis() first.');
    }
    return redisClient;
};

export const closeRedis = async () => {
    if (redisClient && redisClient.isOpen) {
        await redisClient.quit();
        redisClient = null;
    }
};
