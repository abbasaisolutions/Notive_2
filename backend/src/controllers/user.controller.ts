import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { buildProfileContextSummary } from '../services/profile-context.service';
import { emailService } from '../services/email.service';
import { verifyGoogleCredential } from '../utils/google-auth';
import { generateSensitiveActionToken, verifySensitiveActionToken } from '../utils/jwt';
import { hashToken } from '../utils/token-security';

const sanitizeOptionalString = (value: unknown, maxLength = 240): string | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, maxLength);
};

const sanitizeOptionalText = (value: unknown, maxLength = 5000): string | null | undefined =>
    sanitizeOptionalString(value, maxLength);

const sanitizeStringArray = (value: unknown, maxItems = 20, maxLength = 80): string[] | undefined => {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) return undefined;

    const cleaned = value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
        .map((item) => item.slice(0, maxLength));

    return Array.from(new Set(cleaned)).slice(0, maxItems);
};

const sanitizeOptionalDate = (value: unknown): Date | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const parsed = new Date(value as string);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error('Invalid date value');
    }
    return parsed;
};

const sanitizeOptionalHttpUrl = (value: unknown, maxLength = 2000): string | null | undefined => {
    const sanitized = sanitizeOptionalString(value, maxLength);
    if (sanitized === undefined || sanitized === null) {
        return sanitized;
    }

    try {
        const parsed = new URL(sanitized);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return undefined;
        }
        return parsed.toString();
    } catch {
        return undefined;
    }
};

const removeUndefinedFields = (fields: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(
        Object.entries(fields).filter(([, value]) => value !== undefined)
    );

const sanitizeOptionalJsonObject = (
    value: unknown,
    maxSerializedLength = 120000
): Record<string, unknown> | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'object' || Array.isArray(value)) return undefined;

    try {
        const serialized = JSON.stringify(value);
        if (!serialized || serialized.length > maxSerializedLength) {
            return undefined;
        }
        return JSON.parse(serialized) as Record<string, unknown>;
    } catch {
        return undefined;
    }
};

type PersonalizationSignalMetrics = {
    promptedCount: number;
    answeredCount: number;
    dismissedCount: number;
    lastActionAt?: string;
};

type PersonalizationSignalHistoryAnswer = {
    questionId?: string;
    field?: string;
    value?: string;
    label?: string;
    pathname?: string;
    answeredAt?: string;
};

type PersonalizationSignalsSnapshot = {
    metrics: PersonalizationSignalMetrics;
    settings: {
        promptFrequency?: string;
    };
    history: PersonalizationSignalHistoryAnswer[];
};

type PersonalizationEventDraft = {
    eventType: 'PROMPT_SHOWN' | 'PROMPT_DISMISSED' | 'ANSWER_CAPTURED' | 'SETTINGS_CHANGED';
    questionId?: string;
    field?: string;
    value?: string;
    pathname?: string;
    metadata?: Record<string, unknown> | null;
    occurredAt: Date;
};

const SUPPORTED_PROMPT_FREQUENCIES = new Set(['off', 'low', 'normal', 'high']);
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SENSITIVE_ACTION_WINDOW_MS = 10 * 60 * 1000;

const hasText = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;

const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;

const asTrimmedString = (value: unknown, maxLength = 240): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return trimmed.slice(0, maxLength);
};

const asPositiveInteger = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0
        ? Math.floor(value)
        : 0;

const asIsoDateString = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed.toISOString();
};

const asDate = (value: string | undefined): Date | null => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
};

const asPromptFrequency = (value: unknown): string | undefined => {
    const parsed = asTrimmedString(value, 20);
    if (!parsed) return undefined;
    return SUPPORTED_PROMPT_FREQUENCIES.has(parsed) ? parsed : undefined;
};

const sanitizeEmail = (value: unknown): string | null | undefined => {
    const sanitized = sanitizeOptionalString(value, 320);
    if (sanitized === undefined || sanitized === null) {
        return sanitized;
    }

    const normalized = sanitized.toLowerCase();
    return EMAIL_REGEX.test(normalized) ? normalized : undefined;
};

const hasCompletedOnboardingCore = (source: {
    primaryGoal?: unknown;
    focusArea?: unknown;
    starterPrompt?: unknown;
} | null | undefined): boolean =>
    hasText(source?.primaryGoal) &&
    hasText(source?.focusArea) &&
    hasText(source?.starterPrompt);

