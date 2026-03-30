type JsonRecord = Record<string, unknown>;

export const GENTLE_REFLECTION_SOURCE = 'daily_gentle_reflection';
export const GENTLE_REFLECTION_ID_PARAM = 'gentleReflectionId';
export const GENTLE_REFLECTION_TAGS_PARAM = 'gentleTags';
export const GENTLE_REFLECTION_SETTINGS_KEY = 'dailyGentleReflectionsEnabled';

export type GentleReflectionClientState = {
    version: 1;
    lastShownAt?: string;
    lastDismissedAt?: string;
    lastAcceptedAt?: string;
    lastCompletedAt?: string;
    lastPromptSignature?: string;
};

const STORAGE_PREFIX = 'notive_gentle_reflection_v1';
const SAME_PROMPT_COOLDOWN_MS = 72 * 60 * 60 * 1000;
const RECENT_ENTRY_COOLDOWN_MS = 6 * 60 * 60 * 1000;

const isBrowser = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const asRecord = (value: unknown): JsonRecord | null =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? value as JsonRecord
        : null;

const storageKey = (userId: string) => `${STORAGE_PREFIX}_${userId}`;

const toIsoString = (value: unknown): string | undefined => {
    if (typeof value !== 'string' || !value.trim()) return undefined;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
};

const normalizeState = (value: unknown): GentleReflectionClientState => {
    const source = asRecord(value);
    if (!source) {
        return { version: 1 };
    }

    return {
        version: 1,
        lastShownAt: toIsoString(source.lastShownAt),
        lastDismissedAt: toIsoString(source.lastDismissedAt),
        lastAcceptedAt: toIsoString(source.lastAcceptedAt),
        lastCompletedAt: toIsoString(source.lastCompletedAt),
        lastPromptSignature: typeof source.lastPromptSignature === 'string' && source.lastPromptSignature.trim()
            ? source.lastPromptSignature.trim()
            : undefined,
    };
};

const readLastEntryTimestamp = (): number | null => {
    if (!isBrowser()) return null;
    const raw = window.localStorage.getItem('lastEntryTime');
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
};

export const readGentleReflectionState = (userId: string | null | undefined): GentleReflectionClientState => {
    if (!userId || !isBrowser()) {
        return { version: 1 };
    }

    try {
        return normalizeState(JSON.parse(window.localStorage.getItem(storageKey(userId)) || 'null'));
    } catch {
        return { version: 1 };
    }
};

export const writeGentleReflectionState = (
    userId: string | null | undefined,
    updater: (current: GentleReflectionClientState) => GentleReflectionClientState
): GentleReflectionClientState => {
    const current = readGentleReflectionState(userId);
    const next = normalizeState(updater(current));

    if (userId && isBrowser()) {
        window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
    }

    return next;
};

export const markGentleReflectionShown = (
    userId: string | null | undefined,
    promptSignature: string
): GentleReflectionClientState =>
    writeGentleReflectionState(userId, (current) => ({
        ...current,
        lastShownAt: new Date().toISOString(),
        lastPromptSignature: promptSignature,
    }));

export const markGentleReflectionDismissed = (
    userId: string | null | undefined,
    promptSignature: string
): GentleReflectionClientState =>
    writeGentleReflectionState(userId, (current) => ({
        ...current,
        lastDismissedAt: new Date().toISOString(),
        lastPromptSignature: promptSignature,
    }));

export const markGentleReflectionAccepted = (
    userId: string | null | undefined,
    promptSignature: string
): GentleReflectionClientState =>
    writeGentleReflectionState(userId, (current) => ({
        ...current,
        lastAcceptedAt: new Date().toISOString(),
        lastPromptSignature: promptSignature,
    }));

export const markGentleReflectionCompleted = (
    userId: string | null | undefined,
    promptSignature: string
): GentleReflectionClientState =>
    writeGentleReflectionState(userId, (current) => ({
        ...current,
        lastCompletedAt: new Date().toISOString(),
        lastPromptSignature: promptSignature,
    }));

export const isGentleReflectionEnabled = (signals: unknown): boolean => {
    const source = asRecord(signals);
    const settings = asRecord(source?.settings);
    return settings?.[GENTLE_REFLECTION_SETTINGS_KEY] === true;
};

export const mergeGentleReflectionSetting = (
    signals: unknown,
    enabled: boolean
): JsonRecord => {
    const source = asRecord(signals) || {};
    const settings = asRecord(source.settings) || {};
    const nextSettings: JsonRecord = {
        ...settings,
    };

    if (enabled) {
        nextSettings[GENTLE_REFLECTION_SETTINGS_KEY] = true;
    } else {
        delete nextSettings[GENTLE_REFLECTION_SETTINGS_KEY];
    }

    if (Object.keys(nextSettings).length === 0) {
        const { settings: _ignored, ...rest } = source;
        return rest;
    }

    return {
        ...source,
        settings: nextSettings,
    };
};

export const shouldPresentGentleReflection = (input: {
    userId: string | null | undefined;
    promptSignature: string;
    enabled: boolean;
    now?: Date;
}): boolean => {
    const { userId, promptSignature, enabled, now = new Date() } = input;
    if (!enabled || !userId) return false;

    const state = readGentleReflectionState(userId);
    const nowMs = now.getTime();
    const todayKey = now.toLocaleDateString('en-CA');

    if (state.lastShownAt) {
        const lastShown = new Date(state.lastShownAt);
        if (!Number.isNaN(lastShown.getTime()) && lastShown.toLocaleDateString('en-CA') === todayKey) {
            return false;
        }

        if (
            state.lastPromptSignature === promptSignature
            && (nowMs - lastShown.getTime()) < SAME_PROMPT_COOLDOWN_MS
        ) {
            return false;
        }
    }

    const lastEntryTimestamp = readLastEntryTimestamp();
    if (lastEntryTimestamp && (nowMs - lastEntryTimestamp) < RECENT_ENTRY_COOLDOWN_MS) {
        return false;
    }

    return true;
};

export const parseGentleReflectionTags = (value: string | null | undefined): string[] => {
    if (!value) return [];

    return Array.from(
        new Set(
            value
                .split(',')
                .map((item) => item.replace(/\s+/g, ' ').trim())
                .filter(Boolean)
                .slice(0, 6)
        )
    );
};

