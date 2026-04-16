'use client';

import type { NotificationPreferencesSettings } from '@/services/notification-preferences.service';
import { normalizeNotificationPreferences } from '@/services/notification-preferences.service';
import type { PromptFrequency, StoredAnswer } from '@/services/progressive-personalization.service';
import type { IconType } from 'react-icons';
import { FiBell, FiBox, FiShield, FiTarget, FiUser } from 'react-icons/fi';

export type { PromptFrequency, StoredAnswer } from '@/services/progressive-personalization.service';

export const PRIMARY_GOAL_OPTIONS = [
    { value: 'clarity', label: 'Clear mind' },
    { value: 'memory', label: 'Remember life' },
    { value: 'growth', label: 'Grow' },
    { value: 'productivity', label: 'Get things done' },
];

export const FOCUS_AREA_OPTIONS = [
    { value: 'life', label: 'Life' },
    { value: 'career', label: 'School / Work' },
    { value: 'both', label: 'Both' },
];

export const EXPERIENCE_LEVEL_OPTIONS = [
    { value: 'student', label: 'Student' },
    { value: 'early-career', label: 'Early Career' },
    { value: 'professional', label: 'Professional' },
    { value: 'lifelong-learner', label: 'Lifelong Learner' },
];

export const WRITING_PREFERENCE_OPTIONS = [
    { value: 'guided', label: 'With questions' },
    { value: 'structured', label: 'Step by step' },
    { value: 'freeform', label: 'Free writing' },
];

export const IMPORT_PREFERENCE_OPTIONS = [
    { value: 'connect-now', label: 'Connect now' },
    { value: 'archive-upload', label: 'Upload files' },
    { value: 'later', label: 'Later' },
];

export const PROMPT_FREQUENCY_OPTIONS: Array<{ value: PromptFrequency; label: string }> = [
    { value: 'high', label: 'More' },
    { value: 'normal', label: 'Normal' },
    { value: 'low', label: 'Less' },
    { value: 'off', label: 'Off' },
];

export type TrustedContactChannel = 'text' | 'call' | 'in_person';
export type SafetyRegion = 'auto' | 'us' | 'intl';

export const SAFETY_REGION_OPTIONS: Array<{ value: SafetyRegion; label: string }> = [
    { value: 'auto', label: 'Auto detect' },
    { value: 'us', label: 'United States' },
    { value: 'intl', label: 'Outside U.S.' },
];

export const TRUSTED_CONTACT_CHANNEL_OPTIONS: Array<{ value: TrustedContactChannel; label: string }> = [
    { value: 'text', label: 'Text' },
    { value: 'call', label: 'Call' },
    { value: 'in_person', label: 'In person' },
];

export type EditTab = 'profile' | 'preferences' | 'security' | 'privacy' | 'reminders';
export type EditableTab = Exclude<EditTab, 'security' | 'reminders'>;

export const TAB_ITEMS: Array<{ id: EditTab; label: string; Icon: IconType }> = [
    { id: 'profile', label: 'About', Icon: FiUser },
    { id: 'preferences', label: 'Goals', Icon: FiTarget },
    { id: 'security', label: 'Security', Icon: FiShield },
    { id: 'privacy', label: 'Data', Icon: FiBox },
    { id: 'reminders', label: 'Reminders', Icon: FiBell },
];

export const EDITABLE_TABS: EditableTab[] = ['profile', 'preferences', 'privacy'];

export const LEGACY_TAB_MAP: Record<string, EditTab> = {
    profile: 'profile',
    preferences: 'preferences',
    security: 'security',
    privacy: 'privacy',
    reminders: 'reminders',
    personalization: 'preferences',
    data: 'privacy',
};

export type Notice = {
    type: 'success' | 'error';
    text: string;
};

export type SnapshotUserProfile = {
    bio?: string | null;
    location?: string | null;
    occupation?: string | null;
    website?: string | null;
    birthDate?: string | null;
    lifeGoals?: string[] | null;
    primaryGoal?: string | null;
    focusArea?: string | null;
    experienceLevel?: string | null;
    writingPreference?: string | null;
    starterPrompt?: string | null;
    outputGoals?: string[] | null;
    importPreference?: string | null;
    personalizationSignals?: Record<string, unknown> | null;
    onboardingCompletedAt?: string | null;
    updatedAt?: string | null;
};

export type SnapshotUser = {
    id: string;
    email: string;
    name: string | null;
    avatarUrl?: string | null;
    hasPassword?: boolean;
    updatedAt?: string | null;
    profile?: SnapshotUserProfile | null;
};

