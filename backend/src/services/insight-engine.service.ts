/**
 * Insight Engine Service
 *
 * LLM-powered insight generation for the dashboard hero card.
 * Uses tiered OpenAI models for cost optimization:
 * - insightScoringModel: quality scoring, yes/no classification
 * - insightGenerationModel: insight generation, narratives
 * - insightDeepModel: weekly deep dives, complex synthesis
 *
 * 5 insight categories:
 * 1. Contradictions — "You said calm, but wrote anxiety"
 * 2. Hidden Patterns — "You write about mom every time you're anxious"
 * 3. Growth Signals — "You handled this differently than last time"
 * 4. Blind Spots — "You never write about..."
 * 5. Emotional Evolution — "Your relationship with anxiety is changing"
 */

import prisma from '../config/prisma';
import { aiRuntime, createLlmChatCompletion, hasLlmProvider } from '../config/ai';
import {
    buildDashboardInsights,
    type InsightEntry,
    type InsightAnalysis,
    type DashboardInsightsData,
} from './dashboard-insights.service';
import { buildDeviceContextForInsights } from './device-signal.service';
import {
    buildJournalIntelligence,
    type IntelEntry,
    type IntelAnalysis,
    type JournalIntelligence,
} from './journal-intelligence.service';

// ── Types ────────────────────────────────────────────────────

export type InsightCategory =
    | 'contradiction'
    | 'hidden_pattern'
    | 'growth_signal'
    | 'blind_spot'
    | 'evolution';

export type GeneratedInsight = {
    id?: string; // database ID (present when loaded from cache)
    category: InsightCategory;
    title: string;
    body: string;
    evidence: string | null;
    entryIds: string[];
    qualityScore: number;
};

type InsightContext = {
    userId: string;
    entries: InsightEntry[];
    analyses: InsightAnalysis[];
    insightsData: DashboardInsightsData;
    deviceContext: string | null;
    journalIntelligence: JournalIntelligence | null;
};

// ── Constants ────────────────────────────────────────────────

const INSIGHT_EXPIRY_HOURS = 24;
const MIN_QUALITY_SCORE = 5;
const MAX_GENERATION_ATTEMPTS = 3;
const MIN_ENTRIES_FOR_INSIGHTS = 5;

// ── Prompt Templates ─────────────────────────────────────────

function buildContradictionPrompt(ctx: InsightContext): string | null {
    const { insightsData, entries } = ctx;
    if (insightsData.contradictions.length === 0) return null;

    const top = insightsData.contradictions.slice(0, 3);
    const contradictionData = top.map((c) => {
        const entry = entries.find((e) => e.id === c.entryId);
        const snippet = entry ? entry.content.slice(0, 200) : '';
        return `- Entry "${c.entryTitle || 'Untitled'}" (${c.entryDate.slice(0, 10)}): Said "${c.statedMood}" but writing tone was "${c.detectedSentiment}". Snippet: "${snippet}..."`;
    }).join('\n');

    return `You are a thoughtful, non-judgmental journal companion for a student. Analyze this contradiction between what the student said they felt and what their writing actually conveyed.

DATA:
${contradictionData}

Write a single insight that:
1. Opens with a specific, intriguing observation (not generic)
2. References their actual words or entry
3. Frames the gap as curiosity, not criticism — "interesting" not "wrong"
4. Ends with an open question inviting reflection
5. Uses second person ("you")
6. Is 2-3 sentences max

Respond in this exact JSON format:
{"title": "short hook (8 words max)", "body": "the insight text", "evidence": "brief quote or detail from their entry"}`;
}

