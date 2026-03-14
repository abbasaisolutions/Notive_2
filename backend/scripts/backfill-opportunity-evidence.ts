import prisma from '../src/config/prisma';
import { Prisma } from '@prisma/client';
import { buildOpportunityOverview, OpportunityEntry } from '../src/services/opportunity.service';
import nlpService from '../src/services/nlp.service';

const BATCH_SIZE = Number.parseInt(process.env.BACKFILL_BATCH_SIZE || '200', 10);
const DRY_RUN = process.env.DRY_RUN === 'true';

const isJsonObject = (value: unknown): value is Prisma.JsonObject =>
    !!value && typeof value === 'object' && !Array.isArray(value);

const normalizedText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

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

const normalizedStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
};

const buildUpdatedAnalysis = (
    entry: {
        analysis: unknown;
        content: string;
    },
    experience: {
        situation: string;
        action: string;
        lesson: string;
        outcome: string;
        skills: string[];
        provider?: string;
        confidence?: number;
    },
) => {
    if (entry.analysis !== null && entry.analysis !== undefined && !isJsonObject(entry.analysis)) {
        return null;
    }

    const baseAnalysis: Prisma.JsonObject = isJsonObject(entry.analysis) ? entry.analysis : {};
    const existingOpportunity: Prisma.JsonObject = isJsonObject(baseAnalysis.opportunity) ? baseAnalysis.opportunity : {};

    const nextFields: Prisma.JsonObject = {};
    const existingSituation = normalizedText(existingOpportunity.situation);
    const existingAction = normalizedText(existingOpportunity.action);
    const existingLesson = normalizedText(existingOpportunity.lesson);
    const existingOutcome = normalizedText(existingOpportunity.outcome);
    const existingSkills = normalizedStringArray(existingOpportunity.skills);

    const candidateSituation = normalizedText(experience.situation);
    const candidateAction = normalizedText(experience.action);
    const candidateLesson = normalizedText(experience.lesson);
    const candidateOutcome = normalizedText(experience.outcome);
    const situationGood = !looksLowSignal(candidateSituation, entry.content, 'situation');
    const actionGood = !looksLowSignal(candidateAction, entry.content, 'action');
    const lessonGood = !looksLowSignal(candidateLesson, entry.content, 'lesson');
    const outcomeGood = !looksLowSignal(candidateOutcome, entry.content, 'outcome');

    if ((!existingSituation || looksLowSignal(existingSituation, entry.content, 'situation')) && candidateSituation && (situationGood || !existingSituation || looksLowSignal(existingSituation, entry.content, 'situation'))) {
        nextFields.situation = candidateSituation.slice(0, 800);
    }
    if ((!existingAction || looksLowSignal(existingAction, entry.content, 'action')) && candidateAction && (actionGood || !existingAction || looksLowSignal(existingAction, entry.content, 'action'))) {
        nextFields.action = candidateAction.slice(0, 800);
    }
    if ((!existingLesson || looksLowSignal(existingLesson, entry.content, 'lesson')) && candidateLesson && (lessonGood || !existingLesson || looksLowSignal(existingLesson, entry.content, 'lesson'))) {
        nextFields.lesson = candidateLesson.slice(0, 800);
    }
    if ((!existingOutcome || looksLowSignal(existingOutcome, entry.content, 'outcome')) && candidateOutcome && (outcomeGood || !existingOutcome || looksLowSignal(existingOutcome, entry.content, 'outcome'))) {
        nextFields.outcome = candidateOutcome.slice(0, 800);
    }
    if ((existingSkills.length === 0 || looksLowSignal(existingSkills.join(' '), entry.content, 'skills')) && experience.skills.length > 0) {
        nextFields.skills = experience.skills.slice(0, 10);
    }
    if (experience.provider) nextFields.provider = experience.provider;
    if (typeof experience.confidence === 'number') nextFields.confidence = Number(experience.confidence.toFixed(3));

    if (Object.keys(nextFields).length === 0) {
        return null;
    }

    const mergedOpportunity: Prisma.JsonObject = {
        ...existingOpportunity,
        ...nextFields,
        updatedAt: new Date().toISOString(),
    };

    const nextAnalysis: Prisma.InputJsonValue = {
        ...baseAnalysis,
        opportunity: mergedOpportunity,
    };

    return nextAnalysis;
};

async function run() {
    console.log(`[backfill-opportunity] starting (batch=${BATCH_SIZE}, dryRun=${DRY_RUN})`);

    let cursor: string | undefined;
    let scanned = 0;
    let updates = 0;

    while (true) {
        const entries = await prisma.entry.findMany({
            where: { deletedAt: null },
            orderBy: { id: 'asc' },
            take: BATCH_SIZE,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
            select: {
                id: true,
                userId: true,
                title: true,
                content: true,
                mood: true,
                tags: true,
                skills: true,
                lessons: true,
                reflection: true,
                createdAt: true,
                analysis: true,
                analysisRecord: {
                    select: {
                        summary: true,
                        topics: true,
                        keywords: true,
                        suggestedMood: true,
                    },
                },
            },
        });

        if (entries.length === 0) break;

        const mapped: OpportunityEntry[] = entries.map((entry) => ({
            id: entry.id,
            title: entry.title,
            content: entry.content,
            mood: entry.mood,
            tags: entry.tags || [],
            skills: entry.skills || [],
            lessons: entry.lessons || [],
            reflection: entry.reflection,
            createdAt: entry.createdAt,
            analysis: entry.analysis ?? null,
            analysisRecord: entry.analysisRecord || null,
        }));

        const overview = buildOpportunityOverview(mapped);
        const byEntryId = new Map(overview.experiences.map((experience) => [experience.entryId, experience]));

        for (const entry of entries) {
            const experience = byEntryId.get(entry.id);
            if (!experience) continue;

            const synthesized = await nlpService.synthesizeOpportunityEvidence(entry.content, {
                situation: experience.situation,
                action: experience.action,
                lesson: experience.lesson,
                outcome: experience.outcome,
                skills: experience.skills,
                topics: entry.analysisRecord?.topics || [],
                keywords: entry.analysisRecord?.keywords || [],
            });

            const nextAnalysis = buildUpdatedAnalysis(entry, {
                situation: synthesized?.situation || experience.situation,
                action: synthesized?.action || experience.action,
                lesson: synthesized?.lesson || experience.lesson,
                outcome: synthesized?.outcome || experience.outcome,
                skills: synthesized?.skills || experience.skills,
                provider: synthesized?.provider,
                confidence: synthesized?.confidence,
            });

            if (!nextAnalysis) continue;
            updates += 1;

            if (!DRY_RUN) {
                await prisma.entry.update({
                    where: { id: entry.id },
                    data: { analysis: nextAnalysis },
                });
            }
        }

        scanned += entries.length;
        cursor = entries[entries.length - 1]?.id;
        console.log(`[backfill-opportunity] scanned=${scanned} updated=${updates}`);
    }

    console.log(`[backfill-opportunity] complete scanned=${scanned} updated=${updates} dryRun=${DRY_RUN}`);
}

run()
    .catch((error) => {
        console.error('[backfill-opportunity] failed', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
