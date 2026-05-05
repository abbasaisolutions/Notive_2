type NotificationCategory = 'reminders' | 'sharedMemories' | 'friendActivity' | 'insights' | 'storyMaterial';
type NotificationQuietness = 'gentle' | 'balanced' | 'active';

type QuietHoursPreference = {
    enabled: boolean;
    start: string | null;
    end: string | null;
    timezone: string | null;
};

export type NormalizedNotificationPreferences = {
    categories: Record<NotificationCategory, boolean>;
    quietness: NotificationQuietness;
    quietHours: QuietHoursPreference;
};

const DEFAULT_NOTIFICATION_PREFERENCES: NormalizedNotificationPreferences = {
    categories: {
        reminders: true,
        sharedMemories: true,
        friendActivity: true,
        insights: true,
        storyMaterial: true,
    },
    quietness: 'balanced',
    quietHours: {
        enabled: false,
        start: null,
        end: null,
        timezone: null,
    },
};

const NOTIFICATION_CATEGORY_BY_TYPE: Record<string, NotificationCategory> = {
    reminder: 'reminders',
    shared_memory: 'sharedMemories',
    memory_share_request: 'sharedMemories',
    memory_share_request_accepted: 'sharedMemories',
    memory_share_request_declined: 'sharedMemories',
    shared_memory_response: 'sharedMemories',
    share_reaction: 'sharedMemories',
    friend_request: 'friendActivity',
    friend_accepted: 'friendActivity',
    social: 'friendActivity',
    insight: 'insights',
    insights: 'insights',
    insight_ready: 'insights',
    portfolio_evidence: 'storyMaterial',
    weekly_digest: 'insights',
    re_engagement: 'reminders',
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;

const asTimeString = (value: unknown): string | null =>
    typeof value === 'string' && /^\d{2}:\d{2}$/.test(value.trim())
        ? value.trim()
        : null;

const asTimezone = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : null;

const asQuietness = (value: unknown): NotificationQuietness =>
    value === 'gentle' || value === 'balanced' || value === 'active'
        ? value
        : DEFAULT_NOTIFICATION_PREFERENCES.quietness;

const parseTimeToMinutes = (value: string | null): number | null => {
    if (!value) return null;

    const [hourRaw, minuteRaw] = value.split(':').map(Number);
    if (!Number.isInteger(hourRaw) || !Number.isInteger(minuteRaw)) {
        return null;
    }
    if (hourRaw < 0 || hourRaw > 23 || minuteRaw < 0 || minuteRaw > 59) {
        return null;
    }

    return hourRaw * 60 + minuteRaw;
};

const getMinutesInTimezone = (timeZone: string, now: Date): number | null => {
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        });
        const parts = formatter.formatToParts(now);
        const hour = Number(parts.find((part) => part.type === 'hour')?.value);
        const minute = Number(parts.find((part) => part.type === 'minute')?.value);

        if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
            return null;
        }

        return hour * 60 + minute;
    } catch {
        return null;
    }
};

export const getNotificationCategoryForType = (type: string): NotificationCategory | undefined =>
    NOTIFICATION_CATEGORY_BY_TYPE[type];

export const getNotificationPreferences = (signals: unknown): NormalizedNotificationPreferences => {
    const settings = asRecord(asRecord(signals)?.settings);
    const notificationSettings = asRecord(settings?.notifications);
    const quietHours = asRecord(notificationSettings?.quietHours);

    return {
        categories: {
            reminders: notificationSettings?.reminders !== false,
            sharedMemories: notificationSettings?.sharedMemories !== false,
            friendActivity: notificationSettings?.friendActivity !== false,
            insights: notificationSettings?.insights !== false,
            storyMaterial: notificationSettings?.storyMaterial !== false,
        },
        quietness: asQuietness(notificationSettings?.quietness),
        quietHours: {
            enabled: quietHours?.enabled === true,
            start: asTimeString(quietHours?.start),
            end: asTimeString(quietHours?.end),
            timezone: asTimezone(quietHours?.timezone),
        },
    };
};

export const isNotificationTypeEnabled = (signals: unknown, type: string): boolean => {
    const category = getNotificationCategoryForType(type);
    if (!category) return true;

    return getNotificationPreferences(signals).categories[category];
};

export const isWithinNotificationQuietHours = (signals: unknown, now = new Date()): boolean => {
    const preferences = getNotificationPreferences(signals);
    const { quietHours } = preferences;
    if (!quietHours.enabled) return false;

    const startMinutes = parseTimeToMinutes(quietHours.start);
    const endMinutes = parseTimeToMinutes(quietHours.end);
    const currentMinutes = quietHours.timezone
        ? getMinutesInTimezone(quietHours.timezone, now)
        : null;

    if (
        startMinutes === null
        || endMinutes === null
        || currentMinutes === null
        || quietHours.timezone === null
        || startMinutes === endMinutes
    ) {
        return false;
    }

    if (startMinutes < endMinutes) {
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }

    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
};

const shouldSendForQuietness = (signals: unknown, type: string): boolean => {
    const { quietness } = getNotificationPreferences(signals);
    if (quietness === 'active') return true;

    if (quietness === 'gentle') {
        return new Set([
            'reminder',
            'memory_share_request',
            'shared_memory',
            'portfolio_evidence',
        ]).has(type);
    }

    return !new Set([
        're_engagement',
        'friend_accepted',
        'share_reaction',
        'shared_memory_response',
    ]).has(type);
};

export const shouldCreateNotificationForType = (signals: unknown, type: string): boolean =>
    isNotificationTypeEnabled(signals, type);

export const shouldSendPushForType = (signals: unknown, type: string, now = new Date()): boolean =>
    isNotificationTypeEnabled(signals, type)
    && shouldSendForQuietness(signals, type)
    && !isWithinNotificationQuietHours(signals, now);

export const getDefaultNotificationPreferences = (): NormalizedNotificationPreferences => ({
    categories: { ...DEFAULT_NOTIFICATION_PREFERENCES.categories },
    quietness: DEFAULT_NOTIFICATION_PREFERENCES.quietness,
    quietHours: { ...DEFAULT_NOTIFICATION_PREFERENCES.quietHours },
});
