import { OAuth2Client } from 'google-auth-library';

const GOOGLE_CLIENT_IDS = Array.from(
    new Set(
        [
            ...(process.env.GOOGLE_CLIENT_IDS || '').split(','),
            process.env.GOOGLE_CLIENT_ID || '',
            process.env.GOOGLE_WEB_CLIENT_ID || '',
        ]
            .map((value) => value.trim())
            .filter(Boolean)
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
