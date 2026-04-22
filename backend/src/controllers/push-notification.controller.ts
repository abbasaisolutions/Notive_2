import { Request, Response } from 'express';
import { PushNotificationService } from '../services/push-notification.service';
import prisma from '../config/prisma';
import { serverLogger } from '../utils/server-logger';

const pushService = new PushNotificationService(prisma);

const previewPushToken = (token: string) => {
    const trimmed = token.trim();
    if (trimmed.length <= 18) return trimmed;
    return `${trimmed.slice(0, 10)}...${trimmed.slice(-6)}`;
};

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
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const { token, platform, deviceId, deviceName, appVersion, osVersion } = req.body;

        if (!token || !platform) {
            res.status(400).json({ message: 'token and platform are required' });
            return;
        }

        serverLogger.info('push.device_token_register_requested', {
            requestId: res.locals.requestId,
            userId,
            platform,
            tokenPreview: previewPushToken(token),
            deviceId: deviceId || undefined,
            deviceName: deviceName || undefined,
            appVersion: appVersion || undefined,
            osVersion: osVersion || undefined,
            userAgent: req.get('user-agent') || undefined,
        });

        const result = await pushService.registerDeviceToken(userId, {
            token,
            platform,
            deviceId,
            deviceName,
            appVersion,
            osVersion,
        });

        serverLogger.info('push.device_token_register_succeeded', {
            requestId: res.locals.requestId,
            userId,
            deviceTokenId: result.id,
            platform: result.platform,
            tokenPreview: previewPushToken(token),
        });

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error registering device token:', error);
        serverLogger.error('push.device_token_register_failed', {
            requestId: res.locals.requestId,
            userId: req.userId || undefined,
            platform: typeof req.body?.platform === 'string' ? req.body.platform : undefined,
            tokenPreview: typeof req.body?.token === 'string' ? previewPushToken(req.body.token) : undefined,
            message: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ message: 'Failed to register device token' });
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
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const platform = req.query.platform as 'android' | 'ios' | 'web' | undefined;
        const tokens = await pushService.getUserActiveTokens(userId, platform);

        res.status(200).json({ success: true, data: tokens, count: tokens.length });
    } catch (error) {
        console.error('Error fetching device tokens:', error);
        res.status(500).json({ message: 'Failed to fetch device tokens' });
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
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const { tokenId } = req.params;

        if (!tokenId) {
            res.status(400).json({ message: 'tokenId is required' });
            return;
        }

        await pushService.unregisterDeviceToken(userId, tokenId);

        res.status(200).json({ success: true, message: 'Device token unregistered' });
    } catch (error) {
        console.error('Error unregistering device token:', error);
        if (error instanceof Error && error.message === 'Device token not found or unauthorized') {
            res.status(404).json({ message: 'Device token not found' });
        } else {
            res.status(500).json({ message: 'Failed to unregister device token' });
        }
    }
}
