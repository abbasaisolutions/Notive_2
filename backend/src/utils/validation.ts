import { z } from 'zod/v4';
import { Request, Response, NextFunction } from 'express';
import { MIN_CHARACTERS_FOR_ENTRY_SAVE } from '../constants/entry-requirements';

// --- Reusable primitives ---

const trimmedString = z.string().trim();
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
    content: trimmedString.min(
        MIN_CHARACTERS_FOR_ENTRY_SAVE,
        `Content must be at least ${MIN_CHARACTERS_FOR_ENTRY_SAVE} characters.`
    ),
    contentHtml: z.string().optional(),
    mood: trimmedString.max(50).optional().nullable(),
    tags: z.array(z.string().trim().max(80)).max(30).optional(),
    coverImage: z.string().max(2000).optional().nullable(),
    chapterId: z.string().optional().nullable(),
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
