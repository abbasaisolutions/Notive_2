import type { StorySignal } from '@/utils/story-engine';

export type MemoryNotiveInsight = {
    type: 'thread' | 'lesson' | 'strength';
    text: string;
    doodle?: string;
};

export type MemoryTopEmotion = {
    emotion: string;
    intensity: number;
};

export type MemoryInsightData = {
    analysisLine?: string | null;
    takeawayLine?: string | null;
    notiveInsights?: MemoryNotiveInsight[] | null;
    topEmotions?: MemoryTopEmotion[];
    depthLabel?: string | null;
    growthRatio?: number | null;
    storySignal?: StorySignal;
};
