export type DashboardHomePersona =
    | 'safety'
    | 'new_user'
    | 'returning'
    | 'checkin_due'
    | 'checked_in'
    | 'done_today'
    | 'story_ready'
    | 'growth'
    | 'pattern'
    | 'power_user'
    | 'memory';

export type DashboardHomeAction = {
    label: string;
    href?: string;
    targetId?: string;
    kind: 'href' | 'anchor' | 'none';
};

export type DashboardTakeawayTone = 'sage' | 'apricot' | 'lilac' | 'sky' | 'ink';

export type DashboardHomeSignal = {
    label: string;
    value: string;
    tone: DashboardTakeawayTone;
};

export type DashboardHomeTakeaway = {
    persona: DashboardHomePersona;
    personaLabel: string;
    eyebrow: string;
    headline: string;
    body: string;
    why: string;
    nextStep: string;
    primaryAction: DashboardHomeAction;
    secondaryAction?: DashboardHomeAction;
    signals: DashboardHomeSignal[];
};

export type DashboardHomeTakeawayEntry = {
    title?: string | null;
    content?: string | null;
    mood?: string | null;
    createdAt: string;
};

export type DashboardHomeTakeawayFocusAction = {
    label: string;
    href?: string;
};

export type DashboardHomeTakeawayInput = {
    entries: DashboardHomeTakeawayEntry[];
    themeClusters?: Array<{ label: string; entryCount: number; dominantMood?: string | null }>;
    storyOverview?: {
        stats: { entryCount: number; experienceCount: number; verifiedCount: number };
        experiences: Array<{
            verified: boolean;
            completeness?: {
                readyForVerification: boolean;
                readyForExport: boolean;
            } | null;
        }>;
        topSkills: string[];
        topLessons: string[];
    } | null;
    dashboardInsights?: {
        emotionalFingerprint?: {
            axes: Array<{ emotion: string; score: number; entryCount: number }>;
            summary: string;
        } | null;
        correlations?: Array<{ topic: string; direction: 'lifter' | 'drain'; delta?: number; occurrences?: number }>;
        triggerMap?: Array<{ entity: string; direction: 'lifter' | 'drain'; avgMoodDelta?: number; occurrences?: number }>;
        contradictions?: Array<{ description: string }>;
    } | null;
    journalIntel?: {
        growthLanguage?: { totalGrowthPhrases: number } | null;
        gratitude?: { totalExpressions: number } | null;
        peopleMap?: { people: Array<{ name: string; count: number }> } | null;
    } | null;
    heroInsight?: { body: string } | null;
    hasSafetyFocus?: boolean;
    hasCheckedInToday: boolean;
    todayCheckInMood?: string | null;
    profileTags?: string[];
    focusCard?: {
        title: string;
        body: string;
        evidence?: string | null;
        evidenceFallback?: string | null;
        primaryAction?: DashboardHomeTakeawayFocusAction | null;
        secondaryAction?: DashboardHomeTakeawayFocusAction | null;
    } | null;
    recommendedHref: string;
    portfolioHref: string;
    timelineHref: string;
    guideHref: string;
    checkInTargetId?: string;
    now?: Date;
};

export const DASHBOARD_QUICK_CHECKIN_ID = 'dashboard-quick-checkin';

const DAY_MS = 24 * 60 * 60 * 1000;

const toneForIndex = (index: number): DashboardTakeawayTone =>
    (['sage', 'apricot', 'lilac', 'sky'] as const)[index % 4];

