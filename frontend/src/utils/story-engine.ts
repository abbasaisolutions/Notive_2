export type StoryEngineStatus = 'needs_attention' | 'ready_to_verify' | 'ready_to_export' | 'verified';
export type StoryEngineField = 'situation' | 'action' | 'lesson' | 'outcome' | 'skills';

export type StorySignal = {
    status: StoryEngineStatus;
    completenessScore: number;
    verified: boolean;
    confidence: number;
    readyForVerification: boolean;
    readyForExport: boolean;
    missingFields: StoryEngineField[];
};

export const storyStatusLabel: Record<StoryEngineStatus, string> = {
    needs_attention: 'Needs Attention',
    ready_to_verify: 'Ready To Verify',
    ready_to_export: 'Ready To Export',
    verified: 'Verified',
};

export const storyStatusClassName: Record<StoryEngineStatus, string> = {
    needs_attention: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
    ready_to_verify: 'border-white/15 bg-white/[0.05] text-white',
    ready_to_export: 'border-primary/30 bg-primary/12 text-primary',
    verified: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
};

export const storyFieldLabel: Record<StoryEngineField, string> = {
    situation: 'Situation',
    action: 'Action',
    lesson: 'Lesson',
    outcome: 'Result',
    skills: 'Skills',
};

export const formatStoryConfidence = (value: number) => `${Math.round(value * 100)}%`;
