/* FINAL DASHBOARD — capture-to-value notebook experience
   Zone 1 hero with sprout doodle, tight Zone 2 capture, minimal Zone 3 glance + sub-tabs.
   Matches logo + generated images exactly. Almost zero scrolling on mobile.
   The default hero starts from saved memories and what they can become. */
'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiArrowRight, FiBell, FiBookOpen, FiClock, FiEdit3, FiGrid, FiMic } from 'react-icons/fi';
import useApi from '@/hooks/use-api';
import { useNotificationCount } from '@/hooks/use-notification-count';
import { getSavedDraftWordCount } from '@/hooks/use-entry-draft';
import { getMoodEmoji } from '@/constants/moods';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import {
    getOnboardingState,
    getOnboardingStateFromProfile,
    getRecommendedPrompt,
    OnboardingState,
} from '@/utils/onboarding';
import { NOTIVE_VOICE } from '@/content/notive-voice';
import { progressivePersonalizationService } from '@/services/progressive-personalization.service';
import { buildHomeActionContent, type HomeActionScenario } from '@/services/home-action.service';
import { appendReturnTo, buildCurrentReturnTo } from '@/utils/navigation';
import BridgeCard from '@/components/action/BridgeCard';
import type { StudentActionResponse, StudentSafetyCard, StudentRisk } from '@/components/action/types';
import useTelemetry from '@/hooks/use-telemetry';
import { useGamification } from '@/context/gamification-context';
import DashboardFocusCard from '@/components/dashboard/DashboardFocusCard';
import FloatingCapture from '@/components/dashboard/FloatingCapture';
import DailyGentleReflectionCard from '@/components/dashboard/DailyGentleReflectionCard';
import {
    NotebookDoodle,
    type NotebookAccentName,
    type NotebookDoodleName,
} from '@/components/dashboard/NotebookDoodles';
import {
    buildGentleReflectionDraft,
    type GentleReflectionDraft,
    type GentleReflectionEntry as Entry,
    type GentleReflectionResurfacedMoment as ResurfacedMoment,
    type GentleReflectionThemeCluster as ThemeCluster,
} from '@/services/gentle-reflection.service';
import {
    GENTLE_REFLECTION_ID_PARAM,
    GENTLE_REFLECTION_SOURCE,
    GENTLE_REFLECTION_TAGS_PARAM,
    isGentleReflectionEnabled,
    markGentleReflectionAccepted,
    markGentleReflectionDismissed,
    markGentleReflectionShown,
    shouldPresentGentleReflection,
} from '@/utils/gentle-reflection';
import { deriveWriterDNA } from '@/services/writer-dna.service';
import { getInsightTier, Gate, WhatsComingCard, FirstReadCard, EmptyDashboard } from '@/components/dashboard/ColdStartGate';
const LifeAreaBreakdown = dynamic(() => import('@/components/dashboard/LifeAreaBreakdown'), { ssr: false });
import { Surface } from '@/components/ui/surface';
const DashboardCalmerLayout = dynamic(() => import('@/components/dashboard/DashboardCalmerLayout'), {
    loading: () => <div className="flex min-h-[60vh] items-center justify-center"><Spinner /></div>,
});
import { Spinner } from '@/components/ui';
import NotiveLoadingScreen from '@/components/ui/NotiveLoadingScreen';
import PullToRefreshIndicator from '@/components/layout/PullToRefreshIndicator';
import usePullToRefresh from '@/hooks/use-pull-to-refresh';

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
    accent: NotebookAccentName;
    doodle?: NotebookDoodleName | null;
};

type DeviceContextSummary = {
    location?: { placeName: string; visitCount: number } | null;
    spotify?: { mood: string; topGenre: string; tracksPlayed: number } | null;
    screenTime?: { feeling: string; level: number } | null;
    appSession?: { totalMinutes: number; sessions: number } | null;
    wellness?: { energyLevel: number; stressLevel: number; socialBattery: number } | null;
};

