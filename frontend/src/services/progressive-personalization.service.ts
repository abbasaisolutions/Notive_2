import {
    OnboardingExperienceLevel,
    OnboardingGoal,
    OnboardingOutputGoal,
    OnboardingTrack,
    OnboardingWritingPreference,
} from '@/utils/onboarding';

export type PersonalizationField =
    | 'primaryGoal'
    | 'focusArea'
    | 'writingPreference'
    | 'experienceLevel'
    | 'outputGoals'
    | 'starterPrompt';

export type PromptFrequency = 'off' | 'low' | 'normal' | 'high';

export interface PersonalizationProfileSnapshot {
    primaryGoal?: string | null;
    focusArea?: string | null;
    writingPreference?: string | null;
    experienceLevel?: string | null;
    outputGoals?: string[] | null;
    starterPrompt?: string | null;
    personalizationSignals?: Record<string, unknown> | null;
    onboardingCompletedAt?: string | null;
}

export interface PersonalizationQuestionOption {
    value: string;
    label: string;
}

export interface PersonalizationQuestion {
    id: string;
    field: PersonalizationField;
    prompt: string;
    helper?: string;
    options: PersonalizationQuestionOption[];
    routeHints?: string[];
}

export interface StoredAnswer {
    questionId: string;
    field: PersonalizationField;
    value: string;
    label: string;
    answeredAt: string;
    pathname?: string;
}

export interface ProgressivePersonalizationMetrics {
    promptedCount: number;
    answeredCount: number;
    dismissedCount: number;
    lastActionAt?: string;
}

export interface ProgressivePersonalizationSettings {
    promptFrequency: PromptFrequency;
}

interface ProgressivePersonalizationState {
    answers: Partial<Record<PersonalizationField, StoredAnswer>>;
    history: StoredAnswer[];
    seenQuestionIds: string[];
    metrics: ProgressivePersonalizationMetrics;
    settings: ProgressivePersonalizationSettings;
    lastPromptAt?: string;
    dismissedUntil?: string;
    lastSyncedSignature?: string;
}

type GetNextQuestionInput = {
    userId: string;
    profile?: PersonalizationProfileSnapshot | null;
    pathname?: string | null;
};

type MarkPromptShownInput = {
    userId: string;
    questionId: string;
};

type RecordAnswerInput = {
    userId: string;
    question: PersonalizationQuestion;
    value: string;
    pathname?: string | null;
};

type SnoozeInput = {
    userId: string;
    minutes?: number;
};

type SetPromptFrequencyInput = {
    userId: string;
    frequency: PromptFrequency;
};

type BuildPatchInput = {
    profile?: PersonalizationProfileSnapshot | null;
    state: ProgressivePersonalizationState;
};

type ShouldSyncPatchInput = {
    patch: Record<string, unknown>;
    state: ProgressivePersonalizationState;
};

type MarkPatchSyncedInput = {
    userId: string;
    patch: Record<string, unknown>;
};

const STORAGE_KEY_PREFIX = 'notive_progressive_personalization_v1';
const DEFAULT_SNOOZE_MINUTES = 90;
const ACTIVE_HOUR_START = 7;
const ACTIVE_HOUR_END = 23;
const DEFAULT_PROMPT_FREQUENCY: PromptFrequency = 'normal';
const PROMPT_COOLDOWN_BY_FREQUENCY_MS: Record<Exclude<PromptFrequency, 'off'>, number> = {
    low: 90 * 60 * 1000,
    normal: 30 * 60 * 1000,
    high: 15 * 60 * 1000,
};
const POLLING_INTERVAL_BY_FREQUENCY_MS: Record<Exclude<PromptFrequency, 'off'>, number> = {
    low: 5 * 60 * 1000,
    normal: 2 * 60 * 1000,
    high: 60 * 1000,
};

