import type { SafetyRegion, TrustedContact, TrustedContactChannel } from './support-map.service';

export type StudentContactAction = {
    label: string;
    href: string;
    kind: 'text' | 'call' | 'email';
};

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
    trustedContactChannel?: TrustedContactChannel;
    contactActions?: StudentContactAction[];
};

export type StudentSafetyAssessment = {
    risk: StudentRisk;
    safetyCard: StudentSafetyCard | null;
};

type SafetyRule = {
    level: Exclude<StudentRiskLevel, 'none'>;
    signal: string;
    patterns: RegExp[];
    exclude?: RegExp[];
};

const RED_RULES: SafetyRule[] = [
    {
        level: 'red',
        signal: 'self-harm or suicide language',
        patterns: [
            /\b(i want to die|i wanna die|want to end my life|end my life|kill myself|suicidal|suicide|hurt myself|self harm|self-harm|cut myself|overdose)\b/i,
            /\b(don't want to live|do not want to live|can't stay safe|cannot stay safe)\b/i,
        ],
        exclude: [
            /\b(not suicidal|not going to hurt myself|not going to kill myself|i am safe)\b/i,
        ],
    },
    {
        level: 'red',
        signal: 'immediate danger',
        patterns: [
            /\b(in immediate danger|not safe right now|i am not safe right now|someone is hurting me right now)\b/i,
        ],
    },
];

