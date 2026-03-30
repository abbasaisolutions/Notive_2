import 'dotenv/config';
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
import healthRoutes from './routes/health.routes';
import legalRoutes from './routes/legal.routes';
import voiceRoutes from './routes/voice.routes';
import deviceRoutes from './routes/device.routes';
import { securityConfig } from './config/security';
import { securityHeadersMiddleware } from './middleware/security.middleware';
import { requestLoggingMiddleware } from './middleware/request-logging.middleware';
import { serverLogger } from './utils/server-logger';

const app: Express = express();
const isProd = process.env.NODE_ENV === 'production';

const normalizeOriginList = (value: string | undefined) =>
    (value || '')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean);

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const compileOriginPattern = (pattern: string) => {
    const normalized = pattern.trim();
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

const isAllowedOrigin = (origin: string) =>
    allowedOrigins.includes(origin) || allowedOriginPatterns.some(pattern => pattern.test(origin));

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

        const corsError = new Error('Origin not allowed by CORS') as Error & { status?: number };
        corsError.status = 403;
        callback(corsError);
    },
    credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());

// Local uploads remain available for local/dev deployments. Production should use object storage.
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

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
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/legal', legalRoutes);
app.use('/api/v1/voice', voiceRoutes);
app.use('/api/v1/device', deviceRoutes);

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