type DashboardPageJournalIntel = {
    vocabulary: { totalUniqueWords: number; richness: number; readingGradeLevel: number; avgWordsPerEntry: number; emotionWordCount: number; emotionWords: string[]; rarityScore: number; recentNewWords: string[]; growthRate: number };
    lifeBalance: { areas: Array<{ area: string; score: number; entryCount: number; dominantMood: string | null; recentTrend: 'up' | 'stable' | 'down' }>; balanceScore: number; dominantArea: string; neglectedArea: string | null };
    peopleMap: { people: Array<{ name: string; count: number; avgMoodWhenMentioned: number; sentiment: 'positive' | 'neutral' | 'negative' | 'mixed'; recentMention: string; contexts: string[] }>; totalPeopleMentioned: number; socialDiversity: number };
    growthLanguage: { totalGrowthPhrases: number; growthDensity: number; topPhrases: Array<{ phrase: string; count: number }>; recentTrend: 'increasing' | 'stable' | 'decreasing'; mindsetRatio: number; fixedMindsetCount: number; growthMindsetCount: number };
    emotionalRange: { uniqueEmotions: number; emotionList: string[]; rangeScore: number; dominantEmotion: string; rarestEmotion: string | null; emotionFrequency: Array<{ emotion: string; count: number; percentage: number }>; complexityScore: number };
    gratitude: { totalExpressions: number; avgPerWeek: number; streak: number; topThemes: string[]; recentTrend: 'growing' | 'stable' | 'fading'; depthScore: number };
    selfTalk: { growthStatements: number; fixedStatements: number; ratio: number; label: string; topGrowthPhrases: string[]; topFixedPhrases: string[] };
    writingVoice: { avgSentenceLength: number; avgParagraphLength: number; readingLevel: string; readingGrade: number; questionFrequency: number; exclamationFrequency: number; firstPersonRatio: number; tenseDistribution: { past: number; present: number; future: number } };
    entryCount: number;
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

const SCENARIO_VISUALS: Record<HomeActionScenario, { accent: NotebookAccentName; doodle: NotebookDoodleName }> = {
    support: { accent: 'amber', doodle: 'knot' },
    school: { accent: 'sage', doodle: 'ladder' },
    conflict: { accent: 'lilac', doodle: 'knot' },
    future: { accent: 'apricot', doodle: 'star' },
    energy: { accent: 'sage', doodle: 'sprout' },
    general: { accent: 'sky', doodle: 'walker' },
};

const SUPPORT_PATTERN = /\b(friend|fight|argument|drama|parent|family|roommate|text|conversation|left out|awkward)\b/i;
const MOON_PATTERN = /\b(night|late|sleep|tired|quiet|alone|overthink|brain dump)\b/i;
const DAILY_CHECKIN_TAGS = new Set(['check-in', 'daily-checkin']);

const getStartOfLocalDay = (ref = new Date()) => {
    const dayStart = new Date(ref);
    dayStart.setHours(0, 0, 0, 0);
    return dayStart;
};

const isDailyCheckInEntry = (entry: Pick<Entry, 'title' | 'tags'>) => {
    const tags = Array.isArray(entry.tags) ? entry.tags : [];
    if (tags.some((tag) => DAILY_CHECKIN_TAGS.has(String(tag).trim().toLowerCase()))) {
        return true;
    }

    return String(entry.title || '').trim().toLowerCase() === 'quick check-in';
};

const countWordsThisWeek = (entries: Entry[]) => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    return entries.reduce((total, entry) => {
        const createdAt = new Date(entry.createdAt);
        if (createdAt < weekStart) return total;
        return total + String(entry.content || '').split(/\s+/).filter(Boolean).length;
    }, 0);
};

const getDominantWritingWindow = (entries: Entry[]) => {
    if (entries.length < 3) return null;

    const windows = [
        { key: 'morning', label: 'morning', match: (hour: number) => hour >= 5 && hour < 12 },
        { key: 'afternoon', label: 'afternoon', match: (hour: number) => hour >= 12 && hour < 17 },
        { key: 'evening', label: 'evening', match: (hour: number) => hour >= 17 && hour < 22 },
        { key: 'night', label: 'night', match: (hour: number) => hour < 5 || hour >= 22 },
    ] as const;

    const counts = windows.map((window) => ({
        ...window,
        count: entries.reduce((total, entry) => {
            const hour = new Date(entry.createdAt).getHours();
            return window.match(hour) ? total + 1 : total;
        }, 0),
    }));

    const strongest = counts.sort((left, right) => right.count - left.count)[0];
    if (!strongest || strongest.count < 2) return null;

    return {
        label: strongest.label,
        count: strongest.count,
    };
};

