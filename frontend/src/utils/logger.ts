/**
 * Centralized logging utility for the application
 * Provides different log levels and conditional logging based on environment
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
    enabled: boolean;
    minLevel: LogLevel;
}

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

class Logger {
    private config: LoggerConfig;

    constructor() {
        this.config = {
            enabled: process.env.NODE_ENV !== 'production',
            minLevel: process.env.NODE_ENV === 'production' ? 'error' : 'debug',
        };
    }

    private shouldLog(level: LogLevel): boolean {
        if (!this.config.enabled) return false;
        return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel];
    }

    private formatMessage(level: LogLevel, message: string, data?: any): string {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
        return data ? `${prefix} ${message}` : `${prefix} ${message}`;
    }

    debug(message: string, data?: any) {
        if (this.shouldLog('debug')) {
            console.log(this.formatMessage('debug', message, data), data || '');
        }
    }

    info(message: string, data?: any) {
        if (this.shouldLog('info')) {
            console.info(this.formatMessage('info', message, data), data || '');
        }
    }

    warn(message: string, data?: any) {
        if (this.shouldLog('warn')) {
            console.warn(this.formatMessage('warn', message, data), data || '');
        }
    }

    error(message: string, error?: any) {
        if (this.shouldLog('error')) {
            console.error(this.formatMessage('error', message, error), error || '');

            // In production, you could send errors to a service like Sentry
            // if (process.env.NODE_ENV === 'production') {
            //     // Sentry.captureException(error);
            // }
        }
    }

    // Helper method for API errors
    apiError(endpoint: string, error: any) {
        this.error(`API Error at ${endpoint}`, {
            message: error?.message,
            status: error?.status,
            response: error?.response,
        });
    }
}

// Export singleton instance
export const logger = new Logger();

// Export default for convenience
export default logger;
