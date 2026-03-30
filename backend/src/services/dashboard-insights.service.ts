/**
 * Dashboard Insights Service
 *
 * Computes personal insight metrics for the dashboard:
 * - Emotional Fingerprint (radar chart data)
 * - Resilience Signal (mood recovery tracking)
 * - Reflection Depth Score (journal quality metric)
 * - Mood-Context Correlations (topic→mood co-occurrence)
 * - Contradiction Detection (stated mood vs NLP sentiment)
 * - Trigger Map (entities that lift or drain mood)
 * - Vocabulary Expansion (emotional word growth)
 */

// ── Types ────────────────────────────────────────────────────

export type EmotionalFingerprint = {
    axes: Array<{
        emotion: string;
        score: number; // 0-1 normalized
        entryCount: number;
    }>;
    summary: string;
    uniqueness: number; // 0-1 how unusual this profile is
};

export type ResilienceSignal = {
    currentRecovery: number | null; // entries to recover from last dip
    previousRecovery: number | null;
    trend: 'improving' | 'stable' | 'declining' | 'insufficient_data';
    narrative: string;
    dipCount: number;
};

export type ReflectionDepthScore = {
    level: 0 | 1 | 2 | 3 | 4; // Surface, Noticing, Connecting, Pattern-finding, Integrating
    levelLabel: string;
    score: number; // 0-100
    progressToNext: number; // 0-1
    signals: {
        hasLessons: boolean;
        hasSkills: boolean;
        hasReflection: boolean;
        avgLength: number;
        growthTrend: 'up' | 'stable' | 'down';
    };
};

export type MoodContextCorrelation = {
    topic: string;
    avgMoodWhenPresent: number;
    avgMoodWhenAbsent: number;
    delta: number; // positive = lifts mood, negative = drains
    occurrences: number;
    direction: 'lifter' | 'drain';
};

export type Contradiction = {
    entryId: string;
    entryTitle: string | null;
    entryDate: string;
    statedMood: string;
    detectedSentiment: string;
    divergenceScore: number; // 0-1
    description: string;
};

export type TriggerMapItem = {
    entity: string;
    direction: 'lifter' | 'drain';
    avgMoodDelta: number;
    occurrences: number;
};

export type VocabularyExpansion = {
    currentPeriodWords: string[];
    previousPeriodWords: string[];
    newWords: string[];
    growthRate: number; // percentage increase
    totalUniqueWords: number;
};

export type DashboardInsightsData = {
    emotionalFingerprint: EmotionalFingerprint | null;
    resilience: ResilienceSignal | null;
    reflectionDepth: ReflectionDepthScore | null;
    correlations: MoodContextCorrelation[];
    contradictions: Contradiction[];
    triggerMap: TriggerMapItem[];
    vocabularyExpansion: VocabularyExpansion | null;
};

// ── Input types ──────────────────────────────────────────────

export type InsightEntry = {
    id: string;
    title: string | null;
    content: string;
    mood: string | null;
    tags: string[];
    skills: string[];
    lessons: string[];
    reflection: string | null;
    createdAt: Date;
};

export type InsightAnalysis = {
    entryId: string;
    sentimentScore: number | null;
    sentimentLabel: string | null;
    emotions: Record<string, number> | null;
    entities: string[] | null;
    topics: string[];
    keywords: string[];
    suggestedMood: string | null;
    wordCount: number | null;
};

// ── Constants ────────────────────────────────────────────────

const MOOD_SCORES: Record<string, number> = {
    happy: 9, sad: 2, anxious: 3, calm: 7,
    frustrated: 2, grateful: 9, motivated: 8,
    tired: 4, thoughtful: 6, neutral: 5,
};

const MOOD_ALIAS: Record<string, string> = {
    angry: 'frustrated', mad: 'frustrated', hopeful: 'motivated',
    joy: 'happy', joyful: 'happy', sadness: 'sad', lonely: 'sad',
    stress: 'anxious', stressed: 'anxious', worried: 'anxious',
    exhausted: 'tired', reflective: 'thoughtful',
};

const normMood = (m: string | null): string | null => {
    if (!m) return null;
    const k = m.trim().toLowerCase();
    return MOOD_ALIAS[k] || k;
};

