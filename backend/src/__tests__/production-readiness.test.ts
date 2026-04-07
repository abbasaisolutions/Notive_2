import { afterEach, describe, expect, it } from 'vitest';
import { collectProductionReadinessChecks } from '../config/production-readiness';

const ENV_KEYS = [
    'NODE_ENV',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_BUCKET_NAME',
    'AWS_REGION',
    'FIREBASE_SERVICE_ACCOUNT',
    'GOOGLE_APPLICATION_CREDENTIALS',
    'CLIENT_URL',
    'API_URL',
    'CORS_ORIGINS',
    'SENTRY_DSN',
] as const;

const originalEnv = new Map<string, string | undefined>(
    ENV_KEYS.map((key) => [key, process.env[key]])
);

const restoreEnv = () => {
    for (const key of ENV_KEYS) {
        const originalValue = originalEnv.get(key);
        if (originalValue === undefined) {
            delete process.env[key];
            continue;
        }

        process.env[key] = originalValue;
    }
};

const getCheckMap = () =>
    Object.fromEntries(
        collectProductionReadinessChecks().map((check) => [check.key, check])
    );

afterEach(() => {
    restoreEnv();
});

describe('production readiness checks', () => {
    it('flags launch blockers when critical env vars are missing', () => {
        delete process.env.AWS_ACCESS_KEY_ID;
        delete process.env.AWS_SECRET_ACCESS_KEY;
        delete process.env.AWS_BUCKET_NAME;
        delete process.env.FIREBASE_SERVICE_ACCOUNT;
        delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
        delete process.env.CLIENT_URL;
        delete process.env.API_URL;
        delete process.env.CORS_ORIGINS;
        delete process.env.SENTRY_DSN;

        const checks = getCheckMap();

        expect(checks.file_storage.ready).toBe(false);
        expect(checks.firebase_push.ready).toBe(false);
        expect(checks.public_urls.ready).toBe(false);
        expect(checks.sentry.ready).toBe(false);
    });

    it('marks S3 and Firebase as ready when the required credentials are present', () => {
        process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
        process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
        process.env.AWS_BUCKET_NAME = 'notive-uploads';
        process.env.FIREBASE_SERVICE_ACCOUNT = '{"project_id":"notive-78f98"}';

        const checks = getCheckMap();

        expect(checks.file_storage.ready).toBe(true);
        expect(checks.firebase_push.ready).toBe(true);
    });

    it('requires all public URL settings to consider origin config ready', () => {
        process.env.CLIENT_URL = 'https://notive.abbasaisolutions.com';
        process.env.API_URL = 'https://api.abbasaisolutions.com/api/v1';
        delete process.env.CORS_ORIGINS;

        expect(getCheckMap().public_urls.ready).toBe(false);

        process.env.CORS_ORIGINS = 'https://notive.abbasaisolutions.com';

        expect(getCheckMap().public_urls.ready).toBe(true);
    });
});
