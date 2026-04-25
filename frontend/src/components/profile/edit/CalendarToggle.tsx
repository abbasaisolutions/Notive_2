'use client';

import { useEffect, useState } from 'react';
import { FiCalendar, FiCheck, FiSettings, FiX } from 'react-icons/fi';
import {
    requestCalendarPermission,
    checkCalendarPermission,
    getCalendarOptInState,
    markCalendarDeclined,
} from '@/services/calendar.service';
import { isNativePlatform } from '@/utils/platform';
import { hapticLight, hapticSuccess } from '@/services/haptics.service';

type Status = 'loading' | 'unavailable' | 'granted' | 'os_denied' | 'prompt';

export default function CalendarToggle() {
    const [status, setStatus] = useState<Status>('loading');
    const [busy, setBusy] = useState(false);

    const refresh = async () => {
        if (!isNativePlatform()) {
            setStatus('unavailable');
            return;
        }
        const permission = await checkCalendarPermission();
        if (permission === 'granted') {
            setStatus('granted');
            return;
        }
        if (permission === 'denied') {
            setStatus('os_denied');
            return;
        }
        if (permission === 'unavailable') {
            setStatus('unavailable');
            return;
        }
        const state = await getCalendarOptInState();
        setStatus(state.status === 'os_denied' ? 'os_denied' : 'prompt');
    };

    useEffect(() => {
        void refresh();
    }, []);

    const handleEnable = async () => {
        setBusy(true);
        hapticLight();
        const result = await requestCalendarPermission();
        setBusy(false);
        if (result === 'granted') {
            hapticSuccess();
            setStatus('granted');
        } else if (result === 'denied') {
            setStatus('os_denied');
        }
    };

    const handleOpenSettings = () => {
        import('@capacitor/app').then(({ App }) => {
            (App as any).openUrl?.({ url: 'app-settings:' }).catch(() => {});
        });
    };

    const handleDecline = async () => {
        await markCalendarDeclined();
        await refresh();
    };

    if (status === 'loading') {
        return (
            <div className="workspace-panel flex items-center gap-3 p-5">
                <div className="h-9 w-9 rounded-full bg-[rgba(var(--paper-ink-muted),0.10)]" />
                <div className="flex-1">
                    <div className="h-3 w-24 rounded bg-[rgba(var(--paper-ink-muted),0.10)]" />
                </div>
            </div>
        );
    }

    if (status === 'unavailable') {
        return (
            <div className="workspace-panel flex items-center gap-3 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(var(--paper-ink-muted),0.10)] text-muted">
                    <FiCalendar size={16} aria-hidden />
                </div>
                <div className="flex-1">
                    <p className="text-sm font-semibold text-strong">Calendar context</p>
                    <p className="mt-0.5 text-xs text-muted">
                        Available on the Notive mobile app — install on Android or iOS to enable.
                    </p>
                </div>
            </div>
        );
    }

    if (status === 'granted') {
        return (
            <div className="workspace-panel flex items-center gap-3 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/12 text-primary">
                    <FiCheck size={16} aria-hidden />
                </div>
                <div className="flex-1">
                    <p className="text-sm font-semibold text-strong">Calendar connected</p>
                    <p className="mt-0.5 text-xs text-muted">
                        Notive uses your upcoming events to ask better questions before they happen. Events are read-only and never uploaded.
                    </p>
                </div>
            </div>
        );
    }

    if (status === 'os_denied') {
        return (
            <div className="workspace-panel flex items-start gap-3 p-5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--paper-ink-muted),0.10)] text-muted">
                    <FiX size={16} aria-hidden />
                </div>
                <div className="flex-1">
                    <p className="text-sm font-semibold text-strong">Calendar access blocked</p>
                    <p className="mt-0.5 text-xs text-muted">
                        Calendar permission was denied. Open system settings to enable it for Notive.
                    </p>
                    <button
                        type="button"
                        onClick={handleOpenSettings}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white transition-opacity active:opacity-70"
                    >
                        <FiSettings size={12} aria-hidden />
                        Open Settings
                    </button>
                </div>
            </div>
        );
    }

    // status === 'prompt'
    return (
        <div className="workspace-panel flex items-start gap-3 p-5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                <FiCalendar size={16} aria-hidden />
            </div>
            <div className="flex-1">
                <p className="text-sm font-semibold text-strong">Life-aware prompts</p>
                <p className="mt-0.5 text-xs text-muted">
                    Connect your calendar so Notive can ask sharper questions before meetings, classes, and big moments. Read-only — never uploaded.
                </p>
                <div className="mt-3 flex gap-2">
                    <button
                        type="button"
                        onClick={handleEnable}
                        disabled={busy}
                        className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white transition-opacity active:opacity-70 disabled:opacity-50"
                    >
                        {busy ? 'Connecting…' : 'Connect calendar'}
                    </button>
                    <button
                        type="button"
                        onClick={handleDecline}
                        className="rounded-full px-3 py-1.5 text-xs text-muted hover:text-strong"
                    >
                        Not now
                    </button>
                </div>
            </div>
        </div>
    );
}
