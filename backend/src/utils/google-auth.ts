import { OAuth2Client } from 'google-auth-library';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const client = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

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
    if (!GOOGLE_CLIENT_ID || !client) {
        throw new Error('Google SSO is not configured');
    }

    const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
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
