export type TimelineSignatureEntry = {
    id: string;
    title: string | null;
    content: string;
    mood: string | null;
    tags: string[];
    skills: string[];
    lessons: string[];
    lifeArea: string | null;
    source: 'NOTIVE' | 'INSTAGRAM' | 'FACEBOOK';
    createdAt: Date;
};

export type TimelineLifeSeason = {
    id: string;
    title: string;
    summary: string;
    startDate: string;
    endDate: string;
    entryCount: number;
    dominantMood: string | null;
    topThemes: string[];
};

export type ConstellationNodeKind = 'center' | 'theme' | 'skill' | 'lesson' | 'mood';

export type ConstellationEntryPreview = {
    id: string;
    title: string | null;
    contentSnippet: string;
    createdAt: string;
    mood: string | null;
};

export type ConstellationNode = {
    id: string;
    label: string;
    kind: ConstellationNodeKind;
    x: number;
    y: number;
    size: number;
    count: number;
    previewEntries: ConstellationEntryPreview[];
};

export type ConstellationLink = {
    sourceId: string;
    targetId: string;
};

export type ConstellationModel = {
    headline: string;
    nodes: ConstellationNode[];
    links: ConstellationLink[];
};

export type TimelineStoryArcMoment = {
    id: string;
    title: string | null;
    contentSnippet: string;
    createdAt: string;
    mood: string | null;
    themes: string[];
};

export type TimelineStoryArc = {
    title: string;
    summary: string;
    spanDays: number;
    entryCount: number;
    opening: TimelineStoryArcMoment;
    turningPoint: TimelineStoryArcMoment | null;
    current: TimelineStoryArcMoment;
    carriedThemes: string[];
    emergingThemes: string[];
    moodShift: {
        from: string | null;
        to: string | null;
        direction: 'up' | 'down' | 'steady';
        label: string;
    };
    prompt: string;
};

export type TimelineSignatureSummary = {
    totalEntries: number;
    activeDays: number;
    importedCount: number;
    startDate: string | null;
    endDate: string | null;
    seasons: TimelineLifeSeason[];
    storyArc: TimelineStoryArc | null;
    constellation: ConstellationModel;
};

type ThemeBucket = {
    label: string;
    score: number;
    kind: Exclude<ConstellationNodeKind, 'center'>;
    entryIds: Set<string>;
};

