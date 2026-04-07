/**
 * Shared input-sanitization helpers.
 * Used by controllers (user, etc.) and tested directly.
 */

export const sanitizeOptionalString = (value: unknown, maxLength = 240): string | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, maxLength);
};

export const sanitizeOptionalHttpUrl = (value: unknown, maxLength = 2000): string | null | undefined => {
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

export const sanitizeStringArray = (value: unknown, maxItems = 20, maxLength = 80): string[] | undefined => {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) return undefined;
    const cleaned = value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
        .map((item) => item.slice(0, maxLength));
    return Array.from(new Set(cleaned)).slice(0, maxItems);
};

export const sanitizeOptionalBirthDate = (value: unknown): Date | null | undefined => {
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