const asExistingDate = (value: unknown): Date | null => {
    if (value instanceof Date) return value;
    if (typeof value !== 'string') return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const resolveOnboardingCompletedAt = (
    currentProfile: Record<string, unknown> | null | undefined,
    profileData: Record<string, unknown>
): Date | null => {
    const merged = {
        primaryGoal: profileData.primaryGoal !== undefined ? profileData.primaryGoal : currentProfile?.primaryGoal,
        focusArea: profileData.focusArea !== undefined ? profileData.focusArea : currentProfile?.focusArea,
        starterPrompt: profileData.starterPrompt !== undefined ? profileData.starterPrompt : currentProfile?.starterPrompt,
    };

    if (!hasCompletedOnboardingCore(merged)) {
        return null;
    }

    if (profileData.onboardingCompletedAt instanceof Date) {
        return profileData.onboardingCompletedAt;
    }

    return asExistingDate(currentProfile?.onboardingCompletedAt) || new Date();
};

const getSensitiveActionExpiry = (): string =>
    new Date(Date.now() + SENSITIVE_ACTION_WINDOW_MS).toISOString();

const getRetainedRefreshTokens = (req: Request): string[] => {
    const refreshToken =
        typeof req.cookies?.refreshToken === 'string'
            ? req.cookies.refreshToken
            : typeof req.body?.refreshToken === 'string'
                ? req.body.refreshToken
                : null;

    if (!refreshToken) {
        return [];
    }

    return Array.from(new Set([refreshToken, hashToken(refreshToken)]));
};

const readPersonalizationSignalsSnapshot = (signals: unknown): PersonalizationSignalsSnapshot => {
    const source = asRecord(signals) || {};
    const metricsSource = asRecord(source.metrics) || {};
    const settingsSource = asRecord(source.settings) || {};
    const historySource = Array.isArray(source.history) ? source.history : [];

    const history = historySource
        .map((item) => {
            const record = asRecord(item);
            if (!record) return null;
            const answeredAt = asIsoDateString(record.answeredAt);
            const value = asTrimmedString(record.value, 5000);
            if (!answeredAt || !value) return null;

            return {
                questionId: asTrimmedString(record.questionId, 120),
                field: asTrimmedString(record.field, 120),
                value,
                label: asTrimmedString(record.label, 240),
                pathname: asTrimmedString(record.pathname, 500),
                answeredAt,
            } as PersonalizationSignalHistoryAnswer;
        })
        .filter((item): item is PersonalizationSignalHistoryAnswer => item !== null);

    return {
        metrics: {
            promptedCount: asPositiveInteger(metricsSource.promptedCount),
            answeredCount: asPositiveInteger(metricsSource.answeredCount),
            dismissedCount: asPositiveInteger(metricsSource.dismissedCount),
            lastActionAt: asIsoDateString(metricsSource.lastActionAt),
        },
        settings: {
            promptFrequency: asPromptFrequency(settingsSource.promptFrequency),
        },
        history,
    };
};

const historyAnswerKey = (item: PersonalizationSignalHistoryAnswer): string => {
    const questionId = item.questionId || '';
    const field = item.field || '';
    const value = item.value || '';
    const answeredAt = item.answeredAt || '';
    return `${questionId}::${field}::${value}::${answeredAt}`;
};

const buildPersonalizationEventFingerprint = (
    userId: string,
    draft: PersonalizationEventDraft
): string => {
    const payload = JSON.stringify({
        userId,
        eventType: draft.eventType,
        questionId: draft.questionId || null,
        field: draft.field || null,
        value: draft.value || null,
        pathname: draft.pathname || null,
        occurredAt: draft.occurredAt.toISOString(),
        metadata: draft.metadata || null,
    });

    return createHash('sha256').update(payload).digest('hex');
};

const buildPersonalizationTelemetryEvents = (input: {
    userId: string;
    profileId?: string | null;
    previousSignals: unknown;
    nextSignals: Record<string, unknown> | null;
}): Prisma.PersonalizationEventCreateManyInput[] => {
    const { userId, profileId, previousSignals, nextSignals } = input;
    const previous = readPersonalizationSignalsSnapshot(previousSignals);
    const next = readPersonalizationSignalsSnapshot(nextSignals);
    const now = new Date();
    const drafts: PersonalizationEventDraft[] = [];

    const previousHistory = new Set(previous.history.map(historyAnswerKey));
    let newAnswerCount = 0;

    for (const answer of next.history) {
        const key = historyAnswerKey(answer);
        if (previousHistory.has(key)) continue;

        const occurredAt = asDate(answer.answeredAt) || now;
        drafts.push({
            eventType: 'ANSWER_CAPTURED',
            questionId: answer.questionId,
            field: answer.field,
            value: answer.value,
            pathname: answer.pathname,
            metadata: answer.label ? { label: answer.label, source: 'signals_history' } : { source: 'signals_history' },
            occurredAt,
        });
        newAnswerCount += 1;
    }

    const promptedDelta = Math.max(0, next.metrics.promptedCount - previous.metrics.promptedCount);
    if (promptedDelta > 0) {
        drafts.push({
            eventType: 'PROMPT_SHOWN',
            occurredAt: asDate(next.metrics.lastActionAt) || now,
            metadata: {
                delta: promptedDelta,
                oldCount: previous.metrics.promptedCount,
                newCount: next.metrics.promptedCount,
                source: 'signals_metrics',
            },
        });
    }

    const dismissedDelta = Math.max(0, next.metrics.dismissedCount - previous.metrics.dismissedCount);
    if (dismissedDelta > 0) {
        drafts.push({
            eventType: 'PROMPT_DISMISSED',
            occurredAt: asDate(next.metrics.lastActionAt) || now,
            metadata: {
                delta: dismissedDelta,
                oldCount: previous.metrics.dismissedCount,
                newCount: next.metrics.dismissedCount,
                source: 'signals_metrics',
            },
        });
    }

    const answeredDelta = Math.max(0, next.metrics.answeredCount - previous.metrics.answeredCount);
    if (answeredDelta > newAnswerCount) {
        drafts.push({
            eventType: 'ANSWER_CAPTURED',
            occurredAt: asDate(next.metrics.lastActionAt) || now,
            metadata: {
                delta: answeredDelta - newAnswerCount,
                oldCount: previous.metrics.answeredCount,
                newCount: next.metrics.answeredCount,
                source: 'signals_metrics',
                synthetic: true,
            },
        });
    }

    const previousFrequency = previous.settings.promptFrequency;
    const nextFrequency = next.settings.promptFrequency;
    if (nextFrequency && nextFrequency !== previousFrequency) {
        drafts.push({
            eventType: 'SETTINGS_CHANGED',
            field: 'promptFrequency',
            value: nextFrequency,
            occurredAt: now,
            metadata: {
                from: previousFrequency || null,
                to: nextFrequency,
            },
        });
    }

    const telemetryRows = drafts
        .map((draft) => ({
            userId,
            profileId: profileId || null,
            eventType: draft.eventType,
            questionId: draft.questionId || null,
            field: draft.field || null,
            value: draft.value || null,
            pathname: draft.pathname || null,
            metadata: draft.metadata
                ? (draft.metadata as Prisma.InputJsonValue)
                : undefined,
            occurredAt: draft.occurredAt,
            fingerprint: buildPersonalizationEventFingerprint(userId, draft),
        }))
        .filter((row, index, array) => array.findIndex((item) => item.fingerprint === row.fingerprint) === index);

    return telemetryRows;
};

const publicUserSelect = {
    id: true,
    email: true,
    name: true,
    avatarUrl: true,
    role: true,
    password: true,
    createdAt: true,
    updatedAt: true,
    profile: true,
} satisfies Prisma.UserSelect;

type PublicUserRecord = Prisma.UserGetPayload<{
    select: typeof publicUserSelect;
}>;

const fetchPublicUser = async (userId: string): Promise<PublicUserRecord | null> =>
    prisma.user.findUnique({
        where: { id: userId },
        select: publicUserSelect,
    });

const toConflictTimestamp = (value: unknown): string | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const parsed = new Date(value as string);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error('Invalid conflict timestamp');
    }
    return parsed.toISOString();
};

