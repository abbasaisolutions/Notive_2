import { PrismaClient, User } from '@prisma/client';

interface PushNotificationPayload {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    sound?: string;
    data?: Record<string, string>;
    notificationId?: string;
}

interface DeviceTokenInput {
    token: string;
    platform: 'android' | 'ios' | 'web';
    deviceId?: string;
    deviceName?: string;
    appVersion?: string;
    osVersion?: string;
}

/**
 * Service to handle push notifications
 * Manages device tokens and push notification delivery
 */
export class PushNotificationService {
    constructor(private prisma: PrismaClient) {}

    /**
     * Register a device token for a user
     * Updates lastUsedAt if token already exists
     */
    async registerDeviceToken(
        userId: string,
        input: DeviceTokenInput
    ): Promise<{ id: string; token: string; platform: string; createdAt: Date }> {
        const deviceToken = await this.prisma.deviceToken.upsert({
            where: {
                userId_token: {
                    userId,
                    token: input.token,
                },
            },
            update: {
                isActive: true,
                lastUsedAt: new Date(),
                deviceId: input.deviceId,
                deviceName: input.deviceName,
                appVersion: input.appVersion,
                osVersion: input.osVersion,
            },
            create: {
                userId,
                token: input.token,
                platform: input.platform,
                deviceId: input.deviceId,
                deviceName: input.deviceName,
                appVersion: input.appVersion,
                osVersion: input.osVersion,
                isActive: true,
            },
        });

        return {
            id: deviceToken.id,
            token: deviceToken.token,
            platform: deviceToken.platform,
            createdAt: deviceToken.createdAt,
        };
    }

    /**
     * Unregister a device token
     */
    async unregisterDeviceToken(userId: string, tokenId: string): Promise<void> {
        const token = await this.prisma.deviceToken.findUnique({
            where: { id: tokenId },
        });

        if (!token || token.userId !== userId) {
            throw new Error('Device token not found or unauthorized');
        }

        await this.prisma.deviceToken.delete({
            where: { id: tokenId },
        });
    }

    /**
     * Get all active device tokens for a user
     */
    async getUserActiveTokens(userId: string, platform?: 'android' | 'ios' | 'web') {
        const where: any = {
            userId,
            isActive: true,
        };

        if (platform) {
            where.platform = platform;
        }

        return await this.prisma.deviceToken.findMany({
            where,
            select: {
                id: true,
                token: true,
                platform: true,
                deviceName: true,
                appVersion: true,
                osVersion: true,
                lastUsedAt: true,
            },
        });
    }

    /**
     * Mark a device token as inactive
     */
    async markTokenInactive(tokenId: string): Promise<void> {
        await this.prisma.deviceToken.update({
            where: { id: tokenId },
            data: { isActive: false },
        });
    }

    /**
     * Send push notification to a user's devices
     * In production, this would integrate with Firebase Cloud Messaging (FCM)
     * or Apple Push Notification (APN)
     */
    async sendPushNotification(
        userId: string,
        payload: PushNotificationPayload,
        platform?: 'android' | 'ios'
    ): Promise<{
        sent: number;
        failed: number;
        failedTokens: string[];
    }> {
        const tokens = await this.getUserActiveTokens(userId, platform);

        if (tokens.length === 0) {
            return {
                sent: 0,
                failed: 0,
                failedTokens: [],
            };
        }

        let sent = 0;
        let failed = 0;
        const failedTokens: string[] = [];

        for (const deviceToken of tokens) {
            try {
                // In production, would call FCM API or APN
                // For now, mock the notification sending
                await this.mockSendToDevice(deviceToken.token, deviceToken.platform, payload);
                sent++;

                // Update lastUsedAt
                await this.prisma.deviceToken.update({
                    where: { id: deviceToken.id },
                    data: { lastUsedAt: new Date() },
                });
            } catch (error) {
                failed++;
                failedTokens.push(deviceToken.id);

                // In production, would mark token as inactive after repeated failures
                console.error(`Failed to send push to token ${deviceToken.id}:`, error);
            }
        }

        return {
            sent,
            failed,
            failedTokens,
        };
    }

    /**
     * Mock push notification sending
     * Replace with actual FCM/APN integration in production
     */
    private async mockSendToDevice(
        token: string,
        platform: string,
        payload: PushNotificationPayload
    ): Promise<void> {
        console.log('---------------------------------------------------------');
        console.log(`[Push Notification] Sending to ${platform.toUpperCase()}`);
        console.log(`Token: ${token.substring(0, 20)}...`);
        console.log(`Title: ${payload.title}`);
        console.log(`Body: ${payload.body}`);
        if (payload.data) {
            console.log(`Data:`, payload.data);
        }
        console.log('---------------------------------------------------------');

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    /**
     * Cleanup inactive tokens older than 30 days
     */
    async cleanupInactiveTokens(daysThreshold: number = 30): Promise<{ deletedCount: number }> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

        const result = await this.prisma.deviceToken.deleteMany({
            where: {
                isActive: false,
                lastUsedAt: {
                    lt: cutoffDate,
                },
            },
        });

        return {
            deletedCount: result.count,
        };
    }
}
