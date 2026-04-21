/**
 * Canonical mood scoring and normalization utilities.
 * Single source of truth — import from here instead of duplicating locally.
 */

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
    excited: 9,
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

// Aliases normalize synonyms onto the canonical Core-10 moods. The check-in
// set (happy, excited, calm, grateful, hopeful, thoughtful, tired, sad,
// anxious, frustrated) stays first-class — do NOT alias any of those away,
// or the dashboards will silently drop user selections.
export const MOOD_ALIAS_MAP: Record<string, string> = {
    angry: 'frustrated',
    mad: 'frustrated',
    furious: 'frustrated',
    irritated: 'frustrated',
    annoyed: 'frustrated',
    upset: 'frustrated',
    optimistic: 'hopeful',
    thrilled: 'excited',
    energized: 'excited',
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

export const normalizeMood = (mood: string | null | undefined): string | null => {
    if (!mood) return null;
    const key = mood.trim().toLowerCase();
    if (!key) return null;
    return MOOD_ALIAS_MAP[key] ?? key;
};

export const getMoodScore = (mood: string | null | undefined): number => {
    const normalized = normalizeMood(mood);
    if (!normalized) return MOOD_SCORES.neutral ?? 5;
    return MOOD_SCORES[normalized] ?? MOOD_SCORES.neutral ?? 5;
};
