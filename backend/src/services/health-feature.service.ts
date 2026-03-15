import prisma from '../config/prisma';

const DEFAULT_TOKEN_ENCRYPTION_KEY = 'default-32-char-encryption-key!!';
const HEALTH_TABLES = ['GoogleFitConnection', 'HealthContext', 'HealthInsight'] as const;
const READINESS_CACHE_TTL_MS = 30_000;

export type HealthFeatureReason =
    | 'ready'
    | 'disabled'
    | 'schema_not_ready'
    | 'oauth_not_configured';

export interface HealthFeatureState {
    available: boolean;
    connectAvailable: boolean;
    schemaReady: boolean;
    oauthConfigured: boolean;
    reason: HealthFeatureReason;
    message?: string;
}

let cachedState: { value: HealthFeatureState; expiresAt: number } | null = null;

const isHealthFeatureEnabled = () => process.env.HEALTH_FEATURE_ENABLED !== 'false';

const hasGoogleFitOAuthConfig = () => {
    const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
    const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
    const encryptionKey = (process.env.TOKEN_ENCRYPTION_KEY || '').trim();

    return Boolean(
        clientId
        && clientSecret
        && encryptionKey
        && encryptionKey !== DEFAULT_TOKEN_ENCRYPTION_KEY
    );
};

const buildHealthFeatureState = (schemaReady: boolean): HealthFeatureState => {
    const enabled = isHealthFeatureEnabled();
    const oauthConfigured = hasGoogleFitOAuthConfig();

    if (!enabled) {
        return {
            available: false,
            connectAvailable: false,
            schemaReady,
            oauthConfigured,
            reason: 'disabled',
            message: 'Health features are disabled for this environment.',
        };
    }

    if (!schemaReady) {
        return {
            available: false,
            connectAvailable: false,
            schemaReady: false,
            oauthConfigured,
            reason: 'schema_not_ready',
            message: 'Health features are not ready in this environment yet.',
        };
    }

    if (!oauthConfigured) {
        return {
            available: true,
            connectAvailable: false,
            schemaReady: true,
            oauthConfigured: false,
            reason: 'oauth_not_configured',
            message: 'Google Fit connection is not configured in this environment yet.',
        };
    }

    return {
        available: true,
        connectAvailable: true,
        schemaReady: true,
        oauthConfigured: true,
        reason: 'ready',
    };
};

const isMissingRelationError = (error: unknown) => {
    const code = typeof error === 'object' && error !== null ? String((error as { code?: unknown }).code || '') : '';
    const message = typeof error === 'object' && error !== null ? String((error as { message?: unknown }).message || '') : '';

    return code === 'P2021'
        || message.includes('does not exist')
        || message.includes('relation')
        || message.includes('table');
};

const checkSchemaReady = async () => {
    for (const table of HEALTH_TABLES) {
        try {
            await prisma.$queryRawUnsafe(`SELECT 1 FROM "${table}" LIMIT 1`);
        } catch (error) {
            if (isMissingRelationError(error)) {
                return false;
            }
            throw error;
        }
    }

    return true;
};

export const getHealthFeatureState = async (forceRefresh = false): Promise<HealthFeatureState> => {
    const now = Date.now();
    if (!forceRefresh && cachedState && cachedState.expiresAt > now) {
        return cachedState.value;
    }

    let schemaReady = false;
    try {
        schemaReady = await checkSchemaReady();
    } catch (error) {
        console.warn('Health feature readiness check failed:', error);
    }

    const value = buildHealthFeatureState(schemaReady);
    cachedState = {
        value,
        expiresAt: now + READINESS_CACHE_TTL_MS,
    };

    return value;
};

export const invalidateHealthFeatureState = () => {
    cachedState = null;
};

export const buildHealthFeaturePayload = (state: HealthFeatureState) => ({
    available: state.available,
    connectAvailable: state.connectAvailable,
    schemaReady: state.schemaReady,
    configured: state.oauthConfigured,
    reason: state.reason,
    message: state.message,
});
