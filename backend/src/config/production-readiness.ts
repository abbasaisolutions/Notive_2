import { serverLogger } from '../utils/server-logger';

export type ProductionReadinessCheck = {
    key: 'file_storage' | 'firebase_push' | 'public_urls' | 'sentry';
    severity: 'required' | 'recommended';
    ready: boolean;
    message: string;
    action: string;
};

const hasEnv = (name: string) => {
    const value = process.env[name];
    return typeof value === 'string' && value.trim().length > 0;
};

export const collectProductionReadinessChecks = (): ProductionReadinessCheck[] => {
    const hasS3Storage =
        hasEnv('AWS_ACCESS_KEY_ID')
        && hasEnv('AWS_SECRET_ACCESS_KEY')
        && hasEnv('AWS_BUCKET_NAME');
    const hasFirebaseAdmin = hasEnv('FIREBASE_SERVICE_ACCOUNT') || hasEnv('GOOGLE_APPLICATION_CREDENTIALS');
    const hasPublicUrls = hasEnv('CLIENT_URL') && hasEnv('API_URL') && hasEnv('CORS_ORIGINS');

    return [
        {
            key: 'file_storage',
            severity: 'required',
            ready: hasS3Storage,
            message: hasS3Storage
                ? 'Persistent object storage is configured for uploads.'
                : 'S3 upload storage is not configured. Avatars and entry images will fall back to local disk and can disappear after a Railway redeploy.',
            action: 'Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_BUCKET_NAME, and optionally AWS_REGION.',
        },
        {
            key: 'firebase_push',
            severity: 'required',
            ready: hasFirebaseAdmin,
            message: hasFirebaseAdmin
                ? 'Firebase Admin credentials are configured for real push delivery.'
                : 'Firebase Admin credentials are missing. Push notifications will fall back to mock logging instead of real FCM delivery.',
            action: 'Set FIREBASE_SERVICE_ACCOUNT as a minified JSON string, or set GOOGLE_APPLICATION_CREDENTIALS.',
        },
        {
            key: 'public_urls',
            severity: 'required',
            ready: hasPublicUrls,
            message: hasPublicUrls
                ? 'Production frontend/backend origin configuration is present.'
                : 'Public origin configuration is incomplete. Auth cookies, redirects, or CORS can fail in production.',
            action: 'Set CLIENT_URL, API_URL, and CORS_ORIGINS to the production frontend/backend origins.',
        },
        {
            key: 'sentry',
            severity: 'recommended',
            ready: hasEnv('SENTRY_DSN'),
            message: hasEnv('SENTRY_DSN')
                ? 'Sentry is configured for backend error reporting.'
                : 'Sentry is not configured. Production errors will be harder to triage after launch.',
            action: 'Set SENTRY_DSN for backend error tracking before broad rollout.',
        },
    ];
};

export const logProductionReadinessChecks = () => {
    if (process.env.NODE_ENV !== 'production') return;

    for (const check of collectProductionReadinessChecks()) {
        const payload = {
            key: check.key,
            severity: check.severity,
            status: check.ready ? 'ready' : 'action_required',
            message: check.message,
            action: check.action,
        };

        if (check.ready) {
            serverLogger.info('startup.readiness', payload);
            continue;
        }

        serverLogger.warn('startup.readiness', payload);
    }
};
