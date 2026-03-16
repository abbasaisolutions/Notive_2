'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import ConstellationView from '@/components/timeline/ConstellationView';
import TimelineView from '@/components/timeline/TimelineView';
import { NOTIVE_VOICE } from '@/content/notive-voice';
import { ActionBar, TagPill } from '@/components/ui/surface';
import useApi from '@/hooks/use-api';
import { API_URL } from '@/constants/config';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import useTelemetry from '@/hooks/use-telemetry';
import { getMoodEmoji } from '@/constants/moods';
import { FiArchive, FiCalendar, FiChevronDown, FiClock, FiDownload, FiSearch, FiSliders } from 'react-icons/fi';
import { appendReturnTo, buildCurrentReturnTo, buildSearchString } from '@/utils/navigation';
import {
    buildSeasonAnchorMap,
    EMPTY_TIMELINE_SIGNATURE_SUMMARY,
    getSeasonAnchorMonthKey,
    type TimelineLifeSeason,
    type TimelineSignatureSummary,
    type TimelineStoryArcMoment,
} from '@/utils/timeline-signature';
import {
    consumePendingTimelineContext,
    markTimelineContextPending,
    type TimelineContextSnapshot,
} from '@/utils/timeline-context';
import { buildTimelineMonthGroups, buildTimelineMonthKey } from '@/utils/timeline-groups';
import { writeWorkspaceResume } from '@/utils/workspace-resume';

interface Entry {
    id: string;
    title: string | null;
    content: string;
    mood: string | null;
    source?: 'NOTIVE' | 'INSTAGRAM' | 'FACEBOOK';
    category?: 'PERSONAL' | 'PROFESSIONAL';
    lifeArea?: string | null;
    tags?: string[];
    createdAt: string;
    coverImage?: string | null;
    skills?: string[];
    lessons?: string[];
}

const formatTimelineDate = (value: string) => new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
});

type SourceFilter = 'all' | 'notive' | 'instagram' | 'facebook';
type TimelineSurface = 'timeline' | 'constellation';
type TimelineFilterState = {
    query: string;
    sourceFilter: SourceFilter;
    lifeAreaFilter: string;
    themeFilter: string;
    moodFilter: string;
    dateFilter: string;
    startDateFilter: string;
    endDateFilter: string;
    weekdayFilter: string;
    dayPartFilter: string;
};
type TimelineFilterPreset = {
    id: string;
    label: string;
    query: string;
    sourceFilter: SourceFilter;
    lifeAreaFilter: string;
    themeFilter: string;
    moodFilter: string;
    dateFilter: string;
    startDateFilter: string;
    endDateFilter: string;
    weekdayFilter: string;
    dayPartFilter: string;
    savedAt: number;
};

const TIMELINE_PAGE_SIZE = 30;
const TIMELINE_RECENT_PRESETS_KEY = 'notive_timeline_recent_presets_v1';
const MAX_TIMELINE_PRESETS = 4;
const SOURCE_FILTER_OPTIONS: Array<{ key: SourceFilter; label: string }> = [
    { key: 'all', label: 'All Sources' },
    { key: 'notive', label: 'Notive' },
    { key: 'instagram', label: 'Instagram' },
    { key: 'facebook', label: 'Facebook' },
];
const WEEKDAY_FILTER_OPTIONS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const DAY_PART_FILTER_OPTIONS = ['Morning', 'Afternoon', 'Evening', 'Late night'] as const;
const DAY_PART_FILTER_ALIASES: Record<string, string> = {
    morning: 'Morning',
    afternoon: 'Afternoon',
    evening: 'Evening',
    night: 'Late night',
    'late night': 'Late night',
    'late-night': 'Late night',
};
const getSourceFilterTabId = (filter: SourceFilter): string => `timeline-source-filter-${filter}`;

const normalizeSourceFilter = (value: string | null): SourceFilter => {
    if (value === 'notive' || value === 'instagram' || value === 'facebook') return value;
    return 'all';
};

const normalizeLifeAreaFilter = (value: string | null): string => {
    const normalized = (value || '').trim();
    return normalized ? normalized : 'all';
};
const normalizeThemeFilter = (value: string | null): string => {
    const normalized = (value || '').replace(/^#+/, '').trim();
    return normalized;
};
const normalizeMoodFilter = (value: string | null): string => {
    const normalized = (value || '').trim().toLowerCase();
    return normalized;
};
const normalizeDateFilter = (value: string | null): string => {
    const normalized = (value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
};
const normalizeDateRangeFilter = (input: {
    startDate: string | null;
    endDate: string | null;
}) => {
    const normalizedStart = normalizeDateFilter(input.startDate);
    const normalizedEnd = normalizeDateFilter(input.endDate);

    if (!normalizedStart || !normalizedEnd) {
        return {
            startDate: normalizedStart,
            endDate: normalizedEnd,
        };
    }

    return normalizedStart <= normalizedEnd
        ? { startDate: normalizedStart, endDate: normalizedEnd }
        : { startDate: normalizedEnd, endDate: normalizedStart };
};
const normalizeWeekdayFilter = (value: string | null): string => {
    const normalized = (value || '').trim().toLowerCase();
    if (!normalized) return '';
    return WEEKDAY_FILTER_OPTIONS.find((day) => day.toLowerCase() === normalized) || '';
};
const normalizeDayPartFilter = (value: string | null): string => {
    const normalized = (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!normalized) return '';
    return DAY_PART_FILTER_ALIASES[normalized] || '';
};

const normalizeTimelineSurface = (value: string | null): TimelineSurface =>
    value === 'constellation' ? 'constellation' : 'timeline';

const canUseLocalStorage = () => typeof window !== 'undefined' && !!window.localStorage;

const buildTimelinePresetId = (
    filters: TimelineFilterState
) => [
    filters.query.trim().toLowerCase(),
    filters.sourceFilter,
    filters.lifeAreaFilter,
    filters.themeFilter.trim().toLowerCase(),
    filters.moodFilter.trim().toLowerCase(),
    filters.dateFilter,
    filters.startDateFilter,
    filters.endDateFilter,
    filters.weekdayFilter.trim().toLowerCase(),
    filters.dayPartFilter.trim().toLowerCase(),
].join('|');

const buildTimelinePresetLabel = (
    filters: TimelineFilterState
) => {
    const parts: string[] = [];
    const sourceLabel = SOURCE_FILTER_OPTIONS.find((item) => item.key === filters.sourceFilter)?.label;

    if (filters.sourceFilter !== 'all' && sourceLabel) {
        parts.push(sourceLabel);
    }

    if (filters.lifeAreaFilter !== 'all') {
        parts.push(filters.lifeAreaFilter);
    }

    if (filters.themeFilter.trim()) {
        parts.push(`Topic: ${filters.themeFilter.trim()}`);
    }

    if (filters.moodFilter.trim()) {
        parts.push(`Feeling: ${filters.moodFilter.trim()}`);
    }

    if (filters.dateFilter) {
        parts.push(`Date: ${filters.dateFilter}`);
    }

    if (filters.startDateFilter || filters.endDateFilter) {
        const left = filters.startDateFilter || '...';
        const right = filters.endDateFilter || '...';
        parts.push(`Range: ${left} to ${right}`);
    }

    if (filters.weekdayFilter.trim()) {
        parts.push(`Weekday: ${filters.weekdayFilter.trim()}`);
    }

    if (filters.dayPartFilter.trim()) {
        parts.push(`Time: ${filters.dayPartFilter.trim()}`);
    }

    if (filters.query.trim()) {
        parts.push(`"${filters.query.trim()}"`);
    }

    return parts.join(' • ');
};

const loadRecentTimelinePresets = (): TimelineFilterPreset[] => {
    if (!canUseLocalStorage()) return [];

    const raw = window.localStorage.getItem(TIMELINE_RECENT_PRESETS_KEY);
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw) as TimelineFilterPreset[];
        if (!Array.isArray(parsed)) return [];
        return parsed.map((preset) => {
            const normalizedRange = normalizeDateRangeFilter({
                startDate: typeof preset?.startDateFilter === 'string' ? preset.startDateFilter : null,
                endDate: typeof preset?.endDateFilter === 'string' ? preset.endDateFilter : null,
            });

            return {
                ...preset,
                query: typeof preset?.query === 'string' ? preset.query : '',
                sourceFilter: normalizeSourceFilter(typeof preset?.sourceFilter === 'string' ? preset.sourceFilter : null),
                lifeAreaFilter: normalizeLifeAreaFilter(typeof preset?.lifeAreaFilter === 'string' ? preset.lifeAreaFilter : null),
                themeFilter: normalizeThemeFilter(typeof preset?.themeFilter === 'string' ? preset.themeFilter : null),
                moodFilter: normalizeMoodFilter(typeof preset?.moodFilter === 'string' ? preset.moodFilter : null),
                dateFilter: normalizeDateFilter(typeof preset?.dateFilter === 'string' ? preset.dateFilter : null),
                startDateFilter: normalizedRange.startDate,
                endDateFilter: normalizedRange.endDate,
                weekdayFilter: normalizeWeekdayFilter(typeof preset?.weekdayFilter === 'string' ? preset.weekdayFilter : null),
                dayPartFilter: normalizeDayPartFilter(typeof preset?.dayPartFilter === 'string' ? preset.dayPartFilter : null),
                savedAt: Number.isFinite(Number(preset?.savedAt)) ? Number(preset.savedAt) : Date.now(),
            };
        });
    } catch (error) {
        console.error('Failed to parse recent timeline presets', error);
        return [];
    }
};

