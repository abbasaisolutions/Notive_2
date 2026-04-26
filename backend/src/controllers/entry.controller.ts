import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { deleteFile } from '../services/file.service';
import taggingService, { isValidTag } from '../services/tagging.service';
import { Prisma, TagSource } from '@prisma/client';
import { buildTagMetaList, normalizeTag, syncEntryTags } from '../services/tag-manager.service';
import { upsertEntryAnalysisFromNlp, upsertEntryAnalysisFromPayload } from '../services/entry-analysis.service';
import nlpService, { AnalysisResult } from '../services/nlp.service';
import embeddingService from '../services/embedding.service';
import { MIN_CHARACTERS_FOR_ENTRY_SAVE, MIN_WORDS_FOR_ENTRY_INSIGHTS } from '../constants/entry-requirements';
import { sanitizeHtml } from '../utils/html';
import { buildEntryStorySignal, deriveExperienceEvidence, OpportunityEntry } from '../services/opportunity.service';
import studentActionService from '../services/student-action.service';
import guidedReflectionService from '../services/guided-reflection.service';
import moodForecastService from '../services/mood-forecast.service';
import { PushNotificationService } from '../services/push-notification.service';
import {
    shouldCreateNotificationForType,
    shouldSendPushForType,
} from '../services/notification-preferences.service';

const pushService = new PushNotificationService(prisma);
import {
    buildEntryListWhere,
    filterEntriesByTemporalContext,
    normalizeEntryDayPart,
    normalizeEntryDateKey,
    normalizeEntryDateRange,
    normalizeEntryMood,
    normalizeEntrySearch,
    normalizeEntrySource,
    normalizeEntryTag,
    normalizeEntryTheme,
    normalizeEntryWeekday,
    normalizeLifeArea,
} from '../utils/entry-filters';

const normalizeToken = (value: string): string =>
    value
        .replace(/[#*`]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const VALID_CATEGORIES = new Set(['PERSONAL', 'PROFESSIONAL']);
const QUICK_CHECKIN_TITLES = new Set(['quick check-in', 'quick check in']);
const QUICK_CHECKIN_TAGS = new Set(['check-in', 'daily-checkin', 'daily check-in']);

const isJsonObject = (value: unknown): value is Prisma.JsonObject =>
    !!value && typeof value === 'object' && !Array.isArray(value);

const hasStringArrayValues = (value: unknown): boolean =>
    Array.isArray(value) && value.some((item) => typeof item === 'string' && item.trim().length > 0);

const hasPersistableAiInsights = (analysis: unknown): analysis is Prisma.JsonObject => {
    if (!isJsonObject(analysis)) return false;

    const ai = analysis.ai;
    if (!isJsonObject(ai)) return false;

    const aiRecord = ai as Record<string, unknown>;
    const sentiment = isJsonObject(aiRecord.sentiment) ? (aiRecord.sentiment as Record<string, unknown>) : null;
    const evidence = isJsonObject(aiRecord.evidence) ? (aiRecord.evidence as Record<string, unknown>) : null;

    const hasSentiment =
        !!sentiment &&
        (
            typeof sentiment.label === 'string' ||
            typeof sentiment.summary === 'string' ||
            typeof sentiment.score === 'number'
        );

    const hasTopics = hasStringArrayValues(aiRecord.topics) || hasStringArrayValues(aiRecord.keywords);

    const hasEvidence = !!evidence && ['situation', 'action', 'lesson', 'outcome'].some((field) => {
        const value = evidence[field];
        if (typeof value === 'string') return value.trim().length > 0;
        if (!isJsonObject(value)) return false;
        const point = value as Record<string, unknown>;
        return typeof point.text === 'string' && point.text.trim().length > 0;
    });

    return hasSentiment || hasTopics || hasEvidence;
};

const normalizedText = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    return value.trim();
};

const normalizedStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
};

const isQuickEntryLike = (input: {
    title?: string | null;
    tags?: string[] | null;
    entryMode?: string | null;
}): boolean => {
    if (input.entryMode === 'quick') return true;

    const normalizedTitle = typeof input.title === 'string'
        ? input.title.trim().toLowerCase()
        : '';
    if (normalizedTitle && QUICK_CHECKIN_TITLES.has(normalizedTitle)) {
        return true;
    }

    const normalizedTags = Array.isArray(input.tags)
        ? input.tags.map((tag) => String(tag).trim().toLowerCase())
        : [];

    return normalizedTags.some((tag) => QUICK_CHECKIN_TAGS.has(tag));
};

