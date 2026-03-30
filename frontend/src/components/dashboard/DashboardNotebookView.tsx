/* FINAL DASHBOARD — "One calm page" notebook experience
   Zone 1 hero with sprout doodle, tight Zone 2 capture, minimal Zone 3 glance + sub-tabs.
   Matches logo + generated images exactly. Almost zero scrolling on mobile.
   Every teen gets one grounded next move immediately. */
'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import ActionBriefPanel from '@/components/action/ActionBriefPanel';
import type { StudentActionBrief } from '@/components/action/types';
import DailyGentleReflectionCard from '@/components/dashboard/DailyGentleReflectionCard';
import { NotebookDoodle } from '@/components/dashboard/NotebookDoodles';
import { Surface } from '@/components/ui/surface';
import type { GentleReflectionDraft } from '@/services/gentle-reflection.service';

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
    };
    lifeBalance: {
        dominantArea: string;
        neglectedArea: string | null;
        balanceScore: number;
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
    };
    gratitude: {
        totalExpressions: number;
        recentTrend: 'growing' | 'stable' | 'fading';
    };
};

type DashboardWeeklyDigest = {
    title: string;
    editorial: string;
    highlights: Array<{ category: string; insight: string }>;
    generatedAt: string;
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

type DashboardNotebookViewProps = {
    firstName: string;
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
        reflectionDepth: { levelLabel: string } | null;
        correlations: Array<{ topic: string; direction: 'lifter' | 'drain' }>;
        contradictions: Array<{ description: string }>;
        triggerMap: Array<{ entity: string; direction: 'lifter' | 'drain' }>;
    } | null;
    journalIntel: DashboardJournalIntel | null;
    weeklyDigest: DashboardWeeklyDigest | null;
    supportMap: DashboardSupportMap | null;
    heroInsight: { body: string } | null;
    heroInsightLoading: boolean;
    insightTier: number;
    userBirthDate: string | null;
};

type DashboardTab = 'today' | 'recent' | 'growth' | 'patterns';

const MOOD_EMOJI: Record<string, string> = {
    happy: '😊',
    calm: '😌',
    sad: '😔',
    anxious: '😟',
    frustrated: '😤',
    thoughtful: '🤔',
    motivated: '⚡',
    tired: '😴',
    grateful: '🙏',
};