const buildPublicUserResponse = (user: PublicUserRecord) => {
    const { password, ...safeUser } = user;
    return {
        ...safeUser,
        hasPassword: Boolean(password),
        profileContext: buildProfileContextSummary(user.profile),
    };
};

const sendProfileConflict = async (
    res: Response,
    userId: string,
    expectedUserUpdatedAt: string | null | undefined,
    expectedProfileUpdatedAt: string | null | undefined
): Promise<boolean> => {
    if (expectedUserUpdatedAt === undefined && expectedProfileUpdatedAt === undefined) {
        return false;
    }

    const current = await fetchPublicUser(userId);
    if (!current) {
        res.status(404).json({ message: 'User not found' });
        return true;
    }

    const currentUserUpdatedAt = current.updatedAt.toISOString();
    const currentProfileUpdatedAt = current.profile?.updatedAt
        ? new Date(current.profile.updatedAt).toISOString()
        : null;

    const userChanged = expectedUserUpdatedAt !== undefined && expectedUserUpdatedAt !== currentUserUpdatedAt;
    const profileChanged = expectedProfileUpdatedAt !== undefined && expectedProfileUpdatedAt !== currentProfileUpdatedAt;

    if (!userChanged && !profileChanged) {
        return false;
    }

    res.status(409).json({
        message: 'Profile data changed in another session. Reload the latest data before saving.',
        user: buildPublicUserResponse(current),
        conflict: {
            userUpdatedAt: currentUserUpdatedAt,
            profileUpdatedAt: currentProfileUpdatedAt,
        },
    });
    return true;
};

