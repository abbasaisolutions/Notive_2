import type { PromptData } from '@/services/context.service';
import type { PersonalizationQuestion } from '@/services/progressive-personalization.service';

type EngagementKind = 'smart' | 'progressive';
type EngagementOutcome = 'accepted' | 'dismissed';

type EngagementSession = {
    startedAt: string;
    lastInteractionAt: string;
    smartShown: number;
    smartDismissed: number;
    progressiveShown: number;
    progressiveDismissed: number;
};

type DailyEngagementCounters = {
    smartShown: number;
    smartAccepted: number;
    smartDismissed: number;
    progressiveShown: number;
    progressiveAccepted: number;
    progressiveDismissed: number;
};

type EngagementState = {
    version: 1;
    updatedAt?: string;
    days: Record<string, DailyEngagementCounters>;
    lastSmartPromptAt?: string;
    lastSmartPromptSignature?: string;
    lastProgressivePromptAt?: string;
    lastProgressiveQuestionId?: string;
    lastOutcomeAt?: Partial<Record<EngagementKind, string>>;
    lastOutcome?: Partial<Record<EngagementKind, EngagementOutcome>>;
    dismissStreaks: Record<EngagementKind, number>;
    session?: EngagementSession;
};

type SmartPromptPresentation = {
    eyebrow: string;
    title: string;
    body: string;
    reason: string;
    ctaLabel: string;
    laterLabel: string;
};

type ProgressivePromptPresentation = {
    eyebrow: string;
    title: string;
    helper: string;
    benefit: string;
    laterLabel: string;
    setupLabel: string;
};

const STORAGE_KEY_PREFIX = 'notive_engagement_v1';
const SMART_PROMPT_DAILY_LIMIT = 3;
const PROGRESSIVE_PROMPT_DAILY_LIMIT = 2;
const SMART_PROMPT_MIN_GAP_MS = 90 * 60 * 1000;
const PROGRESSIVE_PROMPT_MIN_GAP_MS = 4 * 60 * 60 * 1000;
const SMART_PROMPT_REPEAT_WINDOW_MS = 18 * 60 * 60 * 1000;
const PROGRESSIVE_PROMPT_REPEAT_WINDOW_MS = 24 * 60 * 60 * 1000;
const SMART_ACCEPTED_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const PROGRESSIVE_ACCEPTED_COOLDOWN_MS = 12 * 60 * 60 * 1000;
const SESSION_IDLE_WINDOW_MS = 2 * 60 * 60 * 1000;
const SMART_SESSION_LIMIT = 2;
const PROGRESSIVE_SESSION_LIMIT = 1;
const ADAPTIVE_LOOKBACK_DAYS = 7;
const QUIET_ROUTE_EXACT = new Set(['/']);
const QUIET_ROUTE_PREFIXES = [
    '/login',
    '/register',
    '/onboarding',
    '/entry/new',
    '/entry/edit',
    '/chat',
    '/portfolio',
    '/import',
    '/profile/edit',
    '/admin',
];

const emptyDailyCounters = (): DailyEngagementCounters => ({
    smartShown: 0,
    smartAccepted: 0,
    smartDismissed: 0,
    progressiveShown: 0,
    progressiveAccepted: 0,
    progressiveDismissed: 0,
});

const defaultState = (): EngagementState => ({
    version: 1,
    days: {},
    dismissStreaks: {
        smart: 0,
        progressive: 0,
    },
});

const defaultSession = (date = new Date()): EngagementSession => {
    const timestamp = date.toISOString();
    return {
        startedAt: timestamp,
        lastInteractionAt: timestamp,
        smartShown: 0,
        smartDismissed: 0,
        progressiveShown: 0,
        progressiveDismissed: 0,
    };
};

const isBrowser = () => typeof window !== 'undefined';
const storageKey = (userId: string) => `${STORAGE_KEY_PREFIX}_${userId}`;

const getDayKey = (date = new Date()): string =>
    date.toISOString().slice(0, 10);