function buildHiddenPatternPrompt(ctx: InsightContext): string | null {
    const { insightsData } = ctx;
    const correlations = insightsData.correlations;
    if (correlations.length === 0) return null;

    // Pick the most surprising (highest delta) correlation
    const sorted = [...correlations].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const top = sorted.slice(0, 3);

    const patternData = top.map((c) =>
        `- Topic "${c.topic}": When present, avg mood = ${c.avgMoodWhenPresent}/10. When absent = ${c.avgMoodWhenAbsent}/10. Delta: ${c.delta > 0 ? '+' : ''}${c.delta}. Seen in ${c.occurrences} entries. Direction: ${c.direction}`
    ).join('\n');

    const triggerData = insightsData.triggerMap.length > 0
        ? '\nTrigger entities:\n' + insightsData.triggerMap.slice(0, 5).map((t) =>
            `- "${t.entity}" → ${t.direction} (avg delta: ${t.avgMoodDelta > 0 ? '+' : ''}${t.avgMoodDelta}, ${t.occurrences} times)`
        ).join('\n')
        : '';

    // Add life balance and people data from journal intelligence
    let extraContext = '';
    const ji = ctx.journalIntelligence;
    if (ji) {
        if (ji.lifeBalance.neglectedArea) {
            extraContext += `\nLife balance: Dominant area is "${ji.lifeBalance.dominantArea}", neglected area is "${ji.lifeBalance.neglectedArea}" (balance score: ${ji.lifeBalance.balanceScore}/100)`;
        }
        if (ji.peopleMap.people.length > 0) {
            const topPeople = ji.peopleMap.people.slice(0, 3).map((p) =>
                `${p.name} (${p.count} mentions, ${p.sentiment}, mood when mentioned: ${p.avgMoodWhenMentioned}/10)`
            ).join('; ');
            extraContext += `\nPeople in journal: ${topPeople}`;
        }
        if (ji.gratitude.totalExpressions > 0) {
            extraContext += `\nGratitude: ${ji.gratitude.totalExpressions} expressions (${ji.gratitude.recentTrend}), depth ${ji.gratitude.depthScore}/100`;
        }
    }

    if (ctx.deviceContext) {
        extraContext += `\n\nDevice/environment context:\n${ctx.deviceContext}`;
    }

    return `You are a thoughtful journal companion for a student. You've found a hidden pattern in their writing that they probably haven't noticed.

MOOD-TOPIC CORRELATIONS:
${patternData}
${triggerData}
${extraContext}

Write a single insight that:
1. Highlights the MOST surprising or non-obvious correlation
2. Avoid obvious ones like "stressed about exams" — find something unexpected
3. Uses specific topic/entity names from the data
4. Frames it as discovery: "Something interesting is forming..."
5. Ends with a curious question
6. Is 2-3 sentences max

Respond in this exact JSON format:
{"title": "short hook (8 words max)", "body": "the insight text", "evidence": "the specific correlation data that backs this up"}`;
}

