import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';

export type SupportAnchorType = 'person' | 'place' | 'routine' | 'group';
export type SupportAnchorValence = 'supportive' | 'mixed' | 'stressful';
export type SupportAnchorSource = 'inferred' | 'pinned' | 'blended';
export type TrustedContactChannel = 'text' | 'call' | 'in_person';
export type SafetyRegion = 'auto' | 'us' | 'intl';

export type TrustedContact = {
    id: string;
    name: string;
    relationship?: string;
    channel: TrustedContactChannel;
    note?: string;
    phoneNumber?: string;
    emailAddress?: string;
    isPrimary?: boolean;
};

export type SupportContactOutcome = {
    id: string;
    contactId?: string;
    contactName: string;
    outcome: 'helped' | 'still_need_support';
    source: 'bridge' | 'safety';
    surface: 'dashboard' | 'guide' | 'entry' | 'safety';
    actionKind?: 'copy' | 'text' | 'call' | 'email' | 'manual';
    channel?: TrustedContactChannel;
    riskLevel?: 'none' | 'yellow' | 'orange' | 'red';
    entryId?: string;
    recordedAt: string;
};

export type SupportPreferences = {
    pinnedPeople: string[];
    groundingRoutines: string[];
    trustedContacts: TrustedContact[];
    contactOutcomes: SupportContactOutcome[];
    safetyRegion: SafetyRegion;
    updatedAt?: string;
};

export type TrustedContactRecommendation = {
    primary: TrustedContact | null;
    backup: TrustedContact | null;
    primaryMemory: SupportAnchorOutcomeMemory | null;
    backupMemory: SupportAnchorOutcomeMemory | null;
    selectionReason: string | null;
    fallbackMode: 'none' | 'alternate_contact' | 'higher_support';
    fallbackReason: string | null;
};

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
    preferredChannel?: TrustedContactChannel | null;
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

export type EntrySupportSnapshot = {
    summary: string;
    primaryAnchor: {
        label: string;
        type: SupportAnchorType;
    } | null;
    supportivePeople: string[];
    supportivePlaces: string[];
    supportiveRoutines: string[];
    anchors: Array<{
        label: string;
        type: SupportAnchorType;
        valence: SupportAnchorValence;
        evidence: string;
    }>;
};

export type SupportEntryRecord = {
    id: string;
    title: string | null;
    content: string;
    mood: string | null;
    tags: string[];
    createdAt: Date;
    analysis: Prisma.JsonValue;
};

type SupportMatcher = {
    type: SupportAnchorType;
    label: string;
    patterns: RegExp[];
};

type DetectedAnchor = {
    label: string;
    type: SupportAnchorType;
    valence: SupportAnchorValence;
    evidence: string;
};

type AggregateAnchor = {
    id: string;
    label: string;
    type: SupportAnchorType;
    supportCount: number;
    mixedCount: number;
    tensionCount: number;
    lastSeen: Date;
    evidence: Array<SupportAnchorEvidence & { createdAtDate: Date }>;
};

type SupportMapOptions = {
    period?: 'week' | 'month' | 'year';
    take?: number;
};

const SUPPORT_MATCHERS: SupportMatcher[] = [
    { type: 'person', label: 'Mom', patterns: [/\bmom\b/i, /\bmother\b/i] },
    { type: 'person', label: 'Dad', patterns: [/\bdad\b/i, /\bfather\b/i] },
    { type: 'person', label: 'Parent', patterns: [/\bparents?\b/i] },
    { type: 'person', label: 'Sibling', patterns: [/\bsister\b/i, /\bbrother\b/i, /\bsibling\b/i] },
    { type: 'person', label: 'Grandparent', patterns: [/\bgrandma\b/i, /\bgrandpa\b/i, /\bgrandmother\b/i, /\bgrandfather\b/i] },
    { type: 'person', label: 'Teacher', patterns: [/\bteacher\b/i, /\bprofessor\b/i] },
    { type: 'person', label: 'Counselor', patterns: [/\bcounselor\b/i, /\bguidance counselor\b/i, /\badvisor\b/i] },
    { type: 'person', label: 'Coach', patterns: [/\bcoach\b/i] },
    { type: 'person', label: 'Friend', patterns: [/\bfriend\b/i, /\bbest friend\b/i] },
    { type: 'person', label: 'Mentor', patterns: [/\bmentor\b/i] },
    { type: 'person', label: 'Aunt or Uncle', patterns: [/\baunt\b/i, /\buncle\b/i] },
    { type: 'group', label: 'Team', patterns: [/\bteam\b/i, /\bpractice squad\b/i] },
    { type: 'group', label: 'Club', patterns: [/\bclub\b/i, /\bstudent council\b/i, /\byouth group\b/i] },
    { type: 'group', label: 'Robotics', patterns: [/\brobotics\b/i] },
    { type: 'group', label: 'Band or Choir', patterns: [/\bband\b/i, /\bchoir\b/i, /\borchestra\b/i] },
    { type: 'place', label: 'School', patterns: [/\bschool\b/i, /\bcampus\b/i] },
    { type: 'place', label: 'Library', patterns: [/\blibrary\b/i] },
    { type: 'place', label: 'Home', patterns: [/\bhome\b/i, /\bmy room\b/i, /\broom\b/i] },
    { type: 'place', label: 'Gym', patterns: [/\bgym\b/i] },
    { type: 'place', label: 'Park', patterns: [/\bpark\b/i] },
    { type: 'place', label: 'Class', patterns: [/\bclass\b/i, /\bclassroom\b/i] },
    { type: 'routine', label: 'Walking', patterns: [/\bwalk(?:ed|ing)?\b/i] },
    { type: 'routine', label: 'Music', patterns: [/\bmusic\b/i, /\bplaylist\b/i, /\bsong\b/i] },
    { type: 'routine', label: 'Journaling', patterns: [/\bjournal(?:ed|ing)?\b/i, /\bwriting\b/i] },
    { type: 'routine', label: 'Sleep', patterns: [/\bsleep\b/i, /\bnap\b/i, /\brest\b/i] },
    { type: 'routine', label: 'Prayer', patterns: [/\bpray(?:er|ing)?\b/i] },
    { type: 'routine', label: 'Breathing', patterns: [/\bbreath(?:e|ing)?\b/i] },
    { type: 'routine', label: 'Exercise', patterns: [/\bexercise\b/i, /\bworkout\b/i, /\brun(?:ning)?\b/i, /\bstretch(?:ing)?\b/i] },
    { type: 'routine', label: 'Study Sprint', patterns: [/\bpomodoro\b/i, /\bstudy\b/i, /\btimer\b/i] },
];