const parseState = (raw: string | null): EngagementState => {
    if (!raw) {
        return defaultState();
    }

    try {
        const parsed = JSON.parse(raw) as Partial<EngagementState>;
        if (!parsed || typeof parsed !== 'object') {
            return defaultState();
        }

        const days = parsed.days && typeof parsed.days === 'object' && !Array.isArray(parsed.days)
            ? Object.entries(parsed.days).reduce<Record<string, DailyEngagementCounters>>((acc, [key, value]) => {
                if (!value || typeof value !== 'object' || Array.isArray(value)) {
                    return acc;
                }

                const source = value as Partial<DailyEngagementCounters>;
                acc[key] = {
                    smartShown: typeof source.smartShown === 'number' ? source.smartShown : 0,
                    smartAccepted: typeof source.smartAccepted === 'number' ? source.smartAccepted : 0,
                    smartDismissed: typeof source.smartDismissed === 'number' ? source.smartDismissed : 0,
                    progressiveShown: typeof source.progressiveShown === 'number' ? source.progressiveShown : 0,
                    progressiveAccepted: typeof source.progressiveAccepted === 'number' ? source.progressiveAccepted : 0,
                    progressiveDismissed: typeof source.progressiveDismissed === 'number' ? source.progressiveDismissed : 0,
                };
                return acc;
            }, {})
            : {};

        return {
            version: 1,
            updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
            days,
            lastSmartPromptAt: typeof parsed.lastSmartPromptAt === 'string' ? parsed.lastSmartPromptAt : undefined,
            lastSmartPromptSignature: typeof parsed.lastSmartPromptSignature === 'string' ? parsed.lastSmartPromptSignature : undefined,
            lastProgressivePromptAt: typeof parsed.lastProgressivePromptAt === 'string' ? parsed.lastProgressivePromptAt : undefined,
            lastProgressiveQuestionId: typeof parsed.lastProgressiveQuestionId === 'string' ? parsed.lastProgressiveQuestionId : undefined,
            lastOutcomeAt: {
                smart: typeof parsed.lastOutcomeAt?.smart === 'string' ? parsed.lastOutcomeAt.smart : undefined,
                progressive: typeof parsed.lastOutcomeAt?.progressive === 'string' ? parsed.lastOutcomeAt.progressive : undefined,
            },
            lastOutcome: {
                smart: parsed.lastOutcome?.smart === 'accepted' || parsed.lastOutcome?.smart === 'dismissed'
                    ? parsed.lastOutcome.smart
                    : undefined,
                progressive: parsed.lastOutcome?.progressive === 'accepted' || parsed.lastOutcome?.progressive === 'dismissed'
                    ? parsed.lastOutcome.progressive
                    : undefined,
            },
            dismissStreaks: {
                smart: typeof parsed.dismissStreaks?.smart === 'number' ? parsed.dismissStreaks.smart : 0,
                progressive: typeof parsed.dismissStreaks?.progressive === 'number' ? parsed.dismissStreaks.progressive : 0,
            },
            session: parsed.session && typeof parsed.session === 'object' && !Array.isArray(parsed.session)
                ? {
                    startedAt: typeof parsed.session.startedAt === 'string' ? parsed.session.startedAt : new Date().toISOString(),
                    lastInteractionAt: typeof parsed.session.lastInteractionAt === 'string' ? parsed.session.lastInteractionAt : new Date().toISOString(),
                    smartShown: typeof parsed.session.smartShown === 'number' ? parsed.session.smartShown : 0,
                    smartDismissed: typeof parsed.session.smartDismissed === 'number' ? parsed.session.smartDismissed : 0,
                    progressiveShown: typeof parsed.session.progressiveShown === 'number' ? parsed.session.progressiveShown : 0,
                    progressiveDismissed: typeof parsed.session.progressiveDismissed === 'number' ? parsed.session.progressiveDismissed : 0,
                }
                : undefined,
        };
    } catch {
        return defaultState();
    }
};

