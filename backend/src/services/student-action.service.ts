import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import analysisMemoryService from './analysis-memory.service';
import { executeHybridSearch, type HybridSearchResult } from './hybrid-search.service';
import nlpService from './nlp.service';
import supportMapService, {
    type EntrySupportSnapshot,
    type SupportAnchor,
    type SupportPreferences,
    type TrustedContact,
    type TrustedContactRecommendation,
    type TrustedContactChannel,
} from './support-map.service';
import studentSafetyService, {
    type StudentRisk,
    type StudentSafetyCard,
} from './student-safety.service';

type ActionQueryMode = 'today' | 'preview';
type ActionScenario = 'school' | 'conflict' | 'future' | 'energy' | 'general';

type ActionEntryRecord = {
    id: string;
    title: string | null;
    content: string;
    mood: string | null;
    tags: string[];
    skills: string[];
    lessons: string[];
    reflection: string | null;
    createdAt: Date;
    analysis: Prisma.JsonValue;
    analysisRecord: {
        summary: string | null;
        topics: string[];
        keywords: string[];
        suggestedMood: string | null;
    } | null;
};

export type StudentActionHighlight = {
    id: string;
    title: string | null;
    createdAt: string;
    mood: string | null;
    reason: string;
    excerpt: string;
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
    channel?: TrustedContactChannel | null;
    channelLabel?: string | null;
    contactActions?: StudentContactAction[];
    draftStarter?: string | null;
    supportMemory?: StudentSupportMemory | null;
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
        channel?: TrustedContactChannel | null;
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
    channel?: TrustedContactChannel | null;
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

type BuildActionInput = {
    userId: string;
    content?: string | null;
    title?: string | null;
    entryId?: string | null;
    mode: ActionQueryMode;
};

const SCHOOL_PATTERN = /\b(class|school|teacher|counselor|exam|quiz|assignment|grade|study|studying|homework|deadline|project|semester|college app|application)\b/i;
const CONFLICT_PATTERN = /\b(friend|friendship|drama|fight|argument|bully|bullying|parent|mom|dad|family|coach|roommate|relationship)\b/i;
const FUTURE_PATTERN = /\b(future|college|career|major|resume|statement|interview|scholarship|path|direction)\b/i;
const ENERGY_PATTERN = /\b(tired|exhausted|drained|burned out|burnt out|stressed|overwhelmed|anxious|panic|low energy)\b/i;
const PERSONISH_SUPPORT_TYPES = new Set(['person', 'group']);

const clip = (value: string, maxLength: number) => {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

const takeFirstSentence = (value: string, maxLength = 180) => {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    const sentenceMatch = normalized.match(/.+?[.!?](?=\s|$)/);
    return clip(sentenceMatch?.[0] || normalized, maxLength);
};

const formatDate = (value: Date) =>
    value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object' && !Array.isArray(value);

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

const getChannelLabel = (channel?: TrustedContactChannel | null) =>
    channel === 'call' ? 'Call' : channel === 'in_person' ? 'In person' : channel === 'text' ? 'Text' : null;

const asSentence = (value: string | null | undefined) => {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
};

const joinSentences = (...parts: Array<string | null | undefined>) =>
    parts
        .map((part) => asSentence(part))
        .filter(Boolean)
        .join(' ');

const describeSupportMemory = (
    label: string,
    memory: {
        helpedCount: number;
        stillNeedCount: number;
        lastOutcome: 'helped' | 'still_need_support' | null;
        lastRecordedAt: string | null;
    }
): string => {
    if (memory.helpedCount > 0 && memory.stillNeedCount > 0) {
        return `${label} helped after ${memory.helpedCount} past reach-out${memory.helpedCount === 1 ? '' : 's'}, but you still needed backup support ${memory.stillNeedCount === 1 ? 'once' : `${memory.stillNeedCount} times`} too.`;
    }
    if (memory.helpedCount > 0) {
        return `${label} helped after ${memory.helpedCount} past reach-out${memory.helpedCount === 1 ? '' : 's'}.`;
    }
    if (memory.stillNeedCount > 0) {
        return `You reached out to ${label} before, but still needed more support ${memory.stillNeedCount === 1 ? 'once' : `${memory.stillNeedCount} times`}.`;
    }
    return `${label} is part of your support history.`;
};

const buildReachOutSupportMemory = (input: {
    label: string;
    trustedContact?: TrustedContact | null;
    supportAnchor?: SupportAnchor | null;
    supportPreferences?: SupportPreferences | null;
}): StudentSupportMemory | null => {
    if (input.trustedContact && input.supportPreferences) {
        const memory = supportMapService.getTrustedContactOutcomeMemory(input.supportPreferences, input.trustedContact);
        if (memory) {
            return {
                ...memory,
                summary: supportMapService.describeTrustedContactMemory(input.supportPreferences, input.trustedContact)
                    || describeSupportMemory(input.label, memory),
            };
        }
    }

    const anchorMemory = input.supportAnchor?.outcomeMemory;
    if (!anchorMemory) return null;

    return {
        ...anchorMemory,
        summary: describeSupportMemory(input.label, anchorMemory),
    };
};

const buildTrustedContactStarter = (
    contact: TrustedContact | null | undefined,
    scenario: ActionScenario,
    risk: StudentRisk
) => {
    if (!contact) return null;
    if (risk.level === 'red') {
        return 'I do not feel safe right now. Can you stay with me or help me get support right away?';
    }
    if (risk.level === 'orange') {
        return 'I am having a really hard time and could use support today. Can we check in?';
    }
    if (scenario === 'school') {
        return 'Could we check in today? I have been feeling behind and want help making a plan.';
    }
    if (scenario === 'future') {
        return 'Could we talk sometime soon? I have been overthinking my next path and could use help sorting it out.';
    }
    if (scenario === 'conflict') {
        return 'Could we check in today? Something has been sitting with me and I want to handle it calmly.';
    }
    return 'I have been carrying a lot lately. Could we check in soon?';
};

const buildFallbackSupport = (input: {
    scenario: ActionScenario;
    risk: StudentRisk;
    recommendation?: TrustedContactRecommendation | null;
}): StudentFallbackSupport | null => {
    const recommendation = input.recommendation;
    if (!recommendation || recommendation.fallbackMode === 'none') return null;

    if (recommendation.fallbackMode === 'alternate_contact' && recommendation.backup) {
        const backup = recommendation.backup;
        const draftStarter = buildTrustedContactStarter(backup, input.scenario, input.risk);
        const channel = backup.channel || null;
        const supportMemory = recommendation.backupMemory
            ? {
                ...recommendation.backupMemory,
                summary: describeSupportMemory(backup.name, recommendation.backupMemory),
            }
            : null;
        return {
            mode: 'alternate_contact',
            contactId: backup.id,
            label: backup.name,
            rationale: recommendation.fallbackReason || `If this still feels heavy, try ${backup.name} next instead of sitting with it alone.`,
            relationship: backup.relationship || null,
            channel,
            channelLabel: getChannelLabel(channel),
            contactActions: buildTrustedContactActions(backup, draftStarter || 'Could we check in soon?', channel),
            draftStarter,
            supportMemory,
        };
    }

    return {
        mode: 'higher_support',
        contactId: null,
        label: input.risk.level === 'orange' || input.risk.level === 'red'
            ? 'Move up to urgent support'
            : 'Move up to stronger support',
        rationale: recommendation.fallbackReason
            || (input.risk.level === 'orange' || input.risk.level === 'red'
                ? 'If this still feels unsafe or too heavy, skip another solo loop and move straight to a counselor, caregiver, crisis line, or emergency support.'
                : 'If this still feels heavy, move up to a counselor, teacher, coach, or another adult instead of retrying the same loop.'),
        relationship: null,
        channel: null,
        channelLabel: null,
        contactActions: [],
        draftStarter: null,
        supportMemory: null,
    };
};

const buildTrustedContactActions = (
    contact: TrustedContact | null | undefined,
    message: string,
    preferredChannel?: TrustedContactChannel | null
): StudentContactAction[] => {
    if (!contact) return [];

    const actions: StudentContactAction[] = [];
    const addAction = (action: StudentContactAction | null) => {
        if (!action) return;
        if (actions.some((existing) => existing.href === action.href || existing.label === action.label)) return;
        actions.push(action);
    };

    const encodedMessage = encodeURIComponent(message);
    const encodedSubject = encodeURIComponent(`Checking in from Notive`);

    const textAction = contact.phoneNumber
        ? {
            label: `Text ${contact.name}`,
            href: `sms:${contact.phoneNumber}?body=${encodedMessage}`,
            kind: 'text' as const,
        }
        : null;
    const callAction = contact.phoneNumber
        ? {
            label: `Call ${contact.name}`,
            href: `tel:${contact.phoneNumber}`,
            kind: 'call' as const,
        }
        : null;
    const emailAction = contact.emailAddress
        ? {
            label: `Email ${contact.name}`,
            href: `mailto:${contact.emailAddress}?subject=${encodedSubject}&body=${encodedMessage}`,
            kind: 'email' as const,
        }
        : null;

    if (preferredChannel === 'text') {
        addAction(textAction);
        addAction(callAction);
        addAction(emailAction);
    } else if (preferredChannel === 'call') {
        addAction(callAction);
        addAction(textAction);
        addAction(emailAction);
    } else if (preferredChannel === 'in_person') {
        addAction(emailAction);
        addAction(textAction);
        addAction(callAction);
    } else {
        addAction(textAction);
        addAction(callAction);
        addAction(emailAction);
    }

    return actions.slice(0, 2);
};

const normalizeConfidence = (value: number) =>
    Number(Math.max(0.24, Math.min(0.94, value)).toFixed(2));

const normalizeText = (value: unknown, maxLength = 240) => {
    if (typeof value !== 'string') return '';
    return clip(value, maxLength);
};

const fetchRecentEntries = (userId: string, take = 8) =>
    prisma.entry.findMany({
        where: {
            userId,
            deletedAt: null,
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
            skills: true,
            lessons: true,
            reflection: true,
            createdAt: true,
            analysis: true,
            analysisRecord: {
                select: {
                    summary: true,
                    topics: true,
                    keywords: true,
                    suggestedMood: true,
                },
            },
        },
    });

const parseScenario = (text: string): ActionScenario => {
    if (SCHOOL_PATTERN.test(text)) return 'school';
    if (CONFLICT_PATTERN.test(text)) return 'conflict';
    if (FUTURE_PATTERN.test(text)) return 'future';
    if (ENERGY_PATTERN.test(text)) return 'energy';
    return 'general';
};

const buildStarter = (): StudentActionStarter => ({
    headline: 'Start with one honest note.',
    description: 'Two to five minutes is enough. Once there is a little history, Notive can start showing patterns and useful next moves.',
    prompt: 'What felt heaviest, clearest, or most unfinished today?',
});

const getNestedRecord = (analysis: unknown, key: string): Record<string, unknown> => {
    if (!isJsonObject(analysis)) return {};
    const nested = analysis[key];
    return isJsonObject(nested) ? nested : {};
};

const summarizeHelpfulEntry = (entry: ActionEntryRecord | null) => {
    if (!entry) return '';

    const actionRecord = getNestedRecord(entry.analysis, 'action');
    if (isJsonObject(actionRecord.whatHelpedBefore) && typeof actionRecord.whatHelpedBefore.summary === 'string') {
        return clip(String(actionRecord.whatHelpedBefore.summary), 180);
    }
    if (isJsonObject(actionRecord.nextMove) && typeof actionRecord.nextMove.description === 'string') {
        return clip(String(actionRecord.nextMove.description), 180);
    }

    const opportunityRecord = getNestedRecord(entry.analysis, 'opportunity');
    const opportunityAction = normalizeText(opportunityRecord.action, 110);
    const opportunityOutcome = normalizeText(opportunityRecord.outcome, 80);
    if (opportunityAction) {
        return opportunityOutcome
            ? clip(`${opportunityAction} ${opportunityOutcome}`, 180)
            : opportunityAction;
    }

    if (entry.lessons[0]) return clip(`A lesson you kept from that moment: ${entry.lessons[0]}.`, 180);
    if (entry.reflection) return clip(entry.reflection, 180);
    return entry.analysisRecord?.summary
        ? clip(entry.analysisRecord.summary, 180)
        : takeFirstSentence(entry.content, 180);
};

const buildHighlights = (entries: ActionEntryRecord[], resultMap: Map<string, HybridSearchResult>): StudentActionHighlight[] =>
    entries.slice(0, 3).map((entry) => ({
        id: entry.id,
        title: entry.title,
        createdAt: formatDate(entry.createdAt),
        mood: entry.mood,
        reason: resultMap.get(entry.id)?.matchReasons?.[0] || entry.analysisRecord?.topics?.[0] || entry.tags[0] || 'Recent note',
        excerpt: entry.analysisRecord?.summary || takeFirstSentence(entry.content, 170),
    }));

const buildPatternLine = (input: {
    scenario: ActionScenario;
    dominantMood: string;
    topTopics: string[];
    risk: StudentRisk;
}) => {
    const topicText = input.topTopics.length > 0 ? ` around ${input.topTopics.slice(0, 2).join(' and ')}` : '';

    if (input.risk.level === 'red') return 'This looks like a safety-first moment, not something to solve with reflection alone.';
    if (input.risk.level === 'orange') return 'This looks heavier than a normal rough patch and may need real support, not just self-management.';

    switch (input.scenario) {
        case 'school':
            return `School pressure is crowding the whole picture again${topicText}.`;
        case 'conflict':
            return `A relationship thread is taking up a lot of room right now${topicText}.`;
        case 'future':
            return `Future pressure is showing up as uncertainty, not just a planning task${topicText}.`;
        case 'energy':
            return `This looks like stress mixed with low energy${topicText}.`;
        default:
            return `Your recent notes lean ${input.dominantMood || 'mixed'}${topicText}.`;
    }
};

const buildHeadline = (scenario: ActionScenario, risk: StudentRisk) => {
    if (risk.level === 'red') return 'Pause the usual reflection and get real help now.';
    if (risk.level === 'orange') return 'Start with support, not the whole problem.';
    if (scenario === 'school') return 'Make the school problem smaller than it feels.';
    if (scenario === 'conflict') return 'Give the conversation a slower first move.';
    if (scenario === 'future') return 'Treat this like a direction check, not a final verdict.';
    if (scenario === 'energy') return 'Start with the easiest steadying move, then decide what is next.';
    return 'This looks like a familiar pressure pattern.';
};

const buildNextMove = (
    scenario: ActionScenario,
    risk: StudentRisk,
    helpedSummary: string,
    steadyRoutineLabel?: string | null
): StudentActionBrief['nextMove'] => {
    if (risk.level === 'red') return null;
    if (risk.level === 'orange') {
        return {
            label: 'Talk to someone today',
            description: 'Choose one trusted adult, counselor, caregiver, or coach and let them know this feels hard to carry alone.',
            effort: 'low',
            type: 'reach_out',
        };
    }
    if (scenario === 'school') {
        return {
            label: 'Shrink the task',
            description: helpedSummary
                ? 'Repeat the easiest version of what helped before, then do one school step for 15 to 20 minutes.'
                : 'Pick one school step you can finish in 15 to 20 minutes, then stop and reassess.',
            effort: 'low',
            type: 'school',
        };
    }
    if (scenario === 'conflict') {
        return {
            label: 'Draft two calm lines',
            description: 'Write the first two calm lines you want to say before sending a message or starting the conversation.',
            effort: 'low',
            type: 'reach_out',
        };
    }
    if (scenario === 'future') {
        return {
            label: 'Name one next exposure',
            description: 'Pick one tiny future-facing step this week, like a question to ask, a person to talk to, or one path to read about.',
            effort: 'medium',
            type: 'reflect',
        };
    }
    if (scenario === 'energy') {
        return {
            label: 'Do a short reset',
            description: helpedSummary
                ? 'Repeat the easiest steadying move that worked before, then choose only one thing to finish or name.'
                : steadyRoutineLabel
                    ? `Start with a short round of ${steadyRoutineLabel.toLowerCase()}, then choose one thing to finish or one feeling to name.`
                    : 'Take a short reset, then choose one thing to finish or one feeling to name.',
            effort: 'low',
            type: 'routine',
        };
    }
    return {
        label: 'Write the next two sentences',
        description: 'Capture what happened and what you need next in two honest sentences before trying to solve everything.',
        effort: 'low',
        type: 'reflect',
    };
};

const buildReachOut = (
    scenario: ActionScenario,
    risk: StudentRisk,
    supportAnchor?: SupportAnchor | null,
    trustedContact?: TrustedContact | null,
    supportPreferences?: SupportPreferences | null,
    trustedRecommendation?: TrustedContactRecommendation | null
): StudentActionBrief['reachOut'] => {
    const personAnchor = supportAnchor && PERSONISH_SUPPORT_TYPES.has(supportAnchor.type)
        ? supportAnchor
        : null;
    const contactLabel = trustedContact?.name || personAnchor?.label || null;
    const relationship = trustedContact?.relationship || null;
    const channel = trustedContact?.channel || null;
    const channelLabel = getChannelLabel(channel);
    const supportMemory = buildReachOutSupportMemory({
        label: contactLabel || 'this person',
        trustedContact,
        supportAnchor,
        supportPreferences,
    });
    const trustedStarter = buildTrustedContactStarter(trustedContact, scenario, risk);
    const fallbackSupport = buildFallbackSupport({
        scenario,
        risk,
        recommendation: trustedRecommendation,
    });
    const trustedContext = trustedContact
        ? joinSentences(
            relationship
                ? `${relationship} ${trustedContact.isPrimary ? 'is your primary trusted contact' : 'is saved as a trusted contact'}`
                : trustedContact.isPrimary
                    ? `${trustedContact.name} is your primary trusted contact`
                    : `${trustedContact.name} is saved as a trusted contact`,
            trustedContact.note || null,
            supportPreferences ? supportMapService.describeTrustedContactMemory(supportPreferences, trustedContact) : null,
            trustedRecommendation?.selectionReason
        )
        : '';

    if (risk.level === 'red') {
        const draftStarter = trustedStarter || 'I do not feel safe being alone right now and I need help.';
        return {
            contactId: trustedContact?.id || null,
            label: contactLabel || 'A trusted adult right now',
            rationale: contactLabel
                ? joinSentences(trustedContext, 'This sounds like a moment to get human help immediately, not process it alone')
                : 'This sounds like a moment to get human help immediately, not process it alone.',
            draftStarter,
            relationship,
            channel,
            channelLabel,
            supportMemory,
            fallbackSupport,
            ...(trustedContact ? { contactActions: buildTrustedContactActions(trustedContact, draftStarter, channel) } : {}),
        };
    }
    if (trustedContact) {
        if (risk.level === 'orange') {
            const draftStarter = trustedStarter || 'I am having a hard time and do not think I should handle it alone. Can we talk today?';
            return {
                contactId: trustedContact.id,
                label: trustedContact.name,
                rationale: joinSentences(trustedContext, 'This looks heavier than a solo reflection problem'),
                draftStarter,
                relationship,
                channel,
                channelLabel,
                supportMemory,
                fallbackSupport,
                contactActions: buildTrustedContactActions(trustedContact, draftStarter, channel),
            };
        }

        if (scenario === 'school') {
            const draftStarter = trustedStarter || 'Could we talk for a few minutes? I have been feeling behind and want help making a plan.';
            return {
                contactId: trustedContact.id,
                label: trustedContact.name,
                rationale: joinSentences(trustedContext, 'A short school check-in can turn a vague spiral into one real plan'),
                draftStarter,
                relationship,
                channel,
                channelLabel,
                supportMemory,
                fallbackSupport,
                contactActions: buildTrustedContactActions(trustedContact, draftStarter, channel),
            };
        }

        if (scenario === 'future') {
            const draftStarter = trustedStarter || 'I have been overthinking my next path and could use a short conversation to sort it out.';
            return {
                contactId: trustedContact.id,
                label: trustedContact.name,
                rationale: joinSentences(trustedContext, 'A real conversation can turn future pressure into a smaller next step'),
                draftStarter,
                relationship,
                channel,
                channelLabel,
                supportMemory,
                fallbackSupport,
                contactActions: buildTrustedContactActions(trustedContact, draftStarter, channel),
            };
        }

        if (scenario === 'conflict') {
            const draftStarter = trustedStarter || 'Can we talk sometime today? Something has been sitting with me and I want to handle it calmly.';
            return {
                contactId: trustedContact.id,
                label: trustedContact.name,
                rationale: joinSentences(trustedContext, 'Outside perspective usually helps before the next message goes out'),
                draftStarter,
                relationship,
                channel,
                channelLabel,
                supportMemory,
                fallbackSupport,
                contactActions: buildTrustedContactActions(trustedContact, draftStarter, channel),
            };
        }

        const draftStarter = trustedStarter || 'Could we check in sometime today? I could use another person in this with me.';
        return {
            contactId: trustedContact.id,
            label: trustedContact.name,
            rationale: joinSentences(trustedContext, 'A quick check-in can help break the loop before it grows') || 'A quick check-in can help break the loop before it grows.',
            draftStarter,
            relationship,
            channel,
            channelLabel,
            supportMemory,
            fallbackSupport,
            contactActions: buildTrustedContactActions(trustedContact, draftStarter, channel),
        };
    }
    if (personAnchor) {
        return {
            contactId: null,
            label: personAnchor.label,
            rationale: risk.level === 'orange'
                ? `${personAnchor.whyItHelps} This looks heavier than a solo reflection problem.`
                : scenario === 'school'
                    ? `${personAnchor.label} already shows up as a support anchor when school pressure gets louder.`
                    : scenario === 'future'
                        ? `${personAnchor.whyItHelps} A real conversation can turn future pressure into a smaller next step.`
                        : scenario === 'conflict'
                            ? `${personAnchor.whyItHelps} Outside perspective usually helps before the next message goes out.`
                            : personAnchor.whyItHelps,
            draftStarter: personAnchor.messageStarter || (risk.level === 'orange'
                ? 'I am having a hard time and do not think I should handle it alone. Can we talk today?'
                : scenario === 'school'
                    ? 'Could we talk for a few minutes? I have been feeling behind and want help making a plan.'
                    : scenario === 'future'
                        ? 'I have been overthinking my next path and could use a short conversation to sort it out.'
                        : scenario === 'conflict'
                            ? 'Can we talk sometime today? Something has been sitting with me and I want to handle it calmly.'
                            : 'Could we check in sometime today? I could use another person in this with me.'),
            relationship: null,
            channel: null,
            channelLabel: null,
            supportMemory,
            fallbackSupport,
        };
    }
    if (scenario === 'school') {
        return {
            contactId: null,
            label: 'Teacher, counselor, or coach',
            rationale: 'A short check-in can turn a vague school spiral into one real plan.',
            draftStarter: 'Could we talk for a few minutes? I have been feeling behind and want help making a plan.',
            relationship: null,
            channel: null,
            channelLabel: null,
            supportMemory: null,
            fallbackSupport: null,
        };
    }
    if (scenario === 'conflict') {
        return {
            contactId: null,
            label: 'A calm, trusted person',
            rationale: 'When relationships feel tense, outside perspective usually helps before the next message goes out.',
            draftStarter: 'Can we talk sometime today? Something has been sitting with me and I want to handle it calmly.',
            relationship: null,
            channel: null,
            channelLabel: null,
            supportMemory: null,
            fallbackSupport: null,
        };
    }
    if (scenario === 'future') {
        return {
            contactId: null,
            label: 'Counselor, mentor, or trusted adult',
            rationale: 'A real conversation can turn future pressure into a smaller next step.',
            draftStarter: 'I have been overthinking my next path and could use a short conversation to sort it out.',
            relationship: null,
            channel: null,
            channelLabel: null,
            supportMemory: null,
            fallbackSupport: null,
        };
    }
    if (risk.level === 'orange') {
        return {
            contactId: null,
            label: 'A trusted adult today',
            rationale: 'This looks heavier than a solo reflection problem.',
            draftStarter: 'I am having a hard time and do not think I should handle it alone. Can we talk today?',
            relationship: null,
            channel: null,
            channelLabel: null,
            supportMemory: null,
            fallbackSupport: null,
        };
    }
    return {
        contactId: null,
        label: 'One person who feels steady',
        rationale: 'A quick check-in can help break the loop before it grows.',
        draftStarter: 'I have been carrying a lot lately. Could we check in soon?',
        relationship: null,
        channel: null,
        channelLabel: null,
        supportMemory: null,
        fallbackSupport: null,
    };
};

const buildKeep = (recurringSkills: string[], topSkills: string[], topLessons: string[], risk: StudentRisk): StudentActionBrief['keep'] => {
    const skill = recurringSkills[0] || topSkills[0];
    if (skill) {
        return {
            label: skill,
            evidence: 'This keeps showing up in your notes, even during heavier stretches.',
        };
    }
    if (topLessons[0]) {
        return {
            label: 'A lesson worth keeping',
            evidence: clip(topLessons[0], 140),
        };
    }
    if (risk.level !== 'none') {
        return {
            label: 'You are still showing up',
            evidence: 'Even a hard note is proof that you are paying attention to what matters.',
        };
    }
    return null;
};

const buildFollowUpPrompt = (scenario: ActionScenario, nextMove: StudentActionBrief['nextMove']) => {
    if (scenario === 'school') return 'Which school task would feel lighter tonight if you made it smaller?';
    if (scenario === 'conflict') return 'What do you want understood before this becomes a bigger conversation?';
    if (scenario === 'future') return 'Which part of your future question feels like pressure, and which part feels like curiosity?';
    if (nextMove?.type === 'routine') return 'What does the easiest caring-for-yourself version of today look like?';
    return 'If this comes back tonight, what would you want future-you to remember?';
};

const buildConfidence = (relatedCount: number, highlightsCount: number, hasHelpedBefore: boolean, recentCount: number) =>
    normalizeConfidence(0.38 + (relatedCount * 0.06) + (highlightsCount * 0.04) + (hasHelpedBefore ? 0.12 : 0) + (recentCount >= 4 ? 0.08 : 0));

const buildBridgeDraft = (input: {
    scenario: ActionScenario;
    risk: StudentRisk;
    reachOut: StudentActionBrief['reachOut'];
    helpedSummary: string;
    highlights: StudentActionHighlight[];
    groundingEntryIds: string[];
    supportAnchor?: SupportAnchor | null;
}): StudentBridgeDraft | null => {
    if (!input.reachOut) return null;

    const evidenceSummary = input.supportAnchor?.whyItHelps
        || input.helpedSummary
        || input.highlights[0]?.excerpt
        || 'Recent notes suggest this may be easier to handle with another person involved.';

    const talkTrack = input.risk.level === 'red'
        ? [
            'Say clearly that you do not feel safe right now.',
            'Ask the person to stay with you or help you get immediate support.',
            'Use 988 or emergency help if you cannot stay safe.',
        ]
        : input.scenario === 'school'
            ? [
                'Explain what feels most stuck right now.',
                'Name the smallest school problem you need help breaking down.',
                'Ask for one concrete next step or check-in.',
            ]
            : input.scenario === 'conflict'
                ? [
                    'Describe what happened without trying to solve all of it at once.',
                    'Say what part feels hardest to carry alone.',
                    'Ask for perspective before you send the next message.',
                ]
                : input.scenario === 'future'
                    ? [
                        'Name the future decision or pressure point.',
                        'Explain what feels unclear versus what feels urgent.',
                        'Ask for one next exposure step, not a final answer.',
                    ]
                    : [
                        'Say what has been weighing on you.',
                        'Name what kind of support would help most right now.',
                        'Ask for a short check-in instead of solving everything.',
                    ];

    return {
        contactId: input.reachOut.contactId || null,
        recommendedRecipient: input.reachOut.label,
        relationship: input.reachOut.relationship || null,
        channel: input.reachOut.channel || null,
        channelLabel: input.reachOut.channelLabel || null,
        contactActions: input.reachOut.contactActions || [],
        supportMemory: input.reachOut.supportMemory || null,
        fallbackSupport: input.reachOut.fallbackSupport || null,
        whyNow: input.reachOut.rationale,
        messageDraft: input.reachOut.draftStarter || 'Could we talk for a few minutes? I could use another person in this with me.',
        talkTrack,
        evidenceSummary,
        groundingEntryIds: input.groundingEntryIds,
    };
};

const mergeStudentSignalsIntoAnalysis = (
    analysis: unknown,
    brief: StudentActionBrief | null,
    risk: StudentRisk,
    support: EntrySupportSnapshot | null
): Prisma.InputJsonValue => {
    const baseAnalysis = isJsonObject(analysis) ? analysis : {};
    return {
        ...baseAnalysis,
        action: brief as unknown as Prisma.InputJsonValue,
        risk: risk as unknown as Prisma.InputJsonValue,
        support: support as unknown as Prisma.InputJsonValue,
    };
};

class StudentActionService {
    async getTodayAction(userId: string): Promise<StudentActionResponse> {
        const recentEntries = await fetchRecentEntries(userId, 8);
        if (recentEntries.length === 0) {
            const assessment = studentSafetyService.assess({ content: '' });
            return {
                brief: null,
                bridge: null,
                risk: assessment.risk,
                safetyCard: assessment.safetyCard,
                highlights: [],
                starter: buildStarter(),
                source: 'starter',
            };
        }

        const latestEntry = recentEntries[0];
        return this.buildActionResponse({
            userId,
            entryId: latestEntry.id,
            title: latestEntry.title,
            content: latestEntry.content,
            mode: 'today',
        });
    }

    async preview(input: {
        userId: string;
        content?: string | null;
        title?: string | null;
        entryId?: string | null;
    }): Promise<StudentActionResponse> {
        return this.buildActionResponse({
            userId: input.userId,
            content: input.content,
            title: input.title,
            entryId: input.entryId || null,
            mode: 'preview',
        });
    }

    async persistEntrySignals(input: {
        entryId: string;
        userId: string;
        title: string | null;
        content: string;
        analysis: unknown;
    }): Promise<{
        response: StudentActionResponse;
        mergedAnalysis: Prisma.InputJsonValue;
    }> {
        const response = await this.buildActionResponse({
            userId: input.userId,
            entryId: input.entryId,
            title: input.title,
            content: input.content,
            mode: 'preview',
        });

        const baseAnalysis = isJsonObject(input.analysis) ? input.analysis : {};
        const supportSnapshot = supportMapService.extractEntrySupportSnapshot({
            title: input.title,
            content: input.content,
            analysis: {
                ...baseAnalysis,
                action: response.brief as unknown as Prisma.JsonValue,
                risk: response.risk as unknown as Prisma.JsonValue,
            },
        });
        const mergedAnalysis = mergeStudentSignalsIntoAnalysis(input.analysis, response.brief, response.risk, supportSnapshot);
        await prisma.entry.update({
            where: { id: input.entryId },
            data: { analysis: mergedAnalysis },
        });

        return { response, mergedAnalysis };
    }

    private async buildActionResponse(input: BuildActionInput): Promise<StudentActionResponse> {
        const queryContent = String(input.content || '').trim();
        const recentEntries = await fetchRecentEntries(input.userId, 8);
        const latestEntry = input.entryId
            ? recentEntries.find((entry) => entry.id === input.entryId) || null
            : recentEntries[0] || null;
        const baseTitle = input.title || latestEntry?.title || null;
        const baseContent = queryContent || latestEntry?.content || '';
        const queryText = [String(baseTitle || '').trim(), baseContent].filter(Boolean).join('\n\n').trim();

        if (!queryText) {
            const assessment = studentSafetyService.assess({ content: '' });
            return {
                brief: null,
                bridge: null,
                risk: assessment.risk,
                safetyCard: assessment.safetyCard,
                highlights: [],
                starter: buildStarter(),
                source: 'starter',
            };
        }

        const scenario = parseScenario(queryText);
        const [{ preferences: supportPreferences, location }, memoryContext, searchResult, insights] = await Promise.all([
            supportMapService.getSupportProfileForUser(input.userId),
            analysisMemoryService.buildContext({
                userId: input.userId,
                content: baseContent,
                title: baseTitle,
                excludeEntryId: input.entryId || null,
                limit: 4,
            }),
            executeHybridSearch({
                userId: input.userId,
                query: queryText,
                limit: 4,
                intent: /\b(what should i do|next move|what helped|again|how do i|help me)\b/i.test(queryText) ? 'action' : 'memory',
            }).catch(() => null),
            nlpService.generateInsights(
                recentEntries.slice(0, 6).map((entry) => ({
                    content: entry.content,
                    mood: entry.mood || undefined,
                    createdAt: entry.createdAt,
                    skills: entry.skills,
                    lessons: entry.lessons,
                }))
            ),
        ]);
        const supportMap = supportMapService.buildSupportMapFromEntries(recentEntries, {
            maxAnchors: 6,
            preferences: supportPreferences,
        });
        const preferredSupportAnchor = supportMapService.selectBridgeAnchor(supportMap);
        const preliminaryAssessment = studentSafetyService.assess({
            content: queryText,
            location,
            safetyRegion: supportPreferences?.safetyRegion,
        });
        const trustedRecommendation = supportMapService.recommendTrustedContact(supportPreferences, {
            anchorLabel: preferredSupportAnchor?.label || null,
            scenario,
            riskLevel: preliminaryAssessment.risk.level,
        });
        const preferredTrustedContact = trustedRecommendation.primary;
        const assessment = studentSafetyService.assess({
            content: queryText,
            location,
            safetyRegion: supportPreferences?.safetyRegion,
            trustedContact: preferredTrustedContact,
        });
        const preferredRoutineAnchor = supportMap.anchors.find((anchor) => anchor.type === 'routine') || null;

        const resultMap = new Map((searchResult?.results || []).map((result) => [result.id, result]));
        const matchedEntries = (searchResult?.results || [])
            .map((result) => recentEntries.find((entry) => entry.id === result.id))
            .filter((entry): entry is ActionEntryRecord => entry !== undefined);
        const focalEntries = matchedEntries.length > 0
            ? matchedEntries
            : recentEntries.filter((entry) => entry.id !== input.entryId).slice(0, 3);
        const highlights = buildHighlights(focalEntries, resultMap);
        const helpedEntry = matchedEntries[0] || null;
        const helpedSummary = summarizeHelpfulEntry(helpedEntry);
        const nextMove = buildNextMove(scenario, assessment.risk, helpedSummary, preferredRoutineAnchor?.label || null);
        const keep = buildKeep(memoryContext?.recurringSkills || [], insights.topSkills || [], insights.topLessons || [], assessment.risk);
        const reachOut = buildReachOut(
            scenario,
            assessment.risk,
            preferredSupportAnchor,
            preferredTrustedContact,
            supportPreferences,
            trustedRecommendation
        );
        const groundingEntryIds = uniqueStrings([input.entryId || null, ...highlights.map((highlight) => highlight.id)], 4);

        const brief: StudentActionBrief | null = assessment.risk.level === 'red'
            ? null
            : {
                headline: buildHeadline(scenario, assessment.risk),
                pattern: buildPatternLine({
                    scenario,
                    dominantMood: insights.dominantMood,
                    topTopics: insights.topTopics || [],
                    risk: assessment.risk,
                }),
                whatHelpedBefore: helpedEntry
                    ? {
                        summary: helpedSummary,
                        entryId: helpedEntry.id,
                        title: helpedEntry.title,
                        reason: resultMap.get(helpedEntry.id)?.matchReasons?.[0] || memoryContext?.summary || 'Similar past note',
                    }
                    : null,
                nextMove,
                reachOut,
                keep,
                followUpPrompt: buildFollowUpPrompt(scenario, nextMove),
                confidence: buildConfidence(memoryContext?.relatedEntryCount || 0, highlights.length, Boolean(helpedSummary), recentEntries.length),
                groundingEntryIds,
                createdAt: new Date().toISOString(),
            };
        const bridge = buildBridgeDraft({
            scenario,
            risk: assessment.risk,
            reachOut,
            helpedSummary,
            highlights,
            groundingEntryIds,
            supportAnchor: preferredSupportAnchor,
        });

        return {
            brief,
            bridge,
            risk: assessment.risk,
            safetyCard: assessment.safetyCard,
            highlights,
            starter: null,
            source: input.mode === 'today' ? 'recent_entry' : 'preview',
        };
    }
}

export default new StudentActionService();
