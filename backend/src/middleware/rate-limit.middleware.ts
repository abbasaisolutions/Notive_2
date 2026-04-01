import { NextFunction, Request, Response } from 'express';
import { getRedisClient } from '../config/redis';

type RateLimitStrategy = 'ip' | 'user' | 'ip-and-user';

type RateLimitOptions = {
    keyPrefix: string;
    windowMs: number;
    max: number;
    message: string;
    /** 'ip' = per-IP only (default, best for unauthenticated routes).
     *  'user' = per-user only (userId, falls back to IP if unauthenticated).
     *  'ip-and-user' = two independent buckets checked in parallel. */
    strategy?: RateLimitStrategy;
    /** Per-IP max when strategy is 'ip-and-user' and the IP ceiling differs from the user ceiling.
     *  Defaults to `max * 3` so a shared IP (office, VPN) gets headroom. */
    ipMax?: number;
    keyGenerator?: (req: Request) => string;
    skip?: (req: Request) => boolean;
};

type RateLimitBucket = {
    count: number;
    resetAt: number;
};

const resolveIpKey = (req: Request): string =>
    (req.ip || req.socket.remoteAddress || 'anonymous').trim();

const resolveUserKey = (req: Request): string | null => {
    const uid = typeof req.userId === 'string' ? req.userId.trim() : '';
    return uid || null;
};

const resolveRateLimitIdentity = (req: Request, keyGenerator?: (req: Request) => string): string => {
    const generated = keyGenerator?.(req)?.trim();
    if (generated) return generated;

    const userKey = resolveUserKey(req);
    const ipKey = resolveIpKey(req);

    return [userKey, ipKey].filter(Boolean).join(':') || 'anonymous';
};

async function checkBucket(
    redis: ReturnType<typeof getRedisClient>,
    bucketKey: string,
    windowMs: number,
    max: number,
    now: number,
): Promise<{ bucket: RateLimitBucket; exceeded: boolean }> {
    const currentStr = await redis.get(bucketKey);
    const current: RateLimitBucket = currentStr
        ? JSON.parse(currentStr)
        : { count: 0, resetAt: now + windowMs };

    const bucket: RateLimitBucket = current.resetAt <= now
        ? { count: 0, resetAt: now + windowMs }
        : current;

    bucket.count += 1;
    await redis.set(bucketKey, JSON.stringify(bucket), { EX: Math.ceil(windowMs / 1000) });

    return { bucket, exceeded: bucket.count > max };
}

function setRateLimitHeaders(
    res: Response,
    max: number,
    bucket: RateLimitBucket,
    now: number,
    prefix: string,
): void {
    const headerPrefix = prefix ? `X-RateLimit-${prefix}-` : 'X-RateLimit-';
    res.setHeader(`${headerPrefix}Limit`, String(max));
    res.setHeader(`${headerPrefix}Remaining`, String(Math.max(max - bucket.count, 0)));
    res.setHeader(`${headerPrefix}Reset`, new Date(bucket.resetAt).toISOString());
}

export const createRateLimiter = ({
    keyPrefix,
    windowMs,
    max,
    message,
    strategy = 'ip',
    ipMax,
    keyGenerator,
    skip,
}: RateLimitOptions) => async (req: Request, res: Response, next: NextFunction) => {
    if (skip?.(req)) {
        next();
        return;
    }

    try {
        const redis = getRedisClient();
        const now = Date.now();

        if (strategy === 'ip-and-user') {
            const ipKey = resolveIpKey(req);
            const userKey = resolveUserKey(req);
            const effectiveIpMax = ipMax ?? max * 3;

            const ipResult = await checkBucket(redis, `${keyPrefix}:ip:${ipKey}`, windowMs, effectiveIpMax, now);
            setRateLimitHeaders(res, effectiveIpMax, ipResult.bucket, now, 'IP');

            let userResult: { bucket: RateLimitBucket; exceeded: boolean } | null = null;
            if (userKey) {
                userResult = await checkBucket(redis, `${keyPrefix}:user:${userKey}`, windowMs, max, now);
                setRateLimitHeaders(res, max, userResult.bucket, now, 'User');
            }

            const exceeded = ipResult.exceeded || (userResult?.exceeded ?? false);
            if (exceeded) {
                const resetAt = Math.max(
                    ipResult.exceeded ? ipResult.bucket.resetAt : 0,
                    userResult?.exceeded ? userResult.bucket.resetAt : 0,
                );
                const retryAfterSeconds = Math.max(Math.ceil((resetAt - now) / 1000), 1);
                res.setHeader('Retry-After', String(retryAfterSeconds));
                res.status(429).json({ message, retryAfterSeconds });
                return;
            }

            next();
            return;
        }

        // Simple single-bucket strategy: 'ip' or 'user'
        let identity: string;
        if (keyGenerator) {
            identity = keyGenerator(req)?.trim() || 'anonymous';
        } else if (strategy === 'user') {
            identity = resolveUserKey(req) || resolveIpKey(req);
        } else {
            identity = resolveIpKey(req);
        }

        const bucketKey = `${keyPrefix}:${identity}`;
        const { bucket, exceeded } = await checkBucket(redis, bucketKey, windowMs, max, now);

        res.setHeader('X-RateLimit-Limit', String(max));
        res.setHeader('X-RateLimit-Remaining', String(Math.max(max - bucket.count, 0)));
        res.setHeader('X-RateLimit-Reset', new Date(bucket.resetAt).toISOString());

        if (exceeded) {
            const retryAfterSeconds = Math.max(Math.ceil((bucket.resetAt - now) / 1000), 1);
            res.setHeader('Retry-After', String(retryAfterSeconds));
            res.status(429).json({ message, retryAfterSeconds });
            return;
        }

        next();
    } catch (error) {
        // On error, allow request through but log it
        console.error('Rate limit check failed:', error);
        next();
    }
};