const POSITIVE_SIGNAL = /\b(help(?:ed|ful)?|stead(?:y|ier)|calm(?:er)?|safe|supported|lighter|better|focus(?:ed)?|ground(?:ed)?|listened|understood|checked in|talked to|texted|called|met with|felt okay|felt better|easier|relief)\b/i;
const NEGATIVE_SIGNAL = /\b(fight|argu(?:e|ed)|drama|bully(?:ing)?|ignored|unsafe|scared|pressure|stress(?:ed)?|mad|upset|tense|harder|worse|yelled|conflict)\b/i;
const POSITIVE_CONTACT = /\b(talked to|texted|called|met with|sat with|spent time with|went with)\b/i;

const GENERIC_REACH_LABELS = new Set([
    'a trusted adult right now',
    'teacher, counselor, or coach',
    'a calm, trusted person',
    'counselor, mentor, or trusted adult',
    'a trusted adult today',
    'one person who feels steady',
]);

const PERSONISH_TYPES = new Set<SupportAnchorType>(['person', 'group']);

const clip = (value: string, maxLength: number) => {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

const normalizePhoneNumber = (value: unknown) => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';

    const normalized = trimmed.replace(/[^\d+]/g, '');
    const plusPrefixed = normalized.startsWith('+');
    const digits = normalized.replace(/\D/g, '');
    if ((plusPrefixed && digits.length < 8) || (!plusPrefixed && digits.length < 7)) {
        return '';
    }

    return plusPrefixed ? `+${digits}` : digits;
};

const normalizeEmailAddress = (value: unknown) => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return '';
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : '';
};

const normalizeSupportOutcome = (value: unknown, index: number): SupportContactOutcome | null => {
    if (!isJsonObject(value)) return null;

    const contactName = clip(String(value.contactName || ''), 80);
    if (!contactName) return null;

    const outcome = value.outcome === 'helped' ? 'helped' : value.outcome === 'still_need_support' ? 'still_need_support' : null;
    const source = value.source === 'safety' ? 'safety' : value.source === 'bridge' ? 'bridge' : null;
    const surface = value.surface === 'dashboard' || value.surface === 'guide' || value.surface === 'entry' || value.surface === 'safety'
        ? value.surface
        : null;
    const recordedAt = typeof value.recordedAt === 'string' ? value.recordedAt : null;

    if (!outcome || !source || !surface || !recordedAt) return null;

    return {
        id: clip(String(value.id || `support-outcome-${index}`), 80),
        contactId: typeof value.contactId === 'string' && value.contactId.trim().length > 0 ? clip(value.contactId, 80) : undefined,
        contactName,
        outcome,
        source,
        surface,
        actionKind: value.actionKind === 'copy' || value.actionKind === 'text' || value.actionKind === 'call' || value.actionKind === 'email' || value.actionKind === 'manual'
            ? value.actionKind
            : undefined,
        channel: value.channel === 'call' || value.channel === 'in_person' || value.channel === 'text'
            ? value.channel
            : undefined,
        riskLevel: value.riskLevel === 'none' || value.riskLevel === 'yellow' || value.riskLevel === 'orange' || value.riskLevel === 'red'
            ? value.riskLevel
            : undefined,
        entryId: typeof value.entryId === 'string' && value.entryId.trim().length > 0 ? clip(value.entryId, 80) : undefined,
        recordedAt,
    };
};

const formatDate = (value: Date) =>
    value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object' && !Array.isArray(value);

const getNestedRecord = (value: unknown, key: string): Record<string, unknown> => {
    if (!isJsonObject(value)) return {};
    return isJsonObject(value[key]) ? (value[key] as Record<string, unknown>) : {};
};

const uniqueStrings = (values: Array<string | null | undefined>, limit = values.length) => {
    const seen = new Set<string>();
    const result: string[] = [];

    values.forEach((value) => {
        const normalized = String(value || '').replace(/\s+/g, ' ').trim();
        if (!normalized) return;
        const key = normalized.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        result.push(normalized);
    });

    return result.slice(0, limit);
};

const splitSentences = (text: string): string[] =>
    String(text || '')
        .replace(/\s+/g, ' ')
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean);

const inferValence = (sentence: string, type: SupportAnchorType): SupportAnchorValence => {
    const positiveHits = (sentence.match(new RegExp(POSITIVE_SIGNAL.source, 'gi')) || []).length
        + (PERSONISH_TYPES.has(type) && POSITIVE_CONTACT.test(sentence) ? 1 : 0);
    const negativeHits = (sentence.match(new RegExp(NEGATIVE_SIGNAL.source, 'gi')) || []).length;

    if (positiveHits > negativeHits) return 'supportive';
    if (negativeHits > positiveHits) return 'stressful';
    return type === 'routine' ? 'supportive' : 'mixed';
};