const MAX_SEASONS = 5;
const MAX_CONSTELLATION_NODES = 10;
const SEASON_GAP_DAYS = 18;
const SEASON_SPAN_DAYS = 65;
const ENTRY_PREVIEW_COUNT = 5;
const ENTRY_PREVIEW_LENGTH = 240;
const STORY_ARC_THEME_LIMIT = 3;
const MOOD_DIRECTION_SCORES: Record<string, number> = {
    happy: 3,
    grateful: 3,
    motivated: 2,
    calm: 1,
    thoughtful: 0.5,
    neutral: 0,
    tired: -1,
    anxious: -2,
    frustrated: -2,
    sad: -3,
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

const toTime = (value: Date | string) => new Date(value).getTime();

const dayDiff = (left: Date | string, right: Date | string) =>
    Math.round(Math.abs(toTime(left) - toTime(right)) / (1000 * 60 * 60 * 24));

const formatDate = (value: Date | string) =>
    new Date(value).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

const formatMonthKey = (value: Date | string) => {
    const parsed = new Date(value);
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
};

const normalizeMood = (mood: string | null | undefined): string | null => {
    if (!mood) return null;
    const key = mood.trim().toLowerCase();
    if (!key) return null;
    return MOOD_ALIAS_MAP[key] || key;
};

const titleCase = (value: string) =>
    value
        .split(/[\s_-]+/g)
        .filter(Boolean)
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join(' ');

const normalizeToken = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

const getReadableTheme = (value: string) => titleCase(value.replace(/^#/, ''));

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const getEntryThemes = (entry: TimelineSignatureEntry) => unique([
    ...(entry.tags || []),
    ...(entry.skills || []),
    ...(entry.lessons || []),
    ...(entry.lifeArea ? [entry.lifeArea] : []),
].map((value) => normalizeToken(String(value))).filter((value) => value && !THEME_STOPWORDS.has(value)));

const getDominantMood = (entries: TimelineSignatureEntry[]) => {
    const counts = new Map<string, number>();

    entries.forEach((entry) => {
        const mood = normalizeMood(entry.mood);
        if (!mood) return;
        counts.set(mood, (counts.get(mood) || 0) + 1);
    });

    return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || null;
};

const getTopThemes = (entries: TimelineSignatureEntry[], limit = 3) => {
    const counts = new Map<string, number>();

    entries.forEach((entry) => {
        getEntryThemes(entry).forEach((theme) => {
            counts.set(theme, (counts.get(theme) || 0) + 1);
        });
    });

    return [...counts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, limit)
        .map(([theme]) => theme);
};

const buildSeasonTitle = (entries: TimelineSignatureEntry[], topThemes: string[], dominantMood: string | null) => {
    if (topThemes[0]) {
        return `${getReadableTheme(topThemes[0])} Season`;
    }

    if (dominantMood) {
        return `${titleCase(dominantMood)} Stretch`;
    }

    const importedCount = entries.filter((entry) => entry.source !== 'NOTIVE').length;
    if (importedCount >= Math.ceil(entries.length / 2)) {
        return 'Imported Chapter';
    }

    return 'New Chapter';
};

const buildEntryPreview = (entry: TimelineSignatureEntry): ConstellationEntryPreview => ({
    id: entry.id,
    title: entry.title,
    contentSnippet: entry.content.length > ENTRY_PREVIEW_LENGTH
        ? `${entry.content.slice(0, ENTRY_PREVIEW_LENGTH).trim()}...`
        : entry.content,
    createdAt: entry.createdAt.toISOString(),
    mood: normalizeMood(entry.mood),
});

const buildStoryArcMoment = (entry: TimelineSignatureEntry): TimelineStoryArcMoment => ({
    ...buildEntryPreview(entry),
    themes: getEntryThemes(entry).slice(0, STORY_ARC_THEME_LIMIT).map(getReadableTheme),
});

const getMoodDirection = (from: string | null, to: string | null): 'up' | 'down' | 'steady' => {
    const fromScore = from ? (MOOD_DIRECTION_SCORES[from] || 0) : 0;
    const toScore = to ? (MOOD_DIRECTION_SCORES[to] || 0) : 0;
    if (toScore > fromScore) return 'up';
    if (toScore < fromScore) return 'down';
    return 'steady';
};

const buildTimelineStoryArc = (entries: TimelineSignatureEntry[]): TimelineStoryArc | null => {
    if (entries.length < 2) return null;

    const sorted = [...entries].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
    const opening = sorted[0];
    const current = sorted[sorted.length - 1];
    const spanDays = Math.max(1, dayDiff(opening.createdAt, current.createdAt));
    const openingMood = normalizeMood(opening.mood);
    const currentMood = normalizeMood(current.mood);
    const moodDirection = getMoodDirection(openingMood, currentMood);
    const openingThemeSet = new Set(getEntryThemes(opening));
    const currentThemes = getEntryThemes(current);
    const currentThemeSet = new Set(currentThemes);
    const overallTopThemes = getTopThemes(sorted, 6);
    const carriedThemes = overallTopThemes
        .filter((theme) => openingThemeSet.has(theme) && currentThemeSet.has(theme))
        .slice(0, STORY_ARC_THEME_LIMIT)
        .map(getReadableTheme);
    const emergingThemes = currentThemes
        .filter((theme) => !openingThemeSet.has(theme))
        .slice(0, STORY_ARC_THEME_LIMIT)
        .map(getReadableTheme);
    const turningCandidates = sorted.slice(1, -1);
    const halfSpanMs = Math.max((current.createdAt.getTime() - opening.createdAt.getTime()) / 2, 1);
    const midpoint = opening.createdAt.getTime() + halfSpanMs;
    const overallTopThemeSet = new Set(overallTopThemes);
    let turningPoint = turningCandidates[Math.floor(turningCandidates.length / 2)] || null;
    let turningScore = Number.NEGATIVE_INFINITY;

    turningCandidates.forEach((entry) => {
        const entryThemes = getEntryThemes(entry);
        const bridgingThemes = entryThemes.filter((theme) => currentThemeSet.has(theme) && !openingThemeSet.has(theme)).length;
        const novelThemes = entryThemes.filter((theme) => !openingThemeSet.has(theme)).length;
        const recurringThemes = entryThemes.filter((theme) => overallTopThemeSet.has(theme)).length;
        const moodShift = normalizeMood(entry.mood) !== openingMood ? 1 : 0;
        const midpointScore = Math.max(0, 1 - (Math.abs(entry.createdAt.getTime() - midpoint) / halfSpanMs));
        const score = (bridgingThemes * 2.2) + (novelThemes * 1.15) + (recurringThemes * 0.45) + (moodShift * 0.75) + midpointScore;

        if (score > turningScore) {
            turningPoint = entry;
            turningScore = score;
        }
    });

    const moodLabel = openingMood && currentMood && openingMood !== currentMood
        ? `From ${titleCase(openingMood)} to ${titleCase(currentMood)}`
        : currentMood
            ? `Mostly ${titleCase(currentMood)}`
            : 'Mood still forming';
    const title = carriedThemes[0] && emergingThemes[0]
        ? `${carriedThemes[0]} stayed while ${emergingThemes[0]} grew`
        : emergingThemes[0]
            ? `${emergingThemes[0]} started shaping this stretch`
            : carriedThemes[0]
                ? `${carriedThemes[0]} carried this stretch`
                : openingMood && currentMood && openingMood !== currentMood
                    ? `This stretch moved from ${titleCase(openingMood)} to ${titleCase(currentMood)}`
                    : 'This stretch tells a clear story';
    const summaryParts = [
        `Across ${spanDays} days and ${sorted.length} notes, this range shows how your story moved.`,
    ];

    if (carriedThemes[0]) {
        summaryParts.push(`${carriedThemes[0]} stayed in the background from start to now.`);
    }

    if (emergingThemes[0]) {
        summaryParts.push(`${emergingThemes[0]} became more visible as the stretch went on.`);
    } else if (openingMood && currentMood && openingMood !== currentMood) {
        summaryParts.push(`The tone shifted from ${titleCase(openingMood).toLowerCase()} to ${titleCase(currentMood).toLowerCase()}.`);
    }

    const prompt = carriedThemes[0] && emergingThemes[0]
        ? `${carriedThemes[0]} stayed with you while ${emergingThemes[0]} started to grow. What changed across this stretch?`
        : openingMood && currentMood && openingMood !== currentMood
            ? `What changed between feeling ${openingMood} and ${currentMood} across this stretch?`
            : `Looking across these ${sorted.length} notes, what changed most for you during this stretch?`;

    return {
        title,
        summary: summaryParts.join(' '),
        spanDays,
        entryCount: sorted.length,
        opening: buildStoryArcMoment(opening),
        turningPoint: turningPoint ? buildStoryArcMoment(turningPoint) : null,
        current: buildStoryArcMoment(current),
        carriedThemes,
        emergingThemes,
        moodShift: {
            from: openingMood,
            to: currentMood,
            direction: moodDirection,
            label: moodLabel,
        },
        prompt,
    };
};

const buildConstellationModel = (entries: TimelineSignatureEntry[]): ConstellationModel => {
    if (entries.length === 0) {
        return {
            headline: 'Capture a few entries and your meaning graph will begin to take shape.',
            nodes: [{
                id: 'center',
                label: 'You Now',
                kind: 'center',
                x: 50,
                y: 50,
                size: 88,
                count: 0,
                previewEntries: [],
            }],
            links: [],
        };
    }

    const entryMap = new Map(entries.map((entry) => [entry.id, entry]));
    const buckets = new Map<string, ThemeBucket>();
    const register = (kind: Exclude<ConstellationNodeKind, 'center'>, rawLabel: string, entryId: string, weight: number) => {
        const normalized = normalizeToken(rawLabel);
        if (!normalized || THEME_STOPWORDS.has(normalized)) return;
        const key = `${kind}:${normalized}`;
        const current = buckets.get(key) || {
            label: kind === 'mood' ? titleCase(normalized) : getReadableTheme(normalized),
            score: 0,
            kind,
            entryIds: new Set<string>(),
        };

        current.score += weight;
        current.entryIds.add(entryId);
        buckets.set(key, current);
    };

    entries.forEach((entry) => {
        (entry.tags || []).forEach((tag) => register('theme', tag, entry.id, 1.3));
        (entry.skills || []).forEach((skill) => register('skill', skill, entry.id, 1.15));
        (entry.lessons || []).forEach((lesson) => register('lesson', lesson, entry.id, 1.05));
        const mood = normalizeMood(entry.mood);
        if (mood) {
            register('mood', mood, entry.id, 0.95);
        }
    });

    const candidates = [...buckets.entries()]
        .map(([id, bucket]) => ({
            id,
            label: bucket.label,
            kind: bucket.kind,
            score: bucket.score + bucket.entryIds.size,
            count: bucket.entryIds.size,
            previewEntries: [...bucket.entryIds]
                .map((entryId) => entryMap.get(entryId))
                .filter((entry): entry is TimelineSignatureEntry => Boolean(entry))
                .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
                .slice(0, ENTRY_PREVIEW_COUNT)
                .map(buildEntryPreview),
        }))
        .sort((left, right) => right.score - left.score)
        .slice(0, MAX_CONSTELLATION_NODES);

    const total = candidates.length;
    const nodes: ConstellationNode[] = [{
        id: 'center',
        label: 'You Now',
        kind: 'center',
        x: 50,
        y: 50,
        size: 88,
        count: entries.length,
        previewEntries: [...entries]
            .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
            .slice(0, ENTRY_PREVIEW_COUNT)
            .map(buildEntryPreview),
    }];
    const links: ConstellationLink[] = [];

    candidates.forEach((candidate, index) => {
        const angle = (Math.PI * 2 * index) / Math.max(total, 1);
        const radius = candidate.kind === 'mood'
            ? 23
            : candidate.kind === 'theme'
                ? 30
                : candidate.kind === 'skill'
                    ? 36
                    : 41;

        nodes.push({
            id: candidate.id,
            label: candidate.label,
            kind: candidate.kind,
            x: 50 + Math.cos(angle) * radius,
            y: 50 + Math.sin(angle) * radius,
            size: 48 + Math.min(candidate.count * 8, 24),
            count: candidate.count,
            previewEntries: candidate.previewEntries,
        });
        links.push({
            sourceId: 'center',
            targetId: candidate.id,
        });
    });

    const dominantTheme = candidates.find((candidate) => candidate.kind === 'theme' || candidate.kind === 'skill');
    const dominantMood = candidates.find((candidate) => candidate.kind === 'mood');

    return {
        headline: dominantTheme && dominantMood
            ? `Your recent story orbits around ${dominantTheme.label.toLowerCase()} with a ${dominantMood.label.toLowerCase()} tone.`
            : dominantTheme
                ? `Your recent story orbits around ${dominantTheme.label.toLowerCase()}.`
                : 'Your recent entries are beginning to form a meaning graph.',
        nodes,
        links,
    };
};

const deriveLifeSeasons = (entries: TimelineSignatureEntry[]): TimelineLifeSeason[] => {
    if (entries.length === 0) return [];

    const sorted = [...entries].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
    const clusters: TimelineSignatureEntry[][] = [];
    let currentCluster: TimelineSignatureEntry[] = [sorted[0]];

    for (let index = 1; index < sorted.length; index += 1) {
        const entry = sorted[index];
        const previous = currentCluster[currentCluster.length - 1];
        const gap = dayDiff(previous.createdAt, entry.createdAt);
        const span = dayDiff(currentCluster[0].createdAt, entry.createdAt);

        if (gap > SEASON_GAP_DAYS || span > SEASON_SPAN_DAYS) {
            clusters.push(currentCluster);
            currentCluster = [entry];
            continue;
        }

        currentCluster.push(entry);
    }

    if (currentCluster.length > 0) {
        clusters.push(currentCluster);
    }

    return clusters
        .map((cluster, index) => {
            const sortedCluster = [...cluster].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
            const startDate = sortedCluster[0].createdAt;
            const endDate = sortedCluster[sortedCluster.length - 1].createdAt;
            const topThemes = getTopThemes(sortedCluster);
            const dominantMood = getDominantMood(sortedCluster);
            const title = buildSeasonTitle(sortedCluster, topThemes, dominantMood);
            const topThemeLabel = topThemes[0] ? getReadableTheme(topThemes[0]) : null;

            return {
                id: `season-${index + 1}-${formatMonthKey(endDate)}`,
                title,
                summary: topThemeLabel
                    ? `${sortedCluster.length} entries shaped by ${topThemeLabel.toLowerCase()} between ${formatDate(startDate)} and ${formatDate(endDate)}.`
                    : `${sortedCluster.length} entries between ${formatDate(startDate)} and ${formatDate(endDate)}.`,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                entryCount: sortedCluster.length,
                dominantMood,
                topThemes,
            } satisfies TimelineLifeSeason;
        })
        .sort((left, right) => toTime(right.endDate) - toTime(left.endDate))
        .slice(0, MAX_SEASONS);
};

export const buildTimelineSignatureSummary = (entries: TimelineSignatureEntry[]): TimelineSignatureSummary => {
    if (entries.length === 0) {
        return {
            totalEntries: 0,
            activeDays: 0,
            importedCount: 0,
            startDate: null,
            endDate: null,
            seasons: [],
            storyArc: null,
            constellation: buildConstellationModel([]),
        };
    }

    const sorted = [...entries].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    const uniqueDays = new Set(sorted.map((entry) => entry.createdAt.toISOString().slice(0, 10)));

    return {
        totalEntries: sorted.length,
        activeDays: uniqueDays.size,
        importedCount: sorted.filter((entry) => entry.source !== 'NOTIVE').length,
        startDate: sorted[sorted.length - 1]?.createdAt.toISOString() || null,
        endDate: sorted[0]?.createdAt.toISOString() || null,
        seasons: deriveLifeSeasons(sorted),
        storyArc: buildTimelineStoryArc(sorted),
        constellation: buildConstellationModel(sorted),
    };
};
