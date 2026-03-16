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

export type PatternSignalTone = 'good' | 'care' | 'steady';

export type PatternSignal = {
    id: string;
    label: string;
    title: string;
    summary: string;
    value: string;
    hint: string;
    tone: PatternSignalTone;
    prompt: string;
};

export type PatternDigest = {
    primary: PatternSignal;
    supporting: PatternSignal[];
    rhythm: {
        activeDays: number;
        coveragePercent: number;
        bestDay: string | null;
        bestTime: string | null;
        bestDayCount: number;
    };
    focus: {
        theme: string | null;
        supportingTheme: string | null;
        noteCount: number;
        share: number;
    };
    emotion: {
        direction: 'up' | 'down' | 'steady';
        delta: number;
        averageScore: number | null;
        recentAverage: number | null;
    };
};

export type PatternDrilldownEntry = {
    id: string;
    title: string | null;
    content: string;
    mood: string | null;
    themes: string[];
    createdAt: string;
    matchReason: string;
};

export type PatternTimelineFilter = {
    search?: string;
    theme?: string;
    mood?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    weekday?: string;
    dayPart?: string;
};

export type PatternDrilldown = {
    id: string;
    label: string;
    title: string;
    description: string;
    emptyMessage: string;
    entries: PatternDrilldownEntry[];
    timelineFilter?: PatternTimelineFilter;
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
        activeDays: number;
        profileContext: ProfileContextSummary | null;
    };
    signature: {
        editorialRecap: EditorialRecap;
        thenNow: ThenNowComparison;
        patternDigest: PatternDigest;
        patternDrilldowns: {
            defaultId: string | null;
            items: PatternDrilldown[];
        };
        chartDrilldowns: {
            items: PatternDrilldown[];
        };
    };
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MIN_DAY_GAP_FOR_THEN_NOW = 90;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

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
const countWords = (value: string): number => value.match(/\S+/g)?.length || 0;
const roundToOneDecimal = (value: number): number => Math.round(value * 10) / 10;
const average = (values: number[]): number | null =>
    values.length > 0
        ? roundToOneDecimal(values.reduce((sum, value) => sum + value, 0) / values.length)
        : null;
const getPeriodLabel = (period: AnalyticsPeriod): string =>
    period === 'week' ? 'this week' : period === 'month' ? 'this month' : 'this year';
const pluralize = (count: number, singular: string, plural = `${singular}s`): string =>
    `${count} ${count === 1 ? singular : plural}`;
const getDayPartLabel = (hour: number): string => {
    if (hour >= 5 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 17) return 'Afternoon';
    if (hour >= 17 && hour < 22) return 'Evening';
    return 'Late night';
};
const clipText = (value: string, limit = 220): string =>
    value.length <= limit
        ? value
        : `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}...`;
const sortEntriesNewestFirst = (entries: AnalyticsSummaryEntry[]) =>
    [...entries].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
const uniqueEntriesById = (entries: AnalyticsSummaryEntry[]) => {
    const seen = new Set<string>();
    return entries.filter((entry) => {
        if (seen.has(entry.id)) return false;
        seen.add(entry.id);
        return true;
    });
};
const toPatternDrilldownEntry = (
    entry: AnalyticsSummaryEntry,
    matchReason: string
): PatternDrilldownEntry => ({
    id: entry.id,
    title: entry.title,
    content: clipText(entry.content),
    mood: normalizeMood(entry.mood),
    themes: getEntryThemes(entry).slice(0, 4).map(getReadableTheme),
    createdAt: entry.createdAt.toISOString(),
    matchReason,
});
const formatShortDrilldownDate = (value: string): string => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
    });
};

const incrementCount = (countMap: Map<string, number>, key: string) => {
    countMap.set(key, (countMap.get(key) || 0) + 1);
};

const getTopCountEntries = (countMap: Map<string, number>, limit: number) =>
    [...countMap.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, limit);

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