const updateUserAndProfile = async (input: {
    userId: string;
    userData?: Record<string, unknown>;
    profileData?: Record<string, unknown>;
    nextSignals?: Record<string, unknown> | null;
}) => {
    const userData = removeUndefinedFields(input.userData || {});
    const profileData = removeUndefinedFields(input.profileData || {});
    const hasUserMutation = Object.keys(userData).length > 0;
    const hasProfileMutation = Object.keys(profileData).length > 0;

    const existingProfile = (hasProfileMutation || input.nextSignals !== undefined)
        ? await prisma.userProfile.findUnique({
            where: { userId: input.userId },
            select: {
                id: true,
                primaryGoal: true,
                focusArea: true,
                starterPrompt: true,
                onboardingCompletedAt: true,
                personalizationSignals: true,
            },
        })
        : null;

    const previousProfileSignals = input.nextSignals !== undefined ? existingProfile : null;

    const nextProfileData = hasProfileMutation
        ? {
            ...profileData,
            onboardingCompletedAt: resolveOnboardingCompletedAt(existingProfile, profileData),
        }
        : profileData;

    let user: PublicUserRecord | null = null;
    if (hasUserMutation || hasProfileMutation) {
        user = await prisma.user.update({
            where: { id: input.userId },
            data: {
                ...(hasUserMutation ? userData : {}),
                ...(hasProfileMutation
                    ? {
                        profile: {
                            upsert: {
                                create: {
                                    lifeGoals: [],
                                    outputGoals: [],
                                    ...nextProfileData,
                                },
                                update: nextProfileData,
                            },
                        },
                    }
                    : {}),
            },
            select: publicUserSelect,
        });
    } else {
        user = await fetchPublicUser(input.userId);
    }

    if (!user) {
        throw new Error('User not found');
    }

    if (input.nextSignals !== undefined) {
        try {
            const telemetryEvents = buildPersonalizationTelemetryEvents({
                userId: input.userId,
                profileId: user.profile?.id || previousProfileSignals?.id || null,
                previousSignals: previousProfileSignals?.personalizationSignals || null,
                nextSignals: input.nextSignals,
            });

            if (telemetryEvents.length > 0) {
                await prisma.personalizationEvent.createMany({
                    data: telemetryEvents,
                    skipDuplicates: true,
                });
            }
        } catch (telemetryError) {
            console.error('Personalization telemetry sync error:', telemetryError);
        }
    }

    return user;
};

/**
 * Get current user profile
 */
export const getProfile = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const user = await fetchPublicUser(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.json({
            user: buildPublicUserResponse(user),
        });
    } catch (error) {
        console.error('Get profile error:', error);
        return res.status(500).json({ message: 'Failed to fetch profile' });
    }
};

export const patchProfileBasics = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        let expectedUserUpdatedAt: string | null | undefined;
        let expectedProfileUpdatedAt: string | null | undefined;

        try {
            expectedUserUpdatedAt = toConflictTimestamp(req.body.expectedUserUpdatedAt);
            expectedProfileUpdatedAt = toConflictTimestamp(req.body.expectedProfileUpdatedAt);
        } catch {
            return res.status(400).json({ message: 'Invalid conflict timestamp' });
        }

        if (await sendProfileConflict(res, userId, expectedUserUpdatedAt, expectedProfileUpdatedAt)) {
            return;
        }

        if (req.body.email !== undefined) {
            return res.status(400).json({ message: 'Use security settings to change your sign-in email' });
        }

        const safeName = sanitizeOptionalString(req.body.name, 120);
        const safeAvatarUrl = sanitizeOptionalHttpUrl(req.body.avatarUrl, 2000);
        const safeBio = sanitizeOptionalText(req.body.bio, 5000);
        const safeLocation = sanitizeOptionalString(req.body.location, 160);
        const safeOccupation = sanitizeOptionalString(req.body.occupation, 160);
        const safeWebsite = sanitizeOptionalHttpUrl(req.body.website, 2000);
        const safeLifeGoals = sanitizeStringArray(req.body.lifeGoals, 20, 120);

        if (req.body.avatarUrl !== undefined && safeAvatarUrl === undefined) {
            return res.status(400).json({ message: 'Invalid avatar URL' });
        }

        if (req.body.website !== undefined && safeWebsite === undefined) {
            return res.status(400).json({ message: 'Invalid website URL' });
        }

        const user = await updateUserAndProfile({
            userId,
            userData: {
                ...(safeName !== undefined ? { name: safeName } : {}),
                ...(safeAvatarUrl !== undefined ? { avatarUrl: safeAvatarUrl } : {}),
            },
            profileData: {
                bio: safeBio,
                location: safeLocation,
                occupation: safeOccupation,
                website: safeWebsite,
                ...(safeLifeGoals !== undefined ? { lifeGoals: safeLifeGoals } : {}),
            },
        });

        return res.json({
            message: 'Profile details updated',
            user: buildPublicUserResponse(user),
        });
    } catch (error) {
        console.error('Patch profile basics error:', error);
        return res.status(500).json({ message: 'Failed to update profile details' });
    }
};

