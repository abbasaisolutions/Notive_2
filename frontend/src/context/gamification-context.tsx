'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './auth-context';
import useApi from '@/hooks/use-api';
import { API_URL } from '@/constants/config';
import {
    FiActivity,
    FiAward,
    FiBook,
    FiBookOpen,
    FiBookmark,
    FiEdit,
    FiEdit3,
    FiFeather,
    FiLayers,
    FiMoon,
    FiRefreshCw,
    FiSunrise,
    FiTrendingUp,
} from 'react-icons/fi';


// Badge definitions
export const BADGES = {
    first_entry: { id: 'first_entry', name: 'The First Spark', icon: FiFeather, description: 'Began the journey of documentation' },
    streak_3: { id: 'streak_3', name: 'Rhythm of Thought', icon: FiTrendingUp, description: 'Maintained a 3-day flow' },
    streak_7: { id: 'streak_7', name: 'Synchronized', icon: FiRefreshCw, description: 'A full week of self-alignment' },
    streak_30: { id: 'streak_30', name: 'Architect of Habit', icon: FiAward, description: 'A month of dedication to your legacy' },
    entries_10: { id: 'entries_10', name: 'Chronicle I', icon: FiBookmark, description: 'Authored 10 chapters of your story' },
    entries_50: { id: 'entries_50', name: 'Life Historian', icon: FiBook, description: 'Documented 50 significant moments' },
    entries_100: { id: 'entries_100', name: 'Master Reflector', icon: FiBookOpen, description: 'A century of captured insights' },
    words_1000: { id: 'words_1000', name: 'Eloquent Mind', icon: FiEdit3, description: 'Synthesized 1,000 words of truth' },
    words_10000: { id: 'words_10000', name: 'The Silver Tongue', icon: FiEdit, description: 'Wove 10,000 words of personal wisdom' },
    chapter_first: { id: 'chapter_first', name: 'Curator', icon: FiLayers, description: 'Began curating your life volumes' },
    mood_tracker: { id: 'mood_tracker', name: 'Emotional Intel', icon: FiActivity, description: 'Mapped your emotional landscape 10 times' },
    night_owl: { id: 'night_owl', name: 'Lunar Reflections', icon: FiMoon, description: 'Documented wisdom in the quiet of the night' },
    early_bird: { id: 'early_bird', name: 'Dawn Insight', icon: FiSunrise, description: 'Captured clarity at the first light' },
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
    const { apiFetch } = useApi();
    const [stats, setStats] = useState<UserStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [newBadge, setNewBadge] = useState<typeof BADGES[keyof typeof BADGES] | null>(null);
    const [showCelebration, setShowCelebration] = useState(false);
    const [celebrationType, setCelebrationType] = useState<'badge' | 'levelup' | 'streak' | null>(null);
    const buildBaseStats = (): UserStats => ({
        xp: 0,
        level: 1,
        badges: [],
        currentStreak: 0,
        totalEntries: 0,
        totalWords: 0,
    });

    // Load stats from localStorage (we'll store locally for simplicity)
    useEffect(() => {
        if (user) {
            try {
                const stored = localStorage.getItem(`notive_stats_${user.id}`);
                setStats(stored ? JSON.parse(stored) as UserStats : null);
            } catch (error) {
                console.warn('Failed to parse stored gamification stats:', error);
                setStats(null);
            }
        } else {
            setStats(null);
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
            setIsLoading(true);
            const response = await apiFetch(`${API_URL}/analytics/stats`);
            if (response.ok) {
                const data = await response.json();
                setStats(prev => {
                    const base = prev ?? buildBaseStats();
                    const newStats = { ...base };

                    // Check for new badges
                    if (data.totalEntries >= 1 && !base.badges.includes('first_entry')) {
                        newStats.badges = [...base.badges, 'first_entry'];
                        setNewBadge(BADGES.first_entry);
                        setCelebrationType('badge');
                        setShowCelebration(true);
                    }
                    if (data.currentStreak >= 3 && !newStats.badges.includes('streak_3')) {
                        newStats.badges = [...newStats.badges, 'streak_3'];
                        setNewBadge(BADGES.streak_3);
                        setCelebrationType('streak');
                        setShowCelebration(true);
                    }
                    if (data.currentStreak >= 7 && !newStats.badges.includes('streak_7')) {
                        newStats.badges = [...newStats.badges, 'streak_7'];
                        setNewBadge(BADGES.streak_7);
                        setCelebrationType('streak');
                        setShowCelebration(true);
                    }
                    if (data.totalEntries >= 10 && !newStats.badges.includes('entries_10')) {
                        newStats.badges = [...newStats.badges, 'entries_10'];
                        setNewBadge(BADGES.entries_10);
                        setCelebrationType('badge');
                        setShowCelebration(true);
                    }
                    if (data.totalWords >= 1000 && !newStats.badges.includes('words_1000')) {
                        newStats.badges = [...newStats.badges, 'words_1000'];
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
        } finally {
            setIsLoading(false);
        }
    }, [accessToken, apiFetch]);

    const awardXP = useCallback((amount: number, reason: string) => {
        setStats(prev => {
            const base = prev ?? buildBaseStats();
            const newXP = base.xp + amount;
            const newLevel = getLevelFromXP(newXP);

            if (newLevel > base.level) {
                setCelebrationType('levelup');
                setShowCelebration(true);
            }

            return { ...base, xp: newXP, level: newLevel };
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

