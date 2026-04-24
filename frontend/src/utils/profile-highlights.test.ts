import { describe, expect, it } from 'vitest';
import {
    buildProfileHighlights,
    countReflectedMonths,
    pickFavoriteLine,
    type ProfileHighlightEntry,
} from './profile-highlights';

const makeEntry = (overrides: Partial<ProfileHighlightEntry>): ProfileHighlightEntry => ({
    id: overrides.id || 'entry-1',
    title: overrides.title ?? 'Untitled',
    content: overrides.content ?? 'A default entry that should be replaced in tests.',
    reflection: overrides.reflection ?? null,
    createdAt: overrides.createdAt || '2026-04-01T12:00:00.000Z',
    coverImage: overrides.coverImage ?? null,
});

describe('profile-highlights', () => {
    it('counts unique reflected months', () => {
        const months = countReflectedMonths([
            makeEntry({ id: 'a', createdAt: '2026-04-01T12:00:00.000Z' }),
            makeEntry({ id: 'b', createdAt: '2026-04-12T12:00:00.000Z' }),
            makeEntry({ id: 'c', createdAt: '2026-03-11T12:00:00.000Z' }),
            makeEntry({ id: 'd', createdAt: '2025-12-31T23:59:59.000Z' }),
        ]);

        expect(months).toBe(3);
    });

    it('prefers a reflective line when one is available', () => {
        const favorite = pickFavoriteLine([
            makeEntry({
                id: 'recent',
                reflection: 'I am finally noticing how much calmer I feel when I stop performing certainty and just tell the truth.',
                content: 'I wrote about school and a few other things today.',
            }),
            makeEntry({
                id: 'older',
                createdAt: '2026-03-28T12:00:00.000Z',
                content: 'Today was fine, but nothing in here should beat the reflection line from the more recent note.',
            }),
        ]);

        expect(favorite).toEqual({
            text: 'I am finally noticing how much calmer I feel when I stop performing certainty and just tell the truth.',
            entryId: 'recent',
            entryTitle: 'Untitled',
        });
    });

    it('builds highlights with the latest cover image and reflection summary', () => {
        const highlights = buildProfileHighlights([
            makeEntry({
                id: 'older',
                createdAt: '2026-02-15T12:00:00.000Z',
                content: 'This older note has enough words to count, but it should not provide the cover image.',
                coverImage: 'https://cdn.example.com/older.jpg',
            }),
            makeEntry({
                id: 'newer',
                createdAt: '2026-04-15T12:00:00.000Z',
                content: 'I kept circling the same thought until it finally felt honest enough to keep.',
                coverImage: 'https://cdn.example.com/newer.jpg',
            }),
        ]);

        expect(highlights.coverImage).toBe('https://cdn.example.com/newer.jpg');
        expect(highlights.monthsReflected).toBe(2);
        expect(highlights.favoriteLine).not.toBeNull();
    });
});
