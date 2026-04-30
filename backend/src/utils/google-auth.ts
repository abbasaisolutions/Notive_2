import { OAuth2Client } from 'google-auth-library';
import { BUNDLED_GOOGLE_CLIENT_IDS } from '../config/google-oauth-clients';

const PLACEHOLDER_CLIENT_IDS = new Set([
    'your-google-client-id',
    'your_google_client_id_here.apps.googleusercontent.com',
    'your_google_web_client_id_here.apps.googleusercontent.com',
    'your-google-client-id-here',
    'your-google-client-id-here.apps.googleusercontent.com',
    'your-actual-client-id',
]);

const isValidGoogleClientId = (value: string): boolean =>
    /\.apps\.googleusercontent\.com$/i.test(value)
    && !PLACEHOLDER_CLIENT_IDS.has(value.toLowerCase());

const splitClientIds = (value?: string): string[] =>
    (value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

const shouldUseBundledClientIds = () =>
    (process.env.GOOGLE_INCLUDE_BUNDLED_CLIENT_IDS || '').trim().toLowerCase() !== 'false';

export const resolveGoogleClientIds = (): string[] => Array.from(
    new Set(
        [
            ...splitClientIds(process.env.GOOGLE_CLIENT_IDS),
            ...splitClientIds(process.env.GOOGLE_ANDROID_CLIENT_IDS),
            ...splitClientIds(process.env.GOOGLE_IOS_CLIENT_IDS),
            ...splitClientIds(process.env.GOOGLE_CLIENT_ID),
            ...splitClientIds(process.env.GOOGLE_WEB_CLIENT_ID),
            ...splitClientIds(process.env.GOOGLE_ANDROID_CLIENT_ID),
            ...splitClientIds(process.env.GOOGLE_IOS_CLIENT_ID),
            ...splitClientIds(process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID),
            ...splitClientIds(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID),
            ...splitClientIds(process.env.NEXT_PUBLIC_GOOGLE_ANDROID_SERVER_CLIENT_ID),
            ...(shouldUseBundledClientIds() ? BUNDLED_GOOGLE_CLIENT_IDS : []),
        ]
            .map((value) => value.trim())
            .filter(isValidGoogleClientId)
    )
);

const GOOGLE_CLIENT_IDS = resolveGoogleClientIds();
const client = GOOGLE_CLIENT_IDS.length > 0 ? new OAuth2Client() : null;

export type VerifiedGoogleCredential = {
    googleId: string;
    email: string;
    name?: string | null;
    picture?: string | null;
};

const decodeJwtPayload = (credential: string): Record<string, unknown> | null => {
    const payload = credential.split('.')[1];
    if (!payload) {
        return null;
    }

    try {
        return JSON.parse(
            Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
        ) as Record<string, unknown>;
    } catch {
        return null;
    }
};

const getCredentialAudiences = (credential: string): string[] => {
    const audience = decodeJwtPayload(credential)?.aud;
    if (typeof audience === 'string') {
        return [audience];
    }
    if (Array.isArray(audience)) {
        return audience.filter((item): item is string => typeof item === 'string');
    }
    return [];
};

const maskGoogleClientId = (value: string): string => {
    const match = value.match(/^(\d+)-([^.]+)\.apps\.googleusercontent\.com$/i);
    if (match) {
        const [, projectNumber, clientSlug] = match;
        return `${projectNumber}-${clientSlug.slice(0, 8)}...${clientSlug.slice(-6)}.apps.googleusercontent.com`;
    }

    if (value.length <= 24) {
        return value;
    }

    return `${value.slice(0, 12)}...${value.slice(-12)}`;
};

const normalizeGoogleVerificationError = (error: unknown, credential: string): Error => {
    const message = error instanceof Error ? error.message : String(error || '');
    if (!/audience|wrong recipient/i.test(message)) {
        return error instanceof Error ? error : new Error(message || 'Google credential verification failed');
    }

    const audiences = getCredentialAudiences(credential).map(maskGoogleClientId);
    const audienceText = audiences.length > 0
        ? ` Token audience: ${audiences.join(', ')}.`
        : '';

    return new Error(
        `Google token audience is not configured for this backend.${audienceText} Add the missing OAuth client ID to GOOGLE_CLIENT_IDS.`
    );
};

export const verifyGoogleCredential = async (credential: string): Promise<VerifiedGoogleCredential> => {
    if (!credential) {
        throw new Error('Google credential is required');
    }
    if (GOOGLE_CLIENT_IDS.length === 0 || !client) {
        throw new Error('Google SSO is not configured');
    }

    const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_IDS,
    }).catch((error) => {
        throw normalizeGoogleVerificationError(error, credential);
    });

    const payload = ticket.getPayload();
    if (!payload) {
        throw new Error('Invalid Google token');
    }

    const { sub: googleId, email, name, picture } = payload;
    if (!email) {
        throw new Error('Email not provided by Google');
    }

    return {
        googleId,
        email,
        name: name || null,
        picture: picture || null,
    };
};
