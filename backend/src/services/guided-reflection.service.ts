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
import { createLlmChatCompletion, aiRuntime, hasLlmProvider } from '../config/ai';

type GuidedReflectionIntent = 'summary' | 'pattern' | 'emotion' | 'next_step' | 'memory' | 'bridge' | 'general';
export type GuidedReflectionLens = 'memory' | 'patterns' | 'lessons' | 'stories';
export type LegacyGuidedReflectionLens = 'clarity' | 'growth' | 'bridge';
export type GuidedReflectionLensValue = GuidedReflectionLens | LegacyGuidedReflectionLens;
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
    lens: GuidedReflectionLensValue;
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
    'What lesson keeps showing up in my notes?',
    'Which memory feels worth keeping?',
    'What skills are showing up in this entry?',
    'Turn this into a story I can use later.',
];

const GUIDED_LENSES: GuidedReflectionStatus['lenses'] = [
    {
        id: 'memory',
        label: 'Memory',
        description: 'Reconnect the present note to older moments worth keeping.',
    },
    {
        id: 'patterns',
        label: 'Patterns',
        description: 'Look across notes for repeated themes, moods, and signals.',
    },
    {
        id: 'lessons',
        label: 'Lessons',
        description: 'Pull out lessons, strengths, and skills from what you wrote.',
    },
    {
        id: 'stories',
        label: 'Stories',
        description: 'Turn your notes into story material you can reuse later.',
    },
];

export const isGuidedReflectionLensValue = (value: unknown): value is GuidedReflectionLensValue =>
    value === 'memory'
    || value === 'patterns'
    || value === 'lessons'
    || value === 'stories'
    || value === 'clarity'
    || value === 'growth'
    || value === 'bridge';

export const normalizeGuidedReflectionLens = (
    lens: GuidedReflectionLensValue | null | undefined
): GuidedReflectionLens | null => {
    if (!lens) return null;
    if (lens === 'clarity' || lens === 'bridge') return 'stories';
    if (lens === 'growth') return 'lessons';
    return lens;
};

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
    if (/(story|resume|statement|interview|use later|turn this into|reuse)/.test(normalized)) {
        return 'general';
    }
    if (/(lesson|skill|strength|learn|learning|takeaway|evidence)/.test(normalized)) {
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
    if (/(feel|feeling|mood|emotion|stress|stressed|anxious|sad|happy|overwhelmed)/.test(normalized)) {
        return 'emotion';
    }
    if (/(summary|summarize|week|month|lately|recently|overview)/.test(normalized)) {
        return 'summary';
    }
    return 'general';
};

const resolveLens = (lens: GuidedReflectionLensValue | null | undefined, intent: GuidedReflectionIntent): GuidedReflectionLens => {
    const normalizedLens = normalizeGuidedReflectionLens(lens);
    if (normalizedLens) return normalizedLens;
    if (intent === 'memory') return 'memory';
    if (intent === 'next_step') return 'lessons';
    if (intent === 'pattern') return 'patterns';
    return 'stories';
};

const applyLensToIntent = (
    lens: GuidedReflectionLens,
    intent: GuidedReflectionIntent,
    legacyBridgeRequested = false
): GuidedReflectionIntent => {
    if (intent !== 'general') return intent;
    if (legacyBridgeRequested) return 'bridge';
    switch (lens) {
        case 'memory':
            return 'memory';
        case 'lessons':
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
    lens: GuidedReflectionLensValue;
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
            'What part of this stretch feels worth carrying forward?',
        ],
        pattern: [
            `What seems to trigger ${topic} most often in your notes?`,
            `What tends to show up right after ${secondaryTopic} appears?`,
            'Which habit, person, or setting keeps showing up with this pattern?',
        ],
        emotion: [
            `What seems to be underneath the ${input.dominantMood || 'strong'} tone in these notes?`,
            'Which entry feels closest to how you feel today, and what is different now?',
            'What changed the last time this feeling appeared?',
        ],
        next_step: [
            input.starterPrompt?.trim() || `What happened around ${topic}, and what lesson or skill is inside it?`,
            `If you had to name one useful takeaway from ${secondaryTopic}, what would it be?`,
            'What strength, lesson, or signal from this note would future-you want to keep?',
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
            `What part of ${topic} could become useful later?`,
            'What detail would make this memory easier to reuse?',
            'What would future-you want to remember about this moment?',
        ],
    };

    return uniqueStrings(promptSets[input.intent], 3).map((prompt) =>
        formatPromptForPreference(prompt, input.writingPreference)
    );
};

