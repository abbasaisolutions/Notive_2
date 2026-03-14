export type TimelineContextSnapshot = {
    href: string;
    scrollY: number;
    activeMonthLabel: string | null;
    loadedEntryCount: number;
};

type TimelineContextState = TimelineContextSnapshot & {
    pending: boolean;
    savedAt: number;
};

const STORAGE_KEY = 'notive_timeline_context_v1';
const MAX_STATE_AGE_MS = 1000 * 60 * 30;

const canUseSessionStorage = () => typeof window !== 'undefined' && !!window.sessionStorage;

const readState = (): TimelineContextState | null => {
    if (!canUseSessionStorage()) return null;

    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as TimelineContextState;
        if (!parsed?.href) return null;
        return parsed;
    } catch (error) {
        console.error('Failed to parse timeline context', error);
        return null;
    }
};

const writeState = (state: TimelineContextState) => {
    if (!canUseSessionStorage()) return;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const saveTimelineContext = (
    snapshot: TimelineContextSnapshot,
    options?: { pending?: boolean }
) => {
    writeState({
        ...snapshot,
        pending: options?.pending ?? false,
        savedAt: Date.now(),
    });
};

export const markTimelineContextPending = (snapshot: TimelineContextSnapshot) => {
    saveTimelineContext(snapshot, { pending: true });
};

export const consumePendingTimelineContext = (
    href: string
): TimelineContextSnapshot | null => {
    const state = readState();
    if (!state) return null;

    const isFresh = Date.now() - state.savedAt <= MAX_STATE_AGE_MS;
    const matchesHref = state.href === href;

    if (!state.pending || !matchesHref || !isFresh) {
        if (!isFresh && canUseSessionStorage()) {
            window.sessionStorage.removeItem(STORAGE_KEY);
        }
        return null;
    }

    writeState({
        ...state,
        pending: false,
        savedAt: Date.now(),
    });

    return {
        href: state.href,
        scrollY: state.scrollY,
        activeMonthLabel: state.activeMonthLabel,
        loadedEntryCount: state.loadedEntryCount,
    };
};