export const patchProfilePreferences = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        let expectedUserUpdatedAt: string | null | undefined;
        let expectedProfileUpdatedAt: string | null | undefined;

        try {
            expectedUserUpdatedAt = toConflictTimestamp(req.body.expectedUserUpdatedAt);
            expectedProfileUpdatedAt = toConflictTimestamp(req.body.expectedProfileUpdatedAt);
        } catch {
            return res.status(400).json({ message: 'Invalid conflict timestamp' });
        }

        if (await sendProfileConflict(res, userId, expectedUserUpdatedAt, expectedProfileUpdatedAt)) {
            return;
        }

        let safeOnboardingCompletedAt: Date | null | undefined;
        try {
            safeOnboardingCompletedAt = sanitizeOptionalDate(req.body.onboardingCompletedAt);
        } catch {
            return res.status(400).json({ message: 'Invalid onboarding completion date' });
        }

        const user = await updateUserAndProfile({
            userId,
            profileData: {
                primaryGoal: sanitizeOptionalString(req.body.primaryGoal, 60),
                focusArea: sanitizeOptionalString(req.body.focusArea, 60),
                experienceLevel: sanitizeOptionalString(req.body.experienceLevel, 60),
                writingPreference: sanitizeOptionalString(req.body.writingPreference, 60),
                starterPrompt: sanitizeOptionalText(req.body.starterPrompt, 5000),
                importPreference: sanitizeOptionalString(req.body.importPreference, 60),
                onboardingCompletedAt: safeOnboardingCompletedAt,
                ...(sanitizeStringArray(req.body.outputGoals, 20, 80) !== undefined
                    ? { outputGoals: sanitizeStringArray(req.body.outputGoals, 20, 80) }
                    : {}),
            },
        });

        return res.json({
            message: 'Preferences updated',
            user: buildPublicUserResponse(user),
        });
    } catch (error) {
        console.error('Patch profile preferences error:', error);
        return res.status(500).json({ message: 'Failed to update preferences' });
    }
};

export const patchProfilePrivacy = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        let expectedUserUpdatedAt: string | null | undefined;
        let expectedProfileUpdatedAt: string | null | undefined;

        try {
            expectedUserUpdatedAt = toConflictTimestamp(req.body.expectedUserUpdatedAt);
            expectedProfileUpdatedAt = toConflictTimestamp(req.body.expectedProfileUpdatedAt);
        } catch {
            return res.status(400).json({ message: 'Invalid conflict timestamp' });
        }

        if (await sendProfileConflict(res, userId, expectedUserUpdatedAt, expectedProfileUpdatedAt)) {
            return;
        }

        const safePersonalizationSignals = sanitizeOptionalJsonObject(req.body.personalizationSignals);
        if (req.body.personalizationSignals !== undefined && safePersonalizationSignals === undefined) {
            return res.status(400).json({ message: 'Invalid personalization payload' });
        }

        const user = await updateUserAndProfile({
            userId,
            profileData: {
                personalizationSignals: safePersonalizationSignals,
            },
            nextSignals: safePersonalizationSignals ?? null,
        });

        return res.json({
            message: 'Privacy and personalization settings updated',
            user: buildPublicUserResponse(user),
        });
    } catch (error) {
        console.error('Patch profile privacy error:', error);
        return res.status(500).json({ message: 'Failed to update privacy settings' });
    }
};

/**
 * Update user profile
 */
