import { describe, expect, it } from 'vitest';
import { buildJournalIntelligence, type IntelEntry } from './journal-intelligence.service';

const buildEntry = (
    id: string,
    content: string,
    lifeArea: string | null,
    daysAgo: number
): IntelEntry => {
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);

    return {
        id,
        content,
        mood: 'calm',
        tags: [],
        lifeArea,
        createdAt,
    };
};

describe('buildJournalIntelligence life balance', () => {
    it('does not invent dominant or neglected areas when nothing matches a life area', () => {
        const intelligence = buildJournalIntelligence([
            buildEntry('1', 'Today felt full and hard to name.', null, 3),
            buildEntry('2', 'I kept thinking about what matters next.', null, 2),
            buildEntry('3', 'A quiet day with a lot on my mind.', null, 1),
        ], []);

        expect(intelligence.lifeBalance.balanceScore).toBe(0);
        expect(intelligence.lifeBalance.dominantArea).toBe('Unknown');
        expect(intelligence.lifeBalance.neglectedArea).toBeNull();
        expect(intelligence.lifeBalance.areas.every((area) => area.entryCount === 0)).toBe(true);
    });

    it('surfaces the least represented covered area when the spread is clearly uneven', () => {
        const intelligence = buildJournalIntelligence([
            buildEntry('1', 'A reflective note about the day.', 'school', 6),
            buildEntry('2', 'Still sorting through what happened.', 'school', 5),
            buildEntry('3', 'Trying to be steady tonight.', 'school', 4),
            buildEntry('4', 'Needed a reset before bed.', 'friends', 3),
            buildEntry('5', 'A shorter note to clear my head.', 'friends', 2),
            buildEntry('6', 'Trying to slow down and listen inward.', 'family', 1),
        ], []);

        expect(intelligence.lifeBalance.dominantArea).toBe('School');
        expect(intelligence.lifeBalance.neglectedArea).toBe('Family');
        expect(
            intelligence.lifeBalance.areas.filter((area) => area.entryCount > 0).map((area) => area.area)
        ).toEqual(['School', 'Friends', 'Family']);
    });
});
