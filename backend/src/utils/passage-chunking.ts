export type PassageChunk = {
    index: number;
    text: string;
};

type PassageUnit = {
    text: string;
    tokenCount: number;
};

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
    const parsed = Number.parseInt(String(value || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const BASE_TARGET_TOKENS = parsePositiveInt(process.env.EMBEDDING_CHUNK_TARGET_TOKENS, 180);
const OVERLAP_TOKENS = parsePositiveInt(process.env.EMBEDDING_CHUNK_OVERLAP_TOKENS, 36);
const MAX_CHUNK_COUNT = parsePositiveInt(process.env.EMBEDDING_CHUNK_MAX_COUNT, 12);
const LONG_SEGMENT_FALLBACK_WORDS = parsePositiveInt(process.env.EMBEDDING_CHUNK_LONG_SEGMENT_WORDS, 110);

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

const estimateTokenCount = (value: string): number =>
    Math.max(
        1,
        (collapseInlineWhitespace(value).match(/[A-Za-z0-9']+|[^\sA-Za-z0-9]/g) || []).length
    );

const splitWordWindow = (segment: string, maxWords: number): string[] => {
    const words = collapseInlineWhitespace(segment).split(' ').filter(Boolean);
    if (words.length <= maxWords) {
        return words.length > 0 ? [words.join(' ')] : [];
    }

    const windows: string[] = [];
    for (let index = 0; index < words.length; index += maxWords) {
        windows.push(words.slice(index, index + maxWords).join(' '));
    }
    return windows;
};

const groupClauses = (clauses: string[], targetTokens: number): string[] => {
    const grouped: string[] = [];
    let current: string[] = [];
    let currentTokens = 0;

    clauses.forEach((clause) => {
        const tokenCount = estimateTokenCount(clause);
        if (current.length > 0 && currentTokens + tokenCount > targetTokens) {
            grouped.push(current.join(' '));
            current = [];
            currentTokens = 0;
        }

        current.push(clause);
        currentTokens += tokenCount;
    });

    if (current.length > 0) {
        grouped.push(current.join(' '));
    }

    return grouped;
};

const splitLongSegment = (segment: string, targetTokens: number): string[] => {
    const normalized = collapseInlineWhitespace(segment);
    if (!normalized) return [];
    if (estimateTokenCount(normalized) <= targetTokens) return [normalized];

    const clauses = normalized
        .split(/(?<=[,;:])\s+|\s[-–]\s/g)
        .map((clause) => clause.trim())
        .filter(Boolean);

    if (clauses.length > 1) {
        return groupClauses(clauses, targetTokens)
            .flatMap((clauseGroup) => splitLongSegment(clauseGroup, targetTokens))
            .filter(Boolean);
    }

    return splitWordWindow(normalized, Math.max(20, Math.floor(LONG_SEGMENT_FALLBACK_WORDS)));
};

const splitParagraphToUnits = (paragraph: string, targetTokens: number): PassageUnit[] => {
    const normalized = collapseInlineWhitespace(paragraph);
    if (!normalized) return [];

    const sentences = normalized
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean);

    const source = sentences.length > 0 ? sentences : [normalized];

    return source
        .flatMap((sentence) => splitLongSegment(sentence, targetTokens))
        .map((text) => ({
            text,
            tokenCount: estimateTokenCount(text),
        }))
        .filter((unit) => unit.text.length > 0);
};

const getChunkTokenCount = (units: PassageUnit[]): number =>
    units.reduce((total, unit) => total + unit.tokenCount, 0);

const getOverlapUnits = (units: PassageUnit[]): PassageUnit[] => {
    if (units.length === 0 || OVERLAP_TOKENS <= 0) return [];

    const overlap: PassageUnit[] = [];
    let tokenCount = 0;

    for (let index = units.length - 1; index >= 0; index -= 1) {
        const unit = units[index];
        if (tokenCount >= OVERLAP_TOKENS && overlap.length > 0) {
            break;
        }

        overlap.unshift(unit);
        tokenCount += unit.tokenCount;
    }

    return overlap;
};

export const buildPassageChunks = (content: string): PassageChunk[] => {
    const normalized = normalizeWhitespace(content);
    if (!normalized) return [];

    const totalTokens = estimateTokenCount(normalized);
    const dynamicTargetTokens = Math.max(
        BASE_TARGET_TOKENS,
        Math.ceil(totalTokens / Math.max(1, MAX_CHUNK_COUNT))
    );
    const targetTokens = Math.max(dynamicTargetTokens, OVERLAP_TOKENS + 28);

    const units = normalized
        .split(/\n{2,}/)
        .flatMap((paragraph) => splitParagraphToUnits(paragraph, targetTokens));

    if (units.length === 0) {
        return [];
    }

    const chunkUnits: PassageUnit[][] = [];
    let current: PassageUnit[] = [];

    const flushCurrent = () => {
        if (current.length === 0) return;
        chunkUnits.push([...current]);
        current = getOverlapUnits(current);
    };

    units.forEach((unit) => {
        if (current.length === 0) {
            current = [unit];
            return;
        }

        const projected = getChunkTokenCount([...current, unit]);
        if (projected <= targetTokens) {
            current.push(unit);
            return;
        }

        flushCurrent();

        while (current.length > 0 && getChunkTokenCount([...current, unit]) > targetTokens) {
            current.shift();
        }

        current.push(unit);
    });

    flushCurrent();

    return chunkUnits
        .map((parts, index) => ({
            index,
            text: collapseInlineWhitespace(parts.map((part) => part.text).join(' ')),
        }))
        .filter((chunk, index, chunks) =>
            Boolean(chunk.text) && (index === 0 || chunk.text !== chunks[index - 1]?.text)
        );
};
