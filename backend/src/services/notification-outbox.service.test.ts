import { describe, expect, it } from 'vitest';
import {
    getStoryDiscoveryCopy,
    getStoryDiscoveryDelayMs,
} from './notification-outbox.service';

describe('notification outbox story discovery policy', () => {
    it('delays story discovery notifications by a human-feeling window', () => {
        const delay = getStoryDiscoveryDelayMs('user-1', 'entry-1');

        expect(delay).toBeGreaterThanOrEqual(3 * 60_000);
        expect(delay).toBeLessThanOrEqual(8 * 60_000);
    });

    it('uses story-material copy instead of instant extraction language', () => {
        const copy = getStoryDiscoveryCopy('user-1', 'entry-1', 'my latest entry');

        expect(copy.title.toLowerCase()).not.toContain('new story found');
        expect(copy.body.toLowerCase()).not.toContain('extracted');
        expect(copy.data?.type).toBe('portfolio_evidence');
        expect(copy.data?.link).toBe('/portfolio?highlight=entry-1');
    });
});
