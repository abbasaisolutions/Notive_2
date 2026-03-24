// Health Controller - Handles Google Fit connection and health data endpoints
// File: backend/src/controllers/health.controller.ts

import { Request, Response } from 'express';
import { googleFitOAuthService } from '../services/googlefit-oauth.service';
import { healthSyncService } from '../services/health-sync.service';
import { healthInsightsService } from '../services/health-insights.service';
import { buildHealthFeaturePayload, getHealthFeatureState } from '../services/health-feature.service';
import { getConfiguredClientUrl } from '../config/public-env';

const FRONTEND_URL = getConfiguredClientUrl();

const redirectToFrontendProfile = (
    res: Response,
    params: Record<string, string>,
    fallbackMessage = 'CLIENT_URL or FRONTEND_URL is required for Google Fit redirects.'
) => {
    if (!FRONTEND_URL) {
        return res.status(500).json({ message: fallbackMessage });
    }

    const query = new URLSearchParams(params).toString();
    return res.redirect(`${FRONTEND_URL}/profile?${query}`);
};

const respondWithUnavailableHealthFeature = async (res: Response, requiresConnectionFlow = false) => {
    const state = await getHealthFeatureState();
    const available = requiresConnectionFlow ? state.connectAvailable : state.available;
    if (available) {
        return null;
    }

    return res.status(503).json(buildHealthFeaturePayload(state));
};

/**
 * Get Google Fit connection status
 * GET /api/v1/health/google-fit/status
 */
export const getConnectionStatus = async (req: Request, res: Response) => {
    try {
        const state = await getHealthFeatureState();
        if (!state.available) {
            return res.json({
                connected: false,
                ...buildHealthFeaturePayload(state),
            });
        }

        // @ts-ignore
        const userId = req.userId;

        const status = await googleFitOAuthService.getConnectionStatus(userId);
        return res.json({
            ...status,
            ...buildHealthFeaturePayload(state),
        });
    } catch (error) {
        console.error('Get connection status error:', error);
        return res.status(500).json({ message: 'Failed to get connection status' });
    }
};

/**
 * Initiate Google Fit OAuth flow
 * GET /api/v1/health/google-fit/connect
 */
export const initiateConnection = async (req: Request, res: Response) => {
    try {
        const unavailableResponse = await respondWithUnavailableHealthFeature(res, true);
        if (unavailableResponse) {
            return unavailableResponse;
        }

        // @ts-ignore
        const userId = req.userId;

        const authUrl = googleFitOAuthService.generateAuthUrl(userId);
        return res.json({ authUrl });
    } catch (error) {
        console.error('Initiate connection error:', error);
        return res.status(500).json({ message: 'Failed to initiate Google Fit connection' });
    }
};

/**
 * Handle OAuth callback from Google
 * GET /api/v1/health/google-fit/callback
 */
export const handleCallback = async (req: Request, res: Response) => {
    try {
        const healthState = await getHealthFeatureState();
        if (!healthState.connectAvailable) {
            return redirectToFrontendProfile(res, {
                googlefit: 'error',
                reason: healthState.reason || 'unavailable',
            });
        }

        const { code, state, error } = req.query;

        if (error) {
            console.error('OAuth error:', error);
            return redirectToFrontendProfile(res, {
                googlefit: 'error',
                reason: String(error),
            });
        }

        if (!code || !state) {
            return redirectToFrontendProfile(res, {
                googlefit: 'error',
                reason: 'missing_params',
            });
        }

        // Parse state to get user ID
        const stateData = googleFitOAuthService.parseState(state as string);
        if (!stateData) {
            return redirectToFrontendProfile(res, {
                googlefit: 'error',
                reason: 'invalid_state',
            });
        }

        // Exchange code for tokens
        const tokens = await googleFitOAuthService.exchangeCodeForTokens(code as string);

        // Get the scopes that were granted
        const grantedScopes = tokens.scope?.split(' ') || [];

        // Store tokens securely
        await googleFitOAuthService.storeTokens(stateData.userId, tokens, grantedScopes);

        // Trigger initial sync (backfill last 7 days)
        try {
            await healthSyncService.backfillUserHealth(stateData.userId, 7);
        } catch (syncError) {
            console.error('Initial sync failed:', syncError);
            // Don't fail the connection, sync can happen later
        }

        return redirectToFrontendProfile(res, { googlefit: 'success' });
    } catch (error) {
        console.error('OAuth callback error:', error);
        return redirectToFrontendProfile(res, {
            googlefit: 'error',
            reason: 'callback_failed',
        });
    }
};