const moodScore = (m: string | null): number => {
    const n = normMood(m);
    return n ? (MOOD_SCORES[n] ?? 5) : 5;
};

const DEPTH_LEVELS: Array<{ label: string; minScore: number }> = [
    { label: 'Surface', minScore: 0 },
    { label: 'Noticing', minScore: 20 },
    { label: 'Connecting', minScore: 40 },
    { label: 'Pattern-finding', minScore: 60 },
    { label: 'Integrating', minScore: 80 },
];

// Emotion words dictionary for vocabulary tracking
const EMOTION_WORDS = new Set([
    'happy', 'sad', 'anxious', 'calm', 'frustrated', 'grateful', 'motivated', 'tired',
    'thoughtful', 'excited', 'hopeful', 'proud', 'lonely', 'overwhelmed', 'peaceful',
    'nervous', 'confident', 'confused', 'angry', 'joyful', 'melancholy', 'restless',
    'content', 'bittersweet', 'nostalgic', 'inspired', 'vulnerable', 'empowered',
    'conflicted', 'grounded', 'scattered', 'serene', 'agitated', 'tender', 'resilient',
    'helpless', 'determined', 'apathetic', 'euphoric', 'grief', 'relief', 'shame',
    'guilt', 'envy', 'jealous', 'compassion', 'empathy', 'awe', 'wonder', 'dread',
    'bliss', 'resentment', 'irritated', 'yearning', 'longing', 'wistful', 'giddy',
    'somber', 'elated', 'disillusioned', 'fulfilled', 'hollow', 'numb', 'alive',
    'fragile', 'brave', 'defeated', 'triumphant', 'ambivalent', 'tormented',
    'liberated', 'suffocated', 'exhilarated', 'devastated', 'ecstatic', 'desolate',
    'gratitude', 'anguish', 'serenity', 'fury', 'adoration', 'contempt', 'curiosity',
    'disgust', 'fear', 'surprise', 'trust', 'anticipation', 'acceptance', 'worry',
    'stress', 'burnout', 'exhausted', 'energized', 'recharged', 'drained',
]);

// ── Core computation functions ───────────────────────────────

export function buildEmotionalFingerprint(
    analyses: InsightAnalysis[]
): EmotionalFingerprint | null {
    if (analyses.length < 5) return null;

    const emotionTotals = new Map<string, { sum: number; count: number }>();

    for (const a of analyses) {
        if (!a.emotions || typeof a.emotions !== 'object') continue;
        for (const [emotion, score] of Object.entries(a.emotions)) {
            if (typeof score !== 'number') continue;
            const existing = emotionTotals.get(emotion) ?? { sum: 0, count: 0 };
            existing.sum += score;
            existing.count += 1;
            emotionTotals.set(emotion, existing);
        }
    }

    if (emotionTotals.size < 3) return null;

    // Normalize to 0-1
    const axes: EmotionalFingerprint['axes'] = [];
    let maxAvg = 0;
    const averages = new Map<string, number>();

    for (const [emotion, { sum, count }] of emotionTotals) {
        const avg = sum / count;
        averages.set(emotion, avg);
        if (avg > maxAvg) maxAvg = avg;
    }

    for (const [emotion, avg] of averages) {
        axes.push({
            emotion,
            score: maxAvg > 0 ? avg / maxAvg : 0,
            entryCount: emotionTotals.get(emotion)!.count,
        });
    }

    // Sort by score descending, take top 8
    axes.sort((a, b) => b.score - a.score);
    const topAxes = axes.slice(0, 8);

    // Generate summary from top 3
    const top3 = topAxes.slice(0, 3).map((a) => a.emotion);
    const summary = top3.length >= 3
        ? `${capitalize(top3[0])} core, ${top3[1]} edge, ${top3[2]} bursts`
        : top3.map(capitalize).join(', ');

    // Uniqueness: how spread out the scores are (high variance = more unique)
    const scores = topAxes.map((a) => a.score);
    const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
    const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length;
    const uniqueness = Math.min(variance * 4, 1); // scale up

    return { axes: topAxes, summary, uniqueness };
}