function buildGrowthSignalPrompt(ctx: InsightContext): string | null {
    const { insightsData, entries } = ctx;
    const resilience = insightsData.resilience;
    const depth = insightsData.reflectionDepth;
    const vocab = insightsData.vocabularyExpansion;

    // Need at least some growth data
    if (!resilience && !depth && !vocab) return null;

    const signals: string[] = [];

    if (resilience && resilience.dipCount > 0) {
        signals.push(`Resilience: ${resilience.narrative} (${resilience.dipCount} dip${resilience.dipCount === 1 ? '' : 's'} detected, trend: ${resilience.trend})`);
    }

    if (depth) {
        signals.push(`Reflection depth: Level ${depth.level}/4 (${depth.levelLabel}), score ${depth.score}/100. Progress to next: ${Math.round(depth.progressToNext * 100)}%. Signals: lessons=${depth.signals.hasLessons}, skills=${depth.signals.hasSkills}, reflection=${depth.signals.hasReflection}, avg ${depth.signals.avgLength} words, trend=${depth.signals.growthTrend}`);
    }

    if (vocab && vocab.newWords.length > 0) {
        signals.push(`Vocabulary: ${vocab.newWords.length} new emotion words recently (${vocab.newWords.slice(0, 5).join(', ')}). Growth rate: ${vocab.growthRate}%. Total unique: ${vocab.totalUniqueWords}`);
    }

    // Add recent vs older entry comparison
    const recent = entries.slice(0, 5);
    const older = entries.slice(-5);
    if (recent.length > 0 && older.length > 0) {
        const recentAvgLen = recent.reduce((s, e) => s + e.content.length, 0) / recent.length;
        const olderAvgLen = older.reduce((s, e) => s + e.content.length, 0) / older.length;
        const recentLessons = recent.filter((e) => e.lessons.length > 0).length;
        const olderLessons = older.filter((e) => e.lessons.length > 0).length;
        signals.push(`Writing evolution: Recent entries avg ${Math.round(recentAvgLen)} chars vs earlier ${Math.round(olderAvgLen)} chars. Recent entries with lessons: ${recentLessons}/${recent.length} vs earlier: ${olderLessons}/${older.length}`);
    }

    // Journal Intelligence: vocabulary, self-talk, growth language
    const ji = ctx.journalIntelligence;
    if (ji) {
        if (ji.vocabulary.growthRate > 0) {
            signals.push(`Vocabulary growth: +${ji.vocabulary.growthRate}% recently, ${ji.vocabulary.totalUniqueWords} unique words, richness ratio ${ji.vocabulary.richness.toFixed(2)}`);
        }
        if (ji.vocabulary.recentNewWords.length > 0) {
            signals.push(`New words recently: ${ji.vocabulary.recentNewWords.slice(0, 6).join(', ')}`);
        }
        if (ji.selfTalk.growthStatements > 0) {
            signals.push(`Self-talk: ${ji.selfTalk.label} — ${ji.selfTalk.growthStatements} growth phrases vs ${ji.selfTalk.fixedStatements} fixed (ratio: ${ji.selfTalk.ratio})`);
        }
        if (ji.growthLanguage.recentTrend !== 'stable') {
            signals.push(`Growth language trend: ${ji.growthLanguage.recentTrend}`);
        }
    }

    // Device context (if available)
    if (ctx.deviceContext) {
        signals.push(`\nDevice/environment context:\n${ctx.deviceContext}`);
    }

    return `You are a thoughtful journal companion for a student. You've detected growth in their journaling practice.

GROWTH SIGNALS:
${signals.join('\n')}

Write a single insight that:
1. Points to ONE specific, concrete change you can see in the data
2. Makes invisible emotional/reflective work visible
3. Uses encouraging but not patronizing language — respect their intelligence
4. Frames it as "you handled this differently" not "good job"
5. Is 2-3 sentences max

Respond in this exact JSON format:
{"title": "short hook (8 words max)", "body": "the insight text", "evidence": "the specific data point that shows growth"}`;
}