/**
 * Disconnect Google Fit
 * POST /api/v1/health/google-fit/disconnect
 */
export const disconnect = async (req: Request, res: Response) => {
    try {
        const unavailableResponse = await respondWithUnavailableHealthFeature(res);
        if (unavailableResponse) {
            return unavailableResponse;
        }

        // @ts-ignore
        const userId = req.userId;

        await googleFitOAuthService.disconnect(userId);

        return res.json({ 
            message: 'Google Fit disconnected successfully',
            connected: false,
        });
    } catch (error) {
        console.error('Disconnect error:', error);
        return res.status(500).json({ message: 'Failed to disconnect Google Fit' });
    }
};

/**
 * Get health context for a specific date
 * GET /api/v1/health/context/:date
 */
export const getHealthContext = async (req: Request, res: Response) => {
    try {
        const unavailableResponse = await respondWithUnavailableHealthFeature(res);
        if (unavailableResponse) {
            return unavailableResponse;
        }

        // @ts-ignore
        const userId = req.userId;
        const { date } = req.params;

        const parsedDate = date === 'today' 
            ? new Date() 
            : new Date(date);

        if (isNaN(parsedDate.getTime())) {
            return res.status(400).json({ message: 'Invalid date format' });
        }

        // For "today", get yesterday's complete data
        const context = date === 'today'
            ? await healthSyncService.getTodayHealthContext(userId)
            : await healthSyncService.getHealthContextForDate(userId, parsedDate);
        const signalDate = context?.date ?? parsedDate;
        const signals = context
            ? await healthInsightsService.getPromptSignals(userId, context.date)
            : [];

        return res.json({
            date: signalDate.toISOString().split('T')[0],
            context: context ? { ...context, signals } : null,
        });
    } catch (error) {
        console.error('Get health context error:', error);
        return res.status(500).json({ message: 'Failed to get health context' });
    }
};

/**
 * Get health context for a date range
 * GET /api/v1/health/context/range?start=&end=
 */
export const getHealthContextRange = async (req: Request, res: Response) => {
    try {
        const unavailableResponse = await respondWithUnavailableHealthFeature(res);
        if (unavailableResponse) {
            return unavailableResponse;
        }

        // @ts-ignore
        const userId = req.userId;
        const { start, end } = req.query;

        const startDate = new Date(start as string);
        const endDate = new Date(end as string);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({ message: 'Invalid date format' });
        }

        const contexts = await healthSyncService.getHealthContextRange(userId, startDate, endDate);

        return res.json({ contexts });
    } catch (error) {
        console.error('Get health context range error:', error);
        return res.status(500).json({ message: 'Failed to get health context range' });
    }
};

/**
 * Get health statistics
 * GET /api/v1/health/stats
 */
export const getHealthStats = async (req: Request, res: Response) => {
    try {
        const unavailableResponse = await respondWithUnavailableHealthFeature(res);
        if (unavailableResponse) {
            return unavailableResponse;
        }

        // @ts-ignore
        const userId = req.userId;
        const days = parseInt(req.query.days as string) || 30;

        const stats = await healthSyncService.getHealthStats(userId, days);

        return res.json(stats);
    } catch (error) {
        console.error('Get health stats error:', error);
        return res.status(500).json({ message: 'Failed to get health stats' });
    }
};

/**
 * Get health-mood correlations and insights
 * GET /api/v1/health/insights
 */
