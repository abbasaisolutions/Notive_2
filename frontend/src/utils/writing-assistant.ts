const COMMON_REPLACEMENTS: Array<[RegExp, string]> = [
    [/\bdont\b/gi, "don't"],
    [/\bcant\b/gi, "can't"],
    [/\bwont\b/gi, "won't"],
    [/\bim\b/gi, "I'm"],
    [/\bive\b/gi, "I've"],
    [/\bidk\b/gi, "I don't know"],
];

function capitalizeSentenceStarts(text: string): string {
    return text.replace(/(^|[.!?]\s+|\n)([a-z])/g, (_, prefix: string, letter: string) => {
        return `${prefix}${letter.toUpperCase()}`;
    });
}

export function polishEntryText(input: string): string {
    let text = input.replace(/\r\n/g, '\n');
    text = text
        .split('\n')
        .map(line => line.replace(/[ \t]+$/g, ''))
        .join('\n');

    text = text.replace(/[ \t]{2,}/g, ' ');
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.replace(/\s+([,.;!?])/g, '$1');
    text = text.replace(/([,.;!?])([^\s\n])/g, '$1 $2');
    text = text.replace(/([!?]){2,}/g, '$1');
    text = text.replace(/\.{4,}/g, '...');
    text = text.replace(/,{2,}/g, ',');

    text = text.replace(/(^|[^A-Za-z])i('m|'ve|'ll|'d)?(?=[^A-Za-z]|$)/g, (_, prefix: string, suffix: string = '') => {
        return `${prefix}I${suffix}`;
    });

    for (const [pattern, replacement] of COMMON_REPLACEMENTS) {
        text = text.replace(pattern, replacement);
    }

    text = capitalizeSentenceStarts(text);
    return text.trim();
}

export function polishTitle(input: string): string {
    const cleaned = input.trim().replace(/\s{2,}/g, ' ');
    if (!cleaned) return '';
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export type WritingSuggestion = {
    id: string;
    message: string;
    severity: 'info' | 'warning';
};

export type StarterPrompt = {
    label: string;
    text: string;
};

export function getStarterPrompt(now: Date, mood: string | null): StarterPrompt {
    const hour = now.getHours();
    const period = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    const moodPrefix = mood ? `You feel ${mood}. ` : '';

    if (period === 'morning') {
        return {
            label: 'Morning reset',
            text: `${moodPrefix}What matters most today, and what is one step you will take first?`,
        };
    }

    if (period === 'afternoon') {
        return {
            label: 'Midday check-in',
            text: `${moodPrefix}What has gone well so far, and what needs adjustment for the rest of the day?`,
        };
    }

    return {
        label: 'Evening reflection',
        text: `${moodPrefix}What did you learn today, and what do you want to carry into tomorrow?`,
    };
}

export function getWritingSuggestions(text: string): WritingSuggestion[] {
    const suggestions: WritingSuggestion[] = [];
    const normalized = text.trim();
    if (!normalized) return suggestions;

    const sentences = normalized
        .split(/[.!?]+/g)
        .map(s => s.trim())
        .filter(Boolean);

    const longSentence = sentences.find(s => s.split(/\s+/).length > 30);
    if (longSentence) {
        suggestions.push({
            id: 'long-sentence',
            severity: 'warning',
            message: 'At least one sentence is long. Consider splitting it for readability.',
        });
    }

    const repeatedWord = normalized.match(/\b([a-zA-Z]{2,})\s+\1\b/i);
    if (repeatedWord) {
        suggestions.push({
            id: 'repeated-word',
            severity: 'warning',
            message: `Repeated word detected: "${repeatedWord[1]} ${repeatedWord[1]}".`,
        });
    }

    const noPunctuation = !/[.!?]/.test(normalized) && normalized.split(/\s+/).length > 20;
    if (noPunctuation) {
        suggestions.push({
            id: 'no-punctuation',
            severity: 'info',
            message: 'Add punctuation to improve rhythm and clarity.',
        });
    }

    if (suggestions.length === 0 && normalized.split(/\s+/).length > 40) {
        suggestions.push({
            id: 'clean',
            severity: 'info',
            message: 'Writing flow looks good. Use "Polish Grammar" for a quick final pass.',
        });
    }

    return suggestions;
}
