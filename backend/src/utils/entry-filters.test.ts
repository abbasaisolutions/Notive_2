import { describe, expect, it } from 'vitest';
import { buildEntryListWhere, normalizeEntryMood } from './entry-filters';

describe('normalizeEntryMood', () => {
    it('keeps hopeful as a first-class mood instead of collapsing it to motivated', () => {
        expect(normalizeEntryMood('hopeful')).toBe('hopeful');
        expect(normalizeEntryMood('optimistic')).toBe('hopeful');
    });
});

describe('buildEntryListWhere', () => {
    it('filters hopeful moods using hopeful variants rather than motivated ones', () => {
        const where = buildEntryListWhere({
            userId: 'user-123',
            mood: 'hopeful',
        });

        expect(where).toMatchObject({
            userId: 'user-123',
            deletedAt: null,
        });
        expect(where).toHaveProperty('OR');
        expect(where.OR).toEqual(expect.arrayContaining([
            { mood: { equals: 'hopeful', mode: 'insensitive' } },
            { mood: { equals: 'optimistic', mode: 'insensitive' } },
        ]));
        expect(where.OR).not.toEqual(expect.arrayContaining([
            { mood: { equals: 'motivated', mode: 'insensitive' } },
        ]));
    });
});
