import 'dotenv/config';
import app from './app';
import { healthCronService } from './services/health-cron.service';
import { serverLogger } from './utils/server-logger';

const port = process.env.PORT || 8000;

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

// Start server
app.listen(port, () => {
    serverLogger.info('server.started', {
        port,
        nodeEnv: process.env.NODE_ENV || 'development',
    });

    // Start health sync cron jobs
    if (process.env.ENABLE_HEALTH_CRON !== 'false') {
        void healthCronService.start();
    }
});
