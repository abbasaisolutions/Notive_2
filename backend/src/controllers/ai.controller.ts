import { Request, Response } from 'express';
import prisma from '../config/prisma';
import nlpService from '../services/nlp.service';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { upsertEntryAnalysisFromNlp } from '../services/entry-analysis.service';
import embeddingService from '../services/embedding.service';
import {
    buildOpportunityExport,
    buildOpportunityOverview,
    buildOpportunityTrends,
    OpportunityEntry,
    OpportunityProfileIdentity,
    OpportunityTemplateVariant,
} from '../services/opportunity.service';
import { buildProfileContextSummary } from '../services/profile-context.service';
import guidedReflectionService, { type GuidedReflectionLens } from '../services/guided-reflection.service';

const LIVE_COACH_SUGGESTIONS = [
    'When was I last happy?',
    'What stressed me out recently?',
    'Summarize my week',
    'What are my recurring themes?',
];

const LOCAL_GUIDE_SUGGESTIONS = [
    'What feels like the biggest pattern in my notes lately?',
    'What should I write about tonight?',
    'Which past entry feels closest to how I am doing now?',
    'Summarize the last week of notes.',
];

const isGuidedReflectionLens = (value: unknown): value is GuidedReflectionLens =>
    value === 'clarity' || value === 'memory' || value === 'growth' || value === 'patterns';

const mapAnalysisRecordToInsights = (record: any) => {
    if (!record) return null;
    return {
        contentHash: record.contentHash,
        generatedAt: record.updatedAt?.toISOString?.() || new Date().toISOString(),
        sentiment: {
            score: record.sentimentScore,
            label: record.sentimentLabel,
            confidence: 0.8,
            summary: record.summary,
        },
        entities: record.entities || [],
        topics: record.topics || [],
        suggestedMood: record.suggestedMood,
        wordCount: record.wordCount,
        readingTime: record.readingTime,
        keywords: record.keywords || [],
        emotions: record.emotions || null,
        highlights: record.summary ? [record.summary] : [],
    };
};

const fetchOpportunityEntries = async (userId: string): Promise<OpportunityEntry[]> => {
    const entries = await prisma.entry.findMany({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
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

    return entries.map((entry: (typeof entries)[number]) => ({
        ...entry,
        analysisRecord: entry.analysisRecord || null,
    }));
};

const normalizeOpportunityIdentityValue = (value: string | null | undefined): string | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
};

const fetchOpportunityProfileBundle = async (userId: string) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            name: true,
            email: true,
            profile: {
                select: {
                    bio: true,
                    location: true,
                    occupation: true,
                    website: true,
                    primaryGoal: true,
                    focusArea: true,
                    experienceLevel: true,
                    writingPreference: true,
                    starterPrompt: true,
                    importPreference: true,
                    lifeGoals: true,
                    outputGoals: true,
                    onboardingCompletedAt: true,
                    updatedAt: true,
                },
            },
        },
    });

    const profile = user?.profile || null;
    const profileIdentity: OpportunityProfileIdentity | null = user
        ? {
            name: normalizeOpportunityIdentityValue(user.name),
            email: normalizeOpportunityIdentityValue(user.email)?.toLowerCase() || null,
            occupation: normalizeOpportunityIdentityValue(profile?.occupation),
            location: normalizeOpportunityIdentityValue(profile?.location),
            website: normalizeOpportunityIdentityValue(profile?.website),
            bio: normalizeOpportunityIdentityValue(profile?.bio),
        }
        : null;

    return {
        profileContext: buildProfileContextSummary(profile),
        profileIdentity,
    };
};

