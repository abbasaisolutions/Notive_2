'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
    Activity,
    Bookmark,
    Brain,
    Landmark,
    Leaf,
    Moon,
    Palette,
    PenLine,
    RefreshCw,
    Sparkles,
    Sunrise,
    Thermometer,
} from 'lucide-react';
import { useAuth } from './auth-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

// Badge definitions
export const BADGES = {
    first_entry: { id: 'first_entry', name: 'The First Spark', icon: Leaf, description: 'Began the journey of documentation' },
    streak_3: { id: 'streak_3', name: 'Rhythm of Thought', icon: Activity, description: 'Maintained a 3-day flow' },
    streak_7: { id: 'streak_7', name: 'Synchronized', icon: RefreshCw, description: 'A full week of self-alignment' },
    streak_30: { id: 'streak_30', name: 'Architect of Habit', icon: Landmark, description: 'A month of dedication to your legacy' },
    entries_10: { id: 'entries_10', name: 'Chronicle I', icon: Bookmark, description: 'Authored 10 chapters of your story' },
    entries_50: { id: 'entries_50', name: 'Life Historian', icon: Landmark, description: 'Documented 50 significant moments' },
    entries_100: { id: 'entries_100', name: 'Master Reflector', icon: Brain, description: 'A century of captured insights' },
    words_1000: { id: 'words_1000', name: 'Eloquent Mind', icon: Sparkles, description: 'Synthesized 1,000 words of truth' },
    words_10000: { id: 'words_10000', name: 'The Silver Tongue', icon: PenLine, description: 'Wove 10,000 words of personal wisdom' },
    chapter_first: { id: 'chapter_first', name: 'Curator', icon: Palette, description: 'Began curating your life volumes' },
    mood_tracker: { id: 'mood_tracker', name: 'Emotional Intel', icon: Thermometer, description: 'Mapped your emotional landscape 10 times' },
    night_owl: { id: 'night_owl', name: 'Lunar Reflections', icon: Moon, description: 'Documented wisdom in the quiet of the night' },
    early_bird: { id: 'early_bird', name: 'Dawn Insight', icon: Sunrise, description: 'Captured clarity at the first light' },
};

// XP values
const XP_VALUES = {
    entry_created: 50,
    streak_bonus: 25,
    mood_tracked: 10,
    chapter_created: 30,
    shared_entry: 20,
};

// Level thresholds
const getLevelFromXP = (xp: number) => {
    if (xp < 100) return 1;
    if (xp < 300) return 2;
    if (xp < 600) return 3;
    if (xp < 1000) return 4;
    if (xp < 1500) return 5;
    if (xp < 2500) return 6;
    if (xp < 4000) return 7;
    if (xp < 6000) return 8;
    if (xp < 10000) return 9;
    return 10;
};

const getXPForLevel = (level: number) => {
    const thresholds = [0, 100, 300, 600, 1000, 1500, 2500, 4000, 6000, 10000];
    return thresholds[Math.min(level - 1, 9)];
};

interface UserStats {
    xp: number;
    level: number;
    badges: string[];
    currentStreak: number;
    totalEntries: number;
    totalWords: number;
}

interface GamificationContextType {
    stats: UserStats | null;
    isLoading: boolean;
    newBadge: typeof BADGES[keyof typeof BADGES] | null;
    showCelebration: boolean;
    celebrationType: 'badge' | 'levelup' | 'streak' | null;
    dismissCelebration: () => void;
    refreshStats: () => Promise<void>;
    awardXP: (amount: number, reason: string) => void;
}

const GamificationContext = createContext<GamificationContextType | null>(null);

