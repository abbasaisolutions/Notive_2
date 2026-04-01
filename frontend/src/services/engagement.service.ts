import type { PromptData } from '@/services/context.service';
import type { PersonalizationQuestion } from '@/services/progressive-personalization.service';
import {
    PROGRESSIVE_PROMPT_FRAMING_EXPERIMENT_ID,
    SMART_PROMPT_FRAMING_EXPERIMENT_ID,
    type ProgressivePromptFramingVariant,
    type SmartPromptFramingVariant,
    resolveProgressivePromptFramingVariant,
    resolveSmartPromptFramingVariant,
} from '@/content/notive-voice';

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
    experimentId: string;
    framingVariant: SmartPromptFramingVariant;
    eyebrow: string;
    title: string;
    body: string;
    reason: string;
    ctaLabel: string;
    laterLabel: string;
};

type ProgressivePromptPresentation = {
    experimentId: string;
    framingVariant: ProgressivePromptFramingVariant;
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

const getMomentumTitle = (prompt: PromptData): string => {
    switch (prompt.signalKind) {
        case 'sleep_deficit':
            return 'Slow down and check in';
        case 'sleep_recovery':
            return 'Use this good start';
        case 'activity_boost':
            return 'Keep this good pace';
        case 'activity_dip':
            return 'Reset before the day drifts';
        case 'recovery_strain':
            return 'Ease the load now';
        case 'consistency_streak':
            return 'Keep this habit going';
        default:
            switch (prompt.lens) {
                case 'clarity':
                    return 'Find the next step';
                case 'memory':
                    return 'Save this good stretch';
                case 'productivity':
                    return 'Save what moved today forward';
                default:
                    return 'Keep the day moving';
            }
    }
};

const getStoryTitle = (prompt: PromptData): string => {
    switch (prompt.signalKind) {
        case 'sleep_deficit':
            return 'Save what this hard day is showing';
        case 'sleep_recovery':
            return 'Save what made today easier';
        case 'activity_boost':
            return 'This could become a strong story';
        case 'activity_dip':
            return 'Save what slowed things down';
        case 'recovery_strain':
            return 'Name what feels heavy';
        case 'consistency_streak':
            return 'This habit could become a story';
        default:
            switch (prompt.lens) {
                case 'clarity':
                    return 'Name what stands out';
                case 'memory':
                    return 'Save this story';
                case 'productivity':
                    return 'Save what made today work';
                default:
                    return 'Turn this moment into a story';
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
            return 'Why now: naming stress early helps Notive see the pattern.';
        case 'consistency_streak':
            return 'Why now: steady days show habits worth keeping.';
        default:
            return 'Why now: small notes are easiest to keep when you save them soon.';
    }
};

const getMomentumReason = (prompt: PromptData): string => {
    switch (prompt.signalKind) {
        case 'sleep_deficit':
            return 'Why now: a short note can help a hard day feel more manageable.';
        case 'sleep_recovery':
            return 'Why now: when you feel better, it is easier to notice what helped.';
        case 'activity_boost':
            return 'Why now: a good stretch is easier to repeat when you name what helped.';
        case 'activity_dip':
            return 'Why now: slow days can show the blocker you may want to change.';
        case 'recovery_strain':
            return 'Why now: small check-ins help before stress becomes normal.';
        case 'consistency_streak':
            return 'Why now: habits grow faster when you notice what is helping.';
        default:
            return 'Why now: a quick note can help the rest of the day.';
    }
};

const getStoryReason = (prompt: PromptData): string => {
    switch (prompt.signalKind) {
        case 'sleep_deficit':
            return 'Why now: hard days can turn into honest stories later.';
        case 'sleep_recovery':
            return 'Why now: good days are easy to forget unless you save what helped.';
        case 'activity_boost':
            return 'Why now: strong days often hold your clearest story details.';
        case 'activity_dip':
            return 'Why now: even slow days can show something important.';
        case 'recovery_strain':
            return 'Why now: words can help you understand pressure while it is fresh.';
        case 'consistency_streak':
            return 'Why now: a steady stretch can become a story you use later.';
        default:
            return 'Why now: everyday moments can become useful stories later.';
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

const getMomentumCta = (prompt: PromptData): string => {
    switch (prompt.lens) {
        case 'memory':
            return 'Keep this';
        case 'productivity':
            return 'Save what helped';
        case 'clarity':
            return 'Next step';
        default:
            return 'Write a quick note';
    }
};

const getStoryCta = (prompt: PromptData): string => {
    switch (prompt.lens) {
        case 'memory':
            return 'Save the story';
        case 'productivity':
            return 'Use this story';
        case 'clarity':
            return 'Name it';
        default:
            return 'Save the story';
    }
};

const getFramingEyebrow = (variant: SmartPromptFramingVariant): string => {
    switch (variant) {
        case 'momentum':
            return 'Small next step';
        case 'story':
            return 'Story idea';
        default:
            return 'Good time to write';
    }
};

const getQuestionTitle = (question: PersonalizationQuestion): string => {
    switch (question.field) {
        case 'primaryGoal':
            return 'Pick what Notive should help with most';
        case 'focusArea':
            return 'Pick where Notive should focus';
        case 'writingPreference':
            return 'Pick how you like to write';
        case 'experienceLevel':
            return 'Tell Notive where you are now';
        case 'outputGoals':
            return 'Pick what you want to use your notes for';
        case 'starterPrompt':
            return 'Pick an easy first question';
        default:
            return 'Help Notive fit you better';
    }
};

const getQuestionBenefitTitle = (question: PersonalizationQuestion): string => {
    switch (question.field) {
        case 'primaryGoal':
            return 'Help Notive ask better questions';
        case 'focusArea':
            return 'Show what part of life matters most';
        case 'writingPreference':
            return 'Make writing feel easier';
        case 'experienceLevel':
            return 'Help Notive meet you where you are';
        case 'outputGoals':
            return 'Show what your notes should grow into';
        case 'starterPrompt':
            return 'Make it easier to start';
        default:
            return 'Help Notive fit you better';
    }
};

const getQuestionFutureTitle = (question: PersonalizationQuestion): string => {
    switch (question.field) {
        case 'primaryGoal':
            return 'Set what future notes should help with';
        case 'focusArea':
            return 'Choose what future notes should focus on';
        case 'writingPreference':
            return 'Choose a writing style you will keep using';
        case 'experienceLevel':
            return 'Set the right starting point';
        case 'outputGoals':
            return 'Choose what your notes can become';
        case 'starterPrompt':
            return 'Choose the first question you want later';
        default:
            return 'Set up Notive for later';
    }
};

const getQuestionBenefit = (question: PersonalizationQuestion): string => {
    switch (question.field) {
        case 'primaryGoal':
            return 'This helps Notive ask better questions and show the right help.';
        case 'focusArea':
            return 'This helps Notive focus on life, school, work, or both.';
        case 'writingPreference':
            return 'This helps Notive use a style that feels easier for you.';
        case 'experienceLevel':
            return 'This helps Notive match its help to where you are now.';
        case 'outputGoals':
            return 'This helps turn notes into stories you can use later.';
        case 'starterPrompt':
            return 'This gives you an easier way to start writing.';
        default:
            return 'This helps Notive fit you better.';
    }
};

const getQuestionFutureBenefit = (question: PersonalizationQuestion): string => {
    switch (question.field) {
        case 'primaryGoal':
            return 'This keeps future prompts focused on the progress you care about.';
        case 'focusArea':
            return 'This keeps future notes focused on the part of life you want to understand most.';
        case 'writingPreference':
            return 'This helps future writing feel natural for you.';
        case 'experienceLevel':
            return 'This keeps future help at the right level.';
        case 'outputGoals':
            return 'This gives future notes a clear use later.';
        case 'starterPrompt':
            return 'This makes future check-ins easier to start.';
        default:
            return 'This keeps Notive useful later.';
    }
};

const getProgressiveFramingEyebrow = (variant: ProgressivePromptFramingVariant): string => {
    switch (variant) {
        case 'benefit':
            return 'Make Notive fit you';
        case 'future':
            return 'Set up later';
        default:
            return 'Help Notive know you';
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

    getSmartPromptPresentation(prompt: PromptData, userId?: string): SmartPromptPresentation {
        const framingVariant = resolveSmartPromptFramingVariant(userId || '');
        const timeContext = getTimeContextLabel();

        const title = framingVariant === 'momentum'
            ? getMomentumTitle(prompt)
            : framingVariant === 'story'
                ? getStoryTitle(prompt)
                : getSignalTitle(prompt);
        const reason = framingVariant === 'momentum'
            ? getMomentumReason(prompt)
            : framingVariant === 'story'
                ? getStoryReason(prompt)
                : getSignalReason(prompt);
        const ctaLabel = framingVariant === 'momentum'
            ? getMomentumCta(prompt)
            : framingVariant === 'story'
                ? getStoryCta(prompt)
                : getSignalCta(prompt);

        return {
            experimentId: SMART_PROMPT_FRAMING_EXPERIMENT_ID,
            framingVariant,
            eyebrow: `${getFramingEyebrow(framingVariant)} · ${timeContext}`,
            title,
            body: prompt.text,
            reason,
            ctaLabel,
            laterLabel: 'Not now',
        };
    }

    getProgressivePromptPresentation(question: PersonalizationQuestion, userId?: string): ProgressivePromptPresentation {
        const framingVariant = resolveProgressivePromptFramingVariant(userId || '');
        const title = framingVariant === 'benefit'
            ? getQuestionBenefitTitle(question)
            : framingVariant === 'future'
                ? getQuestionFutureTitle(question)
                : getQuestionTitle(question);
        const benefit = framingVariant === 'future'
            ? getQuestionFutureBenefit(question)
            : getQuestionBenefit(question);

        return {
            experimentId: PROGRESSIVE_PROMPT_FRAMING_EXPERIMENT_ID,
            framingVariant,
            eyebrow: getProgressiveFramingEyebrow(framingVariant),
            title,
            helper: question.prompt,
            benefit,
            laterLabel: 'Later',
            setupLabel: 'Open all settings',
        };
    }
}

export const engagementService = new EngagementService();
export default engagementService;
