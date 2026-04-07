export type GentleReflectionEntry = {
    id: string;
    title: string | null;
    content: string;
    mood: string | null;
    tags: string[];
    coverImage: string | null;
    audioUrl?: string | null;
    createdAt: string;
};

export type GentleReflectionResurfacedMoment = {
    sourceEntry: {
        id: string;
        title: string | null;
        createdAt: string;
    };
    matchedEntry: {
        id: string;
        title: string | null;
        contentPreview: string;
        mood: string | null;
        createdAt: string;
    };
    relevance: number;
    matchReasons: string[];
};

export type GentleReflectionThemeCluster = {
    id: string;
    label: string;
    summary: string;
    entryCount: number;
    dominantMood: string | null;
    topThemes: string[];
    averageSimilarity: number;
    representativeEntries: Array<{
        id: string;
        title: string | null;
        contentPreview: string;
        createdAt: string;
        mood: string | null;
    }>;
};

export type GentleReflectionDraft = {
    id: string;
    title: string;
    body: string;
    prompt: string;
    evidence: string;
    contextLabel: string;
    sourceLabel: string;
    strengthLabel: string | null;
    seedTags: string[];
};

const POSITIVE_MOODS = new Map<string, string>([
    ['happy', 'lighter'],
    ['calm', 'steadier'],
    ['grateful', 'grateful'],
    ['motivated', 'energized'],
    ['hopeful', 'hopeful'],
    ['excited', 'bright'],
    ['proud', 'proud'],
]);

const GENERIC_TAGS = new Set([
    'journal',
    'note',
    'notes',
    'reflection',
    'school',
    'life',
    'thoughts',
    'daily',
]);

const STRENGTH_RULES: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /\b(practic|train|workout|gym|run|repeat|streak|habit)\b/i, label: 'consistency' },
    { pattern: /\b(help|friend|support|team|mentor|coach|together|volunteer)\b/i, label: 'care' },
    { pattern: /\b(project|study|class|exam|build|finish|focus|deadline)\b/i, label: 'follow-through' },
    { pattern: /\b(draw|art|music|photo|write|design|create)\b/i, label: 'creativity' },
    { pattern: /\b(lead|captain|organize|guide|teach|present)\b/i, label: 'leadership' },
    { pattern: /\b(explore|try|new|learn|question|curious)\b/i, label: 'curiosity' },
];

