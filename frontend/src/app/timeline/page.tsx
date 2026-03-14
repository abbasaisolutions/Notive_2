'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import ConstellationView from '@/components/timeline/ConstellationView';
import TimelineView from '@/components/timeline/TimelineView';
import { ActionBar, TagPill } from '@/components/ui/surface';
import useApi from '@/hooks/use-api';
import { API_URL } from '@/constants/config';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import useTelemetry from '@/hooks/use-telemetry';
import { getMoodEmoji } from '@/constants/moods';
import { FiArchive, FiCalendar, FiClock, FiDownload, FiSearch } from 'react-icons/fi';
import { appendReturnTo, buildCurrentReturnTo, buildSearchString } from '@/utils/navigation';
import {
    buildSeasonAnchorMap,
    EMPTY_TIMELINE_SIGNATURE_SUMMARY,
    getSeasonAnchorMonthKey,
    type TimelineLifeSeason,
    type TimelineSignatureSummary,
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

type SourceFilter = 'all' | 'notive' | 'instagram' | 'facebook';
type TimelineSurface = 'timeline' | 'constellation';
type TimelineFilterPreset = {
    id: string;
    label: string;
    query: string;
    sourceFilter: SourceFilter;
    lifeAreaFilter: string;
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
const getSourceFilterTabId = (filter: SourceFilter): string => `timeline-source-filter-${filter}`;

const normalizeSourceFilter = (value: string | null): SourceFilter => {
    if (value === 'notive' || value === 'instagram' || value === 'facebook') return value;
    return 'all';
};

const normalizeLifeAreaFilter = (value: string | null): string => {
    const normalized = (value || '').trim();
    return normalized ? normalized : 'all';
};

const normalizeTimelineSurface = (value: string | null): TimelineSurface =>
    value === 'constellation' ? 'constellation' : 'timeline';

const canUseLocalStorage = () => typeof window !== 'undefined' && !!window.localStorage;

const buildTimelinePresetId = (
    query: string,
    sourceFilter: SourceFilter,
    lifeAreaFilter: string
) => `${query.trim().toLowerCase()}|${sourceFilter}|${lifeAreaFilter}`;

const buildTimelinePresetLabel = (
    query: string,
    sourceFilter: SourceFilter,
    lifeAreaFilter: string
) => {
    const parts: string[] = [];
    const sourceLabel = SOURCE_FILTER_OPTIONS.find((item) => item.key === sourceFilter)?.label;

    if (sourceFilter !== 'all' && sourceLabel) {
        parts.push(sourceLabel);
    }

    if (lifeAreaFilter !== 'all') {
        parts.push(lifeAreaFilter);
    }

    if (query.trim()) {
        parts.push(`"${query.trim()}"`);
    }

    return parts.join(' • ');
};

const loadRecentTimelinePresets = (): TimelineFilterPreset[] => {
    if (!canUseLocalStorage()) return [];

    const raw = window.localStorage.getItem(TIMELINE_RECENT_PRESETS_KEY);
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw) as TimelineFilterPreset[];
        return Array.isArray(parsed) ? parsed : [];
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
    const restoreInitRef = useRef(false);
    const entriesRef = useRef<Entry[]>([]);
    const hasMoreRef = useRef(false);
    const nextPageRef = useRef(1);
    const currentReturnTo = useMemo(
        () => buildCurrentReturnTo(pathname, buildSearchString(searchParams)),
        [pathname, searchParams]
    );
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

        return params;
    }, [debouncedQuery, lifeAreaFilter, sourceFilter]);

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
            title: 'Timeline',
            summary: surface === 'constellation' ? `Constellation view · ${summary}` : summary,
            href: currentReturnTo,
            updatedAt: new Date().toISOString(),
            stage: 'capture',
            actionLabel: 'Resume timeline',
        });
    }, [activeMonthLabel, authLoading, currentReturnTo, isAuthenticated, surface, timelineSummary.totalEntries, totalEntries]);

    useEffect(() => {
        const normalizedQuery = debouncedQuery.trim();
        const hasActiveFilters = normalizedQuery.length > 0 || sourceFilter !== 'all' || lifeAreaFilter !== 'all';
        if (!hasActiveFilters) return;

        const nextPreset: TimelineFilterPreset = {
            id: buildTimelinePresetId(normalizedQuery, sourceFilter, lifeAreaFilter),
            label: buildTimelinePresetLabel(normalizedQuery, sourceFilter, lifeAreaFilter),
            query: normalizedQuery,
            sourceFilter,
            lifeAreaFilter,
            savedAt: Date.now(),
        };

        setRecentFilterPresets((prev) => {
            const next = [nextPreset, ...prev.filter((preset) => preset.id !== nextPreset.id)].slice(0, MAX_TIMELINE_PRESETS);
            saveRecentTimelinePresets(next);
            return next;
        });
    }, [debouncedQuery, lifeAreaFilter, sourceFilter]);

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
        nextQuery: string,
        nextSourceFilter: SourceFilter,
        nextLifeAreaFilter: string,
        options?: { instantSearch?: boolean }
    ) => {
        const normalizedQuery = nextQuery.trim();
        setQuery(nextQuery);
        if (options?.instantSearch) {
            setDebouncedQuery(normalizedQuery);
        }
        setSourceFilter(nextSourceFilter);
        setLifeAreaFilter(nextLifeAreaFilter);

        const params = new URLSearchParams(searchParams.toString());
        if (!normalizedQuery) {
            params.delete('q');
        } else {
            params.set('q', normalizedQuery);
        }

        if (nextSourceFilter === 'all') {
            params.delete('source');
        } else {
            params.set('source', nextSourceFilter);
        }

        if (nextLifeAreaFilter === 'all') {
            params.delete('lifeArea');
        } else {
            params.set('lifeArea', nextLifeAreaFilter);
        }

        const next = params.toString();
        router.replace(next ? `${pathname}?${next}` : pathname);
    }, [pathname, router, searchParams]);

    const updateQuery = (nextQuery: string) => {
        applyTimelineFilters(nextQuery, sourceFilter, lifeAreaFilter);
    };

    const updateSourceFilter = (nextFilter: SourceFilter) => {
        applyTimelineFilters(query, nextFilter, lifeAreaFilter, { instantSearch: true });
    };

    const updateLifeAreaFilter = (nextFilter: string) => {
        applyTimelineFilters(query, sourceFilter, nextFilter, { instantSearch: true });
    };

    const clearAllFilters = () => {
        applyTimelineFilters('', 'all', 'all', { instantSearch: true });
    };

    const applyRecentPreset = (preset: TimelineFilterPreset) => {
        applyTimelineFilters(preset.query, preset.sourceFilter, preset.lifeAreaFilter, { instantSearch: true });
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
        const hasActiveFilters = query.trim().length > 0 || sourceFilter !== 'all' || lifeAreaFilter !== 'all';
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
    }, [lifeAreaFilter, query, sourceFilter, timelineSummary.activeDays, timelineSummary.endDate, timelineSummary.importedCount, timelineSummary.startDate, timelineSummary.totalEntries, totalEntries, visibleEntries]);
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

        if (normalizedQuery) {
            summary.push(`Search: "${normalizedQuery}"`);
        }

        if (summary.length === 0) {
            return 'All memories visible';
        }

        return summary.join(' • ');
    }, [lifeAreaFilter, query, sourceFilter]);
    const featuredSeason = useMemo(() => {
        if (lifeSeasonCards.length === 0) return null;
        return lifeSeasonCards.find((season) => season.anchorMonthKey === activeMonth?.key) || lifeSeasonCards[0];
    }, [activeMonth?.key, lifeSeasonCards]);
    const currentPresetId = useMemo(
        () => buildTimelinePresetId(debouncedQuery.trim(), sourceFilter, lifeAreaFilter),
        [debouncedQuery, lifeAreaFilter, sourceFilter]
    );

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
                            <span className="section-kicker mb-3">Memory Atlas</span>
                            <h1 className="text-3xl md:text-4xl font-serif text-white">Your Journey Timeline</h1>
                            <p className="text-ink-secondary mt-2">Scan your growth story by time, tags, and patterns.</p>
                        </div>
                        <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(145px,1fr))] gap-3">
                            <div className="glass-card px-4 py-3 rounded-xl">
                                <p className="text-xs uppercase tracking-widest text-ink-muted mb-1 flex items-center gap-1">
                                    <FiArchive size={12} aria-hidden="true" /> Memories
                                </p>
                                <p className="text-xl font-semibold text-white">{timelineStats.total}</p>
                            </div>
                            <div className="glass-card px-4 py-3 rounded-xl">
                                <p className="text-xs uppercase tracking-widest text-ink-muted mb-1 flex items-center gap-1">
                                    <FiCalendar size={12} aria-hidden="true" /> Active Days
                                </p>
                                <p className="text-xl font-semibold text-white">{timelineStats.activeDays}</p>
                            </div>
                            <div className="glass-card px-4 py-3 rounded-xl">
                                <p className="text-xs uppercase tracking-widest text-ink-muted mb-1 flex items-center gap-1">
                                    <FiClock size={12} aria-hidden="true" /> Range
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
                                Timeline
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
                                Constellation
                            </button>
                            <span className="text-xs text-ink-secondary">
                                {surface === 'timeline'
                                    ? 'Chronology first, meaning second.'
                                    : 'Meaning first, chronology still one tap away.'}
                            </span>
                        </ActionBar>

                        {featuredSeason && (
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                                <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Active season</p>
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
                                placeholder="Search title, text, or tags"
                                className="w-full rounded-xl bg-surface-1/60 border border-white/15 px-4 py-3 text-white placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-primary/45"
                            />
                        </label>
                        <Link href={appendReturnTo('/entry/new?mode=quick', currentReturnTo)} className="primary-cta rounded-xl px-5 py-3 font-semibold text-center">
                            Quick Capture
                        </Link>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-secondary">
                        <span>
                            {timelineStats.hasActiveFilters
                                ? `Showing ${entries.length.toLocaleString()} of ${timelineStats.total.toLocaleString()} matching memories`
                                : `Showing ${entries.length.toLocaleString()} of ${timelineStats.total.toLocaleString()} memories`}
                        </span>
                        {timelineStats.hasActiveFilters && (
                            <button
                                type="button"
                                onClick={clearAllFilters}
                                className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs uppercase tracking-[0.08em] text-ink-secondary hover:text-white"
                            >
                                Clear Filters
                            </button>
                        )}
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
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <label className="text-xs uppercase tracking-[0.1em] text-ink-muted">Life Area</label>
                        <select
                            value={lifeAreaFilter}
                            onChange={(event) => updateLifeAreaFilter(event.target.value)}
                            className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-primary/35"
                        >
                            <option value="all" className="bg-surface-1">All Areas</option>
                            {lifeAreaOptions.map((area) => (
                                <option key={area} value={area} className="bg-surface-1">
                                    {area}
                                </option>
                            ))}
                        </select>
                    </div>

                    {timelineStats.hasActiveFilters && (
                        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Active Filters</p>
                                    <p className="mt-1 text-sm text-ink-secondary">{activeFilterSummary}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={clearAllFilters}
                                    className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs uppercase tracking-[0.08em] text-ink-secondary hover:text-white"
                                >
                                    Clear All
                                </button>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {query.trim() && (
                                    <button
                                        type="button"
                                        onClick={() => updateQuery('')}
                                        className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs uppercase tracking-[0.08em] text-white hover:bg-white/[0.08]"
                                    >
                                        Search: {query.trim()} ×
                                    </button>
                                )}
                                {sourceFilter !== 'all' && (
                                    <button
                                        type="button"
                                        onClick={() => updateSourceFilter('all')}
                                        className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs uppercase tracking-[0.08em] text-white hover:bg-white/[0.08]"
                                    >
                                        {SOURCE_FILTER_OPTIONS.find((item) => item.key === sourceFilter)?.label} ×
                                    </button>
                                )}
                                {lifeAreaFilter !== 'all' && (
                                    <button
                                        type="button"
                                        onClick={() => updateLifeAreaFilter('all')}
                                        className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs uppercase tracking-[0.08em] text-white hover:bg-white/[0.08]"
                                    >
                                        {lifeAreaFilter} ×
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {recentFilterPresets.length > 0 && (
                        <div className="mt-4">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Recent Views</p>
                                <span className="text-xs text-ink-secondary">One tap to restore a recent search slice.</span>
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
                                <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Life Seasons</p>
                                <span className="text-xs text-ink-secondary">Clusters of related entries shaped by timing, mood, and recurring signals.</span>
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
                                    <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Jump Through Time</p>
                                    <p className="mt-1 text-sm text-ink-secondary">
                                        Jump to any loaded year or month without losing your current filters.
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
                            <h2 className="text-xl text-white font-semibold mb-2">No matching memories</h2>
                            <p className="text-sm text-ink-secondary mb-4">Try a shorter keyword or remove source and life-area filters.</p>
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
                                Loaded {entries.length.toLocaleString()} of {Math.max(totalEntries, entries.length).toLocaleString()} memories
                            </p>
                            <button
                                type="button"
                                onClick={loadMoreEntries}
                                disabled={isLoadingMore}
                                className="px-4 py-2 rounded-xl border border-primary/35 bg-primary/15 text-primary text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {isLoadingMore ? 'Loading more...' : 'Load More Memories'}
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


