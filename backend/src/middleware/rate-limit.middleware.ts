import { NextFunction, Request, Response } from 'express';

type RateLimitOptions = {
    keyPrefix: string;
    windowMs: number;
    max: number;
    message: string;
    keyGenerator?: (req: Request) => string;
    skip?: (req: Request) => boolean;
};

type RateLimitBucket = {
    count: number;
    resetAt: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of rateLimitBuckets.entries()) {
        if (bucket.resetAt <= now) {
            rateLimitBuckets.delete(key);
        }
    }
}, 60 * 1000);

cleanupInterval.unref();

const resolveRateLimitIdentity = (req: Request, keyGenerator?: (req: Request) => string): string => {
    const generated = keyGenerator?.(req)?.trim();
    if (generated) return generated;

    const userKey = typeof req.userId === 'string' && req.userId.trim() ? req.userId.trim() : '';
    const ipKey = (req.ip || req.socket.remoteAddress || 'anonymous').trim();

    return [userKey, ipKey].filter(Boolean).join(':') || 'anonymous';
};

export const createRateLimiter = ({
    keyPrefix,
    windowMs,
    max,
    message,
    keyGenerator,
    skip,
}: RateLimitOptions) => (req: Request, res: Response, next: NextFunction) => {
    if (skip?.(req)) {
        next();
        return;
    }

    const now = Date.now();
    const identity = resolveRateLimitIdentity(req, keyGenerator);
    const bucketKey = `${keyPrefix}:${identity}`;
    const existingBucket = rateLimitBuckets.get(bucketKey);
    const bucket = !existingBucket || existingBucket.resetAt <= now
        ? { count: 0, resetAt: now + windowMs }
        : existingBucket;

    rateLimitBuckets.set(bucketKey, bucket);

    if (bucket.count >= max) {
        const retryAfterSeconds = Math.max(Math.ceil((bucket.resetAt - now) / 1000), 1);
        res.setHeader('Retry-After', String(retryAfterSeconds));
        res.setHeader('X-RateLimit-Limit', String(max));
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', new Date(bucket.resetAt).toISOString());
        res.status(429).json({
            message,
            retryAfterSeconds,
        });
        return;
    }

    bucket.count += 1;

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(max - bucket.count, 0)));
    res.setHeader('X-RateLimit-Reset', new Date(bucket.resetAt).toISOString());

    next();
};
