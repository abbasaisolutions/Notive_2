import 'dotenv/config';
import { serverLogger } from './utils/server-logger';

const parsePort = (value: string | undefined, fallback: number) => {
    const parsed = Number.parseInt(String(value || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const port = parsePort(process.env.PORT, 8000);
const host = process.env.HOST || '0.0.0.0';

// Catch unhandled errors
process.on('uncaughtException', (err) => {
    serverLogger.error('process.uncaught_exception', {
        message: err.message,
        stack: err.stack,
    });
});

process.on('unhandledRejection', (reason, promise) => {
    serverLogger.error('process.unhandled_rejection', {
        reason: reason instanceof Error ? reason.message : reason,
        stack: reason instanceof Error ? reason.stack : undefined,
    });
});

const bootstrap = async () => {
    try {
        const [
            { default: app },
            { default: embeddingService },
            { healthCronService },
        ] = await Promise.all([
            import('./app'),
            import('./services/embedding.service'),
            import('./services/health-cron.service'),
        ]);

        const server = app.listen(port, host, () => {
            serverLogger.info('server.started', {
                host,
                port,
                nodeEnv: process.env.NODE_ENV || 'development',
            });

            if (process.env.ENABLE_HEALTH_CRON !== 'false') {
                void healthCronService.start();
            }

            embeddingService.startJobWorker();
        });

        server.on('error', (error: Error) => {
            serverLogger.error('server.listen_failed', {
                host,
                port,
                message: error.message,
                stack: error.stack,
            });
            process.exit(1);
        });
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        serverLogger.error('server.bootstrap_failed', {
            host,
            port,
            message: err.message,
            stack: err.stack,
        });
        process.exit(1);
    }
};

void bootstrap();
