/** Normalize a tag to canonical hyphenated lowercase form. Mirrors backend tag-manager.service.ts */
export const normalizeTag = (tag: string): string =>
    tag
        .replace(/^#+/, '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/[\s-]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 32);

/** Words filtered from tag display — NLP often produces these as false-positive tags */
export const CARD_TAG_NOISE = new Set([
    'im', 'ive', 'id', 'ill', 'its', 'dont', 'didnt', 'wont', 'cant', 'not',
    'has', 'had', 'have', 'does', 'did', 'just', 'like', 'also', 'some', 'both',
    'this', 'that', 'what', 'when', 'where', 'good', 'okay', 'yeah', 'very', 'even',
    'make', 'made', 'more', 'much', 'many', 'every', 'really', 'back', 'still',
    'thing', 'things', 'day', 'today', 'time', 'week', 'feel', 'feels', 'felt',
    'want', 'know', 'think', 'said', 'with', 'from', 'into', 'over', 'down', 'life',
    'work', 'node', 'nodeo', 'features', 'nothing', 'something', 'everything',
    'yesterday', 'happy', 'anything', 'right', 'well',
]);

/** Returns true if a tag is meaningful enough to display on a card */
export const isCardTag = (t: string): boolean =>
    t.length >= 4 && !CARD_TAG_NOISE.has(t.toLowerCase().replace(/[^a-z0-9-]/g, ''));