export function buildResilienceSignal(entries: InsightEntry[]): ResilienceSignal | null {
    if (entries.length < 8) return null;

    const sorted = [...entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const scores = sorted.map((e) => moodScore(e.mood));

    // Compute personal baseline
    const baseline = scores.reduce((s, v) => s + v, 0) / scores.length;
    const dipThreshold = baseline - 1.5;

    // Find dip episodes and recovery times
    type Dip = { startIdx: number; recoveryEntries: number };
    const dips: Dip[] = [];
    let inDip = false;
    let dipStart = 0;

    for (let i = 0; i < scores.length; i++) {
        if (!inDip && scores[i] <= dipThreshold) {
            inDip = true;
            dipStart = i;
        } else if (inDip && scores[i] >= baseline) {
            dips.push({ startIdx: dipStart, recoveryEntries: i - dipStart });
            inDip = false;
        }
    }

    if (dips.length === 0) {
        return {
            currentRecovery: null,
            previousRecovery: null,
            trend: 'insufficient_data',
            narrative: 'Your mood has been steady — no significant dips detected.',
            dipCount: 0,
        };
    }

    const current = dips[dips.length - 1].recoveryEntries;
    const previous = dips.length >= 2 ? dips[dips.length - 2].recoveryEntries : null;

    let trend: ResilienceSignal['trend'] = 'stable';
    if (previous !== null) {
        if (current < previous) trend = 'improving';
        else if (current > previous) trend = 'declining';
    }

    const narrative = previous !== null
        ? `After your last rough patch, it took ${current} ${current === 1 ? 'entry' : 'entries'} to find your footing. Previously, it took ${previous}.`
        : `After your last rough patch, it took ${current} ${current === 1 ? 'entry' : 'entries'} to find your footing again.`;

    return {
        currentRecovery: current,
        previousRecovery: previous,
        trend,
        narrative,
        dipCount: dips.length,
    };
}

export function buildReflectionDepthScore(entries: InsightEntry[]): ReflectionDepthScore | null {
    if (entries.length < 5) return null;

    const recent = entries.slice(0, 30);
    let score = 0;

    // Signal: entries with lessons (0-25 points)
    const withLessons = recent.filter((e) => e.lessons.length > 0).length;
    const lessonRatio = withLessons / recent.length;
    score += lessonRatio * 25;

    // Signal: entries with skills (0-20 points)
    const withSkills = recent.filter((e) => e.skills.length > 0).length;
    const skillRatio = withSkills / recent.length;
    score += skillRatio * 20;

    // Signal: entries with reflection text (0-20 points)
    const withReflection = recent.filter((e) => e.reflection && e.reflection.trim().length > 20).length;
    const reflectionRatio = withReflection / recent.length;
    score += reflectionRatio * 20;

    // Signal: average entry length (0-20 points, max at 300+ words)
    const avgWords = recent.reduce((s, e) => s + (e.content?.split(/\s+/).filter(Boolean).length ?? 0), 0) / recent.length;
    score += Math.min(avgWords / 300, 1) * 20;

    // Signal: growth trend — are recent entries longer than older ones? (0-15 points)
    const recentHalf = recent.slice(0, Math.floor(recent.length / 2));
    const olderHalf = recent.slice(Math.floor(recent.length / 2));
    const recentAvgLen = recentHalf.reduce((s, e) => s + (e.content?.length ?? 0), 0) / (recentHalf.length || 1);
    const olderAvgLen = olderHalf.reduce((s, e) => s + (e.content?.length ?? 0), 0) / (olderHalf.length || 1);
    const growthTrend = recentAvgLen > olderAvgLen * 1.1 ? 'up' as const
        : recentAvgLen < olderAvgLen * 0.9 ? 'down' as const : 'stable' as const;
    if (growthTrend === 'up') score += 15;
    else if (growthTrend === 'stable') score += 8;

    score = Math.min(Math.round(score), 100);

    // Determine level
    let level: ReflectionDepthScore['level'] = 0;
    for (let i = DEPTH_LEVELS.length - 1; i >= 0; i--) {
        if (score >= DEPTH_LEVELS[i].minScore) {
            level = i as ReflectionDepthScore['level'];
            break;
        }
    }

    const nextLevel = level < 4 ? DEPTH_LEVELS[level + 1] : null;
    const progressToNext = nextLevel
        ? Math.min((score - DEPTH_LEVELS[level].minScore) / (nextLevel.minScore - DEPTH_LEVELS[level].minScore), 1)
        : 1;

    return {
        level,
        levelLabel: DEPTH_LEVELS[level].label,
        score,
        progressToNext,
        signals: {
            hasLessons: lessonRatio > 0.1,
            hasSkills: skillRatio > 0.1,
            hasReflection: reflectionRatio > 0.1,
            avgLength: Math.round(avgWords),
            growthTrend,
        },
    };
}

export function buildMoodContextCorrelations(
    entries: InsightEntry[],
    analyses: InsightAnalysis[]
): MoodContextCorrelation[] {
    if (entries.length < 10) return [];

    // Build entry→analysis lookup
    const analysisMap = new Map<string, InsightAnalysis>();
    for (const a of analyses) analysisMap.set(a.entryId, a);

    // Collect all topics/keywords
    const topicMoods = new Map<string, number[]>();
    const allMoods: number[] = [];

    for (const entry of entries) {
        const score = moodScore(entry.mood);
        allMoods.push(score);

        const analysis = analysisMap.get(entry.id);
        const topics = new Set<string>([
            ...entry.tags.map((t) => t.toLowerCase()),
            ...(analysis?.topics ?? []).map((t) => t.toLowerCase()),
        ]);

        for (const topic of topics) {
            if (topic.length < 2) continue;
            const existing = topicMoods.get(topic) ?? [];
            existing.push(score);
            topicMoods.set(topic, existing);
        }
    }

    const globalAvg = allMoods.reduce((s, v) => s + v, 0) / allMoods.length;

    // Find surprising correlations
    const correlations: MoodContextCorrelation[] = [];
    for (const [topic, scores] of topicMoods) {
        if (scores.length < 3) continue; // need minimum occurrences

        const topicAvg = scores.reduce((s, v) => s + v, 0) / scores.length;

        // Avg mood when topic is absent
        const absentScores = allMoods.length - scores.length;
        const absentTotal = allMoods.reduce((s, v) => s + v, 0) - scores.reduce((s, v) => s + v, 0);
        const absentAvg = absentScores > 0 ? absentTotal / absentScores : globalAvg;

        const delta = topicAvg - absentAvg;

        // Only include if delta is meaningful (> 0.8 points)
        if (Math.abs(delta) >= 0.8) {
            correlations.push({
                topic: capitalize(topic),
                avgMoodWhenPresent: round1(topicAvg),
                avgMoodWhenAbsent: round1(absentAvg),
                delta: round1(delta),
                occurrences: scores.length,
                direction: delta > 0 ? 'lifter' : 'drain',
            });
        }
    }

    // Sort by absolute delta, return top 6
    correlations.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    return correlations.slice(0, 6);
}

export function buildContradictions(
    entries: InsightEntry[],
    analyses: InsightAnalysis[]
): Contradiction[] {
    const results: Contradiction[] = [];
    const analysisMap = new Map<string, InsightAnalysis>();
    for (const a of analyses) analysisMap.set(a.entryId, a);

    for (const entry of entries) {
        if (!entry.mood) continue;
        const analysis = analysisMap.get(entry.id);
        if (!analysis?.sentimentScore || !analysis.suggestedMood) continue;

        const statedScore = moodScore(entry.mood);
        const detectedScore = moodScore(analysis.suggestedMood);
        const scoreDiff = Math.abs(statedScore - detectedScore);

        // Also check sentiment vs mood alignment
        const sentimentPositive = (analysis.sentimentScore ?? 0) > 0.3;
        const moodPositive = statedScore >= 7;
        const sentimentNegative = (analysis.sentimentScore ?? 0) < -0.3;
        const moodNegative = statedScore <= 3;

        const hasSentimentContradiction = (sentimentPositive && moodNegative) || (sentimentNegative && moodPositive);

        if (scoreDiff >= 4 || hasSentimentContradiction) {
            const statedLabel = normMood(entry.mood) ?? entry.mood;
            const detectedLabel = normMood(analysis.suggestedMood) ?? analysis.suggestedMood;
            const divergence = Math.min(scoreDiff / 7, 1);

            results.push({
                entryId: entry.id,
                entryTitle: entry.title,
                entryDate: entry.createdAt.toISOString(),
                statedMood: statedLabel,
                detectedSentiment: detectedLabel,
                divergenceScore: round1(divergence),
                description: `You said you felt "${statedLabel}" but your writing carried a "${detectedLabel}" tone. That gap might be worth noticing.`,
            });
        }
    }

    // Sort by divergence, return top 5
    results.sort((a, b) => b.divergenceScore - a.divergenceScore);
    return results.slice(0, 5);
}

export function buildTriggerMap(
    entries: InsightEntry[],
    analyses: InsightAnalysis[]
): TriggerMapItem[] {
    if (entries.length < 10) return [];

    const sorted = [...entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const analysisMap = new Map<string, InsightAnalysis>();
    for (const a of analyses) analysisMap.set(a.entryId, a);

    // Compute mood deltas between consecutive entries
    const entityDeltas = new Map<string, number[]>();

    for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        const delta = moodScore(curr.mood) - moodScore(prev.mood);

        const analysis = analysisMap.get(curr.id);
        const entities = analysis?.entities;
        if (!Array.isArray(entities)) continue;

        for (const entity of entities) {
            const name = typeof entity === 'string' ? entity.toLowerCase() : String(entity).toLowerCase();
            if (name.length < 2) continue;
            const existing = entityDeltas.get(name) ?? [];
            existing.push(delta);
            entityDeltas.set(name, existing);
        }
    }

    const items: TriggerMapItem[] = [];
    for (const [entity, deltas] of entityDeltas) {
        if (deltas.length < 2) continue;
        const avgDelta = deltas.reduce((s, v) => s + v, 0) / deltas.length;

        if (Math.abs(avgDelta) >= 0.5) {
            items.push({
                entity: capitalize(entity),
                direction: avgDelta > 0 ? 'lifter' : 'drain',
                avgMoodDelta: round1(avgDelta),
                occurrences: deltas.length,
            });
        }
    }

    items.sort((a, b) => Math.abs(b.avgMoodDelta) - Math.abs(a.avgMoodDelta));
    return items.slice(0, 10);
}

export function buildVocabularyExpansion(entries: InsightEntry[]): VocabularyExpansion | null {
    if (entries.length < 10) return null;

    const sorted = [...entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const midpoint = Math.floor(sorted.length / 2);
    const olderHalf = sorted.slice(0, midpoint);
    const recentHalf = sorted.slice(midpoint);

    const extractEmotionWords = (items: InsightEntry[]): Set<string> => {
        const words = new Set<string>();
        for (const entry of items) {
            const tokens = entry.content.toLowerCase().split(/\W+/).filter(Boolean);
            for (const token of tokens) {
                if (EMOTION_WORDS.has(token)) words.add(token);
            }
            // Also count mood selections
            if (entry.mood) words.add(entry.mood.toLowerCase());
        }
        return words;
    };

    const previousWords = extractEmotionWords(olderHalf);
    const currentWords = extractEmotionWords(recentHalf);
    const allWords = new Set([...previousWords, ...currentWords]);
    const newWords = [...currentWords].filter((w) => !previousWords.has(w));

    const growthRate = previousWords.size > 0
        ? Math.round(((currentWords.size - previousWords.size) / previousWords.size) * 100)
        : 0;

    return {
        currentPeriodWords: [...currentWords],
        previousPeriodWords: [...previousWords],
        newWords,
        growthRate,
        totalUniqueWords: allWords.size,
    };
}

// ── Aggregate builder ────────────────────────────────────────

export function buildDashboardInsights(
    entries: InsightEntry[],
    analyses: InsightAnalysis[]
): DashboardInsightsData {
    return {
        emotionalFingerprint: buildEmotionalFingerprint(analyses),
        resilience: buildResilienceSignal(entries),
        reflectionDepth: buildReflectionDepthScore(entries),
        correlations: buildMoodContextCorrelations(entries, analyses),
        contradictions: buildContradictions(entries, analyses),
        triggerMap: buildTriggerMap(entries, analyses),
        vocabularyExpansion: buildVocabularyExpansion(entries),
    };
}

// ── Helpers ──────────────────────────────────────────────────

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function round1(n: number): number {
    return Math.round(n * 10) / 10;
}