const attachEntryStorySignal = <T extends {
    id: string;
    title: string | null;
    content: string;
    mood: string | null;
    tags: string[];
    skills: string[];
    lessons: string[];
    reflection: string | null;
    createdAt: Date;
    analysis: unknown;
}>(entry: T) => {
    const { analysis, ...responseEntry } = entry;

    const analysisObj: Record<string, unknown> | null =
        analysis && typeof analysis === 'object' && !Array.isArray(analysis)
            ? (analysis as Record<string, unknown>)
            : null;

    // AI insights may be nested under analysisObj.ai (from ai.controller.ts)
    const aiObj: Record<string, unknown> | null =
        analysisObj?.ai && typeof analysisObj.ai === 'object' && !Array.isArray(analysisObj.ai)
            ? (analysisObj.ai as Record<string, unknown>)
            : null;

    const notiveInsights = analysisObj && Array.isArray(analysisObj.notiveInsights)
        ? analysisObj.notiveInsights
        : undefined;

    const analysisLine = (typeof aiObj?.analysisLine === 'string' && aiObj.analysisLine.trim())
        ? aiObj.analysisLine as string
        : (typeof analysisObj?.analysisLine === 'string' && analysisObj.analysisLine.trim())
            ? analysisObj.analysisLine as string
            : undefined;
    const takeawayLine = (typeof aiObj?.takeawayLine === 'string' && aiObj.takeawayLine.trim())
        ? aiObj.takeawayLine as string
        : (typeof analysisObj?.takeawayLine === 'string' && analysisObj.takeawayLine.trim())
            ? analysisObj.takeawayLine as string
            : undefined;

    // Extract top emotions from analysis blob (Record<string, number>)
    const rawEmotions = aiObj?.emotions ?? analysisObj?.emotions;
    const emotions: Record<string, number> | undefined =
        rawEmotions && typeof rawEmotions === 'object' && !Array.isArray(rawEmotions)
            ? (rawEmotions as Record<string, number>)
            : undefined;
    const topEmotions = emotions
        ? Object.entries(emotions)
            .filter(([, v]) => typeof v === 'number' && v > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([emotion, intensity]) => ({ emotion, intensity }))
        : undefined;

    // Compute per-entry reflection depth level (0-4) from available signals
    const hasReflection = Boolean(entry.reflection?.trim());
    const hasLessons = (entry.lessons?.length ?? 0) > 0;
    const hasSkills = (entry.skills?.length ?? 0) > 0;
    const wordCount = entry.content.trim().split(/\s+/).filter(Boolean).length;
    const depthSignals = (hasReflection ? 1 : 0) + (hasLessons ? 1 : 0) + (hasSkills ? 1 : 0) + (wordCount > 120 ? 1 : 0);
    const depthLevel: 0 | 1 | 2 | 3 | 4 = depthSignals >= 4 ? 4 : depthSignals >= 3 ? 3 : depthSignals >= 2 ? 2 : depthSignals >= 1 ? 1 : 0;
    const depthLabels = ['Surface', 'Noticing', 'Connecting', 'Pattern-finding', 'Integrating'];

    // Growth language ratio: quick heuristic from content
    const contentLower = entry.content.toLowerCase();
    const growthPhrases = ['i learned', 'i realized', 'i grew', 'i improved', 'next time', 'i can', 'i will', 'going forward', 'progress', 'better at'];
    const fixedPhrases = ['i can\'t', 'i\'m stuck', 'nothing works', 'i always fail', 'i never', 'impossible'];
    const growthHits = growthPhrases.filter(p => contentLower.includes(p)).length;
    const fixedHits = fixedPhrases.filter(p => contentLower.includes(p)).length;
    const totalHits = growthHits + fixedHits;
    const growthRatio = totalHits > 0 ? Math.round((growthHits / totalHits) * 100) : null;

    return {
        ...responseEntry,
        notiveInsights,
        analysisLine,
        takeawayLine,
        topEmotions: topEmotions && topEmotions.length > 0 ? topEmotions : undefined,
        depthLevel,
        depthLabel: depthLabels[depthLevel],
        growthRatio,
        storySignal: buildEntryStorySignal({
            id: entry.id,
            title: entry.title,
            content: entry.content,
            mood: entry.mood,
            tags: entry.tags,
            skills: entry.skills,
            lessons: entry.lessons,
            reflection: entry.reflection,
            createdAt: entry.createdAt,
            analysis: entry.analysis,
        }),
    };
};