export type ProfileDraft = {
    name: string;
    email: string;
    avatarUrl: string;
    bio: string;
    location: string;
    occupation: string;
    website: string;
    birthDate: string;
    lifeGoals: string[];
};

export type PreferencesDraft = {
    primaryGoal: string;
    focusArea: string;
    experienceLevel: string;
    writingPreference: string;
    starterPrompt: string;
    outputGoals: string[];
    importPreference: string;
    onboardingCompletedAt: string | null;
};

export type PersonalizationSignalMetrics = {
    promptedCount?: number;
    answeredCount?: number;
    dismissedCount?: number;
    lastActionAt?: string;
};

export type TrustedContactPreference = {
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
    pinnedPeople?: string[];
    groundingRoutines?: string[];
    trustedContacts?: TrustedContactPreference[];
    contactOutcomes?: SupportContactOutcome[];
    safetyRegion?: SafetyRegion;
    updatedAt?: string;
};

export type PersonalizationSignals = {
    version?: number;
    updatedAt?: string;
    settings?: {
        promptFrequency?: PromptFrequency;
        dailyGentleReflectionsEnabled?: boolean;
        notifications?: NotificationPreferencesSettings;
    };
    metrics?: PersonalizationSignalMetrics;
    answers?: Record<string, StoredAnswer>;
    history?: StoredAnswer[];
    seenQuestionIds?: string[];
    lastPromptAt?: string;
    dismissedUntil?: string;
    lastSyncedSignature?: string;
    supportPreferences?: SupportPreferences;
    [key: string]: unknown;
};

export type PrivacyDraft = {
    personalizationSignals: PersonalizationSignals | null;
};

export type ConflictState = {
    tab: EditableTab;
    latestUser: SnapshotUser;
    userUpdatedAt: string | null;
    profileUpdatedAt: string | null;
};

export type SignalEntry = StoredAnswer & {
    key: string;
};

export type TrustedContactDraft = {
    name: string;
    relationship: string;
    channel: TrustedContactChannel;
    note: string;
    phoneNumber: string;
    emailAddress: string;
};

export type ChecklistItem = {
    id: string;
    label: string;
    done: boolean;
    hint: string;
};

export type TagInputProps = {
    label: string;
    values: string[];
    draft: string;
    placeholder: string;
    helper?: string;
    onDraftChange: (value: string) => void;
    onAdd: () => void;
    onRemove: (value: string) => void;
};

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

export const EMPTY_PROFILE_DRAFT: ProfileDraft = {
    name: '',
    email: '',
    avatarUrl: '',
    bio: '',
    location: '',
    occupation: '',
    website: '',
    birthDate: '',
    lifeGoals: [],
};

export const toDateInputValue = (value: string | null | undefined): string => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
};

export const toBirthDateLabel = (value: string | null | undefined, fallback = 'Not set'): string => {
    const inputValue = toDateInputValue(value);
    if (!inputValue) return fallback;
    const [year, month, day] = inputValue.split('-').map(Number);
    if (!year || !month || !day) return fallback;

    return new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, day)));
};

export const EMPTY_PREFERENCES_DRAFT: PreferencesDraft = {
    primaryGoal: '',
    focusArea: '',
    experienceLevel: '',
    writingPreference: '',
    starterPrompt: '',
    outputGoals: [],
    importPreference: '',
    onboardingCompletedAt: null,
};

export const EMPTY_PRIVACY_DRAFT: PrivacyDraft = {
    personalizationSignals: null,
};

export const EMPTY_TRUSTED_CONTACT_DRAFT: TrustedContactDraft = {
    name: '',
    relationship: '',
    channel: 'text',
    note: '',
    phoneNumber: '',
    emailAddress: '',
};

export const resolveEditTab = (value: string | null): EditTab =>
    value && LEGACY_TAB_MAP[value] ? LEGACY_TAB_MAP[value] : 'profile';

export const normalizeStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
};

export const normalizeTextField = (value: string, maxLength: number): string =>
    value.replace(/\s+/g, ' ').trim().slice(0, maxLength);

export const addTag = (items: string[], rawTag: string, maxItems: number, maxLength: number): string[] => {
    const nextTag = normalizeTextField(rawTag, maxLength);
    if (!nextTag || items.length >= maxItems) return items;

    const exists = items.some((item) => item.toLowerCase() === nextTag.toLowerCase());
    if (exists) return items;
    return [...items, nextTag];
};

