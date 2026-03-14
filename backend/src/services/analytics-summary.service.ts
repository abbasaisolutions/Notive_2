import type { ProfileContextSummary } from './profile-context.service';

export type AnalyticsPeriod = 'week' | 'month' | 'year';

export type AnalyticsSummaryEntry = {
    id: string;
    title: string | null;
    content: string;
    mood: string | null;
    tags: string[];
    skills: string[];
    lessons: string[];
    source: 'NOTIVE' | 'INSTAGRAM' | 'FACEBOOK';
    createdAt: Date;
};

export type EditorialRecap = {
    title: string;
    summary: string;
    highlights: string[];
    nextPrompt: string;
};

export type ThenNowComparison = {
    thenEntry: {
        id: string;
        title: string | null;
        content: string;
        createdAt: string;
    };
    nowEntry: {
        id: string;
        title: string | null;
        content: string;
        createdAt: string;
    };
    sharedThemes: string[];
    emergingThemes: string[];
    daysBetween: number;
    prompt: string;
} | null;

export type AnalyticsSummary = {
    analytics: {
        moodTrend: Array<{ date: string; mood: string; score: number }>;
        emotionBreakdown: Array<{ emotion: string; count: number; percentage: number; color: string }>;
        topMood: string;
        topThemes: Array<{ theme: string; count: number }>;
        totalEntries: number;
        currentStreak: number;
        longestStreak: number;
        avgWordCount: number;
        totalWords: number;
        entriesThisWeek: number;
        gratitudeItems: string[];
        activityHeatmap: Record<string, number>;
        profileContext: ProfileContextSummary | null;
    };
    signature: {
        editorialRecap: EditorialRecap;
        thenNow: ThenNowComparison;
    };
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MIN_DAY_GAP_FOR_THEN_NOW = 90;

const MOOD_COLORS: Record<string, string> = {
    happy: '#94a3b8',
    sad: '#64748b',
    anxious: '#78716c',
    calm: '#a8b1be',
    frustrated: '#6b7280',
    grateful: '#b8c0cd',
    motivated: '#8b96a8',
    tired: '#4b5563',
    thoughtful: '#9aa5b5',
    neutral: '#6b7280',
};

const MOOD_SCORES: Record<string, number> = {
    happy: 9,
    sad: 2,
    anxious: 3,
    calm: 7,
    frustrated: 2,
    grateful: 9,
    motivated: 8,
    tired: 4,
    thoughtful: 6,
    neutral: 5,
};

const MOOD_ALIAS_MAP: Record<string, string> = {
    angry: 'frustrated',
    mad: 'frustrated',
    furious: 'frustrated',
    irritated: 'frustrated',
    annoyed: 'frustrated',
    upset: 'frustrated',
    hopeful: 'motivated',
    optimistic: 'motivated',
    joy: 'happy',
    joyful: 'happy',
    happiness: 'happy',
    sadness: 'sad',
    lonely: 'sad',
    loneliness: 'sad',
    stress: 'anxious',
    stressed: 'anxious',
    worried: 'anxious',
    nervous: 'anxious',
    exhausted: 'tired',
    fatigued: 'tired',
    burnout: 'tired',
    reflective: 'thoughtful',
};

const THEME_STOPWORDS = new Set([
    'and',
    'the',
    'with',
    'from',
    'that',
    'this',
    'into',
    'about',
    'just',
    'more',
    'very',
    'life',
    'work',
    'entry',
    'journal',
]);

const normalizeMood = (mood: string | null | undefined): string | null => {
    if (!mood) return null;
    const key = mood.trim().toLowerCase();
    if (!key) return null;
    return MOOD_ALIAS_MAP[key] || key;
};

const getMoodScore = (mood: string | null | undefined) => {
    const normalized = normalizeMood(mood);
    if (!normalized) return MOOD_SCORES.neutral;
    return MOOD_SCORES[normalized] || MOOD_SCORES.neutral;
};

const getMoodColor = (mood: string | null | undefined) => {
    const normalized = normalizeMood(mood);
    if (!normalized) return MOOD_COLORS.neutral;
    return MOOD_COLORS[normalized] || MOOD_COLORS.neutral;
};

const normalizeToken = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

const titleCase = (value: string) =>
    value
        .split(/[\s_-]+/g)
        .filter(Boolean)
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join(' ');

const getReadableTheme = (value: string) => titleCase(value.replace(/^#/, ''));

const getEntryThemes = (entry: AnalyticsSummaryEntry) => {
    const values = [
        ...entry.tags,
        ...entry.skills,
        ...entry.lessons,
    ];

    return Array.from(new Set(values
        .map((value) => normalizeToken(value))
        .filter((value) => value && !THEME_STOPWORDS.has(value))));
};

const getTopThemes = (entries: AnalyticsSummaryEntry[], limit = 5) => {
    const counts = new Map<string, number>();

    entries.forEach((entry) => {
        entry.tags.forEach((tag) => {
            const normalized = normalizeToken(tag);
            if (!normalized || THEME_STOPWORDS.has(normalized)) return;
            counts.set(normalized, (counts.get(normalized) || 0) + 1);
        });
    });

    return [...counts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, limit)
        .map(([theme, count]) => ({ theme, count }));
};

const buildThenNowComparison = (entries: AnalyticsSummaryEntry[]): ThenNowComparison => {
    if (entries.length < 2) return null;

    const sorted = [...entries].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
    const nowEntry = sorted[sorted.length - 1];
    const eligible = sorted.filter((entry) => Math.round((nowEntry.createdAt.getTime() - entry.createdAt.getTime()) / MS_PER_DAY) >= MIN_DAY_GAP_FOR_THEN_NOW);
    const thenEntry = eligible.length > 0
        ? eligible.reduce((best, entry) => {
            const bestDistance = Math.abs(Math.round((nowEntry.createdAt.getTime() - best.createdAt.getTime()) / MS_PER_DAY) - 365);
            const nextDistance = Math.abs(Math.round((nowEntry.createdAt.getTime() - entry.createdAt.getTime()) / MS_PER_DAY) - 365);
            return nextDistance < bestDistance ? entry : best;
        })
        : sorted[0];

    if (thenEntry.id === nowEntry.id) return null;

    const thenThemes = getEntryThemes(thenEntry);
    const nowThemes = getEntryThemes(nowEntry);
    const sharedThemes = thenThemes.filter((theme) => nowThemes.includes(theme)).slice(0, 3);
    const emergingThemes = nowThemes.filter((theme) => !sharedThemes.includes(theme)).slice(0, 3);
    const thenMood = normalizeMood(thenEntry.mood);
    const nowMood = normalizeMood(nowEntry.mood);
    const daysBetween = Math.round((nowEntry.createdAt.getTime() - thenEntry.createdAt.getTime()) / MS_PER_DAY);

    return {
        thenEntry: {
            id: thenEntry.id,
            title: thenEntry.title,
            content: thenEntry.content,
            createdAt: thenEntry.createdAt.toISOString(),
        },
        nowEntry: {
            id: nowEntry.id,
            title: nowEntry.title,
            content: nowEntry.content,
            createdAt: nowEntry.createdAt.toISOString(),
        },
        sharedThemes,
        emergingThemes,
        daysBetween,
        prompt: sharedThemes.length > 0
            ? `You returned to ${sharedThemes[0]} across ${daysBetween} days. What changed in how you handled it?`
            : thenMood !== nowMood
                ? `What changed between feeling ${thenMood || 'one way'} and ${nowMood || 'another'}?`
                : 'What feels more grounded, clearer, or stronger in the newer entry?',
    };
};

const buildEditorialRecap = (
    period: AnalyticsPeriod,
    entries: AnalyticsSummaryEntry[],
    analytics: AnalyticsSummary['analytics']
): EditorialRecap => {
    const leadTheme = analytics.topThemes[0]?.theme ? getReadableTheme(analytics.topThemes[0].theme) : null;
    const secondaryTheme = analytics.topThemes[1]?.theme ? getReadableTheme(analytics.topThemes[1].theme) : null;
    const dominantMood = normalizeMood(analytics.topMood) || 'reflective';
    const importedCount = entries.filter((entry) => entry.source !== 'NOTIVE').length;
    const title = leadTheme
        ? `A ${dominantMood} ${period} of ${leadTheme.toLowerCase()}`
        : `A ${dominantMood} ${period} in review`;

    const highlights = [
        `${analytics.totalEntries} entries logged with an average of ${analytics.avgWordCount} words each.`,
        analytics.currentStreak > 1
            ? `You kept a ${analytics.currentStreak}-day streak alive, which gives this ${period} a real rhythm.`
            : `The cadence was lighter this ${period}, which makes the standout entries easier to examine closely.`,
        secondaryTheme
            ? `${leadTheme || 'Your top theme'} was reinforced by ${secondaryTheme.toLowerCase()}, which suggests a coherent arc instead of isolated moments.`
            : leadTheme
                ? `${leadTheme} was the clearest recurring signal in the journal.`
                : 'A stronger tag or lesson habit would make the pattern layer sharper.',
    ];

    if (importedCount > 0) {
        highlights.push(`${importedCount} entries came from imports, which is broadening the archive beyond direct capture.`);
    }

    return {
        title,
        summary: leadTheme
            ? `Your journal leaned ${dominantMood} and kept circling back to ${leadTheme.toLowerCase()}. This is the kind of pattern that can mature into a real life season or a stronger portfolio story.`
            : `Your journal leaned ${dominantMood} this ${period}. The strongest signals are forming, but they still need more repetition to become unmistakable.`,
        highlights: highlights.slice(0, 4),
        nextPrompt: analytics.gratitudeItems[0]
            ? `You kept noticing "${analytics.gratitudeItems[0]}". What does that reveal about what mattered most this ${period}?`
            : leadTheme
                ? `If ${leadTheme.toLowerCase()} defined this ${period}, what would a stronger next chapter look like?`
                : 'What deserves a fuller entry before this period closes?',
    };
};

export const buildAnalyticsSummary = (input: {
    entries: AnalyticsSummaryEntry[];
    profileContext: ProfileContextSummary | null;
    period: AnalyticsPeriod;
}): AnalyticsSummary => {
    const { entries, profileContext, period } = input;
    const periodDays = period === 'week' ? 7 : period === 'month' ? 30 : 365;
    const cutoff = new Date(Date.now() - periodDays * MS_PER_DAY);
    const filteredEntries = entries.filter((entry) => entry.createdAt >= cutoff);

    if (filteredEntries.length === 0) {
        return {
            analytics: {
                moodTrend: [],
                emotionBreakdown: [],
                topMood: 'neutral',
                topThemes: [],
                totalEntries: 0,
                currentStreak: 0,
                longestStreak: 0,
                avgWordCount: 0,
                totalWords: 0,
                entriesThisWeek: 0,
                gratitudeItems: [],
                activityHeatmap: {},
                profileContext,
            },
            signature: {
                editorialRecap: {
                    title: `A quiet ${period}`,
                    summary: 'Add a few entries and the recap will begin to turn activity into narrative.',
                    highlights: ['No entries in the selected period yet.'],
                    nextPrompt: 'What happened recently that is worth capturing before it fades?',
                },
                thenNow: buildThenNowComparison(entries),
            },
        };
    }

    const accumulated = filteredEntries.reduce((acc, entry) => {
        const date = new Date(entry.createdAt);
        const dateStr = date.toDateString();
        const mood = normalizeMood(entry.mood);

        if (mood) {
            acc.moodCounts[mood] = (acc.moodCounts[mood] || 0) + 1;
            acc.moodTrend.push({
                timestamp: date.getTime(),
                date: date.toISOString().split('T')[0],
                mood,
                score: getMoodScore(mood),
            });
        }

        entry.tags.forEach((tag) => {
            const normalized = normalizeToken(tag);
            if (!normalized || THEME_STOPWORDS.has(normalized)) return;
            acc.tagCounts[normalized] = (acc.tagCounts[normalized] || 0) + 1;
        });

        if (!acc.uniqueDates.has(dateStr)) {
            acc.uniqueDates.add(dateStr);
            acc.sortedDates.push(date);
        }

        const gratitudeMatches = entry.content.match(/(?:grateful for|thankful for|blessed to have) ([^.!?]+)/gi);
        if (gratitudeMatches) {
            acc.gratitude.push(...gratitudeMatches.map((match) =>
                match.replace(/grateful for|thankful for|blessed to have/i, '').trim()
            ));
        }

        const wordCount = entry.content.split(/\s+/).filter(Boolean).length;
        acc.totalWords += wordCount;

        const activityDate = date.toISOString().split('T')[0];
        acc.activityHeatmap[activityDate] = (acc.activityHeatmap[activityDate] || 0) + 1;

        const weekAgo = new Date(Date.now() - 7 * MS_PER_DAY);
        if (date >= weekAgo) {
            acc.entriesThisWeek += 1;
        }

        return acc;
    }, {
        moodCounts: {} as Record<string, number>,
        tagCounts: {} as Record<string, number>,
        moodTrend: [] as Array<{ timestamp: number; date: string; mood: string; score: number }>,
        uniqueDates: new Set<string>(),
        sortedDates: [] as Date[],
        gratitude: [] as string[],
        totalWords: 0,
        activityHeatmap: {} as Record<string, number>,
        entriesThisWeek: 0,
    });

    const totalMoods = Object.values(accumulated.moodCounts).reduce((sum, count) => sum + count, 0) || 1;
    const emotionBreakdown = Object.entries(accumulated.moodCounts)
        .map(([emotion, count]) => ({
            emotion,
            count,
            percentage: Math.round((count / totalMoods) * 100),
            color: getMoodColor(emotion),
        }))
        .sort((left, right) => right.percentage - left.percentage);

    const topThemes = getTopThemes(filteredEntries);
    const moodTrend = [...accumulated.moodTrend]
        .sort((left, right) => left.timestamp - right.timestamp)
        .slice(-14)
        .map(({ date, mood, score }) => ({ date, mood, score }));

    const sortedDates = [...accumulated.sortedDates].sort((left, right) => right.getTime() - left.getTime());
    const sortedDateStrings = sortedDates.map((value) => value.toDateString());

    let currentStreak = 0;
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - MS_PER_DAY).toDateString();

    if (sortedDateStrings[0] === today || sortedDateStrings[0] === yesterday) {
        currentStreak = 1;
        for (let index = 1; index < sortedDates.length; index += 1) {
            const previous = sortedDates[index - 1];
            const current = sortedDates[index];
            if (previous.getTime() - current.getTime() === MS_PER_DAY) {
                currentStreak += 1;
            } else {
                break;
            }
        }
    }

    let longestStreak = 0;
    if (sortedDates.length > 0) {
        let running = 1;
        longestStreak = 1;
        for (let index = 1; index < sortedDates.length; index += 1) {
            const previous = sortedDates[index - 1];
            const current = sortedDates[index];
            if (previous.getTime() - current.getTime() === MS_PER_DAY) {
                running += 1;
            } else {
                running = 1;
            }
            longestStreak = Math.max(longestStreak, running);
        }
    }

    const analytics = {
        moodTrend,
        emotionBreakdown,
        topMood: emotionBreakdown[0]?.emotion || 'neutral',
        topThemes,
        totalEntries: filteredEntries.length,
        currentStreak,
        longestStreak,
        avgWordCount: Math.round(accumulated.totalWords / filteredEntries.length),
        totalWords: accumulated.totalWords,
        entriesThisWeek: accumulated.entriesThisWeek,
        gratitudeItems: accumulated.gratitude.slice(0, 5),
        activityHeatmap: accumulated.activityHeatmap,
        profileContext,
    };

    return {
        analytics,
        signature: {
            editorialRecap: buildEditorialRecap(period, filteredEntries, analytics),
            thenNow: buildThenNowComparison(entries),
        },
    };
};