const normalizedComparisonTokens = (value: string): string[] =>
    value
        .toLowerCase()
        .match(/[a-z0-9']+/g) || [];

const hasLongVerbatimOverlap = (candidate: string, source: string, windowSize = 12): boolean => {
    const candidateTokens = normalizedComparisonTokens(candidate);
    const sourceTokens = normalizedComparisonTokens(source);
    if (candidateTokens.length < windowSize || sourceTokens.length < windowSize) return false;

    const sourceNgrams = new Set<string>();
    for (let i = 0; i <= sourceTokens.length - windowSize; i++) {
        sourceNgrams.add(sourceTokens.slice(i, i + windowSize).join(' '));
    }

    for (let i = 0; i <= candidateTokens.length - windowSize; i++) {
        const gram = candidateTokens.slice(i, i + windowSize).join(' ');
        if (sourceNgrams.has(gram)) return true;
    }

    return false;
};

const looksLowSignal = (
    value: string,
    sourceContent: string,
    field: 'situation' | 'action' | 'lesson' | 'outcome' | 'skills' = 'situation'
): boolean => {
    const normalized = normalizedText(value);
    if (!normalized) return true;
    if (/^(context:|executed work on|observed outcome:|key lesson:)/i.test(normalized)) return true;
    if (/^(then|and then)\.?$/i.test(normalized)) return true;
    if (normalized.split(/\s+/).length < 5) return true;
    if (field === 'action' && !/\b(led|organized|built|created|managed|supported|resolved|improved|launched|coordinated|presented|mentored|planned|worked|made|wrote|studied|practiced|implemented|designed|shipped|delivered|completed|finished|fixed|solved|applied|submitted|prepared|tested|reviewed|started|focused|went|go|came|talked|spoke|met|visited|called|attended|helped|trained|exercised|prayed|reflected|journaled|tried|ready|gave|give|wanted|discussed|looked|calculated|understood|understand|tuned)\b/i.test(normalized)) {
        return true;
    }
    if (field === 'lesson' && !/\b(learned|realized|discovered|understood|noticed|lesson|takeaway|in hindsight|looking back|next time|should|need to|could do better|would do better)\b/i.test(normalized)) {
        return true;
    }
    if (field === 'outcome' && !/\b(resulted in|led to|improved|increased|reduced|achieved|earned|completed|impact|outcome|as a result|therefore|was able to|i felt|we felt|felt|feel)\b/i.test(normalized) && !/\b\d+%|\b\d+\s*(users|clients|customers|days|hours|weeks|months|points|tickets|tasks)\b/i.test(normalized)) {
        return true;
    }
    if (hasLongVerbatimOverlap(normalized, sourceContent, 12)) return true;
    return false;
};

const upsertAutoOpportunityEvidence = async (entry: {
    id: string;
    title: string | null;
    content: string;
    mood: string | null;
    tags: string[];
    skills: string[];
    lessons: string[];
    reflection: string | null;
    createdAt: Date;
    analysis: unknown;
}): Promise<Prisma.JsonObject | null> => {
    if (entry.analysis !== null && entry.analysis !== undefined && !isJsonObject(entry.analysis)) {
        return null;
    }

    const sourceEntry: OpportunityEntry = {
        id: entry.id,
        title: entry.title,
        content: entry.content,
        mood: entry.mood,
        tags: entry.tags || [],
        skills: entry.skills || [],
        lessons: entry.lessons || [],
        reflection: entry.reflection || null,
        createdAt: entry.createdAt,
        analysis: entry.analysis ?? null,
        analysisRecord: null,
    };

    const experience = deriveExperienceEvidence(sourceEntry);

    const baseAnalysis: Prisma.JsonObject = isJsonObject(entry.analysis) ? entry.analysis : {};
    const existingOpportunity: Prisma.JsonObject = isJsonObject(baseAnalysis.opportunity) ? baseAnalysis.opportunity : {};

    const nextFields: Prisma.JsonObject = {};

    const existingSituation = normalizedText(existingOpportunity.situation);
    const existingAction = normalizedText(existingOpportunity.action);
    const existingLesson = normalizedText(existingOpportunity.lesson);
    const existingOutcome = normalizedText(existingOpportunity.outcome);
    const existingSkills = normalizedStringArray(existingOpportunity.skills);

    const synthesized = await nlpService.synthesizeOpportunityEvidence(entry.content, {
        situation: experience.situation,
        action: experience.action,
        lesson: experience.lesson,
        outcome: experience.outcome,
        skills: experience.skills,
    });

    const candidateSituation = normalizedText(synthesized?.situation || experience.situation);
    const candidateAction = normalizedText(synthesized?.action || experience.action);
    const candidateLesson = normalizedText(synthesized?.lesson || experience.lesson);
    const candidateOutcome = normalizedText(synthesized?.outcome || experience.outcome);
    const candidateSkills = (synthesized?.skills || experience.skills).slice(0, 10);

    const situationGood = !looksLowSignal(candidateSituation, entry.content, 'situation');
    const actionGood = !looksLowSignal(candidateAction, entry.content, 'action');
    const lessonGood = !looksLowSignal(candidateLesson, entry.content, 'lesson');
    const outcomeGood = !looksLowSignal(candidateOutcome, entry.content, 'outcome');

    const existingSituationLow = looksLowSignal(existingSituation, entry.content, 'situation');
    const existingActionLow = looksLowSignal(existingAction, entry.content, 'action');
    const existingLessonLow = looksLowSignal(existingLesson, entry.content, 'lesson');
    const existingOutcomeLow = looksLowSignal(existingOutcome, entry.content, 'outcome');

    if ((!existingSituation || existingSituationLow) && candidateSituation && (situationGood || existingSituationLow || !existingSituation)) {
        nextFields.situation = candidateSituation.slice(0, 800);
    }
    if ((!existingAction || existingActionLow) && candidateAction && (actionGood || existingActionLow || !existingAction)) {
        nextFields.action = candidateAction.slice(0, 800);
    }
    if ((!existingLesson || existingLessonLow) && candidateLesson && (lessonGood || existingLessonLow || !existingLesson)) {
        nextFields.lesson = candidateLesson.slice(0, 800);
    }
    if ((!existingOutcome || existingOutcomeLow) && candidateOutcome && (outcomeGood || existingOutcomeLow || !existingOutcome)) {
        nextFields.outcome = candidateOutcome.slice(0, 800);
    }
    if ((existingSkills.length === 0 || looksLowSignal(existingSkills.join(' '), entry.content, 'skills')) && candidateSkills.length > 0) {
        nextFields.skills = candidateSkills;
    }
    if (synthesized?.provider) nextFields.provider = synthesized.provider;
    if (typeof synthesized?.confidence === 'number') nextFields.confidence = Number(synthesized.confidence.toFixed(3));

    if (Object.keys(nextFields).length === 0) return null;

    const mergedOpportunity: Prisma.JsonObject = {
        ...existingOpportunity,
        ...nextFields,
        updatedAt: new Date().toISOString(),
    };

    const nextAnalysis: Prisma.InputJsonValue = {
        ...baseAnalysis,
        opportunity: mergedOpportunity,
    };

    await prisma.entry.update({
        where: { id: entry.id },
        data: { analysis: nextAnalysis },
    });

    return nextAnalysis as unknown as Prisma.JsonObject;
};

const dedupeStrings = (values: string[]): string[] => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const value of values) {
        const normalized = normalizeToken(value);
        if (!normalized) continue;
        const key = normalized.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(normalized);
    }
    return result;
};

