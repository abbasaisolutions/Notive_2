/**
 * Pure normalizeTag function — no side-effect imports.
 * Canonical source of truth for tag normalisation across the backend.
 */
export const normalizeTag = (tag: string) =>
    tag
        .replace(/^#+/, '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/[\s-]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 32);
