import { Request, Response } from 'express';
import prisma from '../config/prisma';
import nlpService from '../services/nlp.service';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { upsertEntryAnalysisFromNlp } from '../services/entry-analysis.service';
import embeddingService from '../services/embedding.service';
import { executeHybridSearch } from '../services/hybrid-search.service';
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
import supportMapService from '../services/support-map.service';
import studentActionService from '../services/student-action.service';

const LIVE_COACH_SUGGESTIONS = [
    'When was I last happy?',
    'What stressed me out recently?',
    'Summarize my week',
    'What are my recurring themes?',
];

const LOCAL_GUIDE_SUGGESTIONS = [
    'What feels like the biggest pattern in my notes lately?',
    'Help me talk to someone about this.',
    'Which past entry feels closest to how I am doing now?',
    'What should I write about tonight?',
];

const isGuidedReflectionLens = (value: unknown): value is GuidedReflectionLens =>
    value === 'clarity' || value === 'memory' || value === 'growth' || value === 'patterns' || value === 'bridge';

type CoachHighlight = {
    id: string;
    title: string | null;
    createdAt: string;
    mood: string | null;
    reason: string;
    excerpt: string;
};

type CoachContextBundle = {
    context: string;
    strategy: 'hybrid' | 'recent' | 'starter';
    highlights: CoachHighlight[];
};

const formatCoachDate = (value: Date): string =>
    value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const clipText = (value: string, maxLength: number): string => {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
};

const buildCoachContextBundle = async (userId: string, query: string): Promise<CoachContextBundle> => {
    const normalizedQuery = query.trim();
    const searchResult = normalizedQuery.length >= 2
        ? await executeHybridSearch({
            userId,
            query: normalizedQuery,
            limit: 6,
        }).catch((error) => {
            console.error('Coach retrieval search failed:', error);
            return null;
        })
        : null;

    const retrievedResults = (searchResult?.results || []).slice(0, 6);
    if (retrievedResults.length > 0) {
        const highlights = retrievedResults.map((result) => ({
            id: result.id,
            title: result.title,
            createdAt: formatCoachDate(result.createdAt),
            mood: result.mood,
            reason: result.matchReasons?.[0] || `${result.strategy} match`,
            excerpt: clipText(result.content || '', 220),
        }));

        const context = highlights.map((highlight, index) => {
            const titleLine = highlight.title ? `Title: ${highlight.title}\n` : '';
            const moodLine = highlight.mood ? `Mood: ${highlight.mood}\n` : '';
            return `[Snippet ${index + 1} | ${highlight.createdAt}]
${titleLine}${moodLine}Why relevant: ${highlight.reason}
Excerpt: ${highlight.excerpt}`;
        }).join('\n\n');

        return {
            context,
            strategy:
                searchResult?.searchMode === 'hybrid' || searchResult?.searchMode === 'semantic'
                    ? 'hybrid'
                    : 'recent',
            highlights,
        };
    }

    const recentEntries = await prisma.entry.findMany({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: {
            id: true,
            title: true,
            content: true,
            mood: true,
            createdAt: true,
        },
    });

    if (recentEntries.length === 0) {
        return {
            context: '',
            strategy: 'starter',
            highlights: [],
        };
    }

    const highlights = recentEntries.map((entry) => ({
        id: entry.id,
        title: entry.title,
        createdAt: formatCoachDate(entry.createdAt),
        mood: entry.mood,
        reason: 'Recent note',
        excerpt: clipText(entry.content, 220),
    }));

    const context = highlights.map((highlight, index) => {
        const titleLine = highlight.title ? `Title: ${highlight.title}\n` : '';
        const moodLine = highlight.mood ? `Mood: ${highlight.mood}\n` : '';
        return `[Snippet ${index + 1} | ${highlight.createdAt}]
${titleLine}${moodLine}Why relevant: ${highlight.reason}
Excerpt: ${highlight.excerpt}`;
    }).join('\n\n');

    return {
        context,
        strategy: 'recent',
        highlights,
    };
};

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

        const contextBundle = await buildCoachContextBundle(userId, query);
        const response = await nlpService.chat(query, contextBundle.context);

        return res.json({
            response,
            provider: availability.provider,
            vendor: availability.vendor,
            model: availability.model,
            mode: availability.provider === 'llm' ? 'llm' : 'hosted_fallback',
            strategy: contextBundle.strategy,
            highlights: contextBundle.highlights,
        });
    } catch (error) {
        console.error('Chat error:', error);
        return res.status(500).json({ message: 'Failed to chat with journal' });
    }
};

export const getTodayAction = async (req: Request, res: Response) => {
    try {
        const action = await studentActionService.getTodayAction(req.userId);
        return res.status(200).json(action);
    } catch (error) {
        console.error('Get today action error:', error);
        return res.status(500).json({ message: 'Failed to build today action' });
    }
};