const compactText = (value: string | null | undefined, maxLength = 140) => {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

const toTitleCase = (value: string | null | undefined) =>
    String(value || '')
        .replace(/[_-]+/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');

const makeHrefAction = (label: string, href?: string): DashboardHomeAction => ({
    label,
    href,
    kind: href ? 'href' : 'none',
});

const makeAnchorAction = (label: string, targetId: string): DashboardHomeAction => ({
    label,
    href: `#${targetId}`,
    targetId,
    kind: 'anchor',
});

const getDaysSinceLatestEntry = (entries: DashboardHomeTakeawayEntry[], now: Date) => {
    const latest = entries[0];
    if (!latest) return null;
    const createdAt = new Date(latest.createdAt).getTime();
    if (!Number.isFinite(createdAt)) return null;
    return Math.max(0, Math.floor((now.getTime() - createdAt) / DAY_MS));
};

const isSameLocalDay = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();

const hasEntryToday = (entries: DashboardHomeTakeawayEntry[], now: Date) =>
    entries.some((entry) => {
        const createdAt = new Date(entry.createdAt);
        return Number.isFinite(createdAt.getTime()) && isSameLocalDay(createdAt, now);
    });

const getRepeatedMood = (entries: DashboardHomeTakeawayEntry[]) => {
    const moods = entries
        .slice(0, 5)
        .map((entry) => String(entry.mood || '').trim().toLowerCase())
        .filter(Boolean);
    if (moods.length < 2) return null;

    const counts = new Map<string, number>();
    moods.forEach((mood) => counts.set(mood, (counts.get(mood) || 0) + 1));

    let strongestMood = '';
    let strongestCount = 0;
    counts.forEach((count, mood) => {
        if (count > strongestCount) {
            strongestMood = mood;
            strongestCount = count;
        }
    });

    return strongestCount >= 2 ? { mood: strongestMood, count: strongestCount } : null;
};

const getStoryCounts = (storyOverview: DashboardHomeTakeawayInput['storyOverview']) => {
    const experiences = storyOverview?.experiences || [];
    const ready = experiences.filter(
        (experience) => experience.verified || experience.completeness?.readyForExport || experience.completeness?.readyForVerification
    ).length;

    return {
        ready,
        verified: storyOverview?.stats.verifiedCount || 0,
        leadSignal: storyOverview?.topSkills?.[0] || storyOverview?.topLessons?.[0] || null,
    };
};

const getPatternSignal = (input: DashboardHomeTakeawayInput, repeatedMood: { mood: string; count: number } | null) => {
    if (repeatedMood) {
        return {
            label: 'Mood thread',
            value: `${toTitleCase(repeatedMood.mood)} x${repeatedMood.count}`,
            sentence: `${toTitleCase(repeatedMood.mood)} has shown up more than once lately, which makes it worth naming before the day moves on.`,
        };
    }

    const topTheme = input.themeClusters?.find((cluster) => cluster.entryCount >= 2) || input.themeClusters?.[0] || null;
    if (topTheme) {
        return {
            label: 'Returning theme',
            value: toTitleCase(topTheme.label),
            sentence: `${toTitleCase(topTheme.label)} keeps returning in your memories, so today's note can capture what changed this time.`,
        };
    }

    const correlation = input.dashboardInsights?.correlations?.[0];
    if (correlation) {
        return {
            label: correlation.direction === 'lifter' ? 'Lifter' : 'Drain',
            value: toTitleCase(correlation.topic),
            sentence: `${toTitleCase(correlation.topic)} appears to ${correlation.direction === 'lifter' ? 'lift' : 'drain'} your mood when it shows up.`,
        };
    }

    const trigger = input.dashboardInsights?.triggerMap?.[0];
    if (trigger) {
        return {
            label: trigger.direction === 'lifter' ? 'Anchor' : 'Pressure',
            value: toTitleCase(trigger.entity),
            sentence: `${toTitleCase(trigger.entity)} is repeating as a ${trigger.direction === 'lifter' ? 'helpful' : 'heavy'} influence.`,
        };
    }

    return null;
};

const hasGrowthIntent = (input: DashboardHomeTakeawayInput, storyLeadSignal: string | null) => {
    const profileText = (input.profileTags || []).join(' ').toLowerCase();
    return Boolean(
        storyLeadSignal
        || input.journalIntel?.growthLanguage?.totalGrowthPhrases
        || /\b(growth|skill|career|school|work|story|lesson|useful)\b/.test(profileText)
    );
};

const baseSignals = (input: DashboardHomeTakeawayInput, extra: DashboardHomeSignal[] = []) => {
    const signals: DashboardHomeSignal[] = [];
    const entriesCount = input.entries.length;
    const storyCounts = getStoryCounts(input.storyOverview);

    signals.push({
        label: 'Memories',
        value: String(input.storyOverview?.stats.entryCount || entriesCount),
        tone: 'sky',
    });

    if (storyCounts.ready > 0) {
        signals.push({
            label: 'Ready',
            value: String(storyCounts.ready),
            tone: 'lilac',
        });
    }

    if (input.hasCheckedInToday) {
        signals.push({
            label: 'Today',
            value: input.todayCheckInMood ? toTitleCase(input.todayCheckInMood) : 'Logged',
            tone: 'sage',
        });
    }

    return [...extra, ...signals]
        .filter((signal) => signal.value)
        .slice(0, 4)
        .map((signal, index) => ({ ...signal, tone: signal.tone || toneForIndex(index) }));
};

export const buildDashboardHomeTakeaway = (input: DashboardHomeTakeawayInput): DashboardHomeTakeaway => {
    const now = input.now || new Date();
    const checkInTargetId = input.checkInTargetId || DASHBOARD_QUICK_CHECKIN_ID;
    const focusPrimary = input.focusCard?.primaryAction || null;
    const focusSecondary = input.focusCard?.secondaryAction || null;
    const daysSinceLatestEntry = getDaysSinceLatestEntry(input.entries, now);
    const repeatedMood = getRepeatedMood(input.entries);
    const storyCounts = getStoryCounts(input.storyOverview);
    const patternSignal = getPatternSignal(input, repeatedMood);
    const storyLeadSignal = storyCounts.leadSignal;
    const hasTodayActivity = input.hasCheckedInToday || hasEntryToday(input.entries, now);

    if (input.hasSafetyFocus) {
        return {
            persona: 'safety',
            personaLabel: 'Support first',
            eyebrow: 'What matters now',
            headline: input.focusCard?.title || 'Put support in the picture before analysis.',
            body: compactText(input.focusCard?.body, 170) || 'This moment deserves a smaller next move and a real support option.',
            why: compactText(input.focusCard?.evidence || input.focusCard?.evidenceFallback, 170)
                || 'The dashboard is pausing the usual growth read because support is the more useful takeaway right now.',
            nextStep: focusPrimary?.label || 'Choose the safest next step',
            primaryAction: makeHrefAction(focusPrimary?.label || 'Get support', focusPrimary?.href),
            secondaryAction: focusSecondary ? makeHrefAction(focusSecondary.label, focusSecondary.href) : undefined,
            signals: baseSignals(input, [{ label: 'Mode', value: 'Care', tone: 'apricot' }]),
        };
    }

    if (input.entries.length === 0) {
        return {
            persona: 'new_user',
            personaLabel: 'First moment',
            eyebrow: 'Start here',
            headline: 'Save one real moment, not your whole life story.',
            body: 'Pick one thing that actually happened today. A line, a mood, or a small detail is enough to begin.',
            why: 'The first memory gives Notive something concrete to keep, understand, and turn into useful material later.',
            nextStep: focusPrimary?.label || 'Capture the first memory',
            primaryAction: makeHrefAction(focusPrimary?.label || 'Capture the first memory', focusPrimary?.href || input.recommendedHref),
            secondaryAction: makeHrefAction('Ask for a prompt', input.guideHref),
            signals: baseSignals(input, [{ label: 'Takeaway', value: 'Begin', tone: 'sage' }]),
        };
    }

    if (hasTodayActivity) {
        const moodLabel = input.todayCheckInMood ? toTitleCase(input.todayCheckInMood) : null;
        const readyStoryText = storyCounts.ready > 0
            ? `${storyCounts.ready} ${storyCounts.ready === 1 ? 'story is' : 'stories are'} ready when you want more.`
            : '';

        return {
            persona: 'done_today',
            personaLabel: 'Done for now',
            eyebrow: 'Today is kept',
            headline: moodLabel
                ? `${moodLabel} is part of today's thread now.`
                : "You've kept enough for today.",
            body: input.hasCheckedInToday
                ? "You can stop here. Add one sentence only if there's something else worth keeping."
                : "You already saved something from today. That counts; the dashboard does not need to ask for more.",
            why: readyStoryText
                || patternSignal?.sentence
                || 'The point of Home is to help you keep what matters, then let you leave without turning reflection into homework.',
            nextStep: 'Done for now',
            primaryAction: { label: 'Done for now', kind: 'none' },
            secondaryAction: storyCounts.ready > 0
                ? makeHrefAction('Open ready stories', input.portfolioHref)
                : makeHrefAction('Add one sentence', input.recommendedHref),
            signals: baseSignals(input, [
                { label: 'Enough', value: 'Kept', tone: 'sage' },
            ]),
        };
    }

    if (daysSinceLatestEntry !== null && daysSinceLatestEntry >= 5) {
        return {
            persona: 'returning',
            personaLabel: 'Gentle restart',
            eyebrow: 'Welcome back',
            headline: `${daysSinceLatestEntry} days away does not erase the thread.`,
            body: 'Restart with one small signal from today. You do not need to explain the whole gap.',
            why: patternSignal?.sentence || 'The next useful thing is not a perfect summary. It is one honest detail that reconnects the notebook to now.',
            nextStep: input.hasCheckedInToday ? 'Write one sentence' : 'Check in, then write if there is more',
            primaryAction: input.hasCheckedInToday
                ? makeHrefAction('Write one sentence', input.recommendedHref)
                : makeAnchorAction('Check in first', checkInTargetId),
            secondaryAction: makeHrefAction('Open memories', input.timelineHref),
            signals: baseSignals(input, [{ label: 'Gap', value: `${daysSinceLatestEntry}d`, tone: 'apricot' }]),
        };
    }

    if (storyCounts.ready > 0) {
        const readyText = `${storyCounts.ready} ${storyCounts.ready === 1 ? 'story is' : 'stories are'} ready to use`;
        return {
            persona: 'story_ready',
            personaLabel: 'Reusable material',
            eyebrow: 'Takeaway',
            headline: `${readyText}.`,
            body: storyLeadSignal
                ? `${toTitleCase(storyLeadSignal)} is the strongest piece of material showing up right now.`
                : 'Your memories have enough shape to become something useful outside the notebook.',
            why: 'This is the moment to move from capture into use: story, lesson, skill, resume note, reflection, or decision support.',
            nextStep: 'Open the story material',
            primaryAction: makeHrefAction('Open ready stories', input.portfolioHref),
            secondaryAction: makeHrefAction('Add a fresh note', input.recommendedHref),
            signals: baseSignals(input, [{ label: 'Ready', value: String(storyCounts.ready), tone: 'lilac' }]),
        };
    }

    if (patternSignal) {
        return {
            persona: 'pattern',
            personaLabel: 'Pattern read',
            eyebrow: 'What Notive noticed',
            headline: `${patternSignal.value} is the thread to watch today.`,
            body: patternSignal.sentence,
            why: input.heroInsight?.body
                ? compactText(input.heroInsight.body, 170)
                : 'A pattern becomes useful when it helps you catch the next moment sooner, not just label the last one.',
            nextStep: 'Look at the pattern, then capture what changed',
            primaryAction: makeHrefAction('Open patterns', input.timelineHref),
            secondaryAction: makeHrefAction('Write what changed', input.recommendedHref),
            signals: baseSignals(input, [{ label: patternSignal.label, value: patternSignal.value, tone: 'sage' }]),
        };
    }

    if (hasGrowthIntent(input, storyLeadSignal)) {
        const growthPhrase = storyLeadSignal
            ? toTitleCase(storyLeadSignal)
            : input.journalIntel?.growthLanguage?.totalGrowthPhrases
                ? `${input.journalIntel.growthLanguage.totalGrowthPhrases} growth phrases`
                : 'A useful skill';

        return {
            persona: 'growth',
            personaLabel: 'Growth signal',
            eyebrow: 'Use this later',
            headline: `${growthPhrase} is starting to become evidence.`,
            body: 'The useful part is not just what happened. It is what the memory proves about how you handled it.',
            why: 'That can become a story, a skill, a decision clue, or language you reuse when you need to explain yourself clearly.',
            nextStep: 'Turn the signal into a usable note',
            primaryAction: makeHrefAction('Build the story', input.portfolioHref),
            secondaryAction: makeHrefAction('Add one example', input.recommendedHref),
            signals: baseSignals(input, [{ label: 'Signal', value: growthPhrase, tone: 'apricot' }]),
        };
    }

    if (input.entries.length >= 10 && (input.dashboardInsights || input.journalIntel || input.storyOverview)) {
        return {
            persona: 'power_user',
            personaLabel: 'Deep map',
            eyebrow: 'Your map is filling in',
            headline: 'There is enough signal here to compare, not just collect.',
            body: 'Home can now show mood, story, people, gratitude, and growth threads without forcing every detail into the first screen.',
            why: input.heroInsight?.body
                ? compactText(input.heroInsight.body, 170)
                : 'The best takeaway is the one that helps you choose where to look next.',
            nextStep: 'Open the deeper read',
            primaryAction: makeHrefAction('Open patterns', input.timelineHref),
            secondaryAction: makeHrefAction('Open stories', input.portfolioHref),
            signals: baseSignals(input, [{ label: 'Depth', value: 'Ready', tone: 'lilac' }]),
        };
    }

    if (!input.hasCheckedInToday) {
        return {
            persona: 'checkin_due',
            personaLabel: 'Today signal',
            eyebrow: 'Before the deeper read',
            headline: 'Start with how today feels, then decide what to keep.',
            body: 'A quick mood check gives Home enough context without asking you to write a full entry.',
            why: 'The dashboard gets more useful when today has a small signal attached to the memories already here.',
            nextStep: 'Choose a mood below',
            primaryAction: makeAnchorAction('Check in now', checkInTargetId),
            secondaryAction: makeHrefAction('Write instead', input.recommendedHref),
            signals: baseSignals(input, [{ label: 'Needed', value: 'Mood', tone: 'sage' }]),
        };
    }

    if (input.hasCheckedInToday) {
        return {
            persona: 'checked_in',
            personaLabel: 'Logged today',
            eyebrow: 'Today is connected',
            headline: input.todayCheckInMood
                ? `${toTitleCase(input.todayCheckInMood)} is part of today's thread now.`
                : 'Today has a signal attached now.',
            body: 'You can leave it there, or add one sentence if something is worth keeping.',
            why: 'A check-in is enough to help future patterns read the day with more context.',
            nextStep: 'Add one sentence only if there is more',
            primaryAction: makeHrefAction('Write one sentence', input.recommendedHref),
            secondaryAction: makeHrefAction('Open memories', input.timelineHref),
            signals: baseSignals(input, [{ label: 'Today', value: input.todayCheckInMood ? toTitleCase(input.todayCheckInMood) : 'Logged', tone: 'sage' }]),
        };
    }

    const latest = input.entries[0];
    const latestTitle = compactText(latest?.title || latest?.content, 80);

    return {
        persona: 'memory',
        personaLabel: 'Latest memory',
        eyebrow: 'Takeaway',
        headline: latestTitle ? `The next useful clue is in "${latestTitle}".` : 'Your latest memory already holds something useful.',
        body: input.focusCard?.body || 'Start with the moment you saved, then look for the lesson, skill, pattern, or story piece inside it.',
        why: input.focusCard?.evidence || input.focusCard?.evidenceFallback || 'A memory becomes more useful when you can name what it shows.',
        nextStep: focusPrimary?.label || 'Write what this memory shows',
        primaryAction: makeHrefAction(focusPrimary?.label || 'Write what this memory shows', focusPrimary?.href || input.recommendedHref),
        secondaryAction: makeHrefAction('Open memories', input.timelineHref),
        signals: baseSignals(input, [{ label: 'Latest', value: latest?.mood ? toTitleCase(latest.mood) : 'Saved', tone: 'sky' }]),
    };
};

export default buildDashboardHomeTakeaway;