const buildOverviewLine = (input: {
    lens: GuidedReflectionLensValue;
    dominantMood: string;
    moodTrend: 'improving' | 'declining' | 'stable';
    topTopics: string[];
    entryCount: number;
}): string => {
    const topicText = input.topTopics.length > 0
        ? ` with recurring themes around ${input.topTopics.slice(0, 3).join(', ')}`
        : '';
    if (input.lens === 'memory') {
        return `Across ${input.entryCount} note${input.entryCount === 1 ? '' : 's'}, this moment connects back to other memories${topicText}. The recent pattern looks ${input.moodTrend}.`;
    }
    if (input.lens === 'lessons') {
        return `Across ${input.entryCount} note${input.entryCount === 1 ? '' : 's'}, the clearest lesson area is forming around ${input.topTopics[0] || input.dominantMood || 'what keeps happening'}.`;
    }
    if (input.lens === 'bridge') {
        return `Across ${input.entryCount} note${input.entryCount === 1 ? '' : 's'}, the clearest support thread is around ${input.topTopics[0] || input.dominantMood || 'getting through something hard'}. This is a good moment to keep the human path visible.`;
    }
    if (input.lens === 'patterns') {
        return `Across ${input.entryCount} note${input.entryCount === 1 ? '' : 's'}, the strongest repeated pattern is ${input.topTopics[0] || input.dominantMood || 'still emerging'}. The recent trend looks ${input.moodTrend}.`;
    }
    return `Across ${input.entryCount} note${input.entryCount === 1 ? '' : 's'}, there is reusable story material forming${topicText}. The recent pattern looks ${input.moodTrend}.`;
};

const buildStrategyLabel = (searchResults: HybridSearchResult[] | null, entryCount: number): GuidedReflectionResponse['strategy'] => {
    if (searchResults && searchResults.length > 0) return 'hybrid';
    if (entryCount > 0) return 'recent';
    return 'starter';
};

export type NotiveInsightType = 'thread' | 'lesson' | 'strength';
export type NotiveDoodle = 'knot' | 'ladder' | 'sprout' | 'steady-me' | 'reach-someone' | 'see-my-growth' | 'shape-my-future';

export type NotiveInsight = {
    type: NotiveInsightType;
    text: string;
    doodle: NotiveDoodle;
};

export type MemoryMicroInsight = {
    analysisLine: string;
    takeawayLine: string;
};

const NOTIVE_INSIGHT_SCHEMA = `{
  "insights": [
    { "type": "thread", "text": "...", "doodle": "knot" },
    { "type": "lesson", "text": "...", "doodle": "ladder" },
    { "type": "strength", "text": "...", "doodle": "sprout" }
  ],
  "analysisLine": "...",
  "takeawayLine": "..."
}`;

const SAFE_DOODLES: NotiveDoodle[] = ['knot', 'ladder', 'sprout', 'steady-me', 'reach-someone', 'see-my-growth', 'shape-my-future'];

type ParsedNotiveResult = {
    insights: NotiveInsight[];
    analysisLine: string | null;
    takeawayLine: string | null;
};

