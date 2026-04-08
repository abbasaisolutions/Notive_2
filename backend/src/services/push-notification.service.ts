import { PrismaClient } from '@prisma/client';
import { initializeApp, getApps, App, cert, applicationDefault } from 'firebase-admin/app';
import { getMessaging, Message } from 'firebase-admin/messaging';

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

// ── Firebase Admin Initialization ────────────────────────────────────────────
// Initializes once on first use. No-ops when credentials are absent so
// development still works without a service account file.

let _firebaseApp: App | null = null;

function getFirebaseApp(): App | null {
    if (_firebaseApp) return _firebaseApp;

    // Already initialized by another module (e.g. in tests)
    if (getApps().length > 0) {
        _firebaseApp = getApps()[0]!;
        return _firebaseApp;
    }

    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    const credentialFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    try {
        if (serviceAccountJson) {
            const serviceAccount = JSON.parse(serviceAccountJson);
            _firebaseApp = initializeApp({ credential: cert(serviceAccount) });
        } else if (credentialFile) {
            _firebaseApp = initializeApp({ credential: applicationDefault() });
        } else {
            return null;
        }
        return _firebaseApp;
    } catch (err) {
        console.error('[PushNotificationService] Firebase Admin init failed:', err);
        return null;
    }
}

/**
 * FCM error codes that mean the token is permanently invalid and should be
 * deactivated automatically.
 */
const DEAD_TOKEN_CODES = new Set([
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
    'messaging/invalid-argument',
]);

/**
 * Service to handle push notifications via Firebase Cloud Messaging (FCM).
 * Falls back to a console mock when Firebase credentials are not configured.
 */
export class PushNotificationService {
    constructor(private prisma: PrismaClient) {}

    /**
     * Register a device token for a user.
     * Updates lastUsedAt if the token already exists.
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
     * Unregister a device token.
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
     * Get all active device tokens for a user.
     */
    async getUserActiveTokens(userId: string, platform?: 'android' | 'ios' | 'web') {
        return this.prisma.deviceToken.findMany({
            where: {
                userId,
                isActive: true,
                ...(platform ? { platform } : {}),
            },
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
     * Mark a device token as inactive.
     */
    async markTokenInactive(tokenId: string): Promise<void> {
        await this.prisma.deviceToken.update({
            where: { id: tokenId },
            data: { isActive: false },
        });
    }

    /**
     * Send a push notification to all active devices for a user.
     * Uses FCM when Firebase credentials are configured; logs to console otherwise.
     */
    async sendPushNotification(
        userId: string,
        payload: PushNotificationPayload,
        platform?: 'android' | 'ios'
    ): Promise<{ sent: number; failed: number; failedTokens: string[] }> {
        const tokens = await this.getUserActiveTokens(userId, platform);

        if (tokens.length === 0) {
            return { sent: 0, failed: 0, failedTokens: [] };
        }

        const app = getFirebaseApp();
        let sent = 0;
        let failed = 0;
        const failedTokens: string[] = [];

        for (const deviceToken of tokens) {
            try {
                if (app) {
                    await this.sendViaFcm(app, deviceToken.token, payload);
                } else {
                    this.logMockSend(deviceToken.token, deviceToken.platform, payload);
                }

                sent++;
                await this.prisma.deviceToken.update({
                    where: { id: deviceToken.id },
                    data: { lastUsedAt: new Date() },
                });
            } catch (error: any) {
                failed++;
                failedTokens.push(deviceToken.id);

                const errorCode: string = error?.errorInfo?.code ?? error?.code ?? '';
                if (DEAD_TOKEN_CODES.has(errorCode)) {
                    await this.markTokenInactive(deviceToken.id).catch(() => {});
                }

                console.error(`[PushNotificationService] Failed to send to token ${deviceToken.id}:`, error);
            }
        }

        return { sent, failed, failedTokens };
    }

    /** Send a single message via Firebase Cloud Messaging. */
    private async sendViaFcm(app: App, token: string, payload: PushNotificationPayload): Promise<void> {
        const message: Message = {
            token,
            // NOTE: We use data-only + platform notification blocks so we have
            // full control over how the notification renders on each OS.
            // The `notification` top-level field is intentionally included so
            // FCM shows the heads-up banner when the app is killed/background.
            notification: {
                title: payload.title,
                body: payload.body,
            },
            data: payload.data ?? {},
            android: {
                // high priority wakes the device for heads-up display (like WhatsApp)
                priority: 'high',
                notification: {
                    // ── Icon & colour ────────────────────────────────
                    icon: 'ic_stat_notive',           // monochrome status-bar icon
                    color: '#8A9A6F',                 // sage-green accent (brand)
                    // ── Channel ──────────────────────────────────────
                    channelId: payload.data?.type === 'reminder'
                        ? 'notive_reminders'
                        : 'notive_default',
                    // ── Sound & vibration ────────────────────────────
                    sound: payload.sound ?? 'default',
                    defaultVibrateTimings: true,
                    // ── Visibility ───────────────────────────────────
                    // PUBLIC so title+body show on lock screen (like WhatsApp).
                    visibility: 'public',
                    // ── Behaviour ────────────────────────────────────
                    // Tag collapses multiple reminder notifications into one,
                    // preventing a stack of stale reminders.
                    tag: payload.data?.type ?? 'notive',
                    // Ticker text shown briefly in the status bar on older devices
                    ticker: payload.title,
                    // Notification priority within the shade (MAX = heads-up pop)
                    priority: 'max',
                },
            },
            apns: {
                headers: {
                    'apns-priority': '10',            // immediate delivery
                },
                payload: {
                    aps: {
                        sound: payload.sound ?? 'default',
                        badge: payload.badge ? Number(payload.badge) : undefined,
                        // Show notification on lock screen and as banner
                        'mutable-content': 1,
                    },
                },
            },
        };

        await getMessaging(app).send(message);
    }

    /** Console mock used when Firebase credentials are absent (development). */
    private logMockSend(token: string, platform: string, payload: PushNotificationPayload): void {
        console.log('---------------------------------------------------------');
        console.log(`[PushNotificationService] MOCK send to ${platform.toUpperCase()}`);
        console.log(`Token: ${token.substring(0, 20)}...`);
        console.log(`Title: ${payload.title}`);
        console.log(`Body: ${payload.body}`);
        if (payload.data) console.log('Data:', payload.data);
        console.log('Set FIREBASE_SERVICE_ACCOUNT env var to enable real FCM.');
        console.log('---------------------------------------------------------');
    }

    /**
     * Cleanup inactive tokens older than the given number of days.
     */
    async cleanupInactiveTokens(daysThreshold: number = 30): Promise<{ deletedCount: number }> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

        const result = await this.prisma.deviceToken.deleteMany({
            where: {
                isActive: false,
                lastUsedAt: { lt: cutoffDate },
            },
        });

        return { deletedCount: result.count };
    }
}