export const updateProfile = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const {
            name,
            email,
            avatarUrl,
            bio,
            location,
            occupation,
            website,
            lifeGoals,
            primaryGoal,
            focusArea,
            experienceLevel,
            writingPreference,
            starterPrompt,
            outputGoals,
            importPreference,
            personalizationSignals,
            onboardingCompletedAt,
        } = req.body;

        if (email !== undefined) {
            return res.status(400).json({ message: 'Use security settings to change your sign-in email' });
        }

        const safeName = sanitizeOptionalString(name, 120);
        const safeAvatarUrl = sanitizeOptionalHttpUrl(avatarUrl, 2000);
        const safeBio = sanitizeOptionalText(bio, 5000);
        const safeLocation = sanitizeOptionalString(location, 160);
        const safeOccupation = sanitizeOptionalString(occupation, 160);
        const safeWebsite = sanitizeOptionalHttpUrl(website, 2000);
        const safeLifeGoals = sanitizeStringArray(lifeGoals, 20, 120);
        const safePrimaryGoal = sanitizeOptionalString(primaryGoal, 60);
        const safeFocusArea = sanitizeOptionalString(focusArea, 60);
        const safeExperienceLevel = sanitizeOptionalString(experienceLevel, 60);
        const safeWritingPreference = sanitizeOptionalString(writingPreference, 60);
        const safeStarterPrompt = sanitizeOptionalText(starterPrompt, 5000);
        const safeOutputGoals = sanitizeStringArray(outputGoals, 20, 80);
        const safeImportPreference = sanitizeOptionalString(importPreference, 60);
        const safePersonalizationSignals = sanitizeOptionalJsonObject(personalizationSignals);
        let safeOnboardingCompletedAt: Date | null | undefined;
        try {
            safeOnboardingCompletedAt = sanitizeOptionalDate(onboardingCompletedAt);
        } catch {
            return res.status(400).json({ message: 'Invalid onboarding completion date' });
        }

        if (avatarUrl !== undefined && safeAvatarUrl === undefined) {
            return res.status(400).json({ message: 'Invalid avatar URL' });
        }

        if (website !== undefined && safeWebsite === undefined) {
            return res.status(400).json({ message: 'Invalid website URL' });
        }

        const previousProfileSignals = safePersonalizationSignals !== undefined
            ? await prisma.userProfile.findUnique({
                where: { userId },
                select: {
                    id: true,
                    personalizationSignals: true,
                },
            })
            : null;

        const profileSharedFields = removeUndefinedFields({
            bio: safeBio,
            location: safeLocation,
            occupation: safeOccupation,
            website: safeWebsite,
            primaryGoal: safePrimaryGoal,
            focusArea: safeFocusArea,
            experienceLevel: safeExperienceLevel,
            writingPreference: safeWritingPreference,
            starterPrompt: safeStarterPrompt,
            importPreference: safeImportPreference,
            personalizationSignals: safePersonalizationSignals,
            onboardingCompletedAt: safeOnboardingCompletedAt,
        });

        const profileCreateData: Record<string, unknown> = {
            ...profileSharedFields,
            lifeGoals: safeLifeGoals || [],
            outputGoals: safeOutputGoals || [],
        };

        const profileUpdateData: Record<string, unknown> = {
            ...profileSharedFields,
            ...(safeLifeGoals !== undefined ? { lifeGoals: safeLifeGoals } : {}),
            ...(safeOutputGoals !== undefined ? { outputGoals: safeOutputGoals } : {}),
        };

        const hasProfileMutation = [
            safeBio,
            safeLocation,
            safeOccupation,
            safeWebsite,
            safeLifeGoals,
            safePrimaryGoal,
            safeFocusArea,
            safeExperienceLevel,
            safeWritingPreference,
            safeStarterPrompt,
            safeOutputGoals,
            safeImportPreference,
            safePersonalizationSignals,
            safeOnboardingCompletedAt,
        ].some((value) => value !== undefined);

        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                ...(safeName !== undefined && { name: safeName }),
                ...(safeAvatarUrl !== undefined && { avatarUrl: safeAvatarUrl }),
                ...(hasProfileMutation
                    ? {
                        // Update or create the linked profile only when profile payload is present.
                        profile: {
                            upsert: {
                                create: profileCreateData,
                                update: profileUpdateData,
                            }
                        },
                    }
                    : {}),
            },
            select: publicUserSelect,
        });

        if (safePersonalizationSignals !== undefined) {
            try {
                const telemetryEvents = buildPersonalizationTelemetryEvents({
                    userId,
                    profileId: user.profile?.id || previousProfileSignals?.id || null,
                    previousSignals: previousProfileSignals?.personalizationSignals || null,
                    nextSignals: safePersonalizationSignals,
                });

                if (telemetryEvents.length > 0) {
                    await prisma.personalizationEvent.createMany({
                        data: telemetryEvents,
                        skipDuplicates: true,
                    });
                }
            } catch (telemetryError) {
                console.error('Personalization telemetry sync error:', telemetryError);
            }
        }

        return res.json({
            message: 'Profile updated',
            user: buildPublicUserResponse(user),
        });
    } catch (error) {
        console.error('Update profile error:', error);
        return res.status(500).json({ message: 'Failed to update profile' });
    }
};

