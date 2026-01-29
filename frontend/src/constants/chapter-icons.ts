import type { LucideIcon } from 'lucide-react';
import {
    Activity,
    Book,
    BookOpen,
    Brain,
    Flame,
    Heart,
    Lightbulb,
    Moon,
    Mountain,
    Palette,
    PenLine,
    Sparkles,
    Star,
    Sun,
    Target,
} from 'lucide-react';

export type ChapterIconOption = {
    value: string;
    Icon: LucideIcon;
};

export const CHAPTER_ICON_OPTIONS: ChapterIconOption[] = [
    { value: 'book-open', Icon: BookOpen },
    { value: 'book', Icon: Book },
    { value: 'sparkles', Icon: Sparkles },
    { value: 'lightbulb', Icon: Lightbulb },
    { value: 'target', Icon: Target },
    { value: 'activity', Icon: Activity },
    { value: 'heart', Icon: Heart },
    { value: 'star', Icon: Star },
    { value: 'flame', Icon: Flame },
    { value: 'sun', Icon: Sun },
    { value: 'palette', Icon: Palette },
    { value: 'pen-line', Icon: PenLine },
    { value: 'brain', Icon: Brain },
    { value: 'moon', Icon: Moon },
    { value: 'mountain', Icon: Mountain },
];

export const CHAPTER_ICON_MAP: Record<string, LucideIcon> = {
    '📖': BookOpen,
    '📚': Book,
    '✨': Sparkles,
    '💡': Lightbulb,
    '🎯': Target,
    '💪': Activity,
    '❤️': Heart,
    '🌟': Star,
    '🔥': Flame,
    '🌈': Sun,
    '🎨': Palette,
    '✍️': PenLine,
    '🧠': Brain,
    '🌙': Moon,
    '☀️': Sun,
    '🏔️': Mountain,
    'book-open': BookOpen,
    'book': Book,
    'sparkles': Sparkles,
    'lightbulb': Lightbulb,
    'target': Target,
    'activity': Activity,
    'heart': Heart,
    'star': Star,
    'flame': Flame,
    'sun': Sun,
    'palette': Palette,
    'pen-line': PenLine,
    'brain': Brain,
    'moon': Moon,
    'mountain': Mountain,
};

export const getChapterIcon = (value: string): LucideIcon =>
    CHAPTER_ICON_MAP[value] || BookOpen;
