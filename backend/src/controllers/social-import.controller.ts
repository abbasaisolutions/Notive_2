// Social Import Controller - OAuth callbacks and import endpoints
// File: backend/src/controllers/social-import.controller.ts

import { Request, Response } from 'express';
import socialImportService from '../services/social-import.service';
import prisma from '../config/prisma';
import { getConfiguredApiUrl, getConfiguredClientOrigin } from '../config/public-env';

class SocialImportController {
    constructor() {
        this.getAuthUrls = this.getAuthUrls.bind(this);
        this.instagramCallback = this.instagramCallback.bind(this);
        this.facebookCallback = this.facebookCallback.bind(this);
        this.getImportStatus = this.getImportStatus.bind(this);
        this.disconnectConnection = this.disconnectConnection.bind(this);
        this.getCandidates = this.getCandidates.bind(this);
        this.importBatch = this.importBatch.bind(this);
        this.importArchive = this.importArchive.bind(this);
    }

    private resolveReturnTo(rawValue: unknown): string {
        if (typeof rawValue !== 'string') return '/profile';
        const value = rawValue.trim();
        if (!value.startsWith('/') || value.startsWith('//')) return '/profile';
        return value;
    }

    private resolveClientOrigin(rawValue: unknown): string | null {
        if (typeof rawValue !== 'string') return null;
        const value = rawValue.trim();
        if (!value) return null;

        try {
            const parsed = new URL(value);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                return null;
            }
            return parsed.origin;
        } catch {
            return null;
        }
    }

    private resolveApiBaseUrl(req: Request): string {
        const forwardedProtoHeader = req.headers['x-forwarded-proto'];
        const forwardedProto = Array.isArray(forwardedProtoHeader)
            ? forwardedProtoHeader[0]
            : typeof forwardedProtoHeader === 'string'
                ? forwardedProtoHeader.split(',')[0]
                : null;
        const protocol = (forwardedProto || req.protocol || 'http').trim();
        const forwardedHostHeader = req.headers['x-forwarded-host'];
        const host = Array.isArray(forwardedHostHeader)
            ? forwardedHostHeader[0]
            : typeof forwardedHostHeader === 'string'
                ? forwardedHostHeader.split(',')[0]
                : req.get('host');

        if (!host) {
            const configuredApiUrl = getConfiguredApiUrl();
            if (configuredApiUrl) {
                return configuredApiUrl;
            }

            throw new Error('API_URL is required when the request host is unavailable.');
        }

        return `${protocol}://${host}/api/v1`;
    }

    private buildClientRedirect(clientOrigin: string, returnTo: string, params: Record<string, string>): string {
        const query = new URLSearchParams(params).toString();
        const separator = returnTo.includes('?') ? '&' : '?';
        const normalizedOrigin = clientOrigin.replace(/\/+$/, '');
        return `${normalizedOrigin}${returnTo}${separator}${query}`;
    }

    private normalizeProvider(rawProvider: unknown): 'instagram' | 'facebook' | null {
        if (typeof rawProvider !== 'string') return null;
        const normalized = rawProvider.trim().toLowerCase();
        if (normalized === 'instagram' || normalized === 'facebook') return normalized;
        return null;
    }

    private parseForceReauth(rawValue: unknown): boolean {
        if (typeof rawValue === 'boolean') return rawValue;
        if (typeof rawValue === 'number') return rawValue === 1;
        if (typeof rawValue !== 'string') return false;
        const normalized = rawValue.trim().toLowerCase();
        return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
    }

    private buildProviderAuthUrl(
        provider: 'instagram' | 'facebook',
        userId: string,
        returnTo: string,
        apiBaseUrl: string,
        clientOrigin: string | null,
        options?: { forceReauth?: boolean }
    ): { url: string | null; message: string | null; isConfigError: boolean } {
        try {
            const url = provider === 'instagram'
                ? socialImportService.getInstagramAuthUrl(userId, returnTo, {
                    ...options,
                    apiBaseUrl,
                    clientOrigin: clientOrigin || undefined,
                })
                : socialImportService.getFacebookAuthUrl(userId, returnTo, {
                    ...options,
                    apiBaseUrl,
                    clientOrigin: clientOrigin || undefined,
                });
            return { url, message: null, isConfigError: false };
        } catch (error: any) {
            const message = error?.message || `Failed to generate ${provider} auth URL`;
            return {
                url: null,
                message,
                isConfigError: /not configured/i.test(message),
            };
        }
    }

    /**
     * Get authorization URLs for social platforms
     * GET /api/v1/import/auth-urls?provider=instagram|facebook
     */
    async getAuthUrls(req: Request, res: Response) {
        const userId = req.userId;
        const returnTo = this.resolveReturnTo(req.query.returnTo);
        const provider = this.normalizeProvider(req.query.provider);
        const forceReauth = this.parseForceReauth(req.query.forceReauth);
        const clientOrigin = this.resolveClientOrigin(req.query.clientOrigin);
        const apiBaseUrl = this.resolveApiBaseUrl(req);

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (req.query.provider && !provider) {
            return res.status(400).json({ message: 'Invalid provider. Use instagram or facebook.' });
        }

        if (provider) {
            const single = this.buildProviderAuthUrl(provider, userId, returnTo, apiBaseUrl, clientOrigin, { forceReauth });
            if (single.url) {
                return res.json({
                    provider,
                    url: single.url,
                    ready: true,
                });
            }

            if (single.isConfigError) {
                return res.json({
                    provider,
                    url: null,
                    ready: false,
                    message: single.message || `Social OAuth not configured for ${provider}.`,
                });
            }

            console.error(`Get auth URL error (${provider}):`, single.message);
            return res.status(500).json({
                provider,
                url: null,
                ready: false,
                message: single.message || `Failed to generate ${provider} auth URL`,
            });
        }

        const instagram = this.buildProviderAuthUrl('instagram', userId, returnTo, apiBaseUrl, clientOrigin);
        const facebook = this.buildProviderAuthUrl('facebook', userId, returnTo, apiBaseUrl, clientOrigin);
        const urls = {
            instagram: instagram.url,
            facebook: facebook.url,
        };
        const readiness = {
            instagram: { ready: Boolean(instagram.url), message: instagram.message },
            facebook: { ready: Boolean(facebook.url), message: facebook.message },
        };
        const hasAnyReady = Boolean(instagram.url || facebook.url);
        const hasUnexpectedError = [instagram, facebook].some((item) => !item.url && !item.isConfigError);

        if (hasUnexpectedError && !hasAnyReady) {
            return res.status(500).json({
                message: 'Failed to generate social auth URLs.',
                urls,
                readiness,
            });
        }

        return res.json({
            message: hasAnyReady ? null : 'Social OAuth is not configured for available providers.',
            urls,
            readiness,
        });
    }

    /**
     * Handle Instagram OAuth callback - NOW JUST SAVES CONNECTION
     * GET /api/v1/import/callback/instagram
     */
    async instagramCallback(req: Request, res: Response) {
        const fallbackClientOrigin = getConfiguredClientOrigin();
        try {
            const { code, state, error } = req.query;
            const stateData = state ? socialImportService.decodeState(state as string) : null;
            const returnTo = this.resolveReturnTo(stateData?.returnTo);
            const clientOrigin = stateData?.clientOrigin || fallbackClientOrigin;
            const apiBaseUrl = this.resolveApiBaseUrl(req);

            if (!clientOrigin) {
                return res.status(500).json({ message: 'CLIENT_URL or FRONTEND_URL is required for social OAuth redirects.' });
            }

            if (error) {
                return res.redirect(this.buildClientRedirect(clientOrigin, returnTo, {
                    import: 'error',
                    message: String(error),
                }));
            }

            if (!code || !state) {
                return res.redirect(this.buildClientRedirect(clientOrigin, returnTo, {
                    import: 'error',
                    message: 'Missing parameters',
                }));
            }

            // Decode signed state to get userId and target provider
            if (!stateData || !stateData.userId || stateData.platform !== 'instagram') {
                return res.redirect(this.buildClientRedirect(clientOrigin, returnTo, {
                    import: 'error',
                    message: 'Invalid state',
                }));
            }

            // Exchange code for access token
            const tokenResult = await socialImportService.getInstagramAccessToken(code as string, apiBaseUrl);

            // Save connection (NEW: No longer imports immediately)
            await socialImportService.saveConnection(
                stateData.userId,
                'INSTAGRAM',
                tokenResult.accessToken,
                tokenResult.expiresIn
            );

            // Redirect back with connected status
            return res.redirect(this.buildClientRedirect(clientOrigin, returnTo, {
                import: 'connected',
                provider: 'instagram',
            }));
        } catch (error: any) {
            console.error('Instagram callback error:', error);
            if (!fallbackClientOrigin) {
                return res.status(500).json({ message: 'Instagram connection failed' });
            }
            return res.redirect(this.buildClientRedirect(fallbackClientOrigin, '/profile', {
                import: 'error',
                message: 'Instagram connection failed',
            }));
        }
    }

    /**
     * Handle Facebook OAuth callback - NOW JUST SAVES CONNECTION
     * GET /api/v1/import/callback/facebook
     */
    async facebookCallback(req: Request, res: Response) {
        const fallbackClientOrigin = getConfiguredClientOrigin();
        try {
            const { code, state, error } = req.query;
            const stateData = state ? socialImportService.decodeState(state as string) : null;
            const returnTo = this.resolveReturnTo(stateData?.returnTo);
            const clientOrigin = stateData?.clientOrigin || fallbackClientOrigin;
            const apiBaseUrl = this.resolveApiBaseUrl(req);

            if (!clientOrigin) {
                return res.status(500).json({ message: 'CLIENT_URL or FRONTEND_URL is required for social OAuth redirects.' });
            }

            if (error) {
                return res.redirect(this.buildClientRedirect(clientOrigin, returnTo, {
                    import: 'error',
                    message: String(error),
                }));
            }

            if (!code || !state) {
                return res.redirect(this.buildClientRedirect(clientOrigin, returnTo, {
                    import: 'error',
                    message: 'Missing parameters',
                }));
            }

            // Decode signed state to get userId and target provider
            if (!stateData || !stateData.userId || stateData.platform !== 'facebook') {
                return res.redirect(this.buildClientRedirect(clientOrigin, returnTo, {
                    import: 'error',
                    message: 'Invalid state',
                }));
            }

            // Exchange code for access token
            const tokenResult = await socialImportService.getFacebookAccessToken(code as string, apiBaseUrl);

            // Save connection (NEW: No longer imports immediately)
            await socialImportService.saveConnection(
                stateData.userId,
                'FACEBOOK',
                tokenResult.accessToken,
                tokenResult.expiresIn
            );

            // Redirect back with connected status
            return res.redirect(this.buildClientRedirect(clientOrigin, returnTo, {
                import: 'connected',
                provider: 'facebook',
            }));
        } catch (error: any) {
            console.error('Facebook callback error:', error);
            if (!fallbackClientOrigin) {
                return res.status(500).json({ message: 'Facebook connection failed' });
            }
            return res.redirect(this.buildClientRedirect(fallbackClientOrigin, '/profile', {
                import: 'error',
                message: 'Facebook connection failed',
            }));
        }
    }

    /**
     * Get import status/history (also returns connection status)
     * GET /api/v1/import/status
     */
    async getImportStatus(req: Request, res: Response) {
        try {
            const userId = req.userId;

            const [instagramCount, facebookCount, notiveCount, connectionSummary] = await Promise.all([
                prisma.entry.count({ where: { userId, source: 'INSTAGRAM' } }),
                prisma.entry.count({ where: { userId, source: 'FACEBOOK' } }),
                prisma.entry.count({ where: { userId, source: 'NOTIVE' } }),
                socialImportService.getConnectionSummaries(userId),
            ]);

            return res.json({
                status: 'ready',
                entryCount: {
                    instagram: instagramCount,
                    facebook: facebookCount,
                    notive: notiveCount,
                    total: instagramCount + facebookCount + notiveCount,
                },
                connections: connectionSummary,
            });
        } catch (error: any) {
            console.error('Get import status error:', error);
            return res.status(500).json({ message: 'Failed to get import status' });
        }
    }

    /**
     * Disconnect a social account
     * DELETE /api/v1/import/connections/:provider
     */
    async disconnectConnection(req: Request, res: Response) {
        try {
            const userId = req.userId;
            const provider = (req.params.provider as string | undefined)?.toUpperCase() as 'INSTAGRAM' | 'FACEBOOK';

            if (!provider || !['INSTAGRAM', 'FACEBOOK'].includes(provider)) {
                return res.status(400).json({ message: 'Invalid provider. Use instagram or facebook.' });
            }

            await socialImportService.disconnectConnection(userId, provider);
            return res.json({ message: `${provider.toLowerCase()} disconnected` });
        } catch (error: any) {
            console.error('Disconnect connection error:', error);
            return res.status(500).json({ message: 'Failed to disconnect account' });
        }
    }

    /**
     * Get candidates for selection
     * GET /api/v1/import/candidates?provider=instagram|facebook
     */
    async getCandidates(req: Request, res: Response) {
        try {
            const userId = req.userId;
            const provider = (req.query.provider as string)?.toUpperCase() as 'INSTAGRAM' | 'FACEBOOK';

            if (!provider || !['INSTAGRAM', 'FACEBOOK'].includes(provider)) {
                return res.status(400).json({ message: 'Invalid provider. Use instagram or facebook.' });
            }

            const candidates = await socialImportService.getCandidates(userId, provider);
            return res.json({ candidates });
        } catch (error: any) {
            console.error('Get candidates error:', error);
            const message = error.message || 'Failed to get candidates';
            const status = /not connected|expired|professional account|permission/i.test(message) ? 400 : 500;
            return res.status(status).json({
                message: status === 400 ? message : 'Failed to get candidates',
            });
        }
    }

    /**
     * Import selected posts in batch
     * POST /api/v1/import/batch
     * Body: { provider: 'instagram' | 'facebook', selectedIds: string[] }
     */
    async importBatch(req: Request, res: Response) {
        try {
            const userId = req.userId;
            const { provider, selectedIds } = req.body;

            const normalizedProvider = provider?.toUpperCase() as 'INSTAGRAM' | 'FACEBOOK';

            if (!normalizedProvider || !['INSTAGRAM', 'FACEBOOK'].includes(normalizedProvider)) {
                return res.status(400).json({ message: 'Invalid provider. Use instagram or facebook.' });
            }

            if (!selectedIds || !Array.isArray(selectedIds) || selectedIds.length === 0) {
                return res.status(400).json({ message: 'selectedIds must be a non-empty array.' });
            }

            const result = await socialImportService.importBatch(userId, normalizedProvider, selectedIds);
            return res.json(result);
        } catch (error: any) {
            console.error('Import batch error:', error);
            const message = error.message || 'Failed to import';
            const status = /not connected|expired|professional account|permission/i.test(message) ? 400 : 500;
            return res.status(status).json({
                message: status === 400 ? message : 'Failed to import',
            });
        }
    }

    /**
     * Import from a data archive (ZIP or JSON)
     * POST /api/v1/import/archive
     * Body (multipart): { provider: 'instagram' | 'facebook', file: <zip|json> }
     */
    async importArchive(req: Request, res: Response) {
        try {
            const userId = req.userId;
            const provider = (req.body.provider as string | undefined)?.toUpperCase() as 'INSTAGRAM' | 'FACEBOOK';

            if (!provider || !['INSTAGRAM', 'FACEBOOK'].includes(provider)) {
                return res.status(400).json({ message: 'Invalid provider. Use instagram or facebook.' });
            }

            if (!req.file) {
                return res.status(400).json({ message: 'No archive file uploaded.' });
            }

            const result = await socialImportService.importArchive(userId, provider, req.file);
            return res.json(result);
        } catch (error: any) {
            console.error('Import archive error:', error);
            return res.status(500).json({ message: 'Failed to import archive' });
        }
    }
}

export default new SocialImportController();