export const getAiCoachStatus = async (req: Request, res: Response) => {
    try {
        const status = nlpService.getChatAvailability();
        if (status.available) {
            return res.status(200).json({
                ...status,
                suggestions: LIVE_COACH_SUGGESTIONS,
            });
        }

        const guidedStatus = await guidedReflectionService.getStatus(req.userId);
        return res.status(200).json(guidedStatus);
    } catch (error) {
        console.error('AI Coach status error:', error);
        return res.status(200).json({
            available: true,
            provider: 'guided_reflection',
            vendor: 'local',
            model: 'guided-reflection-v1',
            message: 'Guide is running in local reflection mode while status checks recover.',
            suggestions: LOCAL_GUIDE_SUGGESTIONS,
        });
    }
};

/**
 * Chat with your journal
 */
export const chatWithJournal = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { query, lens } = req.body;
        const availability = nlpService.getChatAvailability();

        if (!query) return res.status(400).json({ message: 'Query is required' });
        if (!availability.available) {
            const guidedResponse = await guidedReflectionService.respond({
                userId,
                query,
                lens: isGuidedReflectionLens(lens) ? lens : null,
            });
            return res.json(guidedResponse);
        }

        // Fetch recent 10 entries for context (simple RAG)
        const entries = await prisma.entry.findMany({
            where: { userId, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 10
        });

        const context = entries
            .map((entry: (typeof entries)[number]) => `[${entry.createdAt.toISOString().split('T')[0]}] ${entry.content}`)
            .join('\n\n');

        const response = await nlpService.chat(query, context);

        return res.json({
            response,
            provider: availability.provider,
            vendor: availability.vendor,
            model: availability.model,
            mode: availability.provider === 'llm' ? 'llm' : 'hosted_fallback',
        });
    } catch (error) {
        console.error('Chat error:', error);
        return res.status(500).json({ message: 'Failed to chat with journal' });
    }
};

/**
 * Analyze an entry to extract insights
 */
export const analyzeEntry = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { entryId } = req.params;
        const { content } = req.body; // Can analyze unsaved content too

        if (!content && !entryId) {
            return res.status(400).json({ message: 'Content or Entry ID required' });
        }

        let contentToAnalyze = content;
        let existingAnalysis: any = null;
        let contentHash = '';

        // If entryId is provided, fetch from DB
        if (entryId) {
            const entry = await prisma.entry.findFirst({
                where: { id: entryId, userId, deletedAt: null },
                include: {
                    analysisRecord: true,
                },
            });
            if (!entry) return res.status(404).json({ message: 'Entry not found' });
            contentToAnalyze = entry.content;
            contentHash = crypto.createHash('sha256').update(contentToAnalyze).digest('hex');
            existingAnalysis = entry.analysis || null;

            const contentHashFromRecord = entry.analysisRecord?.contentHash;
            if (contentHashFromRecord === contentHash) {
                if (existingAnalysis?.ai?.contentHash === contentHash) {
                    return res.json({
                        message: 'Analysis cached',
                        cached: true,
                        insights: existingAnalysis.ai,
                    });
                }

                const recordInsights = mapAnalysisRecordToInsights(entry.analysisRecord);
                if (recordInsights) {
                    return res.json({
                        message: 'Analysis cached',
                        cached: true,
                        insights: recordInsights,
                    });
                }
            }
        }

        if (!contentHash) {
            contentHash = crypto.createHash('sha256').update(contentToAnalyze).digest('hex');
        }

        const analysis = await nlpService.analyzeContent(contentToAnalyze);

        const aiInsights = {
            contentHash,
            generatedAt: new Date().toISOString(),
            sentiment: analysis.sentiment,
            entities: analysis.entities,
            topics: analysis.topics,
            suggestedMood: analysis.suggestedMood,
            wordCount: analysis.wordCount,
            readingTime: analysis.readingTime,
            keywords: analysis.keywords || [],
            emotions: analysis.emotions || null,
            highlights: analysis.highlights || [],
            evidence: analysis.evidence || null,
            modelInfo: analysis.modelInfo || null,
            provider: analysis.provider || null,
        };

        if (entryId) {
            await prisma.entry.update({
                where: { id: entryId },
                data: {
                    analysis: {
                        ...(existingAnalysis || {}),
                        ai: aiInsights,
                    },
                    skills: analysis.topics || [],
                },
            });

            await upsertEntryAnalysisFromNlp({
                entryId,
                userId,
                analysis,
                content: contentToAnalyze,
            });

            embeddingService.enqueueEntryEmbedding({
                entryId,
                userId,
                content: contentToAnalyze,
            });
        }

        return res.json({
            message: 'Analysis complete',
            cached: false,
            insights: aiInsights,
        });

    } catch (error) {
        console.error('AI Analysis error:', error);
        return res.status(500).json({ message: 'Failed to analyze entry' });
    }
};

