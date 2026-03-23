import prisma from '../config/prisma';
import embeddingService from './embedding.service';
import { executeHybridSearch, type HybridSearchResult } from './hybrid-search.service';
import nlpService from './nlp.service';
import type { SearchIntent } from '../utils/search-intent';
import studentActionService, {
    type StudentActionBrief,
    type StudentBridgeDraft,
} from './student-action.service';
import type { StudentRisk, StudentSafetyCard } from './student-safety.service';

type GuidedReflectionIntent = 'summary' | 'pattern' | 'emotion' | 'next_step' | 'memory' | 'bridge' | 'general';
export type GuidedReflectionLens = 'clarity' | 'memory' | 'growth' | 'patterns' | 'bridge';
type WritingPreference = 'guided' | 'structured' | 'freeform' | null;

type ReflectionEntry = {
    id: string;
    title: string | null;
    content: string;
    mood: string | null;
    tags: string[];
    skills: string[];
    lessons: string[];
    createdAt: Date;
    analysisRecord: {
        summary: string | null;
        topics: string[];
        keywords: string[];
        suggestedMood: string | null;
    } | null;
};

export type GuidedReflectionStatus = {
    available: true;
    provider: 'guided_reflection';
    vendor: 'local';
    model: string;
    message: string;
    suggestions: string[];
    lenses: Array<{
        id: GuidedReflectionLens;
        label: string;
        description: string;
    }>;
    defaultLens: GuidedReflectionLens;
};

export type GuidedReflectionResponse = {
    response: string;
    provider: 'guided_reflection';
    vendor: 'local';
    mode: 'guided_reflection';
    model: string;
    strategy: 'hybrid' | 'recent' | 'starter';
    lens: GuidedReflectionLens;
    prompts: string[];
    highlights: Array<{
        id: string;
        title: string | null;
        createdAt: string;
        mood: string | null;
        reason: string;
        excerpt: string;
    }>;
    brief?: StudentActionBrief | null;
    bridge?: StudentBridgeDraft | null;
    risk?: StudentRisk;
    safetyCard?: StudentSafetyCard | null;
};

const DEFAULT_SUGGESTIONS = [
    'What feels like the biggest pattern in my notes lately?',
    'Help me talk to someone about this.',
    'Which past entry feels closest to how I am doing now?',
    'What should I write about tonight?',
];

const GUIDED_LENSES: GuidedReflectionStatus['lenses'] = [
    {
        id: 'clarity',
        label: 'Clarity',
        description: 'Summarize what matters most right now.',
    },
    {
        id: 'memory',
        label: 'Memory',
        description: 'Reconnect the present moment to older notes.',
    },
    {
        id: 'growth',
        label: 'Growth',
        description: 'Turn the pattern into a next step or lesson.',
    },
    {
        id: 'patterns',
        label: 'Patterns',
        description: 'Zoom out and look for repeated themes.',
    },
    {
        id: 'bridge',
        label: 'Bridge',
        description: 'Prepare a grounded message or conversation.',
    },
];

const formatDate = (value: Date): string =>
    value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const clip = (value: string, maxLength: number): string => {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
};

const takeFirstSentence = (value: string, maxLength = 180): string => {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    const sentenceMatch = normalized.match(/.+?[.!?](?=\s|$)/);
    return clip(sentenceMatch?.[0] || normalized, maxLength);
};

const uniqueStrings = (values: Array<string | null | undefined>, maxItems = 4): string[] => {
    const seen = new Set<string>();
    const normalized: string[] = [];

    values.forEach((value) => {
        if (typeof value !== 'string') return;
        const trimmed = value.trim();
        if (!trimmed) return;
        const key = trimmed.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        normalized.push(trimmed);
    });

    return normalized.slice(0, maxItems);
};

const inferIntent = (query: string): GuidedReflectionIntent => {
    const normalized = query.trim().toLowerCase();
    if (/(what should i write|write next|start writing|journal about|prompt)/.test(normalized)) {
        return 'next_step';
    }
    if (/(talk to|talk with|say to|message|text|call|reach out|ask for help|tell my|tell the|how do i say|help me talk)/.test(normalized)) {
        return 'bridge';
    }
    if (/(recurring|repeat|pattern|theme|always|keep happening)/.test(normalized)) {
        return 'pattern';
    }
    if (/(when was|last time|before|similar|remember|again|past moment)/.test(normalized)) {
        return 'memory';
    }
    if (/(feel|feeling|mood|emotion|stress|stressed|anxious|sad|happy|overwhelmed|calm)/.test(normalized)) {
        return 'emotion';
    }
    if (/(summary|summarize|week|month|lately|recently|overview)/.test(normalized)) {
        return 'summary';
    }
    return 'general';
};

