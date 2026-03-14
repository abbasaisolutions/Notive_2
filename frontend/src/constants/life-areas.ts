export type EntryCategory = 'PERSONAL' | 'PROFESSIONAL';

export type LifeAreaOption = {
    value: string;
    label: string;
    category: EntryCategory;
};

export const LIFE_AREA_OPTIONS: LifeAreaOption[] = [
    { value: 'Health & Wellness', label: 'Health & Wellness', category: 'PERSONAL' },
    { value: 'Relationships', label: 'Relationships', category: 'PERSONAL' },
    { value: 'Family', label: 'Family', category: 'PERSONAL' },
    { value: 'Mindset', label: 'Mindset', category: 'PERSONAL' },
    { value: 'Creativity', label: 'Creativity', category: 'PERSONAL' },
    { value: 'Lifestyle', label: 'Lifestyle', category: 'PERSONAL' },
    { value: 'Career', label: 'Career', category: 'PROFESSIONAL' },
    { value: 'Business', label: 'Business', category: 'PROFESSIONAL' },
    { value: 'Leadership', label: 'Leadership', category: 'PROFESSIONAL' },
    { value: 'Learning', label: 'Learning', category: 'PROFESSIONAL' },
    { value: 'Execution', label: 'Execution', category: 'PROFESSIONAL' },
    { value: 'Networking', label: 'Networking', category: 'PROFESSIONAL' },
];

export const DEFAULT_LIFE_AREA_BY_CATEGORY: Record<EntryCategory, string> = {
    PERSONAL: 'Lifestyle',
    PROFESSIONAL: 'Career',
};

export const normalizeCategory = (value: unknown): EntryCategory =>
    value === 'PROFESSIONAL' ? 'PROFESSIONAL' : 'PERSONAL';

export const normalizeLifeArea = (
    value: unknown,
    category: EntryCategory,
    fallbackToDefault = true
): string => {
    const candidate = typeof value === 'string' ? value.trim() : '';
    const options = LIFE_AREA_OPTIONS.filter((item) => item.category === category);
    const match = options.find((item) => item.value.toLowerCase() === candidate.toLowerCase());
    if (match) return match.value;
    return fallbackToDefault ? DEFAULT_LIFE_AREA_BY_CATEGORY[category] : '';
};

