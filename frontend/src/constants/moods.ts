import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Brain, Flame, Frown, Heart, Meh, Moon, Smile, Sparkles, Wind, Zap } from 'lucide-react';

// Centralized mood configuration
export const MOOD_COLORS: Record<string, string> = {
    happy: '#22c55e',
    grateful: '#ec4899',
    motivated: '#8b5cf6',
    hopeful: '#fbbf24',
    calm: '#06b6d4',
    thoughtful: '#8b5cf6',
    neutral: '#6b7280',
    tired: '#64748b',
    anxious: '#f59e0b',
    frustrated: '#ef4444',
    sad: '#3b82f6',
    angry: '#ef4444',
};

export const MOOD_ICONS: Record<string, LucideIcon> = {
    happy: Smile,
    grateful: Heart,
    motivated: Zap,
    hopeful: Sparkles,
    calm: Wind,
    thoughtful: Brain,
    neutral: Meh,
    tired: Moon,
    anxious: AlertTriangle,
    frustrated: Flame,
    sad: Frown,
    angry: Flame,
};

export const MOOD_SCORES: Record<string, number> = {
    happy: 9,
    grateful: 9,
    motivated: 8,
    hopeful: 8,
    calm: 7,
    thoughtful: 6,
    neutral: 5,
    tired: 4,
    anxious: 3,
    sad: 2,
    angry: 2,
    frustrated: 2,
};

// Helper functions
export function getMoodScore(mood: string | null): number {
    if (!mood) return 5;
    return MOOD_SCORES[mood] || 5;
}

export function getMoodColor(mood: string | null): string {
    if (!mood) return MOOD_COLORS.neutral;
    return MOOD_COLORS[mood] || MOOD_COLORS.neutral;
}

export function getMoodIcon(mood: string | null): LucideIcon {
    if (!mood) return MOOD_ICONS.neutral;
    return MOOD_ICONS[mood] || MOOD_ICONS.neutral;
}

// Mood configuration for dropdowns
export const MOOD_OPTIONS = Object.keys(MOOD_ICONS).map(mood => ({
    value: mood,
    label: mood.charAt(0).toUpperCase() + mood.slice(1),
    icon: MOOD_ICONS[mood],
    color: MOOD_COLORS[mood],
}));
