import { Request, Response } from 'express';
import { PushNotificationService } from '../services/push-notification.service';
import prisma from '../config/prisma';

const pushService = new PushNotificationService(prisma);

/**
 * Register a device token for push notifications
 * POST /api/v1/devices/tokens
 */
export async function registerDeviceToken(
    req: Request<{}, {}, {
        token: string;
        platform: 'android' | 'ios' | 'web';
        deviceId?: string;
        deviceName?: string;
        appVersion?: string;
        osVersion?: string;
    }>,
    res: Response
): Promise<void> {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { token, platform, deviceId, deviceName, appVersion, osVersion } = req.body;

        if (!token || !platform) {
            res.status(400).json({ error: 'token and platform are required' });
            return;
        }

        const result = await pushService.registerDeviceToken(userId, {
            token,
            platform,
            deviceId,
            deviceName,
            appVersion,
            osVersion,
        });

        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('Error registering device token:', error);
        res.status(500).json({ error: 'Failed to register device token' });
    }
}

/**
 * Get all device tokens for current user
 * GET /api/v1/devices/tokens
 */
export async function getDeviceTokens(
    req: Request<{}, {}, {}, { platform?: 'android' | 'ios' | 'web' }>,
    res: Response
): Promise<void> {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const platform = req.query.platform as 'android' | 'ios' | 'web' | undefined;
        const tokens = await pushService.getUserActiveTokens(userId, platform);

        res.status(200).json({
            success: true,
            data: tokens,
            count: tokens.length,
        });
    } catch (error) {
        console.error('Error fetching device tokens:', error);
        res.status(500).json({ error: 'Failed to fetch device tokens' });
    }
}

/**
 * Unregister a device token
 * DELETE /api/v1/devices/tokens/:tokenId
 */
export async function unregisterDeviceToken(
    req: Request<{ tokenId: string }>,
    res: Response
): Promise<void> {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { tokenId } = req.params;

        if (!tokenId) {
            res.status(400).json({ error: 'tokenId is required' });
            return;
        }

        await pushService.unregisterDeviceToken(userId, tokenId);

        res.status(200).json({
            success: true,
            message: 'Device token unregistered',
        });
    } catch (error) {
        console.error('Error unregistering device token:', error);
        if (error instanceof Error && error.message === 'Device token not found or unauthorized') {
            res.status(404).json({ error: 'Device token not found' });
        } else {
            res.status(500).json({ error: 'Failed to unregister device token' });
        }
    }
}
