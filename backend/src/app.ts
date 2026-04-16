import 'dotenv/config';
import * as Sentry from '@sentry/node';
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import authRoutes from './routes/auth.routes';
import entryRoutes from './routes/entry.routes';
import aiRoutes from './routes/ai.routes';
import chapterRoutes from './routes/chapter.routes';
import shareRoutes from './routes/share.routes';
import analyticsRoutes from './routes/analytics.routes';
import userRoutes from './routes/user.routes';
import adminRoutes from './routes/admin.routes';
import socialRoutes from './routes/social.routes';
import importRoutes from './routes/import.routes';
import fileRoutes from './routes/file.routes';
import legalRoutes from './routes/legal.routes';
import voiceRoutes from './routes/voice.routes';
import deviceRoutes from './routes/device.routes';
import memoryShareRoutes from './routes/memory-share.routes';
import notificationRoutes from './routes/notification.routes';
import reminderRoutes from './routes/reminder.routes';
import friendshipRoutes from './routes/friendship.routes';
import { securityConfig } from './config/security';
import { securityHeadersMiddleware } from './middleware/security.middleware';
import { requestLoggingMiddleware } from './middleware/request-logging.middleware';
import { serverLogger } from './utils/server-logger';
import { getRuntimeReadinessReport } from './services/runtime-readiness.service';

// Sentry must be initialised before the Express app is created
if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    });
}

const app: Express = express();
const isProd = process.env.NODE_ENV === 'production';

const normalizeOrigin = (value: string) => value.trim().replace(/\/$/, '').toLowerCase();

const normalizeOriginList = (value: string | undefined) =>
    (value || '')
        .split(',')
        .map(origin => normalizeOrigin(origin))
        .filter(Boolean);

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const compileOriginPattern = (pattern: string) => {
    const normalized = normalizeOrigin(pattern);
    if (!normalized) return null;

    try {
        return new RegExp(`^${escapeRegex(normalized).replace(/\\\*/g, '.*')}$`);
    } catch {
        return null;
    }
};

const allowedOrigins = normalizeOriginList(process.env.CORS_ORIGINS);
const allowedOriginPatterns = normalizeOriginList(process.env.CORS_ALLOWED_ORIGIN_PATTERNS)
    .map(compileOriginPattern)
    .filter((pattern): pattern is RegExp => Boolean(pattern));

const LOCAL_ORIGIN_PROTOCOLS = new Set(['http:', 'https:', 'capacitor:', 'ionic:']);
const LOCAL_ORIGIN_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

const isNativeLocalOrigin = (origin: string) => {
    try {
        const parsed = new URL(origin);
        return LOCAL_ORIGIN_PROTOCOLS.has(parsed.protocol)
            && (
                LOCAL_ORIGIN_HOSTS.has(parsed.hostname)
                || parsed.hostname.endsWith('.local')
            );
    } catch {
        return false;
    }
};

const isAllowedOrigin = (origin: string) => {
    const normalizedOrigin = normalizeOrigin(origin);

    return isNativeLocalOrigin(normalizedOrigin)
        || allowedOrigins.includes(normalizedOrigin)
        || allowedOriginPatterns.some(pattern => pattern.test(normalizedOrigin));
};

app.disable('x-powered-by');
app.set('trust proxy', securityConfig.trustProxy);

if (isProd && (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET)) {
    throw new Error('JWT secrets are required in production');
}

app.use(securityHeadersMiddleware);
app.use(requestLoggingMiddleware);
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) {
            callback(null, true);
            return;
        }

        if (!isProd) {
            callback(null, true);
            return;
        }

        if (isAllowedOrigin(origin)) {
            callback(null, true);
            return;
        }

        serverLogger.warn('cors.origin_blocked', { origin });
        const corsError = new Error('Origin not allowed by CORS') as Error & { status?: number };
        corsError.status = 403;
        callback(corsError);
    },
    credentials: true,
    optionsSuccessStatus: 200,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());

// Local uploads remain available for local/dev deployments. Production should use object storage.
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.get('/healthz', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
});

app.get('/readyz', async (_req: Request, res: Response) => {
    try {
        const report = await getRuntimeReadinessReport();
        res.status(report.status === 'error' ? 503 : 200).json(report);
    } catch (error) {
        res.status(503).json({
            status: 'error',
            checkedAt: new Date().toISOString(),
            cacheTtlMs: 0,
            components: [
                {
                    key: 'runtime_readiness',
                    required: true,
                    status: 'error',
                    message: error instanceof Error ? error.message : 'Runtime readiness check failed',
                },
            ],
        });
    }
});

app.get('/', (_req: Request, res: Response) => {
    res.json({ message: 'Notive API is running', version: '0.1.0' });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/entries', entryRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/chapters', chapterRoutes);
app.use('/api/v1/share', shareRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/social', socialRoutes);
app.use('/api/v1/import', importRoutes);
app.use('/api/v1/files', fileRoutes);
app.use('/api/v1/legal', legalRoutes);
app.use('/api/v1/voice', voiceRoutes);
app.use('/api/v1/device', deviceRoutes);
app.use('/api/v1/devices', deviceRoutes);
app.use('/api/v1/memory-share', memoryShareRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/reminders', reminderRoutes);
app.use('/api/v1/friendships', friendshipRoutes);

Sentry.setupExpressErrorHandler(app);

app.use((err: any, req: Request, res: Response, _next: any) => {
    serverLogger.error('http.request.failed', {
        requestId: res.locals.requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: Number.isInteger(err?.status) ? err.status : 500,
        message: err?.message || 'Internal server error',
        stack: err?.stack,
        userId: req.userId || undefined,
    });
    const status = Number.isInteger(err?.status) ? err.status : 500;
    const message = status >= 500 && isProd
        ? 'Internal server error'
        : (err?.message || 'Internal server error');

    res.status(status).json({ message });
});

export default app;
