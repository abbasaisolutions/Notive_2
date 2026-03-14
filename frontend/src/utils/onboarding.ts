export type OnboardingGoal = 'clarity' | 'memory' | 'growth' | 'productivity';
export type OnboardingTrack = 'life' | 'career' | 'both';
export type OnboardingExperienceLevel = 'student' | 'early-career' | 'professional' | 'lifelong-learner';
export type OnboardingWritingPreference = 'guided' | 'structured' | 'freeform';
export type OnboardingOutputGoal = 'self-growth' | 'college-statement' | 'resume-stories' | 'interview-examples' | 'portfolio';
export type OnboardingImportPreference = 'connect-now' | 'archive-upload' | 'later';

export interface OnboardingState {
    completed: boolean;
    goal: OnboardingGoal;
    track: OnboardingTrack;
    starterPrompt: string;
    completedAt: string;
    experienceLevel?: OnboardingExperienceLevel;
    writingPreference?: OnboardingWritingPreference;
    outputGoals?: OnboardingOutputGoal[];
    importPreference?: OnboardingImportPreference;
}

export interface OnboardingProfileSnapshot {
    primaryGoal?: string | null;
    focusArea?: string | null;
    starterPrompt?: string | null;
    experienceLevel?: string | null;
    writingPreference?: string | null;
    outputGoals?: string[] | null;
    importPreference?: string | null;
    onboardingCompletedAt?: string | null;
}

const ONBOARDING_KEY_PREFIX = 'notive_onboarding_v2';
const LEGACY_ONBOARDING_KEY = 'notive_onboarding_v1';

const GOALS: OnboardingGoal[] = ['clarity', 'memory', 'growth', 'productivity'];
const TRACKS: OnboardingTrack[] = ['life', 'career', 'both'];
const EXPERIENCE_LEVELS: OnboardingExperienceLevel[] = ['student', 'early-career', 'professional', 'lifelong-learner'];
const WRITING_PREFERENCES: OnboardingWritingPreference[] = ['guided', 'structured', 'freeform'];
const OUTPUT_GOALS: OnboardingOutputGoal[] = ['self-growth', 'college-statement', 'resume-stories', 'interview-examples', 'portfolio'];
const IMPORT_PREFERENCES: OnboardingImportPreference[] = ['connect-now', 'archive-upload', 'later'];

const isBrowser = () => typeof window !== 'undefined';
const getOnboardingKey = (userId: string) => `${ONBOARDING_KEY_PREFIX}_${userId}`;

const asGoal = (value: unknown): OnboardingGoal | null =>
    typeof value === 'string' && GOALS.includes(value as OnboardingGoal)
        ? (value as OnboardingGoal)
        : null;

const asTrack = (value: unknown): OnboardingTrack | null =>
    typeof value === 'string' && TRACKS.includes(value as OnboardingTrack)
        ? (value as OnboardingTrack)
        : null;

const asExperienceLevel = (value: unknown): OnboardingExperienceLevel | undefined =>
    typeof value === 'string' && EXPERIENCE_LEVELS.includes(value as OnboardingExperienceLevel)
        ? (value as OnboardingExperienceLevel)
        : undefined;

const asWritingPreference = (value: unknown): OnboardingWritingPreference | undefined =>
    typeof value === 'string' && WRITING_PREFERENCES.includes(value as OnboardingWritingPreference)
        ? (value as OnboardingWritingPreference)
        : undefined;

const asImportPreference = (value: unknown): OnboardingImportPreference | undefined =>
    typeof value === 'string' && IMPORT_PREFERENCES.includes(value as OnboardingImportPreference)
        ? (value as OnboardingImportPreference)
        : undefined;

const asOutputGoals = (value: unknown): OnboardingOutputGoal[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const goals = value
        .filter((item): item is OnboardingOutputGoal => typeof item === 'string' && OUTPUT_GOALS.includes(item as OnboardingOutputGoal));
    return goals.length > 0 ? Array.from(new Set(goals)) : undefined;
};

