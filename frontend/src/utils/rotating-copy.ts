/**
 * Pick a copy variant that stays stable within a day but rotates across days.
 *
 * Callers supply an array of variants and a short key that identifies the
 * surface (e.g. "empty-dashboard"). The selection is deterministic for a given
 * (key, date) pair so renders and hydration match, but a returning user on a
 * new day sees a different line.
 */

function hashString(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash * 31 + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

function dayKey(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;
}

export function pickRotatingCopy<T>(surfaceKey: string, variants: readonly T[]): T {
    if (variants.length === 0) {
        throw new Error('pickRotatingCopy called with empty variants');
    }
    const index = hashString(`${surfaceKey}:${dayKey()}`) % variants.length;
    return variants[index];
}
