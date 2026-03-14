'use client';

import type { PromptFrequency, StoredAnswer } from '@/services/progressive-personalization.service';
import type { IconType } from 'react-icons';
import { FiBox, FiShield, FiTarget, FiUser } from 'react-icons/fi';

export type { PromptFrequency, StoredAnswer } from '@/services/progressive-personalization.service';

export const PRIMARY_GOAL_OPTIONS = [
    { value: 'clarity', label: 'Mental Clarity' },
    { value: 'memory', label: 'Memory Keeping' },
    { value: 'growth', label: 'Personal Growth' },
    { value: 'productivity', label: 'Execution' },
];

export const FOCUS_AREA_OPTIONS = [
    { value: 'life', label: 'Personal Life' },
    { value: 'career', label: 'Career & School' },
    { value: 'both', label: 'Life + Career' },
];

export const EXPERIENCE_LEVEL_OPTIONS = [
    { value: 'student', label: 'Student' },
    { value: 'early-career', label: 'Early Career' },
    { value: 'professional', label: 'Professional' },
    { value: 'lifelong-learner', label: 'Lifelong Learner' },
];

export const WRITING_PREFERENCE_OPTIONS = [
    { value: 'guided', label: 'Guided Prompts' },
    { value: 'structured', label: 'Structured Reflection' },
    { value: 'freeform', label: 'Freeform Writing' },
];

export const IMPORT_PREFERENCE_OPTIONS = [
    { value: 'connect-now', label: 'Connect Social Now' },
    { value: 'archive-upload', label: 'Upload Archive' },
    { value: 'later', label: 'Do It Later' },
];

export const PROMPT_FREQUENCY_OPTIONS: Array<{ value: PromptFrequency; label: string }> = [
    { value: 'high', label: 'High' },
    { value: 'normal', label: 'Normal' },
    { value: 'low', label: 'Low' },
    { value: 'off', label: 'Off' },
];

export type EditTab = 'profile' | 'preferences' | 'security' | 'privacy';
export type EditableTab = Exclude<EditTab, 'security'>;

export const TAB_ITEMS: Array<{ id: EditTab; label: string; Icon: IconType }> = [
    { id: 'profile', label: 'Profile', Icon: FiUser },
    { id: 'preferences', label: 'Preferences', Icon: FiTarget },
    { id: 'security', label: 'Security', Icon: FiShield },
    { id: 'privacy', label: 'Privacy & Data', Icon: FiBox },
];

export const EDITABLE_TABS: EditableTab[] = ['profile', 'preferences', 'privacy'];

export const LEGACY_TAB_MAP: Record<string, EditTab> = {
    profile: 'profile',
    preferences: 'preferences',
    security: 'security',
    privacy: 'privacy',
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

export type PersonalizationSignals = {
    version?: number;
    updatedAt?: string;
    settings?: {
        promptFrequency?: PromptFrequency;
    };
    metrics?: PersonalizationSignalMetrics;
    answers?: Record<string, StoredAnswer>;
    history?: StoredAnswer[];
    seenQuestionIds?: string[];
    lastPromptAt?: string;
    dismissedUntil?: string;
    lastSyncedSignature?: string;
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
    lifeGoals: [],
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

export const resolveEditTab = (value: string | null): EditTab =>
    value && LEGACY_TAB_MAP[value] ? LEGACY_TAB_MAP[value] : 'profile';

export const normalizeStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
};

export const normalizeTag = (value: string, maxLength: number): string =>
    value.replace(/\s+/g, ' ').trim().slice(0, maxLength);

export const addTag = (items: string[], rawTag: string, maxItems: number, maxLength: number): string[] => {
    const nextTag = normalizeTag(rawTag, maxLength);
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

export const buildProfileDraft = (source: SnapshotUser | null | undefined): ProfileDraft => ({
    name: source?.name || '',
    email: source?.email || '',
    avatarUrl: source?.avatarUrl || '',
    bio: source?.profile?.bio || '',
    location: source?.profile?.location || '',
    occupation: source?.profile?.occupation || '',
    website: source?.profile?.website || '',
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
    const answersCount = Object.keys(normalized.answers || {}).length;
    const historyCount = normalized.history?.length || 0;
    const promptedCount = normalized.metrics?.promptedCount || 0;
    const answeredCount = normalized.metrics?.answeredCount || 0;
    const dismissedCount = normalized.metrics?.dismissedCount || 0;
    const hasExtras = Boolean(
        normalized.lastPromptAt ||
        normalized.dismissedUntil ||
        normalized.lastSyncedSignature ||
        (normalized.seenQuestionIds?.length || 0) > 0
    );

    if (
        promptFrequency === 'normal' &&
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

    return normalized;
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
