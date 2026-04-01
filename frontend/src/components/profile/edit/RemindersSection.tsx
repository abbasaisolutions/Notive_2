'use client';

import { useEffect, useRef, useState } from 'react';
import { FiBell, FiBellOff, FiCheck } from 'react-icons/fi';
import { useApi } from '@/hooks/use-api';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface ReminderData {
    id?: string;
    time: string;         // "HH:MM"
    days: number[];       // 0–6 (empty = every day)
    timezone: string;
    enabled: boolean;
}

const DEFAULT_REMINDER: ReminderData = {
    time: '20:00',
    days: [],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    enabled: false,
};

export default function RemindersSection() {
    const { apiFetch } = useApi();
    const [reminder, setReminder] = useState<ReminderData>(DEFAULT_REMINDER);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const initialized = useRef(false);

    useEffect(() => {
        void (async () => {
            try {
                const res = await apiFetch('/reminders');
                if (res.ok) {
                    const json = await res.json() as { data: ReminderData | null };
                    if (json.data) setReminder(json.data);
                }
            } catch {
                // no existing reminder — use defaults
            } finally {
                setIsLoading(false);
                initialized.current = true;
            }
        })();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const save = (next: ReminderData) => {
        if (!initialized.current) return;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
            setIsSaving(true);
            try {
                const res = await apiFetch('/reminders', {
                    method: 'PUT',
                    body: JSON.stringify(next),
                    headers: { 'Content-Type': 'application/json' },
                });
                if (res.ok) {
                    const json = await res.json() as { data: ReminderData };
                    if (json.data) setReminder(json.data);
                }
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            } catch {
                // silently fail — user can try again
            } finally {
                setIsSaving(false);
            }
        }, 600);
    };

    const update = (patch: Partial<ReminderData>) => {
        const next = { ...reminder, ...patch };
        setReminder(next);
        save(next);
    };

    const toggleDay = (day: number) => {
        const current = reminder.days;
        const next = current.includes(day)
            ? current.filter(d => d !== day)
            : [...current, day].sort((a, b) => a - b);
        update({ days: next });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-lg">
            {/* Header */}
            <div>
                <p className="type-overline text-muted mb-1">Reminders</p>
                <p className="text-sm text-soft">
                    Get a gentle nudge to reflect each day. Notifications are sent to your mobile device.
                </p>
            </div>

            {/* Enable toggle */}
            <div className="workspace-panel flex items-center justify-between gap-4 p-5">
                <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                        reminder.enabled ? 'bg-primary/12 text-primary' : 'bg-[rgba(var(--paper-ink-muted),0.10)] text-muted'
                    }`}>
                        {reminder.enabled ? <FiBell size={16} aria-hidden /> : <FiBellOff size={16} aria-hidden />}
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-strong">
                            {reminder.enabled ? 'Reminders on' : 'Reminders off'}
                        </p>
                        <p className="text-xs text-muted mt-0.5">
                            {reminder.enabled ? 'You\'ll get a push notification to reflect.' : 'Turn on to receive daily nudges.'}
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={reminder.enabled}
                    onClick={() => update({ enabled: !reminder.enabled })}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                        reminder.enabled ? 'bg-primary' : 'bg-[rgba(var(--paper-ink),0.16)]'
                    }`}
                >
                    <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                            reminder.enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                    />
                </button>
            </div>

            {/* Time + Days */}
            {reminder.enabled && (
                <div className="workspace-panel space-y-5 p-5">
                    {/* Time */}
                    <div>
                        <label htmlFor="reminder-time" className="type-overline text-muted block mb-2">
                            Time
                        </label>
                        <input
                            id="reminder-time"
                            type="time"
                            value={reminder.time}
                            onChange={e => update({ time: e.target.value })}
                            className="workspace-input h-10 w-40 px-3 text-sm font-medium text-strong"
                        />
                        <p className="mt-1.5 text-xs text-muted">
                            In your local timezone ({reminder.timezone.replace(/_/g, ' ')})
                        </p>
                    </div>

                    {/* Days */}
                    <div>
                        <p className="type-overline text-muted mb-2">Days</p>
                        <div className="flex flex-wrap gap-2">
                            {DAY_LABELS.map((label, idx) => {
                                const active = reminder.days.length === 0 || reminder.days.includes(idx);
                                const explicit = reminder.days.includes(idx);
                                const isEveryDay = reminder.days.length === 0;
                                return (
                                    <button
                                        key={label}
                                        type="button"
                                        aria-pressed={isEveryDay || explicit}
                                        onClick={() => toggleDay(idx)}
                                        className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                                            active
                                                ? 'bg-primary text-white'
                                                : 'bg-[rgba(var(--paper-ink),0.08)] text-soft hover:bg-[rgba(var(--paper-ink),0.14)]'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="mt-2 text-xs text-muted">
                            {reminder.days.length === 0
                                ? 'Every day — tap days to pick specific ones.'
                                : `${reminder.days.length} day${reminder.days.length !== 1 ? 's' : ''} selected`}
                        </p>
                    </div>
                </div>
            )}

            {/* Save status */}
            <div className="flex items-center gap-2 min-h-[20px]">
                {isSaving && (
                    <span className="text-xs text-muted flex items-center gap-1.5">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border border-muted border-t-transparent" />
                        Saving…
                    </span>
                )}
                {saved && !isSaving && (
                    <span className="text-xs text-primary flex items-center gap-1.5">
                        <FiCheck size={13} aria-hidden />
                        Saved
                    </span>
                )}
            </div>
        </div>
    );
}
