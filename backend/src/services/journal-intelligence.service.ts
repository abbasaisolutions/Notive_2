/**
 * Journal Intelligence Service
 *
 * Deterministic KPI extraction from journal entries — ZERO LLM cost.
 * Extracts vocabulary, emotional range, life balance, people mentions,
 * growth language, gratitude, writing complexity, and self-talk patterns.
 *
 * All metrics computed from existing Entry + EntryAnalysis data.
 */

import { MOOD_SCORES } from '../utils/mood';
import { EMOTION_LEXICON } from '../utils/emotion-lexicon';
import type { InsightInputEntry, InsightInputAnalysis } from '../types/insight-inputs';

// ── Types ────────────────────────────────────────────────────

export type VocabularyProfile = {
    totalUniqueWords: number;
    richness: number;                // Type-Token Ratio (0-1)
    readingGradeLevel: number;       // Flesch-Kincaid grade
    avgWordsPerEntry: number;
    avgSentenceLength: number;
    emotionWords: string[];          // unique emotion words used
    emotionWordCount: number;
    rarityScore: number;             // 0-100, how rare/sophisticated
    recentNewWords: string[];        // new words in last 2 weeks
    growthRate: number;              // % increase in vocabulary
};

export type LifeBalanceArea = {
    area: string;
    score: number;                   // 0-1 normalized frequency
    entryCount: number;
    dominantMood: string | null;
    recentTrend: 'up' | 'stable' | 'down';
};

export type LifeBalance = {
    areas: LifeBalanceArea[];
    balanceScore: number;            // 0-100, higher = more balanced
    dominantArea: string;
    neglectedArea: string | null;
};

export type PersonMention = {
    name: string;
    count: number;
    avgMoodWhenMentioned: number;    // 0-10
    sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
    recentMention: string;           // ISO date
    contexts: string[];              // topic co-occurrences
};

export type PeopleMap = {
    people: PersonMention[];
    totalPeopleMentioned: number;
    socialDiversity: number;         // 0-1
};

export type GrowthLanguage = {
    totalGrowthPhrases: number;
    growthDensity: number;           // growth phrases per entry
    topPhrases: Array<{ phrase: string; count: number }>;
    recentTrend: 'increasing' | 'stable' | 'decreasing';
    mindsetRatio: number;            // 0-1 (1 = fully growth-oriented)
    fixedMindsetCount: number;
    growthMindsetCount: number;
};

export type EmotionalRange = {
    uniqueEmotions: number;
    emotionList: string[];
    rangeScore: number;              // 0-100
    dominantEmotion: string;
    rarestEmotion: string | null;
    emotionFrequency: Array<{ emotion: string; count: number; percentage: number }>;
    complexityScore: number;         // 0-100 (mixed emotions, nuance)
};

export type GratitudePulse = {
    totalExpressions: number;
    avgPerWeek: number;
    streak: number;                  // consecutive days with gratitude
    topThemes: string[];
    recentTrend: 'growing' | 'stable' | 'fading';
    depthScore: number;              // 0-100 (specific vs generic)
};

export type SelfTalkProfile = {
    growthStatements: number;
    fixedStatements: number;
    ratio: number;                   // 0-1 (1 = all growth)
    label: string;                   // "Growth champion", "Balanced thinker", etc.
    topGrowthPhrases: string[];
    topFixedPhrases: string[];
};

export type WritingVoice = {
    avgSentenceLength: number;
    avgParagraphLength: number;
    readingLevel: string;            // "Middle School", "High School", "College"
    readingGrade: number;
    questionFrequency: number;       // questions per entry
    exclamationFrequency: number;
    firstPersonRatio: number;        // how self-referential
    tenseDistribution: { past: number; present: number; future: number };
};

export type JournalIntelligence = {
    vocabulary: VocabularyProfile;
    lifeBalance: LifeBalance;
    peopleMap: PeopleMap;
    growthLanguage: GrowthLanguage;
    emotionalRange: EmotionalRange;
    gratitude: GratitudePulse;
    selfTalk: SelfTalkProfile;
    writingVoice: WritingVoice;
    entryCount: number;
    analyzedAt: string;
};