const compactText = (value: string | null | undefined, maxLength = 110) => {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

const firstSentence = (value: string | null | undefined, maxLength = 120) => {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    const match = normalized.match(/^.*?[.!?](?:\s|$)/);
    const sentence = match ? match[0].trim() : normalized;
    return compactText(sentence, maxLength);
};

const toTitleCase = (value: string | null | undefined) =>
    String(value || '')
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

const formatTraitLabel = (value: string | null | undefined) =>
    toTitleCase(String(value || '').replace(/[_-]+/g, ' ').toLowerCase());

const hasAnyDeviceSignals = (signals: DeviceContextSummary | null) =>
    !!signals && Object.values(signals).some((value) => value);

const getGentleReflectionVisual = (reflection: GentleReflectionDraft): { accent: NotebookAccentName; doodle: NotebookDoodleName } => {
    const sample = `${reflection.contextLabel} ${reflection.title} ${reflection.body} ${reflection.prompt} ${reflection.strengthLabel || ''}`;
    if (SUPPORT_PATTERN.test(sample)) return { accent: 'lilac', doodle: 'knot' };
    if (MOON_PATTERN.test(sample)) return { accent: 'sky', doodle: 'moon' };
    if (/\b(follow-through|consistency|finish|build|project)\b/i.test(sample)) return { accent: 'sage', doodle: 'ladder' };
    if (/\b(courage|leadership|try|brave)\b/i.test(sample)) return { accent: 'apricot', doodle: 'star' };
    return { accent: 'sage', doodle: 'sprout' };
};

const buildSafetyFocus = (input: {
    risk: StudentRisk;
    safetyCard: StudentSafetyCard | null;
}): DashboardFocusConfig => {
    const { risk, safetyCard } = input;
    const label = risk.level === 'red' ? 'Safety' : 'Support first';
    const primaryLabel = safetyCard?.primaryActionLabel || 'Get help now';

    return {
        eyebrow: label,
        title: safetyCard?.headline || 'This moment needs more support than reflection.',
        body: firstSentence(safetyCard?.body, 128) || 'Pause the usual reflection loop and put a real person or resource in the picture.',
        evidenceFallback: 'Based on your latest note.',
        panels: [
            {
                label: 'Next move',
                value: primaryLabel,
            },
            ...(safetyCard?.trustedContactName
                ? [{
                    label: 'Visible support',
                    value: `${safetyCard.trustedContactChannel === 'call' ? 'Call' : safetyCard.trustedContactChannel === 'in_person' ? 'Talk to' : 'Text'} ${safetyCard.trustedContactName}`,
                }]
                : []),
        ],
        primaryAction: safetyCard
            ? {
                label: primaryLabel,
                href: safetyCard.primaryActionHref,
            }
            : null,
        secondaryAction: safetyCard?.secondaryActionHref && safetyCard.secondaryActionLabel
            ? {
                label: safetyCard.secondaryActionLabel,
                href: safetyCard.secondaryActionHref,
                tone: 'secondary',
            }
            : null,
        accent: 'amber',
        doodle: null,
    };
};

const buildValueFocus = (input: {
    entries: Entry[];
    themeClusters: ThemeCluster[];
    storyOverview: DashboardStoryOverview | null;
    homeAction: ReturnType<typeof buildHomeActionContent>;
    newEntryHref: string;
    portfolioHref: string;
    recommendedHref: string;
    timelineHref: string;
    onPrimary: () => void;
}): DashboardFocusConfig => {
    const {
        entries,
        themeClusters,
        storyOverview,
        homeAction,
        newEntryHref,
        portfolioHref,
        recommendedHref,
        timelineHref,
        onPrimary,
    } = input;
    const visual = SCENARIO_VISUALS[homeAction.scenario];
    const latestEntry = entries[0] || null;
    const topTheme = themeClusters[0]?.label || null;
    const extractedLesson = storyOverview?.topLessons?.[0] || null;
    const extractedSkill = storyOverview?.topSkills?.[0] || null;
    const readyToReuse = storyOverview?.experiences.filter((experience) =>
        Boolean(experience.verified || experience.completeness?.readyForExport)
    ).length || 0;
    const readyToReview = storyOverview?.experiences.filter((experience) =>
        Boolean(!experience.verified && experience.completeness?.readyForVerification)
    ).length || 0;
    const extractedSignal = extractedLesson
        ? `Lesson: ${extractedLesson}`
        : extractedSkill
            ? `Skill: ${extractedSkill}`
            : topTheme
                ? `Theme: ${topTheme}`
                : 'Keep capturing real moments to see lessons, skills, and themes emerge.';
    const storyPipeline = storyOverview
        ? readyToReuse > 0
                ? `${readyToReuse} stor${readyToReuse === 1 ? 'y is' : 'ies are'} ready to reuse.`
                : readyToReview > 0
                    ? `${readyToReview} stor${readyToReview === 1 ? 'y is' : 'ies are'} ready for review.`
                    : 'Your diary is building useful outside material.'
        : 'Your diary is building useful outside material.';

    return {
        eyebrow: NOTIVE_VOICE.dashboard.heroEyebrow,
        title: latestEntry ? NOTIVE_VOICE.dashboard.heroTitle : 'Start with one real moment.',
        body: latestEntry
            ? NOTIVE_VOICE.dashboard.heroBody
            : compactText(input.homeAction.intro || 'Capture one real moment. Context builds from there.', 136),
        evidence: storyPipeline,
        evidenceFallback: 'Lessons, skills, and story signals appear after a few notes.',
        // One panel only: the latest capture, resurfaced memory, and story
        // pipeline already have their own places on the dashboard.
        panels: [
            {
                label: 'Lesson / skill / theme',
                value: compactText(extractedSignal, 92),
            },
        ],
        primaryAction: {
            label: latestEntry ? 'Write something new' : 'Write your first memory',
            href: latestEntry ? recommendedHref : newEntryHref,
            onClick: latestEntry ? onPrimary : undefined,
        },
        secondaryAction: {
            label: latestEntry ? 'Open Stories' : 'Browse notebook',
            href: latestEntry ? portfolioHref : timelineHref,
            tone: 'secondary',
        },
        accent: visual.accent,
        doodle: visual.doodle,
    };
};

const buildGentleReflectionFocus = (input: {
    reflection: GentleReflectionDraft;
    journalHref: string;
    onAccept: () => void;
    onDismiss: () => void;
}): DashboardFocusConfig => {
    const { reflection, journalHref, onAccept, onDismiss } = input;
    const visual = getGentleReflectionVisual(reflection);

    return {
        eyebrow: 'Daily Prompt',
        title: compactText(reflection.title, 76),
        body: firstSentence(reflection.body, 132),
        evidence: firstSentence(reflection.evidence, 116),
        evidenceFallback: 'Based on your recent memories.',
        panels: [
            {
                label: 'Today’s prompt',
                value: compactText(reflection.prompt, 94),
            },
            ...(reflection.strengthLabel
                ? [{
                    label: 'Hidden strength',
                    value: compactText(reflection.strengthLabel, 56),
                }]
                : []),
        ],
        primaryAction: {
            label: 'Journal now',
            href: journalHref,
            onClick: onAccept,
        },
        secondaryAction: {
            label: 'Not now',
            onClick: onDismiss,
            type: 'button',
            tone: 'secondary',
        },
        accent: visual.accent,
        doodle: visual.doodle,
    };
};

const buildStarterFocus = (input: {
    homeAction: ReturnType<typeof buildHomeActionContent>;
    newEntryHref: string;
    guideHref: string;
}): DashboardFocusConfig => ({
    eyebrow: 'Start light',
    title: 'Start with one real moment.',
    body: compactText(input.homeAction.intro || 'You do not need a polished story to begin. One real memory is enough.', 128),
    evidenceFallback: 'A simple capture is enough to start.',
    panels: [
        {
            label: 'Starter prompt',
            value: compactText(input.homeAction.prompt, 92),
        },
    ],
    primaryAction: {
        label: 'Write now',
        href: input.newEntryHref,
    },
    secondaryAction: {
        label: 'Chat',
        href: input.guideHref,
        tone: 'secondary',
    },
    accent: 'sky',
    doodle: 'moon',
});

/* ─── Animated loading screen (shared component) ─── */

export default function DashboardPage() {
    const { user, isLoading: authLoading, isAuthenticated } = useAuthRedirect();
    const { apiFetch } = useApi();
    const { trackEvent } = useTelemetry();
    const router = useRouter();
    const { stats: gamificationStats, isLoading: gamificationLoading, refreshStats: refreshGamificationStats } = useGamification();
    const { unreadCount: unreadNotificationCount } = useNotificationCount();
    const [entries, setEntries] = useState<Entry[]>([]);
    const [lifeAreaCounts, setLifeAreaCounts] = useState<Record<string, number>>({});
    const [resurfacedMoments, setResurfacedMoments] = useState<ResurfacedMoment[]>([]);
    const [onThisDayEntries, setOnThisDayEntries] = useState<Array<{
        id: string;
        title: string | null;
        snippet: string;
        mood: string | null;
        createdAt: string;
        timeLabel: string;
    }>>([]);
    const [themeClusters, setThemeClusters] = useState<ThemeCluster[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dashboardInsightsLoaded, setDashboardInsightsLoaded] = useState(false);
    const [journalIntelLoaded, setJournalIntelLoaded] = useState(false);
    const [deviceSignalsLoaded, setDeviceSignalsLoaded] = useState(false);
    const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
    const [todayAction, setTodayAction] = useState<StudentActionResponse | null>(null);
    const [gentleReflection, setGentleReflection] = useState<GentleReflectionDraft | null>(null);
    const [gentleReflectionsEnabled, setGentleReflectionsEnabled] = useState(false);
    const [dashboardInsights, setDashboardInsights] = useState<{
        emotionalFingerprint: { axes: Array<{ emotion: string; score: number; entryCount: number }>; summary: string; uniqueness: number } | null;
        resilience: { currentRecovery: number | null; previousRecovery: number | null; trend: 'improving' | 'stable' | 'declining' | 'insufficient_data'; narrative: string; dipCount: number } | null;
        reflectionDepth: { level: 0 | 1 | 2 | 3 | 4; levelLabel: string; score: number; progressToNext: number } | null;
        correlations: Array<{ topic: string; avgMoodWhenPresent: number; avgMoodWhenAbsent: number; delta: number; occurrences: number; direction: 'lifter' | 'drain' }>;
        contradictions: Array<{ entryId: string; entryTitle: string | null; entryDate: string; statedMood: string; detectedSentiment: string; divergenceScore: number; description: string }>;
        triggerMap: Array<{ entity: string; direction: 'lifter' | 'drain'; avgMoodDelta: number; occurrences: number }>;
        vocabularyExpansion: { newWords: string[]; growthRate: number; totalUniqueWords: number } | null;
    } | null>(null);
    const [heroInsight, setHeroInsight] = useState<{
        id?: string; category: string; title: string; body: string;
        evidence: string | null; entryIds: string[]; qualityScore: number; freshness?: 'cached' | 'fresh';
    } | null>(null);
    const [heroInsightLoading, setHeroInsightLoading] = useState(false);
    const [journalIntel, setJournalIntel] = useState<DashboardPageJournalIntel | null>(null);
    const [weeklyDigest, setWeeklyDigest] = useState<DashboardWeeklyDigest | null>(null);
    const [storyOverview, setStoryOverview] = useState<DashboardStoryOverview | null>(null);
    const [supportMap, setSupportMap] = useState<DashboardSupportMap | null>(null);
    const [deviceSignals, setDeviceSignals] = useState<DeviceContextSummary | null>(null);
    const [wellnessSubmitted, setWellnessSubmitted] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const fromProfile = getOnboardingStateFromProfile(user?.profile);
        if (fromProfile) {
            setOnboarding(fromProfile);
            return;
        }

        setOnboarding(getOnboardingState(user?.id));
    }, [user]);

    useEffect(() => {
        setGentleReflectionsEnabled(isGentleReflectionEnabled(user?.profile?.personalizationSignals));
    }, [user?.profile?.personalizationSignals]);

    const draftWordCount = useMemo(
        () => getSavedDraftWordCount(user?.id),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [user?.id]
    );
    const showContinueDraft = draftWordCount >= 40;

    useEffect(() => {
        const controller = new AbortController();
        let mounted = true;
        const deferredTasks: ReturnType<typeof setTimeout>[] = [];

        const scheduleDeferred = (delayMs: number, task: () => void) => {
            const timer = setTimeout(() => {
                if (!mounted || controller.signal.aborted) return;
                task();
            }, delayMs);
            deferredTasks.push(timer);
        };

        const fetchEntries = async () => {
            setIsLoading(true);
            setEntries([]);
            setResurfacedMoments([]);
            setThemeClusters([]);
            setTodayAction(null);
            setDashboardInsights(null);
            setJournalIntel(null);
            setWeeklyDigest(null);
            setStoryOverview(null);
            setSupportMap(null);
            setHeroInsight(null);
            setDeviceSignals(null);
            setWellnessSubmitted(false);
            try {
                let fetchedEntriesCount = 0;
                const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                const [entriesResponse, resurfacedResponse, onThisDayResponse, clustersResponse, actionResponse] = await Promise.all([
                    apiFetch(`/entries`, { signal: controller.signal }),
                    apiFetch(`/entries/resurfaced?limit=3`, { signal: controller.signal }).catch(() => null),
                    apiFetch(`/entries/resurfaced/on-this-day?timezone=${encodeURIComponent(tz)}`, { signal: controller.signal }).catch(() => null),
                    apiFetch(`/entries/theme-clusters?limit=4`, { signal: controller.signal }).catch(() => null),
                    apiFetch(`/ai/action/today`, { signal: controller.signal }).catch(() => null),
                ]);

                if (mounted && entriesResponse.ok) {
                    const data = await entriesResponse.json();
                    setEntries(data.entries);
                    fetchedEntriesCount = Array.isArray(data?.entries) ? data.entries.length : 0;
                    const counts = (data?.facets?.lifeAreaCounts as Record<string, number> | undefined) || {};
                    setLifeAreaCounts(counts);
                }

                if (mounted && resurfacedResponse?.ok) {
                    const data = await resurfacedResponse.json().catch(() => null);
                    setResurfacedMoments(Array.isArray(data?.resurfaced) ? data.resurfaced : []);
                } else if (mounted) {
                    setResurfacedMoments([]);
                }

                if (mounted && onThisDayResponse?.ok) {
                    const data = await onThisDayResponse.json().catch(() => null);
                    setOnThisDayEntries(Array.isArray(data?.entries) ? data.entries : []);
                } else if (mounted) {
                    setOnThisDayEntries([]);
                }

                if (mounted && clustersResponse?.ok) {
                    const data = await clustersResponse.json().catch(() => null);
                    setThemeClusters(Array.isArray(data?.clusters) ? data.clusters : []);
                } else if (mounted) {
                    setThemeClusters([]);
                }

                if (mounted && actionResponse?.ok) {
                    const data = await actionResponse.json().catch(() => null);
                    setTodayAction(data || null);
                } else if (mounted) {
                    setTodayAction(null);
                }

                const entryCount = fetchedEntriesCount;

                // Fetch the combined insights bundle — one backend call that runs
                // dashboard-insights and journal-intelligence builders over the same
                // Prisma rows (replaces the old split /dashboard-insights +
                // /journal-intelligence pair).
                if (entryCount >= 3) {
                    setDashboardInsightsLoaded(false);
                    setJournalIntelLoaded(false);
                    scheduleDeferred(120, () => {
                        apiFetch(`/analytics/insights-bundle`, { signal: controller.signal })
                            .then(async (r) => {
                                if (!mounted || !r.ok) return;
                                const data = await r.json().catch(() => null);
                                if (!mounted || !data) return;
                                if (data.dashboardInsights) setDashboardInsights(data.dashboardInsights);
                                if (data.intelligence) setJournalIntel(data.intelligence);
                            })
                            .catch(() => { /* non-critical */ })
                            .finally(() => {
                                if (mounted) {
                                    setDashboardInsightsLoaded(true);
                                    setJournalIntelLoaded(true);
                                }
                            });
                    });
                } else if (mounted) {
                    setDashboardInsightsLoaded(true);
                    setJournalIntelLoaded(true);
                }

                // Fetch LLM hero insight only after enough notes exist and core context is on screen.
                if (entryCount >= 5) {
                    scheduleDeferred(280, () => {
                        setHeroInsightLoading(true);
                        apiFetch(`/ai/dashboard-insight`, { signal: controller.signal })
                            .then(async (r) => {
                                if (!mounted || !r.ok) return;
                                const data = await r.json().catch(() => null);
                                if (mounted && data?.insight) setHeroInsight(data.insight);
                            })
                            .catch(() => { /* non-critical */ })
                            .finally(() => { if (mounted) setHeroInsightLoading(false); });
                    });
                } else if (mounted) {
                    setHeroInsightLoading(false);
                }

                if (entryCount >= 1) {
                    scheduleDeferred(260, () => {
                        apiFetch(`/ai/opportunity/overview`, { signal: controller.signal })
                            .then(async (r) => {
                                if (!mounted || !r.ok) return;
                                const data = await r.json().catch(() => null);
                                if (mounted && data?.overview) {
                                    setStoryOverview(data.overview as DashboardStoryOverview);
                                }
                            })
                            .catch(() => { /* non-critical */ });
                    });
                }

                // Weekly digest + support map arrive after the core notebook is visible.
                // Journal intelligence is already populated by the insights-bundle call above.
                if (entryCount >= 3) {
                    scheduleDeferred(360, () => {
                        apiFetch(`/ai/weekly-digest`, { signal: controller.signal })
                            .then(async (r) => {
                                if (!mounted || !r.ok) return;
                                const data = await r.json().catch(() => null);
                                if (mounted && data?.digest) setWeeklyDigest(data.digest);
                            })
                            .catch(() => { /* non-critical */ });
                    });

                    scheduleDeferred(460, () => {
                        apiFetch(`/ai/support-map?period=month`, { signal: controller.signal })
                            .then(async (r) => {
                                if (!mounted || !r.ok) return;
                                const data = await r.json().catch(() => null);
                                if (mounted && Array.isArray(data?.anchors)) {
                                    setSupportMap(data as DashboardSupportMap);
                                }
                            })
                            .catch(() => { /* non-critical */ });
                    });
                } else if (mounted) {
                    setJournalIntelLoaded(true);
                }

                // Fetch latest device signals (non-blocking)
                setDeviceSignalsLoaded(false);
                scheduleDeferred(80, () => {
                    apiFetch(`/device/latest`, { signal: controller.signal })
                        .then(async (r) => {
                            if (!mounted || !r.ok) return;
                            const data = await r.json().catch(() => null);
                            if (mounted && data?.signals) {
                                const nextSignals = data.signals as DeviceContextSummary;
                                setDeviceSignals(hasAnyDeviceSignals(nextSignals) ? nextSignals : null);
                                if (nextSignals?.wellness) setWellnessSubmitted(true);
                            }
                        })
                        .catch(() => { /* non-critical */ })
                        .finally(() => {
                            if (mounted) setDeviceSignalsLoaded(true);
                        });
                    });
            } catch (error) {
                if (controller.signal.aborted) return;
                console.error('Failed to fetch dashboard context:', error);
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        if (user) {
            fetchEntries();
        }

        return () => {
            mounted = false;
            controller.abort();
            deferredTasks.forEach((timer) => clearTimeout(timer));
        };
    }, [apiFetch, refreshKey, user]);

    useEffect(() => {
        if (!user?.id || isLoading || !gentleReflectionsEnabled) {
            setGentleReflection(null);
            return;
        }

        const nextReflection = buildGentleReflectionDraft({
            entries,
            resurfacedMoments,
            themeClusters,
        });

        if (!nextReflection) {
            setGentleReflection(null);
            return;
        }

        if (!shouldPresentGentleReflection({
            userId: user.id,
            promptSignature: nextReflection.id,
            enabled: gentleReflectionsEnabled,
        })) {
            setGentleReflection(null);
            return;
        }

        markGentleReflectionShown(user.id, nextReflection.id);
        setGentleReflection(nextReflection);
        void trackEvent({
            eventType: 'gentle_reflection_shown',
            value: nextReflection.id,
            metadata: {
                sourceMode: 'journal_only',
                context: nextReflection.contextLabel,
                strength: nextReflection.strengthLabel || null,
            },
        });
    }, [entries, gentleReflectionsEnabled, isLoading, resurfacedMoments, themeClusters, trackEvent, user?.id]);

    // Keep hooks above early returns so React sees the same order on every render.
    const streak = gamificationLoading ? null : (gamificationStats?.currentStreak ?? null);
    const [calendarRefreshTrigger, setCalendarRefreshTrigger] = useState(0);
    const totalWords = gamificationLoading ? null : (gamificationStats?.totalWords ?? null);

    // ── Daily Check-In ────────────────────────────────
    const todayCheckInEntry = useMemo(() => {
        const todayStart = getStartOfLocalDay();
        return entries.find((entry) => (
            isDailyCheckInEntry(entry) && new Date(entry.createdAt) >= todayStart
        )) ?? null;
    }, [entries]);
    const hasCheckedInToday = Boolean(todayCheckInEntry);
    const todayCheckInMood = todayCheckInEntry?.mood ?? null;

    const handleDailyCheckIn = useCallback(async (mood: string, note: string) => {
        const content = note || `Feeling ${mood} today.`;
        const res = await apiFetch(`/entries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, mood, title: 'Quick check-in', tags: ['check-in'], entryMode: 'quick' }),
        });
        if (!res.ok) {
            const errorData = await res.json().catch(() => null);
            throw new Error(errorData?.message || 'Couldn’t save your check-in. Please try again.');
        }

        const saved = await res.json().catch(() => null);
        const normalizedEntry = {
            ...saved,
            content: saved?.content ?? content,
            mood: saved?.mood ?? mood,
            title: saved?.title ?? 'Quick check-in',
            tags: Array.isArray(saved?.tags) && saved.tags.length > 0 ? saved.tags : ['check-in'],
            createdAt: saved?.createdAt ?? new Date().toISOString(),
        } as Entry;
        const todayStart = getStartOfLocalDay();

        setEntries((prev) => [
            normalizedEntry,
            ...prev.filter((entry) => !(isDailyCheckInEntry(entry) && new Date(entry.createdAt) >= todayStart)),
        ]);
        void refreshGamificationStats();
        void trackEvent({ eventType: 'daily_checkin', metadata: { mood } });
    }, [apiFetch, refreshGamificationStats, trackEvent]);
    const writerDNA = useMemo(() => deriveWriterDNA({
        entries: entries.map((e) => ({ mood: e.mood, createdAt: e.createdAt, contentLength: e.content?.length ?? 0 })),
        themeClusters: themeClusters.map((t) => ({ label: t.label, dominantMood: t.dominantMood, entryCount: t.entryCount })),
        totalWords: totalWords ?? 0,
        currentStreak: streak ?? 0,
    }), [entries, themeClusters, totalWords, streak]);
    const handlePullToRefresh = useCallback(async () => {
        router.refresh();
        await refreshGamificationStats();
        setRefreshKey((current) => current + 1);
    }, [refreshGamificationStats, router]);

    const pullToRefresh = usePullToRefresh({
        enabled: true,
        onRefresh: handlePullToRefresh,
    });

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Spinner size="md" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    if (isLoading) {
        return <NotiveLoadingScreen />;
    }

    const safeUser = user!;
    const firstName = safeUser.name ? safeUser.name.split(' ')[0] : 'there';
    const todayLabel = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });

    const insightTier = getInsightTier(entries.length);

    const profileRecommendedPrompt = progressivePersonalizationService.getPromptSuggestionForProfile(user?.profile);
    const fallbackRecommendedPrompt = onboarding?.starterPrompt?.trim() || profileRecommendedPrompt || getRecommendedPrompt(onboarding);
    const dashboardReturnTo = buildCurrentReturnTo('/dashboard', '');
    const newEntryHref = appendReturnTo('/entry/new?mode=quick', dashboardReturnTo);
    const voiceEntryHref = appendReturnTo('/entry/new?mode=quick&source=dashboard_voice&autoRecord=1', dashboardReturnTo);
    const guideHref = appendReturnTo('/chat', dashboardReturnTo);
    const portfolioHref = appendReturnTo('/portfolio?view=growth', dashboardReturnTo);
    const timelineHref = appendReturnTo('/timeline', dashboardReturnTo);
    const onboardingTrackLabel = onboarding?.track === 'career'
        ? 'Career Growth'
        : onboarding?.track === 'life'
            ? 'Personal Growth'
            : onboarding?.track === 'both'
                ? 'Life + Career Growth'
                : 'Personal Reflection';
    const profileLocation = safeUser.profile?.location?.trim() || null;
    const experienceLevelLabel = onboarding?.experienceLevel === 'student'
        ? 'Student'
        : onboarding?.experienceLevel === 'early-career'
            ? 'Early career'
            : onboarding?.experienceLevel === 'professional'
                ? 'Professional'
                : onboarding?.experienceLevel === 'lifelong-learner'
                    ? 'Lifelong learner'
                    : null;
    const focusAreaLabel = safeUser.profile?.focusArea === 'career'
        ? 'School / Work'
        : safeUser.profile?.focusArea === 'life'
            ? 'Life'
            : safeUser.profile?.focusArea === 'both'
                ? 'Life + work'
                : onboarding?.track === 'career'
                    ? 'School / Work'
                    : onboarding?.track === 'life'
                        ? 'Life'
                        : onboarding?.track === 'both'
                            ? 'Life + work'
                            : null;
    const goalMap = NOTIVE_VOICE.onboarding.goalLabels;
    const resolveGoalLabel = (value: string | null | undefined) =>
        value && value in goalMap
            ? goalMap[value as keyof typeof goalMap]
            : null;
    const primaryGoalLabel =
        resolveGoalLabel(safeUser.profile?.primaryGoal)
        ?? resolveGoalLabel(onboarding?.goal)
        ?? null;
    const profileTags = [experienceLevelLabel, focusAreaLabel, primaryGoalLabel].filter(Boolean).slice(0, 3) as string[];
    const todayBrief = todayAction?.brief || null;
    const todayBridge = todayAction?.bridge || null;
    const openDashboardEntryHref = (entryId: string) => appendReturnTo(`/entry/view?id=${entryId}`, dashboardReturnTo);
    const latestEntry = entries[0] || null;
    const homeAction = buildHomeActionContent({
        todayAction,
        entries,
        onboardingTrackLabel,
        fallbackPrompt: fallbackRecommendedPrompt,
    });
    const recommendedHref = appendReturnTo(`/entry/new?mode=quick&prompt=${encodeURIComponent(homeAction.prompt)}&source=dashboard_one_thing`, dashboardReturnTo);
    const gentleJournalHref = gentleReflection
        ? appendReturnTo(
            `/entry/new?mode=quick&prompt=${encodeURIComponent(gentleReflection.prompt)}&source=${GENTLE_REFLECTION_SOURCE}&${GENTLE_REFLECTION_ID_PARAM}=${encodeURIComponent(gentleReflection.id)}&${GENTLE_REFLECTION_TAGS_PARAM}=${encodeURIComponent(gentleReflection.seedTags.join(','))}`,
            dashboardReturnTo
        )
        : null;

    const handleDashboardBridgeCopy = (recipient: string) => {
        void trackEvent({
            eventType: 'student_bridge_copied',
            field: 'recipient',
            value: recipient,
            metadata: {
                surface: 'dashboard',
                riskLevel: todayAction?.risk.level || 'none',
            },
        });
    };

    const handleAcceptGentleReflection = () => {
        if (!user?.id || !gentleReflection) return;
        markGentleReflectionAccepted(user.id, gentleReflection.id);
        setGentleReflection(null);
        void trackEvent({
            eventType: 'gentle_reflection_accepted',
            value: gentleReflection.id,
            metadata: {
                context: gentleReflection.contextLabel,
                strength: gentleReflection.strengthLabel || null,
            },
        });
    };

    const handleDismissGentleReflection = () => {
        if (!user?.id || !gentleReflection) return;
        markGentleReflectionDismissed(user.id, gentleReflection.id);
        setGentleReflection(null);
        void trackEvent({
            eventType: 'gentle_reflection_dismissed',
            value: gentleReflection.id,
            metadata: {
                context: gentleReflection.contextLabel,
            },
        });
    };

    const handleStartOneThing = () => {
        void trackEvent({
            eventType: 'dashboard_primary_cta',
            field: 'one_thing',
            value: homeAction.scenario,
            metadata: {
                label: homeAction.primaryCtaLabel,
                promptSource: homeAction.promptSource,
                groundingCount: homeAction.groundingCount,
                riskLevel: todayAction?.risk.level || 'none',
            },
        });
    };

    let focusCard: DashboardFocusConfig;
    if (todayAction && (todayAction.risk.level === 'orange' || todayAction.risk.level === 'red')) {
        focusCard = buildSafetyFocus({
            risk: todayAction.risk,
            safetyCard: todayAction.safetyCard,
        });
    } else if (entries.length > 0) {
        focusCard = buildValueFocus({
            entries,
            themeClusters,
            storyOverview,
            homeAction,
            newEntryHref,
            portfolioHref,
            recommendedHref,
            timelineHref,
            onPrimary: handleStartOneThing,
        });
    } else {
        focusCard = buildStarterFocus({
            homeAction,
            newEntryHref,
            guideHref,
        });
    }

    // ── Then → Now (requires 90+ days of data) ──
    const oldestEntry = entries.length > 0 ? entries[entries.length - 1] : null;
    const daysSinceFirst = oldestEntry
        ? Math.floor((Date.now() - new Date(oldestEntry.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
    const showThenNow = daysSinceFirst >= 90 && themeClusters.length >= 2;
    const hasDeviceSignals = hasAnyDeviceSignals(deviceSignals);
    const hasSafetyFocus = !!(todayAction && (todayAction.risk.level === 'orange' || todayAction.risk.level === 'red'));
    const showCalmerDashboard = !hasSafetyFocus && entries.length < 10;

    if (process.env.NEXT_PUBLIC_DASHBOARD_REFINED !== '0') {
        return (
            <>
                <PullToRefreshIndicator
                    pullDistance={pullToRefresh.pullDistance}
                    progress={pullToRefresh.progress}
                    isReady={pullToRefresh.isReady}
                    isRefreshing={pullToRefresh.isRefreshing}
                />
                <DashboardCalmerLayout
                    showCalmerLayout={showCalmerDashboard}
                    firstName={firstName}
                    userId={user?.id ?? null}
                    avatarUrl={safeUser.avatarUrl}
                    todayLabel={todayLabel}
                    locationLabel={profileLocation}
                    userBirthDate={safeUser.profile?.birthDate ? String(safeUser.profile.birthDate) : null}
                    profileTags={profileTags}
                    outputGoals={safeUser.profile?.outputGoals || []}
                    entries={entries}
                    themeClusters={themeClusters}
                    resurfacedMoments={resurfacedMoments}
                    totalWords={totalWords}
                    todayBrief={todayBrief}
                    focusCard={focusCard}
                    recommendedHref={recommendedHref}
                    openDashboardEntryHref={openDashboardEntryHref}
                    gentleReflection={gentleReflection}
                    gentleJournalHref={gentleJournalHref}
                    timelineHref={timelineHref}
                    portfolioHref={portfolioHref}
                    guideHref={guideHref}
                    dashboardReturnTo={dashboardReturnTo}
                    hasSafetyFocus={hasSafetyFocus}
                    setGentleReflectionsEnabled={setGentleReflectionsEnabled}
                    setGentleReflection={setGentleReflection}
                    gentleReflectionsEnabled={gentleReflectionsEnabled}
                    handleAcceptGentleReflection={handleAcceptGentleReflection}
                    handleDismissGentleReflection={handleDismissGentleReflection}
                    todayBridge={todayBridge}
                    handleDashboardBridgeCopy={handleDashboardBridgeCopy}
                    showThenNow={showThenNow}
                    oldestEntry={oldestEntry}
                    daysSinceFirst={daysSinceFirst}
                    wellnessSubmitted={wellnessSubmitted}
                    deviceSignals={deviceSignals}
                    hasDeviceSignals={hasDeviceSignals}
                    writerDNA={writerDNA}
                    dashboardInsights={dashboardInsights}
                    journalIntel={journalIntel}
                    weeklyDigest={weeklyDigest}
                    storyOverview={storyOverview}
                    hasCheckedInToday={hasCheckedInToday}
                    todayCheckInMood={todayCheckInMood}
                    onDailyCheckIn={handleDailyCheckIn}
                    supportMap={supportMap}
                    heroInsight={heroInsight}
                    heroInsightLoading={heroInsightLoading}
                    insightTier={insightTier}
                />
                {!showCalmerDashboard && (
                    <div className="mx-auto max-w-3xl px-4 pb-[calc(var(--app-bottom-clearance,5rem)+1.25rem)] md:pb-0">
                        <details className="mt-2 rounded-2xl border border-[rgba(141,123,105,0.16)] bg-[rgba(255,255,255,0.03)]">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink-secondary">
                                <span>Browse by life area</span>
                                <span className="text-xs uppercase tracking-[0.12em] text-ink-muted">Optional</span>
                            </summary>
                            <div className="border-t border-[rgba(141,123,105,0.14)] px-1 pb-1">
                                <LifeAreaBreakdown counts={lifeAreaCounts} />
                            </div>
                        </details>
                    </div>
                )}
            </>
        );
    }
}
