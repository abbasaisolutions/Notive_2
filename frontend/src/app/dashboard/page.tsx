/* FINAL DASHBOARD — "One calm page" notebook experience
   Zone 1 hero with sprout doodle, tight Zone 2 capture, minimal Zone 3 glance + sub-tabs.
   Matches logo + generated images exactly. Almost zero scrolling on mobile.
   Every teen gets one grounded next move immediately. */
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { FiBookOpen, FiClock, FiEdit3, FiGrid, FiMic } from 'react-icons/fi';
import useApi from '@/hooks/use-api';
import { API_URL } from '@/constants/config';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import {
    getOnboardingState,
    getOnboardingStateFromProfile,
    getRecommendedPrompt,
    OnboardingState,
} from '@/utils/onboarding';
import { progressivePersonalizationService } from '@/services/progressive-personalization.service';
import { buildHomeActionContent, type HomeActionScenario } from '@/services/home-action.service';
import { appendReturnTo, buildCurrentReturnTo } from '@/utils/navigation';
import ActionBriefPanel from '@/components/action/ActionBriefPanel';
import BridgeCard from '@/components/action/BridgeCard';
import type { StudentActionResponse, StudentActionBrief, StudentSafetyCard, StudentRisk } from '@/components/action/types';
import useTelemetry from '@/hooks/use-telemetry';
import { useGamification } from '@/context/gamification-context';
import DashboardFocusCard from '@/components/dashboard/DashboardFocusCard';
import FloatingCapture from '@/components/dashboard/FloatingCapture';
import DailyGentleReflectionCard from '@/components/dashboard/DailyGentleReflectionCard';
import MoodSparkline, { hasMeaningfulMoodHistory } from '@/components/dashboard/MoodSparkline';
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
import { getInsightTier, Gate, WhatsComingCard, EmptyDashboard } from '@/components/dashboard/ColdStartGate';
import QuickPulseStrip from '@/components/dashboard/QuickPulseStrip';
import PrimeTimePrediction from '@/components/dashboard/PrimeTimePrediction';
import WritingRhythmCalendar from '@/components/dashboard/WritingRhythmCalendar';
import EmotionalFingerprint from '@/components/dashboard/EmotionalFingerprint';
import ResilienceCard from '@/components/dashboard/ResilienceCard';
import ReflectionDepthMeter from '@/components/dashboard/ReflectionDepthMeter';
import PatternDiscoveryFeed from '@/components/dashboard/PatternDiscoveryFeed';
import HeroInsightCard from '@/components/dashboard/HeroInsightCard';
import DeviceContextStrip from '@/components/dashboard/DeviceContextStrip';
import DashboardNoticeCard from '@/components/dashboard/DashboardNoticeCard';
import WellnessCheckin from '@/components/dashboard/WellnessCheckin';
import type { WellnessData } from '@/components/dashboard/WellnessCheckin';
import JournalIntelligenceSection from '@/components/dashboard/JournalIntelligenceSection';
import { Surface } from '@/components/ui/surface';
import DashboardNotebookView from '@/components/dashboard/DashboardNotebookView';
import { Spinner } from '@/components/ui';

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

type DashboardTab = 'recent' | 'moments' | 'patterns';

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

