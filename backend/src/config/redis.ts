import { createClient, RedisClientType } from 'redis';
import { serverLogger } from '../utils/server-logger';

let redisClient: RedisClientType | null = null;

export const initRedis = async (): Promise<RedisClientType> => {
    if (redisClient && redisClient.isOpen) {
        return redisClient;
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    redisClient = createClient({
        url: redisUrl,
        socket: {
            connectTimeout: 5000,
            reconnectStrategy: (retries) => Math.min(retries * 50, 500),
        },
    });

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
        await redisClient.connect();
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        serverLogger.warn('redis.connection_failed', {
            message: err.message,
            url: redisUrl,
        });
        // Continue gracefully — rate limiting will degrade to in-memory if Redis unavailable
        redisClient = null;
    }

    return redisClient || createFallbackClient();
};

/**
 * Fallback in-memory client when Redis is unavailable.
 * Provides same interface as redis client but operates in-memory.
 */
function createFallbackClient(): any {
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
        isOpen: true,
        get: async (key: string) => store.get(key)?.value ?? null,
        set: async (key: string, value: string, opts?: any) => {
            store.set(key, {
                value,
                expiresAt: opts?.EX
                    ? Date.now() + opts.EX * 1000
                    : opts?.PX
                      ? Date.now() + opts.PX
                      : Date.now() + 24 * 60 * 60 * 1000,
            });
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
    };
}

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
