import crypto from 'crypto';
import prisma from '../config/prisma';
import { AnalysisSource, Prisma } from '@prisma/client';
import { AnalysisResult } from './nlp.service';

export type AnalysisPayload = {
    deterministic?: any;
    ai?: any;
};

const hashContent = (content: string) =>
    crypto.createHash('sha256').update(content || '').digest('hex');

const toJsonValue = (value: unknown): Prisma.InputJsonValue | undefined => {
    if (value === undefined) return undefined;
    return value as unknown as Prisma.InputJsonValue;
};

const EMOTION_CANONICAL_MAP: Record<string, string> = {
    joy: 'happy',
    happiness: 'happy',
    sadness: 'sad',
    anger: 'frustrated',
    anxiety: 'anxious',
    motivation: 'motivated',
    neutral: 'calm',
};

const normalizeEmotionKeys = (input: Record<string, number> | undefined) => {
    if (!input) return undefined;
    const normalized: Record<string, number> = {};

    Object.entries(input).forEach(([rawKey, score]) => {
        const key = (EMOTION_CANONICAL_MAP[rawKey.toLowerCase()] || rawKey.toLowerCase()).trim();
        if (!key) return;
        normalized[key] = Math.max(normalized[key] || 0, score);
    });

    return Object.keys(normalized).length > 0 ? normalized : undefined;
};

const shouldSkipWrite = async ({
    entryId,
    source,
    contentHash,
}: {
    entryId: string;
    source: AnalysisSource;
    contentHash: string | null;
}) => {
    const existing = await prisma.entryAnalysis.findUnique({
        where: { entryId },
        select: {
            id: true,
            source: true,
            contentHash: true,
        },
    });

    if (!existing) return false;
    if (!contentHash) return false;

    return existing.source === source && existing.contentHash === contentHash;
};

const buildEntitiesFromDeterministic = (deterministic: any) => {
    const entities: Array<{ text: string; type: string; confidence?: number; meta?: any }> = [];

    deterministic?.people?.forEach((p: any) => {
        if (p?.name) {
            entities.push({ text: p.name, type: 'person', confidence: 0.7, meta: { relationship: p.relationship } });
        }
    });

    deterministic?.places?.forEach((p: any) => {
        if (p?.name) {
            entities.push({ text: p.name, type: 'place', confidence: 0.7 });
        }
    });

    deterministic?.activities?.forEach((a: any) => {
        if (a?.name) {
            entities.push({ text: a.name, type: 'activity', confidence: 0.6 });
        }
    });

    return entities.length > 0 ? entities : undefined;
};

const buildEmotionsFromDeterministic = (deterministic: any) => {
    const emotions: Record<string, number> = {};
    if (deterministic?.primaryEmotion?.emotion) {
        emotions[deterministic.primaryEmotion.emotion] = deterministic.primaryEmotion.intensity ?? 1;
    }

    if (Array.isArray(deterministic?.secondaryEmotions)) {
        deterministic.secondaryEmotions.forEach((e: any) => {
            if (!e?.emotion) return;
            emotions[e.emotion] = e.intensity ?? 1;
        });
    }

    return Object.keys(emotions).length > 0 ? emotions : undefined;
};

export const mapPayloadToEntryAnalysis = (payload: AnalysisPayload | undefined, content: string) => {
    if (!payload) return null;
    const contentHash = hashContent(content);

    if (payload.ai) {
        const ai = payload.ai;
        return {
            source: AnalysisSource.AI,
            contentHash,
            summary: ai?.sentiment?.summary ?? ai?.summary ?? null,
            sentimentScore: ai?.sentiment?.score ?? null,
            sentimentLabel: ai?.sentiment?.label ?? null,
            emotions: toJsonValue(normalizeEmotionKeys(ai?.emotions)),
            entities: toJsonValue(ai?.entities),
            topics: ai?.topics ?? [],
            keywords: ai?.keywords ?? [],
            suggestedMood: ai?.suggestedMood ?? null,
            wordCount: ai?.wordCount ?? null,
            readingTime: ai?.readingTime ?? null,
        };
    }

    if (payload.deterministic) {
        const det = payload.deterministic;
        return {
            source: AnalysisSource.DETERMINISTIC,
            contentHash,
            summary: det?.summary ?? null,
            sentimentScore: det?.sentimentScore ?? null,
            sentimentLabel: det?.overallSentiment ?? null,
            emotions: toJsonValue(normalizeEmotionKeys(buildEmotionsFromDeterministic(det))),
            entities: toJsonValue(buildEntitiesFromDeterministic(det)),
            topics: det?.suggestedTags ?? [],
            keywords: det?.keyPhrases ?? [],
            suggestedMood: det?.primaryEmotion?.emotion ?? null,
            wordCount: det?.wordCount ?? null,
            readingTime: det?.readingTime ?? null,
        };
    }

    return null;
};

export const mapNlpResultToEntryAnalysis = (analysis: AnalysisResult, content: string) => {
    const contentHash = hashContent(content);
    const source = analysis.provider === 'llm' ? AnalysisSource.AI : AnalysisSource.NLP;

    return {
        source,
        contentHash,
        summary: analysis.sentiment?.summary ?? null,
        sentimentScore: analysis.sentiment?.score ?? null,
        sentimentLabel: analysis.sentiment?.label ?? null,
        emotions: toJsonValue(normalizeEmotionKeys(analysis.emotions)),
        entities: toJsonValue(analysis.entities),
        topics: analysis.topics ?? [],
        keywords: analysis.keywords ?? [],
        suggestedMood: analysis.suggestedMood ?? null,
        wordCount: analysis.wordCount ?? null,
        readingTime: analysis.readingTime ?? null,
    };
};

export const upsertEntryAnalysisFromPayload = async ({
    entryId,
    userId,
    payload,
    content,
}: {
    entryId: string;
    userId: string;
    payload?: AnalysisPayload;
    content: string;
}) => {
    const mapped = mapPayloadToEntryAnalysis(payload, content);
    if (!mapped) return null;

    if (await shouldSkipWrite({
        entryId,
        source: mapped.source,
        contentHash: mapped.contentHash || null,
    })) {
        return prisma.entryAnalysis.findUnique({ where: { entryId } });
    }

    return prisma.entryAnalysis.upsert({
        where: { entryId },
        create: {
            entryId,
            userId,
            ...mapped,
        },
        update: {
            ...mapped,
        },
    });
};

export const upsertEntryAnalysisFromNlp = async ({
    entryId,
    userId,
    analysis,
    content,
}: {
    entryId: string;
    userId: string;
    analysis: AnalysisResult;
    content: string;
}) => {
    const mapped = mapNlpResultToEntryAnalysis(analysis, content);

    if (await shouldSkipWrite({
        entryId,
        source: mapped.source,
        contentHash: mapped.contentHash || null,
    })) {
        return prisma.entryAnalysis.findUnique({ where: { entryId } });
    }

    return prisma.entryAnalysis.upsert({
        where: { entryId },
        create: {
            entryId,
            userId,
            ...mapped,
        },
        update: {
            ...mapped,
        },
    });
};