const MOOD_EMOJI: Record<string, string> = {
    happy: '😊', calm: '😌', sad: '😔', anxious: '😟',
    frustrated: '😤', thoughtful: '🤔', motivated: '⚡', tired: '😴', grateful: '🙏',
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
const TAB_ORDER: DashboardTab[] = ['recent', 'moments', 'patterns'];
const TAB_LABELS: Record<DashboardTab, string> = {
    recent: 'Recent notes',
    moments: 'Moments',
    patterns: 'Patterns',
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

const WEAK_SUPPORT_PANEL_WORDS = new Set([
    'what',
    'why',
    'how',
    'when',
    'where',
    'who',
    'thing',
    'things',
    'something',
    'anything',
    'everything',
    'nothing',
    'happen',
    'happened',
    'happening',
    'going',
    'doing',
    'did',
    'feel',
    'feeling',
    'think',
    'thinking',
    'today',
    'life',
    'live',
    'writing',
    'journal',
]);

const looksTooThinForSupportPanel = (value: string) => {
    const normalized = value.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!normalized) return true;

    const stripped = normalized.replace(/\bstill helps\b$/, '').trim();
    const words = stripped.split(/\s+/).filter(Boolean);

    if (stripped.length < 8 || words.length < 2) return true;
    if (words.every((word) => WEAK_SUPPORT_PANEL_WORDS.has(word))) return true;

    return false;
};


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

const buildActionFocus = (input: {
    brief: StudentActionBrief | null;
    homeAction: ReturnType<typeof buildHomeActionContent>;
    recommendedHref: string;
    timelineHref: string;
    guideHref: string;
    onPrimary: () => void;
}): DashboardFocusConfig => {
    const { brief, homeAction, recommendedHref, timelineHref, guideHref, onPrimary } = input;
    const visual = SCENARIO_VISUALS[homeAction.scenario];
    const nextStep = brief?.nextMove?.description
        || brief?.nextMove?.label
        || homeAction.prompt;

    const keepLabelValue = brief?.keep?.label
        ? compactText(toTitleCase(brief.keep.label), 64)
        : '';
    const secondPanelValue = keepLabelValue && !looksTooThinForSupportPanel(keepLabelValue)
        ? keepLabelValue
        : brief?.keep?.evidence
            ? firstSentence(brief.keep.evidence, 88)
            : brief?.whatHelpedBefore?.summary
                ? compactText(brief.whatHelpedBefore.summary, 88)
                : brief?.reachOut?.label
                    ? compactText(brief.reachOut.label, 64)
                    : '';

    return {
        eyebrow: 'One Thing',
        title: compactText(brief?.headline || homeAction.title, 72),
        body: firstSentence(brief?.pattern || homeAction.body, 136),
        evidence: firstSentence(homeAction.evidence, 120),
        evidenceFallback: 'Based on your last 3 notes.',
        panels: [
            {
                label: 'Next step',
                value: compactText(nextStep, 92),
            },
            ...(secondPanelValue
                ? [{
                    label: brief?.keep?.label ? 'Growing' : brief?.whatHelpedBefore ? 'Helped before' : 'Reach out',
                    value: secondPanelValue,
                }]
                : []),
        ],
        primaryAction: {
            label: homeAction.primaryCtaLabel,
            href: recommendedHref,
            onClick: onPrimary,
        },
        secondaryAction: {
            label: 'More options',
            href: brief?.reachOut ? guideHref : timelineHref,
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
        eyebrow: 'Gentle Reflection',
        title: compactText(reflection.title, 76),
        body: firstSentence(reflection.body, 132),
        evidence: firstSentence(reflection.evidence, 116),
        evidenceFallback: 'Based on your recent notes.',
        panels: [
            {
                label: 'Today’s nudge',
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
    title: 'One honest note is enough.',
    body: compactText(input.homeAction.intro || 'You do not need a full story to begin.', 128),
    evidenceFallback: 'A gentle place to start based on your setup so far.',
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
        label: 'More options',
        href: input.guideHref,
        tone: 'secondary',
    },
    accent: 'sky',
    doodle: 'moon',
});

export default function DashboardPage() {
    const { user, isLoading: authLoading, isAuthenticated } = useAuthRedirect();
    const { apiFetch } = useApi();
    const { trackEvent } = useTelemetry();
    const { stats: gamificationStats, isLoading: gamificationLoading } = useGamification();
    const [entries, setEntries] = useState<Entry[]>([]);
    const [resurfacedMoments, setResurfacedMoments] = useState<ResurfacedMoment[]>([]);
    const [themeClusters, setThemeClusters] = useState<ThemeCluster[]>([]);
    const [activeTab, setActiveTab] = useState<DashboardTab>('recent');
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
        evidence: string | null; entryIds: string[]; qualityScore: number;
    } | null>(null);
    const [heroInsightLoading, setHeroInsightLoading] = useState(false);
    const [journalIntel, setJournalIntel] = useState<DashboardPageJournalIntel | null>(null);
    const [weeklyDigest, setWeeklyDigest] = useState<DashboardWeeklyDigest | null>(null);
    const [supportMap, setSupportMap] = useState<DashboardSupportMap | null>(null);
    const [deviceSignals, setDeviceSignals] = useState<DeviceContextSummary | null>(null);
    const [wellnessSubmitted, setWellnessSubmitted] = useState(false);

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
            setSupportMap(null);
            setHeroInsight(null);
            setDeviceSignals(null);
            setWellnessSubmitted(false);
            try {
                let fetchedEntriesCount = 0;
                const [entriesResponse, resurfacedResponse, clustersResponse, actionResponse] = await Promise.all([
                    apiFetch(`${API_URL}/entries`, { signal: controller.signal }),
                    apiFetch(`${API_URL}/entries/resurfaced?limit=3`, { signal: controller.signal }).catch(() => null),
                    apiFetch(`${API_URL}/entries/theme-clusters?limit=4`, { signal: controller.signal }).catch(() => null),
                    apiFetch(`${API_URL}/ai/action/today`, { signal: controller.signal }).catch(() => null),
                ]);

                if (mounted && entriesResponse.ok) {
                    const data = await entriesResponse.json();
                    setEntries(data.entries);
                    fetchedEntriesCount = Array.isArray(data?.entries) ? data.entries.length : 0;
                }

                if (mounted && resurfacedResponse?.ok) {
                    const data = await resurfacedResponse.json().catch(() => null);
                    setResurfacedMoments(Array.isArray(data?.resurfaced) ? data.resurfaced : []);
                } else if (mounted) {
                    setResurfacedMoments([]);
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

                // Fetch dashboard insights (non-blocking, secondary call)
                if (entryCount >= 3) {
                    setDashboardInsightsLoaded(false);
                    scheduleDeferred(120, () => {
                        apiFetch(`${API_URL}/analytics/dashboard-insights`, { signal: controller.signal })
                            .then(async (r) => {
                                if (!mounted || !r.ok) return;
                                const data = await r.json().catch(() => null);
                                if (mounted && data) setDashboardInsights(data);
                            })
                            .catch(() => { /* non-critical */ })
                            .finally(() => {
                                if (mounted) setDashboardInsightsLoaded(true);
                            });
                    });
                } else if (mounted) {
                    setDashboardInsightsLoaded(true);
                }

                // Fetch LLM hero insight only after enough notes exist and core context is on screen.
                if (entryCount >= 5) {
                    scheduleDeferred(280, () => {
                        setHeroInsightLoading(true);
                        apiFetch(`${API_URL}/ai/dashboard-insight`, { signal: controller.signal })
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

                // Journal intelligence and deeper synthesis arrive after the core notebook is visible.
                if (entryCount >= 3) {
                    setJournalIntelLoaded(false);
                    scheduleDeferred(220, () => {
                        apiFetch(`${API_URL}/analytics/journal-intelligence`, { signal: controller.signal })
                            .then(async (r) => {
                                if (!mounted || !r.ok) return;
                                const data = await r.json().catch(() => null);
                                if (mounted && data?.intelligence) setJournalIntel(data.intelligence);
                            })
                            .catch(() => { /* non-critical */ })
                            .finally(() => {
                                if (mounted) setJournalIntelLoaded(true);
                            });
                    });

                    scheduleDeferred(360, () => {
                        apiFetch(`${API_URL}/ai/weekly-digest`, { signal: controller.signal })
                            .then(async (r) => {
                                if (!mounted || !r.ok) return;
                                const data = await r.json().catch(() => null);
                                if (mounted && data?.digest) setWeeklyDigest(data.digest);
                            })
                            .catch(() => { /* non-critical */ });
                    });

                    scheduleDeferred(460, () => {
                        apiFetch(`${API_URL}/ai/support-map?period=month`, { signal: controller.signal })
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
                    apiFetch(`${API_URL}/device/latest`, { signal: controller.signal })
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
    }, [user, apiFetch]);

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
    const totalWords = gamificationLoading ? null : (gamificationStats?.totalWords ?? null);
    const writerDNA = useMemo(() => deriveWriterDNA({
        entries: entries.map((e) => ({ mood: e.mood, createdAt: e.createdAt, contentLength: e.content?.length ?? 0 })),
        themeClusters: themeClusters.map((t) => ({ label: t.label, dominantMood: t.dominantMood, entryCount: t.entryCount })),
        totalWords: totalWords ?? 0,
        currentStreak: streak ?? 0,
    }), [entries, themeClusters, totalWords, streak]);

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
        return (
            <div className="min-h-screen pb-32 md:pb-20">
                <main className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6 md:py-10 lg:ml-0 lg:mr-auto">
                    <DashboardNoticeCard
                        eyebrow="Loading"
                        title="Pulling your notes together."
                        body="Notive is syncing your latest writing so the dashboard starts from real signals, not placeholders."
                    />
                </main>
            </div>
        );
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
    const primaryGoalLabel = safeUser.profile?.primaryGoal === 'clarity'
        ? 'Clear mind'
        : safeUser.profile?.primaryGoal === 'memory'
            ? 'Remember life'
            : safeUser.profile?.primaryGoal === 'growth'
                ? 'Grow'
                : safeUser.profile?.primaryGoal === 'productivity'
                    ? 'Get things done'
                    : onboarding?.goal === 'clarity'
                        ? 'Clear mind'
                        : onboarding?.goal === 'memory'
                            ? 'Remember life'
                            : onboarding?.goal === 'growth'
                                ? 'Grow'
                                : onboarding?.goal === 'productivity'
                                    ? 'Get things done'
                                    : null;
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
    } else if (todayBrief) {
        focusCard = buildActionFocus({
            brief: todayBrief,
            homeAction,
            recommendedHref,
            timelineHref,
            guideHref,
            onPrimary: handleStartOneThing,
        });
    } else if (gentleReflection && gentleJournalHref) {
        focusCard = buildGentleReflectionFocus({
            reflection: gentleReflection,
            journalHref: gentleJournalHref,
            onAccept: handleAcceptGentleReflection,
            onDismiss: handleDismissGentleReflection,
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
    const showMoodHistory = hasMeaningfulMoodHistory(entries);
    const hasHeroInsight = !!heroInsight;
    const hasDeviceSignals = hasAnyDeviceSignals(deviceSignals);
    const hasResilienceSignals = !!(dashboardInsights?.resilience || dashboardInsights?.reflectionDepth);
    const hasPatternDiscovery = !!dashboardInsights && (
        dashboardInsights.correlations.length > 0
        || dashboardInsights.contradictions.length > 0
        || dashboardInsights.triggerMap.length > 0
    );

    if (process.env.NEXT_PUBLIC_DASHBOARD_REFINED !== '0') {
        return (
            <DashboardNotebookView
                firstName={firstName}
                todayLabel={todayLabel}
                locationLabel={profileLocation}
                userBirthDate={safeUser.profile?.birthDate ? String(safeUser.profile.birthDate) : null}
                profileTags={profileTags}
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
                hasSafetyFocus={!!(todayAction && (todayAction.risk.level === 'orange' || todayAction.risk.level === 'red'))}
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
                supportMap={supportMap}
                heroInsight={heroInsight}
                heroInsightLoading={heroInsightLoading}
                insightTier={insightTier}
            />
        );
    }

    const handleWellnessSubmit = (data: WellnessData) => {
        setWellnessSubmitted(true);
        void apiFetch(`${API_URL}/device/wellness-checkin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        }).catch(() => {});
        void trackEvent({ eventType: 'wellness_checkin_submitted', metadata: data as unknown as Record<string, string> });
    };

    return (
        <div className="min-h-screen pb-32 md:pb-20">
            <main className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6 md:py-10 space-y-4 lg:ml-0 lg:mr-auto">

                {/* ── Tier 0: Empty state ──────────────────────────── */}
                {insightTier === 0 && (
                    <>
                        <section className="notebook-shell rounded-[2.25rem] px-5 py-5 md:px-7 md:py-6">
                            <h1 className="notebook-title text-[23px] font-bold leading-tight">
                                Start here, {firstName}.
                            </h1>
                            <p className="notebook-muted mt-2 text-sm font-serif">
                                {todayLabel}
                            </p>
                        </section>
                        <EmptyDashboard writeHref={newEntryHref} />
                    </>
                )}

                {/* ── Identity Card (tier 1+) ──────────────────────── */}
                <Gate minTier={1} currentTier={insightTier}>
                    <section className="notebook-shell rounded-[2.25rem] px-5 py-5 md:px-7 md:py-6">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <h1 className="notebook-title text-[23px] font-bold leading-tight">
                                    {latestEntry ? `Hey ${firstName}.` : `Start here, ${firstName}.`}
                                </h1>
                                <p className="notebook-muted mt-2 text-sm font-serif">
                                    {todayLabel}
                                </p>
                                <Gate minTier={2} currentTier={insightTier}>
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                        {writerDNA.traits.map((trait) => (
                                            <span
                                                key={trait.label}
                                                className="notebook-chip rounded-full px-2.5 py-1 text-xs font-medium"
                                                title={trait.description}
                                            >
                                                {formatTraitLabel(trait.label)}
                                            </span>
                                        ))}
                                    </div>
                                    <p className="notebook-copy mt-3 text-sm italic font-serif">
                                        &ldquo;{writerDNA.archetype.oneLiner}&rdquo;
                                    </p>
                                </Gate>
                            </div>
                            <Gate minTier={2} currentTier={insightTier}>
                                <NotebookDoodle
                                    name={writerDNA.archetype.doodle}
                                    accent={writerDNA.archetype.accent}
                                    className="hidden shrink-0 sm:block"
                                />
                            </Gate>
                        </div>
                    </section>
                </Gate>

                {/* ── Hero Insight Card (tier 3+, LLM-powered) ───── */}
                <Gate minTier={3} currentTier={insightTier}>
                    <HeroInsightCard
                        insight={heroInsight}
                        loading={heroInsightLoading}
                        onFeedback={(reaction) => {
                            if (!heroInsight?.id) return;
                            void apiFetch(`${API_URL}/ai/insight-feedback`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ insightId: heroInsight.id, reaction }),
                            }).catch(() => {});
                        }}
                    />
                </Gate>
                {insightTier >= 3 && !heroInsightLoading && !hasHeroInsight && (
                    <DashboardNoticeCard
                        compact
                        eyebrow="Still learning"
                        title="Daily insight is warming up."
                        body="Once Notive can compare a few connected note patterns, this space starts showing its magic."
                    />
                )}

                {/* ── Device Context Strip (any tier, if signals exist) ── */}
                <Gate minTier={1} currentTier={insightTier}>
                    {hasDeviceSignals ? (
                        <DeviceContextStrip signals={deviceSignals!} />
                    ) : deviceSignalsLoaded ? (
                        <DashboardNoticeCard
                            compact
                            eyebrow="Context"
                            title="This strip wakes up after a quick check-in."
                            body="Add one wellness check-in or connect a device source to see today around your writing."
                        />
                    ) : null}
                </Gate>

                {/* ── Quick Pulse Strip (tier 3+) ──────────────────── */}
                <Gate minTier={3} currentTier={insightTier}>
                    <QuickPulseStrip
                        entries={entries}
                        streak={streak}
                        totalWords={totalWords}
                    />
                </Gate>

                {/* ── Mood sparkline (tier 2+) ─────────────────────── */}
                <Gate minTier={2} currentTier={insightTier}>
                    {showMoodHistory && (
                        <MoodSparkline entries={entries} />
                    )}
                </Gate>

                {/* ── Focus card (tier 1+) ─────────────────────────── */}
                <Gate minTier={1} currentTier={insightTier}>
                    <DashboardFocusCard
                        eyebrow={focusCard.eyebrow}
                        title={focusCard.title}
                        body={focusCard.body}
                        evidence={focusCard.evidence}
                        evidenceFallback={focusCard.evidenceFallback}
                        panels={focusCard.panels}
                        primaryAction={focusCard.primaryAction}
                        secondaryAction={focusCard.secondaryAction}
                        accent={focusCard.accent}
                        doodle={focusCard.doodle}
                    />
                </Gate>

                {/* ── Prime Time + Writing Rhythm (tier 4+) ────────── */}
                <Gate minTier={4} currentTier={insightTier}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <PrimeTimePrediction entries={entries} />
                        <WritingRhythmCalendar entries={entries} />
                    </div>
                </Gate>

                {/* ── Writing Rhythm fallback for tier 3 ───────────── */}
                {insightTier === 3 && (
                    <WritingRhythmCalendar entries={entries} />
                )}

                {/* ── Emotional Fingerprint (tier 3+) ──────────────── */}
                <Gate minTier={3} currentTier={insightTier}>
                    {dashboardInsights?.emotionalFingerprint ? (
                        <EmotionalFingerprint
                            axes={dashboardInsights.emotionalFingerprint.axes}
                            summary={dashboardInsights.emotionalFingerprint.summary}
                        />
                    ) : dashboardInsightsLoaded ? (
                        <DashboardNoticeCard
                            compact
                            eyebrow="Emotion map"
                            title="This chart appears after a few more analyzed notes."
                            body="Keep naming feelings in your notes and Notive will start sketching the emotional fingerprint here."
                        />
                    ) : null}
                </Gate>

                {/* ── Journal Intelligence — compact pills, expand on tap ── */}
                {journalIntel && (
                    <Gate minTier={3} currentTier={insightTier}>
                        <JournalIntelligenceSection intel={journalIntel} />
                    </Gate>
                )}

                {/* ── Wellness Check-in (tier 2+) ─────────────────── */}
                <Gate minTier={2} currentTier={insightTier}>
                    <WellnessCheckin
                        onSubmit={handleWellnessSubmit}
                        submitted={wellnessSubmitted}
                    />
                </Gate>

                {/* ── Resilience + Depth (tier 4+, side by side) ───── */}
                <Gate minTier={4} currentTier={insightTier}>
                    {hasResilienceSignals ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {dashboardInsights?.resilience && (
                                <ResilienceCard
                                    currentRecovery={dashboardInsights.resilience.currentRecovery}
                                    previousRecovery={dashboardInsights.resilience.previousRecovery}
                                    trend={dashboardInsights.resilience.trend}
                                    narrative={dashboardInsights.resilience.narrative}
                                    dipCount={dashboardInsights.resilience.dipCount}
                                />
                            )}
                            {dashboardInsights?.reflectionDepth && (
                                <ReflectionDepthMeter
                                    level={dashboardInsights.reflectionDepth.level}
                                    levelLabel={dashboardInsights.reflectionDepth.levelLabel}
                                    score={dashboardInsights.reflectionDepth.score}
                                    progressToNext={dashboardInsights.reflectionDepth.progressToNext}
                                />
                            )}
                        </div>
                    ) : dashboardInsightsLoaded ? (
                        <DashboardNoticeCard
                            compact
                            eyebrow="Comparisons"
                            title="Resilience and depth show up after a longer stretch of notes."
                            body="A few more weeks of writing gives Notive enough contrast to show recovery and reflection shifts cleanly."
                        />
                    ) : null}
                </Gate>

                {/* ── Pattern Discovery Feed (tier 5+) ─────────────── */}
                <Gate minTier={5} currentTier={insightTier}>
                    {hasPatternDiscovery ? (
                        <PatternDiscoveryFeed
                            correlations={dashboardInsights?.correlations ?? []}
                            contradictions={dashboardInsights?.contradictions ?? []}
                            triggerMap={dashboardInsights?.triggerMap ?? []}
                        />
                    ) : dashboardInsightsLoaded ? (
                        <DashboardNoticeCard
                            compact
                            eyebrow="Pattern feed"
                            title="This feed needs repeated patterns before it speaks up."
                            body="Once themes, mood shifts, or recurring people keep showing up, Notive will start calling them out here."
                        />
                    ) : null}
                </Gate>

                {/* ── What's Coming (tier 1, low entry count) ──────── */}
                {insightTier <= 2 && entries.length > 0 && (
                    <WhatsComingCard entryCount={entries.length} />
                )}

                {/* ── Recent entries (tier 1+) ─────────────────────── */}
                <Gate minTier={1} currentTier={insightTier}>
                    <section className="notebook-card rounded-[1.75rem] p-5">
                        <p className="section-label mb-3">Recent</p>
                        {entries.length === 0 ? (
                            <div className="text-center py-5">
                                <NotebookDoodle name="sprout" accent="sage" className="mx-auto mb-2" />
                                <p className="notebook-copy text-sm">Your first note starts here.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {entries.slice(0, 3).map((entry) => (
                                    <Link
                                        key={entry.id}
                                        href={openDashboardEntryHref(entry.id)}
                                        className="notebook-card-soft flex items-start gap-2 rounded-xl p-3 transition-opacity hover:opacity-80"
                                    >
                                        <span className="text-sm mt-0.5 shrink-0" aria-hidden="true">
                                            {MOOD_EMOJI[entry.mood ?? ''] ?? '✦'}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate" style={{ color: 'rgb(var(--paper-ink, var(--text-strong)))' }}>
                                                {entry.title || 'Untitled'}
                                            </p>
                                            <p className="notebook-muted mt-0.5 line-clamp-1 text-[0.83rem]">
                                                {compactText(entry.content, 72)}
                                            </p>
                                        </div>
                                    </Link>
                                ))}
                                {entries.length > 3 && (
                                    <Link href={timelineHref} className="notebook-muted block text-xs text-center pt-1 hover:opacity-70">
                                        See all {entries.length} notes →
                                    </Link>
                                )}
                            </div>
                        )}
                    </section>
                </Gate>

                {/* ── Flip Back — resurfaced moment ──────────────────── */}
                {resurfacedMoments.length > 0 && (() => {
                    const moment = resurfacedMoments[0];
                    const entryDate = new Date(moment.matchedEntry.createdAt);
                    const monthsAgo = Math.max(1, Math.round((Date.now() - entryDate.getTime()) / (1000 * 60 * 60 * 24 * 30)));
                    const timeLabel = monthsAgo === 1 ? '1 month ago' : `${monthsAgo} months ago`;
                    return (
                        <section key={moment.matchedEntry.id} className="notebook-card-soft rounded-[1.75rem] p-5">
                            <p className="notebook-kicker mb-2">
                                <span style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)' }}>
                                    {timeLabel}…
                                </span>
                            </p>
                            <Link
                                href={openDashboardEntryHref(moment.matchedEntry.id)}
                                className="block hover:opacity-80 transition-opacity"
                            >
                                <p className="text-sm font-medium" style={{ color: 'rgb(var(--paper-ink, var(--text-strong)))' }}>
                                    {moment.matchedEntry.title || 'Untitled'}
                                </p>
                                <p
                                    className="notebook-copy mt-1 line-clamp-2 text-[0.9rem]"
                                    style={{ color: 'rgb(var(--paper-ink-soft, var(--text-secondary)))' }}
                                >
                                    {compactText(moment.matchedEntry.contentPreview, 140)}
                                </p>
                            </Link>
                            <Link
                                href={appendReturnTo(`/entry/new?source=flip_back&ref=${moment.matchedEntry.id}`, dashboardReturnTo)}
                                className="notebook-secondary-cta mt-3 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs"
                            >
                                Write back to yourself →
                            </Link>
                        </section>
                    );
                })()}

                {/* ── Bridge card (if elevated risk) ─────────────────── */}
                {todayBridge && (
                    <BridgeCard
                        bridge={todayBridge}
                        surface="dashboard"
                        openEntryHref={openDashboardEntryHref}
                        onCopyDraft={() => handleDashboardBridgeCopy(todayBridge.recommendedRecipient)}
                        variant="notebook"
                    />
                )}

                {/* ── Then → Now (90+ day users) ─────────────────────── */}
                {showThenNow && (
                    <section className="notebook-card rounded-[1.75rem] p-5">
                        <p className="section-label mb-3" style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)' }}>
                            Then → Now
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="notebook-card-soft rounded-xl p-3">
                                <p className="notebook-muted text-xs mb-1">
                                    {new Date(oldestEntry!.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                                </p>
                                <p className="text-sm" style={{ color: 'rgb(var(--paper-ink, var(--text-strong)))' }}>
                                    {themeClusters[themeClusters.length - 1]?.label ?? 'Finding your way'}
                                </p>
                            </div>
                            <div className="notebook-card-soft rounded-xl p-3">
                                <p className="notebook-muted text-xs mb-1">Now</p>
                                <p className="text-sm" style={{ color: 'rgb(var(--paper-ink, var(--text-strong)))' }}>
                                    {themeClusters[0]?.label ?? 'Clearer ground'}
                                </p>
                            </div>
                        </div>
                        <p className="notebook-muted text-xs mt-3">
                            {daysSinceFirst} days journaling · {themeClusters.length} recurring themes
                        </p>
                    </section>
                )}

                {/* ── Bottom nav links ────────────────────────────────── */}
                <div className="flex items-center justify-center gap-5 pt-2 pb-1">
                    <Link href={guideHref} className="notebook-muted text-sm hover:opacity-80 transition-opacity">
                        Guide
                    </Link>
                    <span className="notebook-muted text-xs opacity-40">·</span>
                    <Link href={timelineHref} className="notebook-muted text-sm hover:opacity-80 transition-opacity">
                        Memories
                    </Link>
                    <span className="notebook-muted text-xs opacity-40">·</span>
                    <Link href={portfolioHref} className="notebook-muted text-sm hover:opacity-80 transition-opacity">
                        Stories
                    </Link>
                </div>

            </main>

            {/* ── Floating capture pill ───────────────────────────────── */}
            <FloatingCapture writeHref={newEntryHref} voiceHref={voiceEntryHref} />
        </div>
    );
}
