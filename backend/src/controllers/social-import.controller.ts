// Social Import Controller - OAuth callbacks and import endpoints
// File: backend/src/controllers/social-import.controller.ts

import { Request, Response } from 'express';
import socialImportService from '../services/social-import.service';
import prisma from '../config/prisma';

class SocialImportController {
    /**
     * Get authorization URLs for social platforms
     * GET /api/v1/import/auth-urls
     */
    async getAuthUrls(req: Request, res: Response) {
        try {
            // @ts-ignore
            const userId = req.userId;

            const urls = {
                instagram: socialImportService.getInstagramAuthUrl(userId),
                facebook: socialImportService.getFacebookAuthUrl(userId),
            };

            return res.json({ urls });
        } catch (error: any) {
            console.error('Get auth URLs error:', error);
            return res.status(500).json({ message: 'Failed to generate auth URLs' });
        }
    }

    /**
     * Handle Instagram OAuth callback - NOW JUST SAVES CONNECTION
     * GET /api/v1/import/callback/instagram
     */
    async instagramCallback(req: Request, res: Response) {
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
        try {
            const { code, state, error } = req.query;

            if (error) {
                return res.redirect(`${clientUrl}/profile?import=error&message=${encodeURIComponent(error as string)}`);
            }

            if (!code || !state) {
                return res.redirect(`${clientUrl}/profile?import=error&message=Missing+parameters`);
            }

            // Decode state to get userId
            const stateData = socialImportService.decodeState(state as string);
            if (!stateData || !stateData.userId) {
                return res.redirect(`${clientUrl}/profile?import=error&message=Invalid+state`);
            }

            // Exchange code for access token
            const accessToken = await socialImportService.getInstagramAccessToken(code as string);

            // Save connection (NEW: No longer imports immediately)
            await socialImportService.saveConnection(stateData.userId, 'INSTAGRAM', accessToken);

            // Redirect back with connected status
            return res.redirect(`${clientUrl}/profile?import=connected&provider=instagram`);
        } catch (error: any) {
            console.error('Instagram callback error:', error);
            return res.redirect(`${clientUrl}/profile?import=error&message=${encodeURIComponent(error.message)}`);
        }
    }

    /**
     * Handle Facebook OAuth callback - NOW JUST SAVES CONNECTION
     * GET /api/v1/import/callback/facebook
     */
    async facebookCallback(req: Request, res: Response) {
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
        try {
            const { code, state, error } = req.query;

            if (error) {
                return res.redirect(`${clientUrl}/profile?import=error&message=${encodeURIComponent(error as string)}`);
            }

            if (!code || !state) {
                return res.redirect(`${clientUrl}/profile?import=error&message=Missing+parameters`);
            }

            // Decode state to get userId
            const stateData = socialImportService.decodeState(state as string);
            if (!stateData || !stateData.userId) {
                return res.redirect(`${clientUrl}/profile?import=error&message=Invalid+state`);
            }

            // Exchange code for access token
            const accessToken = await socialImportService.getFacebookAccessToken(code as string);

            // Save connection (NEW: No longer imports immediately)
            await socialImportService.saveConnection(stateData.userId, 'FACEBOOK', accessToken);

            // Redirect back with connected status
            return res.redirect(`${clientUrl}/profile?import=connected&provider=facebook`);
        } catch (error: any) {
            console.error('Facebook callback error:', error);
            return res.redirect(`${clientUrl}/profile?import=error&message=${encodeURIComponent(error.message)}`);
        }
    }

    /**
     * Get import status/history (also returns connection status)
     * GET /api/v1/import/status
     */
    async getImportStatus(req: Request, res: Response) {
        try {
            // @ts-ignore
            const userId = req.userId;

            // Get counts by source
            const [instagramCount, facebookCount, notiveCount, connections] = await Promise.all([
                prisma.entry.count({ where: { userId, source: 'INSTAGRAM' } }),
                prisma.entry.count({ where: { userId, source: 'FACEBOOK' } }),
                prisma.entry.count({ where: { userId, source: 'NOTIVE' } }),
                prisma.socialConnection.findMany({
                    where: { userId },
                    select: { provider: true, createdAt: true }
                })
            ]);

            const connectedProviders = connections.reduce((acc, c) => {
                acc[c.provider.toLowerCase()] = true;
                return acc;
            }, {} as Record<string, boolean>);

            return res.json({
                status: 'ready',
                entryCount: {
                    instagram: instagramCount,
                    facebook: facebookCount,
                    notive: notiveCount,
                    total: instagramCount + facebookCount + notiveCount,
                },
                connections: connectedProviders
            });
        } catch (error: any) {
            console.error('Get import status error:', error);
            return res.status(500).json({ message: 'Failed to get import status' });
        }
    }

    /**
     * Get candidates for selection
     * GET /api/v1/import/candidates?provider=instagram|facebook
     */
    async getCandidates(req: Request, res: Response) {
        try {
            // @ts-ignore
            const userId = req.userId;
            const provider = (req.query.provider as string)?.toUpperCase() as 'INSTAGRAM' | 'FACEBOOK';

            if (!provider || !['INSTAGRAM', 'FACEBOOK'].includes(provider)) {
                return res.status(400).json({ message: 'Invalid provider. Use instagram or facebook.' });
            }

            const candidates = await socialImportService.getCandidates(userId, provider);
            return res.json({ candidates });
        } catch (error: any) {
            console.error('Get candidates error:', error);
            return res.status(500).json({ message: error.message || 'Failed to get candidates' });
        }
    }

    /**
     * Import selected posts in batch
     * POST /api/v1/import/batch
     * Body: { provider: 'instagram' | 'facebook', selectedIds: string[] }
     */
    async importBatch(req: Request, res: Response) {
        try {
            // @ts-ignore
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
            return res.status(500).json({ message: error.message || 'Failed to import' });
        }
    }
}

export default new SocialImportController();
