export const NOTIVE_VOICE = {
    appName: 'Notive',
    signature: 'Save moments. See patterns. Build your story.',
    shortSummary: 'Save real moments, see your patterns, and build your story.',
    longSummary: 'Save real moments, understand your patterns, and build your story for life, school, and work.',
    surfaces: {
        homeBase: 'Home',
        memoryAtlas: 'Memories',
        signalStudio: 'Patterns',
        outcomeStudio: 'Stories',
        reflectionCoach: 'AskNotive',
        storyCollections: 'Groups',
        memoryInbox: 'Bring In',
        profileStudio: 'Me',
        admin: 'Manage',
    },
} as const;

export type SmartPromptFramingVariant = 'signal' | 'momentum' | 'story';
export type ProgressivePromptFramingVariant = 'guide' | 'benefit' | 'future';

export const SMART_PROMPT_FRAMING_EXPERIMENT_ID = 'smart_prompt_framing_v1';
export const PROGRESSIVE_PROMPT_FRAMING_EXPERIMENT_ID = 'progressive_prompt_framing_v1';

const SMART_PROMPT_FRAMING_VARIANTS: SmartPromptFramingVariant[] = ['signal', 'momentum', 'story'];
const PROGRESSIVE_PROMPT_FRAMING_VARIANTS: ProgressivePromptFramingVariant[] = ['guide', 'benefit', 'future'];

const hashString = (value: string): number => {
    let hash = 5381;

    for (let index = 0; index < value.length; index += 1) {
        hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
    }

    return Math.abs(hash);
};

export const resolveSmartPromptFramingVariant = (userId: string): SmartPromptFramingVariant => {
    if (!userId) {
        return SMART_PROMPT_FRAMING_VARIANTS[0];
    }

    const bucket = hashString(`${SMART_PROMPT_FRAMING_EXPERIMENT_ID}:${userId}`) % SMART_PROMPT_FRAMING_VARIANTS.length;
    return SMART_PROMPT_FRAMING_VARIANTS[bucket];
};

export const resolveProgressivePromptFramingVariant = (userId: string): ProgressivePromptFramingVariant => {
    if (!userId) {
        return PROGRESSIVE_PROMPT_FRAMING_VARIANTS[0];
    }

    const bucket = hashString(`${PROGRESSIVE_PROMPT_FRAMING_EXPERIMENT_ID}:${userId}`) % PROGRESSIVE_PROMPT_FRAMING_VARIANTS.length;
    return PROGRESSIVE_PROMPT_FRAMING_VARIANTS[bucket];
};
