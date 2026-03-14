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
    profileContext: {
        completionScore: number;
        stage: 'not_started' | 'in_progress' | 'completed';
        track: 'personal' | 'professional' | 'blended' | 'unknown';
        personalGrowthScore: number;
        professionalReadinessScore: number;
    } | null;
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
};

export function useAnalytics(period: 'week' | 'month' | 'year' = 'week') {
    const { accessToken } = useAuth();
    const { apiFetch } = useApi();
    const [analytics, setAnalytics] = useState<AnalyticsData>(EMPTY_ANALYTICS);
    const [signature, setSignature] = useState<AnalyticsSignature>(EMPTY_SIGNATURE);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSummary = useCallback(async () => {
        const response = await apiFetch(`${API_URL}/analytics/summary?period=${period}`);
        if (!response.ok) {
            throw new Error('Failed to fetch analytics summary');
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
