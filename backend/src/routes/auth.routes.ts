import { Router } from 'express';
import { register, login, refresh, logout, getMe, forgotPassword, resetPassword } from '../controllers/auth.controller';
import { googleSignIn } from '../controllers/google.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { createRateLimiter } from '../middleware/rate-limit.middleware';
import { securityConfig } from '../config/security';

const router = Router();
const authAttemptLimiter = createRateLimiter({
    keyPrefix: 'auth-attempt',
    windowMs: securityConfig.rateLimits.auth.windowMs,
    max: securityConfig.rateLimits.auth.max,
    message: 'Too many authentication attempts. Please wait a few minutes and try again.',
});
const authRefreshLimiter = createRateLimiter({
    keyPrefix: 'auth-refresh',
    windowMs: securityConfig.rateLimits.authRefresh.windowMs,
    max: securityConfig.rateLimits.authRefresh.max,
    message: 'Too many session refresh requests. Please slow down and try again.',
});

// Public routes
router.post('/register', authAttemptLimiter, register);
router.post('/login', authAttemptLimiter, login);
router.post('/sso/google/credential', authAttemptLimiter, googleSignIn);
router.post('/refresh', authRefreshLimiter, refresh);
router.post('/logout', authRefreshLimiter, logout);
router.post('/forgot-password', authAttemptLimiter, forgotPassword);
router.post('/reset-password', authAttemptLimiter, resetPassword);

// Protected routes
router.get('/me', authMiddleware, getMe);

export default router;
