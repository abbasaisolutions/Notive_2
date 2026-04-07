'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
const ConstellationView = dynamic(() => import('@/components/timeline/ConstellationView'), { ssr: false });
const TagCloud = dynamic(() => import('@/components/insights/TagCloud'));
import TimelineView from '@/components/timeline/TimelineView';
import ShareMemorySheet from '@/components/share/ShareMemorySheet';
import type { ShareableEntry } from '@/components/share/ShareMemorySheet';
import type { NotiveInsight } from '@/components/timeline/NotiveNoticedPanel';
import { NOTIVE_VOICE } from '@/content/notive-voice';
import { TagPill } from '@/components/ui/surface';
import { ErrorState, EmptyState, Spinner } from '@/components/ui';
import useApi from '@/hooks/use-api';
import { API_URL } from '@/constants/config';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import useTelemetry from '@/hooks/use-telemetry';
import { useToast } from '@/context/toast-context';
import { getMoodEmoji } from '@/constants/moods';
import { FiArrowLeft, FiChevronDown, FiSearch, FiSliders } from 'react-icons/fi';
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
    reflection?: string | null;
    notiveInsights?: NotiveInsight[] | null;
    analysisLine?: string;
    takeawayLine?: string;
    topEmotions?: { emotion: string; intensity: number }[];
    depthLevel?: 0 | 1 | 2 | 3 | 4;
    depthLabel?: string;
    growthRatio?: number | null;
}

const formatTimelineDate = (value: string) => new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
});

type SourceFilter = 'all' | 'notive' | 'instagram' | 'facebook';
type TimelineSurface = 'timeline' | 'constellation' | 'shared';
type QuickJumpMode = 'recent' | 'chapters' | 'dates';

type SharedBundle = {
    bundleId: string;
    sender: { id: string; name: string | null; avatarUrl: string | null };
    message: string | null;
    itemCount: number;
    firstItem: { title: string | null; contentPreview: string; mood: string | null } | null;
    readAt: string | null;
    reaction: string | null;
    sharedAt: string;
    status: 'PENDING' | 'ACCEPTED';
};
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
    value === 'constellation' ? 'constellation' : value === 'shared' ? 'shared' : 'timeline';

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
            className="workspace-soft-panel block rounded-[1.4rem] p-4 transition hover:opacity-95"
        >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">{label}</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-ink-secondary">
                <span>{formatTimelineDate(moment.createdAt)}</span>
                {moment.mood && (
                    <span className="workspace-pill-muted rounded-full px-2 py-0.5 text-xs uppercase tracking-[0.08em] text-[rgb(var(--text-primary))]">
                        {getMoodEmoji(moment.mood)} {moment.mood}
                    </span>
                )}
            </div>
            <h3 className="workspace-heading mt-3 text-base font-semibold">{moment.title || 'Untitled note'}</h3>
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

/* ─── Shared With Me list (inline) ─────────────────────── */

const MOOD_COLORS_SHARED: Record<string, string> = {
    happy: '#F59E0B', excited: '#EF4444', calm: '#6B8F71',
    thoughtful: '#6366F1', tired: '#94A3B8', sad: '#3B82F6',
    anxious: '#F97316', frustrated: '#DC2626', grateful: '#10B981',
    motivated: '#8B5CF6',
};

