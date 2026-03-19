type LogLevel = 'info' | 'warn' | 'error';

type LogPayload = Record<string, unknown>;

const writeLog = (level: LogLevel, event: string, payload: LogPayload = {}) => {
    const record = {
        ts: new Date().toISOString(),
        level,
        event,
        ...payload,
    };

    const serialized = JSON.stringify(record);

    if (level === 'error') {
        console.error(serialized);
        return;
    }

    if (level === 'warn') {
        console.warn(serialized);
        return;
    }

    console.log(serialized);
};

export const serverLogger = {
    info: (event: string, payload?: LogPayload) => writeLog('info', event, payload),
    warn: (event: string, payload?: LogPayload) => writeLog('warn', event, payload),
    error: (event: string, payload?: LogPayload) => writeLog('error', event, payload),
};
