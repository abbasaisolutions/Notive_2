// Centralized mood configuration
//
// The CHECKIN_MOODS set below is the UI source of truth: a research-backed
// Core-10 covering all four quadrants of Russell's valence × arousal circumplex
// plus Ekman/Plutchik basic-emotion coverage. Backend canonical vocabulary
// (20 moods in backend/src/utils/mood.ts) stays intact so historical entries
// and deeper nuance keep scoring correctly.

export const MOOD_COLORS: Record<string, string> = {
    happy: '#94a3b8',
    excited: '#a3b18a',
    calm: '#a8b1be',
    grateful: '#b8c0cd',
    hopeful: '#c9b8a8',
    thoughtful: '#9aa5b5',
    tired: '#4b5563',
    sad: '#64748b',
    anxious: '#78716c',
    frustrated: '#6b7280',
    neutral: '#6b7280',
    motivated: '#8b96a8',
};

export const MOOD_EMOJIS: Record<string, string> = {
    happy: '😊',
    excited: '🤩',
    calm: '😌',
    grateful: '🙏',
    hopeful: '✨',
    thoughtful: '🤔',
    tired: '😴',
    sad: '😔',
    anxious: '😰',
    frustrated: '😤',
    neutral: '😐',
    motivated: '💪',
};

export const MOOD_SCORES: Record<string, number> = {
    happy: 9,
    excited: 9,
    calm: 7,
    grateful: 9,
    hopeful: 8,
    thoughtful: 6,
    tired: 4,
    sad: 2,
    anxious: 3,
    frustrated: 2,
    neutral: 5,
    motivated: 8,
};

// Aliases normalize user/LLM input to a canonical key. We DO NOT collapse
// distinct emotions (lonely/hopeful/nervous are first-class in the backend).
const MOOD_ALIAS_MAP: Record<string, string> = {
    mad: 'frustrated',
    furious: 'frustrated',
    irritated: 'frustrated',
    annoyed: 'frustrated',
    upset: 'frustrated',
    angry: 'frustrated',
    joy: 'happy',
    joyful: 'happy',
    happiness: 'happy',
    sadness: 'sad',
    stress: 'anxious',
    stressed: 'anxious',
    worried: 'anxious',
    exhausted: 'tired',
    fatigued: 'tired',
    burnout: 'tired',
    reflective: 'thoughtful',
    optimistic: 'hopeful',
    thrilled: 'excited',
    energized: 'excited',
};

export function normalizeMood(mood: string | null | undefined): string | null {
    if (!mood) return null;
    const key = mood.trim().toLowerCase();
    if (!key) return null;
    return MOOD_ALIAS_MAP[key] || key;
}

// Helper functions
export function getMoodScore(mood: string | null): number {
    const normalized = normalizeMood(mood);
    if (!normalized) return 5;
    return MOOD_SCORES[normalized] || 5;
}

export function getMoodColor(mood: string | null): string {
    const normalized = normalizeMood(mood);
    if (!normalized) return MOOD_COLORS.neutral;
    return MOOD_COLORS[normalized] || MOOD_COLORS.neutral;
}

export function getMoodEmoji(mood: string | null): string {
    const normalized = normalizeMood(mood);
    if (!normalized) return MOOD_EMOJIS.neutral;
    return MOOD_EMOJIS[normalized] || MOOD_EMOJIS.neutral;
}

// Ordered Core-10 for every check-in surface (DailyCheckIn, entry editor,
// EntryInsightsPanel). Ordered by real-world frequency: most common students
// pick first, less common ones sit at the far right of the scroll row. This
// lets a horizontal scroller load the most likely choices into the initial
// viewport and only reveal the long tail on swipe-left.
export const CHECKIN_MOODS = [
    'happy',
    'calm',
    'tired',
    'anxious',
    'sad',
    'grateful',
    'frustrated',
    'thoughtful',
    'excited',
    'hopeful',
] as const;

export type CheckinMood = typeof CHECKIN_MOODS[number];

export const MOOD_OPTIONS = CHECKIN_MOODS.map((mood) => ({
    value: mood,
    label: mood.charAt(0).toUpperCase() + mood.slice(1),
    emoji: MOOD_EMOJIS[mood],
    color: MOOD_COLORS[mood],
}));
