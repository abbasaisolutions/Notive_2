/**
 * Produces a short, private, deterministic subject from a memory's own text.
 * It intentionally runs in the browser and never calls an AI or network service.
 */
const MAX_SUBJECT_LENGTH = 72;

const trimSubject = (value: string) => {
    const compact = value.replace(/\s+/g, ' ').trim().replace(/^[\-–—:;,\s]+|[\-–—:;,\s]+$/g, '');
    if (!compact) return '';

    const shortened = compact.length > MAX_SUBJECT_LENGTH
        ? compact.slice(0, MAX_SUBJECT_LENGTH - 1).replace(/\s+\S*$/, '').trim()
        : compact;
    const withoutTrailingPunctuation = shortened.replace(/[.!?]+$/, '').trim();

    return withoutTrailingPunctuation
        ? withoutTrailingPunctuation.charAt(0).toUpperCase() + withoutTrailingPunctuation.slice(1)
        : '';
};

export function suggestMemorySubject(content: string): string {
    const normalized = content
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!normalized) return '';

    // Wait until there is enough context to avoid a title that flickers with
    // every first keystroke.
    if (normalized.split(/\s+/).filter(Boolean).length < 3) return '';

    const sentences = normalized
        .split(/(?<=[.!?])\s+|\n+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean);

    const firstUsefulSentence = sentences.find((sentence) => {
        const words = sentence.replace(/[^A-Za-z0-9À-ÿ'’-]+/g, ' ').trim().split(/\s+/).filter(Boolean);
        return words.length >= 3;
    }) || normalized;

    return trimSubject(firstUsefulSentence);
}