const buildThenNowComparison = (entries: AnalyticsSummaryEntry[]): ThenNowComparison => {
    if (entries.length < 2) return null;

    let nowEntry = entries[0];
    let earliestEntry = entries[0];

    entries.forEach((entry) => {
        if (entry.createdAt.getTime() > nowEntry.createdAt.getTime()) {
            nowEntry = entry;
        }
        if (entry.createdAt.getTime() < earliestEntry.createdAt.getTime()) {
            earliestEntry = entry;
        }
    });

    const nowTimestamp = nowEntry.createdAt.getTime();
    let thenEntry: AnalyticsSummaryEntry | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    entries.forEach((entry) => {
        if (entry.id === nowEntry.id) return;
        const daysBetween = Math.round((nowTimestamp - entry.createdAt.getTime()) / MS_PER_DAY);
        if (daysBetween < MIN_DAY_GAP_FOR_THEN_NOW) return;

        const distance = Math.abs(daysBetween - 365);
        if (
            distance < bestDistance ||
            (distance === bestDistance && !!thenEntry && entry.createdAt.getTime() > thenEntry.createdAt.getTime())
        ) {
            thenEntry = entry;
            bestDistance = distance;
        }
    });

    const resolvedThenEntry = thenEntry || earliestEntry;

    if (resolvedThenEntry.id === nowEntry.id) return null;

    const thenThemes = getEntryThemes(resolvedThenEntry);
    const nowThemes = getEntryThemes(nowEntry);
    const nowThemeSet = new Set(nowThemes);
    const sharedThemes = thenThemes.filter((theme) => nowThemeSet.has(theme)).slice(0, 3);
    const sharedThemeSet = new Set(sharedThemes);
    const emergingThemes = nowThemes.filter((theme) => !sharedThemeSet.has(theme)).slice(0, 3);
    const thenMood = normalizeMood(resolvedThenEntry.mood);
    const nowMood = normalizeMood(nowEntry.mood);
    const daysBetween = Math.round((nowTimestamp - resolvedThenEntry.createdAt.getTime()) / MS_PER_DAY);

    return {
        thenEntry: {
            id: resolvedThenEntry.id,
            title: resolvedThenEntry.title,
            content: resolvedThenEntry.content,
            createdAt: resolvedThenEntry.createdAt.toISOString(),
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
    analytics: AnalyticsSummary['analytics'],
    importedCount: number
): EditorialRecap => {
    const leadTheme = analytics.topThemes[0]?.theme ? getReadableTheme(analytics.topThemes[0].theme) : null;
    const secondaryTheme = analytics.topThemes[1]?.theme ? getReadableTheme(analytics.topThemes[1].theme) : null;
    const dominantMood = normalizeMood(analytics.topMood) || 'reflective';
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

type PatternCandidate = PatternSignal & {
    score: number;
};

const getTrackBoosts = (track: ProfileContextSummary['track'] | null | undefined) => {
    switch (track) {
        case 'personal':
            return { focus: 1, emotion: 2, rhythm: 1, growth: 1, gratitude: 2 };
        case 'professional':
            return { focus: 2, emotion: 0.5, rhythm: 2, growth: 1.5, gratitude: 0.5 };
        case 'blended':
            return { focus: 1.5, emotion: 1.5, rhythm: 1.25, growth: 1.5, gratitude: 1 };
        default:
            return { focus: 1, emotion: 1, rhythm: 1, growth: 1, gratitude: 1 };
    }
};

const buildPatternDigest = (input: {
    period: AnalyticsPeriod;
    analytics: AnalyticsSummary['analytics'];
    thenNow: ThenNowComparison;
    activeDays: number;
    coveragePercent: number;
    bestDay: string | null;
    bestDayCount: number;
    bestTime: string | null;
}): PatternDigest => {
    const {
        period,
        analytics,
        thenNow,
        activeDays,
        coveragePercent,
        bestDay,
        bestDayCount,
        bestTime,
    } = input;
    const periodLabel = getPeriodLabel(period);
    const boosts = getTrackBoosts(analytics.profileContext?.track);
    const focusTheme = analytics.topThemes[0]?.theme ? getReadableTheme(analytics.topThemes[0].theme) : null;
    const supportingTheme = analytics.topThemes[1]?.theme ? getReadableTheme(analytics.topThemes[1].theme) : null;
    const focusCount = analytics.topThemes[0]?.count || 0;
    const focusShare = analytics.totalEntries > 0
        ? Math.round((focusCount / analytics.totalEntries) * 100)
        : 0;

    const moodScores = analytics.moodTrend.map((item) => item.score);
    const averageScore = average(moodScores);
    let recentAverage: number | null = averageScore;
    let delta = 0;
    let direction: 'up' | 'down' | 'steady' = 'steady';

    if (moodScores.length >= 4) {
        const splitIndex = Math.floor(moodScores.length / 2);
        const previousAverage = average(moodScores.slice(0, splitIndex));
        const calculatedRecentAverage = average(moodScores.slice(splitIndex));
        if (previousAverage !== null && calculatedRecentAverage !== null) {
            recentAverage = calculatedRecentAverage;
            delta = roundToOneDecimal(calculatedRecentAverage - previousAverage);
            direction = delta >= 0.6 ? 'up' : delta <= -0.6 ? 'down' : 'steady';
        }
    }

    const candidates: PatternCandidate[] = [];

    if (focusTheme && focusCount > 0) {
        candidates.push({
            id: 'focus-theme',
            label: 'Main topic',
            title: focusShare >= 45
                ? `${focusTheme} is leading your notes`
                : `${focusTheme} keeps showing up`,
            summary: supportingTheme
                ? `${focusTheme} appeared in ${pluralize(focusCount, 'note')}, often beside ${supportingTheme.toLowerCase()}.`
                : `${focusTheme} appeared in ${pluralize(focusCount, 'note')}, making it the clearest topic ${periodLabel}.`,
            value: pluralize(focusCount, 'note'),
            hint: focusShare > 0 ? `${focusShare}% of notes` : 'Main topic',
            tone: 'steady',
            prompt: `${focusTheme} kept showing up ${periodLabel}. What part of it needs your attention most right now?`,
            score: focusCount * 1.4 + (focusShare / 20) + boosts.focus,
        });
    }

    if (moodScores.length >= 2 && averageScore !== null) {
        candidates.push({
            id: 'emotion-shift',
            label: 'Mood',
            title: direction === 'up'
                ? 'Your mood looks lighter lately'
                : direction === 'down'
                    ? 'Your mood feels heavier lately'
                    : 'Your mood has been fairly steady',
            summary: direction === 'steady'
                ? `Your notes are landing around ${averageScore}/10, without a large swing ${periodLabel}.`
                : `Recent notes moved ${Math.abs(delta)} points ${direction === 'up' ? 'up' : 'down'} compared with earlier notes in this view.`,
            value: direction === 'steady' ? 'Steady' : `${direction === 'up' ? 'Up' : 'Down'} ${Math.abs(delta)}`,
            hint: averageScore !== null ? `Average ${averageScore}/10` : 'Recent feeling',
            tone: direction === 'down' ? 'care' : direction === 'up' ? 'good' : 'steady',
            prompt: direction === 'up'
                ? 'Your recent notes feel lighter. What seems to be helping lately?'
                : direction === 'down'
                    ? 'Your recent notes feel heavier. What has been hardest lately, and what support would help?'
                    : 'Your recent notes feel steady. What has helped keep things stable lately?',
            score: (Math.abs(delta) * 3) + (moodScores.length / 4) + boosts.emotion,
        });
    }

    if (activeDays > 0) {
        const rhythmTitle = bestDay
            ? `${bestDay} is becoming your write day`
            : analytics.currentStreak >= 2
                ? 'You are building a writing rhythm'
                : 'A writing rhythm is starting to form';
        const rhythmSummaryParts = [`You showed up on ${pluralize(activeDays, 'day')} ${periodLabel}.`];
        if (bestDay) {
            rhythmSummaryParts.push(`${bestDay} was your strongest day.`);
        }
        if (bestTime) {
            rhythmSummaryParts.push(`${bestTime} was your easiest time to write.`);
        }

        candidates.push({
            id: 'rhythm',
            label: 'Rhythm',
            title: rhythmTitle,
            summary: rhythmSummaryParts.join(' '),
            value: pluralize(activeDays, 'day'),
            hint: analytics.currentStreak >= 2
                ? `${analytics.currentStreak}-day streak`
                : `${coveragePercent}% of days`,
            tone: analytics.currentStreak >= 2 ? 'good' : 'steady',
            prompt: bestDay
                ? `${bestDay} seems to be a natural write day for you. What makes that day easier to slow down and capture?`
                : 'When is the easiest moment in your day to save a quick note before it fades?',
            score: activeDays + (analytics.currentStreak * 1.8) + (coveragePercent / 15) + boosts.rhythm,
        });
    }

    if (thenNow) {
        const carriedTheme = thenNow.sharedThemes[0] ? getReadableTheme(thenNow.sharedThemes[0]) : null;
        candidates.push({
            id: 'change-over-time',
            label: 'Change',
            title: carriedTheme
                ? `${carriedTheme} has stayed with you`
                : 'A longer story is forming',
            summary: carriedTheme
                ? `Notes ${thenNow.daysBetween} days apart both came back to ${carriedTheme.toLowerCase()}.`
                : `A recent note and an older note are connected across ${thenNow.daysBetween} days.`,
            value: `${thenNow.daysBetween} days`,
            hint: 'Time between linked notes',
            tone: 'steady',
            prompt: thenNow.prompt,
            score: 4 + (thenNow.sharedThemes.length * 2) + thenNow.emergingThemes.length + boosts.growth,
        });
    }

    if (analytics.gratitudeItems[0]) {
        const brightSpot = analytics.gratitudeItems[0];
        candidates.push({
            id: 'bright-spot',
            label: 'Bright spot',
            title: 'One good thing keeps returning',
            summary: `"${brightSpot}" showed up in your notes, which may be something worth protecting on harder days.`,
            value: pluralize(analytics.gratitudeItems.length, 'bright spot'),
            hint: 'Good thing to keep',
            tone: 'good',
            prompt: `You kept noticing "${brightSpot}". Why does it matter so much right now?`,
            score: 3 + Math.min(analytics.gratitudeItems.length, 3) + boosts.gratitude,
        });
    }

    const rankedSignals = candidates
        .sort((left, right) => right.score - left.score)
        .map(({ score: _score, ...signal }) => signal);

    const fallbackPrimary: PatternSignal = {
        id: 'capture-more',
        label: 'Next step',
        title: 'Your next few notes will make the pattern clearer',
        summary: 'Keep saving short, honest notes and Notive will start showing stronger repeated topics, feelings, and changes.',
        value: pluralize(analytics.totalEntries, 'note'),
        hint: 'Notes in this view',
        tone: 'steady',
        prompt: 'What happened recently that you want to remember before it fades?',
    };

    const primary = rankedSignals[0] || fallbackPrimary;

    return {
        primary,
        supporting: rankedSignals.slice(1, 4),
        rhythm: {
            activeDays,
            coveragePercent,
            bestDay,
            bestTime,
            bestDayCount,
        },
        focus: {
            theme: focusTheme,
            supportingTheme,
            noteCount: focusCount,
            share: focusShare,
        },
        emotion: {
            direction,
            delta,
            averageScore,
            recentAverage,
        },
    };
};

const buildPatternDrilldowns = (input: {
    entries: AnalyticsSummaryEntry[];
    filteredEntries: AnalyticsSummaryEntry[];
    analytics: AnalyticsSummary['analytics'];
    patternDigest: PatternDigest;
    thenNow: ThenNowComparison;
    bestDay: string | null;
    bestTime: string | null;
}): {
    defaultId: string | null;
    items: PatternDrilldown[];
} => {
    const {
        entries,
        filteredEntries,
        analytics,
        patternDigest,
        thenNow,
        bestDay,
        bestTime,
    } = input;
    const items: PatternDrilldown[] = [];
    const entryMap = new Map(entries.map((entry) => [entry.id, entry]));
    const focusThemeKey = analytics.topThemes[0]?.theme || null;
    const supportingThemeKey = analytics.topThemes[1]?.theme || null;
    const topMoodKey = normalizeMood(analytics.topMood);
    const sortedFilteredEntries = sortEntriesNewestFirst(filteredEntries);

    if (focusThemeKey) {
        const focusThemeLabel = getReadableTheme(focusThemeKey);
        const focusEntries = sortedFilteredEntries
            .filter((entry) => getEntryThemes(entry).includes(focusThemeKey))
            .slice(0, 6)
            .map((entry) => toPatternDrilldownEntry(entry, `Shows the topic ${focusThemeLabel}`));

        items.push({
            id: 'focus-theme',
            label: 'Main topic',
            title: `${focusThemeLabel} notes`,
            description: `These notes are the clearest examples of ${focusThemeLabel.toLowerCase()} in this view.`,
            emptyMessage: `Add more notes about ${focusThemeLabel.toLowerCase()} to see a stronger set here.`,
            entries: focusEntries,
            timelineFilter: {
                theme: focusThemeLabel,
            },
        });
    }

    if (supportingThemeKey) {
        const supportingThemeLabel = getReadableTheme(supportingThemeKey);
        const supportingEntries = sortedFilteredEntries
            .filter((entry) => getEntryThemes(entry).includes(supportingThemeKey))
            .slice(0, 6)
            .map((entry) => toPatternDrilldownEntry(entry, `Also touches ${supportingThemeLabel}`));

        items.push({
            id: 'supporting-theme',
            label: 'Second topic',
            title: `${supportingThemeLabel} notes`,
            description: `These notes help explain why ${supportingThemeLabel.toLowerCase()} is showing up beside your main topic.`,
            emptyMessage: `A stronger second topic will appear as another idea starts repeating.`,
            entries: supportingEntries,
            timelineFilter: {
                theme: supportingThemeLabel,
            },
        });
    }

    if (topMoodKey) {
        const emotionEntries = sortedFilteredEntries
            .filter((entry) => normalizeMood(entry.mood) === topMoodKey)
            .slice(0, 6)
            .map((entry) => toPatternDrilldownEntry(entry, `${getReadableTheme(topMoodKey)} mood note`));

        items.push({
            id: 'emotion-shift',
            label: 'Mood',
            title: 'Notes behind the mood pattern',
            description: patternDigest.emotion.direction === 'up'
                ? 'These recent notes help explain why your mood looks lighter lately.'
                : patternDigest.emotion.direction === 'down'
                    ? 'These recent notes help explain why your mood feels heavier lately.'
                    : 'These notes show the feeling that has been most common in this view.',
            emptyMessage: 'Add mood labels to more notes to make this pattern easier to trace.',
            entries: emotionEntries,
            timelineFilter: {
                mood: topMoodKey,
            },
        });
    }

    if (bestDay || bestTime) {
        const rhythmEntries = uniqueEntriesById(sortedFilteredEntries.filter((entry) => {
            const entryDate = new Date(entry.createdAt);
            const matchesDay = bestDay ? DAY_NAMES[entryDate.getDay()] === bestDay : false;
            const matchesTime = bestTime ? getDayPartLabel(entryDate.getHours()) === bestTime : false;
            return matchesDay || matchesTime;
        }))
            .slice(0, 6)
            .map((entry) => {
                const entryDate = new Date(entry.createdAt);
                const dayName = DAY_NAMES[entryDate.getDay()];
                const timeLabel = getDayPartLabel(entryDate.getHours());
                return toPatternDrilldownEntry(entry, `${dayName} • ${timeLabel}`);
            });

        items.push({
            id: 'rhythm',
            label: 'Rhythm',
            title: 'Notes behind your rhythm',
            description: bestDay && bestTime
                ? `These notes come from your strongest rhythm: ${bestDay} and ${bestTime.toLowerCase()}.`
                : bestDay
                    ? `These notes show why ${bestDay} is becoming your strongest writing day.`
                    : `These notes show why ${bestTime} is becoming your easiest time to write.`,
            emptyMessage: 'Keep writing across a few more days and your rhythm notes will become clearer.',
            entries: rhythmEntries,
            timelineFilter: {
                weekday: bestDay || undefined,
                dayPart: bestTime || undefined,
            },
        });
    }

    if (analytics.gratitudeItems[0]) {
        const brightSpot = analytics.gratitudeItems[0];
        const brightSpotNeedle = brightSpot.toLowerCase();
        const brightSpotEntries = sortedFilteredEntries
            .filter((entry) => entry.content.toLowerCase().includes(brightSpotNeedle))
            .slice(0, 6)
            .map((entry) => toPatternDrilldownEntry(entry, `Mentions "${brightSpot}"`));

        items.push({
            id: 'bright-spot',
            label: 'Bright spot',
            title: 'Notes behind the bright spot',
            description: `"${brightSpot}" showed up often enough to become a visible bright spot in this view.`,
            emptyMessage: 'Write a few more good moments and Notive will build this list for you.',
            entries: brightSpotEntries,
            timelineFilter: {
                search: brightSpot,
            },
        });
    }

    if (thenNow) {
        const thenEntry = entryMap.get(thenNow.thenEntry.id);
        const nowEntry = entryMap.get(thenNow.nowEntry.id);
        const changeEntries = [thenEntry, nowEntry]
            .filter((entry): entry is AnalyticsSummaryEntry => Boolean(entry))
            .map((entry) => toPatternDrilldownEntry(
                entry,
                entry.id === thenNow.thenEntry.id ? 'Earlier note' : 'Recent note'
            ));

        items.push({
            id: 'change-over-time',
            label: 'Change',
            title: 'Notes behind the longer story',
            description: `These two notes are ${thenNow.daysBetween} days apart and show the clearest before-and-now view in this archive.`,
            emptyMessage: 'Keep writing across a longer stretch of time to unlock this view.',
            entries: changeEntries,
            timelineFilter: {
                ...(thenNow.sharedThemes[0]
                    ? {
                        theme: getReadableTheme(thenNow.sharedThemes[0]),
                    }
                    : {}),
                startDate: thenNow.thenEntry.createdAt.slice(0, 10),
                endDate: thenNow.nowEntry.createdAt.slice(0, 10),
            },
        });
    }

    const itemsWithEntries = items.filter((item) => item.entries.length > 0);
    const defaultId = itemsWithEntries.find((item) => item.id === patternDigest.primary.id)?.id
        || itemsWithEntries[0]?.id
        || null;

    return {
        defaultId,
        items: itemsWithEntries,
    };
};

const buildChartDrilldowns = (input: {
    filteredEntries: AnalyticsSummaryEntry[];
    moodTrend: AnalyticsSummary['analytics']['moodTrend'];
}): {
    items: PatternDrilldown[];
} => {
    const { filteredEntries, moodTrend } = input;
    const recentChartCutoff = Date.now() - (84 * MS_PER_DAY);
    const drilldownDates = new Set<string>(moodTrend.map((item) => item.date));

    filteredEntries.forEach((entry) => {
        if (entry.createdAt.getTime() < recentChartCutoff) return;
        drilldownDates.add(entry.createdAt.toISOString().slice(0, 10));
    });

    const groupedEntries = new Map<string, AnalyticsSummaryEntry[]>();
    sortEntriesNewestFirst(filteredEntries).forEach((entry) => {
        const dateKey = entry.createdAt.toISOString().slice(0, 10);
        if (!drilldownDates.has(dateKey)) return;
        const existing = groupedEntries.get(dateKey);
        if (existing) {
            existing.push(entry);
            return;
        }
        groupedEntries.set(dateKey, [entry]);
    });

    const items = [...groupedEntries.entries()]
        .sort(([leftDate], [rightDate]) => rightDate.localeCompare(leftDate))
        .map(([date, dateEntries]) => ({
            id: `date-${date}`,
            label: formatShortDrilldownDate(date),
            title: `Notes from ${formatShortDrilldownDate(date)}`,
            description: `These notes explain what was captured on ${formatShortDrilldownDate(date)}.`,
            emptyMessage: `No notes were saved on ${formatShortDrilldownDate(date)}.`,
            entries: dateEntries
                .slice(0, 6)
                .map((entry) => toPatternDrilldownEntry(entry, `Saved on ${formatShortDrilldownDate(date)}`)),
            timelineFilter: {
                date,
            },
        }))
        .filter((item) => item.entries.length > 0);

    return { items };
};

export const buildAnalyticsSummary = (input: {
    entries: AnalyticsSummaryEntry[];
    profileContext: ProfileContextSummary | null;
    period: AnalyticsPeriod;
}): AnalyticsSummary => {
    const { entries, profileContext, period } = input;
    const periodDays = period === 'week' ? 7 : period === 'month' ? 30 : 365;
    const cutoff = new Date(Date.now() - periodDays * MS_PER_DAY);
    const weekAgoTime = Date.now() - 7 * MS_PER_DAY;
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
                activeDays: 0,
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
                patternDigest: buildPatternDigest({
                    period,
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
                        activeDays: 0,
                        profileContext,
                    },
                    thenNow: buildThenNowComparison(entries),
                    activeDays: 0,
                    coveragePercent: 0,
                    bestDay: null,
                    bestDayCount: 0,
                    bestTime: null,
                }),
                patternDrilldowns: {
                    defaultId: null,
                    items: [],
                },
                chartDrilldowns: {
                    items: [],
                },
            },
        };
    }

    const accumulated = filteredEntries.reduce((acc, entry) => {
        const date = new Date(entry.createdAt);
        const timestamp = date.getTime();
        const isoDate = date.toISOString().split('T')[0];
        const dateStr = date.toDateString();
        const mood = normalizeMood(entry.mood);

        if (mood) {
            incrementCount(acc.moodCounts, mood);
            acc.totalMoods += 1;
            acc.moodTrend.push({
                timestamp,
                date: isoDate,
                mood,
                score: getMoodScore(mood),
            });
        }

        getEntryThemes(entry).forEach((theme) => {
            incrementCount(acc.tagCounts, theme);
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

        acc.totalWords += countWords(entry.content);

        acc.activityHeatmap[isoDate] = (acc.activityHeatmap[isoDate] || 0) + 1;
        incrementCount(acc.dayCounts, DAY_NAMES[date.getDay()] || 'Unknown');
        incrementCount(acc.timeCounts, getDayPartLabel(date.getHours()));

        if (timestamp >= weekAgoTime) {
            acc.entriesThisWeek += 1;
        }
        if (entry.source !== 'NOTIVE') {
            acc.importedCount += 1;
        }

        return acc;
    }, {
        moodCounts: new Map<string, number>(),
        tagCounts: new Map<string, number>(),
        moodTrend: [] as Array<{ timestamp: number; date: string; mood: string; score: number }>,
        uniqueDates: new Set<string>(),
        sortedDates: [] as Date[],
        gratitude: [] as string[],
        totalWords: 0,
        activityHeatmap: {} as Record<string, number>,
        dayCounts: new Map<string, number>(),
        timeCounts: new Map<string, number>(),
        entriesThisWeek: 0,
        totalMoods: 0,
        importedCount: 0,
    });

    const totalMoods = accumulated.totalMoods || 1;
    const emotionBreakdown = getTopCountEntries(accumulated.moodCounts, accumulated.moodCounts.size)
        .map(([emotion, count]) => ({
            emotion,
            count,
            percentage: Math.round((count / totalMoods) * 100),
            color: getMoodColor(emotion),
        }))
        .sort((left, right) => right.percentage - left.percentage);

    const topThemes = getTopCountEntries(accumulated.tagCounts, 5)
        .map(([theme, count]) => ({ theme, count }));
    const moodTrend = [...accumulated.moodTrend]
        .sort((left, right) => left.timestamp - right.timestamp)
        .slice(-14)
        .map(({ date, mood, score }) => ({ date, mood, score }));

    const sortedDates = [...accumulated.sortedDates].sort((left, right) => right.getTime() - left.getTime());
    const sortedDateStrings = sortedDates.map((value) => value.toDateString());
    const activeDays = accumulated.uniqueDates.size;
    const coveragePercent = Math.min(100, Math.round((activeDays / periodDays) * 100));
    const bestDayEntry = getTopCountEntries(accumulated.dayCounts, 1)[0];
    const bestTimeEntry = getTopCountEntries(accumulated.timeCounts, 1)[0];

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
        activeDays,
        profileContext,
    };
    const thenNow = buildThenNowComparison(entries);
    const patternDigest = buildPatternDigest({
        period,
        analytics,
        thenNow,
        activeDays,
        coveragePercent,
        bestDay: bestDayEntry?.[0] || null,
        bestDayCount: bestDayEntry?.[1] || 0,
        bestTime: bestTimeEntry?.[0] || null,
    });

    return {
        analytics,
        signature: {
            editorialRecap: buildEditorialRecap(period, analytics, accumulated.importedCount),
            thenNow,
            patternDigest,
            patternDrilldowns: buildPatternDrilldowns({
                entries,
                filteredEntries,
                analytics,
                patternDigest,
                thenNow,
                bestDay: bestDayEntry?.[0] || null,
                bestTime: bestTimeEntry?.[0] || null,
            }),
            chartDrilldowns: buildChartDrilldowns({
                filteredEntries,
                moodTrend,
            }),
        },
    };
};
