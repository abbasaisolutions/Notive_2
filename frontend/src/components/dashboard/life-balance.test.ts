import { describe, expect, it } from 'vitest';
import {
    getLifeBalanceRingFill,
    getLifeBalanceScoreLabel,
    getVisibleLifeBalanceAreas,
    LIFE_BALANCE_RING_CIRCUMFERENCE,
    normalizeLifeBalanceAreaKey,
} from '@/components/dashboard/life-balance';

describe('normalizeLifeBalanceAreaKey', () => {
    it('normalizes title-cased area labels for UI lookups', () => {
        expect(normalizeLifeBalanceAreaKey('School')).toBe('school');
        expect(normalizeLifeBalanceAreaKey('  Family  ')).toBe('family');
    });
});

describe('getLifeBalanceScoreLabel', () => {
    it('clamps scores to the 0-100 range', () => {
        expect(getLifeBalanceScoreLabel(78.4)).toBe(78);
        expect(getLifeBalanceScoreLabel(140)).toBe(100);
        expect(getLifeBalanceScoreLabel(-10)).toBe(0);
    });
});

describe('getLifeBalanceRingFill', () => {
    it('converts a 0-100 score into the matching ring fill length', () => {
        expect(getLifeBalanceRingFill(75)).toBeCloseTo(LIFE_BALANCE_RING_CIRCUMFERENCE * 0.75, 1);
        expect(getLifeBalanceRingFill(0)).toBe(0);
        expect(getLifeBalanceRingFill(100)).toBe(LIFE_BALANCE_RING_CIRCUMFERENCE);
    });
});

describe('getVisibleLifeBalanceAreas', () => {
    it('filters empty areas and keeps the most present ones first', () => {
        expect(getVisibleLifeBalanceAreas([
            { area: 'Family', score: 0.4, entryCount: 2 },
            { area: 'School', score: 1, entryCount: 5 },
            { area: 'Health', score: 0, entryCount: 0 },
        ])).toEqual([
            { area: 'School', score: 1, entryCount: 5 },
            { area: 'Family', score: 0.4, entryCount: 2 },
        ]);
    });
});