/**
 * Re-authenticate a signed-in user for sensitive account actions
 */
export const createSensitiveSession = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
        const googleCredential = typeof req.body?.googleCredential === 'string' ? req.body.googleCredential : '';

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                password: true,
                googleId: true,
                isBanned: true,
            },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.isBanned) {
            return res.status(403).json({ message: 'Your account has been suspended' });
        }

        let verifiedBy: 'password' | 'google' | null = null;

        if (user.password && currentPassword) {
            const isValid = await bcrypt.compare(currentPassword, user.password);
            if (!isValid) {
                return res.status(401).json({ message: 'Current password is incorrect' });
            }
            verifiedBy = 'password';
        } else if (googleCredential) {
            if (!user.googleId) {
                return res.status(400).json({ message: 'Google re-verification is not available for this account' });
            }

            let verifiedGoogle;
            try {
                verifiedGoogle = await verifyGoogleCredential(googleCredential);
            } catch {
                return res.status(401).json({ message: 'Google re-verification failed' });
            }
            const matchesAccount =
                verifiedGoogle.googleId === user.googleId ||
                verifiedGoogle.email.toLowerCase() === user.email.toLowerCase();

            if (!matchesAccount) {
                return res.status(401).json({ message: 'Google account does not match this user' });
            }

            verifiedBy = 'google';
        }

        if (!verifiedBy) {
            if (user.password) {
                return res.status(400).json({ message: 'Current password is required to unlock sensitive account changes' });
            }
            return res.status(400).json({ message: 'Use Google re-verification to unlock sensitive account changes' });
        }

        const sensitiveActionToken = generateSensitiveActionToken({
            userId: user.id,
            email: user.email,
        });

        return res.json({
            message: 'Sensitive account changes unlocked',
            sensitiveActionToken,
            verifiedBy,
            expiresAt: getSensitiveActionExpiry(),
        });
    } catch (error) {
        console.error('Create sensitive session error:', error);
        return res.status(500).json({ message: 'Failed to verify your identity' });
    }
};

/**
 * Update sign-in email with a short-lived verified session
 */
export const updateEmail = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const sensitiveActionToken = typeof req.body?.sensitiveActionToken === 'string' ? req.body.sensitiveActionToken : '';
        const safeNewEmail = sanitizeEmail(req.body?.newEmail);
        const safeConfirmEmail = sanitizeEmail(req.body?.confirmEmail);

        if (!safeNewEmail || !safeConfirmEmail) {
            return res.status(400).json({ message: 'A valid new email and confirmation are required' });
        }

        if (safeNewEmail !== safeConfirmEmail) {
            return res.status(400).json({ message: 'New email and confirmation do not match' });
        }

        const sensitivePayload = verifySensitiveActionToken(sensitiveActionToken);
        if (!sensitivePayload || sensitivePayload.userId !== userId) {
            return res.status(403).json({ message: 'Re-verify your identity before changing your sign-in email' });
        }

        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                password: true,
                avatarUrl: true,
                role: true,
                createdAt: true,
                updatedAt: true,
                profile: true,
            },
        });

        if (!currentUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (currentUser.email.toLowerCase() === safeNewEmail) {
            return res.status(400).json({ message: 'That is already your current sign-in email' });
        }

        const existing = await prisma.user.findFirst({
            where: {
                email: safeNewEmail,
                NOT: { id: userId },
            },
            select: { id: true },
        });

        if (existing) {
            return res.status(409).json({ message: 'Email already in use' });
        }

        const retainedTokens = getRetainedRefreshTokens(req);
        const updatedUser = await prisma.$transaction(async (tx) => {
            const nextUser = await tx.user.update({
                where: { id: userId },
                data: { email: safeNewEmail },
                select: publicUserSelect,
            });

            await tx.refreshToken.deleteMany({
                where: retainedTokens.length > 0
                    ? {
                        userId,
                        NOT: {
                            token: {
                                in: retainedTokens,
                            },
                        },
                    }
                    : { userId },
            });

            return nextUser;
        });

        try {
            await emailService.sendEmailChangeAlert({
                previousEmail: currentUser.email,
                nextEmail: safeNewEmail,
                name: currentUser.name,
            });
        } catch (emailError) {
            console.error('Email change alert error:', emailError);
        }

        return res.json({
            message: 'Sign-in email updated',
            user: buildPublicUserResponse(updatedUser),
        });
    } catch (error) {
        console.error('Update email error:', error);
        return res.status(500).json({ message: 'Failed to update sign-in email' });
    }
};