const getDismissBackoffMs = (kind: EngagementKind, streak: number): number => {
    if (kind === 'smart') {
        if (streak >= 3) return 14 * 60 * 60 * 1000;
        if (streak === 2) return 10 * 60 * 60 * 1000;
        if (streak === 1) return 6 * 60 * 60 * 1000;
        return 0;
    }

    if (streak >= 3) return 18 * 60 * 60 * 1000;
    if (streak === 2) return 12 * 60 * 60 * 1000;
    if (streak === 1) return 8 * 60 * 60 * 1000;
    return 0;
};

const getTimeContextLabel = (date = new Date()): string => {
    const hour = date.getHours();
    if (hour >= 5 && hour < 10) return 'Morning';
    if (hour >= 10 && hour < 15) return 'Midday';
    if (hour >= 15 && hour < 20) return 'Afternoon';
    return 'Evening';
};

const getSignalTitle = (prompt: PromptData): string => {
    switch (prompt.signalKind) {
        case 'sleep_deficit':
            return 'Check in with today';
        case 'sleep_recovery':
            return 'Save what helped today';
        case 'activity_boost':
            return 'Save this good stretch';
        case 'activity_dip':
            return 'Name what slowed today';
        case 'recovery_strain':
            return 'Notice the pressure early';
        case 'consistency_streak':
            return 'This pattern is worth saving';
        default:
            switch (prompt.lens) {
                case 'clarity':
                    return 'Write what stands out';
                case 'memory':
                    return 'Save this moment';
                case 'productivity':
                    return 'Save what helped today';
                default:
                    return 'Write this down while it is fresh';
            }
    }
};

const getSignalReason = (prompt: PromptData): string => {
    switch (prompt.signalKind) {
        case 'sleep_deficit':
            return 'Why now: hard days can show what makes focus harder.';
        case 'sleep_recovery':
            return 'Why now: better rest makes it easier to see what helped.';
        case 'activity_boost':
            return 'Why now: good-energy moments are easiest to remember while they are fresh.';
        case 'activity_dip':
            return 'Why now: slower days can show what is getting in the way.';
        case 'recovery_strain':
            return 'Why now: naming stress early makes the pattern visible.';
        case 'consistency_streak':
            return 'Why now: steady days show habits worth keeping.';
        default:
            return 'Why now: small notes are easiest to keep when you save them soon.';
    }
};

const getSignalCta = (prompt: PromptData): string => {
    switch (prompt.lens) {
        case 'memory':
            return 'Save this';
        case 'productivity':
            return 'Save for later';
        case 'clarity':
            return 'Write now';
        default:
            return 'Write now';
    }
};

const getQuestionTitle = (question: PersonalizationQuestion): string => {
    switch (question.field) {
        case 'primaryGoal':
            return 'Pick your main goal';
        case 'focusArea':
            return 'Pick where to focus';
        case 'writingPreference':
            return 'Pick how you like to write';
        case 'experienceLevel':
            return 'Where are you now?';
        case 'outputGoals':
            return 'What should your notes become?';
        case 'starterPrompt':
            return 'Pick an easy first question';
        default:
            return 'A quick setup question';
    }
};

const getQuestionBenefit = (question: PersonalizationQuestion): string => {
    switch (question.field) {
        case 'primaryGoal':
            return 'Sharpens your prompts and suggestions.';
        case 'focusArea':
            return 'Keeps prompts focused on life, school, work, or both.';
        case 'writingPreference':
            return 'Prompts match a style that feels easier for you.';
        case 'experienceLevel':
            return 'Keeps guidance at the right level.';
        case 'outputGoals':
            return 'Turns notes into stories you can use later.';
        case 'starterPrompt':
            return 'An easier way to start writing.';
        default:
            return 'Makes your prompts fit better.';
    }
};

class EngagementService {
    private getState(userId: string): EngagementState {
        if (!isBrowser() || !userId) {
            return defaultState();
        }

        return parseState(window.localStorage.getItem(storageKey(userId)));
    }

    private saveState(userId: string, state: EngagementState): void {
        if (!isBrowser() || !userId) {
            return;
        }

        window.localStorage.setItem(storageKey(userId), JSON.stringify({
            ...state,
            updatedAt: new Date().toISOString(),
        }));
    }

