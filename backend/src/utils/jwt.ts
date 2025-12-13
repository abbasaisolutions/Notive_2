import jwt, { SignOptions } from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'access_secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret';
const ACCESS_EXPIRY = (process.env.ACCESS_TOKEN_EXPIRY || '15m') as string;
const REFRESH_EXPIRY = (process.env.REFRESH_TOKEN_EXPIRY || '7d') as string;

export interface TokenPayload {
    userId: string;
    email: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
    return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY } as SignOptions);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
    return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY } as SignOptions);
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