const GOAL_VALUES: OnboardingGoal[] = ['clarity', 'memory', 'growth', 'productivity'];
const TRACK_VALUES: OnboardingTrack[] = ['life', 'career', 'both'];
const WRITING_VALUES: OnboardingWritingPreference[] = ['guided', 'structured', 'freeform'];
const EXPERIENCE_VALUES: OnboardingExperienceLevel[] = ['student', 'early-career', 'professional', 'lifelong-learner'];
const OUTPUT_VALUES: OnboardingOutputGoal[] = ['self-growth', 'college-statement', 'resume-stories', 'interview-examples', 'portfolio'];
const GOAL_VALUE_SET = new Set<OnboardingGoal>(GOAL_VALUES);
const TRACK_VALUE_SET = new Set<OnboardingTrack>(TRACK_VALUES);
const WRITING_VALUE_SET = new Set<OnboardingWritingPreference>(WRITING_VALUES);
const EXPERIENCE_VALUE_SET = new Set<OnboardingExperienceLevel>(EXPERIENCE_VALUES);
const OUTPUT_VALUE_SET = new Set<OnboardingOutputGoal>(OUTPUT_VALUES);

const CORE_FIELD_SET = new Set<PersonalizationField>(['primaryGoal', 'focusArea', 'starterPrompt']);

const HIDDEN_PATH_PREFIXES = [
    '/login',
    '/register',
    '/onboarding',
    '/forgot-password',
    '/reset-password',
    '/terms',
    '/privacy',
    '/share',
    '/entry/new',
    '/entry/edit',
];

const QUESTION_BANK: PersonalizationQuestion[] = [
    {
        id: 'goal_priority',
        field: 'primaryGoal',
        prompt: 'What do you want Notive to help with most?',
        helper: 'This helps Notive ask better questions and show better help.',
        options: [
            { value: 'clarity', label: 'Clear mind' },
            { value: 'memory', label: 'Remember life' },
            { value: 'growth', label: 'Grow' },
            { value: 'productivity', label: 'Get things done' },
        ],
        routeHints: ['/dashboard', '/insights'],
    },
    {
        id: 'focus_area',
        field: 'focusArea',
        prompt: 'What part of life should Notive focus on first?',
        helper: 'This helps Notive focus on life, school, work, or both.',
        options: [
            { value: 'life', label: 'Life' },
            { value: 'career', label: 'School and work' },
            { value: 'both', label: 'Both' },
        ],
        routeHints: ['/dashboard', '/timeline'],
    },
    {
        id: 'writing_preference',
        field: 'writingPreference',
        prompt: 'How do you want writing to feel?',
        helper: 'This helps Notive use a writing style that feels easier for you.',
        options: [
            { value: 'guided', label: 'With questions' },
            { value: 'structured', label: 'Step by step' },
            { value: 'freeform', label: 'Free writing' },
        ],
        routeHints: ['/entry/view', '/timeline'],
    },
    {
        id: 'experience_level',
        field: 'experienceLevel',
        prompt: 'Where are you right now?',
        helper: 'A little context helps Notive give better help.',
        options: [
            { value: 'student', label: 'Student' },
            { value: 'early-career', label: 'Early career' },
            { value: 'professional', label: 'Professional' },
            { value: 'lifelong-learner', label: 'Lifelong learner' },
        ],
        routeHints: ['/dashboard', '/profile'],
    },
    {
        id: 'output_goal',
        field: 'outputGoals',
        prompt: 'What do you want to use your notes for later?',
        helper: 'This helps Notive turn notes into stories you can use.',
        options: [
            { value: 'self-growth', label: 'Know myself better' },
            { value: 'college-statement', label: 'School statement' },
            { value: 'resume-stories', label: 'Resume stories' },
            { value: 'interview-examples', label: 'Interview stories' },
            { value: 'portfolio', label: 'Stories for school or work' },
        ],
        routeHints: ['/portfolio', '/chapters', '/insights'],
    },
    {
        id: 'starter_prompt',
        field: 'starterPrompt',
        prompt: 'Pick an easy first question.',
        helper: 'You can change this anytime if your writing style changes.',
        options: [
            { value: 'What happened today that I want to remember?', label: 'What happened today?' },
            { value: 'What felt hard today, and how did I respond?', label: 'What felt hard?' },
            { value: 'What helped today move forward?', label: 'What helped today?' },
        ],
        routeHints: ['/dashboard', '/timeline'],
    },
];