    private getDailyCounters(state: EngagementState, dayKey = getDayKey()): DailyEngagementCounters {
        return state.days[dayKey] || emptyDailyCounters();
    }

    private setDailyCounters(state: EngagementState, counters: DailyEngagementCounters, dayKey = getDayKey()): EngagementState {
        return {
            ...state,
            days: {
                ...state.days,
                [dayKey]: counters,
            },
        };
    }

    private getSession(state: EngagementState, now = new Date()): EngagementSession {
        const existing = state.session;
        if (!existing) {
            return defaultSession(now);
        }

        const lastInteractionAt = Date.parse(existing.lastInteractionAt);
        if (!Number.isFinite(lastInteractionAt) || now.getTime() - lastInteractionAt > SESSION_IDLE_WINDOW_MS) {
            return defaultSession(now);
        }

        return existing;
    }

    private withSession(
        state: EngagementState,
        updater: (session: EngagementSession) => EngagementSession,
        now = new Date()
    ): EngagementState {
        const nextSession = updater(this.getSession(state, now));
        return {
            ...state,
            session: {
                ...nextSession,
                lastInteractionAt: now.toISOString(),
            },
        };
    }

    private getRecentCounters(state: EngagementState, lookbackDays = ADAPTIVE_LOOKBACK_DAYS): DailyEngagementCounters {
        const totals = emptyDailyCounters();
        const cursor = new Date();

        for (let offset = 0; offset < lookbackDays; offset += 1) {
            const day = new Date(cursor);
            day.setUTCDate(cursor.getUTCDate() - offset);
            const counters = this.getDailyCounters(state, getDayKey(day));
            totals.smartShown += counters.smartShown;
            totals.smartAccepted += counters.smartAccepted;
            totals.smartDismissed += counters.smartDismissed;
            totals.progressiveShown += counters.progressiveShown;
            totals.progressiveAccepted += counters.progressiveAccepted;
            totals.progressiveDismissed += counters.progressiveDismissed;
        }

        return totals;
    }

    private getOutcomeCounts(counters: DailyEngagementCounters, kind: EngagementKind) {
        if (kind === 'smart') {
            return {
                shown: counters.smartShown,
                accepted: counters.smartAccepted,
                dismissed: counters.smartDismissed,
            };
        }

        return {
            shown: counters.progressiveShown,
            accepted: counters.progressiveAccepted,
            dismissed: counters.progressiveDismissed,
        };
    }

    private getAdaptivePacing(kind: EngagementKind, state: EngagementState) {
        const baseDailyLimit = kind === 'smart' ? SMART_PROMPT_DAILY_LIMIT : PROGRESSIVE_PROMPT_DAILY_LIMIT;
        const baseMinGapMs = kind === 'smart' ? SMART_PROMPT_MIN_GAP_MS : PROGRESSIVE_PROMPT_MIN_GAP_MS;
        const recent = this.getOutcomeCounts(this.getRecentCounters(state), kind);
        const dismissRate = recent.shown > 0 ? recent.dismissed / recent.shown : 0;
        const acceptRate = recent.shown > 0 ? recent.accepted / recent.shown : 0;
        const resistantAudience = recent.shown >= 6 && recent.dismissed >= 4;
        const lowFit = recent.shown >= 4 && dismissRate >= 0.6 && acceptRate <= 0.2;

        return {
            dailyLimit: Math.max(1, baseDailyLimit - (lowFit ? 1 : 0)),
            minGapMs: Math.round(baseMinGapMs * (resistantAudience ? 2 : lowFit ? 1.5 : 1)),
        };
    }

    private getLastOutcomeAt(state: EngagementState, kind: EngagementKind): number {
        const value = state.lastOutcomeAt?.[kind];
        if (!value) {
            return NaN;
        }

        return Date.parse(value);
    }

    shouldSuppressForPath(pathname: string | null | undefined): boolean {
        if (!pathname) {
            return false;
        }

        if (QUIET_ROUTE_EXACT.has(pathname)) {
            return true;
        }

        return QUIET_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
    }

