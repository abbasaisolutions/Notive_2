import { Request, Response } from 'express';
import crypto from 'crypto';
import { getRedisClient } from '../config/redis';
import {
    isSpotifyConfigured,
    getSpotifyAuthUrl,
    exchangeSpotifyCode,
    disconnectSpotify,
    getSpotifyStatus,
    syncSpotifyForDate,
} from '../services/spotify.service';

/**
 * GET /api/v1/device/spotify/status
 */
export const getSpotifyConnectionStatus = async (req: Request, res: Response) => {
    try {
        if (!isSpotifyConfigured()) {
            return res.json({ configured: false, connected: false });
        }
        const status = await getSpotifyStatus(req.userId);
        return res.json({ configured: true, ...status });
    } catch (error) {
        console.error('Spotify status error:', error);
        return res.status(500).json({ message: 'Failed to check Spotify status' });
    }
};

/**
 * GET /api/v1/device/spotify/connect
 */
export const initiateSpotifyConnect = async (req: Request, res: Response) => {
    try {
        if (!isSpotifyConfigured()) {
            return res.status(400).json({ message: 'Spotify integration is not configured' });
        }

        const redis = getRedisClient();
        const state = crypto.randomBytes(16).toString('hex');
        const stateKey = `spotify:state:${state}`;

        // Store state with 5-minute expiry
        await redis.set(stateKey, JSON.stringify({ userId: req.userId }), { EX: 5 * 60 });

        const url = getSpotifyAuthUrl(state);
        return res.json({ url });
    } catch (error) {
        console.error('Spotify connect error:', error);
        return res.status(500).json({ message: 'Failed to initiate Spotify connection' });
    }
};

/**
 * GET /api/v1/device/spotify/callback?code=...&state=...
 */
export const handleSpotifyCallback = async (req: Request, res: Response) => {
    try {
        const { code, state, error: oauthError } = req.query;

        if (oauthError) {
            return res.redirect('/profile?spotify=error');
        }

        if (typeof code !== 'string' || typeof state !== 'string') {
            return res.status(400).json({ message: 'Missing code or state' });
        }

        const redis = getRedisClient();
        const stateKey = `spotify:state:${state}`;
        const stateData = await redis.get(stateKey);

        if (!stateData) {
            return res.status(400).json({ message: 'Invalid or expired state' });
        }

        const { userId } = JSON.parse(stateData) as { userId: string };
        await redis.del(stateKey);

        const result = await exchangeSpotifyCode(userId, code);
        if (!result.success) {
            return res.redirect('/profile?spotify=error');
        }

        // Trigger initial sync
        void syncSpotifyForDate(userId).catch(() => {});

        return res.redirect('/profile?spotify=connected');
    } catch (error) {
        console.error('Spotify callback error:', error);
        return res.redirect('/profile?spotify=error');
    }
};

/**
 * POST /api/v1/device/spotify/disconnect
 */
export const handleSpotifyDisconnect = async (req: Request, res: Response) => {
    try {
        await disconnectSpotify(req.userId);
        return res.json({ ok: true });
    } catch (error) {
        console.error('Spotify disconnect error:', error);
        return res.status(500).json({ message: 'Failed to disconnect Spotify' });
    }
};

/**
 * POST /api/v1/device/spotify/sync
 */
export const triggerSpotifySync = async (req: Request, res: Response) => {
    try {
        const data = await syncSpotifyForDate(req.userId);
        return res.json({ ok: true, data });
    } catch (error) {
        console.error('Spotify sync error:', error);
        return res.status(500).json({ message: 'Failed to sync Spotify data' });
    }
};
