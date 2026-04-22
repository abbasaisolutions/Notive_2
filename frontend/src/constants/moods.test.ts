import { describe, expect, it } from 'vitest';
import { getMoodColor, getMoodEmoji, getMoodScore, normalizeMood } from '@/constants/moods';

describe('normalizeMood', () => {
    it('keeps hopeful first-class while still folding optimistic into hopeful', () => {
        expect(normalizeMood('hopeful')).toBe('hopeful');
        expect(normalizeMood('optimistic')).toBe('hopeful');
    });
});

describe('stored mood helpers', () => {
    it('preserves non-Core-10 moods used by historical dashboard entries', () => {
        expect(normalizeMood('peaceful')).toBe('peaceful');
        expect(getMoodScore('peaceful')).toBe(8);
        expect(getMoodScore('overwhelmed')).toBe(3);
        expect(getMoodScore('confused')).toBe(4);
        expect(getMoodEmoji('peaceful')).toBe('🕊️');
        expect(getMoodColor('peaceful')).not.toBe(getMoodColor('neutral'));
    });
});
