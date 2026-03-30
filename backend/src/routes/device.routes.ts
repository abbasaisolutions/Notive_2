import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
    postDeviceSignal,
    getDeviceSignals,
    getLatestDeviceSignals,
    postWellnessCheckin,
    postAppSession,
} from '../controllers/device-signal.controller';
import {
    getSpotifyConnectionStatus,
    initiateSpotifyConnect,
    handleSpotifyCallback,
    handleSpotifyDisconnect,
    triggerSpotifySync,
} from '../controllers/spotify.controller';
import {
    registerDeviceToken,
    getDeviceTokens,
    unregisterDeviceToken,
} from '../controllers/push-notification.controller';

const router = Router();

router.use(authMiddleware);

// Generic signal endpoints
router.post('/signal', postDeviceSignal);
router.get('/signals', getDeviceSignals);
router.get('/latest', getLatestDeviceSignals);

// Convenience endpoints
router.post('/wellness-checkin', postWellnessCheckin);
router.post('/app-session', postAppSession);

// Spotify integration
router.get('/spotify/status', getSpotifyConnectionStatus);
router.get('/spotify/connect', initiateSpotifyConnect);
router.get('/spotify/callback', handleSpotifyCallback);
router.post('/spotify/disconnect', handleSpotifyDisconnect);
router.post('/spotify/sync', triggerSpotifySync);

// Push notifications
router.post('/tokens', registerDeviceToken);
router.get('/tokens', getDeviceTokens);
router.delete('/tokens/:tokenId', unregisterDeviceToken);

export default router;
