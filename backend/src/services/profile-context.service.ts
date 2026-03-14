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
    onboardingCompletedAt?: Date | string | null;
    updatedAt?: Date | string | null;
};

export type ProfileContextSummary = {
    primaryGoal: string | null;
    focusArea: string | null;
    experienceLevel: string | null;
    writingPreference: string | null;
    starterPrompt: string | null;
    importPreference: string | null;
    lifeGoals: string[];
    outputGoals: string[];
    completionScore: number;
    completedFields: number;
    totalFields: number;
    stage: ProfileStage;
    track: ProfileTrack;
    personalSignals: number;
    professionalSignals: number;
    personalGrowthScore: number;
    professionalReadinessScore: number;
    onboardingCompleted: boolean;
    updatedAt: string | null;
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

const normalizeOptionalText = (value: unknown): string | null => {
    if (!hasText(value)) return null;
    return value.trim();
};

const normalizeStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    const normalized = value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
    return Array.from(new Set(normalized));
};

const asIsoDateString = (value: unknown): string | null => {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(value as string);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
};

const hasProfessionalOutputGoal = (goals: string[]): boolean => {
    const normalized = goals.map((goal) => goal.toLowerCase());
    return normalized.some((goal) => PROFESSIONAL_OUTPUT_GOALS.has(goal));
};

const hasCompletedOnboardingCore = (input: {
    primaryGoal: string | null;
    focusArea: string | null;
    starterPrompt: string | null;
}): boolean =>
    Boolean(input.primaryGoal && input.focusArea && input.starterPrompt);

const deriveTrack = (focusArea: string | null, hasProfessionalGoals: boolean): ProfileTrack => {
    if (focusArea === 'both') return 'blended';
    if (focusArea === 'career') return 'professional';
    if (focusArea === 'life') return 'personal';
    if (hasProfessionalGoals) return 'professional';
    return 'unknown';
};

const toPercent = (numerator: number, denominator: number): number =>
    denominator <= 0 ? 0 : Math.round((numerator / denominator) * 100);

export const buildProfileContextSummary = (
    source: ProfileContextSource | null | undefined
): ProfileContextSummary => {
    const primaryGoal = normalizeOptionalText(source?.primaryGoal);
    const focusArea = normalizeOptionalText(source?.focusArea);
    const experienceLevel = normalizeOptionalText(source?.experienceLevel);
    const writingPreference = normalizeOptionalText(source?.writingPreference);
    const starterPrompt = normalizeOptionalText(source?.starterPrompt);
    const importPreference = normalizeOptionalText(source?.importPreference);
    const lifeGoals = normalizeStringArray(source?.lifeGoals);
    const outputGoals = normalizeStringArray(source?.outputGoals);

    const hasPrimaryGoal = primaryGoal !== null;
    const hasFocusArea = focusArea !== null;
    const hasExperienceLevel = experienceLevel !== null;
    const hasWritingPreference = writingPreference !== null;
    const hasLifeGoals = lifeGoals.length > 0;
    const hasOutputGoals = outputGoals.length > 0;
    const hasStarterPrompt = starterPrompt !== null;

    const completedFields = [
        hasPrimaryGoal,
        hasFocusArea,
        hasExperienceLevel,
        hasWritingPreference,
        hasLifeGoals,
        hasOutputGoals,
        hasStarterPrompt,
    ].filter(Boolean).length;

    const hasProfessionalGoals = hasProfessionalOutputGoal(outputGoals);
    const personalSignals = [
        hasPrimaryGoal,
        hasLifeGoals,
        hasWritingPreference,
        focusArea === 'life' || focusArea === 'both',
    ].filter(Boolean).length;
    const professionalSignals = [
        focusArea === 'career' || focusArea === 'both',
        hasExperienceLevel,
        hasProfessionalGoals,
        hasStarterPrompt,
    ].filter(Boolean).length;

    const onboardingCompleted = hasCompletedOnboardingCore({
        primaryGoal,
        focusArea,
        starterPrompt,
    });
    const stage: ProfileStage = onboardingCompleted
        ? 'completed'
        : completedFields > 0
            ? 'in_progress'
            : 'not_started';

    return {
        primaryGoal,
        focusArea,
        experienceLevel,
        writingPreference,
        starterPrompt,
        importPreference,
        lifeGoals,
        outputGoals,
        completionScore: toPercent(completedFields, TOTAL_PROFILE_FIELDS),
        completedFields,
        totalFields: TOTAL_PROFILE_FIELDS,
        stage,
        track: deriveTrack(focusArea, hasProfessionalGoals),
        personalSignals,
        professionalSignals,
        personalGrowthScore: toPercent(personalSignals, 4),
        professionalReadinessScore: toPercent(professionalSignals, 4),
        onboardingCompleted,
        updatedAt: asIsoDateString(source?.updatedAt),
    };
};
