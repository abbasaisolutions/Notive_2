export type SearchIntent =
    | 'general'
    | 'emotion'
    | 'lesson'
    | 'skill'
    | 'reflection'
    | 'memory'
    | 'action';

export type SearchIntentPlan = {
    intent: SearchIntent;
    embeddingQuery: string;
    preferredFacetTypes: string[];
};

const FACETS_BY_INTENT: Record<SearchIntent, string[]> = {
    general: [],
    emotion: ['reflection', 'title', 'opportunity_outcome'],
    lesson: ['lesson', 'opportunity_lesson', 'reflection'],
    skill: ['skill', 'opportunity_action', 'opportunity_outcome'],
    reflection: ['reflection', 'lesson', 'opportunity_situation'],
    memory: ['title', 'reflection', 'opportunity_situation', 'opportunity_outcome', 'coping_action', 'steadying_routine'],
    action: ['coping_action', 'steadying_routine', 'support_person', 'opportunity_action', 'skill', 'opportunity_outcome'],
};

const EMBEDDING_HINTS: Record<SearchIntent, string> = {
    general: '',
    emotion: 'Focus on emotions, stress, mood, and how the person felt.',
    lesson: 'Focus on lessons, realizations, takeaways, and what was learned.',
    skill: 'Focus on skills, strengths, capabilities, and repeated competencies.',
    reflection: 'Focus on reflection, meaning, interpretation, and what stands out.',
    memory: 'Focus on similar past moments, situations, what helped before, and outcomes.',
    action: 'Focus on helpful actions, steadying routines, reach-out options, and outcomes.',
};

const INTENT_RULES: Array<{ intent: SearchIntent; pattern: RegExp }> = [
    {
        intent: 'memory',
        pattern: /\b(when was|last time|before|again|remember|similar|closest to|past moment|used to|earlier)\b/i,
    },
    {
        intent: 'emotion',
        pattern: /\b(feel|feeling|felt|mood|emotion|stress|stressed|anxious|sad|happy|calm|overwhelmed)\b/i,
    },
    {
        intent: 'lesson',
        pattern: /\b(learn|learned|lesson|takeaway|realized|realisation|realization|discovered|insight|what did i learn)\b/i,
    },
    {
        intent: 'skill',
        pattern: /\b(skill|strength|strengths|good at|capable|leadership|communication|ability|abilities)\b/i,
    },
    {
        intent: 'action',
        pattern: /\b(did|done|worked on|action|actions|built|made|created|shipped|completed|finished|fixed|solved)\b/i,
    },
    {
        intent: 'reflection',
        pattern: /\b(why|meaning|reflect|reflection|think about|process|understand|pattern in)\b/i,
    },
];

export const inferSearchIntent = (query: string, intentHint?: SearchIntent | null): SearchIntent => {
    if (intentHint && intentHint !== 'general') {
        return intentHint;
    }

    const normalized = query.trim();
    if (!normalized) return 'general';

    for (const rule of INTENT_RULES) {
        if (rule.pattern.test(normalized)) {
            return rule.intent;
        }
    }

    return 'general';
};

export const buildSearchIntentPlan = (input: {
    query: string;
    intentHint?: SearchIntent | null;
}): SearchIntentPlan => {
    const intent = inferSearchIntent(input.query, input.intentHint);
    const preferredFacetTypes = FACETS_BY_INTENT[intent];
    const hint = EMBEDDING_HINTS[intent];
    const normalizedQuery = input.query.trim();

    return {
        intent,
        preferredFacetTypes,
        embeddingQuery: hint
            ? `${normalizedQuery}\n\n${hint}`
            : normalizedQuery,
    };
};

export const isPreferredFacetType = (facetType: string | null | undefined, preferredFacetTypes: string[]) =>
    Boolean(facetType && preferredFacetTypes.includes(facetType));
