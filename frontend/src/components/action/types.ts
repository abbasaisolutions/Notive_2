export type StudentRiskLevel = 'none' | 'yellow' | 'orange' | 'red';
export type StudentRiskMode = 'normal' | 'supportive' | 'elevated' | 'emergency';

export type StudentRisk = {
    level: StudentRiskLevel;
    mode: StudentRiskMode;
    signals: string[];
    generatedAt: string;
};

export type StudentSafetyCard = {
    headline: string;
    body: string;
    primaryActionLabel: string;
    primaryActionHref: string;
    secondaryActionLabel?: string;
    secondaryActionHref?: string;
    draftMessage?: string;
    tone: 'supportive' | 'urgent';
    resourceRegion: 'us' | 'intl';
    trustedContactId?: string;
    trustedContactName?: string;
    trustedContactChannel?: 'text' | 'call' | 'in_person';
    contactActions?: StudentContactAction[];
};

export type StudentContactAction = {
    label: string;
    href: string;
    kind: 'text' | 'call' | 'email';
};

export type StudentSupportMemory = {
    helpedCount: number;
    stillNeedCount: number;
    lastOutcome: 'helped' | 'still_need_support' | null;
    lastRecordedAt: string | null;
    summary: string;
};

export type StudentFallbackSupport = {
    mode: 'alternate_contact' | 'higher_support';
    contactId?: string | null;
    label: string;
    rationale: string;
    relationship?: string | null;
    channel?: 'text' | 'call' | 'in_person' | null;
    channelLabel?: string | null;
    contactActions?: StudentContactAction[];
    draftStarter?: string | null;
    supportMemory?: StudentSupportMemory | null;
};

export type StudentActionHighlight = {
    id: string;
    title: string | null;
    createdAt: string;
    mood: string | null;
    reason: string;
    excerpt: string;
};

export type StudentActionBrief = {
    headline: string;
    pattern: string;
    whatHelpedBefore: {
        summary: string;
        entryId: string | null;
        title: string | null;
        reason: string;
    } | null;
    nextMove: {
        label: string;
        description: string;
        effort: 'low' | 'medium';
        type: 'reflect' | 'routine' | 'school' | 'reach_out';
    } | null;
    reachOut: {
        contactId?: string | null;
        label: string;
        rationale: string;
        draftStarter: string | null;
        relationship?: string | null;
        channel?: 'text' | 'call' | 'in_person' | null;
        channelLabel?: string | null;
        contactActions?: StudentContactAction[];
        supportMemory?: StudentSupportMemory | null;
        fallbackSupport?: StudentFallbackSupport | null;
    } | null;
    keep: {
        label: string;
        evidence: string;
    } | null;
    followUpPrompt: string;
    confidence: number;
    groundingEntryIds: string[];
    createdAt: string;
};

export type StudentBridgeDraft = {
    contactId?: string | null;
    recommendedRecipient: string;
    relationship?: string | null;
    channel?: 'text' | 'call' | 'in_person' | null;
    channelLabel?: string | null;
    contactActions?: StudentContactAction[];
    supportMemory?: StudentSupportMemory | null;
    fallbackSupport?: StudentFallbackSupport | null;
    whyNow: string;
    messageDraft: string;
    talkTrack: string[];
    evidenceSummary: string;
    groundingEntryIds: string[];
};

export type StudentActionStarter = {
    headline: string;
    description: string;
    prompt: string;
};

export type StudentActionResponse = {
    brief: StudentActionBrief | null;
    bridge: StudentBridgeDraft | null;
    risk: StudentRisk;
    safetyCard: StudentSafetyCard | null;
    highlights: StudentActionHighlight[];
    starter: StudentActionStarter | null;
    source: 'starter' | 'recent_entry' | 'preview';
};
