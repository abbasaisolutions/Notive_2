import type { IconType } from 'react-icons';
import {
    FiActivity,
    FiAward,
    FiBook,
    FiBookOpen,
    FiCpu,
    FiEdit3,
    FiHeart,
    FiImage,
    FiMap,
    FiMoon,
    FiPenTool,
    FiStar,
    FiSun,
    FiTarget,
    FiZap,
} from 'react-icons/fi';

export type ChapterIconKey =
    | 'book-open'
    | 'book'
    | 'sparkles'
    | 'lightbulb'
    | 'target'
    | 'activity'
    | 'heart'
    | 'star'
    | 'flame'
    | 'sun'
    | 'palette'
    | 'pen-line'
    | 'brain'
    | 'moon'
    | 'mountain';

export type ChapterIconOption = {
    key: ChapterIconKey;
    value: ChapterIconKey;
    label: string;
    Icon: IconType;
};

const CHAPTER_ICON_REGISTRY: Record<ChapterIconKey, { label: string; Icon: IconType }> = {
    'book-open': { label: 'Open Book', Icon: FiBookOpen },
    book: { label: 'Book', Icon: FiBook },
    sparkles: { label: 'Sparkles', Icon: FiStar },
    lightbulb: { label: 'Idea', Icon: FiZap },
    target: { label: 'Target', Icon: FiTarget },
    activity: { label: 'Activity', Icon: FiActivity },
    heart: { label: 'Heart', Icon: FiHeart },
    star: { label: 'Star', Icon: FiStar },
    flame: { label: 'Momentum', Icon: FiZap },
    sun: { label: 'Sun', Icon: FiSun },
    palette: { label: 'Creative', Icon: FiImage },
    'pen-line': { label: 'Writing', Icon: FiPenTool },
    brain: { label: 'Thinking', Icon: FiCpu },
    moon: { label: 'Night', Icon: FiMoon },
    mountain: { label: 'Journey', Icon: FiMap },
};

export const CHAPTER_ICON_OPTIONS: ChapterIconOption[] = Object.entries(CHAPTER_ICON_REGISTRY).map(([key, config]) => ({
    key: key as ChapterIconKey,
    value: key as ChapterIconKey,
    label: config.label,
    Icon: config.Icon,
}));

export const CHAPTER_ICON_MAP: Record<string, IconType> = {
    '📖': FiBookOpen,
    '📚': FiBook,
    '✨': FiStar,
    '💡': FiZap,
    '🎯': FiTarget,
    '💪': FiActivity,
    '❤️': FiHeart,
    '🌟': FiStar,
    '🔥': FiZap,
    '🌈': FiSun,
    '🎨': FiImage,
    '✍️': FiPenTool,
    '🧠': FiCpu,
    '🌙': FiMoon,
    '☀️': FiSun,
    '🏔️': FiMap,
};

for (const option of CHAPTER_ICON_OPTIONS) {
    CHAPTER_ICON_MAP[option.key] = option.Icon;
}

export const normalizeChapterIcon = (value: string | null | undefined): ChapterIconKey => {
    if (!value) return 'book-open';
    const normalized = value.trim().toLowerCase();
    if (normalized in CHAPTER_ICON_REGISTRY) {
        return normalized as ChapterIconKey;
    }

    const emojiToKey: Record<string, ChapterIconKey> = {
        '📖': 'book-open',
        '📚': 'book',
        '✨': 'sparkles',
        '💡': 'lightbulb',
        '🎯': 'target',
        '💪': 'activity',
        '❤️': 'heart',
        '🌟': 'star',
        '🔥': 'flame',
        '🌈': 'sun',
        '🎨': 'palette',
        '✍️': 'pen-line',
        '🧠': 'brain',
        '🌙': 'moon',
        '☀️': 'sun',
        '🏔️': 'mountain',
    };

    return emojiToKey[value] || 'book-open';
};

export const getChapterIconComponent = (value: string | null | undefined): IconType => {
    const key = normalizeChapterIcon(value);
    return CHAPTER_ICON_REGISTRY[key].Icon;
};

export const getChapterIcon = getChapterIconComponent;

export const getChapterIconLabel = (value: string | null | undefined): string => {
    const key = normalizeChapterIcon(value);
    return CHAPTER_ICON_REGISTRY[key].label;
};

export const LEGACY_CHAPTER_ICON_FALLBACK = FiAward;
