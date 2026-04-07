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
    let stage = 'bootstrap.start';

    try {
        stage = 'config.import';
        const [
            { default: prisma },
            { initRedis },
        ] = await Promise.all([
            import('./config/prisma'),
            import('./config/redis'),
        ]);

        // Initialize Redis first
        stage = 'redis.init';
        await initRedis();

        stage = 'app.import';
        const { default: app } = await import('./app');

        stage = 'readiness.checks';
        const { logProductionReadinessChecks } = await import('./config/production-readiness');
        logProductionReadinessChecks();

        stage = 'embedding.import';
        const { default: embeddingService } = await import('./services/embedding.service');

        stage = 'voice.import';
        const { default: voiceTranscriptionJobService } = await import('./services/voice-transcription-job.service');

        stage = 'reminder.import';
        const { ReminderService } = await import('./services/reminder.service');

        stage = 'server.listen';
        const server = app.listen(port, host, () => {
            serverLogger.info('server.started', {
                host,
                port,
                nodeEnv: process.env.NODE_ENV || 'development',
            });

            embeddingService.startJobWorker();
            voiceTranscriptionJobService.startJobWorker();

            // Reminder scheduler: check for due reminders every minute
            const reminderService = new ReminderService(prisma);
            setInterval(() => {
                void reminderService.dispatchDueReminders().catch(() => {});
            }, 60_000);
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
            stage,
            host,
            port,
            message: err.message,
            stack: err.stack,
        });
        process.exit(1);
    }
};

void bootstrap();