export const asPromptFrequency = (value: unknown): PromptFrequency =>
    value === 'off' || value === 'low' || value === 'normal' || value === 'high'
        ? value
        : 'normal';

export const serializeDraft = (value: unknown): string => JSON.stringify(value ?? null);

const cloneJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const normalizePhoneNumber = (value: unknown): string => {
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

const normalizeEmailAddress = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return '';
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : '';
};

const buildTrustedContactId = (name: string, relationship?: string) =>
    `${normalizeTextField(name, 40).toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'contact'}-${normalizeTextField(relationship || 'support', 24).toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'support'}`;

const normalizeTrustedContacts = (value: unknown): TrustedContactPreference[] => {
    if (!Array.isArray(value)) return [];

    const seen = new Set<string>();
    const contacts = value.reduce<TrustedContactPreference[]>((acc, item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return acc;

        const source = item as TrustedContactPreference;
        const name = normalizeTextField(String(source.name || ''), 60);
        if (!name) return acc;

        const relationship = normalizeTextField(String(source.relationship || ''), 40);
        const note = normalizeTextField(String(source.note || ''), 160);
        const phoneNumber = normalizePhoneNumber(source.phoneNumber);
        const emailAddress = normalizeEmailAddress(source.emailAddress);
        const channel: TrustedContactChannel = source.channel === 'call' || source.channel === 'in_person'
            ? source.channel
            : 'text';
        const id = normalizeTextField(String(source.id || buildTrustedContactId(name, relationship)), 80)
            || buildTrustedContactId(name, relationship);
        const key = `${name.toLowerCase()}::${relationship.toLowerCase()}`;
        if (seen.has(key) || acc.length >= 4) return acc;

        seen.add(key);
        acc.push({
            id,
            name,
            channel,
            relationship: relationship || undefined,
            note: note || undefined,
            phoneNumber: phoneNumber || undefined,
            emailAddress: emailAddress || undefined,
            isPrimary: Boolean(source.isPrimary),
        });
        return acc;
    }, []);

    const primaryIndex = contacts.findIndex((item) => item.isPrimary);
    if (primaryIndex > 0) {
        const [primary] = contacts.splice(primaryIndex, 1);
        if (primary) {
            contacts.unshift({ ...primary, isPrimary: true });
        }
    }

    return contacts.map((item, index) => ({
        ...item,
        isPrimary: index === 0 ? Boolean(item.isPrimary) : false,
    }));
};

const normalizeContactOutcomes = (value: unknown): SupportContactOutcome[] => {
    if (!Array.isArray(value)) return [];

    return value
        .reduce<SupportContactOutcome[]>((acc, item, index) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) return acc;

            const source = item as SupportContactOutcome;
            const contactName = normalizeTextField(String(source.contactName || ''), 80);
            const recordedAt = typeof source.recordedAt === 'string' ? source.recordedAt : '';
            const outcome = source.outcome === 'helped' || source.outcome === 'still_need_support'
                ? source.outcome
                : null;
            const contactSource = source.source === 'bridge' || source.source === 'safety'
                ? source.source
                : null;
            const surface = source.surface === 'dashboard' || source.surface === 'guide' || source.surface === 'entry' || source.surface === 'safety'
                ? source.surface
                : null;

            if (!contactName || !recordedAt || !outcome || !contactSource || !surface) {
                return acc;
            }

            acc.push({
                id: normalizeTextField(String(source.id || `support-outcome-${index}`), 80) || `support-outcome-${index}`,
                ...(source.contactId ? { contactId: normalizeTextField(String(source.contactId), 80) } : {}),
                contactName,
                outcome,
                source: contactSource,
                surface,
                ...(source.actionKind === 'copy' || source.actionKind === 'text' || source.actionKind === 'call' || source.actionKind === 'email' || source.actionKind === 'manual'
                    ? { actionKind: source.actionKind }
                    : {}),
                ...(source.channel === 'text' || source.channel === 'call' || source.channel === 'in_person'
                    ? { channel: source.channel }
                    : {}),
                ...(source.riskLevel === 'none' || source.riskLevel === 'yellow' || source.riskLevel === 'orange' || source.riskLevel === 'red'
                    ? { riskLevel: source.riskLevel }
                    : {}),
                ...(source.entryId ? { entryId: normalizeTextField(String(source.entryId), 80) } : {}),
                recordedAt,
            });
            return acc;
        }, [])
        .sort((left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime())
        .slice(0, 24);
};