    getSmartPromptSignature(prompt: PromptData): string {
        return [
            prompt.source,
            prompt.lens || 'none',
            prompt.signalKind || 'none',
            prompt.metric || 'none',
            prompt.category,
        ].join('|');
    }

    canShowSmartPrompt(userId: string, prompt: PromptData): boolean {
        if (!isBrowser() || !userId) {
            return true;
        }

        const state = this.getState(userId);
        const today = this.getDailyCounters(state);
        const session = this.getSession(state);
        const pacing = this.getAdaptivePacing('smart', state);
        if (today.smartShown >= pacing.dailyLimit || today.smartDismissed >= 2 || session.smartShown >= SMART_SESSION_LIMIT) {
            return false;
        }

        const now = Date.now();
        const lastShownAt = state.lastSmartPromptAt ? Date.parse(state.lastSmartPromptAt) : NaN;
        if (Number.isFinite(lastShownAt) && now - lastShownAt < pacing.minGapMs) {
            return false;
        }

        const repeatSignature = this.getSmartPromptSignature(prompt);
        if (
            state.lastSmartPromptSignature === repeatSignature &&
            Number.isFinite(lastShownAt) &&
            now - lastShownAt < SMART_PROMPT_REPEAT_WINDOW_MS
        ) {
            return false;
        }

        const lastOutcome = state.lastOutcome?.smart;
        const lastOutcomeAt = this.getLastOutcomeAt(state, 'smart');
        if (lastOutcome === 'accepted' && Number.isFinite(lastOutcomeAt) && now - lastOutcomeAt < SMART_ACCEPTED_COOLDOWN_MS) {
            return false;
        }

        const dismissBackoffMs = getDismissBackoffMs('smart', state.dismissStreaks.smart);
        if (lastOutcome === 'dismissed' && dismissBackoffMs > 0 && Number.isFinite(lastOutcomeAt) && now - lastOutcomeAt < dismissBackoffMs) {
            return false;
        }

        return true;
    }

    recordSmartPromptShown(userId: string, prompt: PromptData): void {
        if (!isBrowser() || !userId) {
            return;
        }

        const state = this.getState(userId);
        const counters = this.getDailyCounters(state);
        const now = new Date();
        const nextState = this.withSession(this.setDailyCounters({
            ...state,
            lastSmartPromptAt: now.toISOString(),
            lastSmartPromptSignature: this.getSmartPromptSignature(prompt),
        }, {
            ...counters,
            smartShown: counters.smartShown + 1,
        }), (session) => ({
            ...session,
            smartShown: session.smartShown + 1,
        }), now);
        this.saveState(userId, nextState);
    }

    recordSmartPromptOutcome(userId: string, outcome: EngagementOutcome): void {
        if (!isBrowser() || !userId) {
            return;
        }

        const state = this.getState(userId);
        const counters = this.getDailyCounters(state);
        const now = new Date();
        const nextState = this.withSession({
            ...state,
            lastOutcome: {
                ...state.lastOutcome,
                smart: outcome,
            },
            lastOutcomeAt: {
                ...state.lastOutcomeAt,
                smart: now.toISOString(),
            },
            dismissStreaks: {
                ...state.dismissStreaks,
                smart: outcome === 'dismissed' ? state.dismissStreaks.smart + 1 : 0,
            },
        }, (session) => ({
            ...session,
            smartDismissed: session.smartDismissed + (outcome === 'dismissed' ? 1 : 0),
        }), now);

        this.saveState(userId, this.setDailyCounters(nextState, {
            ...counters,
            smartAccepted: counters.smartAccepted + (outcome === 'accepted' ? 1 : 0),
            smartDismissed: counters.smartDismissed + (outcome === 'dismissed' ? 1 : 0),
        }));
    }

