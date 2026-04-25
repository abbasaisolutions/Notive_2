'use client';

import { useEffect, useState } from 'react';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { isNativePlatform, getNativePlatform } from '@/utils/platform';

type LogLine = { time: string; level: 'info' | 'error' | 'warn'; text: string };

export default function PushDebugPage() {
    const push = usePushNotifications();
    const [logs, setLogs] = useState<LogLine[]>([]);
    const [rawCheck, setRawCheck] = useState<string>('(not yet checked)');

    const log = (level: LogLine['level'], text: string) => {
        setLogs((prev) => [
            ...prev,
            { time: new Date().toLocaleTimeString(), level, text },
        ]);
    };

    useEffect(() => {
        log('info', `Native: ${isNativePlatform()} · platform: ${getNativePlatform()}`);
        log('info', `isSupported: ${push.isSupported} · isPermissionGranted: ${push.isPermissionGranted} · permissionState: ${push.permissionState}`);
        log('info', `deviceTokens.length: ${push.deviceTokens?.length ?? 0}`);
    }, [push.isSupported, push.isPermissionGranted, push.permissionState, push.deviceTokens?.length]);

    const checkNativePermission = async () => {
        try {
            const { PushNotifications } = await import('@capacitor/push-notifications');
            const result = await PushNotifications.checkPermissions();
            setRawCheck(JSON.stringify(result, null, 2));
            log('info', `checkPermissions raw: ${JSON.stringify(result)}`);
        } catch (e: any) {
            setRawCheck(`ERROR: ${e?.message ?? String(e)}`);
            log('error', `checkPermissions error: ${e?.message ?? String(e)}`);
        }
    };

    const forceRegister = async () => {
        log('info', 'forceRegister() called');
        try {
            const { PushNotifications } = await import('@capacitor/push-notifications');

            // Listen for the registration event
            const regListener = await PushNotifications.addListener('registration', (token: any) => {
                log('info', `✅ FCM token received: ${String(token?.value ?? '').slice(0, 30)}…`);
            });
            const errListener = await PushNotifications.addListener('registrationError', (err: any) => {
                log('error', `❌ registrationError: ${JSON.stringify(err)}`);
            });

            // Request permission
            const permResult = await PushNotifications.requestPermissions();
            log('info', `requestPermissions returned: ${JSON.stringify(permResult)}`);

            if (permResult.receive === 'granted') {
                log('info', 'Permission granted → calling register()');
                await PushNotifications.register();
                log('info', 'register() returned (waiting for token listener)');
            } else {
                log('warn', `Permission not granted: ${permResult.receive}`);
            }

            // Give the native layer 10s to emit the token, then clean up
            setTimeout(() => {
                regListener.remove();
                errListener.remove();
                log('info', 'Listeners removed.');
            }, 10000);
        } catch (e: any) {
            log('error', `forceRegister threw: ${e?.message ?? String(e)}`);
        }
    };

    const requestViaContext = async () => {
        log('info', 'usePushNotifications.requestPushPermission() called');
        try {
            const ok = await push.requestPushPermission();
            log('info', `requestPushPermission returned: ${ok}`);
        } catch (e: any) {
            log('error', `requestPushPermission threw: ${e?.message ?? String(e)}`);
        }
    };

    return (
        <div style={{ padding: 20, fontFamily: 'monospace', fontSize: 12 }}>
            <h1 style={{ fontSize: 18, marginBottom: 16 }}>Push Debug</h1>

            <section style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 14, marginBottom: 8 }}>State</h2>
                <pre style={{ background: '#f5f0ea', padding: 12, borderRadius: 6, overflow: 'auto' }}>
{JSON.stringify({
    isNativePlatform: isNativePlatform(),
    platform: getNativePlatform(),
    isSupported: push.isSupported,
    isPermissionGranted: push.isPermissionGranted,
    permissionState: push.permissionState,
    deviceTokenCount: push.deviceTokens?.length ?? 0,
}, null, 2)}
                </pre>
            </section>

            <section style={{ marginBottom: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                    onClick={checkNativePermission}
                    style={{ padding: '10px 14px', background: '#8A9A6F', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600 }}
                >
                    1. Check native permission
                </button>
                <button
                    onClick={requestViaContext}
                    style={{ padding: '10px 14px', background: '#26221e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600 }}
                >
                    2. Request via context
                </button>
                <button
                    onClick={forceRegister}
                    style={{ padding: '10px 14px', background: '#c08b4a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600 }}
                >
                    3. Force register (raw)
                </button>
            </section>

            <section style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 14, marginBottom: 8 }}>checkPermissions raw</h2>
                <pre style={{ background: '#f5f0ea', padding: 12, borderRadius: 6, overflow: 'auto' }}>{rawCheck}</pre>
            </section>

            <section>
                <h2 style={{ fontSize: 14, marginBottom: 8 }}>Logs</h2>
                <div style={{ background: '#26221e', color: '#fffbf5', padding: 12, borderRadius: 6, maxHeight: 400, overflow: 'auto' }}>
                    {logs.length === 0 && <p style={{ opacity: 0.5 }}>(no logs yet)</p>}
                    {logs.map((l, i) => (
                        <div key={i} style={{ marginBottom: 4, color: l.level === 'error' ? '#ff9aa2' : l.level === 'warn' ? '#ffd59a' : '#fffbf5' }}>
                            <span style={{ opacity: 0.6 }}>{l.time}</span>{' '}
                            <strong>[{l.level}]</strong> {l.text}
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