const resolveLens = (lens: GuidedReflectionLens | null | undefined, intent: GuidedReflectionIntent): GuidedReflectionLens => {
    if (lens) return lens;
    if (intent === 'bridge') return 'bridge';
    if (intent === 'memory') return 'memory';
    if (intent === 'next_step') return 'growth';
    if (intent === 'pattern') return 'patterns';
    return 'clarity';
};

const applyLensToIntent = (lens: GuidedReflectionLens, intent: GuidedReflectionIntent): GuidedReflectionIntent => {
    if (intent !== 'general') return intent;
    switch (lens) {
        case 'bridge':
            return 'bridge';
        case 'memory':
            return 'memory';
        case 'growth':
            return 'next_step';
        case 'patterns':
            return 'pattern';
        default:
            return 'summary';
    }
};

const mapReflectionIntentToSearchIntent = (intent: GuidedReflectionIntent): SearchIntent => {
    switch (intent) {
        case 'emotion':
            return 'emotion';
        case 'bridge':
            return 'action';
        case 'memory':
            return 'memory';
        case 'next_step':
            return 'action';
        case 'pattern':
            return 'lesson';
        default:
            return 'general';
    }
};

const formatPromptForPreference = (prompt: string, writingPreference: WritingPreference): string => {
    if (writingPreference === 'structured') {
        return `${prompt} Try: what happened, what it affected, and what comes next.`;
    }
    if (writingPreference === 'freeform') {
        return `${prompt} Let yourself answer it loosely before you organize it.`;
    }
    return prompt;
};

const buildPrompts = (input: {
    intent: GuidedReflectionIntent;
    lens: GuidedReflectionLens;
    writingPreference: WritingPreference;
    topics: string[];
    starterPrompt: string | null;
    dominantMood: string;
}): string[] => {
    const topic = input.topics[0] || 'this moment';
    const secondaryTopic = input.topics[1] || 'that pattern';

    const promptSets: Record<GuidedReflectionIntent, string[]> = {
        summary: [
            `Which moment from this stretch best represents what ${topic} looked like day to day?`,
            `What changed between your earlier notes and the most recent one?`,
            'What do you want to carry forward into the next week?',
        ],
        pattern: [
            `What seems to trigger ${topic} most often in your notes?`,
            `What do you usually do right after ${secondaryTopic} shows up?`,
            'Which routine helps even a little when this pattern starts?',
        ],
        emotion: [
            `What seems to be underneath the ${input.dominantMood || 'strong'} tone in these notes?`,
            'Which entry feels closest to how you feel today, and what is different now?',
            'What helped you recover, even briefly, the last time this feeling appeared?',
        ],
        next_step: [
            input.starterPrompt?.trim() || `Start with: what happened around ${topic}, what it affected, and what you need next.`,
            `If you only wrote six sentences tonight, what would you want to say about ${secondaryTopic}?`,
            'What small next step deserves to be captured before the day ends?',
        ],
        bridge: [
            'What do you want this person to understand before they try to fix it?',
            `What is the hardest sentence to say out loud about ${topic}?`,
            'What kind of help are you actually hoping for from this conversation?',
        ],
        memory: [
            'What feels similar between then and now?',
            'What has changed since that earlier entry?',
            'What would you tell your past self from today’s perspective?',
        ],
        general: [
            `Which part of ${topic} still feels unfinished?`,
            'What detail are you avoiding that would make the note feel more honest?',
            'What do you want future-you to remember about this moment?',
        ],
    };

    const lensLead = input.lens === 'memory'
        ? 'Use memory mode:'
        : input.lens === 'bridge'
            ? 'Use bridge mode:'
        : input.lens === 'growth'
            ? 'Use growth mode:'
            : input.lens === 'patterns'
                ? 'Use pattern mode:'
                : '';

    return uniqueStrings(promptSets[input.intent], 3).map((prompt) =>
        formatPromptForPreference(lensLead ? `${lensLead} ${prompt}` : prompt, input.writingPreference)
    );
};

