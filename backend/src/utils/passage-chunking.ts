export type PassageChunk = {
    index: number;
    text: string;
};

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
    const parsed = Number.parseInt(String(value || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const BASE_TARGET_CHARS = parsePositiveInt(process.env.EMBEDDING_CHUNK_TARGET_CHARS, 720);
const OVERLAP_CHARS = parsePositiveInt(process.env.EMBEDDING_CHUNK_OVERLAP_CHARS, 140);
const MAX_CHUNK_COUNT = parsePositiveInt(process.env.EMBEDDING_CHUNK_MAX_COUNT, 12);

const normalizeWhitespace = (value: string): string =>
    value
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

const collapseInlineWhitespace = (value: string): string =>
    value
        .replace(/[ \t]+/g, ' ')
        .replace(/\s*\n\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const splitLongSegment = (segment: string, targetChars: number): string[] => {
    const normalized = collapseInlineWhitespace(segment);
    if (!normalized) return [];
    if (normalized.length <= targetChars) return [normalized];

    const slices: string[] = [];
    let remaining = normalized;

    while (remaining.length > targetChars) {
        const preferredBreaks = [
            remaining.lastIndexOf('. ', targetChars),
            remaining.lastIndexOf('! ', targetChars),
            remaining.lastIndexOf('? ', targetChars),
            remaining.lastIndexOf('; ', targetChars),
            remaining.lastIndexOf(', ', targetChars),
            remaining.lastIndexOf(' ', targetChars),
        ];

        let splitAt = Math.max(...preferredBreaks);
        if (splitAt < Math.floor(targetChars * 0.55)) {
            splitAt = targetChars;
        } else {
            splitAt += 1;
        }

        slices.push(remaining.slice(0, splitAt).trim());
        remaining = remaining.slice(splitAt).trim();
    }

    if (remaining) {
        slices.push(remaining);
    }

    return slices;
};

const toSegments = (content: string, targetChars: number): string[] => {
    const normalized = normalizeWhitespace(content);
    if (!normalized) return [];

    const paragraphs = normalized.split(/\n{2,}/).flatMap((paragraph) => {
        const trimmedParagraph = paragraph.trim();
        if (!trimmedParagraph) return [];

        const sentences = trimmedParagraph
            .split(/(?<=[.!?])\s+/)
            .map((sentence) => sentence.trim())
            .filter(Boolean);

        const source = sentences.length > 0 ? sentences : [trimmedParagraph];
        return source.flatMap((segment) => splitLongSegment(segment, targetChars));
    });

    return paragraphs.filter(Boolean);
};

const getChunkLength = (segments: string[]): number => segments.join(' ').length;

const getOverlapSegments = (segments: string[]): string[] => {
    if (segments.length === 0 || OVERLAP_CHARS <= 0) return [];

    const overlap: string[] = [];
    let overlapLength = 0;

    for (let index = segments.length - 1; index >= 0; index -= 1) {
        const segment = segments[index];
        const projectedLength = overlapLength + segment.length + (overlap.length > 0 ? 1 : 0);
        if (projectedLength > OVERLAP_CHARS && overlap.length > 0) {
            break;
        }

        overlap.unshift(segment);
        overlapLength = projectedLength;

        if (overlapLength >= OVERLAP_CHARS) {
            break;
        }
    }

    return overlap;
};

export const buildPassageChunks = (content: string): PassageChunk[] => {
    const normalized = normalizeWhitespace(content);
    if (!normalized) return [];

    const dynamicTargetChars = Math.max(
        BASE_TARGET_CHARS,
        Math.ceil(normalized.length / Math.max(1, MAX_CHUNK_COUNT))
    );
    const targetChars = Math.max(dynamicTargetChars, OVERLAP_CHARS + 120);
    const segments = toSegments(normalized, targetChars);

    if (segments.length === 0) {
        return [];
    }

    const chunkSegments: string[][] = [];
    let current: string[] = [];

    const flushCurrent = () => {
        if (current.length === 0) return;

        chunkSegments.push([...current]);
        current = getOverlapSegments(current);
    };

    segments.forEach((segment) => {
        if (current.length === 0) {
            current = [segment];
            return;
        }

        const nextLength = getChunkLength([...current, segment]);
        if (nextLength <= targetChars) {
            current.push(segment);
            return;
        }

        flushCurrent();

        while (current.length > 0 && getChunkLength([...current, segment]) > targetChars) {
            current.shift();
        }

        current.push(segment);
    });

    flushCurrent();

    return chunkSegments
        .map((parts, index) => ({
            index,
            text: collapseInlineWhitespace(parts.join(' ')),
        }))
        .filter((chunk, index, chunks) =>
            Boolean(chunk.text) && (index === 0 || chunk.text !== chunks[index - 1]?.text)
        );
};
