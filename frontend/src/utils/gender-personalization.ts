export type GenderPersonalizationValue =
    | 'woman'
    | 'man'
    | 'non_binary'
    | 'self_describe'
    | 'prefer_not_to_say';

export const GENDER_PERSONALIZATION_OPTIONS: Array<{
    value: GenderPersonalizationValue;
    label: string;
    description: string;
}> = [
    {
        value: 'woman',
        label: 'Woman',
        description: 'Use when gender context helps personalize examples.',
    },
    {
        value: 'man',
        label: 'Man',
        description: 'Use when gender context helps personalize examples.',
    },
    {
        value: 'non_binary',
        label: 'Non-binary',
        description: 'Avoid binary assumptions in prompts and summaries.',
    },
    {
        value: 'self_describe',
        label: 'Self-describe',
        description: 'Save exactly what you want Notive to know.',
    },
    {
        value: 'prefer_not_to_say',
        label: 'Skip for now',
        description: 'Do not use gender as personalization context.',
    },
];

export const getGenderPersonalizationLabel = (
    value: string | null | undefined,
    selfDescription?: string | null
): string | null => {
    if (value === 'self_describe') {
        return selfDescription?.trim() || null;
    }

    return GENDER_PERSONALIZATION_OPTIONS.find((option) => option.value === value)?.label || null;
};