const deriveGrowthSignalsFromAnalysis = (
    analysis: any
): { skills: string[]; lessons: string[]; reflection: string | null } => {
    if (!analysis || typeof analysis !== 'object') {
        return { skills: [], lessons: [], reflection: null };
    }

    const deterministic = analysis.deterministic || {};
    const ai = analysis.ai || {};

    const skillCandidates: string[] = [
        ...(Array.isArray(ai.topics) ? ai.topics : []),
        ...(Array.isArray(ai.keywords) ? ai.keywords : []),
        ...(Array.isArray(deterministic.suggestedTags) ? deterministic.suggestedTags : []),
        ...(Array.isArray(deterministic.activities) ? deterministic.activities.map((activity: any) => activity?.name).filter(Boolean) : []),
    ];

    const lessonCandidates: string[] = [
        ...(Array.isArray(deterministic.insights)
            ? deterministic.insights
                .filter((insight: any) => insight?.type === 'lesson')
                .map((insight: any) => insight?.content)
                .filter(Boolean)
            : []),
        ...(Array.isArray(deterministic.growthPoints)
            ? deterministic.growthPoints
                .filter((point: any) => point?.type === 'lesson')
                .map((point: any) => point?.description)
                .filter(Boolean)
            : []),
    ];

    const reflectionCandidate = [
        deterministic.summary,
        ai?.sentiment?.summary,
    ].find((value) => typeof value === 'string' && value.trim()) as string | undefined;

    return {
        skills: dedupeStrings(skillCandidates).slice(0, 12),
        lessons: dedupeStrings(lessonCandidates).slice(0, 12),
        reflection: reflectionCandidate ? normalizeToken(reflectionCandidate) : null,
    };
};

const deriveGrowthSignalsFromNlp = (
    analysis: AnalysisResult | null
): { skills: string[]; lessons: string[]; reflection: string | null } => {
    if (!analysis) return { skills: [], lessons: [], reflection: null };

    const reflectionCandidate = analysis.sentiment?.summary;
    const evidenceLessonCandidate =
        analysis.evidence?.lesson && typeof analysis.evidence.lesson.text === 'string'
            ? analysis.evidence.lesson.text
            : null;
    const skillCandidates = [
        ...(Array.isArray(analysis.topics) ? analysis.topics : []),
        ...(Array.isArray(analysis.keywords) ? analysis.keywords : []),
    ];

    return {
        skills: dedupeStrings(skillCandidates).slice(0, 12),
        lessons: dedupeStrings([
            ...(evidenceLessonCandidate ? [evidenceLessonCandidate] : []),
        ]).slice(0, 12),
        reflection: reflectionCandidate ? normalizeToken(reflectionCandidate) : null,
    };
};

const resolveSuggestedLifeArea = (analysis: AnalysisResult | null): string | null => {
    const suggestion = analysis?.suggestions?.lifeArea;
    if (!suggestion || suggestion.confidence < 0.72) {
        return null;
    }

    return normalizeLifeArea(suggestion.value);
};

const buildAiInsightsFromNlp = (analysis: AnalysisResult) => ({
    generatedAt: new Date().toISOString(),
    sentiment: analysis.sentiment,
    entities: analysis.entities || [],
    topics: analysis.topics || [],
    suggestedMood: analysis.suggestedMood || null,
    wordCount: analysis.wordCount || null,
    readingTime: analysis.readingTime || null,
    keywords: analysis.keywords || [],
    emotions: analysis.emotions || null,
    highlights: analysis.highlights || [],
    evidence: analysis.evidence || null,
    memory: analysis.memory || null,
    suggestions: analysis.suggestions || null,
    modelInfo: analysis.modelInfo || null,
    provider: analysis.provider || 'deterministic',
});

const mergeNlpInsightsIntoAnalysis = (
    existingAnalysis: unknown,
    nlpAnalysis: AnalysisResult | null
): Prisma.InputJsonValue => {
    if (!nlpAnalysis) {
        if (existingAnalysis && typeof existingAnalysis === 'object' && !Array.isArray(existingAnalysis)) {
            return existingAnalysis as Prisma.InputJsonValue;
        }
        return (existingAnalysis ?? null) as Prisma.InputJsonValue;
    }

    const base: Prisma.JsonObject =
        existingAnalysis && typeof existingAnalysis === 'object' && !Array.isArray(existingAnalysis)
            ? (existingAnalysis as Prisma.JsonObject)
            : {};

    return {
        ...base,
        ai: buildAiInsightsFromNlp(nlpAnalysis),
    } as unknown as Prisma.InputJsonValue;
};

