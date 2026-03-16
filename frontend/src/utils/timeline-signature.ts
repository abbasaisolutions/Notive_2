import { buildTimelineMonthKey } from '@/utils/timeline-groups';

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

export const EMPTY_TIMELINE_SIGNATURE_SUMMARY: TimelineSignatureSummary = {
    totalEntries: 0,
    activeDays: 0,
    importedCount: 0,
    startDate: null,
    endDate: null,
    seasons: [],
    storyArc: null,
    constellation: {
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
    },
};

export const getSeasonAnchorMonthKey = (season: TimelineLifeSeason) => buildTimelineMonthKey(season.endDate);

export const buildSeasonAnchorMap = (seasons: TimelineLifeSeason[]) =>
    seasons.reduce<Record<string, {
        title: string;
        dominantMood: string | null;
        entryCount: number;
    }>>((map, season) => {
        map[getSeasonAnchorMonthKey(season)] = {
            title: season.title,
            dominantMood: season.dominantMood,
            entryCount: season.entryCount,
        };
        return map;
    }, {});
