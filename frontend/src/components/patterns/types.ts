export type SupportAnchorType = 'person' | 'place' | 'routine' | 'group';
export type SupportAnchorValence = 'supportive' | 'mixed' | 'stressful';
export type SupportAnchorSource = 'inferred' | 'pinned' | 'blended';

export type SupportAnchorEvidence = {
    entryId: string;
    title: string | null;
    createdAt: string;
    excerpt: string;
    reason: string;
    valence: SupportAnchorValence;
};

export type SupportAnchorOutcomeMemory = {
    helpedCount: number;
    stillNeedCount: number;
    lastOutcome: 'helped' | 'still_need_support' | null;
    lastRecordedAt: string | null;
};

export type SupportAnchor = {
    id: string;
    label: string;
    type: SupportAnchorType;
    source: SupportAnchorSource;
    strength: number;
    supportCount: number;
    tensionCount: number;
    lastSeen: string;
    whyItHelps: string;
    reconnectSuggestion: string;
    messageStarter: string | null;
    relationship?: string | null;
    preferredChannel?: 'text' | 'call' | 'in_person' | null;
    outcomeMemory?: SupportAnchorOutcomeMemory | null;
    groundingEntryIds: string[];
    evidence: SupportAnchorEvidence[];
};

export type SupportMapResponse = {
    summary: string;
    anchors: SupportAnchor[];
    basedOnEntries: number;
    generatedAt: string;
};