const hasText = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;

export function hasCompletedOnboardingRequirements(profile?: OnboardingProfileSnapshot | null): boolean {
    if (!profile) return false;
    return hasText(profile.primaryGoal) && hasText(profile.focusArea) && hasText(profile.starterPrompt);
}

export function getOnboardingState(userId?: string | null): OnboardingState | null {
    if (!isBrowser()) return null;
    if (!userId) return null;
    const raw = localStorage.getItem(getOnboardingKey(userId));
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as Partial<OnboardingState>;
        if (!parsed || typeof parsed !== 'object' || !parsed.completed) return null;

        const goal = asGoal(parsed.goal);
        const track = asTrack(parsed.track);
        if (!goal || !track) return null;

        return {
            completed: true,
            goal,
            track,
            starterPrompt: typeof parsed.starterPrompt === 'string' ? parsed.starterPrompt : '',
            completedAt: typeof parsed.completedAt === 'string' ? parsed.completedAt : new Date().toISOString(),
            experienceLevel: asExperienceLevel(parsed.experienceLevel),
            writingPreference: asWritingPreference(parsed.writingPreference),
            outputGoals: asOutputGoals(parsed.outputGoals),
            importPreference: asImportPreference(parsed.importPreference),
        };
    } catch {
        return null;
    }
}

export function getOnboardingStateFromProfile(profile?: OnboardingProfileSnapshot | null): OnboardingState | null {
    if (!profile) return null;

    const goal = asGoal(profile.primaryGoal);
    const track = asTrack(profile.focusArea);
    if (!goal || !track) return null;

    return {
        completed: hasCompletedOnboardingRequirements(profile),
        goal,
        track,
        starterPrompt: typeof profile.starterPrompt === 'string' ? profile.starterPrompt : '',
        completedAt: profile.onboardingCompletedAt || new Date().toISOString(),
        experienceLevel: asExperienceLevel(profile.experienceLevel),
        writingPreference: asWritingPreference(profile.writingPreference),
        outputGoals: asOutputGoals(profile.outputGoals),
        importPreference: asImportPreference(profile.importPreference),
    };
}

export function hasCompletedOnboardingFromProfile(profile?: OnboardingProfileSnapshot | null): boolean {
    return hasCompletedOnboardingRequirements(profile);
}

export function saveOnboardingState(state: OnboardingState, userId?: string | null): void {
    if (!isBrowser()) return;
    if (!userId) return;
    localStorage.setItem(getOnboardingKey(userId), JSON.stringify(state));
}

export function clearOnboardingState(userId?: string | null): void {
    if (!isBrowser()) return;
    if (userId) {
        localStorage.removeItem(getOnboardingKey(userId));
        return;
    }

    localStorage.removeItem(LEGACY_ONBOARDING_KEY);
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key.startsWith(`${ONBOARDING_KEY_PREFIX}_`)) {
            localStorage.removeItem(key);
        }
    }
}

export function getRecommendedPrompt(state: OnboardingState | null): string {
    if (!state) {
        return 'What happened today that I want to remember and learn from?';
    }

    const byGoal: Record<OnboardingGoal, string> = {
        clarity: 'What is on my mind right now, and what is one clear next step?',
        memory: 'What meaningful moment from today do I want to preserve?',
        growth: 'What challenge did I face today, and how did I grow from it?',
        productivity: 'What did I complete today, and what should I prioritize next?',
    };

    const byTrack: Record<OnboardingTrack, string> = {
        life: 'What did I learn about myself or my relationships today?',
        career: 'What did I do today that shows initiative, learning, or impact?',
        both: 'What did I do today that helped both my personal life and long-term goals?',
    };

    const goalPrompt = byGoal[state.goal];
    const trackPrompt = byTrack[state.track];
    return `${goalPrompt} ${trackPrompt}`;
}
