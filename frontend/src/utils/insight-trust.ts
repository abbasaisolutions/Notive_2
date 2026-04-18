export type TrustTone = 'primary' | 'default' | 'muted';

export type TrustMeta = {
    label: string;
    tone: TrustTone;
};

export function getHeroInsightConfidenceMeta(
    qualityScore: number,
    hasEvidence: boolean,
    entryCount: number
): TrustMeta {
    const score = qualityScore + (hasEvidence ? 0.4 : 0) + Math.min(entryCount, 4) * 0.15;

    if (score >= 8) {
        return { label: 'Stronger signal', tone: 'primary' };
    }

    if (score >= 6.3) {
        return { label: 'Building signal', tone: 'default' };
    }

    return { label: 'Early read', tone: 'muted' };
}

export function getPatternScopeLabel(entryCount: number): string {
    if (entryCount <= 0) return 'Across your notes';
    if (entryCount === 1) return 'From 1 note';
    return `From ${entryCount} notes`;
}

export function getPatternConfidenceMeta(occurrences: number): TrustMeta {
    if (occurrences >= 8) return { label: 'High confidence', tone: 'primary' };
    if (occurrences >= 4) return { label: 'Medium confidence', tone: 'default' };
    return { label: 'Low confidence', tone: 'muted' };
}

export function getContradictionConfidenceMeta(divergenceScore: number): TrustMeta {
    if (divergenceScore >= 0.75) return { label: 'Stronger mismatch', tone: 'primary' };
    if (divergenceScore >= 0.5) return { label: 'Clear mismatch', tone: 'default' };
    return { label: 'Early mismatch', tone: 'muted' };
}
