/* FINAL DASHBOARD — capture-to-value notebook experience
   Zone 1 hero with sprout doodle, tight Zone 2 capture, minimal Zone 3 glance + sub-tabs.
   Matches logo + generated images exactly. Almost zero scrolling on mobile.
   The default hero starts from saved memories and what they can become. */
'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import ActionBriefPanel from '@/components/action/ActionBriefPanel';
import DailyCheckIn from '@/components/dashboard/DailyCheckIn';
import type { StudentActionBrief } from '@/components/action/types';
import DailyGentleReflectionCard from '@/components/dashboard/DailyGentleReflectionCard';
import { NotebookDoodle } from '@/components/dashboard/NotebookDoodles';
import { Surface } from '@/components/ui/surface';
import UserAvatar from '@/components/ui/UserAvatar';
import { NOTIVE_VOICE } from '@/content/notive-voice';
import type { GentleReflectionDraft } from '@/services/gentle-reflection.service';
import {
    getLifeBalanceRingFill,
    getLifeBalanceScoreLabel,
    getVisibleLifeBalanceAreas,
    LIFE_BALANCE_RING_CIRCUMFERENCE,
} from '@/components/dashboard/life-balance';
import { getMoodEmoji, getMoodScore, normalizeMood } from '@/constants/moods';
import DashboardTier1Simple from '@/components/dashboard/DashboardTier1Simple';

type DashboardAction = {
    label: string;
    href?: string;
    onClick?: () => void;
    type?: 'button';
    tone?: 'primary' | 'secondary';
};

type DashboardFocusConfig = {
    eyebrow: string;
    title: string;
    body: string;
    evidence?: string | null;
    evidenceFallback?: string | null;
    panels?: Array<{ label: string; value: string }>;
    primaryAction?: DashboardAction | null;
    secondaryAction?: DashboardAction | null;
};

type DashboardJournalIntel = {
    vocabulary: {
        totalUniqueWords: number;
        recentNewWords: string[];
        growthRate: number;
        richness?: number;
        rarityScore?: number;
        readingGradeLevel?: number;
    };
    lifeBalance: {
        dominantArea: string;
        neglectedArea: string | null;
        balanceScore: number;
        areas?: Array<{ area: string; score: number; entryCount: number; recentTrend?: 'up' | 'stable' | 'down' }>;
    };
    peopleMap: {
        people: Array<{
            name: string;
            count: number;
            sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
        }>;
        totalPeopleMentioned: number;
    };
    growthLanguage: {
        totalGrowthPhrases: number;
        recentTrend: 'increasing' | 'stable' | 'decreasing';
        mindsetRatio?: number;
        growthDensity?: number;
        topPhrases?: Array<{ phrase: string; count: number }>;
        fixedMindsetCount?: number;
        growthMindsetCount?: number;
    };
    emotionalRange?: {
        uniqueEmotions: number;
        emotionList: string[];
        rangeScore: number;
        dominantEmotion: string;
        rarestEmotion: string | null;
        emotionFrequency: Array<{ emotion: string; count: number; percentage: number }>;
        complexityScore: number;
    };
    gratitude: {
        totalExpressions: number;
        recentTrend: 'growing' | 'stable' | 'fading';
        depthScore?: number;
        streak?: number;
        avgPerWeek?: number;
    };
    selfTalk?: {
        growthStatements: number;
        fixedStatements: number;
        ratio: number;
        label: string;
        topGrowthPhrases: string[];
        topFixedPhrases: string[];
    };
    writingVoice?: {
        avgSentenceLength: number;
        avgParagraphLength: number;
        readingLevel: string;
        readingGrade: number;
        questionFrequency: number;
        exclamationFrequency: number;
        firstPersonRatio: number;
        tenseDistribution: { past: number; present: number; future: number };
    };
};

type DashboardWeeklyDigest = {
    title: string;
    editorial: string;
    highlights: Array<{ category: string; insight: string }>;
    generatedAt: string;
    entryCount?: number;
    spotlightLine?: string | null;
};

type DashboardStoryOverview = {
    stats: {
        entryCount: number;
        experienceCount: number;
        verifiedCount: number;
    };
    experiences: Array<{
        verified: boolean;
        completeness?: {
            readyForVerification: boolean;
            readyForExport: boolean;
        } | null;
    }>;
    topSkills: string[];
    topLessons: string[];
};

type DashboardSupportMap = {
    summary: string;
    basedOnEntries: number;
    generatedAt: string;
    anchors: Array<{
        id: string;
        label: string;
        type: 'person' | 'place' | 'routine' | 'group';
        strength: number;
        supportCount: number;
        tensionCount: number;
        whyItHelps: string;
        reconnectSuggestion: string;
        lastSeen: string;
    }>;
};

export type DashboardNotebookViewProps = {
    firstName: string;
    avatarUrl?: string | null;
    todayLabel: string;
    locationLabel?: string | null;
    profileTags?: string[];
    entries: Array<{
        id: string;
        title: string | null;
        content: string;
        contentPreview?: string;
        mood: string | null;
        createdAt: string;
    }>;
    themeClusters: Array<{
        label: string;
        dominantMood: string | null;
        entryCount: number;
    }>;
    resurfacedMoments: Array<{
        matchedEntry: {
            id: string;
            title: string | null;
            contentPreview: string;
            createdAt: string;
        };
    }>;
    totalWords: number | null;
    todayBrief: StudentActionBrief | null;
    focusCard: DashboardFocusConfig;
    recommendedHref: string;
    openDashboardEntryHref: (entryId: string) => string;
    gentleReflection: GentleReflectionDraft | null;
    gentleJournalHref: string | null;
    timelineHref: string;
    portfolioHref: string;
    guideHref: string;
    dashboardReturnTo: string;
    hasSafetyFocus: boolean;
    setGentleReflectionsEnabled: (enabled: boolean) => void;
    setGentleReflection: (reflection: GentleReflectionDraft | null) => void;
    gentleReflectionsEnabled: boolean;
    handleAcceptGentleReflection: () => void;
    handleDismissGentleReflection: () => void;
    todayBridge: any | null;
    handleDashboardBridgeCopy: (recipient: string) => void;
    showThenNow: boolean;
    oldestEntry: { createdAt: string } | null;
    daysSinceFirst: number;
    wellnessSubmitted: boolean;
    deviceSignals: {
        wellness?: { energyLevel: number; stressLevel: number; socialBattery: number } | null;
    } | null;
    hasDeviceSignals: boolean;
    writerDNA: {
        archetype: { name: string; oneLiner: string };
        traits: Array<{ label: string }>;
    };
    dashboardInsights: {
        emotionalFingerprint: {
            axes: Array<{ emotion: string; score: number; entryCount: number }>;
            summary: string;
        } | null;
        resilience: { narrative: string } | null;
        reflectionDepth: { level?: number; levelLabel: string; score?: number; progressToNext?: number } | null;
        correlations: Array<{ topic: string; direction: 'lifter' | 'drain'; delta: number; occurrences: number }>;
        contradictions: Array<{ description: string }>;
        triggerMap: Array<{ entity: string; direction: 'lifter' | 'drain'; avgMoodDelta: number; occurrences: number }>;
    } | null;
    journalIntel: DashboardJournalIntel | null;
    weeklyDigest: DashboardWeeklyDigest | null;
    storyOverview: DashboardStoryOverview | null;
    hasCheckedInToday: boolean;
    todayCheckInMood: string | null;
    onDailyCheckIn: (mood: string, note: string) => Promise<void>;
    supportMap: DashboardSupportMap | null;
    heroInsight: { body: string } | null;
    heroInsightLoading: boolean;
    insightTier: number;
    userBirthDate: string | null;
    /** Show calm Tier 1 dashboard for <10 entries. Default: false (full dashboard) */
    showCalmerLayout?: boolean;
};

type DashboardTab = 'overview' | 'growth' | 'patterns';

const moodEmojiFor = (mood: string | null | undefined) => {
    const normalized = normalizeMood(mood);
    return normalized ? getMoodEmoji(normalized) : '✦';
};

const TAB_ORDER: DashboardTab[] = ['overview', 'growth', 'patterns'];
const TAB_LABELS: Record<DashboardTab, string> = {
    overview: 'Overview',
    growth: 'Growth',
    patterns: 'Patterns',
};

const DAY_LABELS = [
    { short: 'Sun', full: 'Sunday' },
    { short: 'Mon', full: 'Monday' },
    { short: 'Tue', full: 'Tuesday' },
    { short: 'Wed', full: 'Wednesday' },
    { short: 'Thu', full: 'Thursday' },
    { short: 'Fri', full: 'Friday' },
    { short: 'Sat', full: 'Saturday' },
] as const;

// Y-position on the mood thread SVG, derived from canonical 1–10 mood score
// so any mood added to the constants module flows through without edits here.
// Higher score = happier = higher on the thread (smaller y).
const moodThreadY = (mood: string | null | undefined): number => {
    const normalized = normalizeMood(mood);
    if (!normalized) return 56;
    const score = getMoodScore(normalized);
    // score 10 → y=28 (top), score 1 → y=84 (bottom)
    return 28 + ((10 - score) / 9) * 56;
};

const FALLBACK_THREAD_POINTS = [76, 40, 68, 48, 58, 44];

const compactText = (value: string | null | undefined, maxLength = 120) => {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
};

const toTitleCase = (value: string | null | undefined) =>
    String(value || '')
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

const formatNotebookLabel = (value: string | null | undefined) =>
    toTitleCase(String(value || '').replace(/[_-]+/g, ' '));

