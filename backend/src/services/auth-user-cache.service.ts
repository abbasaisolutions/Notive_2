import prisma from '../config/prisma';
import { getRedisClient } from '../config/redis';

export type AuthUserSnapshot = {
    id: string;
    email: string;
    isBanned: boolean;
};

export const AUTH_USER_CACHE_TTL_SECONDS = 60;

const buildAuthUserCacheKey = (userId: string) => `auth:user:${userId}`;

const readCachedAuthUser = async (userId: string): Promise<AuthUserSnapshot | null> => {
    try {
        const redis = getRedisClient();
        const raw = await redis.get(buildAuthUserCacheKey(userId));
        if (!raw) return null;

        const parsed = JSON.parse(raw) as Partial<AuthUserSnapshot>;
        if (
            typeof parsed?.id !== 'string'
            || typeof parsed?.email !== 'string'
            || typeof parsed?.isBanned !== 'boolean'
        ) {
            return null;
        }

        return {
            id: parsed.id,
            email: parsed.email,
            isBanned: parsed.isBanned,
        };
    } catch {
        return null;
    }
};

export const primeAuthUserCache = async (user: AuthUserSnapshot): Promise<void> => {
    try {
        const redis = getRedisClient();
        await redis.set(
            buildAuthUserCacheKey(user.id),
            JSON.stringify(user),
            { EX: AUTH_USER_CACHE_TTL_SECONDS }
        );
    } catch {
        // Cache writes are best-effort only.
    }
};

export const invalidateAuthUserCache = async (userIds: string | string[]): Promise<void> => {
    const ids = Array.isArray(userIds) ? userIds : [userIds];
    if (ids.length === 0) return;

    try {
        const redis = getRedisClient();
        await redis.del(ids.map(buildAuthUserCacheKey));
    } catch {
        // Cache invalidation should not block the main write path.
    }
};

export const getAuthUserSnapshot = async (userId: string): Promise<AuthUserSnapshot | null> => {
    const cachedUser = await readCachedAuthUser(userId);
    if (cachedUser) {
        return cachedUser;
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            isBanned: true,
        },
    });

    if (!user) {
        await invalidateAuthUserCache(userId);
        return null;
    }

    await primeAuthUserCache(user);
    return user;
};
