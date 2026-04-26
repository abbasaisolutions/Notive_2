import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import useApi from '@/hooks/use-api';
import { API_URL } from '@/constants/config';

export interface AnalyticsData {
    moodTrend: Array<{ date: string; mood: string; score: number }>;
    emotionBreakdown: Array<{ emotion: string; count: number; percentage: number; color: string }>;
    topMood: string;
    topThemes: Array<{ theme: string; count: number }>;
    totalEntries: number;
    currentStreak: number;
    longestStreak: number;
    avgWordCount: number;
    totalWords: number;
    entriesThisWeek: number;
    gratitudeItems: string[];
    activityHeatmap: Record<string, number>;
    activeDays: number;
    profileContext: {
        completionScore: number;
        stage: 'not_started' | 'in_progress' | 'completed';
        track: 'personal' | 'professional' | 'blended' | 'unknown';
        personalGrowthScore: number;
        professionalReadinessScore: number;
    } | null;
}

export interface PatternSignal {
    id: string;
    label: string;
    title: string;
    summary: string;
    value: string;
    hint: string;
    tone: 'good' | 'care' | 'steady';
    prompt: string;
}

export interface PatternDrilldownEntry {
    id: string;
    title: string | null;
    content: string;
    mood: string | null;
    themes: string[];
    createdAt: string;
    matchReason: string;
}

export interface PatternTimelineFilter {
    search?: string;
    theme?: string;
    mood?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    weekday?: string;
    dayPart?: string;
}

export interface PatternDrilldown {
    id: string;
    label: string;
    title: string;
    description: string;
    emptyMessage: string;
    entries: PatternDrilldownEntry[];
    timelineFilter?: PatternTimelineFilter;
}

export interface AnalyticsSignature {
    editorialRecap: {
        title: string;
        summary: string;
        highlights: string[];
        nextPrompt: string;
    };
    thenNow: {
        thenEntry: {
            id: string;
            title: string | null;
            content: string;
            createdAt: string;
        };
        nowEntry: {
            id: string;
            title: string | null;
            content: string;
            createdAt: string;
        };
        sharedThemes: string[];
        emergingThemes: string[];
        daysBetween: number;
        prompt: string;
    } | null;
    patternDigest: {
        primary: PatternSignal;
        supporting: PatternSignal[];
        rhythm: {
            activeDays: number;
            coveragePercent: number;
            bestDay: string | null;
            bestTime: string | null;
            bestDayCount: number;
        };
        focus: {
            theme: string | null;
            supportingTheme: string | null;
            noteCount: number;
            share: number;
        };
        emotion: {
            direction: 'up' | 'down' | 'steady';
            delta: number;
            averageScore: number | null;
            recentAverage: number | null;
        };
    };
    patternDrilldowns: {
        defaultId: string | null;
        items: PatternDrilldown[];
    };
    chartDrilldowns: {
        items: PatternDrilldown[];
    };
}

const EMPTY_ANALYTICS: AnalyticsData = {
    moodTrend: [],
    emotionBreakdown: [],
    topMood: 'neutral',
    topThemes: [],
    totalEntries: 0,
    currentStreak: 0,
    longestStreak: 0,
    avgWordCount: 0,
    totalWords: 0,
    entriesThisWeek: 0,
    gratitudeItems: [],
    activityHeatmap: {},
    activeDays: 0,
    profileContext: null,
};

const EMPTY_SIGNATURE: AnalyticsSignature = {
    editorialRecap: {
        title: 'A quiet period',
        summary: 'Add a few entries and the recap will begin to turn activity into narrative.',
        highlights: [],
        nextPrompt: 'What happened recently that is worth capturing before it fades?',
    },
    thenNow: null,
    patternDigest: {
        primary: {
            id: 'capture-more',
            label: 'Next step',
            title: 'Your next few notes will make the pattern clearer',
            summary: 'Keep saving short, honest notes and Notive will start showing stronger repeated topics and feelings.',
            value: '0 notes',
            hint: 'Notes in this view',
            tone: 'steady',
            prompt: 'What happened recently that you want to remember before it fades?',
        },
        supporting: [],
        rhythm: {
            activeDays: 0,
            coveragePercent: 0,
            bestDay: null,
            bestTime: null,
            bestDayCount: 0,
        },
        focus: {
            theme: null,
            supportingTheme: null,
            noteCount: 0,
            share: 0,
        },
        emotion: {
            direction: 'steady',
            delta: 0,
            averageScore: null,
            recentAverage: null,
        },
    },
    patternDrilldowns: {
        defaultId: null,
        items: [],
    },
    chartDrilldowns: {
        items: [],
    },
};

export function useAnalytics(period: 'week' | 'month' | 'year' = 'week') {
    const { accessToken } = useAuth();
    const { apiFetch } = useApi();
    const [analytics, setAnalytics] = useState<AnalyticsData>(EMPTY_ANALYTICS);
    const [signature, setSignature] = useState<AnalyticsSignature>(EMPTY_SIGNATURE);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSummary = useCallback(async () => {
        const response = await apiFetch(`/analytics/summary?period=${period}`);
        if (!response.ok) {
            throw new Error('Couldn\u2019t load your analytics.');
        }

        const data = await response.json();
        setAnalytics((data?.summary?.analytics || EMPTY_ANALYTICS) as AnalyticsData);
        setSignature((data?.summary?.signature || EMPTY_SIGNATURE) as AnalyticsSignature);
    }, [apiFetch, period]);

    useEffect(() => {
        const load = async () => {
            if (!accessToken) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                await fetchSummary();
            } catch (err) {
                console.error('Analytics fetch error:', err);
                setError('Network error');
            } finally {
                setIsLoading(false);
            }
        };

        void load();
    }, [accessToken, fetchSummary]);

    const refresh = useCallback(async () => {
        if (!accessToken) return;

        setIsLoading(true);
        try {
            await fetchSummary();
        } catch (err) {
            console.error('Analytics refresh error:', err);
        } finally {
            setIsLoading(false);
        }
    }, [accessToken, fetchSummary]);

    return {
        analytics,
        signature,
        isLoading,
        error,
        refresh,
    };
}