const isBrowser = () => typeof window !== 'undefined';
const storageKey = (userId: string) => `${STORAGE_KEY_PREFIX}_${userId}`;

const hasText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const dedupeStrings = (items: string[]): string[] => {
    const normalized = items
        .map((item) => item.trim())
        .filter(Boolean);
    return Array.from(new Set(normalized));
};

const appendUniqueString = (items: string[], value: string): string[] =>
    items.includes(value) ? items : [...items, value];

const asPromptFrequency = (value: unknown): PromptFrequency =>
    value === 'off' || value === 'low' || value === 'normal' || value === 'high'
        ? value
        : DEFAULT_PROMPT_FREQUENCY;

const normalizeMetrics = (metrics: unknown): ProgressivePersonalizationMetrics => {
    if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) {
        return {
            promptedCount: 0,
            answeredCount: 0,
            dismissedCount: 0,
        };
    }

    const source = metrics as Record<string, unknown>;
    return {
        promptedCount: typeof source.promptedCount === 'number' ? source.promptedCount : 0,
        answeredCount: typeof source.answeredCount === 'number' ? source.answeredCount : 0,
        dismissedCount: typeof source.dismissedCount === 'number' ? source.dismissedCount : 0,
        lastActionAt: hasText(source.lastActionAt) ? source.lastActionAt : undefined,
    };
};

const normalizeSettings = (settings: unknown): ProgressivePersonalizationSettings => {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        return {
            promptFrequency: DEFAULT_PROMPT_FREQUENCY,
        };
    }

    const source = settings as Record<string, unknown>;
    return {
        promptFrequency: asPromptFrequency(source.promptFrequency),
    };
};

const isPathHidden = (pathname?: string | null): boolean => {
    if (!pathname) return true;
    return HIDDEN_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
};

const defaultState = (): ProgressivePersonalizationState => ({
    answers: {},
    history: [],
    seenQuestionIds: [],
    metrics: {
        promptedCount: 0,
        answeredCount: 0,
        dismissedCount: 0,
    },
    settings: {
        promptFrequency: DEFAULT_PROMPT_FREQUENCY,
    },
});

const buildSignature = (patch: Record<string, unknown>): string => {
    const sorted = Object.keys(patch)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
            acc[key] = patch[key];
            return acc;
        }, {});
    return JSON.stringify(sorted);
};

const parseState = (raw: string | null): ProgressivePersonalizationState => {
    if (!raw) return defaultState();

    try {
        const parsed = JSON.parse(raw) as Partial<ProgressivePersonalizationState>;
        if (!parsed || typeof parsed !== 'object') return defaultState();

        const answersSource = parsed.answers && typeof parsed.answers === 'object' && !Array.isArray(parsed.answers)
            ? (parsed.answers as Partial<Record<PersonalizationField, StoredAnswer>>)
            : {};

        const historySource = Array.isArray(parsed.history) ? parsed.history : [];
        const seenQuestionIds = Array.isArray(parsed.seenQuestionIds)
            ? dedupeStrings(parsed.seenQuestionIds.filter((item): item is string => typeof item === 'string'))
            : [];

        const history = historySource.filter((item): item is StoredAnswer =>
            !!item &&
            typeof item === 'object' &&
            typeof (item as StoredAnswer).questionId === 'string' &&
            typeof (item as StoredAnswer).field === 'string' &&
            typeof (item as StoredAnswer).value === 'string' &&
            typeof (item as StoredAnswer).label === 'string' &&
            typeof (item as StoredAnswer).answeredAt === 'string'
        );

        return {
            answers: answersSource,
            history,
            seenQuestionIds,
            metrics: normalizeMetrics(parsed.metrics),
            settings: normalizeSettings(parsed.settings),
            lastPromptAt: hasText(parsed.lastPromptAt) ? parsed.lastPromptAt : undefined,
            dismissedUntil: hasText(parsed.dismissedUntil) ? parsed.dismissedUntil : undefined,
            lastSyncedSignature: hasText(parsed.lastSyncedSignature) ? parsed.lastSyncedSignature : undefined,
        };
    } catch {
        return defaultState();
    }
};

