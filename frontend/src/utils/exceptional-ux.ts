'use client';

export type AiResponseTone = 'gentle' | 'practical' | 'reflective' | 'direct';
export type InsightConsentMode = 'normal' | 'ask' | 'quiet';

export type ExceptionalUxPreferences = {
    aiTone: AiResponseTone;
    insightConsent: InsightConsentMode;
    privateEntryByDefault: boolean;
};

export type UxEntrySignal = {
    id: string;
    title: string | null;
    content: string;
    mood: string | null;
    createdAt: string;
};

const STORAGE_KEY = 'notive_exceptional_ux_preferences_v1';

export const DEFAULT_EXCEPTIONAL_UX_PREFERENCES: ExceptionalUxPreferences = {
    aiTone: 'gentle',
    insightConsent: 'normal',
    privateEntryByDefault: false,
};

const isBrowser = () => typeof window !== 'undefined';

const normalizeTone = (value: unknown): AiResponseTone =>
    value === 'practical' || value === 'reflective' || value === 'direct' || value === 'gentle'
        ? value
        : DEFAULT_EXCEPTIONAL_UX_PREFERENCES.aiTone;

const normalizeConsent = (value: unknown): InsightConsentMode =>
    value === 'ask' || value === 'quiet' || value === 'normal'
        ? value
        : DEFAULT_EXCEPTIONAL_UX_PREFERENCES.insightConsent;

export const readExceptionalUxPreferences = (): ExceptionalUxPreferences => {
    if (!isBrowser()) return DEFAULT_EXCEPTIONAL_UX_PREFERENCES;

    try {
        const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') as Partial<ExceptionalUxPreferences>;
        return {
            aiTone: normalizeTone(parsed.aiTone),
            insightConsent: normalizeConsent(parsed.insightConsent),
            privateEntryByDefault: parsed.privateEntryByDefault === true,
        };
    } catch {
        return DEFAULT_EXCEPTIONAL_UX_PREFERENCES;
    }
};

export const writeExceptionalUxPreferences = (preferences: ExceptionalUxPreferences) => {
    if (!isBrowser()) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
};

export const getToneMicrocopy = (tone: AiResponseTone) => {
    switch (tone) {
        case 'practical':
            return 'Practical next steps, less interpretation.';
        case 'reflective':
            return 'More meaning-making and gentle questions.';
        case 'direct':
            return 'Clearer wording with fewer cushions.';
        case 'gentle':
        default:
            return 'Soft language and low-pressure guidance.';
    }
};

export const buildDailyPath = (input: {
    entries: UxEntrySignal[];
    hasCheckedInToday: boolean;
    focusTitle: string;
    recommendedHref: string;
    portfolioHref: string;
    timelineHref: string;
}) => {
    const latestEntry = input.entries[0] || null;
    const todayKey = new Date().toISOString().slice(0, 10);
    const hasWrittenToday = input.entries.some((entry) => entry.createdAt.slice(0, 10) === todayKey);

    if (!latestEntry) {
        return {
            eyebrow: 'Today path',
            title: 'Save one real moment.',
            body: 'Start with one honest note. Nothing else has to be organized yet.',
            href: input.recommendedHref,
            cta: 'Write first note',
            reason: 'Notive needs one private signal before it can become useful.',
        };
    }

    if (!input.hasCheckedInToday && !hasWrittenToday) {
        return {
            eyebrow: 'Today path',
            title: 'Check in before the day gets loud.',
            body: 'A quick mood check gives today context without asking you to write a full entry.',
            href: `${input.recommendedHref}&source=daily_path_checkin`,
            cta: 'Start quick check-in',
            reason: 'You have not logged today yet.',
        };
    }

    if (input.entries.length >= 4) {
        return {
            eyebrow: 'Today path',
            title: 'Turn one memory into something usable.',
            body: 'A few notes are ready to become story, resume, lesson, or skill material when you need it.',
            href: input.portfolioHref,
            cta: 'Shape a memory',
            reason: `${input.entries.length} memories are now available as raw material.`,
        };
    }

    return {
        eyebrow: 'Today path',
        title: input.focusTitle || 'Stay with the clearest thread.',
        body: 'Write one follow-up while the signal is still fresh.',
        href: input.recommendedHref,
        cta: 'Write follow-up',
        reason: 'Follow-up notes make patterns easier to trust.',
    };
};

export const buildFallbackWeeklyDigest = (entries: UxEntrySignal[]) => {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weeklyEntries = entries.filter((entry) => new Date(entry.createdAt) >= weekStart);
    const source = weeklyEntries.length > 0 ? weeklyEntries : entries.slice(0, 3);
    const wordCount = source.reduce((total, entry) => total + String(entry.content || '').split(/\s+/).filter(Boolean).length, 0);
    const moods = source.map((entry) => entry.mood).filter(Boolean) as string[];
    const topMood = moods[0] || null;

    return {
        title: weeklyEntries.length > 0 ? 'This week in your words' : 'Your recent words',
        editorial: source.length > 0
            ? `You saved ${source.length} ${source.length === 1 ? 'memory' : 'memories'} and about ${wordCount} words. Notive is starting with what repeated, not what sounded impressive.`
            : 'Your weekly read appears after the first saved memory.',
        highlights: [
            topMood ? { category: 'Mood', insight: `The clearest recent mood signal was ${topMood}.` } : null,
            source[0] ? { category: 'Latest', insight: source[0].title || source[0].content.slice(0, 80) } : null,
        ].filter((item): item is { category: string; insight: string } => Boolean(item)),
        entryCount: source.length,
    };
};

export const buildFirstWeekSteps = (entryCount: number, hasCheckedInToday: boolean) => [
    {
        label: 'Save first memory',
        done: entryCount >= 1,
        hint: 'Give Notive one true moment to hold.',
    },
    {
        label: 'Add mood context',
        done: hasCheckedInToday || entryCount >= 2,
        hint: 'A quick check-in makes patterns less guessy.',
    },
    {
        label: 'Return once',
        done: entryCount >= 3,
        hint: 'The second or third note is when the notebook starts feeling alive.',
    },
    {
        label: 'Review weekly read',
        done: entryCount >= 5,
        hint: 'See what your week kept circling.',
    },
];
