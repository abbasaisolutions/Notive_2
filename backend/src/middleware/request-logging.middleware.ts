import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { securityConfig } from '../config/security';
import { serverLogger } from '../utils/server-logger';

const roundDuration = (value: number) => Math.round(value * 100) / 100;

export const requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const requestId = (req.header('x-request-id') || '').trim() || crypto.randomUUID();
    const startedAt = process.hrtime.bigint();

    res.locals.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    if (!securityConfig.requestLoggingEnabled) {
        next();
        return;
    }

    if (securityConfig.requestLoggingVerbose) {
        serverLogger.info('http.request.started', {
            requestId,
            method: req.method,
            path: req.originalUrl || req.url,
            ip: req.ip || req.socket.remoteAddress || 'unknown',
        });
    }

    res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        serverLogger.info('http.request.completed', {
            requestId,
            method: req.method,
            path: req.originalUrl || req.url,
            statusCode: res.statusCode,
            durationMs: roundDuration(durationMs),
            ip: req.ip || req.socket.remoteAddress || 'unknown',
            userId: req.userId || undefined,
            userAgent: req.get('user-agent') || undefined,
        });
    });

    next();
};
