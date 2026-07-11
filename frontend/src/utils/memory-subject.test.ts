import { describe, expect, it } from 'vitest';
import { suggestMemorySubject } from './memory-subject';

describe('suggestMemorySubject', () => {
    it('uses a clean version of the first meaningful sentence', () => {
        expect(suggestMemorySubject('today I finally finished the portfolio draft. It feels lighter now.'))
            .toBe('Today I finally finished the portfolio draft');
    });

    it('keeps the suggestion short without sending text anywhere', () => {
        const source = 'I spent the afternoon rebuilding the small onboarding flow so it would feel calm and clear for someone opening the app for the first time.';
        expect(suggestMemorySubject(source)).toBe('I spent the afternoon rebuilding the small onboarding flow so it would');
    });

    it('returns nothing for an empty memory', () => {
        expect(suggestMemorySubject('   ')).toBe('');
    });
});
