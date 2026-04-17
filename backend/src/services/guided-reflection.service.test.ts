import { describe, expect, it } from 'vitest';
import {
    isGuidedReflectionLensValue,
    normalizeGuidedReflectionLens,
} from './guided-reflection.service';

describe('guided reflection lens compatibility', () => {
    it('accepts the new public lens values', () => {
        expect(isGuidedReflectionLensValue('memory')).toBe(true);
        expect(isGuidedReflectionLensValue('patterns')).toBe(true);
        expect(isGuidedReflectionLensValue('lessons')).toBe(true);
        expect(isGuidedReflectionLensValue('stories')).toBe(true);
    });

    it('keeps legacy lens values working for one release', () => {
        expect(isGuidedReflectionLensValue('clarity')).toBe(true);
        expect(isGuidedReflectionLensValue('growth')).toBe(true);
        expect(isGuidedReflectionLensValue('bridge')).toBe(true);
        expect(normalizeGuidedReflectionLens('clarity')).toBe('stories');
        expect(normalizeGuidedReflectionLens('growth')).toBe('lessons');
        expect(normalizeGuidedReflectionLens('bridge')).toBe('stories');
    });

    it('rejects unknown lens values', () => {
        expect(isGuidedReflectionLensValue('advice')).toBe(false);
        expect(normalizeGuidedReflectionLens(null)).toBeNull();
    });
});
