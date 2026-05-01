export const LANDING_CHECKIN_SOURCE = 'landing_checkin';
export const LANDING_CHECKIN_DRAFT_KEY = 'notive_landing_checkin_draft_v1';
export const LANDING_EVENT_QUEUE_KEY = 'notive_landing_events_v1';

export type LandingCheckInDraft = {
    mood: string;
    note: string;
    savedAt: number;
    source: typeof LANDING_CHECKIN_SOURCE;
};

export type LandingEventPayload = {
    eventType: string;
    value?: string | null;
    metadata?: Record<string, unknown>;
    occurredAt: string;
};

const canUseStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

export const buildLandingCheckInText = (draft: Pick<LandingCheckInDraft, 'mood' | 'note'>): string => {
    const note = draft.note.trim();
    if (note) return note;
    return `Feeling ${draft.mood} today.`;
};

export const saveLandingCheckInDraft = (mood: string, note: string) => {
    if (!canUseStorage()) return;

    const draft: LandingCheckInDraft = {
        mood,
        note,
        savedAt: Date.now(),
        source: LANDING_CHECKIN_SOURCE,
    };

    localStorage.setItem(LANDING_CHECKIN_DRAFT_KEY, JSON.stringify(draft));
};

export const consumeLandingCheckInDraft = (): LandingCheckInDraft | null => {
    if (!canUseStorage()) return null;

    try {
        const raw = localStorage.getItem(LANDING_CHECKIN_DRAFT_KEY);
        if (!raw) return null;

        localStorage.removeItem(LANDING_CHECKIN_DRAFT_KEY);
        const parsed = JSON.parse(raw);

        if (
            !parsed
            || typeof parsed !== 'object'
            || typeof parsed.mood !== 'string'
            || typeof parsed.note !== 'string'
        ) {
            return null;
        }

        return {
            mood: parsed.mood,
            note: parsed.note,
            savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
            source: LANDING_CHECKIN_SOURCE,
        };
    } catch {
        return null;
    }
};

export const rememberLandingEvent = (
    eventType: string,
    value?: string | null,
    metadata?: Record<string, unknown>
) => {
    if (typeof window === 'undefined') return;

    const payload: LandingEventPayload = {
        eventType,
        value: value ?? null,
        metadata,
        occurredAt: new Date().toISOString(),
    };

    const dataLayerWindow = window as Window & { dataLayer?: Array<Record<string, unknown>> };
    dataLayerWindow.dataLayer?.push({
        event: eventType,
        value: value ?? undefined,
        ...metadata,
    });

    if (!canUseStorage()) return;

    try {
        const raw = localStorage.getItem(LANDING_EVENT_QUEUE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        const queue = Array.isArray(parsed) ? parsed : [];
        localStorage.setItem(LANDING_EVENT_QUEUE_KEY, JSON.stringify([...queue, payload].slice(-40)));
    } catch {
        localStorage.setItem(LANDING_EVENT_QUEUE_KEY, JSON.stringify([payload]));
    }
};
