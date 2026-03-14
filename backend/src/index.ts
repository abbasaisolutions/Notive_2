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

const app: Express = express();
const port = process.env.PORT || 8000;
const isProd = process.env.NODE_ENV === 'production';

if (isProd && (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET)) {
    throw new Error('JWT secrets are required in production');
}

const allowedOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

// Middleware
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

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/', (req: Request, res: Response) => {
    res.json({ message: 'Notive API is running', version: '0.1.0' });
});

// Routes
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

// Start server
app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
});
