import { describe, it, expect } from 'vitest';
import {
    sanitizeOptionalString,
    sanitizeOptionalHttpUrl,
    sanitizeStringArray,
    sanitizeOptionalBirthDate,
} from '../utils/sanitize';

// ─── Tests ──────────────────────────────────────────────────────

describe('sanitizeOptionalString', () => {
    it('returns undefined for undefined', () => {
        expect(sanitizeOptionalString(undefined)).toBeUndefined();
    });

    it('returns null for null', () => {
        expect(sanitizeOptionalString(null)).toBeNull();
    });

    it('returns null for empty/whitespace string', () => {
        expect(sanitizeOptionalString('')).toBeNull();
        expect(sanitizeOptionalString('   ')).toBeNull();
    });

    it('trims whitespace', () => {
        expect(sanitizeOptionalString('  hello  ')).toBe('hello');
    });

    it('truncates to maxLength', () => {
        expect(sanitizeOptionalString('abcdef', 3)).toBe('abc');
    });

    it('returns undefined for non-string types', () => {
        expect(sanitizeOptionalString(42)).toBeUndefined();
        expect(sanitizeOptionalString(true)).toBeUndefined();
        expect(sanitizeOptionalString({})).toBeUndefined();
    });
});

describe('sanitizeOptionalHttpUrl', () => {
    it('accepts valid http URLs', () => {
        expect(sanitizeOptionalHttpUrl('http://example.com')).toBe('http://example.com/');
    });

    it('accepts valid https URLs', () => {
        expect(sanitizeOptionalHttpUrl('https://example.com/path?q=1')).toBe('https://example.com/path?q=1');
    });

    it('rejects non-http protocols', () => {
        expect(sanitizeOptionalHttpUrl('ftp://example.com')).toBeUndefined();
        expect(sanitizeOptionalHttpUrl('javascript:alert(1)')).toBeUndefined();
        expect(sanitizeOptionalHttpUrl('data:text/html,<h1>hi</h1>')).toBeUndefined();
    });

    it('rejects invalid URLs', () => {
        expect(sanitizeOptionalHttpUrl('not a url')).toBeUndefined();
    });

    it('returns undefined for undefined, null for null', () => {
        expect(sanitizeOptionalHttpUrl(undefined)).toBeUndefined();
        expect(sanitizeOptionalHttpUrl(null)).toBeNull();
    });

    it('returns null for empty string', () => {
        expect(sanitizeOptionalHttpUrl('')).toBeNull();
    });

    it('accepts avatar URLs from the backend', () => {
        const url = 'https://notive2-production.up.railway.app/uploads/12345-avatar.webp';
        expect(sanitizeOptionalHttpUrl(url)).toBe(url);
    });
});

describe('sanitizeStringArray', () => {
    it('returns undefined for undefined', () => {
        expect(sanitizeStringArray(undefined)).toBeUndefined();
    });

    it('returns undefined for non-arrays', () => {
        expect(sanitizeStringArray('hello')).toBeUndefined();
        expect(sanitizeStringArray(42)).toBeUndefined();
    });

    it('trims and filters empty strings', () => {
        expect(sanitizeStringArray(['  a  ', '', '  ', 'b'])).toEqual(['a', 'b']);
    });

    it('deduplicates values', () => {
        expect(sanitizeStringArray(['x', 'x', 'y'])).toEqual(['x', 'y']);
    });

    it('truncates items to maxLength', () => {
        expect(sanitizeStringArray(['abcdef'], 20, 3)).toEqual(['abc']);
    });

    it('limits to maxItems', () => {
        const input = Array.from({ length: 25 }, (_, i) => `item${i}`);
        expect(sanitizeStringArray(input, 5)?.length).toBe(5);
    });
});

describe('sanitizeOptionalBirthDate', () => {
    it('returns undefined for undefined', () => {
        expect(sanitizeOptionalBirthDate(undefined)).toBeUndefined();
    });

    it('returns null for null or empty', () => {
        expect(sanitizeOptionalBirthDate(null)).toBeNull();
        expect(sanitizeOptionalBirthDate('')).toBeNull();
    });

    it('parses YYYY-MM-DD format', () => {
        const result = sanitizeOptionalBirthDate('2000-06-15');
        expect(result).toBeInstanceOf(Date);
        expect(result!.toISOString()).toBe('2000-06-15T00:00:00.000Z');
    });

    it('throws for future dates', () => {
        expect(() => sanitizeOptionalBirthDate('2099-01-01')).toThrow();
    });

    it('throws for non-string types', () => {
        expect(() => sanitizeOptionalBirthDate(12345)).toThrow();
    });

    it('throws for invalid date strings', () => {
        expect(() => sanitizeOptionalBirthDate('not-a-date')).toThrow();
    });
});