const sanitizeOptionValue = (field: PersonalizationField, value: string): string | null => {
    if (!hasText(value)) return null;
    const trimmed = value.trim();

    switch (field) {
        case 'primaryGoal':
            return GOAL_VALUE_SET.has(trimmed as OnboardingGoal) ? trimmed : null;
        case 'focusArea':
            return TRACK_VALUE_SET.has(trimmed as OnboardingTrack) ? trimmed : null;
        case 'writingPreference':
            return WRITING_VALUE_SET.has(trimmed as OnboardingWritingPreference) ? trimmed : null;
        case 'experienceLevel':
            return EXPERIENCE_VALUE_SET.has(trimmed as OnboardingExperienceLevel) ? trimmed : null;
        case 'outputGoals':
            return OUTPUT_VALUE_SET.has(trimmed as OnboardingOutputGoal) ? trimmed : null;
        case 'starterPrompt':
            return trimmed.slice(0, 5000);
        default:
            return null;
    }
};

const hasFieldValue = (profile: PersonalizationProfileSnapshot | null | undefined, field: PersonalizationField): boolean => {
    if (!profile) return false;

    if (field === 'outputGoals') {
        return Array.isArray(profile.outputGoals) && profile.outputGoals.some((item) => hasText(item));
    }

    const value = profile[field];
    return hasText(value);
};

const getSignalsObject = (profile: PersonalizationProfileSnapshot | null | undefined): Record<string, unknown> | null => {
    const signals = profile?.personalizationSignals;
    if (!signals || typeof signals !== 'object' || Array.isArray(signals)) {
        return null;
    }
    return signals;
};

const getSignalAnswersObject = (
    profile: PersonalizationProfileSnapshot | null | undefined
): Record<string, unknown> | null => {
    const signals = getSignalsObject(profile);
    if (!signals) return null;

    const answers = signals.answers;
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
        return null;
    }

    return answers as Record<string, unknown>;
};

const getProfileSignalAnswers = (
    profile: PersonalizationProfileSnapshot | null | undefined
): Partial<Record<PersonalizationField, string>> => {
    const signalAnswers: Partial<Record<PersonalizationField, string>> = {};
    const answers = getSignalAnswersObject(profile);
    if (!answers) {
        return signalAnswers;
    }

    QUESTION_BANK.forEach((question) => {
        const value = answers[question.field];
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return;
        }

        const answerValue = (value as Record<string, unknown>).value;
        if (hasText(answerValue)) {
            signalAnswers[question.field] = answerValue.trim();
        }
    });

    return signalAnswers;
};

const getPromptFrequencyFromProfile = (
    profile: PersonalizationProfileSnapshot | null | undefined
): PromptFrequency => {
    const signals = getSignalsObject(profile);
    if (!signals) return DEFAULT_PROMPT_FREQUENCY;

    const settings = signals.settings;
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        return DEFAULT_PROMPT_FREQUENCY;
    }

    return asPromptFrequency((settings as Record<string, unknown>).promptFrequency);
};

const getSuggestedStarterPrompt = (
    goal: OnboardingGoal,
    focusArea: OnboardingTrack
): string => {
    const goalMap: Record<OnboardingGoal, string> = {
        clarity: 'What is on my mind right now, and what is one clear next step?',
        memory: 'What meaningful moment from today do I want to preserve?',
        growth: 'What challenge did I face today, and how did I grow from it?',
        productivity: 'What did I complete today, and what should I prioritize next?',
    };

    const focusMap: Record<OnboardingTrack, string> = {
        life: 'What did I learn about myself or my relationships today?',
        career: 'What did I do today that shows initiative, learning, or impact?',
        both: 'What did I do today that helped both my personal life and long-term goals?',
    };

    return `${goalMap[goal]} ${focusMap[focusArea]}`;
};

