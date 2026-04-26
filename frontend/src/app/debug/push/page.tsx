'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/context/auth-context';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { isNativePlatform, getNativePlatform } from '@/utils/platform';

type LogLine = { time: string; level: 'info' | 'error' | 'warn'; text: string };

type ListenerHandle = { remove: () => Promise<void> };

const sectionStyle = { background: '#f5f0ea', padding: 12, borderRadius: 6, overflow: 'auto' } as const;
const buttonStyle = { padding: '10px 14px', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600 } as const;

export default function PushDebugPage() {
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const { apiFetch } = useApi();
    const push = usePushNotifications();
    const [logs, setLogs] = useState<LogLine[]>([]);
    const [rawCheck, setRawCheck] = useState<string>('(not yet checked)');
    const [serverTokens, setServerTokens] = useState<string>('(not yet checked)');
    const [diagnosticReport, setDiagnosticReport] = useState<string>('(not yet run)');
    const [channelReport, setChannelReport] = useState<string>('(not yet checked)');
    const [deliveredReport, setDeliveredReport] = useState<string>('(not yet checked)');
    const [lastRawToken, setLastRawToken] = useState('');
    const [isRefreshingServerTokens, setIsRefreshingServerTokens] = useState(false);
    const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);
    const [isSyncingLatestToken, setIsSyncingLatestToken] = useState(false);
    const [isListingChannels, setIsListingChannels] = useState(false);
    const [isSendingLocalTest, setIsSendingLocalTest] = useState(false);
    const [isRefreshingDelivered, setIsRefreshingDelivered] = useState(false);
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';

    const log = useCallback((level: LogLine['level'], text: string) => {
        setLogs((prev) => [
            ...prev,
            { time: new Date().toLocaleTimeString(), level, text },
        ]);
    }, []);

    const prettyJson = useCallback((value: unknown) => JSON.stringify(value, null, 2), []);

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.replace('/profile');
        }
    }, [authLoading, isAdmin, router]);

    useEffect(() => {
        if (!isAdmin) {
            return;
        }

        log('info', `Native: ${isNativePlatform()} · platform: ${getNativePlatform()}`);
        log('info', `isSupported: ${push.isSupported} · isPermissionGranted: ${push.isPermissionGranted} · permissionState: ${push.permissionState}`);
        log('info', `deviceTokens.length: ${push.deviceTokens?.length ?? 0}`);
    }, [isAdmin, log, push.deviceTokens?.length, push.isPermissionGranted, push.isSupported, push.permissionState]);

    useEffect(() => {
        if (!isAdmin || !push.registrationDebug.lastError) {
            return;
        }

        log('error', `registrationDebug.lastError: ${push.registrationDebug.lastError}`);
    }, [isAdmin, log, push.registrationDebug.lastError]);

    useEffect(() => {
        if (!isAdmin || !push.registrationDebug.lastSuccessfulAt || !push.registrationDebug.lastSuccessfulTokenPreview) {
            return;
        }

        log(
            'info',
            `registrationDebug success: ${push.registrationDebug.lastSuccessfulPlatform ?? 'unknown'} ${push.registrationDebug.lastSuccessfulTokenPreview}`
        );
    }, [
        isAdmin,
        log,
        push.registrationDebug.lastSuccessfulAt,
        push.registrationDebug.lastSuccessfulPlatform,
        push.registrationDebug.lastSuccessfulTokenPreview,
    ]);

    useEffect(() => {
        if (!isAdmin || !isNativePlatform()) {
            return;
        }

        let cancelled = false;
        let pushReceivedHandle: ListenerHandle | undefined;
        let pushActionHandle: ListenerHandle | undefined;
        let localReceivedHandle: ListenerHandle | undefined;
        let localActionHandle: ListenerHandle | undefined;

        void (async () => {
            try {
                const [{ PushNotifications }, { LocalNotifications }] = await Promise.all([
                    import('@capacitor/push-notifications'),
                    import('@capacitor/local-notifications'),
                ]);
                if (cancelled) {
                    return;
                }

                pushReceivedHandle = await PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
                    log('info', `pushNotificationReceived: ${JSON.stringify(notification)}`);
                });
                pushActionHandle = await PushNotifications.addListener('pushNotificationActionPerformed', (notification: any) => {
                    log('info', `pushNotificationActionPerformed: ${JSON.stringify(notification)}`);
                });
                localReceivedHandle = await LocalNotifications.addListener('localNotificationReceived', (notification: any) => {
                    log('info', `localNotificationReceived: ${JSON.stringify(notification)}`);
                });
                localActionHandle = await LocalNotifications.addListener('localNotificationActionPerformed', (notification: any) => {
                    log('info', `localNotificationActionPerformed: ${JSON.stringify(notification)}`);
                });
                log('info', 'Attached live push/local notification listeners');
            } catch (e: any) {
                log('error', `Failed to attach live notification listeners: ${e?.message ?? String(e)}`);
            }
        })();

        return () => {
            cancelled = true;
            void pushReceivedHandle?.remove();
            void pushActionHandle?.remove();
            void localReceivedHandle?.remove();
            void localActionHandle?.remove();
        };
    }, [isAdmin, log]);

    const checkNativePermission = useCallback(async () => {
        try {
            const [{ PushNotifications }, { LocalNotifications }] = await Promise.all([
                import('@capacitor/push-notifications'),
                import('@capacitor/local-notifications'),
            ]);
            const [pushResult, localResult, enabledResult] = await Promise.all([
                PushNotifications.checkPermissions(),
                LocalNotifications.checkPermissions(),
                LocalNotifications.areEnabled(),
            ]);

            const report = {
                pushPermissions: pushResult,
                localPermissions: localResult,
                areEnabled: enabledResult,
            };
            setRawCheck(prettyJson(report));
            log('info', `permission check: push=${pushResult.receive} local=${localResult.display} enabled=${enabledResult.value}`);
        } catch (e: any) {
            setRawCheck(`ERROR: ${e?.message ?? String(e)}`);
            log('error', `checkPermissions error: ${e?.message ?? String(e)}`);
        }
    }, [log, prettyJson]);

    const forceRegister = useCallback(async () => {
        log('info', 'forceRegister() called');
        try {
            const { PushNotifications } = await import('@capacitor/push-notifications');

            const regListener = await PushNotifications.addListener('registration', (token: any) => {
                const tokenValue = String(token?.value ?? '').trim();
                if (tokenValue) {
                    setLastRawToken(tokenValue);
                    log('info', `FCM token received: ${tokenValue.slice(0, 30)}…`);
                    return;
                }

                log('warn', 'registration listener fired without a token value');
            });
            const errListener = await PushNotifications.addListener('registrationError', (err: any) => {
                log('error', `registrationError: ${JSON.stringify(err)}`);
            });

            const permResult = await PushNotifications.requestPermissions();
            log('info', `requestPermissions returned: ${JSON.stringify(permResult)}`);

            if (permResult.receive === 'granted') {
                log('info', 'Permission granted, calling register()');
                await PushNotifications.register();
                log('info', 'register() returned, waiting for token listener');
            } else {
                log('warn', `Permission not granted: ${permResult.receive}`);
            }

            setTimeout(() => {
                void regListener.remove();
                void errListener.remove();
                log('info', 'Temporary registration listeners removed');
            }, 10000);
        } catch (e: any) {
            log('error', `forceRegister threw: ${e?.message ?? String(e)}`);
        }
    }, [log]);

    const requestViaContext = useCallback(async () => {
        log('info', 'usePushNotifications.requestPushPermission() called');
        try {
            const ok = await push.requestPushPermission();
            log('info', `requestPushPermission returned: ${ok}`);
            await checkNativePermission();
        } catch (e: any) {
            log('error', `requestPushPermission threw: ${e?.message ?? String(e)}`);
        }
    }, [checkNativePermission, log, push]);

    const refreshServerDeviceTokens = useCallback(async () => {
        log('info', 'Fetching /device/tokens from backend');
        setIsRefreshingServerTokens(true);

        try {
            const response = await apiFetch('/device/tokens');
            const data = await response.json().catch(() => null);
            setServerTokens(prettyJson(data));

            if (!response.ok) {
                log('error', `GET /device/tokens failed: ${response.status}`);
                return;
            }

            const count = Array.isArray(data?.data) ? data.data.length : 0;
            log('info', `GET /device/tokens ok: count=${count}`);
        } catch (e: any) {
            setServerTokens(`ERROR: ${e?.message ?? String(e)}`);
            log('error', `GET /device/tokens threw: ${e?.message ?? String(e)}`);
        } finally {
            setIsRefreshingServerTokens(false);
        }
    }, [apiFetch, log, prettyJson]);

    const runBackendDiagnostic = useCallback(async () => {
        log('info', 'POST /device/push-diagnostic called');
        setIsRunningDiagnostic(true);

        try {
            const response = await apiFetch('/device/push-diagnostic', {
                method: 'POST',
            });
            const data = await response.json().catch(() => null);
            setDiagnosticReport(prettyJson(data));

            if (!response.ok) {
                log('error', `push diagnostic failed: ${response.status}`);
                return;
            }

            log('info', `push diagnostic verdict: ${String(data?.verdict ?? 'unknown')}`);
        } catch (e: any) {
            setDiagnosticReport(`ERROR: ${e?.message ?? String(e)}`);
            log('error', `push diagnostic threw: ${e?.message ?? String(e)}`);
        } finally {
            setIsRunningDiagnostic(false);
        }
    }, [apiFetch, log, prettyJson]);

    const syncLatestTokenToBackend = useCallback(async () => {
        if (!lastRawToken) {
            log('warn', 'No raw FCM token captured yet. Run Force register first.');
            return;
        }

        setIsSyncingLatestToken(true);
        log('info', 'registerPushToken(latest raw token) called');

        try {
            await push.registerPushToken(lastRawToken, getNativePlatform());
            log('info', 'registerPushToken completed successfully');
            await refreshServerDeviceTokens();
        } catch (e: any) {
            log('error', `registerPushToken failed: ${e?.message ?? String(e)}`);
        } finally {
            setIsSyncingLatestToken(false);
        }
    }, [lastRawToken, log, push, refreshServerDeviceTokens]);

    const listAndroidChannels = useCallback(async () => {
        log('info', 'Listing Android push/local notification channels');
        setIsListingChannels(true);

        try {
            const [{ PushNotifications }, { LocalNotifications }] = await Promise.all([
                import('@capacitor/push-notifications'),
                import('@capacitor/local-notifications'),
            ]);
            const [pushChannels, localChannels] = await Promise.all([
                PushNotifications.listChannels(),
                LocalNotifications.listChannels(),
            ]);
            setChannelReport(prettyJson({ pushChannels, localChannels }));
            log('info', `Channel listing ok: push=${pushChannels.channels.length} local=${localChannels.channels.length}`);
        } catch (e: any) {
            setChannelReport(`ERROR: ${e?.message ?? String(e)}`);
            log('error', `Channel listing failed: ${e?.message ?? String(e)}`);
        } finally {
            setIsListingChannels(false);
        }
    }, [log, prettyJson]);

    const showLocalTestBanner = useCallback(async () => {
        log('info', 'Scheduling local test banner for 2 seconds from now');
        setIsSendingLocalTest(true);

        try {
            const { LocalNotifications } = await import('@capacitor/local-notifications');
            const [localPermissions, enabledResult] = await Promise.all([
                LocalNotifications.checkPermissions(),
                LocalNotifications.areEnabled(),
            ]);

            if (localPermissions.display !== 'granted' || !enabledResult.value) {
                const report = {
                    localPermissions,
                    areEnabled: enabledResult,
                };
                setRawCheck(prettyJson(report));
                log('warn', `Local notification display unavailable: display=${localPermissions.display} enabled=${enabledResult.value}`);
                return;
            }

            await LocalNotifications.createChannel({
                id: 'notive_default',
                name: 'Notive updates',
                description: 'Reflection prompts, reminders, and important Notive updates.',
                importance: 5,
                visibility: 1,
                vibration: true,
            });

            const notificationId = Math.floor(Date.now() % 2_147_483_647);
            const fireAt = new Date(Date.now() + 2000);

            await LocalNotifications.schedule({
                notifications: [
                    {
                        id: notificationId,
                        title: 'Notive local banner test',
                        body: 'If you see this, Android can display a foreground banner.',
                        largeBody: 'If you see this, Android can display a foreground banner.',
                        schedule: {
                            at: fireAt,
                            allowWhileIdle: true,
                        },
                        channelId: 'notive_default',
                        smallIcon: 'ic_stat_notive',
                        iconColor: '#8A9A6F',
                        extra: {
                            route: '/debug/push',
                            type: 'debug_local_test',
                        },
                    },
                ],
            });

            log('info', `Local test banner scheduled for ${fireAt.toLocaleTimeString()} (id=${notificationId})`);
        } catch (e: any) {
            log('error', `Local test banner failed: ${e?.message ?? String(e)}`);
        } finally {
            setIsSendingLocalTest(false);
        }
    }, [log, prettyJson]);

    const refreshDeliveredNotifications = useCallback(async () => {
        log('info', 'Fetching delivered push/local notifications');
        setIsRefreshingDelivered(true);

        try {
            const [{ PushNotifications }, { LocalNotifications }] = await Promise.all([
                import('@capacitor/push-notifications'),
                import('@capacitor/local-notifications'),
            ]);
            const [pushDelivered, localDelivered] = await Promise.all([
                PushNotifications.getDeliveredNotifications(),
                LocalNotifications.getDeliveredNotifications(),
            ]);
            setDeliveredReport(prettyJson({ pushDelivered, localDelivered }));
            log('info', `Delivered notification fetch ok: push=${pushDelivered.notifications.length} local=${localDelivered.notifications.length}`);
        } catch (e: any) {
            setDeliveredReport(`ERROR: ${e?.message ?? String(e)}`);
            log('error', `Delivered notification fetch failed: ${e?.message ?? String(e)}`);
        } finally {
            setIsRefreshingDelivered(false);
        }
    }, [log, prettyJson]);

    if (authLoading || !isAdmin) {
        return null;
    }

    return (
        <div style={{ padding: 20, fontFamily: 'monospace', fontSize: 12 }}>
            <h1 style={{ fontSize: 18, marginBottom: 16 }}>Push Debug</h1>

            <section style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 14, marginBottom: 8 }}>State</h2>
                <pre style={sectionStyle}>
{prettyJson({
    isNativePlatform: isNativePlatform(),
    platform: getNativePlatform(),
    isSupported: push.isSupported,
    isPermissionGranted: push.isPermissionGranted,
    permissionState: push.permissionState,
    deviceTokenCount: push.deviceTokens?.length ?? 0,
    registrationDebug: push.registrationDebug,
    lastRawTokenPreview: lastRawToken ? `${lastRawToken.slice(0, 30)}…` : null,
})}
                </pre>
            </section>

            <section style={{ marginBottom: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                    onClick={checkNativePermission}
                    style={{ ...buttonStyle, background: '#8A9A6F' }}
                >
                    1. Check native permission
                </button>
                <button
                    onClick={requestViaContext}
                    style={{ ...buttonStyle, background: '#26221e' }}
                >
                    2. Request via context
                </button>
                <button
                    onClick={forceRegister}
                    style={{ ...buttonStyle, background: '#c08b4a' }}
                >
                    3. Force register (raw)
                </button>
                <button
                    onClick={syncLatestTokenToBackend}
                    disabled={isSyncingLatestToken}
                    style={{ ...buttonStyle, background: '#5b6c8f', opacity: isSyncingLatestToken ? 0.7 : 1 }}
                >
                    {isSyncingLatestToken ? '4. Syncing...' : '4. Sync latest token'}
                </button>
                <button
                    onClick={refreshServerDeviceTokens}
                    disabled={isRefreshingServerTokens}
                    style={{ ...buttonStyle, background: '#3b6f68', opacity: isRefreshingServerTokens ? 0.7 : 1 }}
                >
                    {isRefreshingServerTokens ? '5. Refreshing...' : '5. Refresh server tokens'}
                </button>
                <button
                    onClick={runBackendDiagnostic}
                    disabled={isRunningDiagnostic}
                    style={{ ...buttonStyle, background: '#7b4f94', opacity: isRunningDiagnostic ? 0.7 : 1 }}
                >
                    {isRunningDiagnostic ? '6. Running...' : '6. Run backend diagnostic'}
                </button>
                <button
                    onClick={listAndroidChannels}
                    disabled={isListingChannels}
                    style={{ ...buttonStyle, background: '#4f6d7a', opacity: isListingChannels ? 0.7 : 1 }}
                >
                    {isListingChannels ? '7. Listing...' : '7. List channels'}
                </button>
                <button
                    onClick={showLocalTestBanner}
                    disabled={isSendingLocalTest}
                    style={{ ...buttonStyle, background: '#9b6b43', opacity: isSendingLocalTest ? 0.7 : 1 }}
                >
                    {isSendingLocalTest ? '8. Scheduling...' : '8. Show local test banner'}
                </button>
                <button
                    onClick={refreshDeliveredNotifications}
                    disabled={isRefreshingDelivered}
                    style={{ ...buttonStyle, background: '#5b5f97', opacity: isRefreshingDelivered ? 0.7 : 1 }}
                >
                    {isRefreshingDelivered ? '9. Refreshing...' : '9. Check delivered'}
                </button>
            </section>

            <section style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 14, marginBottom: 8 }}>Permission diagnostics</h2>
                <pre style={sectionStyle}>{rawCheck}</pre>
            </section>

            <section style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 14, marginBottom: 8 }}>Server /device/tokens</h2>
                <pre style={sectionStyle}>{serverTokens}</pre>
            </section>

            <section style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 14, marginBottom: 8 }}>Backend diagnostic</h2>
                <pre style={sectionStyle}>{diagnosticReport}</pre>
            </section>

            <section style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 14, marginBottom: 8 }}>Android channels</h2>
                <pre style={sectionStyle}>{channelReport}</pre>
            </section>

            <section style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 14, marginBottom: 8 }}>Delivered notifications</h2>
                <pre style={sectionStyle}>{deliveredReport}</pre>
            </section>

            <section>
                <h2 style={{ fontSize: 14, marginBottom: 8 }}>Logs</h2>
                <div style={{ background: '#26221e', color: '#fffbf5', padding: 12, borderRadius: 6, maxHeight: 400, overflow: 'auto' }}>
                    {logs.length === 0 && <p style={{ opacity: 0.5 }}>(no logs yet)</p>}
                    {logs.map((line, index) => (
                        <div key={index} style={{ marginBottom: 4, color: line.level === 'error' ? '#ff9aa2' : line.level === 'warn' ? '#ffd59a' : '#fffbf5' }}>
                            <span style={{ opacity: 0.6 }}>{line.time}</span>{' '}
                            <strong>[{line.level}]</strong> {line.text}
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
