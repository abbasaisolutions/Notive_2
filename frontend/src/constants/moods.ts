// Centralized mood configuration.
//
// CHECKIN_MOODS stays the UI source of truth for quick-entry surfaces, but the
// helpers below intentionally cover the broader stored mood vocabulary so
// dashboard charts and historical entries stay aligned with backend scoring.

export const MOOD_COLORS: Record<string, string> = {
    happy: '#94a3b8',
    sad: '#64748b',
    anxious: '#78716c',
    excited: '#a3b18a',
    calm: '#a8b1be',
    frustrated: '#6b7280',
    grateful: '#b8c0cd',
    motivated: '#8b96a8',
    tired: '#4b5563',
    thoughtful: '#9aa5b5',
    neutral: '#6b7280',
    hopeful: '#c9b8a8',
    proud: '#b7a48b',
    lonely: '#6c7b91',
    overwhelmed: '#7c6f6f',
    peaceful: '#b7c7c0',
    nervous: '#8b7b74',
    confident: '#8aa39b',
    confused: '#7d8796',
    angry: '#6f6363',
};

export const MOOD_EMOJIS: Record<string, string> = {
    happy: '😊',
    sad: '😔',
    anxious: '😰',
    excited: '🤩',
    calm: '😌',
    frustrated: '😤',
    grateful: '🙏',
    motivated: '💪',
    tired: '😴',
    thoughtful: '🤔',
    neutral: '😐',
    hopeful: '✨',
    proud: '🏆',
    lonely: '🥺',
    overwhelmed: '😵',
    peaceful: '🕊️',
    nervous: '😬',
    confident: '😎',
    confused: '😕',
    angry: '😠',
};

export const MOOD_SCORES: Record<string, number> = {
    happy: 9,
    sad: 2,
    anxious: 3,
    excited: 9,
    calm: 7,
    frustrated: 2,
    grateful: 9,
    motivated: 8,
    tired: 4,
    thoughtful: 6,
    neutral: 5,
    hopeful: 8,
    proud: 8,
    lonely: 2,
    overwhelmed: 3,
    peaceful: 8,
    nervous: 3,
    confident: 8,
    confused: 4,
    angry: 2,
};

// Keep frontend normalization aligned with backend/src/utils/mood.ts so charts,
// filters, and entry rendering do not disagree on stored moods.
const MOOD_ALIAS_MAP: Record<string, string> = {
    angry: 'frustrated',
    mad: 'frustrated',
    furious: 'frustrated',
    irritated: 'frustrated',
    annoyed: 'frustrated',
    upset: 'frustrated',
    joy: 'happy',
    joyful: 'happy',
    happiness: 'happy',
    sadness: 'sad',
    lonely: 'sad',
    loneliness: 'sad',
    stress: 'anxious',
    stressed: 'anxious',
    worried: 'anxious',
    nervous: 'anxious',
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
    if (!normalized) return MOOD_SCORES.neutral;
    return MOOD_SCORES[normalized] || MOOD_SCORES.neutral;
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
