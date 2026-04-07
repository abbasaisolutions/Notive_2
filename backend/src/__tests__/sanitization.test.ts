import { describe, it, expect } from 'vitest';

// These helpers are private in user.controller.ts, so we re-implement
// them here to test the logic in isolation.

const sanitizeOptionalString = (value: unknown, maxLength = 240): string | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, maxLength);
};

const sanitizeOptionalHttpUrl = (value: unknown, maxLength = 2000): string | null | undefined => {
    const sanitized = sanitizeOptionalString(value, maxLength);
    if (sanitized === undefined || sanitized === null) return sanitized;
    try {
        const parsed = new URL(sanitized);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
        return parsed.toString();
    } catch {
        return undefined;
    }
};

const sanitizeStringArray = (value: unknown, maxItems = 20, maxLength = 80): string[] | undefined => {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) return undefined;
    const cleaned = value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
        .map((item) => item.slice(0, maxLength));
    return Array.from(new Set(cleaned)).slice(0, maxItems);
};

const sanitizeOptionalBirthDate = (value: unknown): Date | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    if (typeof value !== 'string') throw new Error('Invalid birth date value');
    const trimmed = value.trim();
    if (!trimmed) return null;
    const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    let parsed: Date;
    if (dateOnlyMatch) {
        const [, year, month, day] = dateOnlyMatch;
        parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    } else {
        const raw = new Date(trimmed);
        if (Number.isNaN(raw.getTime())) throw new Error('Invalid birth date value');
        parsed = new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate()));
    }
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() > Date.now()) {
        throw new Error('Invalid birth date value');
    }
    return parsed;
};

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