function SharedWithMeList({ bundles, loading, onRefresh }: {
    bundles: SharedBundle[];
    loading: boolean;
    onRefresh: () => Promise<void> | void;
}) {
    const { apiFetch } = useApi();
    const toast = useToast();
    const router = useRouter();
    const [activeSenderId, setActiveSenderId] = useState<string | null>(null);

    const respondToRequest = useCallback(async (senderId: string, decision: 'ACCEPT' | 'DECLINE') => {
        setActiveSenderId(senderId);
        try {
            const response = await apiFetch(`${API_URL}/memory-share/requests/${senderId}/respond`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ decision }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                toast.error(data.message || 'Couldn\u2019t update this share request. Try again?');
                setActiveSenderId(null);
                return;
            }

            toast.success(
                decision === 'ACCEPT' ? 'Share request accepted' : 'Share request denied',
                decision === 'ACCEPT'
                    ? 'The shared memories are ready in your Shared tab now.'
                    : 'That sender can no longer unlock memories for you until you allow it later.',
            );
            await onRefresh();
        } catch {
            toast.error('Couldn\u2019t complete that action. Try again?');
        }
        setActiveSenderId(null);
    }, [apiFetch, onRefresh, toast]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Spinner size="md" />
            </div>
        );
    }

    if (bundles.length === 0) {
        return (
            <EmptyState
                doodle="steady-me"
                doodleAccent="sage"
                title="Nothing shared yet"
                subtitle="When someone shares their memories with you, they will appear here."
            />
        );
    }

    return (
        <div className="space-y-3 py-4">
            {bundles.map((b) => {
                const senderName = b.sender.name || 'Someone';
                const initial = senderName.charAt(0).toUpperCase();
                const isPending = b.status === 'PENDING';
                const isUnread = isPending || !b.readAt;
                const relTime = formatSharedRelTime(b.sharedAt);
                const isActing = activeSenderId === b.sender.id;

                return (
                    <motion.div
                        key={b.bundleId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`block w-full rounded-2xl border p-4 text-left transition-colors ${
                            isUnread
                                ? 'border-[rgba(107,143,113,0.25)] bg-[rgba(107,143,113,0.04)]'
                                : 'border-[rgba(92,92,92,0.12)] bg-white/60 hover:bg-white/80'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(107,143,113,0.14)] text-sm font-bold text-[rgb(107,143,113)]">
                                {initial}
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    {isUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-[rgb(107,143,113)]" />}
                                    <span className="truncate text-[0.82rem] font-semibold text-[rgb(var(--paper-ink))]">
                                        {senderName}
                                    </span>
                                    {isPending && (
                                        <span className="shrink-0 rounded-full border border-[rgba(217,119,6,0.18)] bg-[rgba(245,158,11,0.08)] px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.08em] text-[rgb(180,83,9)]">
                                            Needs response
                                        </span>
                                    )}
                                    <span className="ml-auto shrink-0 text-[0.65rem] text-[rgb(130,130,130)]">{relTime}</span>
                                </div>
                                <p className="mt-0.5 text-[0.75rem] text-[rgb(130,130,130)]">
                                    {isPending
                                        ? `${senderName} wants to share ${b.itemCount} ${b.itemCount === 1 ? 'memory' : 'memories'}`
                                        : `${b.itemCount} ${b.itemCount === 1 ? 'memory' : 'memories'} shared`}
                                </p>
                            </div>
                        </div>
                        {!isPending && b.firstItem && (
                            <div className="mt-2 rounded-xl border border-[rgba(92,92,92,0.08)] bg-[rgba(248,244,237,0.5)] px-3 py-2">
                                <div className="flex items-center gap-1.5">
                                    {b.firstItem.mood && (
                                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: MOOD_COLORS_SHARED[b.firstItem.mood] || '#94A3B8' }} />
                                    )}
                                    <span className="truncate text-[0.72rem] font-medium text-[rgb(var(--paper-ink))]">
                                        {b.firstItem.title || 'Untitled'}
                                    </span>
                                </div>
                                <p className="mt-0.5 line-clamp-1 text-[0.68rem] text-[rgb(150,150,150)]">{b.firstItem.contentPreview}</p>
                                {b.itemCount > 1 && (
                                    <p className="mt-1 text-[0.65rem] font-medium text-[rgb(107,143,113)]">+{b.itemCount - 1} more</p>
                                )}
                            </div>
                        )}
                        {b.message && (
                            <p className="mt-2 line-clamp-2 text-[0.72rem] italic text-[rgb(130,130,130)]">&ldquo;{b.message}&rdquo;</p>
                        )}

                        {isPending ? (
                            <div className="mt-3 flex gap-2">
                                <button
                                    type="button"
                                    disabled={isActing}
                                    onClick={() => void respondToRequest(b.sender.id, 'DECLINE')}
                                    className="workspace-button-outline rounded-xl px-4 py-2 text-[0.72rem] font-semibold disabled:opacity-50"
                                >
                                    {isActing ? 'Saving...' : 'Deny'}
                                </button>
                                <button
                                    type="button"
                                    disabled={isActing}
                                    onClick={() => void respondToRequest(b.sender.id, 'ACCEPT')}
                                    className="workspace-button-primary rounded-xl px-4 py-2 text-[0.72rem] font-semibold disabled:opacity-50"
                                >
                                    {isActing ? 'Saving...' : 'Accept'}
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => router.push(`/shared/view?id=${b.bundleId}`)}
                                className="mt-3 inline-flex rounded-xl border border-[rgba(107,143,113,0.22)] bg-[rgba(107,143,113,0.06)] px-3 py-2 text-[0.72rem] font-semibold text-[rgb(107,143,113)] transition hover:bg-[rgba(107,143,113,0.1)]"
                            >
                                Open shared memories
                            </button>
                        )}
                    </motion.div>
                );
            })}
        </div>
    );
}

function formatSharedRelTime(dateString: string): string {
    const diff = Date.now() - new Date(dateString).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
    const [tagCounts, setTagCounts] = useState<Record<string, number>>({});
    const [timelineSummary, setTimelineSummary] = useState<TimelineSignatureSummary>(EMPTY_TIMELINE_SIGNATURE_SUMMARY);
    const [isMobileTimelineRailVisible, setIsMobileTimelineRailVisible] = useState(false);
    const [mobileScrollDirection, setMobileScrollDirection] = useState<'up' | 'down'>('up');
    const [activeMonthLabel, setActiveMonthLabel] = useState<string | null>(null);
    const [focusedEntryId, setFocusedEntryId] = useState<string | null>(null);
    const [pendingRestore, setPendingRestore] = useState<TimelineContextSnapshot | null>(null);
    const [recentFilterPresets, setRecentFilterPresets] = useState<TimelineFilterPreset[]>([]);
    const [isFilterStudioOpen, setIsFilterStudioOpen] = useState(false);
    const [isControlDeckOpen, setIsControlDeckOpen] = useState<boolean>(() => {
        const hasSource = normalizeSourceFilter(searchParams.get('source')) !== 'all';
        return Boolean(
            searchParams.get('q')
            || searchParams.get('lifeArea')
            || searchParams.get('theme')
            || searchParams.get('mood')
            || searchParams.get('date')
            || searchParams.get('startDate')
            || searchParams.get('endDate')
            || searchParams.get('weekday')
            || searchParams.get('dayPart')
            || hasSource
            || searchParams.get('view') === 'constellation'
        );
    });
    const [quickJumpMode, setQuickJumpMode] = useState<QuickJumpMode>('chapters');

    // ── Share state ──
    const [shareEntryId, setShareEntryId] = useState<string | null>(null);
    const [sharedBundles, setSharedBundles] = useState<SharedBundle[]>([]);
    const [sharedLoading, setSharedLoading] = useState(false);
    const [sharedUnreadCount, setSharedUnreadCount] = useState(0);

    const restoreInitRef = useRef(false);
    const entriesRef = useRef<Entry[]>([]);
    const hasMoreRef = useRef(false);
    const nextPageRef = useRef(1);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
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
    const hasTimelineFilters = query.trim().length > 0
        || sourceFilter !== 'all'
        || lifeAreaFilter !== 'all'
        || themeFilter.trim().length > 0
        || moodFilter.trim().length > 0
        || Boolean(dateFilter)
        || Boolean(startDateFilter)
        || Boolean(endDateFilter)
        || weekdayFilter.trim().length > 0
        || dayPartFilter.trim().length > 0;
    const visibleEntries = entries;
    const timelineMonthGroups = useMemo(() => buildTimelineMonthGroups(visibleEntries), [visibleEntries]);
    const activeMonth = useMemo(
        () => timelineMonthGroups.find((group) => group.label === activeMonthLabel) ?? timelineMonthGroups[0] ?? null,
        [activeMonthLabel, timelineMonthGroups]
    );
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
            throw new Error('Couldn\u2019t load your timeline summary.');
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
            throw new Error('Couldn\u2019t load your timeline entries.');
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
        const resolvedTagCounts = data?.facets?.tagCounts;
        if (resolvedTagCounts && typeof resolvedTagCounts === 'object' && !Array.isArray(resolvedTagCounts)) {
            setTagCounts(prev => {
                if (replace) return resolvedTagCounts as Record<string, number>;
                // Merge: use max count for each tag across pages
                const merged = { ...prev };
                for (const [tag, count] of Object.entries(resolvedTagCounts as Record<string, number>)) {
                    merged[tag] = Math.max(merged[tag] || 0, count);
                }
                return merged;
            });
        }
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

    /* Sync the q= URL param after the debounced query settles (prevents
       router.replace on every keystroke which steals focus on mobile). */
    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString());
        const current = params.get('q') || '';
        if (current === debouncedQuery) return;
        if (!debouncedQuery) { params.delete('q'); } else { params.set('q', debouncedQuery); }
        const next = params.toString();
        router.replace(next ? `${pathname}?${next}` : pathname);
    }, [debouncedQuery, pathname, router, searchParams]);

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
            setTagCounts({});
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
                    setLoadError('Couldn\u2019t load your timeline. Try refreshing.');
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

    // ── Scroll-based card focus highlight via IntersectionObserver ──
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const observer = new IntersectionObserver(
            (observerEntries) => {
                let bestId: string | null = null;
                let bestDistance = Infinity;
                const viewportCenter = window.innerHeight / 2;

                for (const oe of observerEntries) {
                    if (!oe.isIntersecting) continue;
                    const rect = oe.boundingClientRect;
                    const cardCenter = rect.top + rect.height / 2;
                    const distance = Math.abs(cardCenter - viewportCenter);
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        bestId = (oe.target as HTMLElement).dataset.entryId ?? null;
                    }
                }

                if (bestId) setFocusedEntryId(bestId);
            },
            { rootMargin: '-35% 0px -35% 0px', threshold: 0 }
        );

        const cards = document.querySelectorAll<HTMLElement>('[data-entry-id]');
        cards.forEach((card) => observer.observe(card));

        return () => observer.disconnect();
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
        /* q= URL param is synced via the debouncedQuery effect — skip it here
           to avoid router.replace on every keystroke which steals mobile focus. */

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
        setQuery(nextQuery);
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

    const collapsedFilterChips = isFilterStudioOpen ? activeFilterChips : activeFilterChips.slice(0, 3);
    const hiddenFilterChipCount = Math.max(0, activeFilterChips.length - collapsedFilterChips.length);
    const openControlDeck = useCallback((options?: { focusSearch?: boolean; source?: 'search' | 'tools' }) => {
        setIsControlDeckOpen(true);
        void trackEvent({
            eventType: 'timeline_controls_opened',
            value: options?.source || 'tools',
            metadata: {
                hasActiveFilters: hasTimelineFilters,
                surface,
                quickJumpMode,
            },
        });

        if (options?.focusSearch) {
            window.requestAnimationFrame(() => {
                searchInputRef.current?.focus();
            });
        }
    }, [hasTimelineFilters, quickJumpMode, surface, trackEvent]);
    const closeControlDeck = useCallback(() => {
        setIsControlDeckOpen(false);
        setIsFilterStudioOpen(false);
    }, []);
    const openFilterStudio = useCallback(() => {
        setIsControlDeckOpen(true);
        setIsFilterStudioOpen(true);
        void trackEvent({
            eventType: 'timeline_controls_opened',
            value: 'filters',
            metadata: {
                hasActiveFilters: hasTimelineFilters,
                surface,
            },
        });
    }, [hasTimelineFilters, surface, trackEvent]);

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

    // ── Shared bundles fetch ──
    const fetchSharedBundles = useCallback(async () => {
        setSharedLoading(true);
        try {
            const r = await apiFetch(`${API_URL}/memory-share/received?limit=20`);
            if (r.ok) {
                const data = await r.json();
                setSharedBundles(data.bundles ?? []);
                setSharedUnreadCount(data.unreadCount ?? 0);
            }
        } catch { /* ignore */ }
        setSharedLoading(false);
    }, [apiFetch]);

    useEffect(() => {
        if (surface === 'shared') fetchSharedBundles();
    }, [surface, fetchSharedBundles]);

    // Initial unread count (for badge)
    useEffect(() => {
        apiFetch(`${API_URL}/memory-share/received?limit=1`)
            .then(async (r) => { if (r.ok) { const d = await r.json(); setSharedUnreadCount(d.unreadCount ?? 0); } })
            .catch(() => {});
    }, [apiFetch]);

    const shareEntry = useMemo<ShareableEntry | null>(() => {
        if (!shareEntryId) return null;
        const e = entries.find((entry) => entry.id === shareEntryId);
        return e ? { id: e.id, title: e.title, content: e.content, mood: e.mood, createdAt: e.createdAt } : null;
    }, [shareEntryId, entries]);

    const shareAllEntries = useMemo<ShareableEntry[]>(
        () => entries.map((e) => ({ id: e.id, title: e.title, content: e.content, mood: e.mood, createdAt: e.createdAt })),
        [entries],
    );

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
    const openSeason = useCallback(async (season: TimelineSeasonCard) => {
        void trackEvent({
            eventType: 'season_opened',
            value: season.title,
            metadata: {
                entryCount: season.entryCount,
                anchorMonthKey: season.anchorMonthKey,
                loaded: season.isLoaded,
            },
        });
        setSurface('timeline');

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
            setLoadError('Couldn\u2019t load that season. Try again?');
        }
    }, [ensureTimelineMonthLoaded, jumpToTimelineMonth, trackEvent]);

    const loadMoreEntries = async () => {
        if (isLoadingMore || !hasMore) return;
        setIsLoadingMore(true);
        setLoadError(null);
        try {
            await fetchEntriesPage({ page: nextPage, replace: false });
        } catch (error) {
            console.error('Failed to load more entries:', error);
            setLoadError('Couldn\u2019t load more memories. Please try again.');
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
                    setLoadError('Couldn\u2019t fully restore your previous view. Try refreshing.');
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
            hasActiveFilters: hasTimelineFilters,
            activeDays,
            importedCount,
            dateRange:
                first && latest
                    ? `${first.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })} - ${latest.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`
                    : 'No entries yet',
        };
    }, [hasTimelineFilters, timelineSummary.activeDays, timelineSummary.endDate, timelineSummary.importedCount, timelineSummary.startDate, timelineSummary.totalEntries, totalEntries, visibleEntries]);
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
    const availableQuickJumpModes = useMemo(() => {
        const modes: QuickJumpMode[] = [];

        if (lifeSeasonCards.length > 0) {
            modes.push('chapters');
        }
        if (recentFilterPresets.length > 0) {
            modes.push('recent');
        }
        if (timelineMonthGroups.length > 0) {
            modes.push('dates');
        }

        return modes;
    }, [lifeSeasonCards.length, recentFilterPresets.length, timelineMonthGroups.length]);
    const activeQuickJumpMode = availableQuickJumpModes.includes(quickJumpMode)
        ? quickJumpMode
        : availableQuickJumpModes[0] ?? null;
    const archiveMetaSummary = useMemo(() => {
        const parts = [
            `${timelineStats.total} notes`,
            `${timelineStats.activeDays} days`,
            timelineStats.dateRange,
        ];

        if (timelineStats.importedCount > 0) {
            parts.push(`${timelineStats.importedCount} imported`);
        }

        return parts.join(' · ');
    }, [timelineStats.activeDays, timelineStats.dateRange, timelineStats.importedCount, timelineStats.total]);
    const activeStoryArc = useMemo(
        () => ((startDateFilter || endDateFilter) ? timelineSummary.storyArc : null),
        [endDateFilter, startDateFilter, timelineSummary.storyArc]
    );
    const storyArcWriteHref = useMemo(() => (
        activeStoryArc
            ? appendReturnTo(`/entry/new?mode=quick&prompt=${encodeURIComponent(activeStoryArc.prompt)}`, currentReturnTo)
            : null
    ), [activeStoryArc, currentReturnTo]);
    const timelineSearchLead = timelineStats.hasActiveFilters ? 'Refine this memory slice' : 'Find memories fast';
    const timelineSearchHint = timelineStats.hasActiveFilters
        ? activeFilterSummary
        : 'Start with search. Filters, map view, and jumps stay tucked away until you want them.';
    const quickJumpDescription = activeQuickJumpMode === 'chapters'
        ? 'Jump straight into the strongest season instead of scanning the full timeline.'
        : activeQuickJumpMode === 'recent'
            ? 'Bring back a search pattern you just used without rebuilding it.'
            : activeQuickJumpMode === 'dates'
                ? 'Drop into a loaded month instantly and keep the current search intact.'
                : '';

    const scrollToTop = () => {
        if (typeof window === 'undefined') return;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Spinner size="md" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="min-h-screen px-3 md:px-8 py-3 md:py-10">
            <AnimatePresence>
                {isMobileTimelineRailVisible && visibleEntries.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -18 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -18 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        className="fixed inset-x-4 top-4 z-30 md:hidden"
                    >
                        <div className="workspace-panel rounded-[1.6rem] px-4 py-3 shadow-xl">
                            <div className="flex items-start gap-3">
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">
                                        {mobileScrollDirection === 'up' ? 'Timeline Focus' : 'Keep Exploring'}
                                    </p>
                                    <div className="mt-1 flex items-center gap-2">
                                        <span className="workspace-heading truncate text-sm font-semibold">
                                            {activeMonth?.label || timelineStats.dateRange}
                                        </span>
                                        <span className="workspace-pill-muted rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-secondary">
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
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        scrollToTop();
                                        openControlDeck({ focusSearch: true, source: 'search' });
                                    }}
                                    className="workspace-button-outline rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em]"
                                >
                                    Search
                                </button>
                                <button
                                    type="button"
                                    onClick={scrollToTop}
                                    className="rounded-full border border-primary/30 bg-primary/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary"
                                >
                                    Top
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="max-w-6xl mx-auto space-y-3 md:space-y-6">
                <header className="space-y-2 md:space-y-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="workspace-button-outline inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition-all"
                                aria-label="Go back"
                            >
                                <FiArrowLeft size={18} aria-hidden="true" />
                            </button>
                            <p className="text-sm text-ink-secondary">
                                {archiveMetaSummary}
                            </p>
                        </div>
                    </div>

                    <div className="workspace-soft-panel rounded-[1.4rem] p-2 md:p-4">
                        {!isControlDeckOpen ? (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => openControlDeck({ focusSearch: true, source: 'search' })}
                                    className="workspace-muted-panel inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition hover:opacity-85"
                                    aria-label="Search memories"
                                >
                                    <FiSearch size={16} aria-hidden="true" className="text-ink-muted" />
                                </button>

                                <div className="flex flex-1 flex-wrap items-center gap-1.5 overflow-visible">
                                    <button
                                        type="button"
                                        aria-pressed={surface === 'constellation'}
                                        onClick={() => switchSurface('constellation')}
                                        className={`workspace-pill inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em] transition hover:opacity-85 ${
                                            surface === 'constellation' ? 'bg-primary/15 text-primary border-primary/30' : ''
                                        }`}
                                    >
                                        Map
                                    </button>
                                    <button
                                        type="button"
                                        aria-pressed={surface === 'shared'}
                                        onClick={() => switchSurface('shared')}
                                        className={`workspace-pill relative inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em] transition hover:opacity-85 ${
                                            surface === 'shared' ? 'bg-primary/15 text-primary border-primary/30' : ''
                                        }`}
                                    >
                                        Shared
                                        {sharedUnreadCount > 0 && surface !== 'shared' && (
                                            <span className="absolute -top-1 -right-1 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-[rgb(107,143,113)] px-0.5 text-[0.5rem] font-bold text-white">
                                                {sharedUnreadCount}
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        aria-pressed={activeFilterChips.length > 0}
                                        onClick={openFilterStudio}
                                        className="workspace-pill inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em] transition hover:opacity-85"
                                    >
                                        <FiSliders size={12} aria-hidden="true" />
                                        Filters
                                        {activeFilterChips.length > 0 && (
                                            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[0.6rem] text-primary">
                                                {activeFilterChips.length}
                                            </span>
                                        )}
                                    </button>
                                    {surface !== 'timeline' && (
                                        <button
                                            type="button"
                                            onClick={() => switchSurface('timeline')}
                                            className="workspace-pill inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em] transition hover:opacity-85"
                                        >
                                            Back to list
                                        </button>
                                    )}
                                    {timelineStats.hasActiveFilters && (
                                        <button
                                            type="button"
                                            onClick={clearAllFilters}
                                            className="workspace-pill rounded-full px-2 py-1.5 text-[0.65rem] uppercase tracking-[0.08em] text-ink-secondary transition hover:text-[rgb(var(--text-primary))]"
                                        >
                                            Reset
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-2">
                                    <label className="relative block flex-1 min-w-0">
                                        <FiSearch
                                            size={16}
                                            aria-hidden="true"
                                            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted"
                                        />
                                        <span className="sr-only">Search memories</span>
                                        <input
                                            ref={searchInputRef}
                                            type="text"
                                            value={query}
                                            onChange={(e) => updateQuery(e.target.value)}
                                            placeholder="Search notes, topics, or tags"
                                            className="workspace-input w-full rounded-[1.2rem] py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/45"
                                        />
                                    </label>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (isFilterStudioOpen) {
                                                closeControlDeck();
                                            } else {
                                                setIsFilterStudioOpen(true);
                                            }
                                        }}
                                        aria-expanded={isFilterStudioOpen}
                                        aria-controls="timeline-filter-studio"
                                        className="workspace-pill inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.1em] transition hover:opacity-85"
                                    >
                                        <FiSliders size={13} aria-hidden="true" />
                                        Filters
                                        {activeFilterChips.length > 0 && (
                                            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[0.6rem] text-primary">
                                                {activeFilterChips.length}
                                            </span>
                                        )}
                                        <FiChevronDown
                                            size={13}
                                            aria-hidden="true"
                                            className={`transition-transform ${isFilterStudioOpen ? 'rotate-180' : ''}`}
                                        />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={closeControlDeck}
                                        className="workspace-button-outline flex-shrink-0 rounded-full px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.1em]"
                                    >
                                        Close
                                    </button>
                                </div>

                                {/* Active filter chips */}
                                {timelineStats.hasActiveFilters && (
                                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                        {collapsedFilterChips.map((chip) => (
                                            <button
                                                key={chip.key}
                                                type="button"
                                                aria-label={`Clear filter: ${chip.label}`}
                                                onClick={chip.onClear}
                                                className="workspace-pill rounded-full px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.08em] transition hover:opacity-85"
                                            >
                                                {chip.label} ×
                                            </button>
                                        ))}
                                        {!isFilterStudioOpen && hiddenFilterChipCount > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setIsFilterStudioOpen(true)}
                                                className="workspace-button-outline rounded-full border-dashed px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.08em]"
                                            >
                                                +{hiddenFilterChipCount} more
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={clearAllFilters}
                                            className="workspace-pill rounded-full px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.08em] text-ink-secondary transition hover:text-[rgb(var(--text-primary))]"
                                        >
                                            Reset
                                        </button>
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
                                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                                                <label className="workspace-soft-panel rounded-xl p-2">
                                                    <span className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">Source</span>
                                                    <select
                                                        value={sourceFilter}
                                                        onChange={(event) => updateSourceFilter(event.target.value as SourceFilter)}
                                                        className="workspace-input mt-1 w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/35"
                                                    >
                                                        {SOURCE_FILTER_OPTIONS.map((item) => (
                                                            <option key={item.key} value={item.key} className="bg-surface-1">
                                                                {item.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>

                                                <label className="workspace-soft-panel rounded-xl p-2">
                                                    <span className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">Life Area</span>
                                                    <select
                                                        value={lifeAreaFilter}
                                                        onChange={(event) => updateLifeAreaFilter(event.target.value)}
                                                        className="workspace-input mt-1 w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/35"
                                                    >
                                                        <option value="all" className="bg-surface-1">All Areas</option>
                                                        {lifeAreaOptions.map((area) => (
                                                            <option key={area} value={area} className="bg-surface-1">
                                                                {area}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>

                                                <label className="workspace-soft-panel rounded-xl p-2">
                                                    <span className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">From</span>
                                                    <input
                                                        type="date"
                                                        value={startDateFilter}
                                                        onChange={(event) => updateStartDateFilter(event.target.value)}
                                                        className="workspace-input mt-1 w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/35"
                                                    />
                                                </label>

                                                <label className="workspace-soft-panel rounded-xl p-2">
                                                    <span className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">To</span>
                                                    <input
                                                        type="date"
                                                        value={endDateFilter}
                                                        onChange={(event) => updateEndDateFilter(event.target.value)}
                                                        className="workspace-input mt-1 w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/35"
                                                    />
                                                </label>

                                                <label className="workspace-soft-panel rounded-xl p-2">
                                                    <span className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">Weekday</span>
                                                    <select
                                                        value={weekdayFilter}
                                                        onChange={(event) => updateWeekdayFilter(event.target.value)}
                                                        className="workspace-input mt-1 w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/35"
                                                    >
                                                        <option value="" className="bg-surface-1">Any Day</option>
                                                        {WEEKDAY_FILTER_OPTIONS.map((day) => (
                                                            <option key={day} value={day} className="bg-surface-1">
                                                                {day}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>

                                                <label className="workspace-soft-panel rounded-xl p-2">
                                                    <span className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">Time of Day</span>
                                                    <select
                                                        value={dayPartFilter}
                                                        onChange={(event) => updateDayPartFilter(event.target.value)}
                                                        className="workspace-input mt-1 w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/35"
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
                            </>
                        )}
                    </div>

                    {isFilterStudioOpen && activeQuickJumpMode && (
                        <div className="workspace-soft-panel mt-2 rounded-[1.2rem] p-3">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
                                        Quick Jump
                                    </span>
                                    <p className="mt-2 text-xs text-ink-secondary">
                                        {quickJumpDescription}
                                    </p>
                                </div>
                                <label className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.1em] text-ink-muted">
                                    Jump by
                                    <select
                                        value={activeQuickJumpMode}
                                        onChange={(event) => setQuickJumpMode(event.target.value as QuickJumpMode)}
                                        className="workspace-input rounded-full px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/35"
                                    >
                                        {availableQuickJumpModes.map((mode) => (
                                            <option key={mode} value={mode} className="bg-surface-1">
                                                {mode === 'chapters' ? 'Chapters' : mode === 'recent' ? 'Recent searches' : 'Dates'}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                                    {activeQuickJumpMode === 'recent' && recentFilterPresets.length > 0 && (
                                        <label className="mt-3 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.1em] text-ink-muted">
                                            Recent search
                                            <select
                                                value={recentFilterPresets.some((preset) => preset.id === currentPresetId) ? currentPresetId : ''}
                                                onChange={(event) => {
                                                    const preset = recentFilterPresets.find((item) => item.id === event.target.value);
                                                    if (!preset) return;
                                                    applyRecentPreset(preset);
                                                }}
                                                className="workspace-input rounded-full px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/35"
                                            >
                                                <option value="" disabled className="bg-surface-1">Choose a recent search</option>
                                                {recentFilterPresets.map((preset) => (
                                                    <option key={preset.id} value={preset.id} className="bg-surface-1">
                                                        {preset.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    )}

                                    {activeQuickJumpMode === 'chapters' && lifeSeasonCards.length > 0 && (
                                        <label className="mt-3 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.1em] text-ink-muted">
                                            Chapter
                                            <select
                                                value={lifeSeasonCards.some((season) => season.anchorMonthKey === activeMonth?.key) ? activeMonth?.key || '' : ''}
                                                onChange={(event) => {
                                                    const season = lifeSeasonCards.find((item) => item.anchorMonthKey === event.target.value);
                                                    if (!season) return;
                                                    void openSeason(season);
                                                }}
                                                className="workspace-input rounded-full px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/35"
                                            >
                                                <option value="" disabled className="bg-surface-1">Choose a chapter</option>
                                                {lifeSeasonCards.map((season) => (
                                                    <option key={season.id} value={season.anchorMonthKey} className="bg-surface-1">
                                                        {season.title} ({season.entryCount})
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    )}

                                    {activeQuickJumpMode === 'dates' && timelineMonthGroups.length > 0 && (
                                        <label className="mt-3 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.1em] text-ink-muted">
                                            Jump to month
                                            <select
                                                value={activeMonth?.anchorId || ''}
                                                onChange={(event) => jumpToTimelineMonth(event.target.value)}
                                                className="workspace-input rounded-full px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/35"
                                            >
                                                {timelineMonthGroups.map((group) => (
                                                    <option key={group.key} value={group.anchorId} className="bg-surface-1">
                                                        {group.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    )}
                        </div>
                    )}

                    {activeStoryArc && (
                        <div className="mt-4 rounded-[1.8rem] border border-primary/20 bg-primary/[0.08] p-5 md:p-6">
                            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                                <div className="max-w-3xl">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Story Arc</p>
                                    <h2 className="workspace-heading mt-2 text-2xl font-semibold">{activeStoryArc.title}</h2>
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
                                        className="workspace-button-primary inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold"
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
                                <div className="workspace-panel rounded-[1.4rem] p-4">
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
                                <div className="workspace-panel rounded-[1.4rem] p-4">
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

                </header>

                {surface === 'timeline' && (
                    <div className="mt-2">
                        <TagCloud
                            selectedTag={themeFilter || null}
                            onSelectTag={(tag) => setThemeFilter(tag || '')}
                        />
                    </div>
                )}

                <section
                    id="timeline-results-panel"
                    role="tabpanel"
                    aria-label={surface === 'timeline' ? 'Timeline results' : 'Constellation results'}
                    className="space-y-4"
                >
                    {!timelineStats.hasActiveFilters && visibleEntries.length === 0 && !loadError ? (
                        <EmptyState
                            title="Your timeline is empty"
                            subtitle="Start writing — every note becomes part of your story."
                            doodle="pen"
                            doodleAccent="sage"
                            action={{ label: 'Write your first note', href: '/entry/new' }}
                        />
                    ) : timelineStats.hasActiveFilters && visibleEntries.length === 0 ? (
                        <EmptyState
                            icon={<FiSearch size={24} />}
                            title="No notes found"
                            subtitle="Try a broader keyword or use fewer filters."
                            action={{ label: 'Clear Filters', onClick: clearAllFilters }}
                        />
                    ) : (
                        surface === 'timeline' ? (
                            <>
                                <TimelineView
                                    entries={visibleEntries}
                                    tagCounts={tagCounts}
                                    seasonAnchorsByMonthKey={seasonAnchorsByMonthKey}
                                    onShareEntry={setShareEntryId}
                                    focusedEntryId={focusedEntryId}
                                />
                            </>
                        ) : surface === 'shared' ? (
                            <SharedWithMeList
                                bundles={sharedBundles}
                                loading={sharedLoading}
                                onRefresh={fetchSharedBundles}
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
                        <ErrorState
                            title="Couldn\u2019t Load Timeline"
                            message={loadError}
                            variant="compact"
                            action={{
                                label: "Try Again",
                                onClick: () => {
                                    setLoadError(null);
                                    void fetchEntriesPage({ page: 1, replace: true });
                                },
                            }}
                        />
                    )}

                    {hasMore && (
                        <div className="workspace-panel p-5 text-center">
                            <p className="text-xs uppercase tracking-[0.1em] text-ink-muted mb-3">
                                Loaded {entries.length.toLocaleString()} of {Math.max(totalEntries, entries.length).toLocaleString()} notes
                            </p>
                            <button
                                type="button"
                                onClick={loadMoreEntries}
                                disabled={isLoadingMore}
                                className="workspace-button-outline rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isLoadingMore ? 'Loading more...' : 'Load older notes'}
                            </button>
                        </div>
                    )}
                </section>
            </div>

            {/* ── Share Memory Sheet ── */}
            {shareEntry && (
                <ShareMemorySheet
                    initialEntry={shareEntry}
                    allEntries={shareAllEntries}
                    onClose={() => { setShareEntryId(null); fetchSharedBundles(); }}
                />
            )}
        </div>
    );
}

export default function TimelinePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <Spinner size="md" />
            </div>
        }>
            <TimelinePageContent />
        </Suspense>
    );
}
