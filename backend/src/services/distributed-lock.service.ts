import { randomUUID } from 'crypto';
import { getRedisClient } from '../config/redis';

export const tryAcquireDistributedLock = async (
    key: string,
    ttlSeconds: number
): Promise<boolean> => {
    try {
        const redis = getRedisClient() as any;
        const token = randomUUID();
        const result = await redis.set(key, token, {
            NX: true,
            EX: Math.max(1, Math.floor(ttlSeconds)),
        });

        return result === 'OK' || result === true;
    } catch {
        return true;
    }
};
