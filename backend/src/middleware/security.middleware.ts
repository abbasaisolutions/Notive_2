import { NextFunction, Request, Response } from 'express';
import { securityConfig } from '../config/security';

export const securityHeadersMiddleware = (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    if (securityConfig.isProduction) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    if (securityConfig.contentSecurityPolicy) {
        res.setHeader('Content-Security-Policy', securityConfig.contentSecurityPolicy);
    }

    next();
};
