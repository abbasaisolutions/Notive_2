import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
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

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 8000;

// Middleware
app.use(cors({
    origin: true, // Allow all origins for development (mobile apps, web, etc.)
    credentials: true, // Allow cookies
}));
app.use(express.json());
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

// Global error handler
app.use((err: any, req: Request, res: Response, next: any) => {
    console.error('Global error:', err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
});

// Catch unhandled errors
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
});
