// Health Routes - Google Fit integration and health data endpoints
// File: backend/src/routes/health.routes.ts

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
    getConnectionStatus,
    initiateConnection,
    handleCallback,
    disconnect,
    getHealthContext,
    getHealthContextRange,
    getHealthStats,
    getHealthInsights,
    getWeeklySummary,
    triggerSync,
    backfillData,
    deleteHealthData,
} from '../controllers/health.controller';

const router = Router();

// OAuth callback is public (redirected from Google)
router.get('/google-fit/callback', handleCallback);

// All other routes require authentication
router.use(authMiddleware);

// Google Fit Connection
router.get('/google-fit/status', getConnectionStatus);
router.get('/google-fit/connect', initiateConnection);
router.post('/google-fit/disconnect', disconnect);

// Health Context Data
router.get('/context/range', getHealthContextRange);
router.get('/context/:date', getHealthContext);

// Health Statistics & Insights
router.get('/stats', getHealthStats);
router.get('/insights', getHealthInsights);
router.get('/weekly-summary', getWeeklySummary);

// Sync Operations
router.post('/sync', triggerSync);
router.post('/backfill', backfillData);

// Privacy/Data Deletion
router.delete('/data', deleteHealthData);

export default router;
