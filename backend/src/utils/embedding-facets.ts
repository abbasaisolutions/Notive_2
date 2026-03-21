import crypto from 'crypto';

export type EmbeddingFacetType =
    | 'title'
    | 'reflection'
    | 'lesson'
    | 'skill'
    | 'opportunity_situation'
    | 'opportunity_action'
    | 'opportunity_lesson'
    | 'opportunity_outcome';

export type EntryEmbeddingFacetRecord = {
    facetType: EmbeddingFacetType;
    facetKey: string;
    facetText: string;
    contentHash: string;
};

type EmbeddingFacetInput = {
    title?: string | null;
    reflection?: string | null;
    lessons?: string[];
    skills?: string[];
    analysis?: unknown;
};

const normalizeText = (value: unknown, maxLength: number): string => {
    if (typeof value !== 'string') return '';

    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) return '';

    return normalized.length <= maxLength
        ? normalized
        : `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

const normalizeList = (values: unknown, limit: number, maxLength: number): string[] => {
    if (!Array.isArray(values)) return [];

    const seen = new Set<string>();
    const result: string[] = [];

    values.forEach((value) => {
        if (result.length >= limit) return;
        const normalized = normalizeText(value, maxLength);
        if (!normalized) return;
        const key = normalized.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        result.push(normalized);
    });

    return result;
};

const readEvidenceText = (value: unknown, maxLength: number): string => {
    if (typeof value === 'string') return normalizeText(value, maxLength);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return '';

    const record = value as Record<string, unknown>;
    return normalizeText(record.text, maxLength);
};

const getAnalysisRecord = (analysis: unknown): Record<string, unknown> =>
    analysis && typeof analysis === 'object' && !Array.isArray(analysis)
        ? (analysis as Record<string, unknown>)
        : {};

const buildFacetHash = (facetType: EmbeddingFacetType, facetText: string) =>
    crypto.createHash('sha256').update(`${facetType}\n${facetText}`).digest('hex');

export const getEmbeddingFacetLabel = (facetType: EmbeddingFacetType): string => {
    switch (facetType) {
        case 'title':
            return 'Title';
        case 'reflection':
            return 'Reflection';
        case 'lesson':
            return 'Lesson';
        case 'skill':
            return 'Skill';
        case 'opportunity_situation':
            return 'Opportunity Situation';
        case 'opportunity_action':
            return 'Opportunity Action';
        case 'opportunity_lesson':
            return 'Opportunity Lesson';
        case 'opportunity_outcome':
            return 'Opportunity Outcome';
        default:
            return 'Memory';
    }
};

export const buildEntryEmbeddingFacets = (input: EmbeddingFacetInput): EntryEmbeddingFacetRecord[] => {
    const analysisRecord = getAnalysisRecord(input.analysis);
    const aiRecord = getAnalysisRecord(analysisRecord.ai);
    const aiEvidence = getAnalysisRecord(aiRecord.evidence);
    const opportunityRecord = getAnalysisRecord(analysisRecord.opportunity);

    const opportunityFields: Array<{ facetType: EmbeddingFacetType; facetKey: string; value: string }> = [
        {
            facetType: 'opportunity_situation',
            facetKey: 'situation',
            value:
                normalizeText(opportunityRecord.situation, 280)
                || readEvidenceText(aiEvidence.situation, 280),
        },
        {
            facetType: 'opportunity_action',
            facetKey: 'action',
            value:
                normalizeText(opportunityRecord.action, 280)
                || readEvidenceText(aiEvidence.action, 280),
        },
        {
            facetType: 'opportunity_lesson',
            facetKey: 'lesson',
            value:
                normalizeText(opportunityRecord.lesson, 280)
                || readEvidenceText(aiEvidence.lesson, 280),
        },
        {
            facetType: 'opportunity_outcome',
            facetKey: 'outcome',
            value:
                normalizeText(opportunityRecord.outcome, 280)
                || readEvidenceText(aiEvidence.outcome, 280),
        },
    ];

    const rawFacets: Array<Omit<EntryEmbeddingFacetRecord, 'contentHash'>> = [];
    const title = normalizeText(input.title, 180);
    const reflection = normalizeText(input.reflection, 320);
    const lessons = normalizeList(input.lessons, 6, 220);
    const skills = normalizeList(input.skills, 8, 120);

    if (title) {
        rawFacets.push({
            facetType: 'title',
            facetKey: 'title',
            facetText: title,
        });
    }

    if (reflection) {
        rawFacets.push({
            facetType: 'reflection',
            facetKey: 'reflection',
            facetText: reflection,
        });
    }

    lessons.forEach((lesson, index) => {
        rawFacets.push({
            facetType: 'lesson',
            facetKey: `lesson:${index}`,
            facetText: lesson,
        });
    });

    skills.forEach((skill, index) => {
        rawFacets.push({
            facetType: 'skill',
            facetKey: `skill:${index}`,
            facetText: skill,
        });
    });

    opportunityFields.forEach((field) => {
        if (!field.value) return;
        rawFacets.push({
            facetType: field.facetType,
            facetKey: field.facetKey,
            facetText: field.value,
        });
    });

    const seen = new Set<string>();

    return rawFacets
        .filter((facet) => {
            const key = `${facet.facetType}:${facet.facetText.toLowerCase()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .map((facet) => ({
            ...facet,
            contentHash: buildFacetHash(facet.facetType, facet.facetText),
        }));
};