const buildOverviewLine = (input: {
    lens: GuidedReflectionLens;
    dominantMood: string;
    moodTrend: 'improving' | 'declining' | 'stable';
    topTopics: string[];
    entryCount: number;
}): string => {
    const topicText = input.topTopics.length > 0
        ? ` with recurring themes around ${input.topTopics.slice(0, 3).join(', ')}`
        : '';
    if (input.lens === 'memory') {
        return `Across ${input.entryCount} note${input.entryCount === 1 ? '' : 's'}, the same emotional thread keeps returning${topicText}. The recent trend looks ${input.moodTrend}.`;
    }
    if (input.lens === 'growth') {
        return `Across ${input.entryCount} note${input.entryCount === 1 ? '' : 's'}, the tone leans ${input.dominantMood || 'mixed'}${topicText}. That suggests a clear growth edge for the next note.`;
    }
    if (input.lens === 'bridge') {
        return `Across ${input.entryCount} note${input.entryCount === 1 ? '' : 's'}, the clearest support thread is around ${input.topTopics[0] || input.dominantMood || 'getting through something hard'}. This is a good moment to keep the human path visible.`;
    }
    if (input.lens === 'patterns') {
        return `Across ${input.entryCount} note${input.entryCount === 1 ? '' : 's'}, the strongest repeated pattern is ${input.topTopics[0] || input.dominantMood || 'still emerging'}. The recent trend looks ${input.moodTrend}.`;
    }
    return `Across ${input.entryCount} note${input.entryCount === 1 ? '' : 's'}, the tone leans ${input.dominantMood || 'mixed'}${topicText}. The recent trend looks ${input.moodTrend}.`;
};

const buildStrategyLabel = (searchResults: HybridSearchResult[] | null, entryCount: number): GuidedReflectionResponse['strategy'] => {
    if (searchResults && searchResults.length > 0) return 'hybrid';
    if (entryCount > 0) return 'recent';
    return 'starter';
};

class GuidedReflectionService {
    async getStatus(userId: string): Promise<GuidedReflectionStatus> {
        const [profile, activeEmbeddingConfig] = await Promise.all([
            prisma.userProfile.findUnique({
                where: { userId },
                select: {
                    writingPreference: true,
                },
            }),
            Promise.resolve(embeddingService.getActiveConfig()),
        ]);

        const writingPreference = profile?.writingPreference?.trim().toLowerCase() || null;
        const hasDenseRetrieval = embeddingService.isEnabled();
        const message = hasDenseRetrieval
            ? 'Guide is running in local reflection mode with your stored note retrieval and fixed reflection prompts.'
            : 'Guide is running in local reflection mode with deterministic note review and fixed reflection prompts.';

        const suggestions = writingPreference === 'structured'
            ? [
                'Summarize the last week of notes.',
                'What pattern keeps repeating lately?',
                'Help me talk to someone about this.',
                'Help me structure tonight’s reflection.',
            ]
            : DEFAULT_SUGGESTIONS;

        return {
            available: true,
            provider: 'guided_reflection',
            vendor: 'local',
            model: `${activeEmbeddingConfig.model} + guided-reflection-v1`,
            message,
            suggestions,
            lenses: GUIDED_LENSES,
            defaultLens: writingPreference === 'guided' ? 'growth' : 'clarity',
        };
    }