const saveRecentTimelinePresets = (presets: TimelineFilterPreset[]) => {
    if (!canUseLocalStorage()) return;
    window.localStorage.setItem(TIMELINE_RECENT_PRESETS_KEY, JSON.stringify(presets));
};

const mergeUniqueEntries = (existing: Entry[], incoming: Entry[]): Entry[] => {
    if (incoming.length === 0) return existing;
    const seenIds = new Set(existing.map((entry) => entry.id));
    const merged = [...existing];
    incoming.forEach((entry) => {
        if (seenIds.has(entry.id)) return;
        seenIds.add(entry.id);
        merged.push(entry);
    });
    return merged;
};

type TimelineSeasonCard = TimelineLifeSeason & {
    anchorMonthKey: string;
    anchorId: string;
    isLoaded: boolean;
};

function StoryArcMomentCard({
    label,
    moment,
    currentReturnTo,
}: {
    label: string;
    moment: TimelineStoryArcMoment;
    currentReturnTo: string;
}) {
    return (
        <Link
            href={appendReturnTo(`/entry/view?id=${moment.id}`, currentReturnTo)}
            className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4 transition-colors hover:border-white/15 hover:bg-white/[0.05]"
        >
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">{label}</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-ink-secondary">
                <span>{formatTimelineDate(moment.createdAt)}</span>
                {moment.mood && (
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-white">
                        {getMoodEmoji(moment.mood)} {moment.mood}
                    </span>
                )}
            </div>
            <h3 className="mt-3 text-base font-semibold text-white">{moment.title || 'Untitled note'}</h3>
            <p className="mt-2 line-clamp-4 text-sm leading-7 text-ink-secondary">{moment.contentSnippet}</p>
            {moment.themes.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                    {moment.themes.map((theme) => (
                        <TagPill key={`${moment.id}-${theme}`}>{theme}</TagPill>
                    ))}
                </div>
            )}
        </Link>
    );
}