const TAB_ORDER: DashboardTab[] = ['today', 'recent', 'growth', 'patterns'];
const TAB_LABELS: Record<DashboardTab, string> = {
    today: 'Today',
    recent: 'Recent notes',
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

const MOOD_THREAD_Y: Record<string, number> = {
    happy: 28,
    grateful: 32,
    calm: 36,
    motivated: 40,
    thoughtful: 50,
    tired: 62,
    sad: 70,
    anxious: 78,
    frustrated: 84,
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

export default function DashboardNotebookView({
    firstName,
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
    supportMap,
    heroInsight,
    heroInsightLoading,
    insightTier: _insightTier,
    locationLabel,
    userBirthDate,
    profileTags = [],
}: DashboardNotebookViewProps) {
    const [activeTab, setActiveTab] = useState<DashboardTab>('today');
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
    const latestEntry = entries[0] || null;
    const resurfacedMoment = resurfacedMoments[0] || null;
    const returningThemes = themeClusters.filter((cluster) => cluster.entryCount >= 2).length;
    const strongestEmotion = dashboardInsights?.emotionalFingerprint?.axes
        ? [...dashboardInsights.emotionalFingerprint.axes].sort((left, right) => right.score - left.score)[0] ?? null
        : null;
    const highestWindowCount = writingWindowCounts.reduce((highest, bucket) => Math.max(highest, bucket.count), 0);
    const highestWeekdayCount = weekdayCounts.reduce((highest, day) => Math.max(highest, day.count), 0);
    const energyTrait = writerDNA.traits[1] || writerDNA.traits[0];
    const threadSentence = weekWords > 0
        ? `You put down ${weekWords} ${weekWords === 1 ? 'word' : 'words'} this week - that's enough for Notive to start finding a calmer thread.`
        : typeof totalWords === 'number' && totalWords > 0
            ? `You already have ${totalWords} words in the notebook - enough for Notive to start finding a calmer thread.`
            : entries.length > 0
                ? `You already have ${entries.length} ${entries.length === 1 ? 'note' : 'notes'} here - enough for Notive to start finding a calmer thread.`
                : 'One honest note is enough for Notive to start finding a calmer thread.';
    const rhythmSummary = dominantWritingWindow
        ? `Most of your notes return in the ${dominantWritingWindow}. When that window opens, leave two honest lines before it passes.`
        : entries.length >= 3
            ? 'Your rhythm is still forming. Keep catching the same kind of moment when it comes back.'
            : 'A few more notes will make your writing rhythm easier to trust.';
    const emotionalSummary = dashboardInsights?.emotionalFingerprint?.summary
        || 'A few more notes will make the emotional pattern here feel more grounded.';
    const noticingSummary = heroInsight?.body
        || dashboardInsights?.contradictions[0]?.description
        || (dashboardInsights?.correlations[0]
            ? `${toTitleCase(dashboardInsights.correlations[0].topic)} tends to ${dashboardInsights.correlations[0].direction === 'lifter' ? 'steady' : 'drain'} your mood when it shows up.`
            : null)
        || (dashboardInsights?.triggerMap[0]
            ? `${toTitleCase(dashboardInsights.triggerMap[0].entity)} looks like a repeating ${dashboardInsights.triggerMap[0].direction === 'lifter' ? 'steadying' : 'draining'} influence.`
            : null)
        || 'Notive is still listening for a pattern it can say clearly, not just confidently.';
    const supportSummary = hasDeviceSignals && deviceSignals?.wellness
        ? `Your last check-in showed energy at ${deviceSignals.wellness.energyLevel}/10 and stress at ${deviceSignals.wellness.stressLevel}/10. Let that be context, not pressure.`
        : wellnessSubmitted
            ? 'Your last check-in is already part of the thread here. You do not need to explain the whole day again.'
            : 'If today feels noisy, a quick check-in or a short chat can give the next note a calmer starting point.';
    const weeklyDigestSnippet = weeklyDigest?.editorial
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
            whyItHelps: `${person.name} keeps showing up in your notes when something important is happening.`,
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
        ? `Your notes have already moved from ${themeClusters[themeClusters.length - 1]?.label ?? 'finding your way'} toward ${themeClusters[0]?.label ?? 'clearer ground'}.`
        : `${writerDNA.archetype.oneLiner}. The notebook is starting to hold a shape you can actually use.`;
    const growthEvidence = themeClusters[0]?.label
        ? `A theme that keeps returning lately: ${themeClusters[0].label}.`
        : 'A few honest notes are already enough for Notive to hold onto what matters.';
    const patternsLead = dominantWritingWindow
        ? `Your deepest writing tends to happen in the ${dominantWritingWindow}.`
        : 'Your writing window is still forming, but Notive is already watching for it.';
    const writingRhythmLine = topDayWindowMoments.length >= 2
        ? `Your deepest reflections tend to come on ${topDayWindowMoments[0].label} and ${topDayWindowMoments[1].label}.`
        : topDayWindowMoments.length === 1
            ? `Your notes often open up on ${topDayWindowMoments[0].label}.`
            : patternsLead;
    const writingRhythmPrompt = topDayWindowMoments[0]
        ? `Try capturing one quick thought next ${topDayWindowMoments[0].promptLabel}.`
        : 'Try catching one quick thought the next time a familiar window opens.';
    const emotionalThreadLine = strongestEmotion
        ? `You named ${String(strongestEmotion.emotion).toLowerCase()} most often this week - that's a steady thread you can lean on.`
        : emotionalSummary;
    const noticingLine = heroInsightLoading
        ? 'Notive is still reading across your notes before it says this more clearly.'
        : compactText(noticingSummary, 150);
    const lifeBalanceLine = journalIntel?.lifeBalance
        ? journalIntel.lifeBalance.neglectedArea
            ? `${formatNotebookLabel(journalIntel.lifeBalance.dominantArea)} has taken most of the page lately. ${formatNotebookLabel(journalIntel.lifeBalance.neglectedArea)} has been quieter.`
            : `${formatNotebookLabel(journalIntel.lifeBalance.dominantArea)} is carrying most of the notebook lately.`
        : null;
    const peopleLine = journalIntel?.peopleMap.people?.[0]
        ? `${journalIntel.peopleMap.people[0].name} keeps showing up in ${journalIntel.peopleMap.people[0].count} ${journalIntel.peopleMap.people[0].count === 1 ? 'note' : 'notes'}.`
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
        ? recentEmotionEntries.map((entry, index) => ({
            x: 22 + (index * 356) / Math.max(1, recentEmotionEntries.length - 1),
            y: MOOD_THREAD_Y[entry.mood ?? ''] ?? 56,
            label: new Date(entry.createdAt).toLocaleDateString('en-US', { weekday: 'short' }),
        }))
        : FALLBACK_THREAD_POINTS.map((value, index) => ({
            x: 22 + (index * 356) / Math.max(1, FALLBACK_THREAD_POINTS.length - 1),
            y: value,
            label: DAY_LABELS[index]?.short ?? '',
        }));
    const emotionalThreadPath = buildSmoothPath(emotionalThreadPoints);
    const greetingLocation = locationLabel ? ` in ${locationLabel}.` : '.';
    const energyLine = `${toTitleCase(String(energyTrait?.label || writerDNA.archetype.name).replace(/[_-]+/g, ' '))} energy today`;
    const atAGlanceLine = dominantWritingWindow
        ? `Best writing window lately: ${toTitleCase(dominantWritingWindow)}.`
        : returningThemes > 0
            ? `${returningThemes} ${returningThemes === 1 ? 'theme is' : 'themes are'} returning lately.`
            : 'A few more notes will sharpen the pattern view.';
    const noticedItems = [
        themeClusters[0]
            ? `Your "${themeClusters[0].label}" thread has shown up in ${themeClusters[0].entryCount} recent ${themeClusters[0].entryCount === 1 ? 'note' : 'notes'}. ${todayBrief?.whatHelpedBefore?.summary ? compactText(todayBrief.whatHelpedBefore.summary, 92) : 'That is worth naming directly today.'}`
            : null,
        strongestEmotion
            ? `You named "${String(strongestEmotion.emotion).toLowerCase()}" ${strongestEmotion.entryCount} ${strongestEmotion.entryCount === 1 ? 'time' : 'times'} recently - that looks like your steadiest emotional thread right now.`
            : (weekWords > 0
                ? `You put down ${weekWords} ${weekWords === 1 ? 'word' : 'words'} this week - enough for Notive to start finding a calmer thread.`
                : null),
        resurfacedMoment
            ? `One note from ${new Date(resurfacedMoment.matchedEntry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} is echoing again. It already shows ${sentenceCase(String(energyTrait?.label || 'self-awareness'))} in how you handled that moment.`
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
                body: `${toTitleCase(strongestEmotion.emotion)} showed up enough times for Notive to trace it as a steady part of the week.`,
            }
            : null,
        resurfacedMoment
            ? {
                title: 'Memory',
                body: 'An older note is echoing again, which helps you see what is repeating sooner.',
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
            body: 'A few more notes will give Notive enough evidence to sketch this page more clearly.',
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

    const heroContent = todayBrief ? (
        <ActionBriefPanel
            brief={todayBrief}
            surface="dashboard"
            openEntryHref={openDashboardEntryHref}
            draftHref={recommendedHref}
            embedded
        />
    ) : gentleReflection && gentleJournalHref ? (
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
                <h2 className="notebook-title mt-2 text-xl md:text-[1.55rem]">Treat this like a direction check, not a final verdict.</h2>
                <p className="notebook-copy mt-3 text-[0.875rem] leading-7">{focusCard.title}</p>
                <p className="notebook-copy mt-2 text-[0.875rem] leading-7">{focusCard.body}</p>
            </div>

            {(focusCard.evidence || focusCard.evidenceFallback) && (
                <div className="app-paper-soft rounded-[1.25rem] p-4">
                    <p className="section-label">{hasSafetyFocus ? 'Why this is the move' : 'What Notive is noticing'}</p>
                    <p className="notebook-copy mt-2 text-[0.875rem] leading-7">{focusCard.evidence || focusCard.evidenceFallback}</p>
                </div>
            )}

            {focusCard.panels && focusCard.panels.length > 0 && (
                <div className="grid gap-3 md:grid-cols-2">
                    {focusCard.panels.slice(0, 2).map((panel) => (
                        <div key={panel.label} className="app-paper-soft rounded-[1.25rem] p-4">
                            <p className="section-label">{panel.label}</p>
                            <p className="notebook-copy mt-2 text-[0.875rem] leading-7">{panel.value}</p>
                        </div>
                    ))}
                </div>
            )}

            <div className="app-paper-soft rounded-[1.25rem] p-4">
                <p className="section-label">One clear next move</p>
                <p className="notebook-title mt-2 text-lg">{focusCard.primaryAction?.label || 'Draft the first lines'}</p>
                <p className="notebook-copy mt-2 text-[0.875rem] leading-7">{focusCard.panels?.[0]?.value || focusCard.body}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                {renderFocusAction(focusCard.primaryAction, 'primary')}
                {renderFocusAction(focusCard.secondaryAction, 'secondary')}
            </div>
        </div>
    );

    /* ── 3 KPIs for the At-a-Glance strip ── */
    const glanceKPIs = [
        {
            value: weekWords > 0 ? weekWords : (totalWords ?? 0),
            label: weekWords > 0 ? 'Words this week' : 'Words saved',
            note: weekWords > 0 ? 'Calmer thread' : 'Notebook total',
        },
        {
            value: notesThisWeek,
            label: 'Notes this week',
            note: notesThisWeek > 0 ? 'Recent captures' : 'Ready when you are',
        },
        {
            value: returningThemes,
            label: 'Returning theme' + (returningThemes !== 1 ? 's' : ''),
            note: themeClusters[0]?.label ? toTitleCase(themeClusters[0].label) : 'Still forming',
        },
    ];
    const glanceStrip = entries.length > 0 ? (
        <div className="rounded-[1.1rem] border border-[rgba(92,92,92,0.12)] bg-[rgba(255,255,255,0.5)] px-3 py-3">
            <div className="flex items-center justify-between gap-3">
                <p className="section-label">At a glance</p>
                <p className="text-[0.69rem] leading-5 text-[rgb(107,107,107)]">
                    {atAGlanceLine}
                </p>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
                {glanceKPIs.map((kpi) => (
                    <span
                        key={kpi.label}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(92,92,92,0.12)] bg-[rgba(248,244,237,0.94)] px-2.5 py-1 text-[0.7rem] text-[rgb(107,107,107)]"
                    >
                        <span className="font-medium text-[rgb(var(--paper-ink))]">
                            {kpi.value.toLocaleString()}
                        </span>
                        <span>{kpi.label}</span>
                    </span>
                ))}
            </div>
        </div>
    ) : null;
    const welcomeNotebookBanner = entries.length === 0 ? (
        <div className="app-paper-soft overflow-hidden rounded-[1.25rem]">
            <div className="relative">
                <Image
                    src="/images/dashboard-welcome-banner.jpg"
                    alt="Open notebook revealing a Notive Action Brief with one calm next move, welcoming a new student into their notebook before the first note."
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
                            Drop what happened. See one calm next move.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    ) : null;
    const topPreviewContent = activeTab === 'today' ? (
        <>
            {glanceStrip}
            <h2 className="notive-logo text-lg font-semibold leading-snug md:text-2xl">
                One calm page for today&rsquo;s next move.
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
                                    {MOOD_EMOJI[moodShift.from] ?? '·'} → {MOOD_EMOJI[moodShift.to] ?? '·'}
                                    <span className="block text-[0.65rem] text-[rgb(107,107,107)]">{moodShift.from} → {moodShift.to}</span>
                                </p>
                            ) : (
                                <p className="mt-0.5 text-[0.73rem] leading-5 text-[rgb(var(--paper-ink))]">
                                    {MOOD_EMOJI[moodShift.mood] ?? '·'} {moodShift.mood}
                                    <span className="block text-[0.65rem] text-[rgb(107,107,107)]">{moodShift.streak}× in a row</span>
                                </p>
                            )
                        ) : (
                            <p className="mt-0.5 text-[0.65rem] leading-4 text-[rgb(107,107,107)]">Write two notes to see a shift.</p>
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
    ) : activeTab === 'recent' ? (
        <div className="space-y-4">
            {glanceStrip}
            <div>
                <p className="section-label">Recent notes</p>
                <h2 className="notive-logo mt-2 text-lg font-semibold leading-snug md:text-2xl">
                    Return to the notes, not the stats.
                </h2>
                <p className="mt-3 text-[0.875rem] leading-7 text-[rgb(107,107,107)]">
                    {latestEntry
                        ? 'The clearest next move might already be hiding in something you wrote this week.'
                        : 'Your first few notes will start building this page as soon as they land.'}
                </p>
            </div>

            {latestEntry ? (
                <Link
                    href={openDashboardEntryHref(latestEntry.id)}
                    className="app-paper-soft block rounded-[1.25rem] p-4 transition-opacity hover:opacity-80"
                >
                    <p className="section-label">Continue</p>
                    <div className="mt-2 flex items-start gap-3">
                        <span className="mt-0.5 text-sm" aria-hidden="true">
                            {MOOD_EMOJI[latestEntry.mood ?? ''] ?? '✦'}
                        </span>
                        <div className="min-w-0">
                            <p className="notebook-title text-[1rem] leading-6">{latestEntry.title || 'Untitled'}</p>
                            <p className="mt-2 text-[0.82rem] leading-6 text-[rgb(107,107,107)]">
                                {compactText(latestEntry.content, 120)}
                            </p>
                        </div>
                    </div>
                </Link>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
                <Link href={timelineHref} className="workspace-button-primary inline-flex items-center rounded-xl px-4 py-3 text-sm font-semibold">
                    Open recent notes
                </Link>
                <span className="text-[0.74rem] leading-5 text-[rgb(107,107,107)]">
                    {entries.length > 0 ? `${entries.length} saved ${entries.length === 1 ? 'note' : 'notes'} waiting here.` : 'A short note is enough to start this page.'}
                </span>
            </div>
        </div>
    ) : activeTab === 'growth' ? (
        <div className="space-y-4">
            {glanceStrip}
            <div>
                <p className="section-label">Growth</p>
                <h2 className="notive-logo mt-2 text-lg font-semibold leading-snug md:text-2xl">
                    Your notebook is starting to show real shape.
                </h2>
            </div>

            {writerDNA.traits.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {writerDNA.traits.map((trait) => (
                        <span
                            key={trait.label}
                            className="notebook-chip rounded-full px-2.5 py-1 text-xs font-medium"
                        >
                            {toTitleCase(String(trait.label).replace(/[_-]+/g, ' '))}
                        </span>
                    ))}
                </div>
            )}

            <div className="app-paper-soft rounded-[1.25rem] p-4">
                <p className="section-label">{weeklyDigest ? 'Week in one line' : 'Growth thread'}</p>
                <p className="mt-2 notebook-copy text-[0.875rem] leading-7">
                    {weeklyDigest?.title || growthSummary}
                </p>
                <p className="mt-3 text-[0.82rem] leading-6 text-[rgb(107,107,107)]">
                    {weeklyDigestSnippet || growthEvidence}
                </p>
                {weeklyDigestHighlights.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {weeklyDigestHighlights.map((item) => (
                            <span
                                key={`${item.category}-${item.insight}`}
                                className="rounded-full border border-[rgba(92,92,92,0.12)] bg-[rgba(255,255,255,0.54)] px-2.5 py-1 text-[0.66rem] text-[rgb(107,107,107)]"
                            >
                                {item.category}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Link href={portfolioHref} className="workspace-button-primary inline-flex items-center rounded-xl px-4 py-3 text-sm font-semibold">
                    Open growth
                </Link>
                <span className="text-[0.74rem] leading-5 text-[rgb(107,107,107)]">
                    {growthLedgerItems[0] || threadSentence}
                </span>
            </div>
        </div>
    ) : (
        <div className="space-y-4">
            {glanceStrip}
            <div>
                <p className="section-label">Patterns</p>
                <h2 className="notive-logo mt-2 text-lg font-semibold leading-snug md:text-2xl">
                    The quieter patterns are ready when you want them.
                </h2>
            </div>

            <div className="app-paper-soft rounded-[1.25rem] p-4">
                <p className="section-label">My writing rhythm</p>
                <p className="mt-2 text-[0.875rem] leading-7 text-[rgb(107,107,107)]">{writingRhythmLine}</p>
                <p className="mt-3 text-[0.75rem] leading-6 text-[rgb(138,154,111)]">{writingRhythmPrompt}</p>
            </div>

            <div className="app-paper-soft rounded-[1.25rem] p-4">
                <p className="section-label">Emotional thread</p>
                <p className="mt-2 text-[0.875rem] leading-7 text-[rgb(107,107,107)]">{emotionalThreadLine}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Link href={guideHref} className="workspace-button-primary inline-flex items-center rounded-xl px-4 py-3 text-sm font-semibold">
                    Open patterns
                </Link>
                <span className="text-[0.74rem] leading-5 text-[rgb(107,107,107)]">
                    {supportSummaryLine || noticingLine}
                </span>
            </div>
        </div>
    );

    return (
        <div className="page-paper-canvas min-h-screen pb-36 md:pb-20">
            <main className="mx-auto w-full max-w-4xl px-4 py-4 md:px-6 md:py-10">
                <div className="space-y-4 md:space-y-6">

                    {/* ═══════════════════════════════════════════════
                        ZONE 1 — HERO  (above the fold, no scroll)
                        Tight padding on mobile so hero + capture + glance fit in viewport
                    ═══════════════════════════════════════════════ */}
                    <Surface className="app-paper !p-4 md:!p-6">
                        <div className="space-y-3 md:space-y-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h1 className="notive-logo text-2xl font-semibold leading-tight md:text-3xl">
                                        Hey {firstName}
                                        <span className="ml-1 text-sm font-normal text-[rgb(107,107,107)] md:text-base">
                                            {greetingLocation}
                                        </span>
                                    </h1>
                                    <p className="mt-1 text-sm text-[rgb(107,107,107)]">
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
                                <NotebookDoodle
                                    name={hasSafetyFocus ? 'knot' : 'star'}
                                    accent={hasSafetyFocus ? 'amber' : 'sage'}
                                    className="h-8 w-8 shrink-0 opacity-80"
                                />
                            </div>

                            <div className="overflow-x-auto">
                                <div role="tablist" aria-label="Dashboard pages" className="inline-flex min-w-full gap-1 rounded-[1.5rem] bg-[rgba(237,228,216,0.72)] p-1 border border-[rgba(92,92,92,0.12)]">
                                    {TAB_ORDER.map((tab) => (
                                        <button
                                            key={tab}
                                            type="button"
                                            role="tab"
                                            aria-selected={activeTab === tab}
                                            aria-controls={`dashboard-page-${tab}`}
                                            onClick={() => setActiveTab(tab)}
                                            className={`flex-1 whitespace-nowrap rounded-[1.1rem] px-3 py-2.5 text-sm font-medium transition-all ${
                                                activeTab === tab
                                                    ? 'bg-[rgba(248,244,237,0.98)] text-[rgb(41,38,34)] shadow-[0_2px_8px_rgba(92,92,92,0.08)]'
                                                    : 'text-[rgb(107,107,107)] hover:bg-[rgba(255,255,255,0.5)]'
                                            }`}
                                        >
                                            <span className="flex items-center justify-center gap-1.5">
                                                {activeTab === tab && tab === 'today' && (
                                                    <NotebookDoodle name="sprout" accent="sage" className="h-4 w-4" />
                                                )}
                                                {activeTab === tab && tab !== 'today' && (
                                                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[rgb(138,154,111)]" />
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

                        {/* ── RECENT NOTES ── */}
                        {activeTab === 'recent' && (
                            <Surface doodle="moon" doodleAccent="sky" className="app-paper">
                                <p className="section-label">Recent</p>
                                <h2 className="notive-logo mt-2 text-[1.35rem] font-semibold leading-tight md:text-[1.45rem]">
                                    Return to the notes, not the stats.
                                </h2>
                                {latestEntry ? (
                                    <Surface doodle="sprout" doodleAccent="sage" className="app-paper-soft mt-4 !rounded-[1.25rem]">
                                        <Link href={openDashboardEntryHref(latestEntry.id)} className="block transition-opacity hover:opacity-80">
                                            <p className="section-label">Continue</p>
                                            <p className="notebook-title mt-2 text-lg">{latestEntry.title || 'Untitled'}</p>
                                            <p className="mt-2 text-[0.875rem] leading-7 text-[rgb(107,107,107)]">
                                                {compactText(latestEntry.content, 130)}
                                            </p>
                                        </Link>
                                    </Surface>
                                ) : (
                                    <p className="mt-3 text-[0.875rem] leading-7 text-[rgb(107,107,107)]">
                                        Your first note will show up here as soon as it lands.
                                    </p>
                                )}
                                {entries.length > 0 && (
                                    <div className="mt-4 space-y-3">
                                        {entries.slice(0, 4).map((entry) => (
                                            <Link
                                                key={entry.id}
                                                href={openDashboardEntryHref(entry.id)}
                                                className="app-paper-soft block rounded-[1.25rem] p-4 transition-opacity hover:opacity-80"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <span className="mt-0.5 text-sm" aria-hidden="true">
                                                        {MOOD_EMOJI[entry.mood ?? ''] ?? '✦'}
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
                                )}
                            </Surface>
                        )}

                        {/* ── GROWTH  (writer DNA, rhythm, resilience, carry-forward) ── */}
                        {activeTab === 'growth' && (
                            <div className="space-y-4">
                                <Surface doodle="sprout" doodleAccent="sage" className="app-paper">
                                    <p className="section-label">Growth</p>
                                    <h2 className="notive-logo mt-2 text-[1.35rem] font-semibold leading-tight md:text-[1.45rem]">
                                        Your notebook is starting to show real shape.
                                    </h2>

                                    {writerDNA.traits.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-1.5">
                                            {writerDNA.traits.map((trait) => (
                                                <span
                                                    key={trait.label}
                                                    className="notebook-chip rounded-full px-2.5 py-1 text-xs font-medium"
                                                >
                                                    {toTitleCase(String(trait.label).replace(/[_-]+/g, ' '))}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    <p className="notebook-copy mt-3 text-sm italic font-serif">
                                        &ldquo;{writerDNA.archetype.oneLiner}&rdquo;
                                    </p>

                                    <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                                        <div className="app-paper-soft rounded-[1.25rem] p-4">
                                            <p className="section-label">{weeklyDigest ? 'Week in one line' : 'Growth thread'}</p>
                                            <p className="mt-2 text-[0.94rem] font-semibold leading-6 text-[rgb(var(--paper-ink))]">
                                                {weeklyDigest?.title || growthSummary}
                                            </p>
                                            <p className="mt-2 text-[0.82rem] leading-6 text-[rgb(107,107,107)]">
                                                {weeklyDigestSnippet || growthEvidence}
                                            </p>
                                            {weeklyDigestHighlights.length > 0 && (
                                                <div className="mt-3 flex flex-wrap gap-1.5">
                                                    {weeklyDigestHighlights.map((item) => (
                                                        <span
                                                            key={`${item.category}-${item.insight}`}
                                                            className="rounded-full border border-[rgba(92,92,92,0.12)] bg-[rgba(255,255,255,0.62)] px-2.5 py-1 text-[0.66rem] text-[rgb(107,107,107)]"
                                                        >
                                                            {item.category}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="app-paper-soft rounded-[1.25rem] p-4">
                                            <p className="section-label">Story material</p>
                                            <div className="mt-2 space-y-2.5">
                                                {(growthLedgerItems.length > 0 ? growthLedgerItems : [threadSentence]).map((item) => (
                                                    <div key={item} className="flex items-start gap-2">
                                                        <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[rgb(138,154,111)]" />
                                                        <p className="text-[0.76rem] leading-5 text-[rgb(107,107,107)]">{item}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </Surface>

                                <Surface doodle="star" doodleAccent="apricot" className="app-paper">
                                    <p className="section-label">Carry this forward</p>
                                    <p className="mt-2 text-[0.875rem] leading-7 text-[rgb(107,107,107)]">
                                        {resurfacedMoment
                                            ? 'One older note is echoing this week. Growth often looks like noticing the same moment sooner.'
                                            : 'Keep saving the real moments. They become evidence you can use for school, work, and your own story.'}
                                    </p>
                                    {journalIntel?.peopleMap.people?.length ? (
                                        <p className="mt-3 text-[0.76rem] leading-6 text-[rgb(107,107,107)]">
                                            {journalIntel.peopleMap.people[0].name} and the people around that part of your life may already belong in a future story about support, effort, or self-advocacy.
                                        </p>
                                    ) : null}
                                    <div className="mt-4 flex flex-wrap items-center gap-3">
                                        <Link href={portfolioHref} className="workspace-button-primary inline-flex items-center rounded-xl px-4 py-3 text-sm font-semibold">
                                            See this as a story for college/apps
                                        </Link>
                                        {showThenNow && (
                                            <span className="text-[0.75rem] text-[rgb(107,107,107)]">
                                                {daysSinceFirst} days of writing already changed the view.
                                            </span>
                                        )}
                                    </div>
                                </Surface>
                            </div>
                        )}

                        {/* ── PATTERNS  (writing rhythm, emotional thread, triggers, evidence) ── */}
                        {activeTab === 'patterns' && (
                            <div className="space-y-4">
                                {/* Writing Rhythm */}
                                <Surface doodle="sprout" doodleAccent="sage" className="app-paper">
                                    <p className="section-label">Patterns</p>
                                    <h2 className="notive-logo mt-2 text-[1.35rem] font-semibold leading-tight md:text-[1.55rem]">
                                        My Writing Rhythm
                                    </h2>
                                    <p className="mt-3 text-[0.875rem] leading-7 text-[rgb(107,107,107)]">{noticingLine}</p>

                                    <div className="app-paper mt-4 p-4 md:p-5">
                                        <div className="grid grid-cols-7 gap-2">
                                            {weekdayCounts.map((day) => {
                                                const circleSize = highestWeekdayCount > 0
                                                    ? 18 + Math.round((day.count / highestWeekdayCount) * 18)
                                                    : 18;

                                                return (
                                                    <div key={day.short} className="text-center">
                                                        <div
                                                            className="mx-auto mb-2 flex items-center justify-center rounded-full border border-[rgb(92,92,92)] text-[0.72rem] text-[rgb(92,92,92)]"
                                                            style={{ width: `${circleSize}px`, height: `${circleSize}px` }}
                                                        >
                                                            {day.count > 0 ? day.count : ''}
                                                        </div>
                                                        <div className="text-[0.7rem] text-[rgb(107,107,107)]">{day.short}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <p className="mt-5 text-[0.875rem] leading-7 text-[rgb(107,107,107)]">
                                            {writingRhythmLine}
                                        </p>
                                        <div className="mt-3 text-[0.75rem] leading-6 text-[rgb(138,154,111)]">
                                            {writingRhythmPrompt}
                                        </div>
                                    </div>
                                </Surface>

                                {/* Emotional Thread */}
                                <Surface doodle="knot" doodleAccent="amber" className="app-paper">
                                    <h3 className="notive-logo text-[1.3rem] font-semibold leading-tight md:text-[1.45rem]">
                                        Emotional Thread
                                    </h3>
                                    <div className="mt-4 rounded-[1rem] border-b border-[rgba(92,92,92,0.4)] bg-[rgba(255,255,255,0.42)] px-2 py-3">
                                        <svg viewBox="0 0 400 120" className="h-40 w-full" aria-hidden="true">
                                            <path
                                                d="M 18 95 L 382 95"
                                                fill="none"
                                                stroke="rgba(92,92,92,0.28)"
                                                strokeWidth="1.5"
                                                strokeLinecap="round"
                                            />
                                            <path
                                                d={emotionalThreadPath}
                                                fill="none"
                                                stroke="#8A9A6F"
                                                strokeWidth="3"
                                                strokeLinecap="round"
                                            />
                                            {emotionalThreadPoints.map((point) => (
                                                <circle
                                                    key={`${point.x}-${point.label}`}
                                                    cx={point.x}
                                                    cy={point.y}
                                                    r="3.2"
                                                    fill="#F8F4ED"
                                                    stroke="#5C5C5C"
                                                    strokeWidth="1.6"
                                                />
                                            ))}
                                            {emotionalThreadPoints.map((point) => (
                                                <text
                                                    key={`${point.label}-${point.x}`}
                                                    x={point.x}
                                                    y="112"
                                                    textAnchor="middle"
                                                    fontSize="9"
                                                    fill="#6B6B6B"
                                                >
                                                    {point.label}
                                                </text>
                                            ))}
                                        </svg>
                                    </div>
                                    <p className="mt-4 text-[0.875rem] leading-7 text-[rgb(107,107,107)]">
                                        {emotionalThreadLine}
                                    </p>
                                    <Link href={guideHref} className="mt-3 inline-flex text-[0.75rem] leading-6 text-[rgb(92,92,92)] hover:opacity-75">
                                        When the knot feels tight again, try the Bridge Builder to reach someone.
                                    </Link>
                                </Surface>

                                {(supportAnchorCards.length > 0 || (dashboardInsights && (dashboardInsights.correlations.length > 0 || dashboardInsights.triggerMap.length > 0))) && (
                                    <Surface doodle="ladder" doodleAccent="sage" className="app-paper">
                                        <div className="grid gap-4 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                                            <div>
                                                <h3 className="notive-logo text-[1.3rem] font-semibold leading-tight md:text-[1.45rem]">
                                                    Who steadies you
                                                </h3>
                                                <p className="mt-2 text-[0.8rem] leading-6 text-[rgb(107,107,107)]">
                                                    {supportSummaryLine}
                                                </p>
                                                {supportAnchorCards.length > 0 ? (
                                                    <div className="mt-3 space-y-2">
                                                        {supportAnchorCards.map((anchor) => (
                                                            <div
                                                                key={anchor.id}
                                                                className="rounded-[1rem] border border-[rgba(92,92,92,0.12)] bg-[rgba(255,255,255,0.62)] px-3 py-3"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm font-semibold text-[rgb(var(--paper-ink))]">{anchor.label}</span>
                                                                    <span className="rounded-full border border-[rgba(92,92,92,0.1)] px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.08em] text-[rgb(107,107,107)]">
                                                                        {anchor.type}
                                                                    </span>
                                                                    {anchor.supportCount > 0 && (
                                                                        <span className="ml-auto text-[0.62rem] text-[rgb(107,107,107)]">
                                                                            {anchor.supportCount} steady {anchor.supportCount === 1 ? 'note' : 'notes'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="mt-1.5 text-[0.74rem] leading-5 text-[rgb(107,107,107)]">
                                                                    {compactText(anchor.whyItHelps, 100)}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : supportivePeople.length > 0 || groundingAnchors.length > 0 ? (
                                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                                        {[...supportivePeople, ...groundingAnchors].slice(0, 4).map((anchor) => (
                                                            <span
                                                                key={anchor.id}
                                                                className="rounded-full border border-[rgba(92,92,92,0.12)] bg-[rgba(255,255,255,0.62)] px-2.5 py-1 text-[0.66rem] text-[rgb(107,107,107)]"
                                                            >
                                                                {anchor.label}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : null}
                                            </div>

                                            {dashboardInsights && (dashboardInsights.correlations.length > 0 || dashboardInsights.triggerMap.length > 0) && (
                                                <div>
                                                    <h3 className="notive-logo text-[1.3rem] font-semibold leading-tight md:text-[1.45rem]">
                                                        What lifts &amp; what drains
                                                    </h3>
                                                    <div className="mt-4 space-y-2">
                                                        {[...dashboardInsights.correlations.slice(0, 3), ...dashboardInsights.triggerMap.slice(0, 3)]
                                                            .slice(0, 4)
                                                            .map((item) => {
                                                                const topic = 'topic' in item ? item.topic : item.entity;
                                                                return (
                                                                    <div key={topic} className="flex items-center gap-3 rounded-[1rem] border border-[rgba(92,92,92,0.12)] bg-[rgba(255,255,255,0.62)] px-3 py-2">
                                                                        <span className={`inline-block h-2 w-2 rounded-full ${item.direction === 'lifter' ? 'bg-[rgb(138,154,111)]' : 'bg-[rgb(180,120,80)]'}`} />
                                                                        <span className="text-sm text-[rgb(var(--paper-ink))]">{formatNotebookLabel(topic)}</span>
                                                                        <span className="ml-auto text-xs text-[rgb(107,107,107)]">
                                                                            {item.direction === 'lifter' ? 'Steadies mood' : 'Drains energy'}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {primarySupportAnchor?.reconnectSuggestion && (
                                            <p className="mt-4 text-[0.75rem] leading-6 text-[rgb(138,154,111)]">
                                                {primarySupportAnchor.reconnectSuggestion}
                                            </p>
                                        )}
                                    </Surface>
                                )}

                                {/* Small Evidence */}
                                <Surface doodle="star" doodleAccent="apricot" className="app-paper">
                                    <h3 className="notive-logo text-[1.3rem] font-semibold leading-tight md:text-[1.45rem]">
                                        Small Evidence
                                    </h3>
                                    <div className="mt-4 space-y-4">
                                        {evidenceLedger.map((item) => (
                                            <div key={item.title} className="flex gap-4">
                                                <div className="mt-2 h-2 w-2 rounded-full bg-[rgb(138,154,111)]" />
                                                <div>
                                                    <div className="text-sm font-semibold text-[rgb(var(--paper-ink))]">{item.title}</div>
                                                    <div className="mt-1 text-[0.875rem] leading-7 text-[rgb(107,107,107)]">{item.body}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <Link
                                        href={portfolioHref}
                                        className="mt-6 inline-flex w-full items-center justify-center rounded-[1rem] border border-[rgba(138,154,111,0.42)] bg-[rgba(138,154,111,0.12)] px-4 py-3 text-sm font-semibold text-[rgb(92,92,92)] transition-opacity hover:opacity-85"
                                    >
                                        Turn this into a college story →
                                    </Link>
                                </Surface>
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
}
