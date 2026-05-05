import { describe, expect, it } from 'vitest';
import {
    getNotificationCategoryForType,
    shouldSendPushForType,
} from './notification-preferences.service';

const withNotifications = (notifications: Record<string, unknown>) => ({
    settings: { notifications },
});

describe('notification preferences', () => {
    it('routes portfolio evidence to the story material category', () => {
        expect(getNotificationCategoryForType('portfolio_evidence')).toBe('storyMaterial');
    });

    it('lets users disable story material separately from general insights', () => {
        expect(shouldSendPushForType(
            withNotifications({ insights: true, storyMaterial: false }),
            'portfolio_evidence',
        )).toBe(false);

        expect(shouldSendPushForType(
            withNotifications({ insights: false, storyMaterial: true }),
            'portfolio_evidence',
        )).toBe(true);
    });

    it('applies server-side quietness to low-urgency pushes', () => {
        expect(shouldSendPushForType(
            withNotifications({ quietness: 'balanced' }),
            'share_reaction',
        )).toBe(false);

        expect(shouldSendPushForType(
            withNotifications({ quietness: 'active' }),
            'share_reaction',
        )).toBe(true);

        expect(shouldSendPushForType(
            withNotifications({ quietness: 'gentle' }),
            'portfolio_evidence',
        )).toBe(true);
    });
});