const normalizeSupportPreferences = (value: unknown): SupportPreferences | undefined => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }

    const source = value as SupportPreferences;
    const pinnedPeople = normalizeStringArray(source.pinnedPeople).slice(0, 6).map((item) => normalizeTextField(item, 60));
    const groundingRoutines = normalizeStringArray(source.groundingRoutines).slice(0, 6).map((item) => normalizeTextField(item, 60));
    const trustedContacts = normalizeTrustedContacts(source.trustedContacts);
    const contactOutcomes = normalizeContactOutcomes(source.contactOutcomes);
    const safetyRegion: SafetyRegion = source.safetyRegion === 'us' || source.safetyRegion === 'intl'
        ? source.safetyRegion
        : 'auto';
    const updatedAt = typeof source.updatedAt === 'string' ? source.updatedAt : undefined;

    if (
        pinnedPeople.length === 0
        && groundingRoutines.length === 0
        && trustedContacts.length === 0
        && contactOutcomes.length === 0
        && safetyRegion === 'auto'
        && !updatedAt
    ) {
        return undefined;
    }

    return {
        ...(pinnedPeople.length > 0 ? { pinnedPeople } : {}),
        ...(groundingRoutines.length > 0 ? { groundingRoutines } : {}),
        ...(trustedContacts.length > 0 ? { trustedContacts } : {}),
        ...(contactOutcomes.length > 0 ? { contactOutcomes } : {}),
        ...(safetyRegion !== 'auto' ? { safetyRegion } : {}),
        ...(updatedAt ? { updatedAt } : {}),
    };
};

export const buildProfileDraft = (source: SnapshotUser | null | undefined): ProfileDraft => ({
    name: source?.name || '',
    email: source?.email || '',
    avatarUrl: source?.avatarUrl || '',
    bio: source?.profile?.bio || '',
    location: source?.profile?.location || '',
    occupation: source?.profile?.occupation || '',
    website: source?.profile?.website || '',
    birthDate: toDateInputValue(source?.profile?.birthDate || null),
    lifeGoals: normalizeStringArray(source?.profile?.lifeGoals),
});

export const buildPreferencesDraft = (source: SnapshotUser | null | undefined): PreferencesDraft => ({
    primaryGoal: source?.profile?.primaryGoal || '',
    focusArea: source?.profile?.focusArea || '',
    experienceLevel: source?.profile?.experienceLevel || '',
    writingPreference: source?.profile?.writingPreference || '',
    starterPrompt: source?.profile?.starterPrompt || '',
    outputGoals: normalizeStringArray(source?.profile?.outputGoals),
    importPreference: source?.profile?.importPreference || '',
    onboardingCompletedAt: source?.profile?.onboardingCompletedAt || null,
});

export const normalizeSignals = (value: unknown): PersonalizationSignals | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }

    const source = cloneJson(value as PersonalizationSignals);
    const answersSource =
        source.answers && typeof source.answers === 'object' && !Array.isArray(source.answers)
            ? source.answers
            : {};
    const historySource = Array.isArray(source.history) ? source.history : [];
    const seenQuestionIds = Array.isArray(source.seenQuestionIds)
        ? source.seenQuestionIds.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];

    const answers = Object.fromEntries(
        Object.entries(answersSource).filter(([, answer]) => {
            if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return false;
            return typeof (answer as StoredAnswer).value === 'string';
        })
    ) as Record<string, StoredAnswer>;

    const history = historySource.filter((answer): answer is StoredAnswer => {
        if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return false;
        return typeof answer.value === 'string' && typeof answer.answeredAt === 'string';
    });
    const answerCount = Math.max(history.length, Object.keys(answers).length);

    return {
        ...source,
        version: typeof source.version === 'number' ? source.version : 1,
        updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : undefined,
        settings: {
            promptFrequency: asPromptFrequency(source.settings?.promptFrequency),
            dailyGentleReflectionsEnabled: source.settings?.dailyGentleReflectionsEnabled === true
                ? true
                : undefined,
            ...(normalizeNotificationPreferences(source.settings?.notifications)
                ? { notifications: normalizeNotificationPreferences(source.settings?.notifications) }
                : {}),
        },
        metrics: {
            promptedCount: typeof source.metrics?.promptedCount === 'number' ? source.metrics.promptedCount : 0,
            answeredCount: typeof source.metrics?.answeredCount === 'number' ? source.metrics.answeredCount : answerCount,
            dismissedCount: typeof source.metrics?.dismissedCount === 'number' ? source.metrics.dismissedCount : 0,
            lastActionAt: typeof source.metrics?.lastActionAt === 'string' ? source.metrics.lastActionAt : undefined,
        },
        answers,
        history,
        seenQuestionIds,
        supportPreferences: normalizeSupportPreferences(source.supportPreferences),
    };
};

