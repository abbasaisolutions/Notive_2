import { hasCompletedOnboardingRequirements } from '@/utils/onboarding';

export type ProfileStage = 'not_started' | 'in_progress' | 'completed';
export type ProfileTrack = 'personal' | 'professional' | 'blended' | 'unknown';

export type ProfileContextSource = {
    primaryGoal?: string | null;
    focusArea?: string | null;
    experienceLevel?: string | null;
    writingPreference?: string | null;
    starterPrompt?: string | null;
    importPreference?: string | null;
    lifeGoals?: string[] | null;
    outputGoals?: string[] | null;
    onboardingCompletedAt?: string | null;
};

export type ProfileContextSummary = {
    completionScore: number;
    completedFields: number;
    totalFields: number;
    stage: ProfileStage;
    track: ProfileTrack;
    personalGrowthScore: number;
    professionalReadinessScore: number;
};

const TOTAL_PROFILE_FIELDS = 7;
const PROFESSIONAL_OUTPUT_GOALS = new Set([
    'resume-stories',
    'interview-examples',
    'portfolio',
    'college-statement',
]);

const hasText = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;

const normalizeStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
};

const toPercent = (numerator: number, denominator: number): number =>
    denominator <= 0 ? 0 : Math.round((numerator / denominator) * 100);

const hasProfessionalOutputGoal = (goals: string[]): boolean =>
    goals.some((goal) => PROFESSIONAL_OUTPUT_GOALS.has(goal.toLowerCase()));

const deriveTrack = (focusArea: string | null, hasProfessionalGoals: boolean): ProfileTrack => {
    if (focusArea === 'both') return 'blended';
    if (focusArea === 'career') return 'professional';
    if (focusArea === 'life') return 'personal';
    if (hasProfessionalGoals) return 'professional';
    return 'unknown';
};

export const buildProfileContextSummary = (
    source: ProfileContextSource | null | undefined
): ProfileContextSummary => {
    const primaryGoal = hasText(source?.primaryGoal) ? source.primaryGoal.trim() : null;
    const focusArea = hasText(source?.focusArea) ? source.focusArea.trim() : null;
    const experienceLevel = hasText(source?.experienceLevel);
    const writingPreference = hasText(source?.writingPreference);
    const starterPrompt = hasText(source?.starterPrompt) ? source.starterPrompt.trim() : null;
    const lifeGoals = normalizeStringArray(source?.lifeGoals);
    const outputGoals = normalizeStringArray(source?.outputGoals);

    const completedFields = [
        primaryGoal,
        focusArea !== null,
        experienceLevel,
        writingPreference,
        lifeGoals.length > 0,
        outputGoals.length > 0,
        starterPrompt !== null,
    ].filter(Boolean).length;

    const hasProfessionalGoals = hasProfessionalOutputGoal(outputGoals);
    const personalSignals = [
        primaryGoal,
        lifeGoals.length > 0,
        writingPreference,
        focusArea === 'life' || focusArea === 'both',
    ].filter(Boolean).length;
    const professionalSignals = [
        focusArea === 'career' || focusArea === 'both',
        experienceLevel,
        hasProfessionalGoals,
        starterPrompt !== null,
    ].filter(Boolean).length;

    const onboardingCompleted = hasCompletedOnboardingRequirements({
        primaryGoal,
        focusArea,
        starterPrompt,
        onboardingCompletedAt: source?.onboardingCompletedAt || null,
    });
    const stage: ProfileStage = onboardingCompleted
        ? 'completed'
        : completedFields > 0
            ? 'in_progress'
            : 'not_started';

    return {
        completionScore: toPercent(completedFields, TOTAL_PROFILE_FIELDS),
        completedFields,
        totalFields: TOTAL_PROFILE_FIELDS,
        stage,
        track: deriveTrack(focusArea, hasProfessionalGoals),
        personalGrowthScore: toPercent(personalSignals, 4),
        professionalReadinessScore: toPercent(professionalSignals, 4),
    };
};