const getQuestionPriority = (question: PersonalizationQuestion, pathname: string): number => {
    let score = 0;
    if (question.routeHints?.some((prefix) => pathname.startsWith(prefix))) {
        score += 2;
    }
    if (CORE_FIELD_SET.has(question.field)) {
        score += 1;
    }
    return score;
};

class ProgressivePersonalizationService {
    getState(userId: string): ProgressivePersonalizationState {
        if (!isBrowser()) return defaultState();
        return parseState(localStorage.getItem(storageKey(userId)));
    }

    private saveState(userId: string, state: ProgressivePersonalizationState): void {
        if (!isBrowser()) return;
        localStorage.setItem(storageKey(userId), JSON.stringify(state));
    }

    private getPromptFrequency(
        profile: PersonalizationProfileSnapshot | null | undefined,
        state: ProgressivePersonalizationState
    ): PromptFrequency {
        const fromProfile = getPromptFrequencyFromProfile(profile);
        if (fromProfile !== DEFAULT_PROMPT_FREQUENCY) {
            return fromProfile;
        }

        return asPromptFrequency(state.settings.promptFrequency);
    }

    private isSnoozed(state: ProgressivePersonalizationState): boolean {
        if (!state.dismissedUntil) return false;
        const dismissedUntilTs = Date.parse(state.dismissedUntil);
        return !Number.isNaN(dismissedUntilTs) && dismissedUntilTs > Date.now();
    }

    private isInCooldown(state: ProgressivePersonalizationState, frequency: PromptFrequency): boolean {
        if (frequency === 'off') return true;
        if (!state.lastPromptAt) return false;
        const lastPromptTs = Date.parse(state.lastPromptAt);
        if (Number.isNaN(lastPromptTs)) return false;

        const cooldown = PROMPT_COOLDOWN_BY_FREQUENCY_MS[frequency];
        return (Date.now() - lastPromptTs) < cooldown;
    }

    private isWithinActiveHours(): boolean {
        const currentHour = new Date().getHours();
        return currentHour >= ACTIVE_HOUR_START && currentHour < ACTIVE_HOUR_END;
    }

    private getMissingFields(
        profile: PersonalizationProfileSnapshot | null | undefined,
        state: ProgressivePersonalizationState,
        signalAnswers: Partial<Record<PersonalizationField, string>>
    ): Set<PersonalizationField> {
        const missing = new Set<PersonalizationField>();

        for (const question of QUESTION_BANK) {
            const hasProfile = hasFieldValue(profile, question.field);
            const hasLocal = hasText(state.answers[question.field]?.value);
            const hasRemoteSignal = hasText(signalAnswers[question.field]);
            if (!hasProfile && !hasLocal && !hasRemoteSignal) {
                missing.add(question.field);
            }
        }

        return missing;
    }

    getNextQuestion(input: GetNextQuestionInput): PersonalizationQuestion | null {
        const { userId, profile, pathname } = input;
        if (!userId) return null;
        if (!pathname || isPathHidden(pathname)) return null;

        const state = this.getState(userId);
        const frequency = this.getPromptFrequency(profile, state);
        if (frequency === 'off') return null;
        if (!this.isWithinActiveHours()) return null;
        if (this.isSnoozed(state)) return null;
        if (this.isInCooldown(state, frequency)) return null;

        const signalAnswers = getProfileSignalAnswers(profile);
        const missingFields = this.getMissingFields(profile, state, signalAnswers);
        if (missingFields.size === 0) return null;

        const seenQuestionIds = new Set(state.seenQuestionIds);
        let bestUnseen: PersonalizationQuestion | null = null;
        let bestUnseenScore = Number.NEGATIVE_INFINITY;
        let bestSeen: PersonalizationQuestion | null = null;
        let bestSeenScore = Number.NEGATIVE_INFINITY;

        QUESTION_BANK.forEach((question) => {
            if (!missingFields.has(question.field)) {
                return;
            }

            const score = getQuestionPriority(question, pathname);
            if (seenQuestionIds.has(question.id)) {
                if (score > bestSeenScore) {
                    bestSeen = question;
                    bestSeenScore = score;
                }
                return;
            }

            if (score > bestUnseenScore) {
                bestUnseen = question;
                bestUnseenScore = score;
            }
        });

        return bestUnseen || bestSeen;
    }