// ── Input Types (re-exports of the shared shapes) ────────────

export type IntelEntry = InsightInputEntry;
export type IntelAnalysis = InsightInputAnalysis;

// ── Constants ────────────────────────────────────────────────

const GROWTH_PHRASES = [
    'i learned', 'i realized', 'i understand now', 'next time i', 'i grew',
    'i improved', 'i can do', 'i will try', 'i discovered', 'i figured out',
    'taught me', 'helped me see', 'i noticed that', 'i appreciate', 'i\'m grateful',
    'i\'m working on', 'getting better at', 'i overcame', 'i faced', 'i chose to',
    'i decided to', 'stepping out of', 'pushed myself', 'proud that i',
    'i forgave', 'i let go', 'i accepted', 'i embraced', 'moving forward',
    'i\'m growing', 'making progress', 'breakthrough', 'turning point',
];

const FIXED_PHRASES = [
    'i can\'t', 'i\'ll never', 'i always fail', 'i\'m not good enough',
    'i\'m stupid', 'i\'m worthless', 'nothing works', 'what\'s the point',
    'i give up', 'there\'s no way', 'i\'m hopeless', 'i\'m a failure',
    'it\'s impossible', 'i don\'t deserve', 'i\'m stuck', 'i hate myself',
    'everyone else', 'nobody cares', 'nothing ever changes', 'i\'m too',
];

const GRATITUDE_SIGNALS = [
    'grateful', 'thankful', 'appreciate', 'blessed', 'lucky',
    'thanks to', 'glad that', 'fortunate', 'i\'m glad', 'so happy that',
    'means a lot', 'made my day', 'brightened', 'warmed my heart',
];

const LIFE_AREA_KEYWORDS: Record<string, string[]> = {
    school: ['school', 'class', 'teacher', 'exam', 'test', 'homework', 'assignment', 'lecture', 'grade', 'study', 'university', 'college', 'professor', 'campus', 'semester', 'gpa', 'thesis', 'essay', 'lab', 'research'],
    friends: ['friend', 'friends', 'bestie', 'hang out', 'hung out', 'party', 'group chat', 'squad', 'crew', 'bff', 'roommate', 'roommates', 'dorm'],
    family: ['mom', 'dad', 'mother', 'father', 'parent', 'parents', 'sister', 'brother', 'sibling', 'family', 'grandma', 'grandpa', 'aunt', 'uncle', 'cousin', 'home'],
    self: ['myself', 'self-care', 'alone time', 'journal', 'reflect', 'meditation', 'therapy', 'therapist', 'mental health', 'self-worth', 'identity', 'boundaries'],
    hobbies: ['hobby', 'sport', 'game', 'music', 'art', 'drawing', 'painting', 'reading', 'book', 'movie', 'show', 'workout', 'gym', 'run', 'running', 'yoga', 'cooking', 'guitar', 'piano', 'singing', 'dance', 'photography'],
    career: ['job', 'work', 'internship', 'resume', 'interview', 'career', 'boss', 'coworker', 'salary', 'promotion', 'application', 'linkedin', 'networking', 'skill'],
    romance: ['boyfriend', 'girlfriend', 'partner', 'date', 'dating', 'crush', 'relationship', 'love', 'breakup', 'broke up', 'ex', 'romantic', 'attraction', 'feelings for'],
    health: ['sleep', 'tired', 'sick', 'headache', 'anxiety', 'panic', 'doctor', 'hospital', 'medication', 'exercise', 'diet', 'nutrition', 'weight', 'energy', 'exhausted'],
};

const RARE_WORDS = new Set([
    'melancholy', 'bittersweet', 'nostalgic', 'empowered', 'conflicted',
    'ambivalent', 'resilient', 'disillusioned', 'liberated', 'exhilarated',
    'tormented', 'serene', 'agitated', 'wistful', 'euphoric', 'somber',
    'pensive', 'contemplative', 'cathartic', 'epiphany', 'visceral',
    'poignant', 'transcendent', 'nuanced', 'paradoxical', 'dichotomy',
]);

