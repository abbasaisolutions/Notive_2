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
 * Push diagnostic — runs the full pipeline for the caller and returns a
 * structured report so the client can pinpoint where notifications are breaking.
 *
 * POST /api/v1/devices/push-diagnostic
 */
export async function pushDiagnostic(req: Request, res: Response): Promise<void> {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        // 1. Environment
        const hasServiceAccount = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT?.trim());
        const hasCredentialFile = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim());

        let serviceAccountParseable = false;
        let serviceAccountProjectId: string | null = null;
        if (hasServiceAccount) {
            try {
                const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!);
                serviceAccountParseable = true;
                serviceAccountProjectId = parsed?.project_id ?? null;
            } catch {
                serviceAccountParseable = false;
            }
        }

        // 2. Device tokens
        const tokens = await pushService.getUserActiveTokens(userId);
        const tokensByPlatform = tokens.reduce<Record<string, number>>((acc, t) => {
            acc[t.platform] = (acc[t.platform] ?? 0) + 1;
            return acc;
        }, {});

        // 2b. SUPERADMIN: also show system-wide token count for triage
        let systemWide: {
            totalActiveTokens: number;
            usersWithTokens: number;
            byPlatform: Record<string, number>;
            recentRegistrations: Array<{ userEmail: string; platform: string; deviceName: string | null; lastUsedAt: string | null; appVersion: string | null }>;
        } | undefined;

        const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
        if (user?.role === 'SUPERADMIN') {
            const allActive = await prisma.deviceToken.findMany({
                where: { isActive: true },
                select: {
                    userId: true,
                    platform: true,
                    deviceName: true,
                    appVersion: true,
                    lastUsedAt: true,
                    user: { select: { email: true } },
                },
                orderBy: { lastUsedAt: 'desc' },
                take: 20,
            });
            const totalCount = await prisma.deviceToken.count({ where: { isActive: true } });
            const distinctUsers = new Set(allActive.map((t) => t.userId)).size;
            const byPlatform = allActive.reduce<Record<string, number>>((acc, t) => {
                acc[t.platform] = (acc[t.platform] ?? 0) + 1;
                return acc;
            }, {});
            systemWide = {
                totalActiveTokens: totalCount,
                usersWithTokens: distinctUsers,
                byPlatform,
                recentRegistrations: allActive.slice(0, 10).map((t) => ({
                    userEmail: t.user?.email ?? 'unknown',
                    platform: t.platform,
                    deviceName: t.deviceName,
                    appVersion: t.appVersion,
                    lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
                })),
            };
        }

        // 3. Test send
        let testSend: {
            attempted: boolean;
            sent: number;
            failed: number;
            failedTokenIds: string[];
        } = { attempted: false, sent: 0, failed: 0, failedTokenIds: [] };

        if (tokens.length > 0) {
            const result = await pushService.sendPushNotification(userId, {
                title: 'Notive diagnostic',
                body: 'If you see this banner, push delivery is working end-to-end.',
                data: { type: 'diagnostic', timestamp: String(Date.now()) },
            });
            testSend = {
                attempted: true,
                sent: result.sent,
                failed: result.failed,
                failedTokenIds: result.failedTokens,
            };
        }

        // 4. Build verdict
        const fcmConfigured = (hasServiceAccount && serviceAccountParseable) || hasCredentialFile;
        let verdict: string;
        let nextStep: string;
        if (!fcmConfigured) {
            verdict = 'FCM_NOT_CONFIGURED';
            nextStep = 'Set FIREBASE_SERVICE_ACCOUNT env var (valid JSON) or GOOGLE_APPLICATION_CREDENTIALS path in Railway.';
        } else if (tokens.length === 0) {
            verdict = 'NO_DEVICE_TOKENS';
            nextStep = 'The app has not registered an FCM token for this user. Check frontend push registration flow and POST /devices/tokens calls.';
        } else if (testSend.failed > 0 && testSend.sent === 0) {
            verdict = 'FCM_SEND_FAILING';
            nextStep = 'FCM rejected all tokens. Check Railway logs for push.send_failed entries with errorCode — invalid project, expired tokens, or wrong service account.';
        } else if (testSend.sent > 0) {
            verdict = 'SEND_SUCCEEDED_CHECK_DEVICE';
            nextStep = 'Backend successfully delivered to FCM. If no banner appeared, the issue is device-side: notification channel missing/muted, battery optimisation, Do Not Disturb, or app in foreground with notifications disabled.';
        } else {
            verdict = 'UNKNOWN';
            nextStep = 'Inspect Railway logs for push.* events.';
        }

        res.status(200).json({
            success: true,
            verdict,
            nextStep,
            env: {
                hasServiceAccount,
                hasCredentialFile,
                serviceAccountParseable,
                serviceAccountProjectId,
            },
            tokens: {
                count: tokens.length,
                byPlatform: tokensByPlatform,
                devices: tokens.map((t) => ({
                    id: t.id,
                    platform: t.platform,
                    deviceName: t.deviceName,
                    appVersion: t.appVersion,
                    osVersion: t.osVersion,
                    lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
                    tokenPreview: previewPushToken(t.token),
                })),
            },
            testSend,
            ...(systemWide ? { systemWide } : {}),
        });
    } catch (error) {
        console.error('Push diagnostic error:', error);
        serverLogger.error('push.diagnostic_failed', {
            userId: req.userId || undefined,
            message: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ message: 'Diagnostic failed', error: error instanceof Error ? error.message : String(error) });
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
