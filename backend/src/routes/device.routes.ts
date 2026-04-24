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
    pushDiagnostic,
} from '../controllers/push-notification.controller';
import {
    appSessionSchema,
    deviceSignalSchema,
    registerDeviceTokenSchema,
    validate,
    wellnessCheckinSchema,
} from '../utils/validation';

const router = Router();

router.use(authMiddleware);

// Generic signal endpoints
router.post('/signal', validate(deviceSignalSchema), postDeviceSignal);
router.get('/signals', getDeviceSignals);
router.get('/latest', getLatestDeviceSignals);

// Convenience endpoints
router.post('/wellness-checkin', validate(wellnessCheckinSchema), postWellnessCheckin);
router.post('/app-session', validate(appSessionSchema), postAppSession);

// Spotify integration
router.get('/spotify/status', getSpotifyConnectionStatus);
router.get('/spotify/connect', initiateSpotifyConnect);
router.get('/spotify/callback', handleSpotifyCallback);
router.post('/spotify/disconnect', handleSpotifyDisconnect);
router.post('/spotify/sync', triggerSpotifySync);

// Push notifications
router.post('/tokens', validate(registerDeviceTokenSchema), registerDeviceToken);
router.get('/tokens', getDeviceTokens);
router.delete('/tokens/:tokenId', unregisterDeviceToken);
router.post('/push-diagnostic', pushDiagnostic);

export default router;
