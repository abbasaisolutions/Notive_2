import { describe, expect, it } from 'vitest';
import {
    appSessionSchema,
    createSensitiveSessionSchema,
    deviceSignalSchema,
    patchProfileBasicsSchema,
    registerDeviceTokenSchema,
    updateEmailSchema,
} from '../utils/validation';

describe('request validation schemas', () => {
    it('rejects invalid avatar URLs in profile basics updates', () => {
        const result = patchProfileBasicsSchema.safeParse({
            avatarUrl: 'ftp://example.com/avatar.png',
        });

        expect(result.success).toBe(false);
    });

    it('requires a password or Google credential for sensitive-session unlocks', () => {
        const result = createSensitiveSessionSchema.safeParse({});

        expect(result.success).toBe(false);
    });

    it('requires a valid email confirmation payload for sign-in email changes', () => {
        const result = updateEmailSchema.safeParse({
            sensitiveActionToken: 'token',
            newEmail: 'not-an-email',
            confirmEmail: 'still-bad',
        });

        expect(result.success).toBe(false);
    });

    it('rejects unsupported device token platforms', () => {
        const result = registerDeviceTokenSchema.safeParse({
            token: 'abc123',
            platform: 'windows-phone',
        });

        expect(result.success).toBe(false);
    });

    it('requires structured device signal payloads', () => {
        const result = deviceSignalSchema.safeParse({
            signalType: 'spotify',
            data: 'not-an-object',
        });

        expect(result.success).toBe(false);
    });

    it('requires positive app session durations', () => {
        const result = appSessionSchema.safeParse({
            sessionMinutes: 0,
        });

        expect(result.success).toBe(false);
    });
});