// ── Core Builder ─────────────────────────────────────────────

export function buildJournalIntelligence(
    entries: IntelEntry[],
    analyses: IntelAnalysis[]
): JournalIntelligence {
    const analysisMap = new Map<string, IntelAnalysis>();
    for (const a of analyses) analysisMap.set(a.entryId, a);

    return {
        vocabulary: buildVocabulary(entries),
        lifeBalance: buildLifeBalance(entries, analysisMap),
        peopleMap: buildPeopleMap(entries, analysisMap),
        growthLanguage: buildGrowthLanguage(entries),
        emotionalRange: buildEmotionalRange(entries, analysisMap),
        gratitude: buildGratitude(entries),
        selfTalk: buildSelfTalk(entries),
        writingVoice: buildWritingVoice(entries),
        entryCount: entries.length,
        analyzedAt: new Date().toISOString(),
    };
}

// ── Vocabulary ───────────────────────────────────────────────

function buildVocabulary(entries: IntelEntry[]): VocabularyProfile {
    const allTokens: string[] = [];
    const uniqueWords = new Set<string>();
    const emotionWordsUsed = new Set<string>();
    const rareWordsUsed = new Set<string>();
    let totalSentences = 0;

    // Split into halves for growth tracking
    const sorted = [...entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const midpoint = Math.floor(sorted.length / 2);
    const olderWords = new Set<string>();
    const recentWords = new Set<string>();

    for (let i = 0; i < sorted.length; i++) {
        const tokens = tokenize(sorted[i].content);
        allTokens.push(...tokens);
        const sentences = sorted[i].content.split(/[.!?]+/).filter((s) => s.trim().length > 3);
        totalSentences += sentences.length;

        for (const t of tokens) {
            uniqueWords.add(t);
            if (EMOTION_LEXICON.has(t)) emotionWordsUsed.add(t);
            if (RARE_WORDS.has(t)) rareWordsUsed.add(t);

            if (i < midpoint) olderWords.add(t);
            else recentWords.add(t);
        }
    }

    const recentNewWords = [...recentWords].filter((w) => !olderWords.has(w) && w.length > 3).slice(0, 20);
    const growthRate = olderWords.size > 0
        ? Math.round(((recentWords.size - olderWords.size) / olderWords.size) * 100)
        : 0;

    const avgSentenceLength = totalSentences > 0 ? Math.round(allTokens.length / totalSentences) : 0;
    const readingGrade = computeReadingGrade(allTokens.length, totalSentences, countSyllables(allTokens));

    return {
        totalUniqueWords: uniqueWords.size,
        richness: allTokens.length > 0 ? Math.round((uniqueWords.size / allTokens.length) * 100) / 100 : 0,
        readingGradeLevel: readingGrade,
        avgWordsPerEntry: entries.length > 0 ? Math.round(allTokens.length / entries.length) : 0,
        avgSentenceLength,
        emotionWords: [...emotionWordsUsed],
        emotionWordCount: emotionWordsUsed.size,
        rarityScore: Math.min(Math.round((rareWordsUsed.size / Math.max(uniqueWords.size, 1)) * 500), 100),
        recentNewWords,
        growthRate,
    };
}

// ── Life Balance ─────────────────────────────────────────────

function buildLifeBalance(
    entries: IntelEntry[],
    analysisMap: Map<string, IntelAnalysis>
): LifeBalance {
    const areaCounts: Record<string, { count: number; moods: number[]; recentCount: number }> = {};

    for (const area of Object.keys(LIFE_AREA_KEYWORDS)) {
        areaCounts[area] = { count: 0, moods: [], recentCount: 0 };
    }

    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const recentEntryCount = Math.max(entries.filter((entry) => entry.createdAt >= twoWeeksAgo).length, 1);

    for (const entry of entries) {
        const text = entry.content.toLowerCase();
        const analysis = analysisMap.get(entry.id);
        const allText = `${text} ${(analysis?.topics ?? []).join(' ')} ${entry.tags.join(' ')}`.toLowerCase();
        const moodScore = MOOD_SCORES[entry.mood?.toLowerCase() ?? ''] ?? 5;
        const isRecent = entry.createdAt >= twoWeeksAgo;
        const matchedAreas = new Set<string>();

        // Check explicit lifeArea field first
        if (entry.lifeArea && areaCounts[entry.lifeArea.toLowerCase()]) {
            matchedAreas.add(entry.lifeArea.toLowerCase());
        }

        // Also check keyword matching, but only count each area once per note.
        for (const [area, keywords] of Object.entries(LIFE_AREA_KEYWORDS)) {
            if (keywords.some((kw) => hasLifeAreaKeyword(allText, kw))) {
                matchedAreas.add(area);
            }
        }

        for (const area of matchedAreas) {
            areaCounts[area].count++;
            areaCounts[area].moods.push(moodScore);
            if (isRecent) areaCounts[area].recentCount++;
        }
    }

    const maxCount = Math.max(...Object.values(areaCounts).map((a) => a.count), 1);
    const areas: LifeBalanceArea[] = Object.entries(areaCounts)
        .map(([area, data]) => {
            const avgMood = data.moods.length > 0
                ? data.moods.reduce((s, v) => s + v, 0) / data.moods.length
                : null;
            const moodLabel = avgMood !== null
                ? Object.entries(MOOD_SCORES).reduce((best, [mood, score]) =>
                    Math.abs(score - avgMood!) < Math.abs((MOOD_SCORES[best] ?? 5) - avgMood!) ? mood : best, 'neutral')
                : null;

            // Trend: compare recent (last 2 weeks) vs overall ratio
            const overallRatio = data.count / entries.length;
            const recentRatio = data.recentCount / recentEntryCount;
            const trend: 'up' | 'stable' | 'down' =
                recentRatio > overallRatio * 1.3 ? 'up'
                    : recentRatio < overallRatio * 0.7 ? 'down' : 'stable';

            return {
                area: capitalize(area),
                score: data.count / maxCount,
                entryCount: data.count,
                dominantMood: moodLabel,
                recentTrend: trend,
            };
        })
        .sort((a, b) => b.score - a.score);

    // Balance score: how evenly distributed (entropy-based)
    const total = areas.reduce((s, a) => s + a.entryCount, 0);
    const probabilities = areas.map((a) => a.entryCount / Math.max(total, 1)).filter((p) => p > 0);
    const entropy = -probabilities.reduce((s, p) => s + p * Math.log2(p), 0);
    const maxEntropy = Math.log2(areas.length);
    const balanceScore = maxEntropy > 0
        ? Math.max(0, Math.round((entropy / maxEntropy) * 100))
        : 0;

    const coveredAreas = areas.filter((area) => area.entryCount > 0);
    const dominant = coveredAreas[0]?.area ?? 'Unknown';
    const weakestCoveredArea = coveredAreas.length >= 3 ? coveredAreas[coveredAreas.length - 1] : null;
    const neglected = weakestCoveredArea && weakestCoveredArea.area !== dominant && weakestCoveredArea.score < 0.6
        ? weakestCoveredArea.area
        : null;

    return { areas, balanceScore, dominantArea: dominant, neglectedArea: neglected };
}

// ── People Map ───────────────────────────────────────────────

function buildPeopleMap(
    entries: IntelEntry[],
    analysisMap: Map<string, IntelAnalysis>
): PeopleMap {
    const peopleMentions = new Map<string, { count: number; moods: number[]; lastDate: Date; topics: Set<string> }>();

    for (const entry of entries) {
        const analysis = analysisMap.get(entry.id);
        const entities = analysis?.entities;
        if (!Array.isArray(entities)) continue;

        const moodScore = MOOD_SCORES[entry.mood?.toLowerCase() ?? ''] ?? 5;

        for (const entity of entities) {
            const name = typeof entity === 'string' ? entity : String(entity);
            if (name.length < 2 || name.length > 30) continue;

            // Filter out common non-person entities
            const lower = name.toLowerCase();
            if (isCommonNoun(lower)) continue;

            const normalized = capitalize(lower);
            const existing = peopleMentions.get(normalized) ?? {
                count: 0, moods: [], lastDate: entry.createdAt, topics: new Set(),
            };
            existing.count++;
            existing.moods.push(moodScore);
            if (entry.createdAt > existing.lastDate) existing.lastDate = entry.createdAt;
            for (const t of (analysis?.topics ?? [])) existing.topics.add(t);

            peopleMentions.set(normalized, existing);
        }
    }

    const people: PersonMention[] = [...peopleMentions.entries()]
        .filter(([, data]) => data.count >= 2) // at least 2 mentions
        .map(([name, data]) => {
            const avgMood = data.moods.reduce((s, v) => s + v, 0) / data.moods.length;
            const sentiment: PersonMention['sentiment'] =
                avgMood >= 7 ? 'positive'
                    : avgMood <= 3 ? 'negative'
                        : data.moods.some((m) => m >= 7) && data.moods.some((m) => m <= 3) ? 'mixed'
                            : 'neutral';

            return {
                name,
                count: data.count,
                avgMoodWhenMentioned: Math.round(avgMood * 10) / 10,
                sentiment,
                recentMention: data.lastDate.toISOString(),
                contexts: [...data.topics].slice(0, 4),
            };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

    return {
        people,
        totalPeopleMentioned: people.length,
        socialDiversity: Math.min(people.length / 10, 1),
    };
}

// ── Growth Language ──────────────────────────────────────────

function buildGrowthLanguage(entries: IntelEntry[]): GrowthLanguage {
    let growthCount = 0;
    let fixedCount = 0;
    const phraseCounts = new Map<string, number>();

    const sorted = [...entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const midpoint = Math.floor(sorted.length / 2);
    let olderGrowth = 0;
    let recentGrowth = 0;

    for (let i = 0; i < sorted.length; i++) {
        const lower = sorted[i].content.toLowerCase();

        for (const phrase of GROWTH_PHRASES) {
            const matches = countOccurrences(lower, phrase);
            if (matches > 0) {
                growthCount += matches;
                phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + matches);
                if (i < midpoint) olderGrowth += matches;
                else recentGrowth += matches;
            }
        }

        for (const phrase of FIXED_PHRASES) {
            fixedCount += countOccurrences(lower, phrase);
        }
    }

    const total = growthCount + fixedCount;
    const recentTrend: GrowthLanguage['recentTrend'] =
        recentGrowth > olderGrowth * 1.2 ? 'increasing'
            : recentGrowth < olderGrowth * 0.8 ? 'decreasing' : 'stable';

    const topPhrases = [...phraseCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([phrase, count]) => ({ phrase, count }));

    return {
        totalGrowthPhrases: growthCount,
        growthDensity: entries.length > 0 ? Math.round((growthCount / entries.length) * 100) / 100 : 0,
        topPhrases,
        recentTrend,
        mindsetRatio: total > 0 ? Math.round((growthCount / total) * 100) / 100 : 0.5,
        fixedMindsetCount: fixedCount,
        growthMindsetCount: growthCount,
    };
}

// ── Emotional Range ──────────────────────────────────────────

function buildEmotionalRange(
    entries: IntelEntry[],
    analysisMap: Map<string, IntelAnalysis>
): EmotionalRange {
    const emotionCounts = new Map<string, number>();

    for (const entry of entries) {
        // From mood selection
        if (entry.mood) emotionCounts.set(entry.mood.toLowerCase(), (emotionCounts.get(entry.mood.toLowerCase()) ?? 0) + 1);

        // From NLP analysis
        const analysis = analysisMap.get(entry.id);
        if (analysis?.emotions) {
            for (const [emotion, score] of Object.entries(analysis.emotions)) {
                if (typeof score === 'number' && score > 0.3) {
                    emotionCounts.set(emotion.toLowerCase(), (emotionCounts.get(emotion.toLowerCase()) ?? 0) + 1);
                }
            }
        }

        // From content (emotion word detection)
        const tokens = tokenize(entry.content);
        for (const t of tokens) {
            if (EMOTION_LEXICON.has(t)) {
                emotionCounts.set(t, (emotionCounts.get(t) ?? 0) + 1);
            }
        }
    }

    const sorted = [...emotionCounts.entries()].sort((a, b) => b[1] - a[1]);
    const totalMentions = sorted.reduce((s, [, c]) => s + c, 0);

    const emotionFrequency = sorted.slice(0, 12).map(([emotion, count]) => ({
        emotion: capitalize(emotion),
        count,
        percentage: totalMentions > 0 ? Math.round((count / totalMentions) * 100) : 0,
    }));

    // Complexity: do they use nuanced/mixed emotions?
    const nuancedWords = ['bittersweet', 'ambivalent', 'conflicted', 'nostalgic', 'wistful', 'melancholy', 'pensive'];
    const nuancedCount = nuancedWords.filter((w) => emotionCounts.has(w)).length;
    const complexityScore = Math.min(
        Math.round((emotionCounts.size / 15) * 50 + (nuancedCount / 3) * 50),
        100
    );

    return {
        uniqueEmotions: emotionCounts.size,
        emotionList: sorted.map(([e]) => e),
        rangeScore: Math.min(Math.round((emotionCounts.size / 20) * 100), 100),
        dominantEmotion: sorted[0]?.[0] ?? 'neutral',
        rarestEmotion: sorted.length > 3 ? sorted[sorted.length - 1][0] : null,
        emotionFrequency,
        complexityScore,
    };
}

// ── Gratitude ────────────────────────────────────────────────

function buildGratitude(entries: IntelEntry[]): GratitudePulse {
    const sorted = [...entries].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    let totalExpressions = 0;
    const themes = new Map<string, number>();
    const dailyGratitude = new Set<string>();
    let specificCount = 0;

    for (const entry of sorted) {
        const lower = entry.content.toLowerCase();
        let entryGratitude = 0;

        for (const signal of GRATITUDE_SIGNALS) {
            const matches = countOccurrences(lower, signal);
            if (matches > 0) {
                entryGratitude += matches;

                // Check if it's specific (has a named object of gratitude)
                const idx = lower.indexOf(signal);
                const after = lower.slice(idx + signal.length, idx + signal.length + 50);
                if (/\b(for|that|about|to)\b/.test(after)) specificCount++;
            }
        }

        if (entryGratitude > 0) {
            totalExpressions += entryGratitude;
            dailyGratitude.add(entry.createdAt.toISOString().slice(0, 10));
            for (const tag of entry.tags) themes.set(tag, (themes.get(tag) ?? 0) + 1);
        }
    }

    // Streak
    let streak = 0;
    const today = new Date().toISOString().slice(0, 10);
    let checkDate = new Date();
    for (let i = 0; i < 30; i++) {
        const dateStr = checkDate.toISOString().slice(0, 10);
        if (dailyGratitude.has(dateStr) || (i === 0 && dateStr === today)) {
            streak++;
        } else if (i > 0) break;
        checkDate.setDate(checkDate.getDate() - 1);
    }

    // Weeks for avg
    const firstEntry = sorted[sorted.length - 1];
    const weeks = firstEntry
        ? Math.max(1, Math.ceil((Date.now() - firstEntry.createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000)))
        : 1;

    const midpoint = Math.floor(sorted.length / 2);
    const recentGrat = sorted.slice(0, midpoint).filter((e) =>
        GRATITUDE_SIGNALS.some((s) => e.content.toLowerCase().includes(s))
    ).length;
    const olderGrat = sorted.slice(midpoint).filter((e) =>
        GRATITUDE_SIGNALS.some((s) => e.content.toLowerCase().includes(s))
    ).length;

    const trend: GratitudePulse['recentTrend'] =
        recentGrat > olderGrat * 1.2 ? 'growing'
            : recentGrat < olderGrat * 0.8 ? 'fading' : 'stable';

    return {
        totalExpressions,
        avgPerWeek: Math.round((totalExpressions / weeks) * 10) / 10,
        streak,
        topThemes: [...themes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t),
        recentTrend: trend,
        depthScore: totalExpressions > 0 ? Math.min(Math.round((specificCount / totalExpressions) * 100), 100) : 0,
    };
}

// ── Self-Talk ────────────────────────────────────────────────

function buildSelfTalk(entries: IntelEntry[]): SelfTalkProfile {
    let growth = 0;
    let fixed = 0;
    const topGrowth = new Map<string, number>();
    const topFixed = new Map<string, number>();

    for (const entry of entries) {
        const lower = entry.content.toLowerCase();

        for (const phrase of GROWTH_PHRASES.slice(0, 15)) {
            const c = countOccurrences(lower, phrase);
            if (c > 0) { growth += c; topGrowth.set(phrase, (topGrowth.get(phrase) ?? 0) + c); }
        }
        for (const phrase of FIXED_PHRASES) {
            const c = countOccurrences(lower, phrase);
            if (c > 0) { fixed += c; topFixed.set(phrase, (topFixed.get(phrase) ?? 0) + c); }
        }
    }

    const total = growth + fixed;
    const ratio = total > 0 ? growth / total : 0.5;

    const label =
        ratio >= 0.85 ? 'Growth champion'
            : ratio >= 0.7 ? 'Optimistic thinker'
                : ratio >= 0.5 ? 'Balanced perspective'
                    : ratio >= 0.3 ? 'Working through doubt'
                        : 'Finding your footing';

    return {
        growthStatements: growth,
        fixedStatements: fixed,
        ratio: Math.round(ratio * 100) / 100,
        label,
        topGrowthPhrases: [...topGrowth.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([p]) => p),
        topFixedPhrases: [...topFixed.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([p]) => p),
    };
}

// ── Writing Voice ────────────────────────────────────────────

function buildWritingVoice(entries: IntelEntry[]): WritingVoice {
    let totalWords = 0;
    let totalSentences = 0;
    let totalParagraphs = 0;
    let totalQuestions = 0;
    let totalExclamations = 0;
    let firstPersonCount = 0;
    let pastCount = 0;
    let presentCount = 0;
    let futureCount = 0;
    let totalSyllables = 0;

    for (const entry of entries) {
        const sentences = entry.content.split(/[.!?]+/).filter((s) => s.trim().length > 3);
        const paragraphs = entry.content.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
        const tokens = tokenize(entry.content);
        const lower = entry.content.toLowerCase();

        totalWords += tokens.length;
        totalSentences += sentences.length;
        totalParagraphs += paragraphs.length;
        totalQuestions += (entry.content.match(/\?/g) || []).length;
        totalExclamations += (entry.content.match(/!/g) || []).length;
        totalSyllables += countSyllables(tokens);

        // First person
        firstPersonCount += (lower.match(/\b(i|me|my|mine|myself|i'm|i've|i'll|i'd)\b/g) || []).length;

        // Tense detection (approximate)
        pastCount += (lower.match(/\b(was|were|had|did|went|felt|thought|said|made|got|saw|came|took)\b/g) || []).length;
        presentCount += (lower.match(/\b(is|am|are|feel|think|know|want|need|see|have|do|go)\b/g) || []).length;
        futureCount += (lower.match(/\b(will|going to|plan to|want to|hope to|i'll|gonna)\b/g) || []).length;
    }

    const avgSentenceLength = totalSentences > 0 ? Math.round(totalWords / totalSentences) : 0;
    const readingGrade = computeReadingGrade(totalWords, totalSentences, totalSyllables);
    const readingLevel =
        readingGrade <= 6 ? 'Middle School'
            : readingGrade <= 10 ? 'High School'
                : readingGrade <= 13 ? 'College'
                    : 'Advanced';

    const tenseTotal = pastCount + presentCount + futureCount || 1;

    return {
        avgSentenceLength,
        avgParagraphLength: totalParagraphs > 0 ? Math.round(totalWords / totalParagraphs) : 0,
        readingLevel,
        readingGrade: Math.round(readingGrade * 10) / 10,
        questionFrequency: entries.length > 0 ? Math.round((totalQuestions / entries.length) * 100) / 100 : 0,
        exclamationFrequency: entries.length > 0 ? Math.round((totalExclamations / entries.length) * 100) / 100 : 0,
        firstPersonRatio: totalWords > 0 ? Math.round((firstPersonCount / totalWords) * 100) / 100 : 0,
        tenseDistribution: normalizeTenseDistribution({
            past: pastCount,
            present: presentCount,
            future: futureCount,
            total: tenseTotal,
        }),
    };
}

// ── Helpers ──────────────────────────────────────────────────

/**
 * Normalize tense distribution percentages to sum to exactly 100%.
 * Avoids rounding errors that cause bars to not fill completely.
 */
function normalizeTenseDistribution(counts: { past: number; present: number; future: number; total: number }) {
    const { past, present, future, total } = counts;
    if (total === 0) return { past: 0, present: 0, future: 0 };

    const pastPct = (past / total) * 100;
    const presentPct = (present / total) * 100;
    const futurePct = (future / total) * 100;

    // Round all three, but ensure they sum to 100
    let pastRounded = Math.round(pastPct);
    let presentRounded = Math.round(presentPct);
    let futureRounded = Math.round(futurePct);

    let sum = pastRounded + presentRounded + futureRounded;
    const diff = 100 - sum;

    // Distribute rounding error to the largest value
    if (diff !== 0) {
        const values = [
            { key: 'past' as const, value: pastRounded },
            { key: 'present' as const, value: presentRounded },
            { key: 'future' as const, value: futureRounded },
        ];
        const largest = values.reduce((max, v) => v.value > max.value ? v : max);

        if (largest.key === 'past') pastRounded += diff;
        else if (largest.key === 'present') presentRounded += diff;
        else futureRounded += diff;
    }

    return { past: pastRounded, present: presentRounded, future: futureRounded };
}

function tokenize(text: string): string[] {
    return text.toLowerCase().split(/\W+/).filter((t) => t.length > 1);
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function hasLifeAreaKeyword(text: string, keyword: string): boolean {
    return new RegExp(`\\b${escapeRegExp(keyword.toLowerCase())}\\b`, 'i').test(text);
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countOccurrences(text: string, phrase: string): number {
    let count = 0;
    let pos = 0;
    while ((pos = text.indexOf(phrase, pos)) !== -1) {
        count++;
        pos += phrase.length;
    }
    return count;
}

function countSyllables(tokens: string[]): number {
    let total = 0;
    for (const word of tokens) {
        let syllables = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').match(/[aeiouy]{1,2}/g);
        total += syllables ? syllables.length : 1;
    }
    return total;
}

function computeReadingGrade(words: number, sentences: number, syllables: number): number {
    if (sentences === 0 || words === 0) return 5;
    // Flesch-Kincaid Grade Level
    return Math.max(1, Math.min(16,
        0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59
    ));
}

const COMMON_NOUNS = new Set([
    'today', 'tomorrow', 'yesterday', 'monday', 'tuesday', 'wednesday', 'thursday',
    'friday', 'saturday', 'sunday', 'morning', 'afternoon', 'evening', 'night',
    'school', 'work', 'home', 'class', 'lunch', 'dinner', 'breakfast',
    'time', 'thing', 'stuff', 'way', 'day', 'week', 'month', 'year',
]);

function isCommonNoun(word: string): boolean {
    return COMMON_NOUNS.has(word) || word.length <= 2;
}