    markPromptShown(input: MarkPromptShownInput): ProgressivePersonalizationState {
        const { userId, questionId } = input;
        const state = this.getState(userId);
        const timestamp = new Date().toISOString();

        const nextState: ProgressivePersonalizationState = {
            ...state,
            seenQuestionIds: appendUniqueString(state.seenQuestionIds, questionId),
            metrics: {
                ...state.metrics,
                promptedCount: state.metrics.promptedCount + 1,
                lastActionAt: timestamp,
            },
            lastPromptAt: timestamp,
        };
        this.saveState(userId, nextState);
        return nextState;
    }

    recordAnswer(input: RecordAnswerInput): ProgressivePersonalizationState {
        const { userId, question, pathname } = input;
        const normalized = sanitizeOptionValue(question.field, input.value);
        if (!normalized) {
            return this.getState(userId);
        }

        const selectedOption = question.options.find((item) => item.value === normalized);
        const timestamp = new Date().toISOString();
        const answer: StoredAnswer = {
            questionId: question.id,
            field: question.field,
            value: normalized,
            label: selectedOption?.label || normalized,
            answeredAt: timestamp,
            pathname: pathname || undefined,
        };

        const state = this.getState(userId);
        const nextState: ProgressivePersonalizationState = {
            ...state,
            answers: {
                ...state.answers,
                [question.field]: answer,
            },
            history: [...state.history, answer],
            seenQuestionIds: appendUniqueString(state.seenQuestionIds, question.id),
            metrics: {
                ...state.metrics,
                answeredCount: state.metrics.answeredCount + 1,
                lastActionAt: timestamp,
            },
            dismissedUntil: undefined,
            lastPromptAt: timestamp,
        };

        this.saveState(userId, nextState);
        return nextState;
    }

    snooze(input: SnoozeInput): ProgressivePersonalizationState {
        const { userId, minutes = DEFAULT_SNOOZE_MINUTES } = input;
        const state = this.getState(userId);
        const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
        const timestamp = new Date().toISOString();

        const nextState: ProgressivePersonalizationState = {
            ...state,
            metrics: {
                ...state.metrics,
                dismissedCount: state.metrics.dismissedCount + 1,
                lastActionAt: timestamp,
            },
            dismissedUntil: until,
            lastPromptAt: timestamp,
        };

        this.saveState(userId, nextState);
        return nextState;
    }

    setPromptFrequency(input: SetPromptFrequencyInput): ProgressivePersonalizationState {
        const { userId, frequency } = input;
        const state = this.getState(userId);
        const nextState: ProgressivePersonalizationState = {
            ...state,
            settings: {
                ...state.settings,
                promptFrequency: asPromptFrequency(frequency),
            },
        };

        this.saveState(userId, nextState);
        return nextState;
    }

    getPollingIntervalMs(profile: PersonalizationProfileSnapshot | null | undefined): number {
        const frequency = getPromptFrequencyFromProfile(profile);
        if (frequency === 'off') {
            return 15 * 60 * 1000;
        }

        return POLLING_INTERVAL_BY_FREQUENCY_MS[frequency];
    }

