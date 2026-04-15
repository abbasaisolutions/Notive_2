import { z } from 'zod/v4';
import { Request, Response, NextFunction } from 'express';

// --- Reusable primitives ---

const trimmedString = z.string().trim();
const nullable = <T extends z.ZodTypeAny>(schema: T) => z.union([schema, z.null()]);
const optionalNullable = <T extends z.ZodTypeAny>(schema: T) => nullable(schema).optional();
const httpUrl = trimmedString
    .max(2000)
    .refine((value) => /^https?:\/\/\S+$/i.test(value), 'Expected an http(s) URL');
const stringArray = (maxItems: number, maxItemLength: number) =>
    z.array(z.string().trim().max(maxItemLength)).max(maxItems);
const optionalTimestamp = z.union([trimmedString.max(80), z.null()]).optional();
const email = trimmedString.toLowerCase().email('Invalid email address');
const password = trimmedString.min(8, 'Password must be at least 8 characters');

// --- Auth schemas ---

const MINIMUM_AGE = 13;

export const registerSchema = z.object({
    email,
    password: password.regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must include uppercase, lowercase, and a number'
    ),
    name: trimmedString.max(100).optional(),
    birthDate: trimmedString.min(1, 'Birth date is required').check(
        z.refine((val) => {
            const dob = new Date(`${val}T00:00:00.000Z`);
            if (isNaN(dob.getTime())) return false;
            const today = new Date();
            let age = today.getFullYear() - dob.getFullYear();
            const monthDiff = today.getMonth() - dob.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
                age--;
            }
            return age >= MINIMUM_AGE;
        }, `You must be at least ${MINIMUM_AGE} years old to create an account`)
    ),
});

export const loginSchema = z.object({
    email,
    password: trimmedString.min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
    email,
});

export const resetPasswordSchema = z.object({
    token: trimmedString.min(1, 'Token is required'),
    password: password.regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must include uppercase, lowercase, and a number'
    ),
});

// --- Entry schemas ---

export const createEntrySchema = z.object({
    title: trimmedString.max(500).optional().nullable(),
    content: trimmedString.min(1, 'Content is required'),
    contentHtml: z.string().optional(),
    mood: trimmedString.max(50).optional().nullable(),
    tags: z.array(z.string().trim().max(80)).max(30).optional(),
    coverImage: z.string().max(2000).optional().nullable(),
    chapterId: z.string().optional().nullable(),
    entryMode: z.enum(['quick', 'full']).optional(),
    autoTag: z.boolean().optional(),
    analysis: z.record(z.string(), z.unknown()).optional().nullable(),
    category: z.enum(['PERSONAL', 'PROFESSIONAL']).optional(),
    lifeArea: trimmedString.max(100).optional().nullable(),
    locationLat: z.number().min(-90).max(90).optional().nullable(),
    locationLng: z.number().min(-180).max(180).optional().nullable(),
    locationName: trimmedString.max(200).optional().nullable(),
});

export const updateEntrySchema = createEntrySchema.partial().omit({ content: true }).extend({
    content: trimmedString.min(1, 'Content is required').optional(),
});

// --- Reminder schemas ---

export const upsertReminderSchema = z.object({
    time: z.string().regex(/^\d{2}:\d{2}$/, 'Expected HH:MM format'),
    days: z.array(z.number().int().min(0).max(6)).max(7),
    timezone: trimmedString.min(1, 'Timezone is required').max(64),
    enabled: z.boolean().optional().default(true),
});

// --- Auth / identity schemas ---

export const googleCredentialSchema = z.object({
    credential: trimmedString.min(1, 'Google credential is required'),
});

export const createSensitiveSessionSchema = z.object({
    currentPassword: trimmedString.min(1, 'Current password is required').optional(),
    googleCredential: trimmedString.min(1, 'Google credential is required').optional(),
}).refine(
    (value) => Boolean(value.currentPassword || value.googleCredential),
    {
        message: 'Current password or Google credential is required',
        path: ['currentPassword'],
    }
);

export const updateEmailSchema = z.object({
    sensitiveActionToken: trimmedString.min(1, 'Sensitive action token is required'),
    newEmail: email,
    confirmEmail: email,
    refreshToken: trimmedString.min(1).optional(),
});

export const changePasswordSchema = z.object({
    sensitiveActionToken: trimmedString.min(1, 'Sensitive action token is required'),
    currentPassword: trimmedString.min(1).optional(),
    newPassword: password.regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must include uppercase, lowercase, and a number'
    ),
    refreshToken: trimmedString.min(1).optional(),
});

export const deleteAccountSchema = z.object({
    sensitiveActionToken: trimmedString.min(1, 'Sensitive action token is required'),
    confirmText: trimmedString.min(1, 'Confirmation text is required'),
});

// --- Profile schemas ---

const optimisticProfileLockSchema = z.object({
    expectedUserUpdatedAt: optionalTimestamp,
    expectedProfileUpdatedAt: optionalTimestamp,
});

const profileBasicsFieldsSchema = z.object({
    name: optionalNullable(trimmedString.max(120)),
    avatarUrl: optionalNullable(httpUrl),
    bio: optionalNullable(trimmedString.max(5000)),
    location: optionalNullable(trimmedString.max(160)),
    occupation: optionalNullable(trimmedString.max(160)),
    website: optionalNullable(httpUrl),
    lifeGoals: stringArray(20, 120).optional(),
    birthDate: optionalNullable(trimmedString.max(80)),
});