    async respond(input: {
        userId: string;
        query: string;
        lens?: GuidedReflectionLens | null;
    }): Promise<GuidedReflectionResponse> {
        const normalizedQuery = input.query.trim();
        const inferredIntent = inferIntent(normalizedQuery);
        const lens = resolveLens(input.lens || null, inferredIntent);
        const intent = applyLensToIntent(lens, inferredIntent);

        const [profile, recentEntries] = await Promise.all([
            prisma.userProfile.findUnique({
                where: { userId: input.userId },
                select: {
                    writingPreference: true,
                    starterPrompt: true,
                },
            }),
            prisma.entry.findMany({
                where: {
                    userId: input.userId,
                    deletedAt: null,
                },
                orderBy: {
                    createdAt: 'desc',
                },
                take: 8,
                select: {
                    id: true,
                    title: true,
                    content: true,
                    mood: true,
                    tags: true,
                    skills: true,
                    lessons: true,
                    createdAt: true,
                    analysisRecord: {
                        select: {
                            summary: true,
                            topics: true,
                            keywords: true,
                            suggestedMood: true,
                        },
                    },
                },
            }),
        ]);

        const activeEmbeddingConfig = embeddingService.getActiveConfig();
        const writingPreference = (profile?.writingPreference?.trim().toLowerCase() || null) as WritingPreference;

        if (recentEntries.length === 0) {
            const actionResponse = await studentActionService.preview({
                userId: input.userId,
                content: normalizedQuery,
            });
            const prompts = buildPrompts({
                intent: intent === 'next_step' ? 'next_step' : 'general',
                lens,
                writingPreference,
                topics: [],
                starterPrompt: profile?.starterPrompt || null,
                dominantMood: 'neutral',
            });

            return {
                response: [
                    'Guide is ready in local reflection mode, but there are no notes to ground this in yet.',
                    'Start with one short entry about what happened today, how it affected you, and what feels unfinished.',
                    'Try one of these prompts:',
                    ...prompts.map((prompt, index) => `${index + 1}. ${prompt}`),
                ].join('\n\n'),
                provider: 'guided_reflection',
                vendor: 'local',
                mode: 'guided_reflection',
                model: `${activeEmbeddingConfig.model} + guided-reflection-v1`,
                strategy: 'starter',
                lens,
                prompts,
                highlights: [],
                brief: null,
                bridge: actionResponse.bridge,
                risk: actionResponse.risk,
                safetyCard: actionResponse.safetyCard,
            };
        }

        const shouldSearch = intent !== 'summary';
        const searchResult = shouldSearch
            ? await executeHybridSearch({
                userId: input.userId,
                query: normalizedQuery,
                limit: 4,
                intent: mapReflectionIntentToSearchIntent(intent),
            })
            : null;

        const searchMatchMap = new Map((searchResult?.results || []).map((result) => [result.id, result]));
        const recentEntryMap = new Map(recentEntries.map((entry) => [entry.id, entry]));
        const missingMatchIds = (searchResult?.results || [])
            .map((result) => result.id)
            .filter((id) => !recentEntryMap.has(id));
        const additionalMatchedEntries = missingMatchIds.length > 0
            ? await prisma.entry.findMany({
                where: {
                    userId: input.userId,
                    deletedAt: null,
                    id: {
                        in: missingMatchIds,
                    },
                },
                select: {
                    id: true,
                    title: true,
                    content: true,
                    mood: true,
                    tags: true,
                    skills: true,
                    lessons: true,
                    createdAt: true,
                    analysisRecord: {
                        select: {
                            summary: true,
                            topics: true,
                            keywords: true,
                            suggestedMood: true,
                        },
                    },
                },
            })
            : [];
        const searchEntryMap = new Map([
            ...recentEntries.map((entry) => [entry.id, entry] as const),
            ...additionalMatchedEntries.map((entry) => [entry.id, entry] as const),
        ]);
        const matchedEntries = (searchResult?.results || [])
            .map((result) => searchEntryMap.get(result.id))
            .filter((entry): entry is ReflectionEntry => Boolean(entry));

        const focalEntries = matchedEntries.length > 0
            ? matchedEntries
            : recentEntries.slice(0, intent === 'summary' || intent === 'pattern' ? 4 : 3);
        const insightEntries = (intent === 'summary' || intent === 'pattern')
            ? recentEntries
            : focalEntries.length >= 2
                ? focalEntries
                : recentEntries.slice(0, 4);

        const insights = await nlpService.generateInsights(insightEntries.map((entry) => ({
            content: entry.content,
            mood: entry.mood || undefined,
            createdAt: entry.createdAt,
            skills: entry.skills,
            lessons: entry.lessons,
        })));

        const topics = uniqueStrings([
            ...insights.topTopics,
            ...focalEntries.flatMap((entry) => entry.analysisRecord?.topics || []),
            ...focalEntries.flatMap((entry) => entry.tags || []),
            ...focalEntries.flatMap((entry) => entry.skills || []),
        ], 4);
        const prompts = buildPrompts({
            intent,
            lens,
            writingPreference,
            topics,
            starterPrompt: profile?.starterPrompt || null,
            dominantMood: insights.dominantMood,
        });
        const actionResponse = await studentActionService.preview({
            userId: input.userId,
            content: normalizedQuery,
        });

        const highlights = focalEntries.slice(0, 3).map((entry) => {
            const searchMatch = searchMatchMap.get(entry.id);
            const reason = searchMatch?.matchReasons?.[0]
                || entry.analysisRecord?.topics?.[0]
                || entry.tags?.[0]
                || entry.mood
                || 'Recent note';
            const excerpt = entry.analysisRecord?.summary
                || takeFirstSentence(entry.content, 180);

            return {
                id: entry.id,
                title: entry.title,
                createdAt: formatDate(entry.createdAt),
                mood: entry.mood,
                reason,
                excerpt,
            };
        });

        if (actionResponse.risk.level === 'red' && actionResponse.safetyCard) {
            return {
                response: [
                    actionResponse.safetyCard.headline,
                    actionResponse.safetyCard.body,
                    actionResponse.safetyCard.draftMessage
                        ? `You could say: "${actionResponse.safetyCard.draftMessage}"`
                        : '',
                ].filter(Boolean).join('\n\n'),
                provider: 'guided_reflection',
                vendor: 'local',
                mode: 'guided_reflection',
                model: `${activeEmbeddingConfig.model} + guided-reflection-v1`,
                strategy: buildStrategyLabel(searchResult?.results || null, recentEntries.length),
                lens,
                prompts,
                highlights: actionResponse.highlights.length > 0 ? actionResponse.highlights : highlights,
                brief: null,
                bridge: actionResponse.bridge,
                risk: actionResponse.risk,
                safetyCard: actionResponse.safetyCard,
            };
        }

        const intro = searchResult?.results?.length
            ? `Guide is running in ${lens} mode, so I stayed close to the notes that best match your question.`
            : `Guide is running in ${lens} mode, so I grounded this in your most recent notes instead of generating a freeform answer.`;

        const responseSections: string[] = [
            intro,
        ];

        if (lens === 'bridge' && actionResponse.bridge) {
            responseSections.push(
                [
                    'What I found',
                    ...highlights.map((highlight) =>
                        `- ${highlight.createdAt}: ${highlight.title || 'Untitled note'}${highlight.mood ? ` (${highlight.mood})` : ''} - ${highlight.excerpt} [${highlight.reason}]`
                    ),
                ].join('\n'),
                actionResponse.brief
                    ? [
                        'Why this feels live right now',
                        actionResponse.brief.pattern,
                    ].join('\n')
                    : '',
                actionResponse.brief?.whatHelpedBefore
                    ? [
                        'What helped before',
                        actionResponse.brief.whatHelpedBefore.summary,
                    ].join('\n')
                    : '',
                [
                    'Who could help now',
                    `${actionResponse.bridge.recommendedRecipient}${actionResponse.bridge.channelLabel ? ` (${actionResponse.bridge.channelLabel.toLowerCase()})` : ''}: ${actionResponse.bridge.whyNow}`,
                ].join('\n'),
                [
                    'What to say first',
                    actionResponse.bridge.messageDraft,
                ].join('\n'),
                [
                    'Keep the conversation small',
                    ...actionResponse.bridge.talkTrack.map((item, index) => `${index + 1}. ${item}`),
                ].join('\n'),
                [
                    'If you want to write before reaching out',
                    ...prompts.map((prompt, index) => `${index + 1}. ${prompt}`),
                ].join('\n')
            );
        } else {
            responseSections.push(
                [
                    'What I found',
                    ...highlights.map((highlight) =>
                        `- ${highlight.createdAt}: ${highlight.title || 'Untitled note'}${highlight.mood ? ` (${highlight.mood})` : ''} - ${highlight.excerpt} [${highlight.reason}]`
                    ),
                ].join('\n'),
                [
                    'Pattern to notice',
                    buildOverviewLine({
                        lens,
                        dominantMood: insights.dominantMood,
                        moodTrend: insights.moodTrend,
                        topTopics: topics,
                        entryCount: insightEntries.length,
                    }),
                ].join('\n'),
                [
                    'Try exploring next',
                    ...prompts.map((prompt, index) => `${index + 1}. ${prompt}`),
                ].join('\n')
            );
        }

        if (insights.suggestions.length > 0) {
            responseSections.push([
                'One practical nudge',
                insights.suggestions[0],
            ].join('\n'));
        }

        if (actionResponse.brief) {
            responseSections.splice(2, 0,
                [
                    'What this seems like',
                    actionResponse.brief.pattern,
                ].join('\n'),
                actionResponse.brief.whatHelpedBefore
                    ? [
                        'What helped before',
                        actionResponse.brief.whatHelpedBefore.summary,
                    ].join('\n')
                    : '',
                actionResponse.brief.nextMove
                    ? [
                        'One move for today',
                        actionResponse.brief.nextMove.description,
                    ].join('\n')
                    : ''
            );
        }

        return {
            response: responseSections.filter(Boolean).join('\n\n'),
            provider: 'guided_reflection',
            vendor: 'local',
            mode: 'guided_reflection',
            model: `${activeEmbeddingConfig.model} + guided-reflection-v1`,
            strategy: buildStrategyLabel(searchResult?.results || null, recentEntries.length),
            lens,
            prompts,
            highlights: actionResponse.highlights.length > 0 ? actionResponse.highlights : highlights,
            brief: actionResponse.brief,
            bridge: actionResponse.bridge,
            risk: actionResponse.risk,
            safetyCard: actionResponse.safetyCard,
        };
    }
}

export default new GuidedReflectionService();