    buildProfilePatch(input: BuildPatchInput): Record<string, unknown> {
        const { profile, state } = input;
        const patch: Record<string, unknown> = {};
        const currentProfile = profile || null;

        for (const [field, stored] of Object.entries(state.answers) as Array<[PersonalizationField, StoredAnswer | undefined]>) {
            if (!stored || !hasText(stored.value)) continue;

            if (field === 'outputGoals') {
                const existingGoals = Array.isArray(currentProfile?.outputGoals)
                    ? dedupeStrings(currentProfile.outputGoals.filter((item): item is string => typeof item === 'string'))
                    : [];
                const merged = dedupeStrings([...existingGoals, stored.value]);
                if (merged.length > existingGoals.length) {
                    patch.outputGoals = merged;
                }
                continue;
            }

            const currentValue = currentProfile?.[field];
            if (!hasText(currentValue) || currentValue.trim() !== stored.value) {
                patch[field] = stored.value;
            }
        }

        const goal = (patch.primaryGoal as string | undefined) || (hasText(currentProfile?.primaryGoal) ? currentProfile?.primaryGoal : undefined);
        const focusArea = (patch.focusArea as string | undefined) || (hasText(currentProfile?.focusArea) ? currentProfile?.focusArea : undefined);

        if (!hasText(currentProfile?.starterPrompt) && !hasText(patch.starterPrompt) && goal && focusArea) {
            if (GOAL_VALUE_SET.has(goal as OnboardingGoal) && TRACK_VALUE_SET.has(focusArea as OnboardingTrack)) {
                patch.starterPrompt = getSuggestedStarterPrompt(goal as OnboardingGoal, focusArea as OnboardingTrack);
            }
        }

        const hasGoal = hasText((patch.primaryGoal as string | undefined) || currentProfile?.primaryGoal);
        const hasFocus = hasText((patch.focusArea as string | undefined) || currentProfile?.focusArea);
        const hasStarterPrompt = hasText((patch.starterPrompt as string | undefined) || currentProfile?.starterPrompt);
        if (hasGoal && hasFocus && hasStarterPrompt && !hasText(currentProfile?.onboardingCompletedAt)) {
            patch.onboardingCompletedAt = new Date().toISOString();
        }

        return patch;
    }

    buildSignalsPayload(state: ProgressivePersonalizationState): Record<string, unknown> {
        return {
            version: 1,
            updatedAt: new Date().toISOString(),
            settings: state.settings,
            metrics: state.metrics,
            answers: state.answers,
            history: state.history.slice(-80),
        };
    }

    buildSyncPayload(input: BuildPatchInput): Record<string, unknown> {
        const profilePatch = this.buildProfilePatch(input);
        const nextPayload: Record<string, unknown> = {
            ...profilePatch,
            personalizationSignals: this.buildSignalsPayload(input.state),
        };
        return nextPayload;
    }

    shouldSyncPatch(input: ShouldSyncPatchInput): boolean {
        const { patch, state } = input;
        if (Object.keys(patch).length === 0) return false;
        const signature = buildSignature(patch);
        return signature !== state.lastSyncedSignature;
    }

    markPatchSynced(input: MarkPatchSyncedInput): ProgressivePersonalizationState {
        const { userId, patch } = input;
        const state = this.getState(userId);
        const nextState: ProgressivePersonalizationState = {
            ...state,
            lastSyncedSignature: buildSignature(patch),
        };
        this.saveState(userId, nextState);
        return nextState;
    }

    getPromptSuggestionForProfile(profile: PersonalizationProfileSnapshot | null | undefined): string | null {
        if (hasText(profile?.starterPrompt)) {
            return profile.starterPrompt.trim();
        }

        const signalAnswers = getProfileSignalAnswers(profile);
        const goal = hasText(profile?.primaryGoal)
            ? profile.primaryGoal.trim()
            : signalAnswers.primaryGoal || null;
        const focusArea = hasText(profile?.focusArea)
            ? profile.focusArea.trim()
            : signalAnswers.focusArea || null;

        if (goal && focusArea && GOAL_VALUE_SET.has(goal as OnboardingGoal) && TRACK_VALUE_SET.has(focusArea as OnboardingTrack)) {
            return getSuggestedStarterPrompt(goal as OnboardingGoal, focusArea as OnboardingTrack);
        }

        if (goal && GOAL_VALUE_SET.has(goal as OnboardingGoal)) {
            const fallbackGoalPrompts: Record<OnboardingGoal, string> = {
                clarity: 'What is creating mental noise for me today, and what can I simplify first?',
                memory: 'What moment from today is worth preserving with detail?',
                growth: 'What challenge taught me something important today?',
                productivity: 'What one action will create the most momentum tomorrow?',
            };
            return fallbackGoalPrompts[goal as OnboardingGoal];
        }

        return null;
    }
}

export const progressivePersonalizationService = new ProgressivePersonalizationService();
export default progressivePersonalizationService;
