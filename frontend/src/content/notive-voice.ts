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
    signature: 'Private diary for useful stories.',
    shortSummary: 'A private diary for turning real moments into lessons, patterns, and stories you can use.',
    longSummary: 'Notive is a private diary that helps you capture real moments, understand what they hold, and turn them into lessons, skills, patterns, and stories for life, study, and work.',
    journey: ['Capture', 'Keep', 'Understand', 'Use'],
    surfaces: {
        homeBase: 'Today',
        memoryAtlas: 'Timeline',
        signalStudio: 'Patterns',
        outcomeStudio: 'Stories',
        reflectionCoach: 'Chat',
        storyCollections: 'Threads',
        memoryInbox: 'Import',
        profileStudio: 'Profile',
        admin: 'Manage',
    },
    home: {
        heroTitle: 'Save the moment. Find the story.',
        heroBody: 'Write, speak, or import a note. Notive keeps it private and helps you find the lesson, pattern, or story you may use later.',
        heroPrimaryCta: 'Continue with Google',
        heroSecondaryCta: 'Sign in',
        heroCtaFootnote: 'New here? Continue with Google to create your diary. Already have one? Sign in.',
        showcaseEyebrow: 'Private diary',
    },
    auth: {
        trustPoints: [
            'Your diary stays private and encrypted',
            'No ads and no data selling',
            'Your notes stay available across phone, tablet, and laptop',
        ],
        signInHeroTitle: 'Return to your diary.',
        signInHeroBody: 'Reopen the moments you saved and the value you are building from them.',
        signInHeading: 'Welcome back.',
        signInBody: 'Sign in to reopen your private diary and everything you have kept in it.',
        registerHeroTitle: 'Start a private diary you can use later.',
        registerHeroBody: 'Capture real moments now. Turn them into lessons, skills, patterns, and stories over time.',
        registerHeading: 'Create your diary.',
        registerBody: 'Notive uses your Google account to set it up, so there is no new password to invent. It takes about a minute, and nothing you write is ever public.',
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
            productivity: 'Turn saved notes into something useful for decisions, study, work, or life.',
        },
    },
    chat: {
        subtitle: 'Ask about anything you have written.',
        suggestions: [
            'What do I keep coming back to?',
            'Summarize this week.',
            'What changed since last month?',
            'Turn this into a resume bullet.',
        ],
        lenses: [
            {
                id: 'memory' as NotiveChatLens,
                label: 'Understand this',
                description: 'Read one note closely.',
            },
            {
                id: 'patterns' as NotiveChatLens,
                label: 'Find the thread',
                description: 'Look across notes for repeated themes, moods, and people.',
            },
            {
                id: 'lessons' as NotiveChatLens,
                label: 'Name the growth',
                description: 'Pull out lessons, strengths, and shifts in how you handled things.',
            },
            {
                id: 'stories' as NotiveChatLens,
                label: 'Turn into material',
                description: 'Turn a note into resume, story, or interview material.',
            },
        ],
    },
    dashboard: {
        heroEyebrow: 'Latest note',
        heroTitle: 'Pick up where you left off.',
        heroBody: 'Your latest note, and what it holds.',
        evidenceLabel: 'From this note',
        actionLabel: 'Next step',
    },
    stories: {
        title: 'Turn saved moments into stories you can use.',
        description: 'Resume bullets, statements, interview stories, and growth summaries — built from your notes.',
    },
    imports: {
        title: 'Import old posts, notes, and files.',
        description: 'Imported items join your timeline like any other note.',
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