function buildBlindSpotPrompt(ctx: InsightContext): string | null {
    const { entries, analyses } = ctx;
    if (entries.length < 10) return null;

    // Analyze topic/entity coverage to find gaps
    const topicCounts = new Map<string, number>();
    const entityCounts = new Map<string, number>();
    const lifeAreas = new Set<string>();
    const analysisMap = new Map<string, InsightAnalysis>();
    for (const a of analyses) analysisMap.set(a.entryId, a);

    for (const entry of entries) {
        const analysis = analysisMap.get(entry.id);
        for (const tag of entry.tags) {
            topicCounts.set(tag.toLowerCase(), (topicCounts.get(tag.toLowerCase()) ?? 0) + 1);
        }
        if (analysis) {
            for (const topic of analysis.topics) {
                topicCounts.set(topic.toLowerCase(), (topicCounts.get(topic.toLowerCase()) ?? 0) + 1);
            }
            if (Array.isArray(analysis.entities)) {
                for (const e of analysis.entities) {
                    const name = typeof e === 'string' ? e.toLowerCase() : String(e).toLowerCase();
                    entityCounts.set(name, (entityCounts.get(name) ?? 0) + 1);
                }
            }
        }
    }

    // Find dominant topics (>20% of entries)
    const dominantTopics = [...topicCounts.entries()]
        .filter(([, count]) => count >= entries.length * 0.2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([topic, count]) => `"${topic}" (${count}/${entries.length} entries)`);

    // Find high-frequency entities
    const frequentEntities = [...entityCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([entity, count]) => `"${entity}" (${count} mentions)`);

    // Check for topic imbalances
    const hasMoodEntries = entries.filter((e) => e.mood).length;
    const hasReflection = entries.filter((e) => e.reflection && e.reflection.trim().length > 20).length;
    const hasLessons = entries.filter((e) => e.lessons.length > 0).length;

    // Add journal intelligence for deeper blind spot detection
    let extraProfile = '';
    const ji = ctx.journalIntelligence;
    if (ji) {
        const coveredAreas = ji.lifeBalance.areas.filter((a) => a.entryCount > 0).map((a) => a.area);
        const allAreas = ['school', 'friends', 'family', 'self', 'hobbies', 'career', 'romance', 'health'];
        const missingAreas = allAreas.filter((a) => !coveredAreas.includes(a));
        if (missingAreas.length > 0) {
            extraProfile += `\nLife areas NEVER mentioned: ${missingAreas.join(', ')}`;
        }
        extraProfile += `\nEmotional complexity: ${ji.emotionalRange.uniqueEmotions} unique emotions, complexity score ${ji.emotionalRange.complexityScore}/100`;
        extraProfile += `\nWriting voice: ${ji.writingVoice.readingLevel} level, ${ji.writingVoice.questionFrequency} questions/entry`;
        if (ji.writingVoice.tenseDistribution.future < 10) {
            extraProfile += `\nNotably: Almost no future-tense writing (${ji.writingVoice.tenseDistribution.future}%)`;
        }
        if (ji.gratitude.totalExpressions === 0) {
            extraProfile += `\nNotably: Zero gratitude expressions detected`;
        }
    }

    return `You are a thoughtful journal companion for a student. You're looking at their journal holistically to notice what's MISSING — topics, perspectives, or areas of life they consistently avoid writing about.

JOURNAL PROFILE (${entries.length} total entries):
Dominant topics: ${dominantTopics.join(', ') || 'none detected'}
Frequent entities/people: ${frequentEntities.join(', ') || 'none detected'}
Entries with mood selected: ${hasMoodEntries}/${entries.length}
Entries with reflection: ${hasReflection}/${entries.length}
Entries with lessons extracted: ${hasLessons}/${entries.length}
${extraProfile}

Write a single insight about a BLIND SPOT — something notably absent or underexplored. Rules:
1. Be SPECIFIC — "in 47 entries, you mentioned friends 23 times but never described a conflict" is good. "You should write more about feelings" is terrible.
2. Frame the gap as curiosity, not criticism
3. Use actual numbers from the data
4. End with an inviting question
5. Is 2-3 sentences max

Respond in this exact JSON format:
{"title": "short hook (8 words max)", "body": "the insight text", "evidence": "the specific gap or absence you noticed"}`;
}

function buildEvolutionPrompt(ctx: InsightContext): string | null {
    const { insightsData, entries } = ctx;
    const fingerprint = insightsData.emotionalFingerprint;
    if (!fingerprint || entries.length < 15) return null;

    // Compare emotional profile of first half vs second half
    const midpoint = Math.floor(entries.length / 2);
    const olderEntries = entries.slice(midpoint);
    const recentEntries = entries.slice(0, midpoint);

    const emotionProfile = (items: InsightEntry[]): string => {
        const moods = new Map<string, number>();
        for (const e of items) {
            if (e.mood) {
                const m = e.mood.toLowerCase();
                moods.set(m, (moods.get(m) ?? 0) + 1);
            }
        }
        return [...moods.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([mood, count]) => `${mood} (${count})`)
            .join(', ');
    };

    const currentProfile = `Current emotional fingerprint: ${fingerprint.summary}`;
    const topEmotions = fingerprint.axes.slice(0, 5).map((a) => `${a.emotion}: ${(a.score * 100).toFixed(0)}%`).join(', ');

    return `You are a thoughtful journal companion for a student. You're tracking how their emotional landscape has evolved over time.

EMOTIONAL DATA:
${currentProfile}
Top emotions (normalized): ${topEmotions}
Earlier entries mood profile: ${emotionProfile(olderEntries) || 'insufficient data'}
Recent entries mood profile: ${emotionProfile(recentEntries) || 'insufficient data'}
Total entries analyzed: ${entries.length}

Write a single insight about how their emotional relationship or expression has EVOLVED. Rules:
1. Name the specific emotion and how the relationship changed
2. "Your relationship with anxiety is changing" is a good template
3. Reference the shift with data — "earlier you... now you..."
4. Frame evolution as natural, not prescriptive
5. Is 2-3 sentences max

Respond in this exact JSON format:
{"title": "short hook (8 words max)", "body": "the insight text", "evidence": "the specific emotional shift you detected"}`;
}

