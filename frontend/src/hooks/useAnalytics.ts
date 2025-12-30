import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { getMoodScore } from '@/constants/moods';
import { API_URL, MS_PER_DAY } from '@/constants/config';

export interface AnalyticsData {
    // Mood analytics
    moodTrend: Array<{ date: string; mood: string; score: number }>;
    emotionBreakdown: Array<{ emotion: string; count: number; percentage: number; color: string }>;
    topMood: string;

    // Theme analytics
    topThemes: Array<{ theme: string; count: number }>;

    // Stats
    totalEntries: number;
    currentStreak: number;
    longestStreak: number;
    avgWordCount: number;
    totalWords: number;
    entriesThisWeek: number;

    // Gratitude
    gratitudeItems: string[];

    // Activity
    activityHeatmap: Record<string, number>;
}

interface Entry {
    id: string;
    content: string;
    mood: string | null;
    tags: string[];
    createdAt: string;
}

/**
 * Shared analytics hook - single source of truth for all analytics calculations
 * Prevents redundant API calls and expensive recalculations across pages
 */
export function useAnalytics(period: 'week' | 'month' | 'year' = 'week') {
    const { accessToken } = useAuth();
    const [entries, setEntries] = useState<Entry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch entries from API
    useEffect(() => {
        const fetchEntries = async () => {
            if (!accessToken) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(`${API_URL}/entries`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });

                if (response.ok) {
                    const data = await response.json();
                    setEntries(data.entries || []);
                } else {
                    setError('Failed to fetch entries');
                }
            } catch (err) {
                setError('Network error');
                console.error('Analytics fetch error:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchEntries();
    }, [accessToken]);

    // Filter entries by period
    const filteredEntries = useMemo(() => {
        const now = new Date();
        const periodDays = period === 'week' ? 7 : period === 'month' ? 30 : 365;
        const cutoff = new Date(now.getTime() - periodDays * MS_PER_DAY);

        return entries.filter(e => new Date(e.createdAt) >= cutoff);
    }, [entries, period]);

    // OPTIMIZED: Single-pass analytics calculation (O(n) instead of O(5n))
    const analytics = useMemo<AnalyticsData>(() => {
        if (filteredEntries.length === 0) {
            return {
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
            };
        }

        // Single loop through all entries - collect everything at once
        const accumulated = filteredEntries.reduce((acc, entry) => {
            const date = new Date(entry.createdAt);
            const dateStr = date.toDateString();

            // Count moods
            if (entry.mood) {
                acc.moodCounts[entry.mood] = (acc.moodCounts[entry.mood] || 0) + 1;
                acc.moodTrend.push({
                    date: date.toLocaleDateString(),
                    mood: entry.mood,
                    score: getMoodScore(entry.mood),
                });
            }

            // Count tags
            entry.tags?.forEach(tag => {
                acc.tagCounts[tag] = (acc.tagCounts[tag] || 0) + 1;
            });

            // Track unique dates for streak calculation
            if (!acc.uniqueDates.has(dateStr)) {
                acc.uniqueDates.add(dateStr);
                acc.sortedDates.push(date);
            }

            // Extract gratitude patterns
            const gratitudeMatches = entry.content?.match(/(?:grateful for|thankful for|blessed to have) ([^.!?]+)/gi);
            if (gratitudeMatches) {
                acc.gratitude.push(...gratitudeMatches.map(m =>
                    m.replace(/grateful for|thankful for|blessed to have/i, '').trim()
                ));
            }

            // Word count
            const wordCount = entry.content?.split(/\s+/).length || 0;
            acc.totalWords += wordCount;

            // Activity heatmap
            const activityDate = date.toISOString().split('T')[0];
            acc.activityHeatmap[activityDate] = (acc.activityHeatmap[activityDate] || 0) + 1;

            // This week count
            const weekAgo = new Date(Date.now() - 7 * MS_PER_DAY);
            if (date >= weekAgo) {
                acc.entriesThisWeek++;
            }

            return acc;
        }, {
            moodCounts: {} as Record<string, number>,
            tagCounts: {} as Record<string, number>,
            moodTrend: [] as Array<{ date: string; mood: string; score: number }>,
            uniqueDates: new Set<string>(),
            sortedDates: [] as Date[],
            gratitude: [] as string[],
            totalWords: 0,
            activityHeatmap: {} as Record<string, number>,
            entriesThisWeek: 0,
        });

        // Process accumulated data
        const totalMoods = Object.values(accumulated.moodCounts).reduce((a, b) => a + b, 0) || 1;
        const emotionBreakdown = Object.entries(accumulated.moodCounts)
            .map(([emotion, count]) => ({
                emotion,
                count,
                percentage: Math.round((count / totalMoods) * 100),
                color: getMoodScore(emotion).toString(), // Color from centralized config
            }))
            .sort((a, b) => b.percentage - a.percentage);

        const topThemes = Object.entries(accumulated.tagCounts)
            .map(([theme, count]) => ({ theme, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // Calculate current streak
        const sortedDates = Array.from(accumulated.sortedDates)
            .sort((a, b) => b.getTime() - a.getTime())
            .map(d => d.toDateString());

        let currentStreak = 0;
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - MS_PER_DAY).toDateString();

        if (sortedDates[0] === today || sortedDates[0] === yesterday) {
            currentStreak = 1;
            for (let i = 1; i < sortedDates.length; i++) {
                const prev = new Date(sortedDates[i - 1]);
                const curr = new Date(sortedDates[i]);
                if (prev.getTime() - curr.getTime() === MS_PER_DAY) {
                    currentStreak++;
                } else {
                    break;
                }
            }
        }

        // Calculate longest streak (simplified for performance)
        let longestStreak = currentStreak;
        // TODO: Implement full longest streak calculation if needed

        return {
            moodTrend: accumulated.moodTrend.slice(-14), // Last 14 days
            emotionBreakdown,
            topMood: emotionBreakdown[0]?.emotion || 'neutral',
            topThemes,
            totalEntries: filteredEntries.length,
            currentStreak,
            longestStreak,
            avgWordCount: Math.round(accumulated.totalWords / filteredEntries.length),
            totalWords: accumulated.totalWords,
            entriesThisWeek: accumulated.entriesThisWeek,
            gratitudeItems: accumulated.gratitude.slice(0, 5),
            activityHeatmap: accumulated.activityHeatmap,
        };
    }, [filteredEntries]);

    // Expose refresh function
    const refresh = useCallback(async () => {
        if (!accessToken) return;

        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/entries`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (response.ok) {
                const data = await response.json();
                setEntries(data.entries || []);
            }
        } catch (err) {
            console.error('Refresh error:', err);
        } finally {
            setIsLoading(false);
        }
    }, [accessToken]);

    return {
        analytics,
        entries: filteredEntries,
        isLoading,
        error,
        refresh,
    };
}
