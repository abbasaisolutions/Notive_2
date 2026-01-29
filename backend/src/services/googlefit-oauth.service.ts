// Google Fit OAuth Service - Handles OAuth flow for Google Fit integration
// File: backend/src/services/googlefit-oauth.service.ts

import { OAuth2Client, Credentials } from 'google-auth-library';
import prisma from '../config/prisma';
import crypto from 'crypto';

// Google Fit scopes - Read-only, privacy-first
const GOOGLE_FIT_SCOPES = [
    'https://www.googleapis.com/auth/fitness.sleep.read',
    'https://www.googleapis.com/auth/fitness.activity.read',
    'https://www.googleapis.com/auth/fitness.heart_rate.read', // Optional
];

// Environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_FIT_REDIRECT_URI = process.env.GOOGLE_FIT_REDIRECT_URI || 'http://localhost:8000/api/v1/health/google-fit/callback';

// Token encryption key (should be in env)
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || 'default-32-char-encryption-key!!';
const ENCRYPTION_IV_LENGTH = 16;

/**
 * Encrypt sensitive token data
 */
function encryptToken(text: string): string {
    const iv = crypto.randomBytes(ENCRYPTION_IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypt sensitive token data
 */
function decryptToken(text: string): string {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift()!, 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

export class GoogleFitOAuthService {
    private oauth2Client: OAuth2Client;

    constructor() {
        this.oauth2Client = new OAuth2Client(
            GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET,
            GOOGLE_FIT_REDIRECT_URI
        );
    }

    /**
     * Generate OAuth URL for Google Fit authorization
     * Uses incremental authorization to extend existing Google permissions
     */
    generateAuthUrl(userId: string): string {
        // Create state parameter with user ID for security
        const state = Buffer.from(JSON.stringify({ userId, timestamp: Date.now() })).toString('base64');

        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',           // Get refresh token
            prompt: 'consent',                // Always show consent screen
            include_granted_scopes: true,     // Incremental authorization
            scope: GOOGLE_FIT_SCOPES,
            state: state,
        });
    }

    /**
     * Parse and validate the state parameter
     */
    parseState(state: string): { userId: string; timestamp: number } | null {
        try {
            const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
            // Validate timestamp (5 minute window)
            if (Date.now() - decoded.timestamp > 5 * 60 * 1000) {
                console.warn('OAuth state expired');
                return null;
            }
            return decoded;
        } catch (error) {
            console.error('Failed to parse OAuth state:', error);
            return null;
        }
    }

    /**
     * Exchange authorization code for tokens
     */
    async exchangeCodeForTokens(code: string): Promise<Credentials> {
        const { tokens } = await this.oauth2Client.getToken(code);
        return tokens;
    }

    /**
     * Store Google Fit tokens securely
     */
    async storeTokens(userId: string, tokens: Credentials, scopes: string[]): Promise<void> {
        if (!tokens.access_token || !tokens.refresh_token) {
            throw new Error('Missing required tokens');
        }

        const encryptedAccessToken = encryptToken(tokens.access_token);
        const encryptedRefreshToken = encryptToken(tokens.refresh_token);
        const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600 * 1000);

        await prisma.googleFitConnection.upsert({
            where: { userId },
            update: {
                accessToken: encryptedAccessToken,
                refreshToken: encryptedRefreshToken,
                expiresAt,
                scopes,
                updatedAt: new Date(),
            },
            create: {
                userId,
                accessToken: encryptedAccessToken,
                refreshToken: encryptedRefreshToken,
                expiresAt,
                scopes,
            },
        });
    }

    /**
     * Get valid access token for a user (refresh if needed)
     */
    async getValidAccessToken(userId: string): Promise<string | null> {
        const connection = await prisma.googleFitConnection.findUnique({
            where: { userId },
        });

        if (!connection) {
            return null;
        }

        const decryptedAccessToken = decryptToken(connection.accessToken);
        const decryptedRefreshToken = decryptToken(connection.refreshToken);

        // Check if token is expired (with 5 minute buffer)
        const isExpired = connection.expiresAt.getTime() < Date.now() + 5 * 60 * 1000;

        if (!isExpired) {
            return decryptedAccessToken;
        }

        // Refresh the token
        try {
            this.oauth2Client.setCredentials({
                refresh_token: decryptedRefreshToken,
            });

            const { credentials } = await this.oauth2Client.refreshAccessToken();

            if (!credentials.access_token) {
                throw new Error('Failed to refresh access token');
            }

            // Store updated tokens
            const encryptedAccessToken = encryptToken(credentials.access_token);
            const expiresAt = credentials.expiry_date 
                ? new Date(credentials.expiry_date) 
                : new Date(Date.now() + 3600 * 1000);

            await prisma.googleFitConnection.update({
                where: { userId },
                data: {
                    accessToken: encryptedAccessToken,
                    expiresAt,
                    updatedAt: new Date(),
                },
            });

            return credentials.access_token;
        } catch (error) {
            console.error('Failed to refresh Google Fit token:', error);
            // Token is invalid, user needs to reconnect
            return null;
        }
    }

    /**
     * Check if user has Google Fit connected
     */
    async isConnected(userId: string): Promise<boolean> {
        const connection = await prisma.googleFitConnection.findUnique({
            where: { userId },
            select: { id: true },
        });
        return !!connection;
    }

    /**
     * Get connection status with details
     */
    async getConnectionStatus(userId: string): Promise<{
        connected: boolean;
        connectedAt?: Date;
        lastSyncAt?: Date;
        scopes?: string[];
    }> {
        const connection = await prisma.googleFitConnection.findUnique({
            where: { userId },
            select: {
                connectedAt: true,
                lastSyncAt: true,
                scopes: true,
            },
        });

        if (!connection) {
            return { connected: false };
        }

        return {
            connected: true,
            connectedAt: connection.connectedAt,
            lastSyncAt: connection.lastSyncAt || undefined,
            scopes: connection.scopes,
        };
    }

    /**
     * Disconnect Google Fit (revoke and delete tokens)
     */
    async disconnect(userId: string): Promise<void> {
        const connection = await prisma.googleFitConnection.findUnique({
            where: { userId },
        });

        if (!connection) {
            return;
        }

        try {
            // Try to revoke the token with Google
            const decryptedAccessToken = decryptToken(connection.accessToken);
            await this.oauth2Client.revokeToken(decryptedAccessToken);
        } catch (error) {
            console.warn('Failed to revoke Google Fit token (may already be revoked):', error);
        }

        // Delete the connection record
        await prisma.googleFitConnection.delete({
            where: { userId },
        });

        // Optionally: Keep health data for user's records or delete based on preference
        // For privacy-first approach, we keep the data as it's the user's data
        console.log(`Google Fit disconnected for user ${userId}`);
    }

    /**
     * Update last sync timestamp
     */
    async updateLastSync(userId: string): Promise<void> {
        await prisma.googleFitConnection.update({
            where: { userId },
            data: { lastSyncAt: new Date() },
        });
    }
}

export const googleFitOAuthService = new GoogleFitOAuthService();
export default googleFitOAuthService;
