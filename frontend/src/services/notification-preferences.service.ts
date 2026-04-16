export type NotificationPreferencesSettings = {
    reminders?: boolean;
    sharedMemories?: boolean;
    friendActivity?: boolean;
    insights?: boolean;
    quietHours?: {
        enabled?: boolean;
        start?: string;
        end?: string;
        timezone?: string;
    };
    updatedAt?: string;
};

export type ResolvedNotificationPreferences = {
    reminders: boolean;
    sharedMemories: boolean;
    friendActivity: boolean;
    insights: boolean;
    quietHours: {
        enabled: boolean;
        start: string;
        end: string;
        timezone: string;
    };
    updatedAt?: string;
};

const DEFAULT_QUIET_HOURS_START = '22:00';
const DEFAULT_QUIET_HOURS_END = '07:00';

const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;

const asTimeString = (value: unknown): string | undefined =>
    typeof value === 'string' && /^\d{2}:\d{2}$/.test(value.trim())
        ? value.trim()
        : undefined;

export const resolveDefaultNotificationTimezone = (): string => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
};

export const getDefaultNotificationPreferences = (): ResolvedNotificationPreferences => ({
    reminders: true,
    sharedMemories: true,
    friendActivity: true,
    insights: true,
    quietHours: {
        enabled: false,
        start: DEFAULT_QUIET_HOURS_START,
        end: DEFAULT_QUIET_HOURS_END,
        timezone: resolveDefaultNotificationTimezone(),
    },
});

export const normalizeNotificationPreferences = (value: unknown): NotificationPreferencesSettings | undefined => {
    const source = asRecord(value);
    if (!source) return undefined;

    const quietHoursSource = asRecord(source.quietHours);
    const quietHoursEnabled = quietHoursSource?.enabled === true;
    const quietHoursStart = asTimeString(quietHoursSource?.start);
    const quietHoursEnd = asTimeString(quietHoursSource?.end);
    const quietHoursTimezone = typeof quietHoursSource?.timezone === 'string' && quietHoursSource.timezone.trim().length > 0
        ? quietHoursSource.timezone.trim()
        : undefined;
    const updatedAt = typeof source.updatedAt === 'string' && source.updatedAt.trim().length > 0
        ? source.updatedAt
        : undefined;

    const normalized: NotificationPreferencesSettings = {
        ...(source.reminders === false ? { reminders: false } : {}),
        ...(source.sharedMemories === false ? { sharedMemories: false } : {}),
        ...(source.friendActivity === false ? { friendActivity: false } : {}),
        ...(source.insights === false ? { insights: false } : {}),
        ...(quietHoursEnabled || quietHoursStart || quietHoursEnd || quietHoursTimezone
            ? {
                quietHours: {
                    ...(quietHoursEnabled ? { enabled: true } : {}),
                    ...(quietHoursStart ? { start: quietHoursStart } : {}),
                    ...(quietHoursEnd ? { end: quietHoursEnd } : {}),
                    ...(quietHoursTimezone ? { timezone: quietHoursTimezone } : {}),
                },
            }
            : {}),
        ...(updatedAt ? { updatedAt } : {}),
    };

    if (Object.keys(normalized).length === 0) {
        return undefined;
    }

    return normalized;
};

export const extractNotificationPreferences = (
    signals: Record<string, unknown> | null | undefined
): ResolvedNotificationPreferences => {
    const defaults = getDefaultNotificationPreferences();
    const settings = asRecord(asRecord(signals)?.settings);
    const normalized = normalizeNotificationPreferences(settings?.notifications);

    return {
        reminders: normalized?.reminders !== false,
        sharedMemories: normalized?.sharedMemories !== false,
        friendActivity: normalized?.friendActivity !== false,
        insights: normalized?.insights !== false,
        quietHours: {
            enabled: normalized?.quietHours?.enabled === true,
            start: normalized?.quietHours?.start || defaults.quietHours.start,
            end: normalized?.quietHours?.end || defaults.quietHours.end,
            timezone: normalized?.quietHours?.timezone || defaults.quietHours.timezone,
        },
        ...(normalized?.updatedAt ? { updatedAt: normalized.updatedAt } : {}),
    };
};

export const mergeNotificationPreferencesIntoSignals = (
    signals: Record<string, unknown> | null | undefined,
    preferences: ResolvedNotificationPreferences
): Record<string, unknown> => {
    const nextSignals = asRecord(signals)
        ? JSON.parse(JSON.stringify(signals)) as Record<string, unknown>
        : {};
    const nextSettings = asRecord(nextSignals.settings)
        ? { ...(nextSignals.settings as Record<string, unknown>) }
        : {};

    const normalized = normalizeNotificationPreferences({
        reminders: preferences.reminders,
        sharedMemories: preferences.sharedMemories,
        friendActivity: preferences.friendActivity,
        insights: preferences.insights,
        quietHours: {
            ...(preferences.quietHours.enabled ? { enabled: true } : {}),
            ...(preferences.quietHours.start ? { start: preferences.quietHours.start } : {}),
            ...(preferences.quietHours.end ? { end: preferences.quietHours.end } : {}),
            ...(preferences.quietHours.timezone ? { timezone: preferences.quietHours.timezone } : {}),
        },
        updatedAt: preferences.updatedAt,
    });

    if (normalized) {
        nextSettings.notifications = normalized;
    } else {
        delete nextSettings.notifications;
    }

    if (Object.keys(nextSettings).length > 0) {
        nextSignals.settings = nextSettings;
    } else {
        delete nextSignals.settings;
    }

    return nextSignals;
};