export const previewActionBrief = async (req: Request, res: Response) => {
    try {
        const entryId = typeof req.body?.entryId === 'string' ? req.body.entryId : null;
        const content = typeof req.body?.content === 'string' ? req.body.content : null;
        const title = typeof req.body?.title === 'string' ? req.body.title : null;

        if (!entryId && !content) {
            return res.status(400).json({ message: 'Entry ID or content is required' });
        }

        const action = await studentActionService.preview({
            userId: req.userId,
            entryId,
            content,
            title,
        });

        return res.status(200).json(action);
    } catch (error) {
        console.error('Preview action brief error:', error);
        return res.status(500).json({ message: 'Failed to preview action brief' });
    }
};

export const getSupportMap = async (req: Request, res: Response) => {
    try {
        const rawPeriod = typeof req.query.period === 'string' ? req.query.period : undefined;
        const period = rawPeriod === 'week' || rawPeriod === 'month' || rawPeriod === 'year'
            ? rawPeriod
            : undefined;

        const supportMap = await supportMapService.getSupportMap(req.userId, { period });
        return res.status(200).json(supportMap);
    } catch (error) {
        console.error('Get support map error:', error);
        return res.status(500).json({ message: 'Failed to build support map' });
    }
};

export const recordContactOutcome = async (req: Request, res: Response) => {
    try {
        const contactName = typeof req.body?.contactName === 'string' ? req.body.contactName.trim() : '';
        const contactId = typeof req.body?.contactId === 'string' ? req.body.contactId.trim() : null;
        const outcome = req.body?.outcome === 'helped' || req.body?.outcome === 'still_need_support'
            ? req.body.outcome
            : null;
        const source = req.body?.source === 'bridge' || req.body?.source === 'safety'
            ? req.body.source
            : null;
        const surface = req.body?.surface === 'dashboard' || req.body?.surface === 'guide' || req.body?.surface === 'entry' || req.body?.surface === 'safety'
            ? req.body.surface
            : null;
        const actionKind = req.body?.actionKind === 'copy' || req.body?.actionKind === 'text' || req.body?.actionKind === 'call' || req.body?.actionKind === 'email' || req.body?.actionKind === 'manual'
            ? req.body.actionKind
            : undefined;
        const channel = req.body?.channel === 'text' || req.body?.channel === 'call' || req.body?.channel === 'in_person'
            ? req.body.channel
            : undefined;
        const riskLevel = req.body?.riskLevel === 'none' || req.body?.riskLevel === 'yellow' || req.body?.riskLevel === 'orange' || req.body?.riskLevel === 'red'
            ? req.body.riskLevel
            : undefined;
        const entryId = typeof req.body?.entryId === 'string' ? req.body.entryId.trim() : null;

        if ((!contactId && !contactName) || !outcome || !source || !surface) {
            return res.status(400).json({ message: 'Missing required contact outcome fields' });
        }

        const result = await supportMapService.recordContactOutcome({
            userId: req.userId,
            contactId,
            contactName,
            outcome,
            source,
            surface,
            actionKind,
            channel,
            riskLevel,
            entryId,
        });

        return res.status(200).json({
            message: 'Contact outcome recorded',
            outcome: result.outcome,
        });
    } catch (error) {
        console.error('Record contact outcome error:', error);
        return res.status(500).json({ message: 'Failed to record contact outcome' });
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
        let entryEmbeddingContext: {
            title?: string | null;
            mood?: string | null;
            tags?: string[];
            skills?: string[];
            lessons?: string[];
            reflection?: string | null;
            category?: string | null;
            lifeArea?: string | null;
        } | null = null;

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
            entryEmbeddingContext = {
                title: entry.title,
                mood: entry.mood,
                tags: entry.tags,
                skills: entry.skills,
                lessons: entry.lessons,
                reflection: entry.reflection,
                category: entry.category,
                lifeArea: entry.lifeArea,
            };

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

        const analysis = await nlpService.analyzeContent(contentToAnalyze, {
            title: entryEmbeddingContext?.title || undefined,
            userId,
            excludeEntryId: entryId || null,
        });

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
            memory: analysis.memory || null,
            suggestions: analysis.suggestions || null,
            modelInfo: analysis.modelInfo || null,
            provider: analysis.provider || null,
            analysisLine: analysis.analysisLine || null,
            takeawayLine: analysis.takeawayLine || null,
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
                title: entryEmbeddingContext?.title,
                mood: entryEmbeddingContext?.mood,
                tags: entryEmbeddingContext?.tags,
                skills: analysis.topics?.length ? analysis.topics : entryEmbeddingContext?.skills,
                lessons: entryEmbeddingContext?.lessons,
                reflection: entryEmbeddingContext?.reflection,
                analysis: {
                    ...(existingAnalysis || {}),
                    ai: aiInsights,
                },
                category: entryEmbeddingContext?.category,
                lifeArea: entryEmbeddingContext?.lifeArea,
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

