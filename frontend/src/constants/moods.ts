// Centralized mood configuration
export const MOOD_COLORS: Record<string, string> = {
    happy: '#94a3b8',
    sad: '#64748b',
    anxious: '#78716c',
    calm: '#a8b1be',
    frustrated: '#6b7280',
    grateful: '#b8c0cd',
    motivated: '#8b96a8',
    tired: '#4b5563',
    thoughtful: '#9aa5b5',
    neutral: '#6b7280',
};

export const MOOD_EMOJIS: Record<string, string> = {
    happy: '😊',
    sad: '😔',
    anxious: '😰',
    calm: '😌',
    frustrated: '😤',
    grateful: '🙏',
    motivated: '💪',
    tired: '😴',
    thoughtful: '🤔',
    neutral: '😐',
};

export const MOOD_SCORES: Record<string, number> = {
    happy: 9,
    sad: 2,
    anxious: 3,
    calm: 7,
    frustrated: 2,
    grateful: 9,
    motivated: 8,
    tired: 4,
    thoughtful: 6,
    neutral: 5,
};

const MOOD_ALIAS_MAP: Record<string, string> = {
    angry: 'frustrated',
    mad: 'frustrated',
    furious: 'frustrated',
    irritated: 'frustrated',
    annoyed: 'frustrated',
    upset: 'frustrated',
    hopeful: 'motivated',
    optimistic: 'motivated',
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

// Mood configuration for dropdowns
export const MOOD_OPTIONS = [
    'happy',
    'sad',
    'anxious',
    'calm',
    'frustrated',
    'grateful',
    'motivated',
    'tired',
    'thoughtful',
].map(mood => ({
    value: mood,
    label: mood.charAt(0).toUpperCase() + mood.slice(1),
    emoji: MOOD_EMOJIS[mood],
    color: MOOD_COLORS[mood],
}));