// ── Quality Scoring ──────────────────────────────────────────

async function scoreInsight(insight: GeneratedInsight): Promise<number> {
    if (!hasLlmProvider()) {
        // Heuristic scoring if no LLM
        let score = 5;
        if (insight.body.length > 50) score += 1;
        if (insight.evidence) score += 1;
        if (insight.body.includes('?')) score += 1; // has question
        if (insight.entryIds.length > 0) score += 1;
        return Math.min(score, 10);
    }

    const result = await createLlmChatCompletion({
        model: aiRuntime.insightScoringModel,
        response_format: { type: 'json_object' },
        messages: [
            {
                role: 'system',
                content: `You are a quality scorer for personal journal insights shown to students aged 15-22. Score this insight on 4 axes (each 0-10):

1. Specificity — Does it reference specific details, words, or entries? (Reject < 5)
2. Novelty — Would the student already know this? (Reject < 4)
3. Actionability — Does it invite exploration or reflection? (Reject < 3)
4. Safety — Could it feel judgmental or triggering? (Flag > 6)

Respond with ONLY a JSON object: {"specificity": N, "novelty": N, "actionability": N, "safety": N, "overall": N, "pass": true/false}
"pass" = true if specificity >= 5, novelty >= 4, actionability >= 3, AND safety <= 6.
"overall" = weighted average: specificity*0.3 + novelty*0.3 + actionability*0.2 + (10-safety)*0.2`,
            },
            {
                role: 'user',
                content: `Category: ${insight.category}\nTitle: ${insight.title}\nBody: ${insight.body}\nEvidence: ${insight.evidence || 'none'}`,
            },
        ],
        temperature: 0.1,
        max_tokens: 200,
    });

    if (!result?.choices?.[0]?.message?.content) return 5;

    try {
        const text = result.choices[0].message.content.trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return 5;
        const scores = JSON.parse(jsonMatch[0]);
        if (!scores.pass) return Math.min(scores.overall ?? 3, 4); // cap failing insights
        return Math.min(Math.round(scores.overall ?? 5), 10);
    } catch {
        return 5;
    }
}

// ── Core Generation ──────────────────────────────────────────

const CATEGORY_BUILDERS: Record<InsightCategory, (ctx: InsightContext) => string | null> = {
    contradiction: buildContradictionPrompt,
    hidden_pattern: buildHiddenPatternPrompt,
    growth_signal: buildGrowthSignalPrompt,
    blind_spot: buildBlindSpotPrompt,
    evolution: buildEvolutionPrompt,
};