function parseNotiveInsights(raw: string): ParsedNotiveResult | null {
    try {
        // Try parsing as the new { insights, analysisLine, takeawayLine } shape first
        const jsonObjMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonObjMatch) {
            const parsed = JSON.parse(jsonObjMatch[0]);
            const insightsArr = Array.isArray(parsed.insights) ? parsed.insights : Array.isArray(parsed) ? parsed : null;
            if (!insightsArr) return null;

            const insights = insightsArr
                .filter((item: Record<string, unknown>) => item && typeof item.text === 'string' && (item.text as string).trim().length > 0)
                .slice(0, 3)
                .map((item: Record<string, unknown>) => ({
                    type: (['thread', 'lesson', 'strength'].includes(item.type as string) ? item.type : 'thread') as NotiveInsightType,
                    text: String(item.text).trim(),
                    doodle: (SAFE_DOODLES.includes(item.doodle as NotiveDoodle) ? item.doodle : 'sprout') as NotiveDoodle,
                }));

            if (insights.length === 0) return null;

            const analysisLine = typeof parsed.analysisLine === 'string' && parsed.analysisLine.trim()
                ? parsed.analysisLine.trim().slice(0, 100)
                : null;
            const takeawayLine = typeof parsed.takeawayLine === 'string' && parsed.takeawayLine.trim()
                ? parsed.takeawayLine.trim().slice(0, 100)
                : null;

            return { insights, analysisLine, takeawayLine };
        }

        // Fallback: try parsing as bare array (legacy)
        const jsonArrMatch = raw.match(/\[[\s\S]*\]/);
        if (!jsonArrMatch) return null;
        const parsed = JSON.parse(jsonArrMatch[0]);
        if (!Array.isArray(parsed)) return null;
        const insights = parsed
            .filter((item: Record<string, unknown>) => item && typeof item.text === 'string' && (item.text as string).trim().length > 0)
            .slice(0, 3)
            .map((item: Record<string, unknown>) => ({
                type: (['thread', 'lesson', 'strength'].includes(item.type as string) ? item.type : 'thread') as NotiveInsightType,
                text: String(item.text).trim(),
                doodle: (SAFE_DOODLES.includes(item.doodle as NotiveDoodle) ? item.doodle : 'sprout') as NotiveDoodle,
            }));
        if (insights.length === 0) return null;
        return { insights, analysisLine: null, takeawayLine: null };
    } catch {
        return null;
    }
}

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
                'Which memory feels worth keeping from this week?',
                'What pattern keeps repeating lately?',
                'What lesson keeps showing up in my notes?',
                'Turn this into a story I can use later.',
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
            defaultLens: writingPreference === 'guided' ? 'lessons' : 'stories',
        };
    }

    async respond(input: {
        userId: string;
        query: string;
        lens?: GuidedReflectionLensValue | null;
    }): Promise<GuidedReflectionResponse> {
        const normalizedQuery = input.query.trim();
        const inferredIntent = inferIntent(normalizedQuery);
        const legacyBridgeRequested = input.lens === 'bridge';
        const lens = resolveLens(input.lens || null, inferredIntent);
        const intent = applyLensToIntent(lens, inferredIntent, legacyBridgeRequested);
        const responseLens: GuidedReflectionLensValue = intent === 'bridge' ? 'bridge' : lens;

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
            const shouldExposeStarterSupport = inferredIntent === 'bridge'
                || actionResponse.risk.level === 'orange'
                || actionResponse.risk.level === 'red';
            const prompts = buildPrompts({
                intent: intent === 'next_step' ? 'next_step' : 'general',
                lens: responseLens,
                writingPreference,
                topics: [],
                starterPrompt: profile?.starterPrompt || null,
                dominantMood: 'neutral',
            });

            return {
                response: 'No notes to look at yet. Write one short entry about what happened today and what feels unfinished — that gives me enough to start finding patterns.',
                provider: 'guided_reflection',
                vendor: 'local',
                mode: 'guided_reflection',
                model: `${activeEmbeddingConfig.model} + guided-reflection-v1`,
                strategy: 'starter',
                lens: responseLens,
                prompts,
                highlights: [],
                brief: null,
                bridge: shouldExposeStarterSupport ? actionResponse.bridge : null,
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
            lens: responseLens,
            writingPreference,
            topics,
            starterPrompt: profile?.starterPrompt || null,
            dominantMood: insights.dominantMood,
        });
        const actionResponse = await studentActionService.preview({
            userId: input.userId,
            content: normalizedQuery,
        });
        const shouldExposeSupportPanels = intent === 'bridge'
            || actionResponse.risk.level === 'orange'
            || actionResponse.risk.level === 'red';

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
                lens: responseLens,
                prompts,
                highlights: actionResponse.highlights.length > 0 ? actionResponse.highlights : highlights,
                brief: null,
                bridge: shouldExposeSupportPanels ? actionResponse.bridge : null,
                risk: actionResponse.risk,
                safetyCard: actionResponse.safetyCard,
            };
        }

        // Build a compact, direct response that answers the user's question first.
        // Highlights are already rendered as cards in the UI — don't repeat them as text.
        const responseSections: string[] = [];

        if (intent === 'bridge' && actionResponse.bridge) {
            // Bridge mode: focus on who to talk to and what to say
            if (actionResponse.brief) {
                responseSections.push(actionResponse.brief.pattern);
            }
            responseSections.push(
                `${actionResponse.bridge.recommendedRecipient} might be the right person${actionResponse.bridge.channelLabel ? ` (${actionResponse.bridge.channelLabel.toLowerCase()})` : ''}. ${actionResponse.bridge.whyNow}`,
            );
            if (actionResponse.brief?.whatHelpedBefore) {
                responseSections.push(actionResponse.brief.whatHelpedBefore.summary);
            }
        } else {
            // All other modes: lead with the pattern/overview, then one nudge
            const overview = buildOverviewLine({
                lens: responseLens,
                dominantMood: insights.dominantMood,
                moodTrend: insights.moodTrend,
                topTopics: topics,
                entryCount: insightEntries.length,
            });
            responseSections.push(overview);

            if (responseLens === 'lessons') {
                const lesson = insights.topLessons?.[0] || topics[0];
                const skill = insights.topSkills?.[0] || null;
                if (lesson) {
                    responseSections.push(`A lesson that keeps surfacing: ${lesson}.`);
                }
                if (skill) {
                    responseSections.push(`A strength showing up here: ${skill}.`);
                }
            } else if (responseLens === 'stories') {
                const storyTopic = insights.topLessons?.[0] || insights.topSkills?.[0] || topics[0] || 'this moment';
                responseSections.push(`This material can become a reusable story about ${storyTopic}. Add the detail you would want future-you to reuse.`);
            } else if (responseLens === 'memory') {
                const anchorHighlight = highlights[0];
                if (anchorHighlight) {
                    responseSections.push(`The clearest memory to keep nearby is "${anchorHighlight.title || 'Untitled note'}" from ${anchorHighlight.createdAt}.`);
                }
            } else if (responseLens === 'patterns' && topics[0]) {
                responseSections.push(`The strongest repeating signal looks tied to ${topics[0]}.`);
            }

            if (insights.suggestions.length > 0 && responseSections.length < 3) {
                responseSections.push(insights.suggestions[0]);
            }
        }

        return {
            response: responseSections.filter(Boolean).join('\n\n'),
            provider: 'guided_reflection',
            vendor: 'local',
            mode: 'guided_reflection',
            model: `${activeEmbeddingConfig.model} + guided-reflection-v1`,
            strategy: buildStrategyLabel(searchResult?.results || null, recentEntries.length),
            lens: responseLens,
            prompts,
            highlights: actionResponse.highlights.length > 0 ? actionResponse.highlights : highlights,
            brief: shouldExposeSupportPanels ? actionResponse.brief : null,
            bridge: shouldExposeSupportPanels ? actionResponse.bridge : null,
            risk: actionResponse.risk,
            safetyCard: actionResponse.safetyCard,
        };
    }

    async generateNotiveInsights(entryId: string, userId: string): Promise<NotiveInsight[] | null> {
        if (!hasLlmProvider()) return null;

        const [entry, recentEntries] = await Promise.all([
            prisma.entry.findUnique({
                where: { id: entryId, userId },
                select: {
                    id: true,
                    title: true,
                    content: true,
                    analysis: true,
                    skills: true,
                    lessons: true,
                    mood: true,
                },
            }),
            prisma.entry.findMany({
                where: { userId, deletedAt: null, NOT: { id: entryId } },
                orderBy: { createdAt: 'desc' },
                take: 4,
                select: {
                    skills: true,
                    lessons: true,
                    mood: true,
                    analysisRecord: {
                        select: { topics: true, summary: true },
                    },
                },
            }),
        ]);

        if (!entry) return null;

        const excerpt = takeFirstSentence(entry.content, 200);
        const recentContext = recentEntries.map((e, i) => ({
            index: i + 1,
            skills: e.skills.slice(0, 2),
            lessons: e.lessons.slice(0, 2),
            mood: e.mood,
            topics: e.analysisRecord?.topics.slice(0, 2) || [],
        }));

        const prompt = `You are Notive, a calm notebook for teenagers.
The user just wrote or viewed this memory:
Title: ${entry.title || '(no title)'}
Excerpt: ${excerpt}
Skills noted: ${entry.skills.join(', ') || 'none'}
Lessons noted: ${entry.lessons.join(', ') || 'none'}
Analysis: ${JSON.stringify(entry.analysis || {})}

From the last ${recentEntries.length} entries context: ${JSON.stringify(recentContext)}

Surface 3 short, grounded insights (max 18 words each):
- One recurring thread or pattern (what keeps coming up)
- One real lesson learned from their own past notes
- One quiet strength or skill showing up

Also generate two micro-insight lines specific to THIS memory:
- "analysisLine": One sentence (max 15 words) capturing the most important trend, pattern, or observation about THIS specific memory. Start with what you noticed — not generic advice. Good: "Third time this month stress peaks right before your Tuesday meetings." Bad: "You seem to have mixed feelings sometimes."
- "takeawayLine": One sentence (max 15 words) framing a concrete lesson or skill the writer can carry into real life, professionally or personally. Start with an action verb. Good: "Naming your stress triggers is already a self-regulation skill." Bad: "Keep working on yourself."

Always be calm, specific, non-clinical, and action-oriented.
Pick one doodle per insight from: knot (tension/uncertainty), ladder (progress/lesson), sprout (growth/strength), steady-me (self-regulation), reach-someone (support/connection), see-my-growth (patterns), shape-my-future (future/stories).

Output ONLY valid JSON in this exact shape:
${NOTIVE_INSIGHT_SCHEMA}`;

        try {
            const result = await createLlmChatCompletion({
                model: aiRuntime.promptModel,
                response_format: { type: 'json_object' },
                messages: [{ role: 'system', content: 'You generate journal insights. Always respond with valid JSON only.' }, { role: 'user', content: prompt }],
                max_tokens: 400,
                temperature: 0.7,
            });
            const raw = result?.choices?.[0]?.message?.content || '';
            const parsed = parseNotiveInsights(raw);
            if (!parsed || parsed.insights.length === 0) return null;

            // Persist insights + micro-insight lines back into analysis JSON (no schema change — analysis is Json?)
            await prisma.entry.update({
                where: { id: entryId },
                data: {
                    analysis: {
                        ...(typeof entry.analysis === 'object' && entry.analysis !== null ? entry.analysis as object : {}),
                        notiveInsights: parsed.insights,
                        ...(parsed.analysisLine ? { analysisLine: parsed.analysisLine } : {}),
                        ...(parsed.takeawayLine ? { takeawayLine: parsed.takeawayLine } : {}),
                    },
                },
            });

            return parsed.insights;
        } catch (err) {
            console.error('generateNotiveInsights error:', err);
            return null;
        }
    }
}

export default new GuidedReflectionService();