export function GamificationProvider({ children }: { children: React.ReactNode }) {
    const { accessToken, user } = useAuth();
    const [stats, setStats] = useState<UserStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [newBadge, setNewBadge] = useState<typeof BADGES[keyof typeof BADGES] | null>(null);
    const [showCelebration, setShowCelebration] = useState(false);
    const [celebrationType, setCelebrationType] = useState<'badge' | 'levelup' | 'streak' | null>(null);

    // Load stats from localStorage (we'll store locally for simplicity)
    useEffect(() => {
        if (user) {
            const stored = localStorage.getItem(`notive_stats_${user.id}`);
            if (stored) {
                setStats(JSON.parse(stored));
            } else {
                setStats({
                    xp: 0,
                    level: 1,
                    badges: [],
                    currentStreak: 0,
                    totalEntries: 0,
                    totalWords: 0,
                });
            }
        }
        setIsLoading(false);
    }, [user]);

    // Save stats to localStorage
    useEffect(() => {
        if (stats && user) {
            localStorage.setItem(`notive_stats_${user.id}`, JSON.stringify(stats));
        }
    }, [stats, user]);

    const refreshStats = useCallback(async () => {
        if (!accessToken) return;

        try {
            const response = await fetch(`${API_URL}/analytics/stats`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (response.ok) {
                const data = await response.json();
                setStats(prev => {
                    if (!prev) return prev;

                    const newStats = { ...prev };

                    // Check for new badges
                    if (data.totalEntries >= 1 && !prev.badges.includes('first_entry')) {
                        newStats.badges = [...prev.badges, 'first_entry'];
                        setNewBadge(BADGES.first_entry);
                        setCelebrationType('badge');
                        setShowCelebration(true);
                    }
                    if (data.currentStreak >= 3 && !prev.badges.includes('streak_3')) {
                        newStats.badges = [...prev.badges, 'streak_3'];
                        setNewBadge(BADGES.streak_3);
                        setCelebrationType('streak');
                        setShowCelebration(true);
                    }
                    if (data.currentStreak >= 7 && !prev.badges.includes('streak_7')) {
                        newStats.badges = [...prev.badges, 'streak_7'];
                        setNewBadge(BADGES.streak_7);
                        setCelebrationType('streak');
                        setShowCelebration(true);
                    }
                    if (data.totalEntries >= 10 && !prev.badges.includes('entries_10')) {
                        newStats.badges = [...prev.badges, 'entries_10'];
                        setNewBadge(BADGES.entries_10);
                        setCelebrationType('badge');
                        setShowCelebration(true);
                    }
                    if (data.totalWords >= 1000 && !prev.badges.includes('words_1000')) {
                        newStats.badges = [...prev.badges, 'words_1000'];
                        setNewBadge(BADGES.words_1000);
                        setCelebrationType('badge');
                        setShowCelebration(true);
                    }

                    newStats.currentStreak = data.currentStreak || 0;
                    newStats.totalEntries = data.totalEntries || 0;
                    newStats.totalWords = data.totalWords || 0;

                    return newStats;
                });
            }
        } catch (error) {
            console.error('Failed to refresh stats:', error);
        }
    }, [accessToken]);

    const awardXP = useCallback((amount: number, reason: string) => {
        setStats(prev => {
            if (!prev) return prev;

            const newXP = prev.xp + amount;
            const newLevel = getLevelFromXP(newXP);

            if (newLevel > prev.level) {
                setCelebrationType('levelup');
                setShowCelebration(true);
            }

            return { ...prev, xp: newXP, level: newLevel };
        });
    }, []);

    const dismissCelebration = useCallback(() => {
        setShowCelebration(false);
        setNewBadge(null);
        setCelebrationType(null);
    }, []);

    return (
        <GamificationContext.Provider
            value={{
                stats,
                isLoading,
                newBadge,
                showCelebration,
                celebrationType,
                dismissCelebration,
                refreshStats,
                awardXP,
            }}
        >
            {children}
        </GamificationContext.Provider>
    );
}

export function useGamification() {
    const context = useContext(GamificationContext);
    if (!context) {
        throw new Error('useGamification must be used within GamificationProvider');
    }
    return context;
}