// --- CREATE ENTRY ---
export const createEntry = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { title, content, contentHtml, mood, tags, coverImage, chapterId, entryMode, autoTag, analysis, category, lifeArea, locationLat, locationLng, locationName } = req.body;

        if (!content) {
            return res.status(400).json({ message: 'Content is required' });
        }
        if (!isQuickEntryLike({ title, tags, entryMode }) && content.trim().length < MIN_CHARACTERS_FOR_ENTRY_SAVE) {
            return res.status(400).json({ message: `Content must be at least ${MIN_CHARACTERS_FOR_ENTRY_SAVE} characters.` });
        }
        if (category !== undefined && !VALID_CATEGORIES.has(String(category))) {
            return res.status(400).json({ message: 'Invalid category. Use PERSONAL or PROFESSIONAL.' });
        }

        let nlpFallback: AnalysisResult | null = null;
        const providedTags = Array.isArray(tags) ? tags : [];
        let autoTagMeta: Array<{ name: string; confidence: number; source: TagSource }> = [];
        const safeContentHtml = sanitizeHtml(contentHtml);
        const payloadAnalysis = isJsonObject(analysis) ? analysis : null;
        const hasPayloadAiInsights = hasPersistableAiInsights(payloadAnalysis);
        const payloadGrowthSignals = hasPayloadAiInsights ? deriveGrowthSignalsFromAnalysis(payloadAnalysis) : null;

        if (!hasPayloadAiInsights) {
            const nlpTitle = typeof title === 'string' && title.trim() ? title : undefined;
            nlpFallback = await nlpService.analyzeContent(content, {
                title: nlpTitle,
                userId,
            });
        }

        if (autoTag || (providedTags.length === 0 && content.length > 20)) {
            try {
                const text = `${title ? `Title: ${title}\n` : ''}${content}`.trim();
                const suggestedTags = nlpFallback
                    ? await taggingService.suggestTagsFromAnalysis(text, nlpFallback)
                    : await taggingService.suggestTags(content, title, { userId });
                autoTagMeta = suggestedTags
                    .filter(t => t.confidence > 0.5)
                    .map(t => ({
                        name: t.name,
                        confidence: t.confidence,
                        source: t.source === 'ai'
                            ? TagSource.AI
                            : t.source === 'user'
                                ? TagSource.SYSTEM
                                : TagSource.NLP,
                    }));
            } catch (tagError) {
                console.error('Auto-tagging failed, using user tags:', tagError);
            }
        }

        const tagMeta = buildTagMetaList([
            ...providedTags
                .filter((tag: string) => isValidTag(normalizeTag(String(tag))))
                .map((tag: string) => ({ name: tag, source: TagSource.USER, confidence: 1 })),
            ...autoTagMeta,
        ]);

        const finalTags = tagMeta.map(t => t.name);
        const providedTagKeys = new Set(providedTags.map((tag: string) => String(tag).toLowerCase()));

        const nlpGrowthSignals = deriveGrowthSignalsFromNlp(nlpFallback);
        const growthSignals = payloadGrowthSignals || nlpGrowthSignals;
        const resolvedMood = mood || nlpFallback?.suggestedMood || null;
        const resolvedCategory = VALID_CATEGORIES.has(String(category)) ? String(category) : 'PERSONAL';
        const resolvedLifeArea = normalizeLifeArea(lifeArea) || resolveSuggestedLifeArea(nlpFallback);

        const entry = await prisma.entry.create({
            data: {
                title: title || null,
                content,
                contentHtml: safeContentHtml,
                mood: resolvedMood,
                tags: finalTags,
                coverImage: coverImage || null,
                chapterId: chapterId || null,
                category: resolvedCategory as 'PERSONAL' | 'PROFESSIONAL',
                lifeArea: resolvedLifeArea,
                analysis: hasPayloadAiInsights
                    ? (payloadAnalysis as Prisma.InputJsonValue)
                    : mergeNlpInsightsIntoAnalysis(payloadAnalysis, nlpFallback),
                skills: growthSignals.skills,
                lessons: growthSignals.lessons,
                reflection: growthSignals.reflection,
                locationLat: typeof locationLat === 'number' ? locationLat : null,
                locationLng: typeof locationLng === 'number' ? locationLng : null,
                locationName: typeof locationName === 'string' ? locationName || null : null,
                userId,
            },
        });

        // These three operations write to independent tables (EntryTag, EntryAnalysis,
        // opportunity evidence) and don't share transactional constraints, so
        // running them in parallel shaves ~100-200ms off the create response path.
        const analysisPromise = hasPayloadAiInsights && payloadAnalysis
            ? upsertEntryAnalysisFromPayload({
                entryId: entry.id,
                userId,
                payload: payloadAnalysis,
                content,
            })
            : nlpFallback
                ? upsertEntryAnalysisFromNlp({
                    entryId: entry.id,
                    userId,
                    analysis: nlpFallback,
                    content,
                })
                : Promise.resolve();

        const [, , opportunityAnalysis] = await Promise.all([
            syncEntryTags({ entryId: entry.id, userId, tags: tagMeta }),
            analysisPromise,
            upsertAutoOpportunityEvidence({
                id: entry.id,
                title: entry.title,
                content: entry.content,
                mood: entry.mood,
                tags: entry.tags,
                skills: entry.skills,
                lessons: entry.lessons,
                reflection: entry.reflection,
                createdAt: entry.createdAt,
                analysis: entry.analysis,
            }),
        ]);
        const { mergedAnalysis, response: studentActionResponse } = await studentActionService.persistEntrySignals({
            entryId: entry.id,
            userId,
            title: entry.title,
            content: entry.content,
            analysis: opportunityAnalysis ?? entry.analysis,
        });

        embeddingService.enqueueEntryEmbedding({
            entryId: entry.id,
            userId,
            content,
            title: typeof title === 'string' ? title : null,
            mood: entry.mood,
            tags: entry.tags,
            skills: entry.skills,
            lessons: entry.lessons,
            reflection: entry.reflection,
            analysis: mergedAnalysis,
            category: entry.category,
            lifeArea: entry.lifeArea,
        });

        const responseEntry = { ...entry, analysis: mergedAnalysis };

        // Fire-and-forget: generate Notive Noticed insights in the background
        guidedReflectionService.generateNotiveInsights(entry.id, userId).catch(() => {});

        // Invalidate mood forecast cache — next dashboard load will recompute.
        void moodForecastService.invalidate(userId);

        // Fire-and-forget: notify when career evidence is extracted
        setImmediate(async () => {
            try {
                const opportunityEntry: OpportunityEntry = {
                    id: entry.id,
                    title: entry.title,
                    content: entry.content,
                    reflection: entry.reflection,
                    mood: entry.mood,
                    tags: entry.tags as string[],
                    skills: entry.skills as string[],
                    lessons: entry.lessons as string[],
                    createdAt: entry.createdAt,
                    analysis: mergedAnalysis,
                };
                const evidence = deriveExperienceEvidence(opportunityEntry);
                if (evidence.completeness.score < 60) return;

                const userProfile = await prisma.userProfile.findUnique({
                    where: { userId },
                    select: { personalizationSignals: true },
                });
                const signals = userProfile?.personalizationSignals ?? null;
                if (!shouldCreateNotificationForType(signals, 'portfolio_evidence')) return;

                const titleSnippet = entry.title
                    || entry.content.replace(/<[^>]*>/g, '').slice(0, 40).trim()
                    || 'your latest entry';

                const notification = await prisma.inAppNotification.create({
                    data: {
                        userId,
                        type: 'portfolio_evidence',
                        title: 'New story found in your writing',
                        body: `Notive extracted a story from "${titleSnippet}".`,
                        data: {
                            entryId: entry.id,
                            link: `/portfolio?highlight=${entry.id}`,
                        },
                    },
                    select: { id: true },
                });

                if (shouldSendPushForType(signals, 'portfolio_evidence')) {
                    // Fire-and-forget — no reason to hold the setImmediate open
                    // for the push round-trip; errors already swallowed.
                    void pushService.sendPushNotification(userId, {
                        title: 'New story found in your writing',
                        body: `Notive extracted a story from "${titleSnippet}".`,
                        data: {
                            type: 'portfolio_evidence',
                            entryId: entry.id,
                            link: `/portfolio?highlight=${entry.id}`,
                            notificationId: notification.id,
                        },
                    }).catch(() => null);
                }
            } catch { /* non-critical */ }
        });

        const wordCount = content.trim().split(/\s+/).length;

        const safetySurface = studentActionResponse.risk.level !== 'none'
            ? {
                risk: studentActionResponse.risk,
                safetyCard: studentActionResponse.safetyCard,
            }
            : null;

        return res.status(201).json({
            entry: attachEntryStorySignal(responseEntry),
            suggestedTags: autoTagMeta
                .map(t => t.name)
                .filter(tag => !providedTagKeys.has(tag.toLowerCase())),
            suggestions: nlpFallback?.suggestions || null,
            ...(safetySurface ? { safety: safetySurface } : {}),
            ...(wordCount < MIN_WORDS_FOR_ENTRY_INSIGHTS ? { insufficientContent: true } : {}),
        });
    } catch (error) {
        console.error('Create entry error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// --- GET ALL ENTRIES (with pagination and search) ---
export const getEntries = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const pageRaw = parseInt(req.query.page as string, 10);
        const limitRaw = parseInt(req.query.limit as string, 10);
        const page = Number.isFinite(pageRaw) ? Math.max(pageRaw, 1) : 1;
        const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20;
        const search = normalizeEntrySearch(req.query.search);
        const source = normalizeEntrySource(req.query.source);
        const lifeArea = normalizeLifeArea(req.query.lifeArea);
        const theme = normalizeEntryTheme(req.query.theme);
        const tag = normalizeEntryTag(req.query.tag);
        const mood = normalizeEntryMood(req.query.mood);
        const date = normalizeEntryDateKey(req.query.date);
        const { startDate, endDate } = normalizeEntryDateRange({
            startDate: req.query.startDate,
            endDate: req.query.endDate,
        });
        const weekday = normalizeEntryWeekday(req.query.weekday);
        const dayPart = normalizeEntryDayPart(req.query.dayPart);
        const skip = (page - 1) * limit;
        const where = buildEntryListWhere({
            userId,
            search,
            source,
            lifeArea,
            theme,
            tag,
            mood,
            date,
            startDate,
            endDate,
        });
        const facetWhere = buildEntryListWhere({
            userId,
            search,
            source,
            theme,
            tag,
            mood,
            date,
            startDate,
            endDate,
        });
        const hasTemporalFilters = Boolean(weekday || dayPart);
        const entrySelect = {
            id: true,
            title: true,
            content: true,
            mood: true,
            source: true,
            category: true,
            lifeArea: true,
            chapterId: true,
            tags: true,
            skills: true,
            lessons: true,
            reflection: true,
            analysis: true,
            coverImage: true,
            createdAt: true,
            updatedAt: true,
        } as const;

        // When temporal filters are active (weekday/dayPart), we can't push the
        // filter into SQL without reproducing the full complex WHERE in raw SQL.
        // Two-step approach: first fetch only lightweight rows (id/createdAt/tags)
        // matching the complex WHERE, filter by weekday/dayPart in JS, then fetch
        // full entry data for just the paginated IDs. This avoids the previous
        // unbounded fetch of full entry rows (incl. analysis JSONB) for every row
        // in the user's journal.
        const temporalContext = { weekday, dayPart };

        let entries: Array<Prisma.EntryGetPayload<{ select: typeof entrySelect }>>;
        let total: number;
        let filteredTagSource: Array<{ tags: string[] }>;
        let lifeAreas: string[];

        if (hasTemporalFilters) {
            const [lightRows, rawLifeAreaRows] = await Promise.all([
                prisma.entry.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    select: { id: true, createdAt: true, tags: true },
                }),
                prisma.entry.findMany({
                    where: {
                        ...facetWhere,
                        lifeArea: { not: null },
                    },
                    select: { lifeArea: true, createdAt: true },
                }),
            ]);

            const filteredLight = filterEntriesByTemporalContext(lightRows, temporalContext);
            total = filteredLight.length;
            filteredTagSource = filteredLight;

            const pagedIds = filteredLight.slice(skip, skip + limit).map((r) => r.id);
            const pagedEntries = pagedIds.length > 0
                ? await prisma.entry.findMany({
                    where: { id: { in: pagedIds } },
                    select: entrySelect,
                })
                : [];
            const byId = new Map(pagedEntries.map((e) => [e.id, e]));
            entries = pagedIds
                .map((id) => byId.get(id))
                .filter((e): e is Prisma.EntryGetPayload<{ select: typeof entrySelect }> => Boolean(e));

            lifeAreas = [...new Set(
                filterEntriesByTemporalContext(rawLifeAreaRows, temporalContext)
                    .map((entry) => entry.lifeArea)
                    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            )].sort((a, b) => a.localeCompare(b));
        } else {
            const [rawEntries, rawTotal, rawLifeAreaRows] = await Promise.all([
                prisma.entry.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limit,
                    select: entrySelect,
                }),
                prisma.entry.count({ where }),
                prisma.entry.findMany({
                    where: {
                        ...facetWhere,
                        lifeArea: { not: null },
                    },
                    select: { lifeArea: true, createdAt: true },
                    distinct: ['lifeArea'],
                }),
            ]);

            entries = rawEntries;
            total = rawTotal;
            filteredTagSource = rawEntries;

            lifeAreas = [...new Set(
                rawLifeAreaRows
                    .map((entry) => entry.lifeArea)
                    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            )].sort((a, b) => a.localeCompare(b));
        }

        const tagCounts: Record<string, number> = {};
        for (const entry of filteredTagSource) {
            for (const tag of entry.tags) {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            }
        }

        // Aggregate per-lifeArea entry counts so the dashboard can render a
        // "By life area" card that doubles as a navigation axis. We run this
        // as a separate aggregation to avoid hauling the full row payload.
        const lifeAreaCountRows = await prisma.entry.groupBy({
            by: ['lifeArea'],
            where: {
                ...facetWhere,
                lifeArea: { not: null },
            },
            _count: { _all: true },
        });
        const lifeAreaCounts: Record<string, number> = {};
        for (const row of lifeAreaCountRows) {
            const key = (row.lifeArea || '').trim();
            if (!key) continue;
            lifeAreaCounts[key] = row._count._all;
        }

        return res.status(200).json({
            entries: entries.map((entry) => attachEntryStorySignal(entry)),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
            facets: {
                lifeAreas,
                lifeAreaCounts,
                tagCounts,
            },
            filters: {
                search,
                source,
                lifeArea,
                theme,
                tag,
                mood,
                date,
                startDate,
                endDate,
                weekday,
                dayPart,
            },
        });
    } catch (error) {
        console.error('Get entries error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// --- GET SINGLE ENTRY ---
export const getEntry = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        const entry = await prisma.entry.findFirst({
            where: { id, userId, deletedAt: null },
        });

        if (!entry) {
            return res.status(404).json({ message: 'Entry not found' });
        }

        return res.status(200).json({ entry: attachEntryStorySignal(entry) });
    } catch (error) {
        console.error('Get entry error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// --- UPDATE ENTRY ---
export const updateEntry = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const { title, content, contentHtml, mood, tags, coverImage, chapterId, entryMode, analysis, category, lifeArea, locationLat, locationLng, locationName } = req.body;

        // Check if entry exists and belongs to user
        const existing = await prisma.entry.findFirst({
            where: { id, userId, deletedAt: null },
        });

        if (!existing) {
            return res.status(404).json({ message: 'Entry not found' });
        }
        if (category !== undefined && !VALID_CATEGORIES.has(String(category))) {
            return res.status(400).json({ message: 'Invalid category. Use PERSONAL or PROFESSIONAL.' });
        }

        const tagMeta = tags !== undefined
            ? buildTagMetaList(
                (Array.isArray(tags) ? tags : [])
                    .filter((tag: string) => isValidTag(normalizeTag(String(tag))))
                    .map((tag: string) => ({
                        name: tag,
                        source: TagSource.USER,
                        confidence: 1,
                    }))
            )
            : null;
        const safeContentHtml = contentHtml !== undefined
            ? sanitizeHtml(contentHtml)
            : existing.contentHtml;
        const payloadAnalysis = isJsonObject(analysis) ? analysis : null;
        const hasPayloadAiInsights = hasPersistableAiInsights(payloadAnalysis);
        const payloadGrowthSignals = hasPayloadAiInsights
            ? deriveGrowthSignalsFromAnalysis(payloadAnalysis)
            : null;

        const nextTitle = title !== undefined ? title : existing.title;
        const nextContent = content !== undefined ? content : existing.content;
        const contentChanged = content !== undefined && content !== existing.content;

        const nextTitleCandidate = title !== undefined ? title : existing.title;
        const nextTagsCandidate = tags !== undefined ? (Array.isArray(tags) ? tags : []) : existing.tags;
        const shouldAllowShortContent = isQuickEntryLike({
            title: nextTitleCandidate,
            tags: nextTagsCandidate,
            entryMode,
        });

        if (contentChanged && nextContent.trim().length < MIN_CHARACTERS_FOR_ENTRY_SAVE && !shouldAllowShortContent) {
            return res.status(400).json({
                message: `Content must be at least ${MIN_CHARACTERS_FOR_ENTRY_SAVE} characters.`,
            });
        }

        let nlpFallback: AnalysisResult | null = null;
        if (!hasPayloadAiInsights && contentChanged) {
            const nlpTitle = typeof nextTitle === 'string' && nextTitle.trim() ? nextTitle : undefined;
            nlpFallback = await nlpService.analyzeContent(nextContent, {
                title: nlpTitle,
                userId,
                excludeEntryId: existing.id,
            });
        }
        const nlpGrowthSignals = deriveGrowthSignalsFromNlp(nlpFallback);
        const growthSignals = payloadGrowthSignals || (nlpFallback ? nlpGrowthSignals : null);
        const resolvedMood = mood !== undefined
            ? mood
            : (existing.mood || nlpFallback?.suggestedMood || null);
        const resolvedCategory = category !== undefined
            ? String(category)
            : existing.category;
        const resolvedLifeArea = lifeArea !== undefined
            ? normalizeLifeArea(lifeArea)
            : (existing.lifeArea || resolveSuggestedLifeArea(nlpFallback));
        const mergedPayloadAnalysis: Prisma.JsonObject | null = payloadAnalysis
            ? {
                ...(isJsonObject(existing.analysis) ? existing.analysis : {}),
                ...payloadAnalysis,
            }
            : (isJsonObject(existing.analysis) ? existing.analysis : null);

        const entry = await prisma.entry.update({
            where: { id },
            data: {
                title: nextTitle,
                content: nextContent,
                contentHtml: safeContentHtml,
                mood: resolvedMood,
                tags: tagMeta ? tagMeta.map(t => t.name) : existing.tags,
                coverImage: coverImage !== undefined ? coverImage : existing.coverImage,
                chapterId: chapterId !== undefined ? chapterId : existing.chapterId,
                category: resolvedCategory as 'PERSONAL' | 'PROFESSIONAL',
                lifeArea: resolvedLifeArea,
                analysis: analysis !== undefined
                    ? (
                        hasPayloadAiInsights && payloadAnalysis
                            ? (payloadAnalysis as Prisma.InputJsonValue)
                            : mergeNlpInsightsIntoAnalysis(mergedPayloadAnalysis, nlpFallback)
                    )
                    : mergeNlpInsightsIntoAnalysis(existing.analysis, nlpFallback),
                skills: growthSignals ? growthSignals.skills : existing.skills,
                lessons: growthSignals ? growthSignals.lessons : existing.lessons,
                reflection: growthSignals ? growthSignals.reflection : existing.reflection,
                locationLat: locationLat !== undefined ? (typeof locationLat === 'number' ? locationLat : null) : existing.locationLat,
                locationLng: locationLng !== undefined ? (typeof locationLng === 'number' ? locationLng : null) : existing.locationLng,
                locationName: locationName !== undefined ? (typeof locationName === 'string' ? locationName || null : null) : existing.locationName,
            },
        });

        // Clean up old cover image if replaced
        if (coverImage !== undefined && existing.coverImage && coverImage !== existing.coverImage) {
            void deleteFile(existing.coverImage);
        }

        // Parallel: three independent writes to separate tables — same pattern as createEntry.
        const updateTagsPromise = tagMeta
            ? syncEntryTags({ entryId: entry.id, userId, tags: tagMeta })
            : Promise.resolve();
        const updateAnalysisPromise = hasPayloadAiInsights && payloadAnalysis
            ? upsertEntryAnalysisFromPayload({
                entryId: entry.id,
                userId,
                payload: payloadAnalysis,
                content: nextContent,
            })
            : nlpFallback
                ? upsertEntryAnalysisFromNlp({
                    entryId: entry.id,
                    userId,
                    analysis: nlpFallback,
                    content: nextContent,
                })
                : Promise.resolve();

        const [, , opportunityAnalysis] = await Promise.all([
            updateTagsPromise,
            updateAnalysisPromise,
            upsertAutoOpportunityEvidence({
                id: entry.id,
                title: entry.title,
                content: entry.content,
                mood: entry.mood,
                tags: entry.tags,
                skills: entry.skills,
                lessons: entry.lessons,
                reflection: entry.reflection,
                createdAt: entry.createdAt,
                analysis: entry.analysis,
            }),
        ]);
        const { mergedAnalysis } = await studentActionService.persistEntrySignals({
            entryId: entry.id,
            userId,
            title: entry.title,
            content: entry.content,
            analysis: opportunityAnalysis ?? entry.analysis,
        });

        embeddingService.enqueueEntryEmbedding({
            entryId: entry.id,
            userId,
            content: nextContent,
            title: typeof nextTitle === 'string' ? nextTitle : null,
            mood: entry.mood,
            tags: entry.tags,
            skills: entry.skills,
            lessons: entry.lessons,
            reflection: entry.reflection,
            analysis: mergedAnalysis,
            category: entry.category,
            lifeArea: entry.lifeArea,
        });

        const responseEntry = { ...entry, analysis: mergedAnalysis };

        // Fire-and-forget: regenerate Notive Noticed insights after content update
        guidedReflectionService.generateNotiveInsights(entry.id, userId).catch(() => {});

        // Invalidate mood forecast cache if mood changed (or content may have shifted analysis)
        void moodForecastService.invalidate(userId);

        return res.status(200).json({
            entry: attachEntryStorySignal(responseEntry),
            suggestions: nlpFallback?.suggestions || null,
        });
    } catch (error) {
        console.error('Update entry error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// --- DELETE ENTRY (soft delete) ---
export const deleteEntry = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        // Check if entry exists and belongs to user
        const existing = await prisma.entry.findFirst({
            where: { id, userId, deletedAt: null },
        });

        if (!existing) {
            return res.status(404).json({ message: 'Entry not found' });
        }

        await prisma.entry.update({
            where: { id },
            data: { deletedAt: new Date() },
        });

        // Clean up uploaded cover image from storage
        if (existing.coverImage) {
            void deleteFile(existing.coverImage);
        }

        void moodForecastService.invalidate(userId);

        return res.status(200).json({ message: 'Entry deleted successfully' });
    } catch (error) {
        console.error('Delete entry error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
