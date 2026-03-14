import type { IconType } from 'react-icons';
import {
    FiAward,
    FiBook,
    FiBookOpen,
    FiCompass,
    FiCpu,
    FiEdit3,
    FiFeather,
    FiHeart,
    FiMoon,
    FiStar,
    FiSun,
    FiTarget,
    FiTrendingUp,
    FiZap,
} from 'react-icons/fi';

export type ChapterIconKey =
    | 'book-open'
    | 'book'
    | 'star'
    | 'zap'
    | 'target'
    | 'trending-up'
    | 'heart'
    | 'award'
    | 'edit'
    | 'cpu'
    | 'moon'
    | 'sun'
    | 'compass'
    | 'feather';

export const CHAPTER_ICON_MAP: Record<ChapterIconKey, IconType> = {
    'book-open': FiBookOpen,
    book: FiBook,
    star: FiStar,
    zap: FiZap,
    target: FiTarget,
    'trending-up': FiTrendingUp,
    heart: FiHeart,
    award: FiAward,
    edit: FiEdit3,
    cpu: FiCpu,
    moon: FiMoon,
    sun: FiSun,
    compass: FiCompass,
    feather: FiFeather,
};

const LEGACY_EMOJI_TO_ICON: Record<string, ChapterIconKey> = {
    '📖': 'book-open',
    '📚': 'book',
    '✨': 'star',
    '💡': 'zap',
    '🎯': 'target',
    '💪': 'trending-up',
    '❤️': 'heart',
    '🌟': 'star',
    '🔥': 'zap',
    '🌈': 'sun',
    '🎨': 'award',
    '✍️': 'edit',
    '🧠': 'cpu',
    '🌙': 'moon',
    '☀️': 'sun',
    '🏔️': 'compass',
};

export const CHAPTER_ICON_OPTIONS: Array<{ key: ChapterIconKey; label: string }> = [
    { key: 'book-open', label: 'Book Open' },
    { key: 'book', label: 'Book' },
    { key: 'star', label: 'Star' },
    { key: 'zap', label: 'Energy' },
    { key: 'target', label: 'Target' },
    { key: 'trending-up', label: 'Growth' },
    { key: 'heart', label: 'Heart' },
    { key: 'award', label: 'Award' },
    { key: 'edit', label: 'Writing' },
    { key: 'cpu', label: 'Mind' },
    { key: 'moon', label: 'Night' },
    { key: 'sun', label: 'Day' },
    { key: 'compass', label: 'Journey' },
    { key: 'feather', label: 'Reflection' },
];

export const normalizeChapterIcon = (value: string | null | undefined): ChapterIconKey => {
    if (!value) return 'book-open';
    if ((value as ChapterIconKey) in CHAPTER_ICON_MAP) return value as ChapterIconKey;
    return LEGACY_EMOJI_TO_ICON[value] ?? 'book-open';
};

export const getChapterIconComponent = (value: string | null | undefined): IconType => {
    const key = normalizeChapterIcon(value);
    return CHAPTER_ICON_MAP[key];
};