const normalizeText = (value: string | null | undefined, maxLength = 180) => {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

const titleize = (value: string) =>
    value
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

const normalizeThemeLabel = (value: string | null | undefined) =>
    String(value || '')
        .replace(/[_#]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 40);

const dedupe = (values: Array<string | null | undefined>) =>
    Array.from(
        new Set(
            values
                .map((value) => normalizeThemeLabel(value))
                .filter(Boolean)
        )
    );

const pickThemeFromTags = (entries: GentleReflectionEntry[]): string | null => {
    const counts = new Map<string, number>();

    entries.slice(0, 6).forEach((entry) => {
        entry.tags.forEach((tag) => {
            const normalized = normalizeThemeLabel(tag).toLowerCase();
            if (!normalized || GENERIC_TAGS.has(normalized) || normalized.length < 3) return;
            counts.set(normalized, (counts.get(normalized) || 0) + 1);
        });
    });

    let winner = '';
    let winnerCount = 0;
    counts.forEach((count, tag) => {
        if (count > winnerCount) {
            winner = tag;
            winnerCount = count;
        }
    });

    return winner ? titleize(winner) : null;
};

const pickPositiveMood = (entries: GentleReflectionEntry[], themeClusters: GentleReflectionThemeCluster[]): string | null => {
    for (const cluster of themeClusters) {
        const normalized = String(cluster.dominantMood || '').trim().toLowerCase();
        if (POSITIVE_MOODS.has(normalized)) {
            return normalized;
        }
    }

    for (const entry of entries.slice(0, 5)) {
        const normalized = String(entry.mood || '').trim().toLowerCase();
        if (POSITIVE_MOODS.has(normalized)) {
            return normalized;
        }
    }

    return null;
};

const pickStrength = (entries: GentleReflectionEntry[], theme: string | null): string | null => {
    const sample = [
        theme,
        ...entries.slice(0, 4).flatMap((entry) => [entry.title, entry.content, entry.tags.join(' ')]),
    ].join(' ');

    for (const rule of STRENGTH_RULES) {
        if (rule.pattern.test(sample)) {
            return rule.label;
        }
    }

    return null;
};

const buildPromptId = (parts: string[]) =>
    parts
        .filter(Boolean)
        .join('::')
        .toLowerCase();

export const buildGentleReflectionDraft = (input: {
    entries: GentleReflectionEntry[];
    resurfacedMoments: GentleReflectionResurfacedMoment[];
    themeClusters: GentleReflectionThemeCluster[];
}): GentleReflectionDraft | null => {
    const recentEntries = input.entries.slice(0, 6);
    if (recentEntries.length === 0) {
        return null;
    }

    const primaryCluster = input.themeClusters[0] || null;
    const resurfacedMoment = input.resurfacedMoments[0] || null;
    const theme = primaryCluster?.label
        || primaryCluster?.topThemes?.[0]
        || pickThemeFromTags(recentEntries);
    const positiveMood = pickPositiveMood(recentEntries, input.themeClusters);
    const strength = pickStrength(recentEntries, theme);

    if (primaryCluster && theme) {
        const promptId = buildPromptId([
            'cluster',
            primaryCluster.id,
            resurfacedMoment?.matchedEntry.id || '',
            strength || '',
        ]);

        return {
            id: promptId,
            title: resurfacedMoment ? 'This thread is still here' : 'A calm thread is forming',
            body: resurfacedMoment
                ? `Recent notes keep circling ${theme.toLowerCase()}, and it echoes something older you already wrote.`
                : `Recent notes keep circling ${theme.toLowerCase()}. That may be worth one more line today.`,
            prompt: strength
                ? `Where did ${strength} show up in this ${theme.toLowerCase()} thread today?`
                : `What felt most honest or worth keeping in this ${theme.toLowerCase()} thread today?`,
            evidence: resurfacedMoment
                ? 'Built from recent notes and one older match.'
                : 'Built from recent notes pointing the same way.',
            contextLabel: theme,
            sourceLabel: 'Recent notes only',
            strengthLabel: strength ? titleize(strength) : null,
            seedTags: dedupe(['gentle reflection', theme, strength, 'small win']),
        };
    }

    if (resurfacedMoment) {
        const promptId = buildPromptId([
            'resurfaced',
            resurfacedMoment.sourceEntry.id,
            resurfacedMoment.matchedEntry.id,
            strength || '',
        ]);

        return {
            id: promptId,
            title: 'An older note fits here',
            body: 'A recent note lines up with something older in your journal.',
            prompt: strength
                ? `Where do you notice ${strength} showing up again?`
                : 'What feels different this time, and what do you want to remember?',
            evidence: 'Built from one recent note and one older match.',
            contextLabel: normalizeText(resurfacedMoment.matchedEntry.title, 42) || 'Past win',
            sourceLabel: 'Recent notes only',
            strengthLabel: strength ? titleize(strength) : null,
            seedTags: dedupe(['gentle reflection', resurfacedMoment.matchedEntry.title, strength, 'past win']),
        };
    }

    if (positiveMood) {
        const promptId = buildPromptId([
            'mood',
            positiveMood,
            recentEntries[0]?.id || '',
        ]);
        const moodTone = POSITIVE_MOODS.get(positiveMood) || positiveMood;

        return {
            id: promptId,
            title: 'A steadier moment is here',
            body: `Recent notes sound a little more ${moodTone}.`,
            prompt: `What helped today feel a little more ${positiveMood}?`,
            evidence: 'Built from the tone in recent notes.',
            contextLabel: titleize(positiveMood),
            sourceLabel: 'Recent notes only',
            strengthLabel: strength ? titleize(strength) : null,
            seedTags: dedupe(['gentle reflection', positiveMood, strength, 'good energy']),
        };
    }

    const recentTitle = normalizeText(recentEntries[0]?.title, 42);
    const promptId = buildPromptId([
        'recent',
        recentEntries[0]?.id || '',
        recentTitle,
    ]);

    return {
        id: promptId,
        title: 'One more line could help',
        body: recentTitle
            ? `Your latest note, "${recentTitle}," may have one more honest line in it.`
            : 'Your latest note may have one more honest line in it.',
        prompt: 'What from today feels worth saving before it fades?',
        evidence: 'Built from your most recent note.',
        contextLabel: recentTitle || 'Recent note',
        sourceLabel: 'Recent notes only',
        strengthLabel: strength ? titleize(strength) : null,
        seedTags: dedupe(['gentle reflection', recentTitle, strength]),
    };
};

export default buildGentleReflectionDraft;