/**
 * Generate a personal statement based on accumulated skills
 */
export const generatePersonalStatement = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const rawVariant = typeof req.query.variant === 'string' ? req.query.variant : 'standard';
        const allowedVariants = new Set(['standard', 'college', 'entry_job']);
        const variant = allowedVariants.has(rawVariant) ? (rawVariant as OpportunityTemplateVariant) : 'standard';
        const [entries, profileBundle] = await Promise.all([
            fetchOpportunityEntries(userId),
            fetchOpportunityProfileBundle(userId),
        ]);
        const overview = buildOpportunityOverview(entries, profileBundle.profileContext, profileBundle.profileIdentity);

        return res.json({
            variant,
            topSkills: overview.topSkills.slice(0, 5),
            statement: overview.statementVariants[variant] || overview.personalStatement,
        });
    } catch (error) {
        console.error('Personal Statement generation error:', error);
        return res.status(500).json({ message: 'Failed to generate statement' });
    }
};

export const getOpportunityOverview = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const [entries, profileBundle] = await Promise.all([
            fetchOpportunityEntries(userId),
            fetchOpportunityProfileBundle(userId),
        ]);
        const overview = buildOpportunityOverview(entries, profileBundle.profileContext, profileBundle.profileIdentity);
        return res.json({ overview });
    } catch (error) {
        console.error('Opportunity overview error:', error);
        return res.status(500).json({ message: 'Failed to build opportunity overview' });
    }
};

export const updateOpportunityEvidence = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { entryId } = req.params;
        const {
            verified,
            notes,
            title,
            situation,
            action,
            lesson,
            outcome,
            skills,
        } = req.body as {
            verified?: boolean;
            notes?: string;
            title?: string;
            situation?: string;
            action?: string;
            lesson?: string;
            outcome?: string;
            skills?: string[];
        };

        if (verified !== undefined && typeof verified !== 'boolean') {
            return res.status(400).json({ message: 'verified must be a boolean' });
        }
        if (notes !== undefined && typeof notes !== 'string') {
            return res.status(400).json({ message: 'notes must be a string' });
        }

        const textFields: Record<string, string | undefined> = {
            title,
            situation,
            action,
            lesson,
            outcome,
        };

        for (const [fieldName, value] of Object.entries(textFields)) {
            if (value !== undefined && typeof value !== 'string') {
                return res.status(400).json({ message: `${fieldName} must be a string` });
            }
        }
        if (skills !== undefined && !Array.isArray(skills)) {
            return res.status(400).json({ message: 'skills must be an array of strings' });
        }
        if (skills !== undefined && !skills.every((value) => typeof value === 'string')) {
            return res.status(400).json({ message: 'skills must contain only strings' });
        }

        const entry = await prisma.entry.findFirst({
            where: { id: entryId, userId, deletedAt: null },
            select: { id: true, analysis: true },
        });

        if (!entry) {
            return res.status(404).json({ message: 'Entry not found' });
        }

        const baseAnalysis =
            entry.analysis && typeof entry.analysis === 'object' && !Array.isArray(entry.analysis)
                ? (entry.analysis as Prisma.JsonObject)
                : {};

        const existingOpportunity =
            baseAnalysis.opportunity && typeof baseAnalysis.opportunity === 'object' && !Array.isArray(baseAnalysis.opportunity)
                ? (baseAnalysis.opportunity as Prisma.JsonObject)
                : {};

        const updatedOpportunity: Prisma.JsonObject = {
            ...existingOpportunity,
            ...(verified !== undefined ? { verified } : {}),
            ...(notes !== undefined ? { notes: notes.trim().slice(0, 600) } : {}),
            ...(title !== undefined ? { title: title.trim().slice(0, 180) } : {}),
            ...(situation !== undefined ? { situation: situation.trim().slice(0, 800) } : {}),
            ...(action !== undefined ? { action: action.trim().slice(0, 800) } : {}),
            ...(lesson !== undefined ? { lesson: lesson.trim().slice(0, 800) } : {}),
            ...(outcome !== undefined ? { outcome: outcome.trim().slice(0, 800) } : {}),
            ...(skills !== undefined
                ? {
                    skills: skills
                        .map((value) => value.trim())
                        .filter(Boolean)
                        .slice(0, 10),
                }
                : {}),
            updatedAt: new Date().toISOString(),
        };

        const updatedAnalysis: Prisma.InputJsonValue = {
            ...baseAnalysis,
            opportunity: updatedOpportunity,
        };

        await prisma.entry.update({
            where: { id: entryId },
            data: { analysis: updatedAnalysis },
        });

        return res.json({
            message: 'Opportunity evidence updated',
            entryId,
            opportunity: updatedOpportunity,
        });
    } catch (error) {
        console.error('Update opportunity evidence error:', error);
        return res.status(500).json({ message: 'Failed to update opportunity evidence' });
    }
};