    canShowProgressivePrompt(userId: string, questionId: string): boolean {
        if (!isBrowser() || !userId) {
            return true;
        }

        const state = this.getState(userId);
        const today = this.getDailyCounters(state);
        const session = this.getSession(state);
        const pacing = this.getAdaptivePacing('progressive', state);
        if (today.progressiveShown >= pacing.dailyLimit || today.progressiveDismissed >= 1 || session.progressiveShown >= PROGRESSIVE_SESSION_LIMIT) {
            return false;
        }

        const now = Date.now();
        const lastShownAt = state.lastProgressivePromptAt ? Date.parse(state.lastProgressivePromptAt) : NaN;
        if (Number.isFinite(lastShownAt) && now - lastShownAt < pacing.minGapMs) {
            return false;
        }

        if (
            state.lastProgressiveQuestionId === questionId &&
            Number.isFinite(lastShownAt) &&
            now - lastShownAt < PROGRESSIVE_PROMPT_REPEAT_WINDOW_MS
        ) {
            return false;
        }

        const lastOutcome = state.lastOutcome?.progressive;
        const lastOutcomeAt = this.getLastOutcomeAt(state, 'progressive');
        if (
            lastOutcome === 'accepted' &&
            Number.isFinite(lastOutcomeAt) &&
            now - lastOutcomeAt < PROGRESSIVE_ACCEPTED_COOLDOWN_MS
        ) {
            return false;
        }

        const dismissBackoffMs = getDismissBackoffMs('progressive', state.dismissStreaks.progressive);
        if (lastOutcome === 'dismissed' && dismissBackoffMs > 0 && Number.isFinite(lastOutcomeAt) && now - lastOutcomeAt < dismissBackoffMs) {
            return false;
        }

        return true;
    }

    recordProgressivePromptShown(userId: string, questionId: string): void {
        if (!isBrowser() || !userId) {
            return;
        }

        const state = this.getState(userId);
        const counters = this.getDailyCounters(state);
        const now = new Date();
        const nextState = this.withSession(this.setDailyCounters({
            ...state,
            lastProgressivePromptAt: now.toISOString(),
            lastProgressiveQuestionId: questionId,
        }, {
            ...counters,
            progressiveShown: counters.progressiveShown + 1,
        }), (session) => ({
            ...session,
            progressiveShown: session.progressiveShown + 1,
        }), now);
        this.saveState(userId, nextState);
    }

    recordProgressivePromptOutcome(userId: string, outcome: EngagementOutcome): void {
        if (!isBrowser() || !userId) {
            return;
        }

        const state = this.getState(userId);
        const counters = this.getDailyCounters(state);
        const now = new Date();
        const nextState = this.withSession({
            ...state,
            lastOutcome: {
                ...state.lastOutcome,
                progressive: outcome,
            },
            lastOutcomeAt: {
                ...state.lastOutcomeAt,
                progressive: now.toISOString(),
            },
            dismissStreaks: {
                ...state.dismissStreaks,
                progressive: outcome === 'dismissed' ? state.dismissStreaks.progressive + 1 : 0,
            },
        }, (session) => ({
            ...session,
            progressiveDismissed: session.progressiveDismissed + (outcome === 'dismissed' ? 1 : 0),
        }), now);

        this.saveState(userId, this.setDailyCounters(nextState, {
            ...counters,
            progressiveAccepted: counters.progressiveAccepted + (outcome === 'accepted' ? 1 : 0),
            progressiveDismissed: counters.progressiveDismissed + (outcome === 'dismissed' ? 1 : 0),
        }));
    }

    getSmartPromptPresentation(prompt: PromptData): SmartPromptPresentation {
        return {
            eyebrow: `Good time to write · ${getTimeContextLabel()}`,
            title: getSignalTitle(prompt),
            body: prompt.text,
            reason: getSignalReason(prompt),
            ctaLabel: getSignalCta(prompt),
            laterLabel: 'Not now',
        };
    }

    getProgressivePromptPresentation(question: PersonalizationQuestion): ProgressivePromptPresentation {
        return {
            eyebrow: 'Quick setup',
            title: getQuestionTitle(question),
            helper: question.prompt,
            benefit: getQuestionBenefit(question),
            laterLabel: 'Later',
            setupLabel: 'Open all settings',
        };
    }
}

export const engagementService = new EngagementService();
export default engagementService;
