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

export type TimelineSignatureSummary = {
    totalEntries: number;
    activeDays: number;
    importedCount: number;
    startDate: string | null;
    endDate: string | null;
    seasons: TimelineLifeSeason[];
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
        constellation: buildConstellationModel(sorted),
    };
};