const ORANGE_RULES: SafetyRule[] = [
    {
        level: 'orange',
        signal: 'abuse or coercion concern',
        patterns: [
            /\b(abuse|abusive|forced me|forcing me|coercive|coerced|threatening me|being hurt at home|unsafe at home|unsafe at school)\b/i,
        ],
    },
    {
        level: 'orange',
        signal: 'severe hopelessness or isolation',
        patterns: [
            /\b(can't do this anymore|cannot do this anymore|nobody would care|no one would care|there is no point|hopeless|trapped)\b/i,
        ],
        exclude: [
            /\b(not hopeless)\b/i,
        ],
    },
];

const YELLOW_RULES: SafetyRule[] = [
    {
        level: 'yellow',
        signal: 'heavy distress',
        patterns: [
            /\b(overwhelmed|panicking|panic attack|breaking down|burned out|burnt out|exhausted|drained)\b/i,
            /\b(feel alone|feel isolated|nobody gets it|crying every day|can't sleep because of this)\b/i,
        ],
    },
];

const levelRank: Record<StudentRiskLevel, number> = {
    none: 0,
    yellow: 1,
    orange: 2,
    red: 3,
};

const levelModeMap: Record<StudentRiskLevel, StudentRiskMode> = {
    none: 'normal',
    yellow: 'supportive',
    orange: 'elevated',
    red: 'emergency',
};

const uniqueStrings = (values: string[]) => {
    const seen = new Set<string>();
    return values.filter((value) => {
        const key = value.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const matchesRule = (text: string, rule: SafetyRule) =>
    rule.patterns.some((pattern) => pattern.test(text))
    && !(rule.exclude || []).some((pattern) => pattern.test(text));

const US_LOCATION_PATTERN = /\b(usa|u\.s\.a\.|us|u\.s\.|united states|alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|dc|district of columbia)\b/i;

const resolveSafetyRegion = (location?: string | null, safetyRegion?: SafetyRegion): 'us' | 'intl' => {
    if (safetyRegion === 'us') return 'us';
    if (safetyRegion === 'intl') return 'intl';
    return US_LOCATION_PATTERN.test(String(location || '')) ? 'us' : 'intl';
};

const getChannelVerb = (channel?: TrustedContactChannel) =>
    channel === 'call' ? 'call' : channel === 'in_person' ? 'talk to' : 'text';

const buildTrustedContactActions = (contact: TrustedContact | null | undefined, message: string): StudentContactAction[] => {
    if (!contact) return [];

    const actions: StudentContactAction[] = [];
    const addAction = (action: StudentContactAction | null) => {
        if (!action) return;
        if (actions.some((existing) => existing.href === action.href || existing.label === action.label)) return;
        actions.push(action);
    };

    const encodedMessage = encodeURIComponent(message);
    const encodedSubject = encodeURIComponent('Need support');

    const textAction = contact.phoneNumber
        ? { label: `Text ${contact.name}`, href: `sms:${contact.phoneNumber}?body=${encodedMessage}`, kind: 'text' as const }
        : null;
    const callAction = contact.phoneNumber
        ? { label: `Call ${contact.name}`, href: `tel:${contact.phoneNumber}`, kind: 'call' as const }
        : null;
    const emailAction = contact.emailAddress
        ? { label: `Email ${contact.name}`, href: `mailto:${contact.emailAddress}?subject=${encodedSubject}&body=${encodedMessage}`, kind: 'email' as const }
        : null;

    if (contact.channel === 'call') {
        addAction(callAction);
        addAction(textAction);
        addAction(emailAction);
    } else if (contact.channel === 'in_person') {
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

const buildSupportDraft = (riskLevel: StudentRiskLevel, contact?: TrustedContact | null) => {
    if (!contact) {
        if (riskLevel === 'red') return 'I do not feel safe being alone right now and I need help.';
        if (riskLevel === 'orange') return 'I am having a really hard time and I do not think I should handle this alone. Can we talk today?';
        return 'I have been carrying a lot lately. Could we check in soon?';
    }

    if (riskLevel === 'red') {
        return `I do not feel safe right now. Can you stay with me or help me get support right away?`;
    }
    if (riskLevel === 'orange') {
        return `I am having a really hard time and could use support today. Can we check in?`;
    }
    return `I have been carrying a lot lately. Could we ${contact.channel === 'in_person' ? 'talk in person' : 'check in'} soon?`;
};

class StudentSafetyService {
    assess(input: {
        content: string;
        location?: string | null;
        safetyRegion?: SafetyRegion;
        trustedContact?: TrustedContact | null;
    }): StudentSafetyAssessment {
        const text = String(input.content || '').trim();
        const generatedAt = new Date().toISOString();

        if (!text) {
            return {
                risk: {
                    level: 'none',
                    mode: 'normal',
                    signals: [],
                    generatedAt,
                },
                safetyCard: null,
            };
        }

        const matchedSignals: string[] = [];
        let level: StudentRiskLevel = 'none';

        [...RED_RULES, ...ORANGE_RULES, ...YELLOW_RULES].forEach((rule) => {
            if (!matchesRule(text, rule)) return;
            matchedSignals.push(rule.signal);
            if (levelRank[rule.level] > levelRank[level]) {
                level = rule.level;
            }
        });

        const risk: StudentRisk = {
            level,
            mode: levelModeMap[level],
            signals: uniqueStrings(matchedSignals),
            generatedAt,
        };

        return {
            risk,
            safetyCard: this.buildSafetyCard(risk, {
                location: input.location,
                safetyRegion: input.safetyRegion,
                trustedContact: input.trustedContact || null,
            }),
        };
    }

    private buildSafetyCard(
        risk: StudentRisk,
        context?: {
            location?: string | null;
            safetyRegion?: SafetyRegion;
            trustedContact?: TrustedContact | null;
        }
    ): StudentSafetyCard | null {
        if (risk.level === 'none') return null;

        const region = resolveSafetyRegion(context?.location, context?.safetyRegion);
        const trustedContact = context?.trustedContact || null;
        const contactLabel = trustedContact?.name || 'a trusted person';
        const contactVerb = getChannelVerb(trustedContact?.channel);
        const draftMessage = buildSupportDraft(risk.level, trustedContact);
        const contactActions = buildTrustedContactActions(trustedContact, draftMessage);

        if (risk.level === 'red') {
            if (region === 'intl') {
                return {
                    headline: 'Safety comes first right now.',
                    body: `If you might hurt yourself or you are in immediate danger, contact local emergency services or go to the nearest emergency room now. ${trustedContact ? `Then ${contactVerb} ${contactLabel} right away.` : 'Reach a trusted adult right away.'}`,
                    primaryActionLabel: 'Find local helplines',
                    primaryActionHref: 'https://findahelpline.com/',
                    draftMessage,
                    tone: 'urgent',
                    resourceRegion: 'intl',
                    ...(contactActions.length > 0 ? { contactActions } : {}),
                    ...(trustedContact ? { trustedContactId: trustedContact.id, trustedContactName: trustedContact.name, trustedContactChannel: trustedContact.channel } : {}),
                };
            }
            return {
                headline: 'Safety comes first right now.',
                body: `If you might hurt yourself or you are in immediate danger, call or text 988 now. If you cannot stay safe, call 911 or go to the nearest emergency room. ${trustedContact ? `Then ${contactVerb} ${contactLabel} right away.` : 'Reach out to a trusted adult right away.'}`,
                primaryActionLabel: 'Call or Text 988',
                primaryActionHref: 'tel:988',
                secondaryActionLabel: 'Call 911',
                secondaryActionHref: 'tel:911',
                draftMessage,
                tone: 'urgent',
                resourceRegion: 'us',
                ...(contactActions.length > 0 ? { contactActions } : {}),
                ...(trustedContact ? { trustedContactId: trustedContact.id, trustedContactName: trustedContact.name, trustedContactChannel: trustedContact.channel } : {}),
            };
        }

        if (risk.level === 'orange') {
            if (region === 'intl') {
                return {
                    headline: 'This sounds heavier than something to carry alone.',
                    body: `${trustedContact ? `Try to ${contactVerb} ${contactLabel} today.` : 'Reach out to a trusted adult, counselor, caregiver, or school support person today.'} If this shifts toward immediate safety risk, use local emergency services or a crisis line in your country.`,
                    primaryActionLabel: 'Find local helplines',
                    primaryActionHref: 'https://findahelpline.com/',
                    draftMessage,
                    tone: 'supportive',
                    resourceRegion: 'intl',
                    ...(contactActions.length > 0 ? { contactActions } : {}),
                    ...(trustedContact ? { trustedContactId: trustedContact.id, trustedContactName: trustedContact.name, trustedContactChannel: trustedContact.channel } : {}),
                };
            }
            return {
                headline: 'This sounds heavier than something to carry alone.',
                body: `${trustedContact ? `Try to ${contactVerb} ${contactLabel} today.` : 'Reach out to a trusted adult, counselor, caregiver, or school support person today.'} If this shifts toward immediate safety risk, call or text 988.`,
                primaryActionLabel: 'Call or Text 988',
                primaryActionHref: 'tel:988',
                secondaryActionLabel: 'Text 988',
                secondaryActionHref: 'sms:988',
                draftMessage,
                tone: 'supportive',
                resourceRegion: 'us',
                ...(contactActions.length > 0 ? { contactActions } : {}),
                ...(trustedContact ? { trustedContactId: trustedContact.id, trustedContactName: trustedContact.name, trustedContactChannel: trustedContact.channel } : {}),
            };
        }

        return {
            headline: 'This note sounds heavy.',
            body: region === 'us'
                ? `${trustedContact ? `If this keeps building, ${contactVerb} ${contactLabel} instead of carrying it by yourself.` : 'If this keeps building, consider checking in with a trusted adult, counselor, coach, parent, or friend instead of carrying it by yourself.'}`
                : `${trustedContact ? `If this keeps building, ${contactVerb} ${contactLabel} instead of carrying it by yourself.` : 'If this keeps building, consider checking in with a trusted adult, counselor, coach, parent, or friend instead of carrying it by yourself.'} If you need crisis help outside the U.S., use local emergency or crisis services.`,
            primaryActionLabel: region === 'us' ? 'Open 988' : 'Find local helplines',
            primaryActionHref: region === 'us' ? 'https://988lifeline.org/' : 'https://findahelpline.com/',
            draftMessage,
            tone: 'supportive',
            resourceRegion: region,
            ...(contactActions.length > 0 ? { contactActions } : {}),
            ...(trustedContact ? { trustedContactId: trustedContact.id, trustedContactName: trustedContact.name, trustedContactChannel: trustedContact.channel } : {}),
        };
    }
}

export default new StudentSafetyService();