/**
 * Change password
 */
export const changePassword = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { currentPassword, newPassword } = req.body;
        const sensitiveActionToken = typeof req.body?.sensitiveActionToken === 'string' ? req.body.sensitiveActionToken : '';

        const sanitizedNewPassword = typeof newPassword === 'string' ? newPassword : '';
        const hasRequiredLength = sanitizedNewPassword.length >= PASSWORD_MIN_LENGTH;
        const hasRequiredComplexity = PASSWORD_COMPLEXITY_REGEX.test(sanitizedNewPassword);
        if (!hasRequiredLength || !hasRequiredComplexity) {
            return res.status(400).json({
                message: 'New password must be at least 8 characters and include uppercase, lowercase, and a number',
            });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const sensitivePayload = verifySensitiveActionToken(sensitiveActionToken);
        const hasVerifiedSensitiveSession = Boolean(sensitivePayload && sensitivePayload.userId === userId);

        // If user has a password (not SSO-only), verify current password unless a fresh sensitive session already exists.
        if (user.password) {
            if (!hasVerifiedSensitiveSession && !currentPassword) {
                return res.status(400).json({ message: 'Current password is required' });
            }
            if (!hasVerifiedSensitiveSession) {
                const isValid = await bcrypt.compare(currentPassword, user.password);
                if (!isValid) {
                    return res.status(400).json({ message: 'Current password is incorrect' });
                }
            }
        } else if (!hasVerifiedSensitiveSession) {
            return res.status(403).json({ message: 'Re-verify your identity before setting a password' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(sanitizedNewPassword, 10);
        const retainedTokens = getRetainedRefreshTokens(req);

        await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: userId },
                data: { password: hashedPassword },
            });
            await tx.refreshToken.deleteMany({
                where: retainedTokens.length > 0
                    ? {
                        userId,
                        NOT: {
                            token: {
                                in: retainedTokens,
                            },
                        },
                    }
                    : { userId },
            });
        });

        return res.json({
            message: 'Password updated successfully. Other saved sessions were revoked, and this device may ask for sign-in again when the current session expires.',
        });
    } catch (error) {
        console.error('Change password error:', error);
        return res.status(500).json({ message: 'Failed to change password' });
    }
};

/**
 * Export all user data (GDPR)
 */
export const exportData = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;

        const userData = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                profile: true,
                entries: true,
                chapters: true,
                socialConnections: true,
                refreshTokens: false, // Don't export security tokens
            },
        });

        if (!userData) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Clean user object (remove sensitive credentials)
        const { password, ...cleanData } = userData;

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=notive-data-${userId}.json`);

        return res.json(cleanData);
    } catch (error) {
        console.error('Export data error:', error);
        return res.status(500).json({ message: 'Failed to export data' });
    }
};

/**
 * Delete account and all data
 */
export const deleteAccount = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const sensitiveActionToken = typeof req.body?.sensitiveActionToken === 'string' ? req.body.sensitiveActionToken : '';
        const confirmText = typeof req.body?.confirmText === 'string' ? req.body.confirmText.trim().toLowerCase() : '';

        const sensitivePayload = verifySensitiveActionToken(sensitiveActionToken);
        if (!sensitivePayload || sensitivePayload.userId !== userId) {
            return res.status(403).json({ message: 'Re-verify your identity before deleting this account' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (confirmText !== user.email.toLowerCase()) {
            return res.status(400).json({ message: 'Type your sign-in email to confirm permanent deletion' });
        }

        // Prisma cascade delete will handle related data if configured, 
        // essentially we just need to delete the user.

        await prisma.user.delete({
            where: { id: userId },
        });

        res.clearCookie('refreshToken');

        return res.json({ message: 'Account permanently deleted' });
    } catch (error) {
        console.error('Delete account error:', error);
        return res.status(500).json({ message: 'Failed to delete account' });
    }
};

