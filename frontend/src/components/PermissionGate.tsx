'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { usePushNotifications } from '@/context/push-notification-context';
import { isNativePlatform } from '@/utils/platform';
import {
    checkAllPermissions,
    requestPermission,
    type PermissionKind,
    type PermissionStatus,
} from '@/services/device-permissions.service';
import { FiBell, FiMic, FiMapPin, FiX } from 'react-icons/fi';

const DISMISS_KEY = 'notive_permission_gate_dismissed_at';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const PERMISSION_META: Record<PermissionKind, { icon: typeof FiBell; label: string; reason: string }> = {
    notifications: {
        icon: FiBell,
        label: 'Notifications',
        reason: 'Get gentle reminders to reflect and pattern alerts',
    },
    microphone: {
        icon: FiMic,
        label: 'Microphone',
        reason: 'Speak your thoughts instead of typing',
    },
    location: {
        icon: FiMapPin,
        label: 'Location',
        reason: 'Tag entries with where you were for richer context',
    },
};

export default function PermissionGate() {
    const { user } = useAuth();
    const { isPermissionGranted: pushGranted } = usePushNotifications();
    const [pending, setPending] = useState<PermissionKind[]>([]);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!user || !isNativePlatform()) return;

        // Check cooldown
        const dismissedAt = localStorage.getItem(DISMISS_KEY);
        if (dismissedAt && Date.now() - Number(dismissedAt) < COOLDOWN_MS) return;

        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                const all = await checkAllPermissions();
                if (cancelled) return;
                const promptable: PermissionKind[] = [];
                for (const [kind, status] of Object.entries(all) as [PermissionKind, PermissionStatus][]) {
                    // Skip notifications if already granted via the push context
                    // (avoids duplicating the dedicated push permission prompt).
                    if (kind === 'notifications' && pushGranted) continue;
                    if (status === 'prompt' || status === 'prompt-with-rationale') promptable.push(kind);
                }
                if (promptable.length > 0) {
                    setPending(promptable);
                    setVisible(true);
                }
            } catch { /* silent */ }
        }, 2000);

        return () => { cancelled = true; clearTimeout(timer); };
    }, [user, pushGranted]);

    const handleEnable = useCallback(async (kind: PermissionKind) => {
        const result = await requestPermission(kind);
        setPending(prev => {
            const next = prev.filter(k => k !== kind);
            if (next.length === 0) setVisible(false);
            return next;
        });
        // If granted or denied, it's no longer promptable either way
        if (result.status === 'denied') {
            setPending(prev => prev.filter(k => k !== kind));
        }
    }, []);

    const handleDismiss = useCallback(() => {
        setVisible(false);
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }, []);

    if (!visible || pending.length === 0) return null;

    return (
        <div className="fixed inset-x-4 bottom-20 z-40 mx-auto max-w-sm animate-in slide-in-from-bottom-4 duration-300">
            <div className="workspace-panel rounded-2xl shadow-xl p-4 border border-primary/15">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-strong">
                        Enhance your experience
                    </h3>
                    <button
                        onClick={handleDismiss}
                        className="p-1 rounded-full text-ink-muted hover:text-strong transition-colors"
                        aria-label="Dismiss"
                    >
                        <FiX size={16} />
                    </button>
                </div>

                <div className="space-y-2.5">
                    {pending.map(kind => {
                        const meta = PERMISSION_META[kind];
                        const Icon = meta.icon;
                        return (
                            <div key={kind} className="flex items-center gap-3">
                                <Icon size={16} className="text-primary flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-strong">{meta.label}</p>
                                    <p className="text-[0.65rem] text-soft leading-tight">{meta.reason}</p>
                                </div>
                                <button
                                    onClick={() => handleEnable(kind)}
                                    className="px-3 py-1 text-xs font-medium rounded-full workspace-button-primary flex-shrink-0"
                                >
                                    Enable
                                </button>
                            </div>
                        );
                    })}
                </div>

                <button
                    onClick={handleDismiss}
                    className="mt-3 w-full text-center text-xs text-ink-muted hover:text-soft transition-colors"
                >
                    Not now
                </button>
            </div>
        </div>
    );
}