const formatCompactCount = (value: number) =>
    value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k` : value.toLocaleString();

const buildMeterSegments = (filled: number, total: number) =>
    Array.from({ length: total }, (_, index) => index < Math.max(0, Math.min(total, filled)));

const toProgressPercent = (value: number, maxValue: number) => {
    if (maxValue <= 0) return 0;
    return Math.max(8, Math.min(100, Math.round((value / maxValue) * 100)));
};

const getWeekStart = () => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
};

const countWordsThisWeek = (entries: DashboardNotebookViewProps['entries']) => {
    const weekStart = getWeekStart();

    return entries.reduce((total, entry) => {
        if (new Date(entry.createdAt) < weekStart) return total;
        return total + String(entry.content || '').split(/\s+/).filter(Boolean).length;
    }, 0);
};

const countEntriesThisWeek = (entries: DashboardNotebookViewProps['entries']) => {
    const weekStart = getWeekStart();
    return entries.filter((entry) => new Date(entry.createdAt) >= weekStart).length;
};

const countWritingDays = (entries: DashboardNotebookViewProps['entries']) =>
    new Set(entries.map((entry) => new Date(entry.createdAt).toISOString().slice(0, 10))).size;

const WRITING_WINDOWS = [
    { label: 'Morning', shortLabel: 'AM', phrase: 'morning', pluralPhrase: 'mornings', match: (hour: number) => hour >= 5 && hour < 12 },
    { label: 'Afternoon', shortLabel: 'PM', phrase: 'afternoon', pluralPhrase: 'afternoons', match: (hour: number) => hour >= 12 && hour < 17 },
    { label: 'Evening', shortLabel: 'Eve', phrase: 'evening', pluralPhrase: 'evenings', match: (hour: number) => hour >= 17 && hour < 22 },
    { label: 'Night', shortLabel: 'Late', phrase: 'late night', pluralPhrase: 'late nights', match: (hour: number) => hour < 5 || hour >= 22 },
] as const;

const getWritingWindowCounts = (entries: DashboardNotebookViewProps['entries']) =>
    WRITING_WINDOWS.map((window) => ({
        ...window,
        count: entries.reduce((total, entry) => window.match(new Date(entry.createdAt).getHours()) ? total + 1 : total, 0),
    }));

const getWeekdayCounts = (entries: DashboardNotebookViewProps['entries']) =>
    DAY_LABELS.map((day, dayIndex) => ({
        ...day,
        count: entries.reduce((total, entry) => new Date(entry.createdAt).getDay() === dayIndex ? total + 1 : total, 0),
    }));

const getTopDayWindowMoments = (entries: DashboardNotebookViewProps['entries']) =>
    DAY_LABELS.flatMap((day, dayIndex) =>
        WRITING_WINDOWS.map((window) => ({
            label: `${day.full} ${window.pluralPhrase}`,
            promptLabel: `${day.full} ${window.phrase}`,
            count: entries.reduce((total, entry) => {
                const createdAt = new Date(entry.createdAt);
                return createdAt.getDay() === dayIndex && window.match(createdAt.getHours()) ? total + 1 : total;
            }, 0),
        }))
    )
        .filter((moment) => moment.count > 0)
        .sort((left, right) => right.count - left.count)
        .slice(0, 2);

const getDominantWritingWindow = (entries: DashboardNotebookViewProps['entries']) => {
    if (entries.length < 3) return null;

    const strongest = getWritingWindowCounts(entries)
        .map((window) => ({
            label: window.phrase,
            count: window.count,
        }))
        .sort((left, right) => right.count - left.count)[0];

    if (!strongest || strongest.count < 2) return null;
    return strongest.label;
};

const buildSmoothPath = (points: Array<{ x: number; y: number }>) => {
    if (points.length === 0) return '';

    return points.reduce((path, point, index, allPoints) => {
        if (index === 0) {
            return `M ${point.x} ${point.y}`;
        }

        const previousPoint = allPoints[index - 1];
        const deltaX = point.x - previousPoint.x;
        const controlPointOneX = previousPoint.x + deltaX / 3;
        const controlPointTwoX = point.x - deltaX / 3;

        return `${path} C ${controlPointOneX} ${previousPoint.y} ${controlPointTwoX} ${point.y} ${point.x} ${point.y}`;
    }, '');
};

const sentenceCase = (value: string | null | undefined) => {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    return normalized.charAt(0).toLowerCase() + normalized.slice(1);
};

const getZodiacSign = (birthDate: string): { sign: string; symbol: string } | null => {
    const d = new Date(birthDate);
    if (isNaN(d.getTime())) return null;
    const m = d.getMonth() + 1;
    const day = d.getDate();
    if ((m === 3 && day >= 21) || (m === 4 && day <= 19)) return { sign: 'Aries', symbol: '♈' };
    if ((m === 4 && day >= 20) || (m === 5 && day <= 20)) return { sign: 'Taurus', symbol: '♉' };
    if ((m === 5 && day >= 21) || (m === 6 && day <= 20)) return { sign: 'Gemini', symbol: '♊' };
    if ((m === 6 && day >= 21) || (m === 7 && day <= 22)) return { sign: 'Cancer', symbol: '♋' };
    if ((m === 7 && day >= 23) || (m === 8 && day <= 22)) return { sign: 'Leo', symbol: '♌' };
    if ((m === 8 && day >= 23) || (m === 9 && day <= 22)) return { sign: 'Virgo', symbol: '♍' };
    if ((m === 9 && day >= 23) || (m === 10 && day <= 22)) return { sign: 'Libra', symbol: '♎' };
    if ((m === 10 && day >= 23) || (m === 11 && day <= 21)) return { sign: 'Scorpio', symbol: '♏' };
    if ((m === 11 && day >= 22) || (m === 12 && day <= 21)) return { sign: 'Sagittarius', symbol: '♐' };
    if ((m === 12 && day >= 22) || (m === 1 && day <= 19)) return { sign: 'Capricorn', symbol: '♑' };
    if ((m === 1 && day >= 20) || (m === 2 && day <= 18)) return { sign: 'Aquarius', symbol: '♒' };
    return { sign: 'Pisces', symbol: '♓' };
};

const getMoodMicroShift = (entries: DashboardNotebookViewProps['entries']): {
    type: 'shift'; from: string; to: string;
} | {
    type: 'steady'; mood: string; streak: number;
} | null => {
    if (entries.length < 2) return null;
    const latest = entries[0];
    const prev = entries[1];
    if (!latest.mood || !prev.mood) return null;
    if (latest.mood !== prev.mood) return { type: 'shift', from: prev.mood, to: latest.mood };
    let streak = 1;
    for (let i = 1; i < entries.length; i++) {
        if (entries[i].mood === latest.mood) streak++;
        else break;
    }
    return { type: 'steady', mood: latest.mood, streak };
};

type HeatmapCell = { key: string; date: Date; count: number; level: 0 | 1 | 2 | 3 | 4 };

const HEATMAP_WEEKS = 26; // ~6 months so it fits comfortably on mobile

const buildActivityHeatmap = (entries: DashboardNotebookViewProps['entries']): HeatmapCell[][] => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
        const d = new Date(entry.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    // Anchor: end of current week (Saturday), walk back HEATMAP_WEEKS weeks
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + (6 - end.getDay()));
    const start = new Date(end);
    start.setDate(start.getDate() - (HEATMAP_WEEKS * 7 - 1));

    const weeks: HeatmapCell[][] = [];
    for (let w = 0; w < HEATMAP_WEEKS; w++) {
        const week: HeatmapCell[] = [];
        for (let d = 0; d < 7; d++) {
            const date = new Date(start);
            date.setDate(start.getDate() + w * 7 + d);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const count = counts.get(key) ?? 0;
            const level: HeatmapCell['level'] = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count === 3 ? 3 : 4;
            week.push({ key, date, count, level });
        }
        weeks.push(week);
    }
    return weeks;
};

type PeriodDelta = {
    hasSignal: boolean;
    currentEntries: number;
    previousEntries: number;
    entriesDelta: number;
    currentWritingDays: number;
    previousWritingDays: number;
    writingDaysDelta: number;
    currentAvgMood: number | null;
    previousAvgMood: number | null;
    moodDelta: number | null;
    currentTopMood: string | null;
    previousTopMood: string | null;
    periodLabel: string;
};

const MOOD_SCORE_LOOKUP: Record<string, number> = {
    happy: 8, grateful: 8, motivated: 8, calm: 7, thoughtful: 6, tired: 4,
    frustrated: 3, anxious: 3, sad: 2,
};

const buildPeriodDelta = (entries: DashboardNotebookViewProps['entries']): PeriodDelta => {
    const now = new Date();
    const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousEnd = currentStart;

    const current = entries.filter((e) => new Date(e.createdAt) >= currentStart);
    const previous = entries.filter((e) => {
        const d = new Date(e.createdAt);
        return d >= previousStart && d < previousEnd;
    });

    const moodAvg = (list: typeof entries): number | null => {
        const scores = list
            .map((e) => (e.mood ? MOOD_SCORE_LOOKUP[e.mood.toLowerCase()] ?? null : null))
            .filter((s): s is number => s !== null);
        if (scores.length === 0) return null;
        return scores.reduce((sum, s) => sum + s, 0) / scores.length;
    };

    const topMood = (list: typeof entries): string | null => {
        const counts = new Map<string, number>();
        for (const e of list) {
            if (!e.mood) continue;
            const key = e.mood.toLowerCase();
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
        return sorted[0]?.[0] ?? null;
    };

    const daysSet = (list: typeof entries) =>
        new Set(list.map((e) => new Date(e.createdAt).toISOString().slice(0, 10))).size;

    const currentAvgMood = moodAvg(current);
    const previousAvgMood = moodAvg(previous);

    return {
        hasSignal: previous.length >= 3 && current.length >= 1,
        currentEntries: current.length,
        previousEntries: previous.length,
        entriesDelta: current.length - previous.length,
        currentWritingDays: daysSet(current),
        previousWritingDays: daysSet(previous),
        writingDaysDelta: daysSet(current) - daysSet(previous),
        currentAvgMood,
        previousAvgMood,
        moodDelta: currentAvgMood !== null && previousAvgMood !== null
            ? currentAvgMood - previousAvgMood
            : null,
        currentTopMood: topMood(current),
        previousTopMood: topMood(previous),
        periodLabel: previousStart.toLocaleDateString('en-US', { month: 'long' }),
    };
};

const getWritingEnergy = (entries: DashboardNotebookViewProps['entries']): {
    thisWeek: number; lastWeek: number; trend: 'up' | 'down' | 'same';
} | null => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const wordCount = (entry: DashboardNotebookViewProps['entries'][0]) =>
        String(entry.content || '').split(/\s+/).filter(Boolean).length;
    const thisWeek = entries
        .filter((e) => new Date(e.createdAt) >= weekStart)
        .reduce((sum, e) => sum + wordCount(e), 0);
    const lastWeek = entries
        .filter((e) => { const d = new Date(e.createdAt); return d >= prevWeekStart && d < weekStart; })
        .reduce((sum, e) => sum + wordCount(e), 0);
    if (thisWeek === 0 && lastWeek === 0) return null;
    const trend = lastWeek === 0 ? 'up' : thisWeek > lastWeek * 1.1 ? 'up' : thisWeek < lastWeek * 0.9 ? 'down' : 'same';
    return { thisWeek, lastWeek, trend };
};

export default function DashboardNotebookView(props: DashboardNotebookViewProps) {
    const { showCalmerLayout = false, ...rest } = props;
    
    // If showCalmerLayout is true, render the calm Tier 1 dashboard instead
    if (showCalmerLayout) {
        return (
            <DashboardTier1Simple
                firstName={rest.firstName}
                todayLabel={rest.todayLabel}
                entries={rest.entries}
                focusCard={rest.focusCard}
                heroInsight={rest.heroInsight}
                dashboardInsights={rest.dashboardInsights}
                onViewFullDashboard={() => {
                    // Reload to show full dashboard
                    window.location.reload();
                }}
            />
        );
    }

    // Render full dashboard
    return <DashboardNotebookViewFull {...rest} />;
}

function DashboardNotebookViewFull({
    firstName,
    avatarUrl,
    todayLabel,
    entries,
    themeClusters,
    resurfacedMoments,
    totalWords,
    todayBrief,
    focusCard,
    recommendedHref,
    openDashboardEntryHref,
    gentleReflection,
    gentleJournalHref,
    timelineHref,
    portfolioHref,
    guideHref,
    dashboardReturnTo: _dashboardReturnTo,
    hasSafetyFocus,
    setGentleReflectionsEnabled,
    setGentleReflection,
    gentleReflectionsEnabled,
    handleAcceptGentleReflection,
    handleDismissGentleReflection,
    todayBridge: _todayBridge,
    handleDashboardBridgeCopy: _handleDashboardBridgeCopy,
    showThenNow,
    oldestEntry,
    daysSinceFirst,
    wellnessSubmitted,
    deviceSignals,
    hasDeviceSignals,
    writerDNA,
    dashboardInsights,
    journalIntel,
    weeklyDigest,
    storyOverview,
    hasCheckedInToday,
    todayCheckInMood,
    onDailyCheckIn,
    supportMap,
    heroInsight,
    heroInsightLoading,
    insightTier: _insightTier,
    locationLabel,
    userBirthDate,
    profileTags = [],
}: Omit<DashboardNotebookViewProps, 'showCalmerLayout'>) {
    const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
    const [heatmapTap, setHeatmapTap] = useState<HeatmapCell | null>(null);
    const weekWords = useMemo(() => countWordsThisWeek(entries), [entries]);
    const notesThisWeek = useMemo(() => countEntriesThisWeek(entries), [entries]);
    const writingDays = useMemo(() => countWritingDays(entries), [entries]);
    const writingWindowCounts = useMemo(() => getWritingWindowCounts(entries), [entries]);
    const weekdayCounts = useMemo(() => getWeekdayCounts(entries), [entries]);
    const topDayWindowMoments = useMemo(() => getTopDayWindowMoments(entries), [entries]);
    const dominantWritingWindow = useMemo(() => getDominantWritingWindow(entries), [entries]);
    const recentEmotionEntries = useMemo(() => entries.slice(0, 6).reverse(), [entries]);
    const zodiacSign = useMemo(() => (userBirthDate ? getZodiacSign(userBirthDate) : null), [userBirthDate]);
    const moodShift = useMemo(() => getMoodMicroShift(entries), [entries]);
    const writingEnergy = useMemo(() => getWritingEnergy(entries), [entries]);
    const activityHeatmap = useMemo(() => buildActivityHeatmap(entries), [entries]);
    const heatmapTotal = useMemo(
        () => activityHeatmap.reduce((sum, week) => sum + week.reduce((s, cell) => s + cell.count, 0), 0),
        [activityHeatmap]
    );
    const periodDelta = useMemo(() => buildPeriodDelta(entries), [entries]);
    const latestEntry = entries[0] || null;
    const daysSinceLastEntry = useMemo(() => {
        if (!latestEntry) return null;
        return Math.floor((Date.now() - new Date(latestEntry.createdAt).getTime()) / 86400000);
    }, [latestEntry]);
    const resurfacedMoment = resurfacedMoments[0] || null;
    const returningThemes = themeClusters.filter((cluster) => cluster.entryCount >= 2).length;

    const { currentStreak, bestStreak } = useMemo(() => {
        if (entries.length === 0) return { currentStreak: 0, bestStreak: 0 };
        const daySet = new Set(entries.map(e => {
            const d = new Date(e.createdAt);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }));
        // Current streak: walk backwards from today or yesterday
        let current = 0;
        const now = new Date();
        const fmt = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        const todayStr = fmt(now);
        const yest = new Date(Date.now() - 86400000);
        const start = daySet.has(todayStr) ? now : daySet.has(fmt(yest)) ? yest : null;
        if (start) {
            let d = new Date(start);
            for (let i = 0; i < 400; i++) {
                if (!daySet.has(fmt(d))) break;
                current++;
                d = new Date(d.getTime() - 86400000);
            }
        }
        // Best streak
        const sorted = [...daySet].sort();
        let best = sorted.length > 0 ? 1 : 0;
        let run = 1;
        for (let i = 1; i < sorted.length; i++) {
            const diff = (new Date(sorted[i] + 'T00:00:00').getTime() - new Date(sorted[i - 1] + 'T00:00:00').getTime()) / 86400000;
            if (diff === 1) { run++; best = Math.max(best, run); } else { run = 1; }
        }
        return { currentStreak: current, bestStreak: Math.max(best, current) };
    }, [entries]);

    const strongestEmotion = dashboardInsights?.emotionalFingerprint?.axes
        ? [...dashboardInsights.emotionalFingerprint.axes].sort((left, right) => right.score - left.score)[0] ?? null
        : null;
    const highestWindowCount = writingWindowCounts.reduce((highest, bucket) => Math.max(highest, bucket.count), 0);
    const highestWeekdayCount = weekdayCounts.reduce((highest, day) => Math.max(highest, day.count), 0);
    const energyTrait = writerDNA.traits[1] || writerDNA.traits[0];
    const threadSentence = weekWords > 0
        ? `You put down ${weekWords} ${weekWords === 1 ? 'word' : 'words'} this week - enough for Notive to start finding a clearer pattern.`
        : typeof totalWords === 'number' && totalWords > 0
            ? `You already have ${totalWords} words in the notebook - enough for Notive to start finding a clearer pattern.`
            : entries.length > 0
                ? `You already have ${entries.length} ${entries.length === 1 ? 'memory' : 'memories'} here - enough for Notive to start finding a clearer pattern.`
                : 'One honest memory is enough for Notive to start finding a clearer pattern.';
    const rhythmSummary = dominantWritingWindow
        ? `Most of your memories return in the ${dominantWritingWindow}. When that window opens, leave two honest lines before it passes.`
        : entries.length >= 3
            ? 'Your rhythm is still forming. Keep catching the same kind of moment when it comes back.'
            : 'A few more memories will make your writing rhythm easier to trust.';
    const emotionalSummary = dashboardInsights?.emotionalFingerprint?.summary
        || 'A few more memories will make the emotional pattern here easier to read.';
    const noticingSummary = heroInsight?.body
        || dashboardInsights?.contradictions[0]?.description
        || (dashboardInsights?.correlations[0]
            ? `${toTitleCase(dashboardInsights.correlations[0].topic)} tends to ${dashboardInsights.correlations[0].direction === 'lifter' ? 'lift' : 'drain'} your mood when it shows up.`
            : null)
        || (dashboardInsights?.triggerMap[0]
            ? `${toTitleCase(dashboardInsights.triggerMap[0].entity)} looks like a repeating ${dashboardInsights.triggerMap[0].direction === 'lifter' ? 'helpful' : 'draining'} influence.`
            : null)
        || 'Notive is still listening for a pattern it can say clearly, not just confidently.';
    const supportSummary = hasDeviceSignals && deviceSignals?.wellness
        ? `Your last check-in showed energy at ${deviceSignals.wellness.energyLevel}/10 and stress at ${deviceSignals.wellness.stressLevel}/10. Let that be context, not pressure.`
        : wellnessSubmitted
            ? 'Your last check-in is already part of the thread here. You do not need to explain the whole day again.'
            : 'If today feels noisy, a quick check-in or short chat can give the next memory more context.';
    const weeklyDigestSnippet = weeklyDigest?.spotlightLine
        ? `"${compactText(weeklyDigest.spotlightLine, 150)}"`
        : weeklyDigest?.editorial
            ? compactText(weeklyDigest.editorial.replace(/\s+/g, ' '), 170)
        : null;
    const weeklyDigestHighlights = (weeklyDigest?.highlights || [])
        .map((item) => ({
            ...item,
            category: formatNotebookLabel(item.category),
            insight: compactText(item.insight, 76),
        }))
        .filter((item) => item.insight)
        .slice(0, 2);
    const supportAnchors = supportMap?.anchors || [];
    const peopleAnchorFallback = (journalIntel?.peopleMap.people || [])
        .filter((person) => person.sentiment !== 'negative')
        .slice(0, 3)
        .map((person) => ({
            id: `person-${person.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
            label: person.name,
            type: 'person' as const,
            strength: 0,
            supportCount: person.count,
            tensionCount: 0,
            whyItHelps: `${person.name} keeps showing up in your memories when something important is happening.`,
            reconnectSuggestion: '',
            lastSeen: '',
        }));
    const primarySupportAnchor = supportAnchors[0] || null;
    const supportAnchorCards = (supportAnchors.length > 0 ? supportAnchors : peopleAnchorFallback).slice(0, 2);
    const supportivePeople = (supportAnchors.length > 0 ? supportAnchors : peopleAnchorFallback)
        .filter((anchor) => anchor.type === 'person' || anchor.type === 'group')
        .slice(0, 3);
    const groundingAnchors = supportAnchors
        .filter((anchor) => anchor.type === 'routine' || anchor.type === 'place')
        .slice(0, 2);
    const supportSummaryLine = supportMap?.summary
        ? compactText(supportMap.summary, 152)
        : supportSummary;
    const growthSummary = showThenNow && oldestEntry
        ? `Your memories have already moved from ${themeClusters[themeClusters.length - 1]?.label ?? 'finding your way'} toward ${themeClusters[0]?.label ?? 'clearer ground'}.`
        : `${writerDNA.archetype.oneLiner}. The notebook is starting to hold a shape you can actually use.`;
    const growthEvidence = themeClusters[0]?.label
        ? `A theme that keeps returning lately: ${themeClusters[0].label}.`
        : 'A few honest memories are already enough for Notive to hold onto what matters.';
    const patternsLead = dominantWritingWindow
        ? `Your deepest writing tends to happen in the ${dominantWritingWindow}.`
        : 'Your writing window is still forming, but Notive is already watching for it.';
    const writingRhythmLine = topDayWindowMoments.length >= 2
        ? `Your deepest reflections tend to come on ${topDayWindowMoments[0].label} and ${topDayWindowMoments[1].label}.`
        : topDayWindowMoments.length === 1
            ? `Your memories often open up on ${topDayWindowMoments[0].label}.`
            : patternsLead;
    const writingRhythmPrompt = topDayWindowMoments[0]
        ? `Try capturing one quick thought next ${topDayWindowMoments[0].promptLabel}.`
        : 'Try catching one quick thought the next time a familiar window opens.';
    const emotionalThreadLine = strongestEmotion
        ? `You named ${String(strongestEmotion.emotion).toLowerCase()} most often this week - that's a recurring pattern worth keeping in view.`
        : emotionalSummary;
    const noticingLine = heroInsightLoading
        ? 'Notive is still reading across your memories before it says this more clearly.'
        : compactText(noticingSummary, 150);
    const storyPipelineCounts = useMemo(() => {
        const experiences = storyOverview?.experiences || [];
        const readyToVerifyCount = experiences.filter(
            (experience) => !experience.verified && experience.completeness?.readyForVerification && !experience.completeness?.readyForExport
        ).length;
        const readyToUseCount = experiences.filter(
            (experience) => !experience.verified && experience.completeness?.readyForExport
        ).length;
        const shapingCount = Math.max(
            (storyOverview?.stats.experienceCount || 0) - readyToVerifyCount - readyToUseCount - (storyOverview?.stats.verifiedCount || 0),
            0
        );

        return {
            notes: storyOverview?.stats.entryCount || entries.length,
            shaping: shapingCount,
            ready: readyToVerifyCount + readyToUseCount,
            verified: storyOverview?.stats.verifiedCount || 0,
            leadSignal: storyOverview?.topSkills?.[0] || storyOverview?.topLessons?.[0] || null,
        };
    }, [entries.length, storyOverview]);
    const visibleLifeBalanceAreas = useMemo(
        () => getVisibleLifeBalanceAreas(journalIntel?.lifeBalance.areas),
        [journalIntel?.lifeBalance.areas]
    );
    const hasLifeBalanceSignal = visibleLifeBalanceAreas.length > 0;
    const lifeBalanceScoreLabel = getLifeBalanceScoreLabel(journalIntel?.lifeBalance.balanceScore ?? 0);
    const lifeBalanceRingFill = getLifeBalanceRingFill(journalIntel?.lifeBalance.balanceScore ?? 0);
    const lifeBalanceLine = hasLifeBalanceSignal && journalIntel?.lifeBalance
        ? journalIntel.lifeBalance.neglectedArea
            ? `${formatNotebookLabel(journalIntel.lifeBalance.dominantArea)} has been most present lately. ${formatNotebookLabel(journalIntel.lifeBalance.neglectedArea)} has been quieter.`
            : `${formatNotebookLabel(journalIntel.lifeBalance.dominantArea)} has been most present in the notebook lately.`
        : null;
    const peopleLine = journalIntel?.peopleMap.people?.[0]
        ? `${journalIntel.peopleMap.people[0].name} keeps showing up in ${journalIntel.peopleMap.people[0].count} ${journalIntel.peopleMap.people[0].count === 1 ? 'memory' : 'memories'}.`
        : null;
    const vocabularyLine = journalIntel?.vocabulary.recentNewWords?.length
        ? `New words lately: ${journalIntel.vocabulary.recentNewWords.slice(0, 3).join(', ')}.`
        : journalIntel?.vocabulary.totalUniqueWords
            ? `${journalIntel.vocabulary.totalUniqueWords} distinct words are already shaping this notebook.`
            : null;
    const gratitudeLine = journalIntel?.gratitude.totalExpressions
        ? `You named ${journalIntel.gratitude.totalExpressions} grateful moment${journalIntel.gratitude.totalExpressions === 1 ? '' : 's'} recently.`
        : null;
    const growthLanguageLine = journalIntel?.growthLanguage.totalGrowthPhrases
        ? `${journalIntel.growthLanguage.totalGrowthPhrases} growth phrase${journalIntel.growthLanguage.totalGrowthPhrases === 1 ? '' : 's'} showed up in how you talked to yourself.`
        : null;
    const growthLedgerItems = [
        lifeBalanceLine,
        growthLanguageLine,
        gratitudeLine,
        peopleLine,
        vocabularyLine,
    ].filter((item): item is string => Boolean(item)).slice(0, 3);
    const emotionalThreadPoints = recentEmotionEntries.length >= 2
        ? recentEmotionEntries.map((entry, index) => {
            const moodKey = entry.mood ? entry.mood.toLowerCase() : '';
            return {
                x: 22 + (index * 356) / Math.max(1, recentEmotionEntries.length - 1),
                y: moodThreadY(moodKey),
                label: new Date(entry.createdAt).toLocaleDateString('en-US', { weekday: 'short' }),
                mood: moodKey || null,
            };
        })
        : FALLBACK_THREAD_POINTS.map((value, index) => ({
            x: 22 + (index * 356) / Math.max(1, FALLBACK_THREAD_POINTS.length - 1),
            y: value,
            label: DAY_LABELS[index]?.short ?? '',
            mood: null as string | null,
        }));
    const emotionalThreadPath = buildSmoothPath(emotionalThreadPoints);
    const greetingLocation = locationLabel ? ` in ${locationLabel}.` : '.';
    const energyLine = `${toTitleCase(String(energyTrait?.label || writerDNA.archetype.name).replace(/[_-]+/g, ' '))} energy today`;
    const atAGlanceLine = dominantWritingWindow
        ? `Best writing window lately: ${toTitleCase(dominantWritingWindow)}.`
        : returningThemes > 0
            ? `${returningThemes} ${returningThemes === 1 ? 'theme is' : 'themes are'} returning lately.`
            : 'A few more memories will sharpen the pattern view.';
    const lastMoodKey = latestEntry?.mood ? String(latestEntry.mood).toLowerCase() : null;
    const lastMoodEmoji = lastMoodKey ? moodEmojiFor(lastMoodKey) : null;

    const glanceSignals = [
        {
            key: 'streak',
            label: 'Streak',
            value: `${currentStreak}d`,
            note: bestStreak > currentStreak ? `Best: ${bestStreak}d` : currentStreak > 0 ? 'In a row' : 'Start today',
            accent: currentStreak >= 3 ? 'rgba(138,154,111,0.85)' : currentStreak > 0 ? 'rgba(192,160,100,0.85)' : 'rgba(120,150,160,0.85)',
            meter: buildMeterSegments(Math.min(5, currentStreak), 5),
            badge: null,
        },
        {
            key: 'week',
            label: 'This week',
            value: String(notesThisWeek > 0 ? notesThisWeek : entries.length),
            note: notesThisWeek > 0 ? `${formatCompactCount(weekWords)} words` : `${entries.length} total`,
            accent: 'rgba(191,214,221,0.95)',
            meter: buildMeterSegments(
                notesThisWeek > 0
                    ? Math.min(5, notesThisWeek)
                    : Math.min(5, Math.max(entries.length > 0 ? 1 : 0, Math.round(entries.length / 3))),
                5
            ),
            badge: writingDays > 0 ? `${writingDays}d active` : null,
        },
        {
            key: 'threads',
            label: 'Threads',
            value: String(Math.max(returningThemes, themeClusters.length > 0 ? 1 : 0)),
            note: themeClusters[0]?.label ? formatNotebookLabel(themeClusters[0].label) : 'Forming',
            accent: 'rgba(216,199,232,0.95)',
            meter: buildMeterSegments(Math.min(4, Math.max(returningThemes, themeClusters.length > 0 ? 1 : 0)), 4),
            badge: strongestEmotion ? `${moodEmojiFor(String(strongestEmotion.emotion))} ${formatNotebookLabel(strongestEmotion.emotion)}` : null,
        },
        {
            key: 'mood',
            label: 'Mood',
            value: lastMoodEmoji ?? '—',
            note: lastMoodKey ? toTitleCase(lastMoodKey) : 'Log a mood',
            accent: 'rgba(234,216,189,0.95)',
            meter: buildMeterSegments(lastMoodKey ? 3 : 0, 5),
            badge: null,
        },
    ];
    const storyPipelineStages = storyPipelineCounts.notes > 0 ? [
        {
            label: 'Memories',
            value: storyPipelineCounts.notes,
            progress: toProgressPercent(Math.min(storyPipelineCounts.notes, 7), 7),
            accent: 'rgba(191,214,221,0.95)',
        },
        {
            label: 'Shaping',
            value: storyPipelineCounts.shaping,
            progress: toProgressPercent(storyPipelineCounts.shaping, Math.max(storyPipelineCounts.notes, 1)),
            accent: 'rgba(234,216,189,0.95)',
        },
        {
            label: 'Ready',
            value: storyPipelineCounts.ready,
            progress: toProgressPercent(storyPipelineCounts.ready, Math.max(storyPipelineCounts.notes, 1)),
            accent: 'rgba(216,199,232,0.95)',
        },
        {
            label: 'Verified',
            value: storyPipelineCounts.verified,
            progress: toProgressPercent(storyPipelineCounts.verified, Math.max(storyPipelineCounts.notes, 1)),
            accent: 'rgba(138,154,111,0.92)',
        },
    ] : [];
    const noticedItems = [
        themeClusters[0]
            ? `Your "${themeClusters[0].label}" thread has shown up in ${themeClusters[0].entryCount} recent ${themeClusters[0].entryCount === 1 ? 'memory' : 'memories'}. ${todayBrief?.whatHelpedBefore?.summary ? compactText(todayBrief.whatHelpedBefore.summary, 92) : 'That is worth naming directly today.'}`
            : null,
        strongestEmotion
            ? `You named "${String(strongestEmotion.emotion).toLowerCase()}" ${strongestEmotion.entryCount} ${strongestEmotion.entryCount === 1 ? 'time' : 'times'} recently - that looks like the strongest emotional pattern right now.`
            : (weekWords > 0
                ? `You put down ${weekWords} ${weekWords === 1 ? 'word' : 'words'} this week - enough for Notive to start finding a clearer pattern.`
                : null),
        resurfacedMoment
            ? `One memory from ${new Date(resurfacedMoment.matchedEntry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} is echoing again. It already shows ${sentenceCase(String(energyTrait?.label || 'self-awareness'))} in how you handled that moment.`
            : heroInsight?.body
                ? compactText(heroInsight.body, 132)
                : null,
    ].filter((item): item is string => Boolean(item)).slice(0, 3);
    const smallEvidenceItems = [
        writingDays > 0
            ? {
                title: 'Resilience',
                body: writingDays > 1
                    ? `You came back on ${writingDays} different days, even when the week was uneven.`
                    : 'You still made space for one honest return to the notebook.',
            }
            : null,
        themeClusters[0]
            ? {
                title: 'Self-awareness',
                body: `${toTitleCase(themeClusters[0].label)} kept returning, which means you are noticing a real thread in your own words.`,
            }
            : null,
        strongestEmotion
            ? {
                title: 'Naming what was true',
                body: `${toTitleCase(strongestEmotion.emotion)} showed up enough times for Notive to trace it as a recurring part of the week.`,
            }
            : null,
        resurfacedMoment
            ? {
                title: 'Memory',
                body: 'An older memory is echoing again, which helps you see what is repeating sooner.',
            }
            : null,
        writerDNA.traits[0]
            ? {
                title: toTitleCase(String(writerDNA.traits[0].label).replace(/[_-]+/g, ' ')),
                body: 'That quality keeps showing up in how you describe hard moments and what mattered in them.',
            }
            : null,
    ].filter((item): item is { title: string; body: string } => Boolean(item)).slice(0, 3);
    const evidenceLedger = smallEvidenceItems.length > 0
        ? smallEvidenceItems
        : [{
            title: 'First thread',
            body: 'A few more memories will give Notive enough evidence to sketch this page more clearly.',
        }];

    const renderFocusAction = (action: DashboardAction | null | undefined, tone: 'primary' | 'secondary') => {
        if (!action) return null;
        const className = tone === 'primary'
            ? 'workspace-button-primary inline-flex items-center rounded-xl px-4 py-3 text-sm font-semibold'
            : 'workspace-button-outline inline-flex items-center rounded-xl px-4 py-3 text-sm font-semibold';

        if (action.type === 'button') {
            return <button type="button" onClick={action.onClick} className={className}>{action.label}</button>;
        }

        if (!action.href) return null;

        if (action.href.startsWith('/')) {
            return <Link href={action.href} onClick={action.onClick} className={className}>{action.label}</Link>;
        }

        return <a href={action.href} onClick={action.onClick} className={className}>{action.label}</a>;
    };

    const heroContent = hasSafetyFocus && todayBrief ? (
        <ActionBriefPanel
            brief={todayBrief}
            surface="dashboard"
            openEntryHref={openDashboardEntryHref}
            draftHref={recommendedHref}
            embedded
        />
    ) : gentleReflection && gentleJournalHref && entries.length === 0 ? (
        <DailyGentleReflectionCard
            reflection={gentleReflection}
            journalHref={gentleJournalHref}
            insightsHref={timelineHref}
            portfolioHref={portfolioHref}
            isDisabling={!gentleReflectionsEnabled}
            onAccept={handleAcceptGentleReflection}
            onDismiss={handleDismissGentleReflection}
            onDisable={() => {
                setGentleReflectionsEnabled(false);
                setGentleReflection(null);
            }}
            embedded
        />
    ) : (
        <div className="space-y-4">
            <div>
                <p className="section-label">{focusCard.eyebrow}</p>
                <h2 className="notebook-title mt-2 text-xl md:text-[1.55rem]">{focusCard.title}</h2>
                <p className="notebook-copy mt-2 text-[0.875rem] leading-7">{focusCard.body}</p>
            </div>

            {(focusCard.evidence || focusCard.evidenceFallback) && (
                <div className="app-paper-soft rounded-[1.25rem] p-4">
                    <p className="section-label">{hasSafetyFocus ? 'Why this matters now' : NOTIVE_VOICE.dashboard.evidenceLabel}</p>
                    <p className="notebook-copy mt-2 text-[0.875rem] leading-7">{focusCard.evidence || focusCard.evidenceFallback}</p>
                </div>
            )}

            {focusCard.panels && focusCard.panels.length > 0 && (
                <div className="grid gap-3 md:grid-cols-2">
                    {focusCard.panels.map((panel) => (
                        <div key={panel.label} className="app-paper-soft rounded-[1.25rem] p-4">
                            <p className="section-label">{panel.label}</p>
                            <p className="notebook-copy mt-2 text-[0.875rem] leading-7">{panel.value}</p>
                        </div>
                    ))}
                </div>
            )}

            <div className="app-paper-soft rounded-[1.25rem] p-4">
                <p className="section-label">{NOTIVE_VOICE.dashboard.actionLabel}</p>
                <p className="notebook-title mt-2 text-lg">{focusCard.primaryAction?.label || 'Draft the first lines'}</p>
                <p className="notebook-copy mt-2 text-[0.875rem] leading-7">{focusCard.panels?.[0]?.value || focusCard.body}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                {renderFocusAction(focusCard.primaryAction, 'primary')}
                {renderFocusAction(focusCard.secondaryAction, 'secondary')}
            </div>
        </div>
    );

    const glanceStrip = entries.length > 0 ? (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-[1.1rem] border border-[rgba(92,92,92,0.12)] bg-[rgba(255,255,255,0.5)] px-3 py-2.5">
                <p className="section-label">At a glance</p>
                <p className="text-[0.69rem] leading-5 text-[rgb(107,107,107)]">
                    {atAGlanceLine}
                </p>
            </div>
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                {glanceSignals.map((signal) => (
                    <div
                        key={signal.key}
                        className="rounded-[0.85rem] border border-[rgba(92,92,92,0.12)] bg-[rgba(248,244,237,0.94)] px-2 py-2 sm:rounded-[1.05rem] sm:px-3 sm:py-3"
                    >
                        <div className="flex items-start justify-between gap-1 sm:gap-2">
                            <div className="min-w-0">
                                <p className="truncate text-[0.5rem] font-bold uppercase tracking-[0.09em] text-[rgb(var(--paper-ink-soft))] sm:text-[0.58rem]">{signal.label}</p>
                                <p className="mt-1 text-[0.85rem] font-semibold leading-none text-[rgb(var(--paper-ink))] sm:mt-2 sm:text-[1.1rem]">
                                    {signal.value}
                                </p>
                            </div>
                            {signal.badge && (
                                <span
                                    className="hidden rounded-full px-1.5 py-0.5 text-[0.5rem] font-medium sm:inline-block"
                                    style={{ backgroundColor: `${signal.accent}22`, color: signal.accent }}
                                >
                                    {signal.badge}
                                </span>
                            )}
                        </div>
                        <p className="mt-1 text-[0.52rem] leading-4 text-[rgb(107,107,107)] sm:mt-1.5 sm:text-[0.62rem] sm:leading-5">
                            {signal.note}
                        </p>
                        <div className="mt-1.5 hidden items-end gap-1.5 sm:flex">
                            {signal.meter.map((filled, index) => (
                                <span
                                    key={`${signal.key}-${index}`}
                                    className="block rounded-full"
                                    style={{
                                        width: signal.key === 'threads' ? '8px' : '7px',
                                        height: signal.key === 'threads' ? '8px' : `${10 + index * 2}px`,
                                        backgroundColor: filled ? signal.accent : 'rgba(92,92,92,0.14)',
                                        opacity: filled ? 1 : 0.6,
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            {storyPipelineStages.length > 0 && (
                <div className="rounded-[1.1rem] border border-[rgba(92,92,92,0.12)] bg-[rgba(255,255,255,0.5)] px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <p className="section-label">Story pipeline</p>
                            {storyPipelineCounts.leadSignal && (
                                <p className="mt-1 text-[0.69rem] leading-5 text-[rgb(107,107,107)]">
                                    Top material: {formatNotebookLabel(storyPipelineCounts.leadSignal)}
                                </p>
                            )}
                        </div>
                        <Link href={portfolioHref} className="text-[0.69rem] font-medium text-[rgb(138,154,111)] transition-opacity hover:opacity-80">
                            Open stories
                        </Link>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-1.5 sm:gap-2">
                        {storyPipelineStages.map((stage) => (
                            <div
                                key={stage.label}
                                className="rounded-[0.75rem] border border-[rgba(92,92,92,0.1)] bg-[rgba(248,244,237,0.94)] px-2 py-2 sm:rounded-[1rem] sm:px-3 sm:py-2.5"
                            >
                                <div className="flex items-center gap-1 sm:gap-2">
                                    <span
                                        className="h-2 w-2 shrink-0 rounded-full sm:h-2.5 sm:w-2.5"
                                        style={{ backgroundColor: stage.accent }}
                                    />
                                    <p className="truncate text-[0.56rem] font-semibold uppercase tracking-[0.06em] text-[rgb(107,107,107)] sm:text-[0.64rem] sm:tracking-[0.08em]">
                                        {stage.label}
                                    </p>
                                </div>
                                <p className="mt-1 text-[0.85rem] font-semibold leading-none text-[rgb(var(--paper-ink))] sm:mt-2 sm:text-[1rem]">
                                    {stage.value.toLocaleString()}
                                </p>
                                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[rgba(92,92,92,0.12)] sm:mt-2 sm:h-1.5">
                                    <div
                                        className="h-full rounded-full"
                                        style={{ width: `${stage.progress}%`, backgroundColor: stage.accent }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    ) : null;
    const welcomeNotebookBanner = entries.length === 0 ? (
        <div className="app-paper-soft overflow-hidden rounded-[1.25rem]">
            <div className="relative">
                <Image
                    src="/images/dashboard-welcome-banner.jpg"
                    alt="Open notebook welcoming a new user into Notive before the first saved memory."
                    width={1144}
                    height={768}
                    priority
                    className="h-36 w-full object-cover object-center sm:h-44"
                    sizes="(max-width: 767px) 100vw, 56rem"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(38,34,30,0.06),rgba(38,34,30,0.48))]" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                    <div className="max-w-lg rounded-[1rem] border border-[rgba(92,92,92,0.16)] bg-[rgba(255,251,245,0.82)] px-3 py-3 backdrop-blur-sm">
                        <p className="section-label">Welcome to your notebook</p>
                        <p className="mt-1 text-[0.82rem] leading-6 text-[rgb(var(--paper-ink))]">
                            Capture what happened. Keep what matters.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    ) : null;
    const topPreviewContent = activeTab === 'overview' ? (
        <>
            {glanceStrip}


            <DailyCheckIn
                hasCheckedInToday={hasCheckedInToday}
                todayMood={todayCheckInMood}
                onSubmit={onDailyCheckIn}
            />

            <h2 className="notive-logo italic text-lg font-semibold leading-snug md:text-2xl">
                {daysSinceLastEntry !== null && daysSinceLastEntry >= 5
                    ? `You've been away ${daysSinceLastEntry} days. No pressure — one sentence is enough.`
                        : daysSinceLastEntry !== null && daysSinceLastEntry >= 2
                            ? `It's been ${daysSinceLastEntry} days. A lot can happen — what's worth keeping?`
                            : moodShift?.type === 'shift'
                                ? `Your mood moved from ${moodShift.from} to ${moodShift.to} lately.`
                            : moodShift?.type === 'steady'
                                ? `The mood has stayed at ${moodShift.mood} lately — that's worth noticing.`
                                : notesThisWeek > 0
                                    ? `${notesThisWeek} ${notesThisWeek === 1 ? 'memory' : 'memories'} this week${returningThemes > 0 ? `, ${returningThemes} returning ${returningThemes === 1 ? 'theme' : 'themes'}` : ''}.`
                                    : `Hey ${firstName ?? 'there'} — your notebook is ready.`}
            </h2>

            {welcomeNotebookBanner}

            {heroContent}

            {/* ── Intelligence strip ── */}
            <div className="border-t border-[rgba(92,92,92,0.14)] pt-3 space-y-2">
                <p className="section-label">What Notive sees right now</p>

                {/* Row 1 — Mood Micro-Shift + Writing Energy */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-[0.95rem] border border-[rgba(92,92,92,0.12)] bg-[rgba(255,255,255,0.52)] px-2.5 py-2">
                        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[rgb(107,107,107)]">Mood shift</p>
                        {moodShift ? (
                            moodShift.type === 'shift' ? (
                                <p className="mt-0.5 text-[0.73rem] leading-5 text-[rgb(var(--paper-ink))]">
                                    {moodEmojiFor(moodShift.from)} → {moodEmojiFor(moodShift.to)}
                                    <span className="block text-[0.65rem] text-[rgb(107,107,107)]">{toTitleCase(moodShift.from)} → {toTitleCase(moodShift.to)}</span>
                                </p>
                            ) : (
                                <p className="mt-0.5 text-[0.73rem] leading-5 text-[rgb(var(--paper-ink))]">
                                    {moodEmojiFor(moodShift.mood)} {toTitleCase(moodShift.mood)}
                                    <span className="block text-[0.65rem] text-[rgb(107,107,107)]">{moodShift.streak}× in a row</span>
                                </p>
                            )
                        ) : (
                            <p className="mt-0.5 text-[0.65rem] leading-4 text-[rgb(107,107,107)]">Save two memories to see a shift.</p>
                        )}
                    </div>
                    <div className="rounded-[0.95rem] border border-[rgba(92,92,92,0.12)] bg-[rgba(255,255,255,0.52)] px-2.5 py-2">
                        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[rgb(107,107,107)]">Writing energy</p>
                        {writingEnergy ? (
                            <p className="mt-0.5 text-[0.73rem] leading-5 text-[rgb(var(--paper-ink))]">
                                <span className={writingEnergy.trend === 'up' ? 'sprout-accent' : writingEnergy.trend === 'down' ? 'text-[rgb(180,120,80)]' : 'text-[rgb(107,107,107)]'}>
                                    {writingEnergy.trend === 'up' ? '↑' : writingEnergy.trend === 'down' ? '↓' : '→'} {writingEnergy.thisWeek.toLocaleString()}w
                                </span>
                                <span className="block text-[0.65rem] text-[rgb(107,107,107)]">vs {writingEnergy.lastWeek.toLocaleString()}w last week</span>
                            </p>
                        ) : (
                            <p className="mt-0.5 text-[0.65rem] leading-4 text-[rgb(107,107,107)]">Write this week to see energy.</p>
                        )}
                    </div>
                </div>

                {/* Row 2 — Contradiction Spotlight OR Memory Echo */}
                {dashboardInsights?.contradictions[0] ? (
                    <div className="rounded-[0.95rem] border border-[rgba(92,92,92,0.12)] bg-[rgba(255,255,255,0.52)] px-2.5 py-2">
                        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[rgb(107,107,107)]">Notive noticed a gap</p>
                        <p className="mt-0.5 text-[0.73rem] leading-5 text-[rgb(var(--paper-ink))]">
                            {compactText(dashboardInsights.contradictions[0].description, 110)}
                        </p>
                    </div>
                ) : resurfacedMoment ? (
                    <Link
                        href={openDashboardEntryHref(resurfacedMoment.matchedEntry.id)}
                        className="block rounded-[0.95rem] border border-[rgba(138,154,111,0.25)] bg-[rgba(138,154,111,0.06)] px-2.5 py-2 transition-opacity hover:opacity-80"
                    >
                        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] sprout-accent">Echo from the past</p>
                        <p className="mt-0.5 text-[0.73rem] leading-5 text-[rgb(var(--paper-ink))]">
                            {compactText(resurfacedMoment.matchedEntry.contentPreview, 100)}
                        </p>
                        <p className="mt-0.5 text-[0.6rem] text-[rgb(107,107,107)]">
                            {new Date(resurfacedMoment.matchedEntry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · Tap to revisit →
                        </p>
                    </Link>
                ) : heroInsight?.body ? (
                    <div className="rounded-[0.95rem] border border-[rgba(92,92,92,0.12)] bg-[rgba(255,255,255,0.52)] px-2.5 py-2">
                        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[rgb(107,107,107)]">Pattern insight</p>
                        <p className="mt-0.5 text-[0.73rem] leading-5 text-[rgb(var(--paper-ink))]">
                            {compactText(heroInsight.body, 120)}
                        </p>
                    </div>
                ) : noticedItems[0] ? (
                    <div className="rounded-[0.95rem] border border-[rgba(92,92,92,0.12)] bg-[rgba(255,255,255,0.52)] px-2.5 py-2">
                        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[rgb(107,107,107)]">Recurring thread</p>
                        <p className="mt-0.5 text-[0.73rem] leading-5 text-[rgb(var(--paper-ink))]">{noticedItems[0]}</p>
                    </div>
                ) : null}

                {/* Row 3 — Follow-up question */}
                {todayBrief?.followUpPrompt && (
                    <Link
                        href={`${recommendedHref}&prompt=${encodeURIComponent(todayBrief.followUpPrompt)}`}
                        className="block rounded-[0.95rem] border border-[rgba(92,92,92,0.12)] bg-[rgba(255,255,255,0.52)] px-2.5 py-2 transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(92,92,92,0.08)]"
                    >
                        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[rgb(107,107,107)]">One question for today</p>
                        <p className="mt-0.5 text-[0.73rem] leading-5 text-[rgb(var(--paper-ink))]">
                            {compactText(todayBrief.followUpPrompt, 100)} →
                        </p>
                    </Link>
                )}
            </div>
        </>
    ) : activeTab === 'growth' ? (
        <div className="space-y-2.5" data-snapshot-root>
            <style>{`
                @media print {
                    body * { visibility: hidden !important; }
                    [data-snapshot-root], [data-snapshot-root] * { visibility: visible !important; }
                    [data-snapshot-root] { position: absolute !important; left: 0; top: 0; width: 100%; padding: 24px; }
                    [data-print-hide] { display: none !important; }
                }
            `}</style>
            {/* Identity: traits + archetype */}
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <p className="section-label">Growth</p>
                    {writerDNA.traits.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                            {writerDNA.traits.map((trait) => (
                                <span key={trait.label} className="notebook-chip rounded-full px-2 py-0.5 text-[0.62rem] font-medium">
                                    {toTitleCase(String(trait.label).replace(/[_-]+/g, ' '))}
                                </span>
                            ))}
                        </div>
                    )}
                    <p className="mt-1 text-[0.72rem] italic font-serif text-[rgb(140,140,140)]">
                        &ldquo;{writerDNA.archetype.oneLiner}&rdquo;
                    </p>
                </div>
                <button
                    type="button"
                    data-print-hide
                    onClick={() => { if (typeof window !== 'undefined') window.print(); }}
                    className="shrink-0 rounded-full border border-[rgba(92,92,92,0.15)] bg-[rgba(255,255,255,0.6)] px-2.5 py-1 text-[0.6rem] font-medium text-[rgb(107,107,107)] transition-colors hover:bg-[rgba(138,154,111,0.1)] hover:text-[rgb(118,134,91)]"
                    aria-label="Save Growth snapshot as PDF"
                >
                    ⤓ Save snapshot
                </button>
            </div>

            {/* Period comparison — this month vs last month */}
            {periodDelta.hasSignal ? (
                <div className="app-paper-soft rounded-[1.1rem] px-3 pt-2.5 pb-2">
                    <div className="flex items-baseline justify-between">
                        <p className="section-label">This month vs {periodDelta.periodLabel}</p>
                        {periodDelta.currentTopMood && (
                            <span className="text-[0.55rem] text-[rgb(140,140,140)]">
                                {moodEmojiFor(periodDelta.currentTopMood)} {toTitleCase(periodDelta.currentTopMood)}
                            </span>
                        )}
                    </div>
                    <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                        {(() => {
                            const formatDelta = (delta: number, previous: number) => {
                                if (delta === 0) return { text: 'unchanged', tone: 'neutral' as const };
                                const sign = delta > 0 ? '+' : '';
                                const tone: 'up' | 'down' = delta > 0 ? 'up' : 'down';
                                const pct = previous > 0 ? Math.round((delta / previous) * 100) : null;
                                return {
                                    text: pct !== null ? `${sign}${delta} (${sign}${pct}%)` : `${sign}${delta}`,
                                    tone,
                                };
                            };
                            const entriesD = formatDelta(periodDelta.entriesDelta, periodDelta.previousEntries);
                            const daysD = formatDelta(periodDelta.writingDaysDelta, periodDelta.previousWritingDays);
                            const moodDeltaRounded = periodDelta.moodDelta !== null
                                ? Math.round(periodDelta.moodDelta * 10) / 10
                                : null;
                            const moodTone: 'up' | 'down' | 'neutral' =
                                moodDeltaRounded === null || moodDeltaRounded === 0 ? 'neutral'
                                    : moodDeltaRounded > 0 ? 'up' : 'down';
                            const toneClass = (tone: 'up' | 'down' | 'neutral') =>
                                tone === 'up' ? 'text-[rgb(118,134,91)]'
                                    : tone === 'down' ? 'text-[rgb(170,130,80)]'
                                        : 'text-[rgb(140,140,140)]';

                            return (
                                <>
                                    <div className="rounded-[0.85rem] border border-[rgba(92,92,92,0.1)] bg-[rgba(255,255,255,0.55)] px-2 py-1.5">
                                        <p className="text-[0.48rem] uppercase tracking-wider text-[rgb(150,150,150)]">Memories</p>
                                        <p className="mt-0.5 text-[0.9rem] font-bold tabular-nums text-[rgb(var(--paper-ink))]">
                                            {periodDelta.currentEntries}
                                        </p>
                                        <p className={`text-[0.52rem] font-medium tabular-nums ${toneClass(entriesD.tone)}`}>
                                            {entriesD.text}
                                        </p>
                                    </div>
                                    <div className="rounded-[0.85rem] border border-[rgba(92,92,92,0.1)] bg-[rgba(255,255,255,0.55)] px-2 py-1.5">
                                        <p className="text-[0.48rem] uppercase tracking-wider text-[rgb(150,150,150)]">Days</p>
                                        <p className="mt-0.5 text-[0.9rem] font-bold tabular-nums text-[rgb(var(--paper-ink))]">
                                            {periodDelta.currentWritingDays}
                                        </p>
                                        <p className={`text-[0.52rem] font-medium tabular-nums ${toneClass(daysD.tone)}`}>
                                            {daysD.text}
                                        </p>
                                    </div>
                                    <div className="rounded-[0.85rem] border border-[rgba(92,92,92,0.1)] bg-[rgba(255,255,255,0.55)] px-2 py-1.5">
                                        <p className="text-[0.48rem] uppercase tracking-wider text-[rgb(150,150,150)]">Mood</p>
                                        <p className="mt-0.5 text-[0.9rem] font-bold tabular-nums text-[rgb(var(--paper-ink))]">
                                            {periodDelta.currentAvgMood !== null
                                                ? periodDelta.currentAvgMood.toFixed(1)
                                                : '—'}
                                        </p>
                                        <p className={`text-[0.52rem] font-medium tabular-nums ${toneClass(moodTone)}`}>
                                            {moodDeltaRounded === null ? 'no data'
                                                : moodDeltaRounded === 0 ? 'unchanged'
                                                    : `${moodDeltaRounded > 0 ? '+' : ''}${moodDeltaRounded.toFixed(1)}`}
                                        </p>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                    {periodDelta.previousTopMood && periodDelta.currentTopMood && periodDelta.previousTopMood !== periodDelta.currentTopMood && (
                        <p className="mt-1.5 text-[0.6rem] leading-4 text-[rgb(140,140,140)]">
                            Top mood moved from {toTitleCase(periodDelta.previousTopMood)} to {toTitleCase(periodDelta.currentTopMood)}.
                        </p>
                    )}
                </div>
            ) : entries.length > 0 ? (
                <div className="app-paper-soft rounded-[1.1rem] px-3 pt-2 pb-1.5">
                    <p className="section-label">Month-over-month</p>
                    <p className="mt-0.5 text-[0.6rem] leading-4 text-[rgb(150,150,150)]">
                        Your first month-over-month comparison unlocks once last month has a few memories to compare against.
                    </p>
                </div>
            ) : null}

            {/* Core growth signals — 3 gauge rings */}
            <div className="app-paper-soft rounded-[1.1rem] px-3 pt-2.5 pb-2">
                <div className="grid grid-cols-3 divide-x divide-[rgba(92,92,92,0.06)]">
                    {/* Reflection Depth */}
                    {(() => {
                        const depth = dashboardInsights?.reflectionDepth;
                        const level = depth?.level ?? 0;
                        const score = Math.max(0, Math.min(100, depth?.score ?? 0));
                        return (
                            <div className="flex flex-col items-center gap-0.5 px-2 py-1">
                                <div className="relative h-9 w-9">
                                    <svg viewBox="0 0 32 32" className="h-9 w-9 -rotate-90">
                                        <circle cx="16" cy="16" r="13" fill="none" stroke="rgba(92,92,92,0.06)" strokeWidth="2.5" />
                                        <circle cx="16" cy="16" r="13" fill="none" stroke="rgb(138,154,111)" strokeWidth="2.5" strokeLinecap="round"
                                            strokeDasharray={`${(score / 100) * 81.7} 81.7`} />
                                    </svg>
                                    <span className="absolute inset-0 flex items-center justify-center text-[0.6rem] font-bold tabular-nums text-[rgb(var(--paper-ink))]">L{level}</span>
                                </div>
                                <span className="text-[0.52rem] font-semibold text-[rgb(var(--paper-ink))]">Depth</span>
                                <span className="text-[0.44rem] text-[rgb(150,150,150)]">{depth?.levelLabel ?? 'Surface'}</span>
                            </div>
                        );
                    })()}
                    {/* Growth Mindset */}
                    {(() => {
                        const ratio = journalIntel?.growthLanguage?.mindsetRatio ?? 0.5;
                        const trend = journalIntel?.growthLanguage?.recentTrend ?? 'stable';
                        const pct = Math.round(ratio * 100);
                        return (
                            <div className="flex flex-col items-center gap-0.5 px-2 py-1">
                                <div className="relative h-9 w-9">
                                    <svg viewBox="0 0 32 32" className="h-9 w-9 -rotate-90">
                                        <circle cx="16" cy="16" r="13" fill="none" stroke="rgba(92,92,92,0.06)" strokeWidth="2.5" />
                                        <circle cx="16" cy="16" r="13" fill="none" stroke={ratio >= 0.6 ? 'rgb(138,154,111)' : 'rgb(192,160,100)'} strokeWidth="2.5" strokeLinecap="round"
                                            strokeDasharray={`${ratio * 81.7} 81.7`} />
                                    </svg>
                                    <span className="absolute inset-0 flex items-center justify-center text-[0.55rem] font-bold tabular-nums text-[rgb(var(--paper-ink))]">{pct}%</span>
                                </div>
                                <span className="text-[0.52rem] font-semibold text-[rgb(var(--paper-ink))]">Mindset</span>
                                <span className="text-[0.44rem] text-[rgb(150,150,150)]">{trend === 'increasing' ? '↗ Growing' : trend === 'decreasing' ? '↘ Shifting' : '→ Steady'}</span>
                            </div>
                        );
                    })()}
                    {/* Emotional Intelligence */}
                    {(() => {
                        const eq = journalIntel?.emotionalRange;
                        const complexity = Math.max(0, Math.min(100, eq?.complexityScore ?? 0));
                        const uniqueCount = eq?.uniqueEmotions ?? 0;
                        return (
                            <div className="flex flex-col items-center gap-0.5 px-2 py-1">
                                <div className="relative h-9 w-9">
                                    <svg viewBox="0 0 32 32" className="h-9 w-9 -rotate-90">
                                        <circle cx="16" cy="16" r="13" fill="none" stroke="rgba(92,92,92,0.06)" strokeWidth="2.5" />
                                        <circle cx="16" cy="16" r="13" fill="none" stroke="rgb(160,140,200)" strokeWidth="2.5" strokeLinecap="round"
                                            strokeDasharray={`${(complexity / 100) * 81.7} 81.7`} />
                                    </svg>
                                    <span className="absolute inset-0 flex items-center justify-center text-[0.55rem] font-bold tabular-nums text-[rgb(var(--paper-ink))]">{uniqueCount}</span>
                                </div>
                                <span className="text-[0.52rem] font-semibold text-[rgb(var(--paper-ink))]">EQ</span>
                                <span className="text-[0.44rem] text-[rgb(150,150,150)]">{complexity >= 70 ? 'Complex' : complexity >= 40 ? 'Growing' : 'Building'}</span>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* Growth metrics — 2×2 grid */}
            <div className="grid grid-cols-2 gap-2">
                {/* Vocabulary */}
                <div className="app-paper-soft rounded-[1.1rem] px-3 pt-2.5 pb-2">
                    <p className="section-label">Vocabulary</p>
                    <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-lg font-bold tabular-nums text-[rgb(var(--paper-ink))]">
                            {journalIntel?.vocabulary.totalUniqueWords ?? 0}
                        </span>
                        <span className="text-[0.5rem] text-[rgb(150,150,150)]">words</span>
                        {(journalIntel?.vocabulary.growthRate ?? 0) > 0 && (
                            <span className="ml-auto rounded-full bg-[rgba(138,154,111,0.1)] px-1.5 py-px text-[0.46rem] font-semibold text-[rgb(118,134,91)]">
                                ↑{Math.round(journalIntel?.vocabulary.growthRate ?? 0)}%
                            </span>
                        )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-[0.46rem] text-[rgb(150,150,150)]">Richness</span>
                        <div className="flex-1 h-[3px] rounded-full bg-[rgba(92,92,92,0.06)] overflow-hidden">
                            <div className="h-full rounded-full bg-[rgb(138,154,111)]" style={{ width: `${Math.min(100, Math.round((journalIntel?.vocabulary.richness ?? 0) * 100))}%` }} />
                        </div>
                    </div>
                </div>
                {/* Gratitude */}
                <div className="app-paper-soft rounded-[1.1rem] px-3 pt-2.5 pb-2">
                    <p className="section-label">Gratitude</p>
                    <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-lg font-bold tabular-nums text-[rgb(var(--paper-ink))]">
                            {journalIntel?.gratitude.totalExpressions ?? 0}
                        </span>
                        <span className="text-[0.5rem] text-[rgb(150,150,150)]">moments</span>
                        {(journalIntel?.gratitude.streak ?? 0) > 1 && (
                            <span className="ml-auto rounded-full bg-[rgba(138,154,111,0.1)] px-1.5 py-px text-[0.46rem] font-semibold text-[rgb(118,134,91)]">
                                🔥{journalIntel?.gratitude.streak}d
                            </span>
                        )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-[0.46rem] text-[rgb(150,150,150)]">Depth</span>
                        <div className="flex-1 h-[3px] rounded-full bg-[rgba(92,92,92,0.06)] overflow-hidden">
                            <div className="h-full rounded-full bg-[rgb(138,154,111)]" style={{ width: `${Math.min(100, Math.max(0, Math.round(journalIntel?.gratitude.depthScore ?? 0)))}%` }} />
                        </div>
                    </div>
                </div>
                {/* Life Balance */}
                <div className="app-paper-soft rounded-[1.1rem] px-3 pt-2.5 pb-2">
                    <p className="section-label">Life balance</p>
                    <div className="mt-1.5 space-y-[3px]">
                        {visibleLifeBalanceAreas.slice(0, 4).map((area) => (
                            <div key={area.area} className="flex items-center gap-1.5">
                                <span className="w-[2.8rem] text-[0.46rem] text-[rgb(140,140,140)] truncate">{formatNotebookLabel(area.area)}</span>
                                <div className="flex-1 h-[3px] rounded-full bg-[rgba(92,92,92,0.05)] overflow-hidden">
                                    <div className="h-full rounded-full bg-[rgb(138,154,111)]" style={{ width: `${Math.min(100, Math.round(area.score * 100))}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                    {!hasLifeBalanceSignal && (
                        <p className="mt-1 text-[0.5rem] text-[rgb(170,170,170)]">More entries reveal balance.</p>
                    )}
                </div>
                {/* Writing Voice */}
                <div className="app-paper-soft rounded-[1.1rem] px-3 pt-2.5 pb-2">
                    <p className="section-label">Writing voice</p>
                    {(() => {
                        const voice = journalIntel?.writingVoice;
                        const tense = voice?.tenseDistribution ?? { past: 33, present: 34, future: 33 };
                        return (
                            <>
                                <div className="mt-1.5 flex h-[3px] rounded-full overflow-hidden">
                                    <div className="h-full bg-[rgba(160,140,200,0.6)]" style={{ width: `${tense.past}%` }} />
                                    <div className="h-full bg-[rgb(138,154,111)]" style={{ width: `${tense.present}%` }} />
                                    <div className="h-full bg-[rgba(120,170,200,0.7)]" style={{ width: `${tense.future}%` }} />
                                </div>
                                <div className="mt-1 flex justify-between text-[0.42rem] text-[rgb(150,150,150)]">
                                    <span>Past {tense.past}%</span>
                                    <span>Now {tense.present}%</span>
                                    <span>Future {tense.future}%</span>
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-[0.46rem] text-[rgb(140,140,140)]">
                                    {voice?.questionFrequency !== undefined && (
                                        <span>{voice.questionFrequency.toFixed(1)} Q/entry</span>
                                    )}
                                    {voice?.readingLevel && <span className="ml-auto">{voice.readingLevel}</span>}
                                </div>
                            </>
                        );
                    })()}
                </div>
            </div>

            {/* Growth thread + Story material — compact 2-col */}
            <div className="grid gap-2 sm:grid-cols-2">
                <div className="app-paper-soft rounded-[1.1rem] px-3 pt-2.5 pb-2">
                    <p className="section-label">{weeklyDigest ? 'Week in one line' : 'Growth thread'}</p>
                    <p className="mt-1 text-[0.78rem] font-semibold leading-5 text-[rgb(var(--paper-ink))]">
                        {weeklyDigest?.title || growthSummary}
                    </p>
                    <p className="mt-1 text-[0.68rem] leading-[1.35] text-[rgb(107,107,107)]">
                        {weeklyDigestSnippet || growthEvidence}
                    </p>
                    {typeof weeklyDigest?.entryCount === 'number' && weeklyDigest.entryCount > 0 && (
                        <p className="mt-1 text-[0.52rem] uppercase tracking-[0.08em] text-[rgb(140,140,140)]">
                            {weeklyDigest.entryCount} reflection{weeklyDigest.entryCount === 1 ? '' : 's'} this week
                        </p>
                    )}
                    {weeklyDigestHighlights.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                            {weeklyDigestHighlights.map((item) => (
                                <span key={`${item.category}-${item.insight}`} className="rounded-full border border-[rgba(92,92,92,0.12)] bg-[rgba(255,255,255,0.54)] px-2 py-0.5 text-[0.52rem] text-[rgb(107,107,107)]">
                                    {item.category}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                <div className="app-paper-soft rounded-[1.1rem] px-3 pt-2.5 pb-2">
                    <p className="section-label">Story material</p>
                    <div className="mt-1 space-y-1">
                        {(growthLedgerItems.length > 0 ? growthLedgerItems : [threadSentence]).slice(0, 3).map((item) => (
                            <div key={item} className="flex items-start gap-1.5">
                                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(138,154,111)]" />
                                <p className="text-[0.65rem] leading-4 text-[rgb(107,107,107)]">{item}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Carry this forward — compact */}
            <div className="app-paper-soft rounded-[1.1rem] px-3 pt-2.5 pb-2">
                <p className="section-label">Carry this forward</p>
                <p className="mt-1 text-[0.68rem] leading-[1.35] text-[rgb(107,107,107)]">
                    {resurfacedMoment
                        ? 'An older memory is echoing this week. Growth often looks like noticing the same moment sooner.'
                        : 'Keep saving real moments. They become evidence for school, work, and your own story.'}
                </p>
                <div className="mt-1.5 flex items-center gap-3">
                    <Link href={portfolioHref} className="text-[0.68rem] font-medium text-[rgb(138,154,111)] transition-opacity hover:opacity-80">
                        See this as a story for college/apps →
                    </Link>
                </div>
            </div>
        </div>
    ) : entries.length < 3 ? (
        <div className="space-y-2.5">
            <div className="app-paper-soft rounded-[1.1rem] px-3 pt-4 pb-3.5 text-center">
                <p className="section-label">Patterns</p>
                <p className="mt-2 text-[0.72rem] leading-5 text-[rgb(107,107,107)]">
                    Your rhythms, moods and anchors will show up here once you have a few memories to compare.
                </p>
                <p className="mt-1 text-[0.62rem] leading-4 text-[rgb(150,150,150)]">
                    {entries.length === 0 ? 'Start with a short memory from today.' : `${3 - entries.length} more ${3 - entries.length === 1 ? 'memory' : 'memories'} to unlock patterns.`}
                </p>
            </div>
        </div>
    ) : (
        <div className="space-y-2.5">
            {/* ── Emotional thread — hero visualization ── */}
            <div className="app-paper-soft rounded-[1.1rem] px-3 pt-3 pb-2.5">
                <div className="flex items-baseline justify-between">
                    <p className="section-label">Emotional thread</p>
                    {moodShift && (
                        <span className={`rounded-full px-2 py-0.5 text-[0.55rem] font-medium tracking-wide ${
                            moodShift.type === 'shift'
                                ? 'bg-[rgba(192,160,100,0.12)] text-[rgb(160,130,70)]'
                                : 'bg-[rgba(138,154,111,0.12)] text-[rgb(118,134,91)]'
                        }`}>
                            {moodShift.type === 'shift' ? `${moodShift.from} → ${moodShift.to}` : `stable · ${moodShift.mood}`}
                        </span>
                    )}
                </div>
                <div className="mt-1.5 rounded-[0.75rem] bg-[rgba(255,255,255,0.5)] px-1 pt-1 pb-0.5">
                    <svg
                        viewBox="0 0 440 120"
                        className="h-[7.5rem] w-full"
                        role="img"
                        aria-label={
                            moodShift
                                ? moodShift.type === 'shift'
                                    ? `Emotional thread across recent entries, shifting from ${moodShift.from} toward ${moodShift.to}.`
                                    : `Emotional thread across recent entries, stable around ${moodShift.mood}.`
                                : 'Emotional thread showing mood changes over recent entries.'
                        }
                    >
                        {/* Gradient fill under curve */}
                        <defs>
                            <linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#8A9A6F" stopOpacity="0.18" />
                                <stop offset="100%" stopColor="#8A9A6F" stopOpacity="0.02" />
                            </linearGradient>
                        </defs>

                        {/* Zone bands */}
                        <rect x="18" y="24" width="404" height="20" rx="3" fill="rgba(138,154,111,0.04)" />
                        <rect x="18" y="68" width="404" height="20" rx="3" fill="rgba(192,134,90,0.04)" />

                        {/* Y-axis labels */}
                        <text x="14" y="34" fontSize="6.5" fill="rgba(138,154,111,0.7)" textAnchor="end" fontWeight="500">good</text>
                        <text x="14" y="56" fontSize="6.5" fill="rgba(92,92,92,0.35)" textAnchor="end">neutral</text>
                        <text x="14" y="80" fontSize="6.5" fill="rgba(192,134,90,0.6)" textAnchor="end">low</text>

                        {/* Guide lines */}
                        <line x1="18" y1="30" x2="422" y2="30" stroke="rgba(138,154,111,0.12)" strokeWidth="0.5" strokeDasharray="3 4" />
                        <line x1="18" y1="50" x2="422" y2="50" stroke="rgba(92,92,92,0.07)" strokeWidth="0.5" strokeDasharray="3 4" />
                        <line x1="18" y1="70" x2="422" y2="70" stroke="rgba(92,92,92,0.07)" strokeWidth="0.5" strokeDasharray="3 4" />
                        <line x1="18" y1="84" x2="422" y2="84" stroke="rgba(192,134,90,0.10)" strokeWidth="0.5" strokeDasharray="3 4" />

                        {/* Area fill under curve */}
                        {emotionalThreadPoints.length >= 2 && (
                            <path
                                d={`${emotionalThreadPath} L ${emotionalThreadPoints[emotionalThreadPoints.length - 1].x} 95 L ${emotionalThreadPoints[0].x} 95 Z`}
                                fill="url(#moodFill)"
                            />
                        )}

                        {/* The mood curve */}
                        <path d={emotionalThreadPath} fill="none" stroke="#8A9A6F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

                        {/* Data points */}
                        {emotionalThreadPoints.map((point) => (
                            <g key={`pt-${point.x}-${point.label}`}>
                                <circle cx={point.x} cy={point.y} r="6" fill="#8A9A6F" opacity="0.08" />
                                <circle cx={point.x} cy={point.y} r="3.2" fill="#F8F4ED" stroke="#5C5C5C" strokeWidth="1.3" />
                                {point.mood && (
                                    <text x={point.x} y={Math.max(14, point.y - 9)} textAnchor="middle" fontSize="8.5">
                                        {moodEmojiFor(point.mood)}
                                    </text>
                                )}
                                <text x={point.x} y="103" textAnchor="middle" fontSize="7" fontWeight="500" fill="#5C5C5C">{point.label}</text>
                                {point.mood && (
                                    <text x={point.x} y="112" textAnchor="middle" fontSize="5.5" fill="#9A9A9A">{point.mood}</text>
                                )}
                            </g>
                        ))}
                    </svg>
                </div>
                <p className="mt-1.5 text-[0.72rem] leading-5 text-[rgb(107,107,107)]">{emotionalThreadLine}</p>
            </div>

            {/* ── Activity heatmap — macro rhythm view ── */}
            {entries.length >= 5 ? (
                <div className="app-paper-soft rounded-[1.1rem] px-3 pt-3 pb-2.5">
                    <div className="flex items-baseline justify-between">
                        <p className="section-label">Writing rhythm</p>
                        <span className="text-[0.58rem] text-[rgb(140,140,140)] tabular-nums">
                            {heatmapTotal} {heatmapTotal === 1 ? 'memory' : 'memories'} · 6 months
                        </span>
                    </div>
                    <div className="mt-2 overflow-x-auto">
                        <svg
                            viewBox={`0 0 ${HEATMAP_WEEKS * 10 + 14} ${7 * 10 + 14}`}
                            className="w-full"
                            style={{ minWidth: '260px', maxHeight: '100px' }}
                            aria-label={`Writing activity heatmap showing ${heatmapTotal} memories over the last ${HEATMAP_WEEKS} weeks`}
                        >
                            {['M', 'W', 'F'].map((label, i) => (
                                <text
                                    key={label}
                                    x={0}
                                    y={14 + (i * 2 + 1) * 10 + 7}
                                    fontSize="6.5"
                                    fill="rgba(92,92,92,0.5)"
                                >
                                    {label}
                                </text>
                            ))}
                            {activityHeatmap.map((week, wi) => (
                                <g key={`w-${wi}`}>
                                    {week.map((cell, di) => {
                                        const isFuture = cell.date > new Date();
                                        const fill = isFuture
                                            ? 'rgba(92,92,92,0.03)'
                                            : cell.level === 0 ? 'rgba(92,92,92,0.08)'
                                                : cell.level === 1 ? 'rgba(138,154,111,0.35)'
                                                    : cell.level === 2 ? 'rgba(138,154,111,0.55)'
                                                        : cell.level === 3 ? 'rgba(138,154,111,0.78)'
                                                            : 'rgba(118,134,91,0.95)';
                                        const isSelected = heatmapTap?.key === cell.key;
                                        return (
                                            <rect
                                                key={cell.key}
                                                x={14 + wi * 10}
                                                y={14 + di * 10}
                                                width={8}
                                                height={8}
                                                rx={1.5}
                                                fill={fill}
                                                stroke={isSelected ? 'rgb(118,134,91)' : 'none'}
                                                strokeWidth={isSelected ? 1.2 : 0}
                                                style={{ cursor: isFuture ? 'default' : 'pointer' }}
                                                onClick={() => {
                                                    if (isFuture) return;
                                                    setHeatmapTap(isSelected ? null : cell);
                                                }}
                                            >
                                                <title>{cell.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}: {cell.count} {cell.count === 1 ? 'memory' : 'memories'}</title>
                                            </rect>
                                        );
                                    })}
                                </g>
                            ))}
                        </svg>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-[0.55rem] text-[rgb(150,150,150)]">
                            {heatmapTap
                                ? `${heatmapTap.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${heatmapTap.count} ${heatmapTap.count === 1 ? 'memory' : 'memories'}`
                                : currentStreak > 0 ? `${currentStreak}-day streak · tap a square` : 'Tap a square to see details'}
                        </span>
                        <div className="flex items-center gap-1 text-[0.55rem] text-[rgb(150,150,150)]">
                            <span>less</span>
                            {[0, 1, 2, 3, 4].map((level) => (
                                <span
                                    key={level}
                                    className="inline-block h-[7px] w-[7px] rounded-[1.5px]"
                                    style={{
                                        backgroundColor: level === 0 ? 'rgba(92,92,92,0.08)'
                                            : level === 1 ? 'rgba(138,154,111,0.35)'
                                                : level === 2 ? 'rgba(138,154,111,0.55)'
                                                    : level === 3 ? 'rgba(138,154,111,0.78)'
                                                        : 'rgba(118,134,91,0.95)',
                                    }}
                                />
                            ))}
                            <span>more</span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="app-paper-soft rounded-[1.1rem] px-3 pt-3 pb-2.5">
                    <p className="section-label">Writing rhythm</p>
                    <p className="mt-1 text-[0.65rem] leading-4 text-[rgb(150,150,150)]">
                        Your rhythm appears after a few more entries.
                    </p>
                </div>
            )}

            {/* ── When you write (days + windows merged) ── */}
            <div className="app-paper-soft rounded-[1.1rem] px-3 pt-3 pb-2.5">
                <div className="flex items-baseline justify-between">
                    <p className="section-label">When you write</p>
                    <span className="text-[0.52rem] text-[rgb(170,170,170)] uppercase tracking-wider">days · windows</span>
                </div>

                {/* Weekday bars */}
                <div className="mt-2 flex items-end justify-between gap-0.5 px-0.5">
                    {weekdayCounts.map((day) => {
                        const barH = highestWeekdayCount > 0
                            ? Math.max(4, Math.round((day.count / highestWeekdayCount) * 36))
                            : 4;
                        const isActive = day.count > 0;
                        const content = (
                            <>
                                <span className={`text-[0.52rem] tabular-nums ${isActive ? 'font-semibold text-[rgb(var(--paper-ink))]' : 'text-transparent'}`}>
                                    {day.count}
                                </span>
                                <div
                                    className={`w-full max-w-[18px] rounded-t-[3px] ${isActive ? 'bg-[rgb(138,154,111)]' : 'bg-[rgba(92,92,92,0.07)]'}`}
                                    style={{ height: `${barH}px` }}
                                />
                                <span className={`text-[0.55rem] ${isActive ? 'font-medium text-[rgb(var(--paper-ink))]' : 'text-[rgb(170,170,170)]'}`}>
                                    {day.short}
                                </span>
                            </>
                        );
                        return isActive ? (
                            <Link
                                key={day.short}
                                href={`/timeline?weekday=${day.full.toLowerCase()}`}
                                className="flex flex-col items-center gap-1 rounded-[0.4rem] py-0.5 transition-colors hover:bg-[rgba(138,154,111,0.08)]"
                                style={{ flex: 1 }}
                            >
                                {content}
                            </Link>
                        ) : (
                            <div key={day.short} className="flex flex-col items-center gap-1" style={{ flex: 1 }}>
                                {content}
                            </div>
                        );
                    })}
                </div>

                {/* Divider */}
                <div className="mt-3 mb-2 h-px bg-[rgba(92,92,92,0.08)]" />

                {/* Time-of-day windows */}
                <div className="space-y-[0.45rem]">
                    {writingWindowCounts.map((bucket) => {
                        const pct = highestWindowCount > 0 ? Math.max(4, Math.round((bucket.count / highestWindowCount) * 100)) : 4;
                        const isTop = bucket.count === highestWindowCount && bucket.count > 0;
                        const isActive = bucket.count > 0;
                        const row = (
                            <>
                                <span className={`w-[3.2rem] text-[0.62rem] ${isTop ? 'font-semibold text-[rgb(var(--paper-ink))]' : 'text-[rgb(140,140,140)]'}`}>
                                    {bucket.label}
                                </span>
                                <div className="flex-1 h-[0.4rem] rounded-full bg-[rgba(92,92,92,0.05)] overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${isTop ? 'bg-[rgb(138,154,111)]' : 'bg-[rgba(138,154,111,0.4)]'}`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                <span className={`w-4 text-right text-[0.55rem] tabular-nums ${isTop ? 'font-semibold text-[rgb(var(--paper-ink))]' : 'text-[rgb(170,170,170)]'}`}>
                                    {bucket.count || '–'}
                                </span>
                            </>
                        );
                        return isActive ? (
                            <Link
                                key={bucket.label}
                                href={`/timeline?dayPart=${encodeURIComponent(bucket.phrase)}`}
                                className="flex items-center gap-2 rounded-[0.5rem] -mx-1 px-1 py-0.5 transition-colors hover:bg-[rgba(138,154,111,0.06)]"
                            >
                                {row}
                            </Link>
                        ) : (
                            <div key={bucket.label} className="flex items-center gap-2">
                                {row}
                            </div>
                        );
                    })}
                </div>

                {/* Combined footer: insight + nudge */}
                <p className="mt-2.5 text-[0.68rem] leading-4 text-[rgb(107,107,107)]">{writingRhythmLine}</p>
                {writingRhythmPrompt && writingRhythmPrompt !== writingRhythmLine && (
                    <p className="mt-1 text-[0.62rem] leading-4 text-[rgb(138,154,111)]">{writingRhythmPrompt}</p>
                )}
            </div>

            {/* ── Emotional fingerprint — ranked bars ── */}
            {dashboardInsights?.emotionalFingerprint && dashboardInsights.emotionalFingerprint.axes.length > 0 && (
                <div className="app-paper-soft rounded-[1.1rem] px-3 pt-3 pb-2.5">
                    <div className="flex items-baseline justify-between">
                        <p className="section-label">Emotional fingerprint</p>
                        <span className="text-[0.52rem] text-[rgb(170,170,170)] uppercase tracking-wider">frequency</span>
                    </div>
                    <div className="mt-2 space-y-[0.35rem]">
                        {(() => {
                            const sortedAxes = [...dashboardInsights.emotionalFingerprint!.axes].sort((a, b) => b.score - a.score).slice(0, 6);
                            const maxScore = sortedAxes[0]?.score ?? 0;
                            return sortedAxes.map((axis, i) => {
                                const barWidth = maxScore > 0 ? Math.max(6, Math.round((axis.score / maxScore) * 100)) : 6;
                                const isTop = i === 0;
                                const emotionKey = String(axis.emotion).toLowerCase();
                                return (
                                    <Link
                                        key={axis.emotion}
                                        href={`/timeline?mood=${encodeURIComponent(emotionKey)}`}
                                        className="flex items-center gap-1.5 rounded-[0.5rem] -mx-1 px-1 py-0.5 transition-colors hover:bg-[rgba(138,154,111,0.06)]"
                                    >
                                        <span className="w-[1.1rem] text-center text-[0.72rem] leading-none">{moodEmojiFor(emotionKey)}</span>
                                        <span className={`w-[3.5rem] text-[0.6rem] truncate ${isTop ? 'font-semibold text-[rgb(var(--paper-ink))]' : 'text-[rgb(130,130,130)]'}`}>
                                            {toTitleCase(axis.emotion)}
                                        </span>
                                        <div className="flex-1 h-[0.4rem] rounded-full bg-[rgba(92,92,92,0.05)] overflow-hidden">
                                            <div
                                                className="h-full rounded-full"
                                                style={{
                                                    width: `${barWidth}%`,
                                                    backgroundColor: isTop ? 'rgb(138,154,111)' : 'rgba(138,154,111,0.45)',
                                                }}
                                            />
                                        </div>
                                        <span className={`w-6 text-right text-[0.52rem] tabular-nums ${isTop ? 'font-semibold text-[rgb(var(--paper-ink))]' : 'text-[rgb(170,170,170)]'}`}>
                                            {axis.entryCount}×
                                        </span>
                                    </Link>
                                );
                            });
                        })()}
                    </div>
                    <p className="mt-2 text-[0.65rem] leading-4 text-[rgb(107,107,107)]">
                        {dashboardInsights.emotionalFingerprint.summary}
                    </p>
                </div>
            )}

            {/* ── Life balance + Resilience — 2-col ── */}
            {(hasLifeBalanceSignal || dashboardInsights?.resilience) && (
                <div className="grid gap-2 sm:grid-cols-2">
                    {hasLifeBalanceSignal && journalIntel?.lifeBalance && (
                        <div className="app-paper-soft rounded-[1.1rem] px-3 pt-3 pb-2.5">
                            <p className="section-label">Life balance</p>
                            <div className="mt-2 flex items-center gap-3">
                                <div className="relative h-11 w-11 shrink-0">
                                    <svg
                                        viewBox="0 0 36 36"
                                        className="h-11 w-11 -rotate-90"
                                        role="img"
                                        aria-label={`Life balance score ${lifeBalanceScoreLabel}, with ${formatNotebookLabel(journalIntel.lifeBalance.dominantArea)} appearing most often${journalIntel.lifeBalance.neglectedArea ? ` and ${formatNotebookLabel(journalIntel.lifeBalance.neglectedArea)} appearing less` : ''}.`}
                                    >
                                        <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(92,92,92,0.06)" strokeWidth="3.5" />
                                        <circle
                                            cx="18" cy="18" r="15" fill="none"
                                            stroke="rgb(138,154,111)" strokeWidth="3.5" strokeLinecap="round"
                                            strokeDasharray={`${lifeBalanceRingFill} ${LIFE_BALANCE_RING_CIRCUMFERENCE}`}
                                        />
                                    </svg>
                                    <span className="absolute inset-0 flex items-center justify-center text-[0.56rem] font-bold tabular-nums text-[rgb(var(--paper-ink))]">
                                        {lifeBalanceScoreLabel}
                                    </span>
                                </div>
                                <div className="min-w-0 space-y-0.5">
                                    <Link
                                        href={`/timeline?lifeArea=${encodeURIComponent(journalIntel.lifeBalance.dominantArea)}`}
                                        className="block text-[0.68rem] leading-4 text-[rgb(var(--paper-ink))] transition-opacity hover:opacity-70"
                                    >
                                        <span className="font-semibold">{formatNotebookLabel(journalIntel.lifeBalance.dominantArea)}</span> shows up most often
                                    </Link>
                                    {journalIntel.lifeBalance.neglectedArea && (
                                        <Link
                                            href={`/timeline?lifeArea=${encodeURIComponent(journalIntel.lifeBalance.neglectedArea)}`}
                                            className="block text-[0.6rem] leading-4 text-[rgb(140,140,140)] transition-opacity hover:opacity-70"
                                        >
                                            {formatNotebookLabel(journalIntel.lifeBalance.neglectedArea)} is quieter lately
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {dashboardInsights?.resilience && (
                        <div className="app-paper-soft rounded-[1.1rem] px-3 pt-3 pb-2.5">
                            <p className="section-label">Resilience</p>
                            <p className="mt-1.5 text-[0.68rem] leading-[1.55] text-[rgb(107,107,107)]">
                                {dashboardInsights.resilience.narrative}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* ── Who steadies you + What lifts & drains — 2-col ── */}
            {(supportAnchorCards.length > 0 || (dashboardInsights && (dashboardInsights.correlations.length > 0 || dashboardInsights.triggerMap.length > 0))) && (
                <div className="grid gap-2 sm:grid-cols-2">
                    {(supportAnchorCards.length > 0 || supportivePeople.length > 0 || groundingAnchors.length > 0) && (
                        <div className="app-paper-soft rounded-[1.1rem] px-3 pt-3 pb-2.5">
                            <p className="section-label">Who steadies you</p>
                            {supportMap?.summary && (
                                <p className="mt-1 text-[0.62rem] leading-4 text-[rgb(130,130,130)]">
                                    {compactText(supportMap.summary, 120)}
                                </p>
                            )}
                            {supportAnchorCards.length > 0 ? (
                                <div className="mt-2 space-y-2">
                                    {supportAnchorCards.slice(0, 3).map((anchor) => (
                                        <div key={anchor.id} className="flex items-start gap-2">
                                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(138,154,111,0.14)] text-[0.6rem] font-bold text-[rgb(118,134,91)]">
                                                {anchor.label.charAt(0).toUpperCase()}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="truncate text-[0.7rem] font-semibold text-[rgb(var(--paper-ink))]">{anchor.label}</span>
                                                    <span className="rounded-full border border-[rgba(92,92,92,0.08)] px-1.5 py-px text-[0.46rem] uppercase tracking-[0.06em] text-[rgb(160,160,160)]">{anchor.type}</span>
                                                    {anchor.supportCount > 0 && (
                                                        <span className="ml-auto text-[0.52rem] tabular-nums text-[rgb(160,160,160)]">{anchor.supportCount}×</span>
                                                    )}
                                                </div>
                                                {anchor.whyItHelps && (
                                                    <p className="mt-0.5 text-[0.6rem] leading-4 text-[rgb(125,125,125)]">
                                                        {compactText(anchor.whyItHelps, 95)}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {[...supportivePeople, ...groundingAnchors].slice(0, 4).map((anchor) => (
                                        <span key={anchor.id} className="rounded-full border border-[rgba(92,92,92,0.1)] bg-white/50 px-2 py-0.5 text-[0.58rem] text-[rgb(120,120,120)]">{anchor.label}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {dashboardInsights && (dashboardInsights.correlations.length > 0 || dashboardInsights.triggerMap.length > 0) && (() => {
                        const seen = new Set<string>();
                        const merged: Array<{ key: string; topic: string; isLift: boolean; magnitude: number }> = [];
                        for (const c of dashboardInsights.correlations) {
                            const k = c.topic.toLowerCase();
                            if (seen.has(k)) continue;
                            seen.add(k);
                            merged.push({ key: `c-${k}`, topic: c.topic, isLift: c.direction === 'lifter', magnitude: Math.abs(c.delta) });
                        }
                        for (const t of dashboardInsights.triggerMap) {
                            const k = t.entity.toLowerCase();
                            if (seen.has(k)) continue;
                            seen.add(k);
                            merged.push({ key: `t-${k}`, topic: t.entity, isLift: t.direction === 'lifter', magnitude: Math.abs(t.avgMoodDelta) });
                        }
                        const items = merged.sort((a, b) => b.magnitude - a.magnitude).slice(0, 4);
                        if (items.length === 0) return null;
                        return (
                            <div className="app-paper-soft rounded-[1.1rem] px-3 pt-3 pb-2.5">
                                <p className="section-label">What lifts &amp; drains</p>
                                <div className="mt-2 space-y-1.5">
                                    {items.map((item) => (
                                        <Link
                                            key={item.key}
                                            href={`/timeline?theme=${encodeURIComponent(item.topic)}`}
                                            className="flex items-center gap-2 rounded-[0.5rem] -mx-1 px-1 py-0.5 transition-colors hover:bg-[rgba(138,154,111,0.06)]"
                                        >
                                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.55rem] ${
                                                item.isLift ? 'bg-[rgba(138,154,111,0.12)] text-[rgb(118,134,91)]' : 'bg-[rgba(192,134,90,0.12)] text-[rgb(170,120,70)]'
                                            }`}>
                                                {item.isLift ? '↑' : '↓'}
                                            </span>
                                            <span className="flex-1 truncate text-[0.7rem] text-[rgb(var(--paper-ink))]">{formatNotebookLabel(item.topic)}</span>
                                            <span className={`text-[0.52rem] font-medium tabular-nums ${item.isLift ? 'text-[rgb(118,134,91)]' : 'text-[rgb(180,130,80)]'}`}>
                                                {item.isLift ? '+' : '−'}{item.magnitude.toFixed(1)}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* ── Worth noticing (contradictions) ── */}
            {dashboardInsights && dashboardInsights.contradictions.length > 0 && (
                <div className="app-paper-soft rounded-[1.1rem] px-3 pt-3 pb-2.5 border-l-[3px] border-[rgba(192,160,100,0.35)]">
                    <p className="section-label">Worth noticing</p>
                    <div className="mt-1.5 space-y-1.5">
                        {dashboardInsights.contradictions.slice(0, 2).map((c, i) => (
                            <div key={i} className="flex items-start gap-2">
                                <span className="mt-0.5 text-[0.65rem]">🪞</span>
                                <p className="text-[0.68rem] leading-[1.55] text-[rgb(107,107,107)]">{c.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Small evidence ── */}
            {evidenceLedger.length > 0 && (
                <div className="app-paper-soft rounded-[1.1rem] px-3 pt-3 pb-2.5">
                    <p className="section-label">Small evidence</p>
                    <div className="mt-1.5 space-y-1.5">
                        {evidenceLedger.slice(0, 3).map((item) => (
                            <div key={item.title} className="flex items-start gap-2">
                                <span className="mt-[0.35rem] h-[5px] w-[5px] shrink-0 rounded-full bg-[rgb(138,154,111)]" />
                                <div>
                                    <span className="text-[0.7rem] font-semibold text-[rgb(var(--paper-ink))]">{item.title}</span>
                                    <span className="ml-1 text-[0.65rem] text-[rgb(130,130,130)]">{item.body}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="page-paper-canvas min-h-screen pb-6 md:pb-20">
            <main className="mx-auto w-full max-w-4xl px-4 py-4 md:px-6 md:py-10">
                <div className="space-y-4 md:space-y-6">

                    {/* ═══════════════════════════════════════════════
                        ZONE 1 — HERO  (above the fold, no scroll)
                        Tight padding on mobile so hero + capture + glance fit in viewport
                    ═══════════════════════════════════════════════ */}
                    <Surface className="app-paper !p-4 md:!p-6">
                        <div className="space-y-3 md:space-y-5">
                            <div className="flex items-start gap-3">
                                {/* Avatar — fixed circle, never shrinks */}
                                <div className="shrink-0 mt-0.5">
                                    <UserAvatar
                                        avatarUrl={avatarUrl}
                                        name={firstName}
                                        size={40}
                                        className="ring-2 ring-[rgba(var(--paper-border),0.3)] hidden sm:flex"
                                    />
                                    <UserAvatar
                                        avatarUrl={avatarUrl}
                                        name={firstName}
                                        size={34}
                                        className="ring-2 ring-[rgba(var(--paper-border),0.3)] flex sm:hidden"
                                    />
                                </div>
                                {/* Text block — takes remaining space, clips overflow */}
                                <div className="min-w-0 flex-1">
                                    <h1 className="notive-logo flex items-baseline gap-1 text-xl font-semibold leading-tight md:text-3xl">
                                        <span className="truncate">Hey {firstName}</span>
                                        <span className="shrink-0 text-[0.75rem] font-normal text-[rgb(107,107,107)] md:text-sm">
                                            {greetingLocation}
                                        </span>
                                    </h1>
                                    <p className="mt-1 truncate whitespace-nowrap text-[0.72rem] text-[rgb(107,107,107)]">
                                        {todayLabel}
                                        <span className="mx-1.5 text-[rgba(107,107,107,0.55)]">•</span>
                                        <span className="sprout-accent">{energyLine}</span>
                                    </p>
                                    {(profileTags.length > 0 || zodiacSign) && (
                                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                            {profileTags.map((tag) => (
                                                <span
                                                    key={tag}
                                                    className="rounded-full border border-[rgba(92,92,92,0.12)] bg-[rgba(255,255,255,0.48)] px-2.5 py-1 text-[0.66rem] text-[rgb(107,107,107)]"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                            {zodiacSign && (
                                                <span className="rounded-full border border-[rgba(92,92,92,0.12)] bg-[rgba(255,255,255,0.48)] px-2.5 py-1 text-[0.66rem] text-[rgb(107,107,107)]">
                                                    {zodiacSign.symbol} {zodiacSign.sign}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="overflow-x-auto scrollbar-hide">
                                <div role="tablist" aria-label="Dashboard pages" className="inline-flex min-w-full gap-1 rounded-[1.5rem] bg-[rgba(237,228,216,0.72)] p-1 border border-[rgba(92,92,92,0.12)]">
                                    {TAB_ORDER.map((tab) => (
                                        <button
                                            key={tab}
                                            type="button"
                                            role="tab"
                                            aria-selected={activeTab === tab}
                                            aria-controls={`dashboard-page-${tab}`}
                                            onClick={() => setActiveTab(tab)}
                                            className={`flex-1 whitespace-nowrap rounded-[1.1rem] px-2.5 py-2 text-[0.8rem] font-medium transition-all ${
                                                activeTab === tab
                                                    ? 'bg-[rgba(248,244,237,0.98)] text-[rgb(41,38,34)] shadow-[0_2px_8px_rgba(92,92,92,0.08)]'
                                                    : 'text-[rgb(107,107,107)] hover:bg-[rgba(255,255,255,0.5)]'
                                            }`}
                                        >
                                            <span className="flex items-center justify-center gap-1">
                                                {tab === 'overview' && (
                                                    <NotebookDoodle name="sprout" accent="sage" className="h-3.5 w-3.5" />
                                                )}
                                                {tab === 'growth' && (
                                                    <NotebookDoodle name="ladder" accent="apricot" className="h-3.5 w-3.5" />
                                                )}
                                                {tab === 'patterns' && (
                                                    <NotebookDoodle name="compass" accent="lilac" className="h-3.5 w-3.5" />
                                                )}
                                                <span>{TAB_LABELS[tab]}</span>
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div id={`dashboard-page-${activeTab}`} role="tabpanel" className="pt-1 space-y-4 stagger-child" key={activeTab}>
                                {topPreviewContent}
                            </div>
                        </div>
                    </Surface>

                    {/* ═══════════════════════════════════════════════
                        ZONE 2 — SUB-TAB DETAIL
                    ═══════════════════════════════════════════════ */}

                    {/* ── Sub-tab content ── */}
                    <section className="space-y-4 stagger-child">

                        {/* ── OVERVIEW — RECENT MEMORIES ── */}
                        {activeTab === 'overview' && entries.length > 0 && (
                            <Surface doodle="moon" doodleAccent="sky" className="app-paper">
                                <p className="section-label">Recent memories</p>
                                <div className="mt-3 space-y-3">
                                    {entries.slice(0, 3).map((entry) => (
                                        <Link
                                            key={entry.id}
                                            href={openDashboardEntryHref(entry.id)}
                                            className="app-paper-soft block rounded-[1.25rem] p-4 transition-opacity hover:opacity-80"
                                        >
                                            <div className="flex items-start gap-3">
                                                <span className="mt-0.5 text-sm" aria-hidden="true">
                                                    {moodEmojiFor(entry.mood)}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="truncate text-sm font-semibold text-[rgb(var(--paper-ink))]">
                                                            {entry.title || 'Untitled'}
                                                        </p>
                                                        <span className="text-xs text-[rgb(107,107,107)]">
                                                            {new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                        </span>
                                                    </div>
                                                    <p className="mt-2 text-[0.875rem] leading-7 text-[rgb(107,107,107)]">
                                                        {compactText(entry.content, 105)}
                                                    </p>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                                {entries.length > 3 && (
                                    <div className="mt-3">
                                        <Link href={timelineHref} className="text-[0.75rem] text-[rgb(138,154,111)] hover:opacity-75">
                                            See all {entries.length} memories →
                                        </Link>
                                    </div>
                                )}
                            </Surface>
                        )}

                        {/* Growth & Patterns content now inlined in topPreviewContent above */}
                    </section>
                </div>
            </main>
        </div>
    );
}
