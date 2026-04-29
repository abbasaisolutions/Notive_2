import { OAuth2Client } from 'google-auth-library';

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

const GOOGLE_CLIENT_IDS = Array.from(
    new Set(
        [
            ...(process.env.GOOGLE_CLIENT_IDS || '').split(','),
            process.env.GOOGLE_CLIENT_ID || '',
            process.env.GOOGLE_WEB_CLIENT_ID || '',
            process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
            process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
        ]
            .map((value) => value.trim())
            .filter(isValidGoogleClientId)
    )
);
const client = GOOGLE_CLIENT_IDS.length > 0 ? new OAuth2Client() : null;

export type VerifiedGoogleCredential = {
    googleId: string;
    email: string;
    name?: string | null;
    picture?: string | null;
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
