import jwt, { SignOptions } from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRY = (process.env.ACCESS_TOKEN_EXPIRY || '15m') as string;
const REFRESH_EXPIRY = (process.env.REFRESH_TOKEN_EXPIRY || '7d') as string;

if (!ACCESS_SECRET || !REFRESH_SECRET) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be configured');
}

export interface TokenPayload {
    userId: string;
    email: string;
}

export interface SensitiveActionTokenPayload extends TokenPayload {
    purpose: 'sensitive-action';
}

const SENSITIVE_ACTION_EXPIRY = (process.env.SENSITIVE_ACTION_TOKEN_EXPIRY || '10m') as string;

export const generateAccessToken = (payload: TokenPayload): string => {
    return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY } as SignOptions);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
    return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY } as SignOptions);
};

export const generateSensitiveActionToken = (payload: TokenPayload): string => {
    return jwt.sign(
        {
            ...payload,
            purpose: 'sensitive-action',
        },
        ACCESS_SECRET,
        { expiresIn: SENSITIVE_ACTION_EXPIRY } as SignOptions
    );
};

export const verifyAccessToken = (token: string): TokenPayload | null => {
    try {
        return jwt.verify(token, ACCESS_SECRET) as TokenPayload;
    } catch (error) {
        return null;
    }
};

export const verifyRefreshToken = (token: string): TokenPayload | null => {
    try {
        return jwt.verify(token, REFRESH_SECRET) as TokenPayload;
    } catch (error) {
        return null;
    }
};

export const verifySensitiveActionToken = (token: string): SensitiveActionTokenPayload | null => {
    try {
        const payload = jwt.verify(token, ACCESS_SECRET) as SensitiveActionTokenPayload;
        if (payload.purpose !== 'sensitive-action') {
            return null;
        }
        return payload;
    } catch (error) {
        return null;
    }
};