const profilePreferenceFieldsSchema = z.object({
    primaryGoal: optionalNullable(trimmedString.max(60)),
    focusArea: optionalNullable(trimmedString.max(60)),
    experienceLevel: optionalNullable(trimmedString.max(60)),
    writingPreference: optionalNullable(trimmedString.max(60)),
    starterPrompt: optionalNullable(trimmedString.max(5000)),
    outputGoals: stringArray(20, 80).optional(),
    importPreference: optionalNullable(trimmedString.max(60)),
    onboardingCompletedAt: optionalNullable(trimmedString.max(80)),
});

export const patchProfileBasicsSchema = optimisticProfileLockSchema.merge(profileBasicsFieldsSchema);

export const patchProfilePreferencesSchema = optimisticProfileLockSchema.merge(profilePreferenceFieldsSchema);

export const patchProfilePrivacySchema = optimisticProfileLockSchema.extend({
    personalizationSignals: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const updateProfileSchema = optimisticProfileLockSchema
    .merge(profileBasicsFieldsSchema)
    .merge(profilePreferenceFieldsSchema)
    .extend({
        personalizationSignals: z.record(z.string(), z.unknown()).nullable().optional(),
        email: optionalNullable(email),
    });

// --- Chapter / share / relationship schemas ---

export const createChapterSchema = z.object({
    name: trimmedString.min(1, 'Chapter name is required').max(120),
    description: optionalNullable(trimmedString.max(2000)),
    color: optionalNullable(z.string().trim().regex(/^#?[0-9a-f]{3,8}$/i, 'Expected a hex color').max(9)),
    icon: optionalNullable(trimmedString.max(16)),
});

export const updateChapterSchema = z.object({
    name: optionalNullable(trimmedString.max(120)),
    description: optionalNullable(trimmedString.max(2000)),
    color: optionalNullable(z.string().trim().regex(/^#?[0-9a-f]{3,8}$/i, 'Expected a hex color').max(9)),
    icon: optionalNullable(trimmedString.max(16)),
});

export const createShareLinkSchema = z.object({
    expiresIn: z.union([z.coerce.number().positive().max(24 * 365), z.null()]).optional(),
});

export const friendshipUserSchema = z.object({
    userId: trimmedString.min(1, 'userId is required').max(191),
});

// --- Device schemas ---

export const deviceSignalSchema = z.object({
    signalType: z.enum([
        'location_summary',
        'calendar',
        'spotify',
        'screen_time',
        'app_session',
        'notification',
        'wellness_checkin',
    ]),
    date: trimmedString.max(80).optional(),
    data: z.record(z.string(), z.unknown()),
    source: z.enum(['AUTO', 'SELF_REPORT', 'API']).optional(),
});

const nullableRating = z.union([z.coerce.number().int().min(1).max(5), z.null()]);

export const wellnessCheckinSchema = z.object({
    energyLevel: nullableRating.optional(),
    socialBattery: nullableRating.optional(),
    stressLevel: nullableRating.optional(),
    screenTimeFeeling: nullableRating.optional(),
    notificationPressure: nullableRating.optional(),
    notes: optionalNullable(trimmedString.max(500)),
}).refine(
    (value) =>
        value.energyLevel !== undefined
        || value.socialBattery !== undefined
        || value.stressLevel !== undefined
        || value.screenTimeFeeling !== undefined
        || value.notificationPressure !== undefined
        || value.notes !== undefined,
    {
        message: 'At least one wellness metric is required',
        path: ['energyLevel'],
    }
);

export const appSessionSchema = z.object({
    sessionMinutes: z.coerce.number().positive('sessionMinutes must be a positive number').max(24 * 60),
    entriesWritten: z.coerce.number().int().min(0).max(1000).optional(),
});

export const registerDeviceTokenSchema = z.object({
    token: trimmedString.min(1, 'token is required').max(4096),
    platform: z.enum(['android', 'ios', 'web']),
    deviceId: trimmedString.max(255).optional(),
    deviceName: trimmedString.max(255).optional(),
    appVersion: trimmedString.max(64).optional(),
    osVersion: trimmedString.max(64).optional(),
});

// --- Admin / legal schemas ---

export const adminActionSchema = z.object({
    reason: trimmedString.min(8, 'A reason of at least 8 characters is required'),
    supportNote: trimmedString.max(500).optional(),
});

export const updateUserRoleSchema = adminActionSchema.extend({
    role: z.enum(['USER', 'ADMIN', 'SUPERADMIN']),
});

export const accountDeletionRequestSchema = z.object({
    email,
    reason: trimmedString.max(2000).optional(),
});

// --- Middleware factory ---

export function validate<T extends z.ZodTypeAny>(schema: T) {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const issues = result.error.issues;
            const first = issues[0];
            return res.status(400).json({
                message: first?.message || 'Validation error',
                errors: issues.map((e: z.core.$ZodIssue) => ({
                    path: e.path.join('.'),
                    message: e.message,
                })),
            });
        }
        req.body = result.data;
        next();
    };
}