export const getOpportunityTrends = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const rawPeriod = typeof req.query.period === 'string' ? req.query.period : 'month';
        const rawWindow = Number.parseInt(String(req.query.window || '6'), 10);

        const period: 'week' | 'month' = rawPeriod === 'week' ? 'week' : 'month';
        const window = Number.isFinite(rawWindow) ? rawWindow : 6;

        const entries = await fetchOpportunityEntries(userId);
        const trends = buildOpportunityTrends(entries, period, window);
        return res.json({ trends });
    } catch (error) {
        console.error('Opportunity trends error:', error);
        return res.status(500).json({ message: 'Failed to build opportunity trends' });
    }
};

export const exportOpportunityPack = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const rawType = typeof req.query.type === 'string' ? req.query.type : 'growth';
        const rawFormat = typeof req.query.format === 'string' ? req.query.format : 'markdown';
        const rawVariant = typeof req.query.variant === 'string' ? req.query.variant : 'standard';

        const allowedTypes = new Set(['resume', 'statement', 'interview', 'growth']);
        const allowedFormats = new Set(['markdown', 'json', 'html']);
        const allowedVariants = new Set(['standard', 'college', 'entry_job']);

        const type = allowedTypes.has(rawType) ? (rawType as 'resume' | 'statement' | 'interview' | 'growth') : 'growth';
        const format = allowedFormats.has(rawFormat) ? (rawFormat as 'markdown' | 'json' | 'html') : 'markdown';
        const variant = allowedVariants.has(rawVariant) ? (rawVariant as OpportunityTemplateVariant) : 'standard';

        const [entries, profileBundle] = await Promise.all([
            fetchOpportunityEntries(userId),
            fetchOpportunityProfileBundle(userId),
        ]);
        const overview = buildOpportunityOverview(entries, profileBundle.profileContext, profileBundle.profileIdentity);
        const output = buildOpportunityExport(overview, type, format, variant);

        res.setHeader('Content-Type', output.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${output.fileName}"`);
        return res.status(200).send(output.body);
    } catch (error) {
        console.error('Export opportunity pack error:', error);
        return res.status(500).json({ message: 'Failed to export opportunity pack' });
    }
};