async function generateInsightForCategory(
    category: InsightCategory,
    ctx: InsightContext
): Promise<GeneratedInsight | null> {
    if (!hasLlmProvider()) return null;

    const prompt = CATEGORY_BUILDERS[category](ctx);
    if (!prompt) return null;

    const result = await createLlmChatCompletion({
        model: aiRuntime.insightGenerationModel,
        response_format: { type: 'json_object' },
        messages: [
            { role: 'system', content: 'You are a thoughtful, perceptive journal companion. Always respond with valid JSON only.' },
            { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 400,
    });

    if (!result?.choices?.[0]?.message?.content) return null;

    try {
        const text = result.choices[0].message.content.trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;
        const parsed = JSON.parse(jsonMatch[0]);

        if (!parsed.title || !parsed.body) return null;

        // Gather referenced entry IDs from contradictions/correlations
        const entryIds: string[] = [];
        if (category === 'contradiction') {
            for (const c of ctx.insightsData.contradictions.slice(0, 3)) {
                entryIds.push(c.entryId);
            }
        }

        return {
            category,
            title: String(parsed.title).slice(0, 120),
            body: String(parsed.body).slice(0, 500),
            evidence: parsed.evidence ? String(parsed.evidence).slice(0, 300) : null,
            entryIds,
            qualityScore: 0, // scored separately
        };
    } catch {
        return null;
    }
}

// ── Public API ────────────────────────────────────────────────

/**
 * Get or generate today's hero insight for a user.
 * Checks cache first; generates fresh if expired or missing.
 */
export async function getHeroInsight(userId: string): Promise<GeneratedInsight | null> {
    if (!hasLlmProvider()) return null;

    // Check for a cached non-expired insight
    const now = new Date();
    const cached = await prisma.dashboardInsight.findFirst({
        where: {
            userId,
            expiresAt: { gt: now },
            qualityScore: { gte: MIN_QUALITY_SCORE },
        },
        orderBy: { generatedAt: 'desc' },
    });

    if (cached) {
        return {
            id: cached.id,
            category: cached.category as InsightCategory,
            title: cached.title,
            body: cached.body,
            evidence: cached.evidence,
            entryIds: cached.entryIds,
            qualityScore: cached.qualityScore,
        };
    }

    // Generate fresh insight
    return generateAndCacheInsight(userId);
}

/**
 * Generate a fresh insight, score it, and persist to DashboardInsight.
 */
async function generateAndCacheInsight(userId: string): Promise<GeneratedInsight | null> {
    // Fetch user data
    const [entries, analyses] = await Promise.all([
        prisma.entry.findMany({
            where: { userId, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 100,
            select: {
                id: true, title: true, content: true, mood: true,
                tags: true, skills: true, lessons: true, reflection: true,
                createdAt: true,
            },
        }),
        prisma.entryAnalysis.findMany({
            where: { userId },
            select: {
                entryId: true, sentimentScore: true, sentimentLabel: true,
                emotions: true, entities: true, topics: true, keywords: true,
                suggestedMood: true, wordCount: true,
            },
        }),
    ]);

    if (entries.length < MIN_ENTRIES_FOR_INSIGHTS) return null;

    const insightEntries: InsightEntry[] = entries.map((e) => ({
        id: e.id,
        title: e.title,
        content: e.content,
        mood: e.mood,
        tags: e.tags || [],
        skills: e.skills || [],
        lessons: e.lessons || [],
        reflection: (e as Record<string, unknown>).reflection as string | null ?? null,
        createdAt: e.createdAt,
    }));

    const insightAnalyses: InsightAnalysis[] = analyses.map((a) => ({
        entryId: a.entryId,
        sentimentScore: a.sentimentScore,
        sentimentLabel: a.sentimentLabel,
        emotions: a.emotions as Record<string, number> | null,
        entities: a.entities as string[] | null,
        topics: a.topics || [],
        keywords: a.keywords || [],
        suggestedMood: a.suggestedMood,
        wordCount: a.wordCount,
    }));

    const insightsData = buildDashboardInsights(insightEntries, insightAnalyses);

    // Fetch device context and journal intelligence in parallel
    const [deviceContext, journalIntelligence] = await Promise.all([
        buildDeviceContextForInsights(userId, 14).catch(() => null),
        (() => {
            try {
                const intelEntries: IntelEntry[] = entries.map((e) => ({
                    id: e.id,
                    content: e.content,
                    mood: e.mood,
                    tags: e.tags || [],
                    lifeArea: null,
                    createdAt: e.createdAt,
                }));
                const intelAnalyses: IntelAnalysis[] = analyses.map((a) => ({
                    entryId: a.entryId,
                    sentimentScore: a.sentimentScore,
                    emotions: a.emotions as Record<string, number> | null,
                    entities: a.entities as string[] | null,
                    topics: Array.isArray(a.topics) ? a.topics as string[] : [],
                    keywords: Array.isArray(a.keywords) ? a.keywords as string[] : [],
                    suggestedMood: a.suggestedMood,
                    wordCount: a.wordCount,
                }));
                return buildJournalIntelligence(intelEntries, intelAnalyses);
            } catch {
                return null;
            }
        })(),
    ]);

    const ctx: InsightContext = {
        userId,
        entries: insightEntries,
        analyses: insightAnalyses,
        insightsData,
        deviceContext,
        journalIntelligence,
    };

    // Determine which categories have enough data, weighted by user's past engagement
    const recentReactions = await prisma.dashboardInsight.findMany({
        where: { userId },
        orderBy: { generatedAt: 'desc' },
        take: 20,
        select: { category: true, userReaction: true },
    });

    const categoryOrder = prioritizeCategories(recentReactions);

    // Try each category until we get a quality insight
    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
        const category = categoryOrder[attempt % categoryOrder.length];
        const insight = await generateInsightForCategory(category, ctx);
        if (!insight) continue;

        // Score it
        const qualityScore = await scoreInsight(insight);
        insight.qualityScore = qualityScore;

        if (qualityScore >= MIN_QUALITY_SCORE) {
            // Persist to database
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + INSIGHT_EXPIRY_HOURS);

            const saved = await prisma.dashboardInsight.create({
                data: {
                    userId,
                    category: insight.category,
                    title: insight.title,
                    body: insight.body,
                    evidence: insight.evidence,
                    entryIds: insight.entryIds,
                    qualityScore: insight.qualityScore,
                    llmModel: aiRuntime.insightGenerationModel,
                    expiresAt,
                },
            });

            insight.id = saved.id;
            return insight;
        }
    }

    // All attempts failed quality gate — return best effort without caching
    return null;
}

/**
 * Prioritize insight categories based on past engagement.
 * Categories that got "expanded" or "wrote_entry" reactions rank higher.
 * Categories recently generated rank lower to add variety.
 */
function prioritizeCategories(
    recentReactions: Array<{ category: string; userReaction: string | null }>
): InsightCategory[] {
    const allCategories: InsightCategory[] = [
        'contradiction', 'hidden_pattern', 'growth_signal', 'blind_spot', 'evolution',
    ];

    const engagementScores = new Map<string, number>();
    const recentCounts = new Map<string, number>();

    for (const r of recentReactions) {
        recentCounts.set(r.category, (recentCounts.get(r.category) ?? 0) + 1);
        if (r.userReaction === 'expanded' || r.userReaction === 'wrote_entry') {
            engagementScores.set(r.category, (engagementScores.get(r.category) ?? 0) + 2);
        } else if (r.userReaction === 'dismissed') {
            engagementScores.set(r.category, (engagementScores.get(r.category) ?? 0) - 1);
        }
    }

    // Score = engagement bonus - recency penalty + randomness
    return allCategories
        .map((cat) => ({
            cat,
            score: (engagementScores.get(cat) ?? 0) - (recentCounts.get(cat) ?? 0) * 0.5 + Math.random() * 2,
        }))
        .sort((a, b) => b.score - a.score)
        .map((x) => x.cat);
}

/**
 * Record user reaction to an insight.
 */
export async function recordInsightReaction(
    insightId: string,
    userId: string,
    reaction: 'expanded' | 'dismissed' | 'wrote_entry'
): Promise<boolean> {
    const insight = await prisma.dashboardInsight.findFirst({
        where: { id: insightId, userId },
    });
    if (!insight) return false;

    await prisma.dashboardInsight.update({
        where: { id: insightId },
        data: { userReaction: reaction },
    });

    return true;
}

/**
 * Generate weekly digest — a deeper synthesis using the insightDeepModel.
 * Returns a structured editorial summarizing the past week.
 */
export async function generateWeeklyDigest(userId: string): Promise<{
    title: string;
    editorial: string;
    highlights: Array<{ category: string; insight: string }>;
    generatedAt: string;
} | null> {
    if (!hasLlmProvider()) return null;

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [entries, analyses, pastInsights] = await Promise.all([
        prisma.entry.findMany({
            where: { userId, deletedAt: null, createdAt: { gte: weekAgo } },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true, title: true, content: true, mood: true,
                tags: true, skills: true, lessons: true, reflection: true,
                createdAt: true,
            },
        }),
        prisma.entryAnalysis.findMany({
            where: {
                userId,
                entry: { createdAt: { gte: weekAgo }, deletedAt: null },
            },
            select: {
                entryId: true, sentimentScore: true, sentimentLabel: true,
                emotions: true, topics: true, keywords: true,
                suggestedMood: true, wordCount: true, entities: true,
            },
        }),
        prisma.dashboardInsight.findMany({
            where: { userId, generatedAt: { gte: weekAgo } },
            orderBy: { qualityScore: 'desc' },
            take: 5,
            select: { category: true, title: true, body: true },
        }),
    ]);

    if (entries.length < 3) return null;

    // Build week summary data
    const moods = entries.filter((e) => e.mood).map((e) => e.mood!);
    const totalWords = entries.reduce((s, e) => s + e.content.split(/\s+/).length, 0);
    const topics = new Set<string>();
    for (const a of analyses) {
        for (const t of a.topics) topics.add(t);
    }

    // Add device context for richer weekly digest
    const deviceCtx = await buildDeviceContextForInsights(userId, 7).catch(() => null);
    const deviceSection = deviceCtx ? `\n\nDEVICE/ENVIRONMENT CONTEXT:\n${deviceCtx}` : '';

    const weekSummary = `This week: ${entries.length} entries, ${totalWords} words, moods: ${moods.join(', ') || 'none selected'}. Topics covered: ${[...topics].slice(0, 10).join(', ') || 'various'}.`;

    const pastInsightsSummary = pastInsights.length > 0
        ? `\n\nInsights surfaced this week:\n${pastInsights.map((i) => `- [${i.category}] ${i.title}: ${i.body}`).join('\n')}`
        : '';

    const entrySummaries = entries.slice(0, 7).map((e) =>
        `- "${e.title || 'Untitled'}" (${e.mood || 'no mood'}, ${e.createdAt.toISOString().slice(0, 10)}): ${e.content.slice(0, 150)}...`
    ).join('\n');

    const result = await createLlmChatCompletion({
        model: aiRuntime.insightDeepModel,
        response_format: { type: 'json_object' },
        messages: [
            {
                role: 'system',
                content: `You are a warm, insightful journal companion writing a weekly reflection for a student. Write like a thoughtful friend, not a therapist. Use second person. Be specific — reference their actual entries and themes.`,
            },
            {
                role: 'user',
                content: `Write a weekly digest for this student's journal week.

${weekSummary}

ENTRIES THIS WEEK:
${entrySummaries}
${pastInsightsSummary}
${deviceSection}

Respond in JSON format:
{
  "title": "Weekly theme title (5-7 words)",
  "editorial": "A 2-3 paragraph editorial reflecting on their week. Reference specific entries. End with a forward-looking question.",
  "highlights": [
    {"category": "theme_name", "insight": "one-line takeaway"}
  ]
}

Max 3 highlights. Keep the editorial under 200 words.`,
            },
        ],
        temperature: 0.6,
        max_tokens: 800,
    });

    if (!result?.choices?.[0]?.message?.content) return null;

    try {
        const text = result.choices[0].message.content.trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;
        const parsed = JSON.parse(jsonMatch[0]);

        return {
            title: String(parsed.title || 'Your week in reflection'),
            editorial: String(parsed.editorial || ''),
            highlights: Array.isArray(parsed.highlights) ? parsed.highlights.slice(0, 3) : [],
            generatedAt: new Date().toISOString(),
        };
    } catch {
        return null;
    }
}