function TimelinePageContent() {
    const { user, isLoading: authLoading, isAuthenticated } = useAuthRedirect();
    const { apiFetch } = useApi();
    const { trackEvent } = useTelemetry();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [entries, setEntries] = useState<Entry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [nextPage, setNextPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [totalEntries, setTotalEntries] = useState(0);
    const [query, setQuery] = useState(() => searchParams.get('q') || '');
    const [debouncedQuery, setDebouncedQuery] = useState(() => searchParams.get('q') || '');
    const [sourceFilter, setSourceFilter] = useState<SourceFilter>(
        normalizeSourceFilter(searchParams.get('source'))
    );
    const [lifeAreaFilter, setLifeAreaFilter] = useState<string>(
        normalizeLifeAreaFilter(searchParams.get('lifeArea'))
    );
    const [themeFilter, setThemeFilter] = useState<string>(
        normalizeThemeFilter(searchParams.get('theme'))
    );
    const [moodFilter, setMoodFilter] = useState<string>(
        normalizeMoodFilter(searchParams.get('mood'))
    );
    const [dateFilter, setDateFilter] = useState<string>(
        normalizeDateFilter(searchParams.get('date'))
    );
    const [startDateFilter, setStartDateFilter] = useState<string>(
        normalizeDateRangeFilter({
            startDate: searchParams.get('startDate'),
            endDate: searchParams.get('endDate'),
        }).startDate
    );
    const [endDateFilter, setEndDateFilter] = useState<string>(
        normalizeDateRangeFilter({
            startDate: searchParams.get('startDate'),
            endDate: searchParams.get('endDate'),
        }).endDate
    );
    const [weekdayFilter, setWeekdayFilter] = useState<string>(
        normalizeWeekdayFilter(searchParams.get('weekday'))
    );
    const [dayPartFilter, setDayPartFilter] = useState<string>(
        normalizeDayPartFilter(searchParams.get('dayPart'))
    );
    const [surface, setSurface] = useState<TimelineSurface>(
        normalizeTimelineSurface(searchParams.get('view'))
    );
    const [lifeAreaOptions, setLifeAreaOptions] = useState<string[]>([]);
    const [timelineSummary, setTimelineSummary] = useState<TimelineSignatureSummary>(EMPTY_TIMELINE_SIGNATURE_SUMMARY);
    const [isMobileTimelineRailVisible, setIsMobileTimelineRailVisible] = useState(false);
    const [mobileScrollDirection, setMobileScrollDirection] = useState<'up' | 'down'>('up');
    const [activeMonthLabel, setActiveMonthLabel] = useState<string | null>(null);
    const [pendingRestore, setPendingRestore] = useState<TimelineContextSnapshot | null>(null);
    const [recentFilterPresets, setRecentFilterPresets] = useState<TimelineFilterPreset[]>([]);
    const [isFilterStudioOpen, setIsFilterStudioOpen] = useState(false);
    const restoreInitRef = useRef(false);
    const entriesRef = useRef<Entry[]>([]);
    const hasMoreRef = useRef(false);
    const nextPageRef = useRef(1);
    const currentReturnTo = useMemo(
        () => buildCurrentReturnTo(pathname, buildSearchString(searchParams)),
        [pathname, searchParams]
    );
    const currentFilters = useMemo<TimelineFilterState>(() => ({
        query,
        sourceFilter,
        lifeAreaFilter,
        themeFilter,
        moodFilter,
        dateFilter,
        startDateFilter,
        endDateFilter,
        weekdayFilter,
        dayPartFilter,
    }), [dateFilter, dayPartFilter, endDateFilter, lifeAreaFilter, moodFilter, query, sourceFilter, startDateFilter, themeFilter, weekdayFilter]);
    const visibleEntries = entries;
    const timelineMonthGroups = useMemo(() => buildTimelineMonthGroups(visibleEntries), [visibleEntries]);
    const activeMonth = useMemo(
        () => timelineMonthGroups.find((group) => group.label === activeMonthLabel) ?? timelineMonthGroups[0] ?? null,
        [activeMonthLabel, timelineMonthGroups]
    );
    const timelineYearGroups = useMemo(() => {
        const years = new Map<string, { year: string; anchorId: string }>();
        timelineMonthGroups.forEach((group) => {
            if (!years.has(group.year)) {
                years.set(group.year, { year: group.year, anchorId: group.anchorId });
            }
        });
        return Array.from(years.values());
    }, [timelineMonthGroups]);
    const lifeSeasons = timelineSummary.seasons;
    const seasonAnchorsByMonthKey = useMemo(() => buildSeasonAnchorMap(lifeSeasons), [lifeSeasons]);
    const lifeSeasonCards = useMemo(() => (
        lifeSeasons
            .map((season) => {
                const anchorMonthKey = getSeasonAnchorMonthKey(season);
                const anchorGroup = timelineMonthGroups.find((group) => group.key === anchorMonthKey);
                return {
                    ...season,
                    anchorMonthKey,
                    anchorId: anchorGroup?.anchorId || `timeline-month-${anchorMonthKey}`,
                    isLoaded: Boolean(anchorGroup),
                };
            })
            .filter((season): season is TimelineSeasonCard => Boolean(season))
    ), [lifeSeasons, timelineMonthGroups]);

    const buildTimelineFilterParams = useCallback(() => {
        const params = new URLSearchParams();

        if (debouncedQuery) {
            params.set('search', debouncedQuery);
        }

        if (sourceFilter !== 'all') {
            params.set('source', sourceFilter);
        }

        if (lifeAreaFilter !== 'all') {
            params.set('lifeArea', lifeAreaFilter);
        }

        if (themeFilter.trim()) {
            params.set('theme', themeFilter.trim());
        }

        if (moodFilter.trim()) {
            params.set('mood', moodFilter.trim());
        }

        if (dateFilter) {
            params.set('date', dateFilter);
        }

        if (startDateFilter) {
            params.set('startDate', startDateFilter);
        }

        if (endDateFilter) {
            params.set('endDate', endDateFilter);
        }

        if (weekdayFilter.trim()) {
            params.set('weekday', weekdayFilter.trim());
        }

        if (dayPartFilter.trim()) {
            params.set('dayPart', dayPartFilter.trim());
        }

        return params;
    }, [dateFilter, dayPartFilter, debouncedQuery, endDateFilter, lifeAreaFilter, moodFilter, sourceFilter, startDateFilter, themeFilter, weekdayFilter]);

    const fetchTimelineSummary = useCallback(async (signal?: AbortSignal) => {
        const params = buildTimelineFilterParams();
        const queryString = params.toString();
        const response = await apiFetch(
            `${API_URL}/analytics/timeline-summary${queryString ? `?${queryString}` : ''}`,
            { signal }
        );
        if (!response.ok) {
            throw new Error('Failed to fetch timeline summary');
        }

        const data = await response.json();
        setTimelineSummary((data?.summary || EMPTY_TIMELINE_SIGNATURE_SUMMARY) as TimelineSignatureSummary);
    }, [apiFetch, buildTimelineFilterParams]);

    const fetchEntriesPage = useCallback(async ({
        page,
        replace,
        signal,
    }: {
        page: number;
        replace: boolean;
        signal?: AbortSignal;
    }) => {
        const params = buildTimelineFilterParams();
        params.set('page', String(page));
        params.set('limit', String(TIMELINE_PAGE_SIZE));

        const response = await apiFetch(`${API_URL}/entries?${params.toString()}`, {
            signal,
        });
        if (!response.ok) {
            throw new Error('Failed to fetch timeline entries');
        }

        const data = await response.json();
        const batch = Array.isArray(data?.entries) ? (data.entries as Entry[]) : [];
        const pagination = data?.pagination || {};
        const resolvedPage = Number.isFinite(Number(pagination.page)) ? Number(pagination.page) : page;
        const resolvedTotalPages = Number.isFinite(Number(pagination.totalPages))
            ? Number(pagination.totalPages)
            : resolvedPage;
        const resolvedTotal = Number.isFinite(Number(pagination.total))
            ? Number(pagination.total)
            : null;
        const resolvedLifeAreas = Array.isArray(data?.facets?.lifeAreas)
            ? data.facets.lifeAreas.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
            : [];
        const resolvedHasMore = resolvedPage < resolvedTotalPages;
        const resolvedNextPage = resolvedPage + 1;
        let mergedEntries: Entry[] = [];

        setEntries((prev) => {
            mergedEntries = replace ? batch : mergeUniqueEntries(prev, batch);
            entriesRef.current = mergedEntries;
            if (resolvedTotal === null) {
                setTotalEntries(mergedEntries.length);
            }
            return mergedEntries;
        });
        if (resolvedTotal !== null) {
            setTotalEntries(resolvedTotal);
        }
        setLifeAreaOptions(resolvedLifeAreas);
        hasMoreRef.current = resolvedHasMore;
        nextPageRef.current = resolvedNextPage;
        setHasMore(resolvedHasMore);
        setNextPage(resolvedNextPage);

        return {
            mergedEntries,
            hasMore: resolvedHasMore,
            nextPage: resolvedNextPage,
        };
    }, [apiFetch, buildTimelineFilterParams]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedQuery(query.trim());
        }, 300);

        return () => window.clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        const controller = new AbortController();
        let mounted = true;

        const fetchInitialEntries = async () => {
            setIsLoading(true);
            setLoadError(null);
            setIsLoadingMore(false);
            hasMoreRef.current = false;
            nextPageRef.current = 1;
            entriesRef.current = [];
            setHasMore(false);
            setNextPage(1);
            setTotalEntries(0);
            setEntries([]);
            setLifeAreaOptions([]);
            setTimelineSummary(EMPTY_TIMELINE_SIGNATURE_SUMMARY);
            try {
                await Promise.all([
                    fetchEntriesPage({ page: 1, replace: true, signal: controller.signal }),
                    fetchTimelineSummary(controller.signal),
                ]);
            } catch (error) {
                if (controller.signal.aborted) return;
                console.error('Failed to fetch timeline data:', error);
                if (mounted) {
                    setLoadError('Failed to load timeline data.');
                }
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        if (user) fetchInitialEntries();

        return () => {
            mounted = false;
            controller.abort();
        };
    }, [fetchEntriesPage, fetchTimelineSummary, user]);

    useEffect(() => {
        setSourceFilter(normalizeSourceFilter(searchParams.get('source')));
        setQuery(searchParams.get('q') || '');
        setLifeAreaFilter(normalizeLifeAreaFilter(searchParams.get('lifeArea')));
        setThemeFilter(normalizeThemeFilter(searchParams.get('theme')));
        setMoodFilter(normalizeMoodFilter(searchParams.get('mood')));
        setDateFilter(normalizeDateFilter(searchParams.get('date')));
        const normalizedRange = normalizeDateRangeFilter({
            startDate: searchParams.get('startDate'),
            endDate: searchParams.get('endDate'),
        });
        setStartDateFilter(normalizedRange.startDate);
        setEndDateFilter(normalizedRange.endDate);
        setWeekdayFilter(normalizeWeekdayFilter(searchParams.get('weekday')));
        setDayPartFilter(normalizeDayPartFilter(searchParams.get('dayPart')));
        setSurface(normalizeTimelineSurface(searchParams.get('view')));
    }, [searchParams]);

    useEffect(() => {
        if (restoreInitRef.current) return;
        restoreInitRef.current = true;
        setPendingRestore(consumePendingTimelineContext(currentReturnTo));
    }, [currentReturnTo]);

    useEffect(() => {
        setRecentFilterPresets(loadRecentTimelinePresets());
    }, []);

    useEffect(() => {
        if (authLoading || !isAuthenticated) return;

        const summaryTotal = timelineSummary.totalEntries || totalEntries;
        const summary = activeMonthLabel
            ? `${activeMonthLabel} · ${summaryTotal} entr${summaryTotal === 1 ? 'y' : 'ies'}`
            : summaryTotal > 0
                ? `${summaryTotal} entr${summaryTotal === 1 ? 'y' : 'ies'}`
                : 'Return to your timeline';

        writeWorkspaceResume({
            key: 'timeline',
            title: NOTIVE_VOICE.surfaces.memoryAtlas,
            summary: surface === 'constellation' ? `Constellation view · ${summary}` : summary,
            href: currentReturnTo,
            updatedAt: new Date().toISOString(),
            stage: 'capture',
            actionLabel: `Resume ${NOTIVE_VOICE.surfaces.memoryAtlas.toLowerCase()}`,
        });
    }, [activeMonthLabel, authLoading, currentReturnTo, isAuthenticated, surface, timelineSummary.totalEntries, totalEntries]);

    useEffect(() => {
        const normalizedQuery = debouncedQuery.trim();
        const hasActiveFilters = normalizedQuery.length > 0
            || sourceFilter !== 'all'
            || lifeAreaFilter !== 'all'
            || themeFilter.trim().length > 0
            || moodFilter.trim().length > 0
            || Boolean(dateFilter)
            || Boolean(startDateFilter)
            || Boolean(endDateFilter)
            || weekdayFilter.trim().length > 0
            || dayPartFilter.trim().length > 0;
        if (!hasActiveFilters) return;

        const nextPreset: TimelineFilterPreset = {
            id: buildTimelinePresetId({
                query: normalizedQuery,
                sourceFilter,
                lifeAreaFilter,
                themeFilter,
                moodFilter,
                dateFilter,
                startDateFilter,
                endDateFilter,
                weekdayFilter,
                dayPartFilter,
            }),
            label: buildTimelinePresetLabel({
                query: normalizedQuery,
                sourceFilter,
                lifeAreaFilter,
                themeFilter,
                moodFilter,
                dateFilter,
                startDateFilter,
                endDateFilter,
                weekdayFilter,
                dayPartFilter,
            }),
            query: normalizedQuery,
            sourceFilter,
            lifeAreaFilter,
            themeFilter,
            moodFilter,
            dateFilter,
            startDateFilter,
            endDateFilter,
            weekdayFilter,
            dayPartFilter,
            savedAt: Date.now(),
        };

        setRecentFilterPresets((prev) => {
            const next = [nextPreset, ...prev.filter((preset) => preset.id !== nextPreset.id)].slice(0, MAX_TIMELINE_PRESETS);
            saveRecentTimelinePresets(next);
            return next;
        });
    }, [dateFilter, dayPartFilter, debouncedQuery, endDateFilter, lifeAreaFilter, moodFilter, sourceFilter, startDateFilter, themeFilter, weekdayFilter]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        let lastScrollY = window.scrollY;
        let animationFrameId = 0;

        const updateScrollState = () => {
            const nextScrollY = window.scrollY;
            const delta = nextScrollY - lastScrollY;

            if (Math.abs(delta) > 6) {
                setMobileScrollDirection(delta > 0 ? 'down' : 'up');
            }

            setIsMobileTimelineRailVisible(nextScrollY > 180);
            lastScrollY = nextScrollY;
            animationFrameId = 0;
        };

        const scheduleScrollStateUpdate = () => {
            if (animationFrameId) return;
            animationFrameId = window.requestAnimationFrame(updateScrollState);
        };

        updateScrollState();
        window.addEventListener('scroll', scheduleScrollStateUpdate, { passive: true });
        window.addEventListener('resize', scheduleScrollStateUpdate);

        return () => {
            window.removeEventListener('scroll', scheduleScrollStateUpdate);
            window.removeEventListener('resize', scheduleScrollStateUpdate);
            if (animationFrameId) {
                window.cancelAnimationFrame(animationFrameId);
            }
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        let animationFrameId = 0;

        const updateActiveMonth = () => {
            const monthAnchors = Array.from(
                document.querySelectorAll<HTMLElement>('[data-timeline-month-anchor]')
            );

            if (monthAnchors.length === 0) {
                setActiveMonthLabel(null);
                animationFrameId = 0;
                return;
            }

            let currentLabel = monthAnchors[0].dataset.timelineMonthAnchor || null;
            for (const anchor of monthAnchors) {
                if (anchor.getBoundingClientRect().top <= 132) {
                    currentLabel = anchor.dataset.timelineMonthAnchor || currentLabel;
                    continue;
                }
                break;
            }

            setActiveMonthLabel(currentLabel);
            animationFrameId = 0;
        };

        const scheduleActiveMonthUpdate = () => {
            if (animationFrameId) return;
            animationFrameId = window.requestAnimationFrame(updateActiveMonth);
        };

        updateActiveMonth();
        window.addEventListener('scroll', scheduleActiveMonthUpdate, { passive: true });
        window.addEventListener('resize', scheduleActiveMonthUpdate);

        return () => {
            window.removeEventListener('scroll', scheduleActiveMonthUpdate);
            window.removeEventListener('resize', scheduleActiveMonthUpdate);
            if (animationFrameId) {
                window.cancelAnimationFrame(animationFrameId);
            }
        };
    }, [visibleEntries]);

    useEffect(() => {
        if (typeof document === 'undefined') return;

        const captureTimelineContext = () => {
            markTimelineContextPending({
                href: currentReturnTo,
                scrollY: window.scrollY,
                activeMonthLabel,
                loadedEntryCount: visibleEntries.length,
            });
        };

        const handleDocumentClick = (event: MouseEvent) => {
            if (event.defaultPrevented || event.button !== 0) return;
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

            const target = event.target;
            if (!(target instanceof Element)) return;

            const anchor = target.closest('a[href]');
            if (!anchor) return;
            if (anchor.getAttribute('target') === '_blank' || anchor.hasAttribute('download')) return;

            const href = anchor.getAttribute('href');
            if (!href) return;

            const destination = new URL(href, window.location.origin);
            const current = new URL(window.location.href);
            if (destination.origin !== current.origin) return;
            if (destination.pathname === current.pathname && destination.search === current.search) return;

            captureTimelineContext();
        };

        document.addEventListener('click', handleDocumentClick, true);
        return () => {
            document.removeEventListener('click', handleDocumentClick, true);
        };
    }, [activeMonthLabel, currentReturnTo, visibleEntries.length]);

    const applyTimelineFilters = useCallback((
        nextFilters: TimelineFilterState,
        options?: { instantSearch?: boolean }
    ) => {
        const normalizedQuery = nextFilters.query.trim();
        const normalizedTheme = normalizeThemeFilter(nextFilters.themeFilter);
        const normalizedMood = normalizeMoodFilter(nextFilters.moodFilter);
        const normalizedDate = normalizeDateFilter(nextFilters.dateFilter);
        const normalizedDateRange = normalizeDateRangeFilter({
            startDate: nextFilters.startDateFilter,
            endDate: nextFilters.endDateFilter,
        });
        const normalizedWeekday = normalizeWeekdayFilter(nextFilters.weekdayFilter);
        const normalizedDayPart = normalizeDayPartFilter(nextFilters.dayPartFilter);
        setQuery(nextFilters.query);
        if (options?.instantSearch) {
            setDebouncedQuery(normalizedQuery);
        }
        setSourceFilter(nextFilters.sourceFilter);
        setLifeAreaFilter(nextFilters.lifeAreaFilter);
        setThemeFilter(normalizedTheme);
        setMoodFilter(normalizedMood);
        setDateFilter(normalizedDate);
        setStartDateFilter(normalizedDateRange.startDate);
        setEndDateFilter(normalizedDateRange.endDate);
        setWeekdayFilter(normalizedWeekday);
        setDayPartFilter(normalizedDayPart);

        const params = new URLSearchParams(searchParams.toString());
        if (!normalizedQuery) {
            params.delete('q');
        } else {
            params.set('q', normalizedQuery);
        }

        if (nextFilters.sourceFilter === 'all') {
            params.delete('source');
        } else {
            params.set('source', nextFilters.sourceFilter);
        }

        if (nextFilters.lifeAreaFilter === 'all') {
            params.delete('lifeArea');
        } else {
            params.set('lifeArea', nextFilters.lifeAreaFilter);
        }

        if (!normalizedTheme) {
            params.delete('theme');
        } else {
            params.set('theme', normalizedTheme);
        }

        if (!normalizedMood) {
            params.delete('mood');
        } else {
            params.set('mood', normalizedMood);
        }

        if (!normalizedDate) {
            params.delete('date');
        } else {
            params.set('date', normalizedDate);
        }

        if (!normalizedDateRange.startDate) {
            params.delete('startDate');
        } else {
            params.set('startDate', normalizedDateRange.startDate);
        }

        if (!normalizedDateRange.endDate) {
            params.delete('endDate');
        } else {
            params.set('endDate', normalizedDateRange.endDate);
        }

        if (!normalizedWeekday) {
            params.delete('weekday');
        } else {
            params.set('weekday', normalizedWeekday);
        }

        if (!normalizedDayPart) {
            params.delete('dayPart');
        } else {
            params.set('dayPart', normalizedDayPart);
        }

        const next = params.toString();
        router.replace(next ? `${pathname}?${next}` : pathname);
    }, [pathname, router, searchParams]);

    const updateQuery = (nextQuery: string) => {
        applyTimelineFilters({ ...currentFilters, query: nextQuery });
    };

    const updateSourceFilter = (nextFilter: SourceFilter) => {
        applyTimelineFilters({ ...currentFilters, sourceFilter: nextFilter }, { instantSearch: true });
    };

    const updateLifeAreaFilter = (nextFilter: string) => {
        applyTimelineFilters({ ...currentFilters, lifeAreaFilter: nextFilter }, { instantSearch: true });
    };

    const updateWeekdayFilter = (nextFilter: string) => {
        applyTimelineFilters({ ...currentFilters, weekdayFilter: nextFilter }, { instantSearch: true });
    };

    const updateDayPartFilter = (nextFilter: string) => {
        applyTimelineFilters({ ...currentFilters, dayPartFilter: nextFilter }, { instantSearch: true });
    };

    const updateStartDateFilter = (nextFilter: string) => {
        applyTimelineFilters({ ...currentFilters, startDateFilter: nextFilter }, { instantSearch: true });
    };

    const updateEndDateFilter = (nextFilter: string) => {
        applyTimelineFilters({ ...currentFilters, endDateFilter: nextFilter }, { instantSearch: true });
    };

    const clearAllFilters = () => {
        applyTimelineFilters({
            query: '',
            sourceFilter: 'all',
            lifeAreaFilter: 'all',
            themeFilter: '',
            moodFilter: '',
            dateFilter: '',
            startDateFilter: '',
            endDateFilter: '',
            weekdayFilter: '',
            dayPartFilter: '',
        }, { instantSearch: true });
    };

    const activeFilterChips = useMemo(() => {
        const chips: Array<{ key: string; label: string; onClear: () => void }> = [];

        if (query.trim()) {
            chips.push({
                key: 'query',
                label: `Search: ${query.trim()}`,
                onClear: () => updateQuery(''),
            });
        }

        if (sourceFilter !== 'all') {
            chips.push({
                key: 'source',
                label: SOURCE_FILTER_OPTIONS.find((item) => item.key === sourceFilter)?.label || sourceFilter,
                onClear: () => updateSourceFilter('all'),
            });
        }

        if (lifeAreaFilter !== 'all') {
            chips.push({
                key: 'life-area',
                label: lifeAreaFilter,
                onClear: () => updateLifeAreaFilter('all'),
            });
        }

        if (themeFilter.trim()) {
            chips.push({
                key: 'theme',
                label: `Topic: ${themeFilter.trim()}`,
                onClear: () => applyTimelineFilters({ ...currentFilters, themeFilter: '' }, { instantSearch: true }),
            });
        }

        if (moodFilter.trim()) {
            chips.push({
                key: 'mood',
                label: `Feeling: ${moodFilter.trim()}`,
                onClear: () => applyTimelineFilters({ ...currentFilters, moodFilter: '' }, { instantSearch: true }),
            });
        }

        if (dateFilter) {
            chips.push({
                key: 'date',
                label: `Date: ${dateFilter}`,
                onClear: () => applyTimelineFilters({ ...currentFilters, dateFilter: '' }, { instantSearch: true }),
            });
        }

        if (startDateFilter || endDateFilter) {
            chips.push({
                key: 'range',
                label: `Range: ${startDateFilter || '...'} to ${endDateFilter || '...'}`,
                onClear: () => applyTimelineFilters({
                    ...currentFilters,
                    startDateFilter: '',
                    endDateFilter: '',
                }, { instantSearch: true }),
            });
        }

        if (weekdayFilter.trim()) {
            chips.push({
                key: 'weekday',
                label: `Weekday: ${weekdayFilter.trim()}`,
                onClear: () => applyTimelineFilters({ ...currentFilters, weekdayFilter: '' }, { instantSearch: true }),
            });
        }

        if (dayPartFilter.trim()) {
            chips.push({
                key: 'day-part',
                label: `Time: ${dayPartFilter.trim()}`,
                onClear: () => applyTimelineFilters({ ...currentFilters, dayPartFilter: '' }, { instantSearch: true }),
            });
        }

        return chips;
    }, [
        applyTimelineFilters,
        currentFilters,
        dateFilter,
        dayPartFilter,
        endDateFilter,
        lifeAreaFilter,
        moodFilter,
        query,
        sourceFilter,
        startDateFilter,
        themeFilter,
        updateLifeAreaFilter,
        updateQuery,
        updateSourceFilter,
        weekdayFilter,
    ]);

    const collapsedFilterChips = isFilterStudioOpen ? activeFilterChips : activeFilterChips.slice(0, 4);
    const hiddenFilterChipCount = Math.max(0, activeFilterChips.length - collapsedFilterChips.length);

    const applyRecentPreset = (preset: TimelineFilterPreset) => {
        applyTimelineFilters({
            query: preset.query,
            sourceFilter: preset.sourceFilter,
            lifeAreaFilter: preset.lifeAreaFilter,
            themeFilter: preset.themeFilter,
            moodFilter: preset.moodFilter,
            dateFilter: preset.dateFilter,
            startDateFilter: preset.startDateFilter,
            endDateFilter: preset.endDateFilter,
            weekdayFilter: preset.weekdayFilter,
            dayPartFilter: preset.dayPartFilter,
        }, { instantSearch: true });
    };

    const switchSurface = (nextSurface: TimelineSurface) => {
        setSurface(nextSurface);
        if (nextSurface === 'constellation') {
            void trackEvent({
                eventType: 'constellation_opened',
                value: 'timeline',
                metadata: {
                    totalEntries: timelineSummary.totalEntries || totalEntries || visibleEntries.length,
                    loadedEntries: visibleEntries.length,
                    sourceFilter,
                    lifeAreaFilter,
                },
            });
        }
        const params = new URLSearchParams(searchParams.toString());
        if (nextSurface === 'timeline') {
            params.delete('view');
        } else {
            params.set('view', nextSurface);
        }

        const next = params.toString();
        router.replace(next ? `${pathname}?${next}` : pathname);
    };

    const ensureTimelineMonthLoaded = useCallback(async (monthKey: string) => {
        const monthLoaded = () => entriesRef.current.some((entry) => buildTimelineMonthKey(entry.createdAt) === monthKey);

        if (monthLoaded()) {
            return `timeline-month-${monthKey}`;
        }

        let currentHasMore = hasMoreRef.current;
        let pageToFetch = nextPageRef.current;

        while (!monthLoaded() && currentHasMore) {
            setIsLoadingMore(true);
            setLoadError(null);
            try {
                const result = await fetchEntriesPage({ page: pageToFetch, replace: false });
                currentHasMore = result.hasMore;
                pageToFetch = result.nextPage;
            } finally {
                setIsLoadingMore(false);
            }
        }

        return monthLoaded() ? `timeline-month-${monthKey}` : null;
    }, [fetchEntriesPage]);

    const jumpToTimelineMonth = useCallback((anchorId: string) => {
        const target = document.getElementById(anchorId);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    const handleSourceFilterKeyDown = (
        event: React.KeyboardEvent<HTMLButtonElement>,
        currentIndex: number
    ) => {
        let nextIndex: number | null = null;
        if (event.key === 'ArrowRight') {
            nextIndex = (currentIndex + 1) % SOURCE_FILTER_OPTIONS.length;
        } else if (event.key === 'ArrowLeft') {
            nextIndex = (currentIndex - 1 + SOURCE_FILTER_OPTIONS.length) % SOURCE_FILTER_OPTIONS.length;
        } else if (event.key === 'Home') {
            nextIndex = 0;
        } else if (event.key === 'End') {
            nextIndex = SOURCE_FILTER_OPTIONS.length - 1;
        }

        if (nextIndex === null) return;
        event.preventDefault();
        updateSourceFilter(SOURCE_FILTER_OPTIONS[nextIndex].key);
    };

    const loadMoreEntries = async () => {
        if (isLoadingMore || !hasMore) return;
        setIsLoadingMore(true);
        setLoadError(null);
        try {
            await fetchEntriesPage({ page: nextPage, replace: false });
        } catch (error) {
            console.error('Failed to load more entries:', error);
            setLoadError('Failed to load more memories. Please try again.');
        } finally {
            setIsLoadingMore(false);
        }
    };

    useEffect(() => {
        if (!pendingRestore || isLoading || isLoadingMore) return;

        if (visibleEntries.length < pendingRestore.loadedEntryCount && hasMore) {
            setIsLoadingMore(true);
            setLoadError(null);
            void fetchEntriesPage({ page: nextPage, replace: false })
                .catch((error) => {
                    console.error('Failed to restore timeline context:', error);
                    setLoadError('Failed to fully restore your previous timeline view.');
                })
                .finally(() => {
                    setIsLoadingMore(false);
                });
            return;
        }

        const targetScrollY = pendingRestore.scrollY;
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                window.scrollTo({ top: targetScrollY, behavior: 'auto' });
            });
        });
        setPendingRestore(null);
    }, [fetchEntriesPage, hasMore, isLoading, isLoadingMore, nextPage, pendingRestore, visibleEntries.length]);

    const timelineStats = useMemo(() => {
        const hasActiveFilters = query.trim().length > 0
            || sourceFilter !== 'all'
            || lifeAreaFilter !== 'all'
            || themeFilter.trim().length > 0
            || moodFilter.trim().length > 0
            || Boolean(dateFilter)
            || Boolean(startDateFilter)
            || Boolean(endDateFilter)
            || weekdayFilter.trim().length > 0
            || dayPartFilter.trim().length > 0;
        const visibleCount = visibleEntries.length;
        const total = timelineSummary.totalEntries || totalEntries || visibleCount;
        const first = timelineSummary.startDate ? new Date(timelineSummary.startDate) : (visibleCount > 0 ? new Date(visibleEntries[visibleCount - 1].createdAt) : null);
        const latest = timelineSummary.endDate ? new Date(timelineSummary.endDate) : (visibleCount > 0 ? new Date(visibleEntries[0].createdAt) : null);
        const fallbackActiveDays = new Set(visibleEntries.map((entry) => new Date(entry.createdAt).toDateString())).size;
        const fallbackImportedCount = visibleEntries.filter((entry) => entry.source && entry.source !== 'NOTIVE').length;
        const hasSummaryMetrics = timelineSummary.totalEntries > 0 || Boolean(timelineSummary.startDate) || Boolean(timelineSummary.endDate);
        const activeDays = hasSummaryMetrics ? timelineSummary.activeDays : fallbackActiveDays;
        const importedCount = hasSummaryMetrics ? timelineSummary.importedCount : fallbackImportedCount;

        return {
            total,
            hasActiveFilters,
            activeDays,
            importedCount,
            dateRange:
                first && latest
                    ? `${first.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })} - ${latest.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`
                    : 'No entries yet',
        };
    }, [dateFilter, dayPartFilter, endDateFilter, lifeAreaFilter, moodFilter, query, sourceFilter, startDateFilter, themeFilter, timelineSummary.activeDays, timelineSummary.endDate, timelineSummary.importedCount, timelineSummary.startDate, timelineSummary.totalEntries, totalEntries, visibleEntries, weekdayFilter]);
    const activeFilterSummary = useMemo(() => {
        const summary: string[] = [];
        const normalizedQuery = query.trim();
        const sourceLabel = SOURCE_FILTER_OPTIONS.find((item) => item.key === sourceFilter)?.label;

        if (sourceFilter !== 'all' && sourceLabel) {
            summary.push(sourceLabel);
        }

        if (lifeAreaFilter !== 'all') {
            summary.push(lifeAreaFilter);
        }

        if (themeFilter.trim()) {
            summary.push(`Topic: ${themeFilter.trim()}`);
        }

        if (moodFilter.trim()) {
            summary.push(`Feeling: ${moodFilter.trim()}`);
        }

        if (dateFilter) {
            summary.push(`Date: ${dateFilter}`);
        }

        if (startDateFilter || endDateFilter) {
            summary.push(`Range: ${startDateFilter || '...'} to ${endDateFilter || '...'}`);
        }

        if (weekdayFilter.trim()) {
            summary.push(`Weekday: ${weekdayFilter.trim()}`);
        }

        if (dayPartFilter.trim()) {
            summary.push(`Time: ${dayPartFilter.trim()}`);
        }

        if (normalizedQuery) {
            summary.push(`Search: "${normalizedQuery}"`);
        }

        if (summary.length === 0) {
            return 'All memories visible';
        }

        return summary.join(' • ');
    }, [dateFilter, dayPartFilter, endDateFilter, lifeAreaFilter, moodFilter, query, sourceFilter, startDateFilter, themeFilter, weekdayFilter]);
    const featuredSeason = useMemo(() => {
        if (lifeSeasonCards.length === 0) return null;
        return lifeSeasonCards.find((season) => season.anchorMonthKey === activeMonth?.key) || lifeSeasonCards[0];
    }, [activeMonth?.key, lifeSeasonCards]);
    const currentPresetId = useMemo(
        () => buildTimelinePresetId({
            query: debouncedQuery.trim(),
            sourceFilter,
            lifeAreaFilter,
            themeFilter,
            moodFilter,
            dateFilter,
            startDateFilter,
            endDateFilter,
            weekdayFilter,
            dayPartFilter,
        }),
        [dateFilter, dayPartFilter, debouncedQuery, endDateFilter, lifeAreaFilter, moodFilter, sourceFilter, startDateFilter, themeFilter, weekdayFilter]
    );
    const activeStoryArc = useMemo(
        () => ((startDateFilter || endDateFilter) ? timelineSummary.storyArc : null),
        [endDateFilter, startDateFilter, timelineSummary.storyArc]
    );
    const storyArcWriteHref = useMemo(() => (
        activeStoryArc
            ? appendReturnTo(`/entry/new?mode=quick&prompt=${encodeURIComponent(activeStoryArc.prompt)}`, currentReturnTo)
            : null
    ), [activeStoryArc, currentReturnTo]);

    const scrollToTop = () => {
        if (typeof window === 'undefined') return;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="min-h-screen px-4 md:px-8 py-6 md:py-10">
            <AnimatePresence>
                {isMobileTimelineRailVisible && visibleEntries.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -18 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -18 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        className="fixed inset-x-4 top-4 z-30 md:hidden"
                    >
                        <div className="glass-card rounded-[1.6rem] border-white/15 px-4 py-3 shadow-2xl shadow-black/25">
                            <div className="flex items-start gap-3">
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
                                        {mobileScrollDirection === 'up' ? 'Timeline Focus' : 'Keep Exploring'}
                                    </p>
                                    <div className="mt-1 flex items-center gap-2">
                                        <span className="truncate text-sm font-semibold text-white">
                                            {activeMonth?.label || timelineStats.dateRange}
                                        </span>
                                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-secondary">
                                            {visibleEntries.length}
                                        </span>
                                    </div>
                                    <AnimatePresence initial={false}>
                                        {mobileScrollDirection === 'up' && (
                                            <motion.p
                                                initial={{ opacity: 0, y: -4 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -4 }}
                                                transition={{ duration: 0.16, ease: 'easeOut' }}
                                                className="mt-1 truncate text-xs text-ink-secondary"
                                            >
                                                {activeFilterSummary}
                                            </motion.p>
                                        )}
                                    </AnimatePresence>
                                </div>
                                <button
                                    type="button"
                                    onClick={scrollToTop}
                                    className="rounded-full border border-primary/30 bg-primary/15 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary"
                                >
                                    Top
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="max-w-6xl mx-auto space-y-6">
                <header className="bento-box p-6 md:p-8">
                    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
                        <div>
                            <span className="section-kicker mb-3">{NOTIVE_VOICE.surfaces.memoryAtlas}</span>
                            <h1 className="text-3xl md:text-4xl font-serif text-white">Look back at your notes by time and topic</h1>
                            <p className="text-ink-secondary mt-2">Read moments in order or switch views when you want to see the bigger picture.</p>
                        </div>
                        <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(145px,1fr))] gap-3">
                            <div className="glass-card px-4 py-3 rounded-xl">
                                <p className="text-xs uppercase tracking-widest text-ink-muted mb-1 flex items-center gap-1">
                                    <FiArchive size={12} aria-hidden="true" /> Notes
                                </p>
                                <p className="text-xl font-semibold text-white">{timelineStats.total}</p>
                            </div>
                            <div className="glass-card px-4 py-3 rounded-xl">
                                <p className="text-xs uppercase tracking-widest text-ink-muted mb-1 flex items-center gap-1">
                                    <FiCalendar size={12} aria-hidden="true" /> Days
                                </p>
                                <p className="text-xl font-semibold text-white">{timelineStats.activeDays}</p>
                            </div>
                            <div className="glass-card px-4 py-3 rounded-xl">
                                <p className="text-xs uppercase tracking-widest text-ink-muted mb-1 flex items-center gap-1">
                                    <FiClock size={12} aria-hidden="true" /> Time
                                </p>
                                <p className="text-sm font-semibold text-white">{timelineStats.dateRange}</p>
                            </div>
                            <div className="glass-card px-4 py-3 rounded-xl">
                                <p className="text-xs uppercase tracking-widest text-ink-muted mb-1 flex items-center gap-1">
                                    <FiDownload size={12} aria-hidden="true" /> Imported
                                </p>
                                <p className="text-sm font-semibold text-white">{timelineStats.importedCount}</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <ActionBar className="overflow-x-auto border-white/10 bg-black/20">
                            <button
                                type="button"
                                onClick={() => switchSurface('timeline')}
                                aria-pressed={surface === 'timeline'}
                                className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                                    surface === 'timeline'
                                        ? 'bg-primary/15 text-primary'
                                        : 'text-ink-secondary hover:text-white'
                                }`}
                            >
                                List
                            </button>
                            <button
                                type="button"
                                onClick={() => switchSurface('constellation')}
                                aria-pressed={surface === 'constellation'}
                                className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                                    surface === 'constellation'
                                        ? 'bg-primary/15 text-primary'
                                        : 'text-ink-secondary hover:text-white'
                                }`}
                            >
                                Map
                            </button>
                            <span className="text-xs text-ink-secondary">
                                {surface === 'timeline'
                                    ? 'Read your notes in time order.'
                                    : 'See related notes grouped together.'}
                            </span>
                        </ActionBar>

                        {featuredSeason && (
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                                <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Current chapter</p>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-semibold text-white">{featuredSeason.title}</span>
                                    {featuredSeason.dominantMood && (
                                        <TagPill>{getMoodEmoji(featuredSeason.dominantMood)} {featuredSeason.dominantMood}</TagPill>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-5 grid md:grid-cols-[1fr_auto] gap-3 items-center">
                        <label className="relative block">
                            <span className="sr-only">Search memories</span>
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => updateQuery(e.target.value)}
                                placeholder="Search notes, topics, or tags"
                                className="w-full rounded-xl bg-surface-1/60 border border-white/15 px-4 py-3 text-white placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-primary/45"
                            />
                        </label>
                        <Link href={appendReturnTo('/entry/new?mode=quick', currentReturnTo)} className="primary-cta rounded-xl px-5 py-3 font-semibold text-center">
                            Write
                        </Link>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-secondary">
                        <span>
                            {timelineStats.hasActiveFilters
                                ? `Showing ${entries.length.toLocaleString()} of ${timelineStats.total.toLocaleString()} matching notes`
                                : `Showing ${entries.length.toLocaleString()} of ${timelineStats.total.toLocaleString()} notes`}
                        </span>
                    </div>
                    <div
                        className="mt-4 -mx-1 overflow-x-auto px-1 [scrollbar-width:none]"
                        style={{ msOverflowStyle: 'none' }}
                    >
                        <div
                            className="flex min-w-max items-center gap-2 pb-1 pr-3"
                            role="tablist"
                            aria-label="Filter timeline by source"
                        >
                            {SOURCE_FILTER_OPTIONS.map((item, index) => {
                                const active = sourceFilter === item.key;
                                return (
                                    <button
                                        key={item.key}
                                        id={getSourceFilterTabId(item.key)}
                                        type="button"
                                        role="tab"
                                        aria-selected={active}
                                        aria-controls="timeline-results-panel"
                                        tabIndex={active ? 0 : -1}
                                        onClick={() => updateSourceFilter(item.key)}
                                        onKeyDown={(event) => handleSourceFilterKeyDown(event, index)}
                                        className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.1em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/55 ${
                                            active
                                                ? 'border-primary/45 bg-primary/15 text-primary'
                                                : 'border-white/15 bg-white/[0.03] text-ink-secondary hover:text-white'
                                        }`}
                                    >
                                        {item.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="mt-4 rounded-[1.6rem] border border-white/10 bg-black/20 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center">
                                <button
                                    type="button"
                                    onClick={() => setIsFilterStudioOpen((prev) => !prev)}
                                    aria-expanded={isFilterStudioOpen}
                                    aria-controls="timeline-filter-studio"
                                    className="inline-flex items-center gap-2 self-start rounded-full border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-white/[0.08]"
                                >
                                    <FiSliders size={14} aria-hidden="true" />
                                    Filter Studio
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${activeFilterChips.length > 0 ? 'bg-primary/15 text-primary' : 'bg-white/[0.06] text-ink-secondary'}`}>
                                        {activeFilterChips.length > 0 ? `${activeFilterChips.length} active` : 'quiet'}
                                    </span>
                                    <FiChevronDown
                                        size={14}
                                        aria-hidden="true"
                                        className={`transition-transform ${isFilterStudioOpen ? 'rotate-180' : ''}`}
                                    />
                                </button>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
                                        {timelineStats.hasActiveFilters ? 'Current Slice' : 'Space Saver'}
                                    </p>
                                    <p className={`mt-1 text-sm text-ink-secondary ${isFilterStudioOpen ? '' : 'line-clamp-1'}`}>
                                        {timelineStats.hasActiveFilters
                                            ? activeFilterSummary
                                            : 'Keep memories open by default, then unfold this studio only when you want to narrow by life area, date window, weekday, or time of day.'}
                                    </p>
                                </div>
                            </div>
                            {timelineStats.hasActiveFilters && (
                                <button
                                    type="button"
                                    onClick={clearAllFilters}
                                    className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs uppercase tracking-[0.08em] text-ink-secondary hover:text-white"
                                >
                                    Reset All
                                </button>
                            )}
                        </div>

                        {activeFilterChips.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {collapsedFilterChips.map((chip) => (
                                    <button
                                        key={chip.key}
                                        type="button"
                                        onClick={chip.onClear}
                                        className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs uppercase tracking-[0.08em] text-white hover:bg-white/[0.08]"
                                    >
                                        {chip.label} ×
                                    </button>
                                ))}
                                {!isFilterStudioOpen && hiddenFilterChipCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setIsFilterStudioOpen(true)}
                                        className="rounded-full border border-dashed border-white/15 bg-transparent px-3 py-1.5 text-xs uppercase tracking-[0.08em] text-ink-secondary hover:text-white"
                                    >
                                        +{hiddenFilterChipCount} more
                                    </button>
                                )}
                            </div>
                        )}

                        <AnimatePresence initial={false}>
                            {isFilterStudioOpen && (
                                <motion.div
                                    id="timeline-filter-studio"
                                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                    animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                    transition={{ duration: 0.22, ease: 'easeOut' }}
                                    className="overflow-hidden"
                                >
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                                        <label className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">Life Area</span>
                                            <select
                                                value={lifeAreaFilter}
                                                onChange={(event) => updateLifeAreaFilter(event.target.value)}
                                                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/35"
                                            >
                                                <option value="all" className="bg-surface-1">All Areas</option>
                                                {lifeAreaOptions.map((area) => (
                                                    <option key={area} value={area} className="bg-surface-1">
                                                        {area}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        <label className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">From</span>
                                            <input
                                                type="date"
                                                value={startDateFilter}
                                                onChange={(event) => updateStartDateFilter(event.target.value)}
                                                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/35"
                                            />
                                        </label>

                                        <label className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">To</span>
                                            <input
                                                type="date"
                                                value={endDateFilter}
                                                onChange={(event) => updateEndDateFilter(event.target.value)}
                                                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/35"
                                            />
                                        </label>

                                        <label className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">Weekday</span>
                                            <select
                                                value={weekdayFilter}
                                                onChange={(event) => updateWeekdayFilter(event.target.value)}
                                                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/35"
                                            >
                                                <option value="" className="bg-surface-1">Any Day</option>
                                                {WEEKDAY_FILTER_OPTIONS.map((day) => (
                                                    <option key={day} value={day} className="bg-surface-1">
                                                        {day}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        <label className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">Time of Day</span>
                                            <select
                                                value={dayPartFilter}
                                                onChange={(event) => updateDayPartFilter(event.target.value)}
                                                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/35"
                                            >
                                                <option value="" className="bg-surface-1">Any Time</option>
                                                {DAY_PART_FILTER_OPTIONS.map((part) => (
                                                    <option key={part} value={part} className="bg-surface-1">
                                                        {part}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {activeStoryArc && (
                        <div className="mt-4 rounded-[1.8rem] border border-primary/20 bg-primary/[0.08] p-5 md:p-6">
                            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                                <div className="max-w-3xl">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Story Arc</p>
                                    <h2 className="mt-2 text-2xl font-semibold text-white">{activeStoryArc.title}</h2>
                                    <p className="mt-3 text-sm leading-7 text-ink-secondary">{activeStoryArc.summary}</p>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <TagPill tone="primary">{activeStoryArc.entryCount} notes</TagPill>
                                        <TagPill>{activeStoryArc.spanDays} days</TagPill>
                                        <TagPill>{activeStoryArc.moodShift.label}</TagPill>
                                    </div>
                                </div>
                                {storyArcWriteHref && (
                                    <Link
                                        href={storyArcWriteHref}
                                        className="inline-flex items-center justify-center rounded-xl border border-primary/30 bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
                                    >
                                        Write this stretch
                                    </Link>
                                )}
                            </div>

                            <div className={`mt-5 grid gap-3 ${activeStoryArc.turningPoint ? 'xl:grid-cols-3' : 'md:grid-cols-2'}`}>
                                <StoryArcMomentCard
                                    label="Start"
                                    moment={activeStoryArc.opening}
                                    currentReturnTo={currentReturnTo}
                                />
                                {activeStoryArc.turningPoint && (
                                    <StoryArcMomentCard
                                        label="Turn"
                                        moment={activeStoryArc.turningPoint}
                                        currentReturnTo={currentReturnTo}
                                    />
                                )}
                                <StoryArcMomentCard
                                    label="Now"
                                    moment={activeStoryArc.current}
                                    currentReturnTo={currentReturnTo}
                                />
                            </div>

                            <div className="mt-5 grid gap-4 md:grid-cols-2">
                                <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">What stayed with you</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {activeStoryArc.carriedThemes.length > 0 ? (
                                            activeStoryArc.carriedThemes.map((theme) => (
                                                <TagPill key={`carried-${theme}`}>{theme}</TagPill>
                                            ))
                                        ) : (
                                            <p className="text-sm leading-7 text-ink-secondary">No single topic stayed constant from start to now, which can also mean this was a real transition period.</p>
                                        )}
                                    </div>
                                </div>
                                <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">What changed</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {activeStoryArc.emergingThemes.length > 0 ? (
                                            activeStoryArc.emergingThemes.map((theme) => (
                                                <TagPill key={`emerging-${theme}`} tone="primary">{theme}</TagPill>
                                            ))
                                        ) : (
                                            <p className="text-sm leading-7 text-ink-secondary">The strongest change in this stretch is more about tone and timing than a brand new topic.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {recentFilterPresets.length > 0 && (
                        <div className="mt-4">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Recent searches</p>
                                <span className="text-xs text-ink-secondary">Tap once to bring back a recent search.</span>
                            </div>
                            <div className=" -mx-1 overflow-x-auto px-1 [scrollbar-width:none]" style={{ msOverflowStyle: 'none' }}>
                                <div className="flex min-w-max gap-2 pb-1 pr-3">
                                    {recentFilterPresets.map((preset) => {
                                        const isActivePreset = preset.id === currentPresetId;
                                        return (
                                            <button
                                                key={preset.id}
                                                type="button"
                                                onClick={() => applyRecentPreset(preset)}
                                                className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.08em] transition ${
                                                    isActivePreset
                                                        ? 'border-primary/40 bg-primary/15 text-primary'
                                                        : 'border-white/15 bg-white/[0.03] text-ink-secondary hover:text-white'
                                                }`}
                                            >
                                                {preset.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {lifeSeasonCards.length > 0 && (
                        <div className="mt-4">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Life chapters</p>
                                <span className="text-xs text-ink-secondary">Groups of related notes shaped by time, mood, and repeated topics.</span>
                            </div>
                            <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]" style={{ msOverflowStyle: 'none' }}>
                                <div className="flex min-w-max gap-3 pb-1 pr-3">
                                    {lifeSeasonCards.map((season) => (
                                        <button
                                            key={season.id}
                                            type="button"
                                            onClick={() => {
                                                void (async () => {
                                                    void trackEvent({
                                                        eventType: 'season_opened',
                                                        value: season.title,
                                                        metadata: {
                                                            entryCount: season.entryCount,
                                                            anchorMonthKey: season.anchorMonthKey,
                                                            loaded: season.isLoaded,
                                                        },
                                                    });
                                                    switchSurface('timeline');

                                                    try {
                                                        const anchorId = season.isLoaded
                                                            ? season.anchorId
                                                            : await ensureTimelineMonthLoaded(season.anchorMonthKey);

                                                        if (anchorId) {
                                                            jumpToTimelineMonth(anchorId);
                                                        } else {
                                                            setLoadError('That season is older than the entries currently loaded. Use Load More Memories and try again.');
                                                        }
                                                    } catch (error) {
                                                        console.error('Failed to load season anchor:', error);
                                                        setLoadError('Failed to load the selected season.');
                                                    }
                                                })();
                                            }}
                                            className="w-[260px] rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-4 text-left transition-colors hover:border-white/15 hover:bg-white/[0.05]"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Season</p>
                                                    <h2 className="mt-1 text-base font-semibold text-white">{season.title}</h2>
                                                </div>
                                                <TagPill tone="primary">{season.entryCount} entries</TagPill>
                                            </div>
                                            <p className="mt-3 text-sm leading-6 text-ink-secondary">{season.summary}</p>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {season.dominantMood && (
                                                    <TagPill>{getMoodEmoji(season.dominantMood)} {season.dominantMood}</TagPill>
                                                )}
                                                {season.topThemes.slice(0, 2).map((theme) => (
                                                    <TagPill key={theme}>#{theme}</TagPill>
                                                ))}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {timelineMonthGroups.length > 0 && (
                        <div className="mt-4 rounded-2xl border border-white/10 bg-surface-2/35 p-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Jump to a date</p>
                                    <p className="mt-1 text-sm text-ink-secondary">
                                        Jump to any loaded year or month without losing your search.
                                    </p>
                                </div>
                                <label className="flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-ink-muted">
                                    Jump to
                                    <select
                                        value={activeMonth?.anchorId || ''}
                                        onChange={(event) => jumpToTimelineMonth(event.target.value)}
                                        className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-primary/35"
                                    >
                                        {timelineMonthGroups.map((group) => (
                                            <option key={group.key} value={group.anchorId} className="bg-surface-1">
                                                {group.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            {timelineYearGroups.length > 1 && (
                                <div className="mt-3 -mx-1 overflow-x-auto px-1 [scrollbar-width:none]" style={{ msOverflowStyle: 'none' }}>
                                    <div className="flex min-w-max gap-2 pb-1 pr-3">
                                        {timelineYearGroups.map((group) => {
                                            const isActiveYear = group.year === activeMonth?.year;
                                            return (
                                                <button
                                                    key={group.year}
                                                    type="button"
                                                    onClick={() => jumpToTimelineMonth(group.anchorId)}
                                                    className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.08em] transition ${
                                                        isActiveYear
                                                            ? 'border-primary/40 bg-primary/15 text-primary'
                                                            : 'border-white/15 bg-white/[0.03] text-ink-secondary hover:text-white'
                                                    }`}
                                                >
                                                    {group.year}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="mt-3 -mx-1 overflow-x-auto px-1 [scrollbar-width:none]" style={{ msOverflowStyle: 'none' }}>
                                <div className="flex min-w-max gap-2 pb-1 pr-3">
                                    {timelineMonthGroups.map((group) => {
                                        const isActiveMonth = group.key === activeMonth?.key;
                                        return (
                                            <button
                                                key={group.key}
                                                type="button"
                                                onClick={() => jumpToTimelineMonth(group.anchorId)}
                                                className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.08em] transition ${
                                                    isActiveMonth
                                                        ? 'border-primary/40 bg-primary/15 text-primary'
                                                        : 'border-white/15 bg-white/[0.03] text-ink-secondary hover:text-white'
                                                }`}
                                            >
                                                {group.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </header>

                <section
                    id="timeline-results-panel"
                    role="tabpanel"
                    aria-label={surface === 'timeline' ? 'Timeline results' : 'Constellation results'}
                    className="space-y-4"
                >
                    {timelineStats.hasActiveFilters && visibleEntries.length === 0 ? (
                        <div className="bento-box p-8 text-center">
                            <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.03]">
                                <FiSearch size={24} className="text-ink-secondary" aria-hidden="true" />
                            </div>
                            <h2 className="text-xl text-white font-semibold mb-2">No notes found</h2>
                            <p className="text-sm text-ink-secondary mb-4">Try a broader keyword or use fewer filters.</p>
                            <button
                                type="button"
                                onClick={clearAllFilters}
                                className="px-4 py-2 rounded-xl border border-primary/35 bg-primary/15 text-primary text-sm font-semibold"
                            >
                                Clear Filters
                            </button>
                        </div>
                    ) : (
                        surface === 'timeline' ? (
                            <TimelineView
                                entries={visibleEntries}
                                seasonAnchorsByMonthKey={seasonAnchorsByMonthKey}
                            />
                        ) : (
                            <ConstellationView
                                model={timelineSummary.constellation}
                                totalEntries={timelineStats.total}
                                currentReturnTo={currentReturnTo}
                            />
                        )
                    )}

                    {loadError && (
                        <div className="rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-danger">
                            {loadError}
                        </div>
                    )}

                    {hasMore && (
                        <div className="bento-box p-5 text-center">
                            <p className="text-xs uppercase tracking-[0.1em] text-ink-muted mb-3">
                                Loaded {entries.length.toLocaleString()} of {Math.max(totalEntries, entries.length).toLocaleString()} notes
                            </p>
                            <button
                                type="button"
                                onClick={loadMoreEntries}
                                disabled={isLoadingMore}
                                className="px-4 py-2 rounded-xl border border-primary/35 bg-primary/15 text-primary text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {isLoadingMore ? 'Loading more...' : 'Load older notes'}
                            </button>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}

export default function TimelinePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        }>
            <TimelinePageContent />
        </Suspense>
    );
}