const normalizeAnchorId = (type: SupportAnchorType, label: string) =>
    `${type}:${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;

const addDetectedAnchor = (
    target: Map<string, DetectedAnchor>,
    input: { label: string; type: SupportAnchorType; evidence: string; valence: SupportAnchorValence }
) => {
    const key = normalizeAnchorId(input.type, input.label);
    const existing = target.get(key);
    const currentWeight = existing?.valence === 'supportive' ? 3 : existing?.valence === 'mixed' ? 2 : 1;
    const nextWeight = input.valence === 'supportive' ? 3 : input.valence === 'mixed' ? 2 : 1;

    if (!existing || nextWeight > currentWeight) {
        target.set(key, {
            label: input.label,
            type: input.type,
            evidence: clip(input.evidence, 180),
            valence: input.valence,
        });
    }
};

const detectAnchorsFromText = (text: string): DetectedAnchor[] => {
    const detected = new Map<string, DetectedAnchor>();

    splitSentences(text).forEach((sentence) => {
        SUPPORT_MATCHERS.forEach((matcher) => {
            if (!matcher.patterns.some((pattern) => pattern.test(sentence))) return;
            addDetectedAnchor(detected, {
                label: matcher.label,
                type: matcher.type,
                evidence: sentence,
                valence: inferValence(sentence, matcher.type),
            });
        });
    });

    return [...detected.values()];
};

const detectAnchorsFromActionAnalysis = (analysis: unknown): DetectedAnchor[] => {
    const detected = new Map<string, DetectedAnchor>();
    const actionRecord = getNestedRecord(analysis, 'action');
    const supportRecord = getNestedRecord(analysis, 'support');
    const reachOut = getNestedRecord(actionRecord, 'reachOut');
    const reachLabel = String(reachOut.label || '').trim();

    if (reachLabel && !GENERIC_REACH_LABELS.has(reachLabel.toLowerCase())) {
        addDetectedAnchor(detected, {
            label: reachLabel,
            type: 'person',
            evidence: String(reachOut.rationale || `This note points toward ${reachLabel}.`),
            valence: 'supportive',
        });
    }

    const supportivePeople = Array.isArray(supportRecord.supportivePeople) ? supportRecord.supportivePeople : [];
    supportivePeople.forEach((label) => {
        if (typeof label !== 'string') return;
        addDetectedAnchor(detected, {
            label: clip(label, 60),
            type: 'person',
            evidence: `This note pointed back to ${label}.`,
            valence: 'supportive',
        });
    });

    const supportivePlaces = Array.isArray(supportRecord.supportivePlaces) ? supportRecord.supportivePlaces : [];
    supportivePlaces.forEach((label) => {
        if (typeof label !== 'string') return;
        addDetectedAnchor(detected, {
            label: clip(label, 60),
            type: 'place',
            evidence: `This note sounded steadier around ${label}.`,
            valence: 'supportive',
        });
    });

    const supportiveRoutines = Array.isArray(supportRecord.supportiveRoutines) ? supportRecord.supportiveRoutines : [];
    supportiveRoutines.forEach((label) => {
        if (typeof label !== 'string') return;
        addDetectedAnchor(detected, {
            label: clip(label, 60),
            type: 'routine',
            evidence: `This note linked relief to ${label}.`,
            valence: 'supportive',
        });
    });

    return [...detected.values()];
};

const buildSnapshotSummary = (primaryAnchor: EntrySupportSnapshot['primaryAnchor'], supportiveCount: number) => {
    if (!primaryAnchor) {
        return supportiveCount > 0
            ? 'This note includes a few possible support anchors.'
            : 'This note does not point to a clear support anchor yet.';
    }

    if (primaryAnchor.type === 'routine') {
        return `${primaryAnchor.label} looks like a steadying routine in this note.`;
    }

    return `${primaryAnchor.label} looks like someone or somewhere worth keeping visible.`;
};

const buildWhyItHelps = (anchor: AggregateAnchor) => {
    if (anchor.evidence.length === 0) {
        return `${anchor.label} keeps showing up as a possible support anchor.`;
    }

    if (anchor.type === 'routine') {
        return anchor.supportCount > anchor.tensionCount
            ? `${anchor.label} usually shows up in notes where you sound steadier afterward.`
            : `${anchor.label} keeps returning, but the notes around it are mixed.`;
    }

    if (anchor.type === 'place') {
        return anchor.supportCount > anchor.tensionCount
            ? `${anchor.label} often appears in notes that sound calmer or more focused.`
            : `${anchor.label} keeps appearing, but the support signal is still mixed.`;
    }

    return anchor.supportCount > anchor.tensionCount
        ? `${anchor.label} shows up when another person or group seems to help carry the weight.`
        : `${anchor.label} appears often enough to watch, but the signal is still mixed.`;
};

const buildReconnectSuggestion = (anchor: AggregateAnchor) => {
    if (anchor.type === 'routine') {
        return `Repeat the smallest version of ${anchor.label.toLowerCase()} today.`;
    }
    if (anchor.type === 'place') {
        return `Revisit ${anchor.label.toLowerCase()} for a short reset or focused block.`;
    }
    if (anchor.type === 'group') {
        return `Reconnect with ${anchor.label.toLowerCase()} for one short check-in instead of carrying this alone.`;
    }
    return `Reach out to ${anchor.label.toLowerCase()} for a short check-in before the pressure grows.`;
};

const buildMessageStarter = (anchor: AggregateAnchor) => {
    if (!PERSONISH_TYPES.has(anchor.type)) return null;
    const lower = anchor.label.toLowerCase();

    if (lower.includes('teacher') || lower.includes('coach') || lower.includes('counselor')) {
        return `Could we talk for a few minutes? I have been feeling stuck and could use help making a plan.`;
    }

    if (lower.includes('mom') || lower.includes('dad') || lower.includes('parent') || lower.includes('grand')) {
        return 'Can we talk today? I have been carrying a lot and do not want to sit with it alone.';
    }

    return `Could we check in sometime today? I could use another person in this with me.`;
};

const buildSupportMapSummary = (anchors: SupportAnchor[]) => {
    if (anchors.length === 0) {
        return 'Support anchors will start appearing after a few notes show who or what helps you feel steadier.';
    }

    const top = anchors[0];
    const secondary = anchors.find((anchor) => anchor.id !== top.id);
    const topPhrase = top.source === 'pinned'
        ? `${top.label} is pinned to stay visible even when recent notes are thin`
        : `${top.label} looks strongest right now`;
    const topOutcomePhrase = top.outcomeMemory?.helpedCount
        ? ` and has already helped after ${top.outcomeMemory.helpedCount} reach-out${top.outcomeMemory.helpedCount === 1 ? '' : 's'}`
        : '';

    if (secondary) {
        return `${topPhrase}${topOutcomePhrase}, with ${secondary.label.toLowerCase()} also showing up as a steadying anchor.`;
    }

    return top.source === 'pinned'
        ? `${top.label} is pinned in Me as a support anchor${topOutcomePhrase}.`
        : `${top.label} is the clearest support anchor in your recent notes${topOutcomePhrase}.`;
};

const getPeriodStart = (period?: 'week' | 'month' | 'year') => {
    if (!period) return null;

    const now = new Date();
    const days = period === 'year' ? 365 : period === 'month' ? 31 : 7;
    return new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
};

class SupportMapService {
    private createEmptySupportPreferences(): SupportPreferences {
        return {
            pinnedPeople: [],
            groundingRoutines: [],
            trustedContacts: [],
            contactOutcomes: [],
            safetyRegion: 'auto',
        };
    }

    private getContactOutcomeStats(
        preferences: SupportPreferences | null | undefined,
        contact: TrustedContact
    ): { helpedCount: number; stillNeedCount: number; lastOutcome: SupportContactOutcome | null } {
        const outcomes = (preferences?.contactOutcomes || []).filter((outcome) =>
            (outcome.contactId && outcome.contactId === contact.id)
            || outcome.contactName.toLowerCase() === contact.name.toLowerCase()
        );

        return {
            helpedCount: outcomes.filter((outcome) => outcome.outcome === 'helped').length,
            stillNeedCount: outcomes.filter((outcome) => outcome.outcome === 'still_need_support').length,
            lastOutcome: outcomes[0] || null,
        };
    }

    getTrustedContactOutcomeMemory(
        preferences: SupportPreferences | null | undefined,
        contact: TrustedContact
    ): SupportAnchorOutcomeMemory | null {
        const stats = this.getContactOutcomeStats(preferences, contact);
        if (!stats.lastOutcome && stats.helpedCount === 0 && stats.stillNeedCount === 0) {
            return null;
        }

        return {
            helpedCount: stats.helpedCount,
            stillNeedCount: stats.stillNeedCount,
            lastOutcome: stats.lastOutcome?.outcome || null,
            lastRecordedAt: stats.lastOutcome?.recordedAt || null,
        };
    }

    describeTrustedContactMemory(
        preferences: SupportPreferences | null | undefined,
        contact: TrustedContact
    ): string | null {
        const memory = this.getTrustedContactOutcomeMemory(preferences, contact);
        if (!memory) return null;

        if (memory.helpedCount > 0 && memory.stillNeedCount > 0) {
            return `${contact.name} helped after ${memory.helpedCount} past reach-out${memory.helpedCount === 1 ? '' : 's'}, but you also needed backup support ${memory.stillNeedCount === 1 ? 'once' : `${memory.stillNeedCount} times`}.`;
        }

        if (memory.helpedCount > 0) {
            return `${contact.name} helped after ${memory.helpedCount} past reach-out${memory.helpedCount === 1 ? '' : 's'}.`;
        }

        if (memory.stillNeedCount > 0) {
            return `You reached out to ${contact.name} before, but still needed more support ${memory.stillNeedCount === 1 ? 'once' : `${memory.stillNeedCount} times`}, so keep backup support visible too.`;
        }

        return null;
    }

    private matchesScenario(contact: TrustedContact, scenario?: 'school' | 'conflict' | 'future' | 'energy' | 'general') {
        const descriptor = `${contact.relationship || ''} ${contact.name}`.trim();
        if (scenario === 'school') {
            return /\b(teacher|counselor|coach|advisor|mentor)\b/i.test(descriptor);
        }
        if (scenario === 'future') {
            return /\b(counselor|mentor|teacher|coach|advisor)\b/i.test(descriptor);
        }
        if (scenario === 'conflict') {
            return /\b(friend|parent|mom|dad|sibling|coach|mentor|counselor)\b/i.test(descriptor);
        }
        return false;
    }

    recommendTrustedContact(
        preferences: SupportPreferences | null | undefined,
        options?: {
            anchorLabel?: string | null;
            scenario?: 'school' | 'conflict' | 'future' | 'energy' | 'general';
            riskLevel?: 'none' | 'yellow' | 'orange' | 'red';
        }
    ): TrustedContactRecommendation {
        const contacts = preferences?.trustedContacts || [];
        if (contacts.length === 0) {
            return {
                primary: null,
                backup: null,
                primaryMemory: null,
                backupMemory: null,
                selectionReason: null,
                fallbackMode: 'none',
                fallbackReason: null,
            };
        }

        const anchorLabel = String(options?.anchorLabel || '').trim().toLowerCase();
        const hasDirectMethod = (contact: TrustedContact) => Boolean(contact.phoneNumber || contact.emailAddress);
        const ranked = contacts
            .map((contact) => {
                const stats = this.getContactOutcomeStats(preferences, contact);
                let score = (contact.isPrimary ? 3 : 0)
                    + (hasDirectMethod(contact) ? 2 : 0)
                    + (stats.helpedCount * 2.2)
                    - (stats.stillNeedCount * 1.15)
                    + (stats.lastOutcome?.outcome === 'helped' ? 1.2 : stats.lastOutcome?.outcome === 'still_need_support' ? -1.4 : 0);

                if (anchorLabel && contact.name.toLowerCase() === anchorLabel) {
                    score += 4;
                }
                if (this.matchesScenario(contact, options?.scenario)) {
                    score += 2.2;
                }

                return {
                    contact,
                    score,
                    stats,
                    memory: this.getTrustedContactOutcomeMemory(preferences, contact),
                };
            })
            .sort((left, right) => right.score - left.score);

        const originalPrimary = ranked[0] || null;
        if (!originalPrimary) {
            return {
                primary: null,
                backup: null,
                primaryMemory: null,
                backupMemory: null,
                selectionReason: null,
                fallbackMode: 'none',
                fallbackReason: null,
            };
        }

        const riskLevel = options?.riskLevel || 'none';
        const repeatedStillNeed = originalPrimary.stats.stillNeedCount >= 2
            && originalPrimary.stats.stillNeedCount >= originalPrimary.stats.helpedCount + 1;
        const urgentMismatch = (riskLevel === 'orange' || riskLevel === 'red')
            && originalPrimary.stats.stillNeedCount > originalPrimary.stats.helpedCount;

        let primary = originalPrimary;
        let selectionReason: string | null = null;
        let backupPool = ranked.slice(1);

        if ((repeatedStillNeed || urgentMismatch) && backupPool[0]) {
            primary = backupPool[0];
            backupPool = backupPool.slice(1);
            selectionReason = `Recent reach-outs to ${originalPrimary.contact.name} still left you needing more support, so ${primary.contact.name} is being moved up sooner.`;
        }

        const backup = backupPool.find((candidate) =>
            candidate.stats.helpedCount > 0 || candidate.stats.stillNeedCount <= candidate.stats.helpedCount
        ) || null;

        let fallbackMode: TrustedContactRecommendation['fallbackMode'] = 'none';
        let fallbackReason: string | null = null;

        if (primary.stats.stillNeedCount > 0 && backup) {
            fallbackMode = 'alternate_contact';
            fallbackReason = `If ${primary.contact.name} does not answer or it still feels heavy, try ${backup.contact.name} next instead of carrying it alone.`;
        } else if ((repeatedStillNeed || urgentMismatch) && !backup) {
            fallbackMode = 'higher_support';
            fallbackReason = riskLevel === 'orange' || riskLevel === 'red'
                ? 'Recent reach-outs here still left you needing more support. If this still feels unsafe or too heavy, move straight to a counselor, caregiver, crisis line, or emergency help.'
                : 'Recent reach-outs here still left you needing more support. If this does not land, move up to a counselor, teacher, coach, or another adult instead of retrying the same loop.';
        }

        return {
            primary: primary.contact,
            backup: fallbackMode === 'alternate_contact' ? backup?.contact || null : null,
            primaryMemory: primary.memory,
            backupMemory: fallbackMode === 'alternate_contact' ? backup?.memory || null : null,
            selectionReason,
            fallbackMode,
            fallbackReason,
        };
    }

    extractSupportPreferences(signals: unknown): SupportPreferences | null {
        const supportPreferences = getNestedRecord(signals, 'supportPreferences');
        const pinnedPeople = uniqueStrings(
            Array.isArray(supportPreferences.pinnedPeople)
                ? supportPreferences.pinnedPeople.filter((item): item is string => typeof item === 'string')
                : [],
            6
        ).map((item) => clip(item, 60));
        const groundingRoutines = uniqueStrings(
            Array.isArray(supportPreferences.groundingRoutines)
                ? supportPreferences.groundingRoutines.filter((item): item is string => typeof item === 'string')
                : [],
            6
        ).map((item) => clip(item, 60));
        const trustedContacts = (Array.isArray(supportPreferences.trustedContacts)
            ? supportPreferences.trustedContacts.reduce<TrustedContact[]>((acc, item, index) => {
                if (!isJsonObject(item) || acc.length >= 4) return acc;

                const name = clip(String(item.name || ''), 60);
                if (!name) return acc;

                const relationship = clip(String(item.relationship || ''), 40);
                const note = clip(String(item.note || ''), 160);
                const phoneNumber = normalizePhoneNumber(item.phoneNumber);
                const emailAddress = normalizeEmailAddress(item.emailAddress);
                const channel: TrustedContactChannel = item.channel === 'call' || item.channel === 'in_person'
                    ? item.channel
                    : 'text';

                acc.push({
                    id: clip(String(item.id || `contact-${index}`), 80),
                    name,
                    channel,
                    relationship: relationship || undefined,
                    note: note || undefined,
                    phoneNumber: phoneNumber || undefined,
                    emailAddress: emailAddress || undefined,
                    isPrimary: Boolean(item.isPrimary),
                });
                return acc;
            }, [])
            : []);
        const contactOutcomes = (Array.isArray(supportPreferences.contactOutcomes)
            ? supportPreferences.contactOutcomes
                .map((item, index) => normalizeSupportOutcome(item, index))
                .filter((item): item is SupportContactOutcome => Boolean(item))
                .sort((left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime())
                .slice(0, 24)
            : []);
        const safetyRegion: SafetyRegion = supportPreferences.safetyRegion === 'us' || supportPreferences.safetyRegion === 'intl'
            ? supportPreferences.safetyRegion
            : 'auto';
        const updatedAt = typeof supportPreferences.updatedAt === 'string' ? supportPreferences.updatedAt : undefined;

        if (pinnedPeople.length === 0 && groundingRoutines.length === 0 && trustedContacts.length === 0 && contactOutcomes.length === 0 && safetyRegion === 'auto') {
            return null;
        }

        return {
            pinnedPeople,
            groundingRoutines,
            trustedContacts,
            contactOutcomes,
            safetyRegion,
            ...(updatedAt ? { updatedAt } : {}),
        };
    }

    async getSupportPreferencesForUser(userId: string): Promise<SupportPreferences | null> {
        const profile = await prisma.userProfile.findUnique({
            where: { userId },
            select: {
                personalizationSignals: true,
                location: true,
            },
        });

        return this.extractSupportPreferences(profile?.personalizationSignals);
    }

    async getSupportProfileForUser(userId: string): Promise<{ preferences: SupportPreferences | null; location: string | null }> {
        const profile = await prisma.userProfile.findUnique({
            where: { userId },
            select: {
                personalizationSignals: true,
                location: true,
            },
        });

        return {
            preferences: this.extractSupportPreferences(profile?.personalizationSignals),
            location: profile?.location || null,
        };
    }

    async recordContactOutcome(input: {
        userId: string;
        contactId?: string | null;
        contactName: string;
        outcome: 'helped' | 'still_need_support';
        source: 'bridge' | 'safety';
        surface: 'dashboard' | 'guide' | 'entry' | 'safety';
        actionKind?: 'copy' | 'text' | 'call' | 'email' | 'manual';
        channel?: TrustedContactChannel | null;
        riskLevel?: 'none' | 'yellow' | 'orange' | 'red';
        entryId?: string | null;
    }): Promise<{ outcome: SupportContactOutcome; preferences: SupportPreferences }> {
        const existingProfile = await prisma.userProfile.findUnique({
            where: { userId: input.userId },
            select: {
                personalizationSignals: true,
            },
        });

        const baseSignals = isJsonObject(existingProfile?.personalizationSignals)
            ? existingProfile?.personalizationSignals as Record<string, unknown>
            : {};
        const currentPreferences = this.extractSupportPreferences(existingProfile?.personalizationSignals) || this.createEmptySupportPreferences();
        const trustedContact = currentPreferences.trustedContacts.find((contact) =>
            (input.contactId && contact.id === input.contactId)
            || contact.name.toLowerCase() === input.contactName.toLowerCase()
        );
        const recordedAt = new Date().toISOString();
        const outcome: SupportContactOutcome = {
            id: `support-outcome-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
            contactId: trustedContact?.id || (input.contactId ? clip(input.contactId, 80) : undefined),
            contactName: trustedContact?.name || clip(input.contactName, 80),
            outcome: input.outcome,
            source: input.source,
            surface: input.surface,
            actionKind: input.actionKind,
            channel: trustedContact?.channel || input.channel || undefined,
            riskLevel: input.riskLevel,
            entryId: input.entryId ? clip(input.entryId, 80) : undefined,
            recordedAt,
        };

        const nextPreferences: SupportPreferences = {
            ...currentPreferences,
            updatedAt: recordedAt,
            contactOutcomes: [outcome, ...(currentPreferences.contactOutcomes || [])].slice(0, 24),
        };

        await prisma.user.update({
            where: { id: input.userId },
            data: {
                profile: {
                    upsert: {
                        create: {
                            personalizationSignals: {
                                ...baseSignals,
                                supportPreferences: nextPreferences,
                            } as Prisma.InputJsonValue,
                        },
                        update: {
                            personalizationSignals: {
                                ...baseSignals,
                                supportPreferences: nextPreferences,
                            } as Prisma.InputJsonValue,
                        },
                    },
                },
            },
        });

        return { outcome, preferences: nextPreferences };
    }

    selectTrustedContact(
        preferences: SupportPreferences | null | undefined,
        options?: {
            anchorLabel?: string | null;
            scenario?: 'school' | 'conflict' | 'future' | 'energy' | 'general';
            riskLevel?: 'none' | 'yellow' | 'orange' | 'red';
        }
    ): TrustedContact | null {
        return this.recommendTrustedContact(preferences, options).primary;
    }

    extractEntrySupportSnapshot(input: {
        title?: string | null;
        content: string;
        analysis?: unknown;
    }): EntrySupportSnapshot {
        const combined = new Map<string, DetectedAnchor>();
        detectAnchorsFromText([input.title, input.content].filter(Boolean).join('. ')).forEach((anchor) => {
            addDetectedAnchor(combined, anchor);
        });
        detectAnchorsFromActionAnalysis(input.analysis).forEach((anchor) => {
            addDetectedAnchor(combined, anchor);
        });

        const anchors = [...combined.values()];
        const supportivePeople = uniqueStrings(
            anchors
                .filter((anchor) => anchor.valence === 'supportive' && anchor.type === 'person')
                .map((anchor) => anchor.label),
            4
        );
        const supportivePlaces = uniqueStrings(
            anchors
                .filter((anchor) => anchor.valence === 'supportive' && anchor.type === 'place')
                .map((anchor) => anchor.label),
            4
        );
        const supportiveRoutines = uniqueStrings(
            anchors
                .filter((anchor) => anchor.valence === 'supportive' && anchor.type === 'routine')
                .map((anchor) => anchor.label),
            4
        );

        const primary = anchors.find((anchor) => anchor.valence === 'supportive')
            || anchors.find((anchor) => anchor.valence === 'mixed')
            || null;

        return {
            summary: buildSnapshotSummary(primary ? { label: primary.label, type: primary.type } : null, anchors.length),
            primaryAnchor: primary ? { label: primary.label, type: primary.type } : null,
            supportivePeople,
            supportivePlaces,
            supportiveRoutines,
            anchors: anchors.map((anchor) => ({
                label: anchor.label,
                type: anchor.type,
                valence: anchor.valence,
                evidence: anchor.evidence,
            })),
        };
    }

    private createPinnedAnchor(label: string, type: 'person' | 'routine', updatedAt?: string): SupportAnchor {
        const lastSeen = updatedAt
            ? `Pinned ${new Date(updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
            : 'Pinned in Me';
        const isRoutine = type === 'routine';

        return {
            id: normalizeAnchorId(type, label),
            label,
            type,
            source: 'pinned',
            strength: isRoutine ? 0.62 : 0.72,
            supportCount: 0,
            tensionCount: 0,
            lastSeen,
            whyItHelps: isRoutine
                ? `${label} is pinned as one of your steadying routines, so Notive can surface it when recent notes are thin.`
                : `${label} is pinned as someone you trust, so Notive can keep them visible instead of guessing.`,
            reconnectSuggestion: isRoutine
                ? `Try the smallest version of ${label.toLowerCase()} today.`
                : `If things feel heavy, use ${label.toLowerCase()} as one of your first check-in options.`,
            messageStarter: isRoutine ? null : 'Could we talk for a few minutes? I could use some support today.',
            relationship: null,
            preferredChannel: null,
            outcomeMemory: null,
            groundingEntryIds: [],
            evidence: [],
        };
    }

    private mergeSupportPreferences(map: SupportMapResponse, preferences?: SupportPreferences | null, maxAnchors = 8): SupportMapResponse {
        if (!preferences) {
            return map;
        }

        const anchorMap = new Map(map.anchors.map((anchor) => [normalizeAnchorId(anchor.type, anchor.label), { ...anchor }]));

        preferences.pinnedPeople.forEach((label) => {
            const key = normalizeAnchorId('person', label);
            const existing = anchorMap.get(key);
            if (existing) {
                anchorMap.set(key, {
                    ...existing,
                    source: existing.source === 'inferred' ? 'blended' : existing.source,
                    strength: Number(Math.min(0.99, existing.strength + 0.05).toFixed(2)),
                    whyItHelps: existing.source === 'inferred'
                        ? `${existing.whyItHelps} You also pinned ${label} in Me, so it stays visible when recent notes are light.`
                        : existing.whyItHelps,
                });
                return;
            }

            anchorMap.set(key, this.createPinnedAnchor(label, 'person', preferences.updatedAt));
        });

        preferences.trustedContacts.forEach((contact) => {
            const key = normalizeAnchorId('person', contact.name);
            const existing = anchorMap.get(key);
            const outcomeStats = this.getContactOutcomeStats(preferences, contact);
            const outcomeMemory = this.getTrustedContactOutcomeMemory(preferences, contact);
            const outcomeSummary = this.describeTrustedContactMemory(preferences, contact);
            const outcomeBoost = Math.min(0.08, outcomeStats.helpedCount * 0.02);
            const outcomeNote = outcomeSummary ? ` ${outcomeSummary}` : '';
            if (existing) {
                anchorMap.set(key, {
                    ...existing,
                    source: existing.source === 'inferred' ? 'blended' : existing.source,
                    strength: Number(Math.min(0.99, existing.strength + 0.07 + outcomeBoost).toFixed(2)),
                    whyItHelps: contact.note
                        ? `${existing.whyItHelps} You also saved ${contact.name} as a trusted contact: ${contact.note}.${outcomeNote}`
                        : `${existing.whyItHelps} You also saved ${contact.name} as a trusted contact.${outcomeNote}`,
                    messageStarter: existing.messageStarter || 'Could we talk for a few minutes? I could use some support today.',
                    relationship: contact.relationship || existing.relationship || null,
                    preferredChannel: contact.channel || existing.preferredChannel || null,
                    outcomeMemory,
                });
                return;
            }

            anchorMap.set(key, {
                ...this.createPinnedAnchor(contact.name, 'person', preferences.updatedAt),
                strength: Number(Math.min(0.99, (contact.isPrimary ? 0.82 : 0.76) + outcomeBoost).toFixed(2)),
                whyItHelps: contact.note
                    ? `${contact.name} is saved as a trusted contact. ${contact.note}${outcomeNote}`
                    : `${contact.name} is saved as a trusted contact, so Notive can surface them first when support is needed.${outcomeNote}`,
                reconnectSuggestion: `If things feel heavy, ${contact.channel === 'text' ? 'text' : contact.channel === 'call' ? 'call' : 'talk to'} ${contact.name.toLowerCase()} sooner instead of carrying this alone.`,
                relationship: contact.relationship || null,
                preferredChannel: contact.channel || null,
                outcomeMemory,
            });
        });

        preferences.groundingRoutines.forEach((label) => {
            const key = normalizeAnchorId('routine', label);
            const existing = anchorMap.get(key);
            if (existing) {
                anchorMap.set(key, {
                    ...existing,
                    source: existing.source === 'inferred' ? 'blended' : existing.source,
                    strength: Number(Math.min(0.98, existing.strength + 0.04).toFixed(2)),
                    whyItHelps: existing.source === 'inferred'
                        ? `${existing.whyItHelps} You also pinned ${label} in Me as a steadying routine.`
                        : existing.whyItHelps,
                });
                return;
            }

            anchorMap.set(key, this.createPinnedAnchor(label, 'routine', preferences.updatedAt));
        });

        const anchors = [...anchorMap.values()]
            .sort((left, right) => right.strength - left.strength || right.supportCount - left.supportCount)
            .slice(0, maxAnchors);

        return {
            ...map,
            anchors,
            summary: buildSupportMapSummary(anchors),
        };
    }

    buildSupportMapFromEntries(
        entries: SupportEntryRecord[],
        options?: { maxAnchors?: number; preferences?: SupportPreferences | null }
    ): SupportMapResponse {
        const aggregateMap = new Map<string, AggregateAnchor>();

        entries.forEach((entry) => {
            const snapshot = this.extractEntrySupportSnapshot({
                title: entry.title,
                content: entry.content,
                analysis: entry.analysis,
            });

            snapshot.anchors.forEach((anchor) => {
                const id = normalizeAnchorId(anchor.type, anchor.label);
                const existing = aggregateMap.get(id) || {
                    id,
                    label: anchor.label,
                    type: anchor.type,
                    supportCount: 0,
                    mixedCount: 0,
                    tensionCount: 0,
                    lastSeen: entry.createdAt,
                    evidence: [],
                };

                if (anchor.valence === 'supportive') existing.supportCount += 1;
                if (anchor.valence === 'mixed') existing.mixedCount += 1;
                if (anchor.valence === 'stressful') existing.tensionCount += 1;
                if (entry.createdAt > existing.lastSeen) existing.lastSeen = entry.createdAt;

                const reason = anchor.valence === 'supportive'
                    ? 'This note sounded steadier around this anchor.'
                    : anchor.valence === 'stressful'
                        ? 'This note showed tension around this anchor.'
                        : 'This anchor showed up in a mixed context.';

                existing.evidence.push({
                    entryId: entry.id,
                    title: entry.title,
                    createdAt: formatDate(entry.createdAt),
                    createdAtDate: entry.createdAt,
                    excerpt: clip(anchor.evidence || entry.content, 180),
                    reason,
                    valence: anchor.valence,
                });

                aggregateMap.set(id, existing);
            });
        });

        const anchors = [...aggregateMap.values()]
            .sort((left, right) => right.lastSeen.getTime() - left.lastSeen.getTime())
            .map((anchor) => {
                const rawStrength = (anchor.supportCount * 1.15) + (anchor.mixedCount * 0.35) - (anchor.tensionCount * 0.45);
                const strength = Number(Math.max(0.18, Math.min(0.97, rawStrength / Math.max(1.2, entries.length * 0.45))).toFixed(2));
                const evidence = anchor.evidence
                    .sort((left, right) => right.createdAtDate.getTime() - left.createdAtDate.getTime())
                    .slice(0, 3)
                    .map(({ createdAtDate, ...item }) => item);

                return {
                    id: anchor.id,
                    label: anchor.label,
                    type: anchor.type,
                    source: 'inferred',
                    strength,
                    supportCount: anchor.supportCount,
                    tensionCount: anchor.tensionCount,
                    lastSeen: formatDate(anchor.lastSeen),
                    whyItHelps: buildWhyItHelps(anchor),
                    reconnectSuggestion: buildReconnectSuggestion(anchor),
                    messageStarter: buildMessageStarter(anchor),
                    relationship: null,
                    preferredChannel: null,
                    outcomeMemory: null,
                    groundingEntryIds: uniqueStrings(evidence.map((item) => item.entryId), 3),
                    evidence,
                } satisfies SupportAnchor;
            })
            .filter((anchor) => anchor.supportCount > 0 || (anchor.supportCount === 0 && anchor.type === 'routine' && anchor.strength >= 0.28))
            .sort((left, right) => right.strength - left.strength || right.supportCount - left.supportCount)
            .slice(0, options?.maxAnchors || 8);

        return this.mergeSupportPreferences({
            summary: buildSupportMapSummary(anchors),
            anchors,
            basedOnEntries: entries.length,
            generatedAt: new Date().toISOString(),
        }, options?.preferences, options?.maxAnchors || 8);
    }

    selectBridgeAnchor(map: SupportMapResponse): SupportAnchor | null {
        return map.anchors.find((anchor) =>
            PERSONISH_TYPES.has(anchor.type)
            && anchor.source !== 'pinned'
            && anchor.supportCount > 0
            && anchor.supportCount >= anchor.tensionCount
        )
            || map.anchors.find((anchor) => PERSONISH_TYPES.has(anchor.type) && anchor.source === 'blended')
            || map.anchors.find((anchor) => PERSONISH_TYPES.has(anchor.type) && anchor.source === 'pinned')
            || map.anchors.find((anchor) => anchor.type === 'place')
            || null;
    }

    async getSupportMap(userId: string, options?: SupportMapOptions): Promise<SupportMapResponse> {
        const take = Math.max(8, Math.min(options?.take || 30, 60));
        const periodStart = getPeriodStart(options?.period);

        const [entries, preferences] = await Promise.all([
            prisma.entry.findMany({
                where: {
                    userId,
                    deletedAt: null,
                    ...(periodStart ? {
                        createdAt: {
                            gte: periodStart,
                        },
                    } : {}),
                },
                orderBy: {
                    createdAt: 'desc',
                },
                take,
                select: {
                    id: true,
                    title: true,
                    content: true,
                    mood: true,
                    tags: true,
                    createdAt: true,
                    analysis: true,
                },
            }),
            this.getSupportPreferencesForUser(userId),
        ]);

        return this.buildSupportMapFromEntries(entries, {
            maxAnchors: options?.period === 'week' ? 6 : 8,
            preferences,
        });
    }
}

export default new SupportMapService();