export const createSignalsDraft = (frequency: PromptFrequency = 'normal'): PersonalizationSignals => ({
    version: 1,
    settings: {
        promptFrequency: frequency,
    },
    metrics: {
        promptedCount: 0,
        answeredCount: 0,
        dismissedCount: 0,
    },
    answers: {},
    history: [],
    seenQuestionIds: [],
});

export const ensureSignalsDraft = (
    value: PersonalizationSignals | null | undefined,
    frequency?: PromptFrequency
): PersonalizationSignals => {
    const normalized = normalizeSignals(value);
    if (!normalized) {
        return createSignalsDraft(frequency);
    }

    return {
        ...normalized,
        settings: {
            ...(normalized.settings || {}),
            ...(frequency ? { promptFrequency: frequency } : {}),
        },
    };
};

export const compactSignals = (value: PersonalizationSignals | null | undefined): PersonalizationSignals | null => {
    const normalized = normalizeSignals(value);
    if (!normalized) {
        return null;
    }

    const promptFrequency = asPromptFrequency(normalized.settings?.promptFrequency);
    const dailyGentleReflectionsEnabled = normalized.settings?.dailyGentleReflectionsEnabled === true;
    const notificationSettings = normalizeNotificationPreferences(normalized.settings?.notifications);
    const answersCount = Object.keys(normalized.answers || {}).length;
    const historyCount = normalized.history?.length || 0;
    const promptedCount = normalized.metrics?.promptedCount || 0;
    const answeredCount = normalized.metrics?.answeredCount || 0;
    const dismissedCount = normalized.metrics?.dismissedCount || 0;
    const supportPreferences = normalizeSupportPreferences(normalized.supportPreferences);
    const hasExtras = Boolean(
        normalized.lastPromptAt ||
        normalized.dismissedUntil ||
        normalized.lastSyncedSignature ||
        (normalized.seenQuestionIds?.length || 0) > 0 ||
        (supportPreferences?.pinnedPeople?.length || 0) > 0 ||
        (supportPreferences?.groundingRoutines?.length || 0) > 0 ||
        (supportPreferences?.trustedContacts?.length || 0) > 0 ||
        (supportPreferences?.contactOutcomes?.length || 0) > 0 ||
        supportPreferences?.safetyRegion === 'us' ||
        supportPreferences?.safetyRegion === 'intl' ||
        Boolean(notificationSettings)
    );

    if (
        promptFrequency === 'normal' &&
        !dailyGentleReflectionsEnabled &&
        answersCount === 0 &&
        historyCount === 0 &&
        promptedCount === 0 &&
        answeredCount === 0 &&
        dismissedCount === 0 &&
        !normalized.metrics?.lastActionAt &&
        !hasExtras
    ) {
        return null;
    }

    return {
        ...normalized,
        settings: {
            promptFrequency,
            ...(dailyGentleReflectionsEnabled ? { dailyGentleReflectionsEnabled: true } : {}),
            ...(notificationSettings ? { notifications: notificationSettings } : {}),
        },
        ...(supportPreferences ? { supportPreferences } : {}),
    };
};

export const buildPrivacyDraft = (source: SnapshotUser | null | undefined): PrivacyDraft => ({
    personalizationSignals: normalizeSignals(source?.profile?.personalizationSignals),
});

export const buildSignalAnswerList = (signals: PersonalizationSignals | null): SignalEntry[] => {
    const normalized = normalizeSignals(signals);
    if (!normalized) return [];

    const directAnswers = Object.entries(normalized.answers || {}).map(([key, answer]) => ({
        key,
        ...answer,
    }));

    const sourceEntries = directAnswers.length > 0
        ? directAnswers
        : (normalized.history || []).map((answer, index) => ({
            key: `${answer.field || answer.questionId || 'signal'}-${index}`,
            ...answer,
        }));

    return sourceEntries
        .filter((entry) => typeof entry.value === 'string' && typeof entry.answeredAt === 'string')
        .sort((left, right) => new Date(right.answeredAt).getTime() - new Date(left.answeredAt).getTime());
};

export const toDateLabel = (value: string | null | undefined, fallback = 'Not yet'): string => {
    if (!value) return fallback;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed.toLocaleString();
};
