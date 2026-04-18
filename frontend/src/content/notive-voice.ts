export const NOTIVE_BANNED_PUBLIC_LANGUAGE = [
    'calm',
    'calmer',
    'steady',
    'steadier',
    'grounding',
    'companion',
    'mental health companion',
    'feel less noisy',
    'one calm next step',
] as const;

export const NOTIVE_PUBLIC_COPY_AUDIT_PATHS = [
    'src/app/page.tsx',
    'src/components/marketing/NotiveShowcase.tsx',
    'src/app/login/page.tsx',
    'src/app/register/page.tsx',
    'src/app/forgot-password/page.tsx',
    'src/app/reset-password/page.tsx',
    'src/app/profile/complete/page.tsx',
    'src/app/chat/page.tsx',
    'src/components/layout/nav-config.tsx',
    'src/app/import/page.tsx',
    'src/components/portfolio/PortfolioWorkspace.tsx',
    'src/app/manifest.ts',
] as const;

export type NotiveChatLens = 'memory' | 'patterns' | 'lessons' | 'stories';
export type SmartPromptFramingVariant = 'signal' | 'momentum' | 'story';
export type ProgressivePromptFramingVariant = 'guide' | 'benefit' | 'future';

export const NOTIVE_VOICE = {
    appName: 'Notive',
    signature: 'Capture moments. Keep what matters. Use it later.',
    shortSummary: 'A private diary for capturing real moments and turning them into something useful.',
    longSummary: 'Notive is a private diary that helps you capture real moments, keep meaningful memories, understand what they hold, and turn them into lessons, skills, patterns, and stories you can use later.',
    journey: ['Capture', 'Keep', 'Understand', 'Use'],
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
    home: {
        heroTitle: 'Capture real moments. Keep what matters. Turn it into something useful.',
        heroBody: 'Write, speak, or import a memory. Notive helps you keep it private, understand what it contains, and reuse it later.',
        heroPrimaryCta: 'Start your diary',
        heroSecondaryCta: 'Sign in',
        showcaseEyebrow: 'Private diary',
        showcaseTitle: 'Five ways Notive turns saved moments into something useful later.',
        showcaseBody: 'Capture is only the start. Notive helps turn memories into lessons, skills, patterns, and reusable story material.',
        closingTitle: 'Your memories can become more than a timeline.',
        closingBody: 'Keep the moment now. Come back later for lessons, skills, patterns, and story pieces you can actually use.',
    },
    auth: {
        trustPoints: [
            'Your diary stays private and encrypted',
            'No ads and no data selling',
            'Your notes stay available across phone, tablet, and laptop',
        ],
        signInHeroTitle: 'Return to your diary.',
        signInHeroBody: 'Reopen the moments you saved and the value you are building from them.',
        signInHeading: 'Sign in to the moments you kept.',
        signInBody: 'Open your private diary, revisit what mattered, and keep building something useful from it.',
        registerHeroTitle: 'Start a private diary you can use later.',
        registerHeroBody: 'Capture real moments now. Turn them into lessons, skills, patterns, and stories over time.',
        registerHeading: 'Capture it now. Use it later.',
        registerBody: 'Open a private diary for memories, lessons, and story pieces you want to keep.',
        sideTitle: 'Keep what matters',
        sideBody: 'A real memory can become a lesson, skill, or story you can reuse later.',
        forgotTitle: 'Recover access to your diary.',
        forgotBody: 'Reset your password and come back to the memories, lessons, and notes you keep here.',
        resetTitle: 'Set a new password and keep going.',
        resetBody: 'Update your password and reopen your private diary.',
        profileTitle: 'Add one quick detail so Notive fits your stage of life.',
        profileBody: 'Your birthday stays private. It helps Notive phrase prompts, examples, and outputs in a way that better matches your context.',
    },
    onboarding: {
        goalLabels: {
            clarity: 'Understand what this means',
            memory: 'Keep meaningful moments',
            growth: 'Extract lessons and skills',
            productivity: 'Turn notes into something useful later',
        },
        goalDescriptions: {
            clarity: 'Understand the meaning, theme, and signal inside a moment.',
            memory: 'Save details, memories, and experiences worth keeping.',
            growth: 'Pull out lessons, strengths, and skills over time.',
            productivity: 'Turn saved notes into something useful for decisions, school, work, or life.',
        },
    },
    chat: {
        subtitle: 'Ask about your notes, memories, lessons, and stories.',
        suggestions: [
            'What lesson keeps showing up in my notes?',
            'Which memory feels worth keeping?',
            'What skills are showing up in this entry?',
            'Turn this into a story I can use later.',
        ],
        lenses: [
            {
                id: 'memory' as NotiveChatLens,
                label: 'Memory',
                description: 'Reconnect one note to older moments worth keeping.',
            },
            {
                id: 'patterns' as NotiveChatLens,
                label: 'Patterns',
                description: 'Look across notes for repeated themes, moods, and signals.',
            },
            {
                id: 'lessons' as NotiveChatLens,
                label: 'Lessons',
                description: 'Pull out lessons, strengths, and skills from what you wrote.',
            },
            {
                id: 'stories' as NotiveChatLens,
                label: 'Stories',
                description: 'Turn your notes into story material you can reuse later.',
            },
        ],
    },
    dashboard: {
        heroEyebrow: 'Capture -> Keep -> Understand -> Use',
        heroTitle: 'Your latest memory already holds something useful.',
        heroBody: 'Start with the moment you saved, then look for the lesson, skill, pattern, or story piece inside it.',
        evidenceLabel: 'What this memory is showing',
        actionLabel: 'Suggested reuse',
    },
    stories: {
        title: 'Turn saved moments into stories you can use later.',
        description: 'Build resume bullets, statements, interview stories, growth summaries, and reusable life evidence from your diary.',
    },
    imports: {
        title: 'Bring old memories into your diary system.',
        description: 'Import posts, notes, and files so they can become useful memories, lessons, and stories too.',
    },
} as const;

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
