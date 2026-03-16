export type HealthActivityLevel = 'low' | 'moderate' | 'high';

export type HealthPromptSignalMetric = 'sleep' | 'activity' | 'recovery';

export type HealthPromptSignalKind =
    | 'sleep_deficit'
    | 'sleep_recovery'
    | 'activity_boost'
    | 'activity_dip'
    | 'recovery_strain'
    | 'consistency_streak';

export interface HealthPromptSignal {
    kind: HealthPromptSignalKind;
    metric: HealthPromptSignalMetric;
    score: number;
    title: string;
    summary: string;
    prompt: string;
    currentValue: number | null;
    baselineValue: number | null;
    unit: 'hours' | 'steps' | 'minutes' | 'bpm' | null;
    direction: 'above' | 'below' | 'mixed' | 'steady';
}

export interface HealthContextSummary {
    date: string;
    sleepHours: number | null;
    sleepQuality: string | null;
    steps: number | null;
    activeMinutes: number | null;
    caloriesBurned: number | null;
    activityLevel: HealthActivityLevel | null;
    avgHeartRate: number | null;
    restingHeartRate: number | null;
    signals?: HealthPromptSignal[];
}