export const getHealthInsights = async (req: Request, res: Response) => {
    try {
        const unavailableResponse = await respondWithUnavailableHealthFeature(res);
        if (unavailableResponse) {
            return unavailableResponse;
        }

        // @ts-ignore
        const userId = req.userId;
        const days = parseInt(req.query.days as string) || 30;

        const [insights, recentInsights] = await Promise.all([
            healthInsightsService.generateHealthMoodInsights(userId, days),
            healthInsightsService.getRecentInsights(userId),
        ]);

        return res.json({
            correlations: {
                sleepMood: insights.sleepMoodCorrelation,
                activityMood: insights.activityMoodCorrelation,
            },
            patterns: insights.patterns,
            recommendations: insights.recommendations,
            recentInsights,
        });
    } catch (error) {
        console.error('Get health insights error:', error);
        return res.status(500).json({ message: 'Failed to get health insights' });
    }
};

/**
 * Get weekly summary
 * GET /api/v1/health/weekly-summary
 */
export const getWeeklySummary = async (req: Request, res: Response) => {
    try {
        const unavailableResponse = await respondWithUnavailableHealthFeature(res);
        if (unavailableResponse) {
            return unavailableResponse;
        }

        // @ts-ignore
        const userId = req.userId;

        const summary = await healthInsightsService.generateWeeklySummary(userId);

        if (!summary) {
            return res.json({
                available: false,
                message: 'Not enough data for weekly summary. Keep journaling and syncing health data!',
            });
        }

        return res.json({
            available: true,
            ...summary,
        });
    } catch (error) {
        console.error('Get weekly summary error:', error);
        return res.status(500).json({ message: 'Failed to get weekly summary' });
    }
};

/**
 * Manual sync trigger (for debugging/testing)
 * POST /api/v1/health/sync
 */
export const triggerSync = async (req: Request, res: Response) => {
    try {
        const unavailableResponse = await respondWithUnavailableHealthFeature(res, true);
        if (unavailableResponse) {
            return unavailableResponse;
        }

        // @ts-ignore
        const userId = req.userId;

        const success = await healthSyncService.syncUserHealth(userId);

        if (success) {
            return res.json({ 
                message: 'Health data synced successfully',
                synced: true,
            });
        } else {
            return res.status(400).json({
                message: 'Failed to sync. Make sure Google Fit is connected.',
                synced: false,
            });
        }
    } catch (error) {
        console.error('Trigger sync error:', error);
        return res.status(500).json({ message: 'Failed to sync health data' });
    }
};

/**
 * Backfill historical data
 * POST /api/v1/health/backfill
 */
export const backfillData = async (req: Request, res: Response) => {
    try {
        const unavailableResponse = await respondWithUnavailableHealthFeature(res, true);
        if (unavailableResponse) {
            return unavailableResponse;
        }

        // @ts-ignore
        const userId = req.userId;
        const days = Math.min(parseInt(req.body.days) || 30, 90); // Max 90 days

        const count = await healthSyncService.backfillUserHealth(userId, days);

        return res.json({
            message: `Successfully backfilled ${count} days of health data`,
            daysBackfilled: count,
        });
    } catch (error) {
        console.error('Backfill error:', error);
        return res.status(500).json({ message: 'Failed to backfill health data' });
    }
};

/**
 * Delete all health data (GDPR/privacy)
 * DELETE /api/v1/health/data
 */
export const deleteHealthData = async (req: Request, res: Response) => {
    try {
        const unavailableResponse = await respondWithUnavailableHealthFeature(res);
        if (unavailableResponse) {
            return unavailableResponse;
        }

        // @ts-ignore
        const userId = req.userId;

        // Disconnect Google Fit first
        await googleFitOAuthService.disconnect(userId);

        // Delete all health data
        await healthSyncService.deleteUserHealthData(userId);

        return res.json({
            message: 'All health data has been deleted',
            deleted: true,
        });
    } catch (error) {
        console.error('Delete health data error:', error);
        return res.status(500).json({ message: 'Failed to delete health data' });
    }
};
