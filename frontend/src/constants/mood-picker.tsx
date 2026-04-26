// Single source of truth for mood→icon assignments used by entry editors and
// search filter pills. constants/moods.ts stays icon-free (pure data); this
// file is the only place that bridges mood values to the react-icons set.

import type { IconType } from 'react-icons';
import {
    FiAlertCircle,
    FiFrown,
    FiHeart,
    FiHelpCircle,
    FiMoon,
    FiSmile,
    FiStar,
    FiSun,
    FiTrendingUp,
    FiWind,
    FiXCircle,
    FiZap,
} from 'react-icons/fi';

import { MOOD_OPTIONS, type CheckinMood } from './moods';

export const MOOD_ICONS: Record<string, IconType> = {
    happy: FiSmile,
    calm: FiSun,
    tired: FiMoon,
    anxious: FiAlertCircle,
    sad: FiFrown,
    grateful: FiHeart,
    frustrated: FiWind,
    thoughtful: FiHelpCircle,
    excited: FiZap,
    hopeful: FiStar,
    motivated: FiTrendingUp,
    // FiXCircle was used for "frustrated" in the legacy edit page — kept here
    // as an alternate so legacy consumers can override if needed.
};

export type MoodPickerOption = {
    value: string;
    label: string;
    icon: IconType;
    emoji: string;
    color: string;
};

const FALLBACK_ICON = FiHelpCircle;

const buildOption = (mood: { value: string; label: string; emoji: string; color: string }): MoodPickerOption => ({
    value: mood.value,
    label: mood.label,
    icon: MOOD_ICONS[mood.value] || FALLBACK_ICON,
    emoji: mood.emoji,
    color: mood.color,
});

/**
 * Full Core-10 mood picker — primary entry editor and filter chips.
 * Order matches CHECKIN_MOODS (real-world frequency).
 */
export const MOOD_PICKER_OPTIONS: MoodPickerOption[] = MOOD_OPTIONS.map(buildOption);

/**
 * Smaller legacy edit-page subset. Kept as a named view so the edit page can
 * stay unchanged visually while still pulling icons from the canonical map.
 */
const EDIT_PAGE_MOOD_VALUES = ['happy', 'calm', 'sad', 'anxious', 'frustrated', 'thoughtful', 'motivated', 'tired'];
export const EDIT_PAGE_MOOD_OPTIONS: MoodPickerOption[] = EDIT_PAGE_MOOD_VALUES
    .map((value) => {
        const found = MOOD_OPTIONS.find((opt) => opt.value === value);
        if (found) return buildOption(found);
        // motivated isn't in CHECKIN_MOODS, so synthesize a minimal entry.
        return {
            value,
            label: value.charAt(0).toUpperCase() + value.slice(1),
            icon: MOOD_ICONS[value] || FALLBACK_ICON,
            emoji: '',
            color: '',
        };
    });

export type { CheckinMood };
