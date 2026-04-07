/**
 * Normalize a tag to canonical hyphenated lowercase form.
 * SYNC: must match backend/src/services/tag-manager.service.ts → normalizeTag
 */
export const normalizeTag = (tag: string): string =>
    tag
        .replace(/^#+/, '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/[\s-]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 32);

/**
 * Stopwords list — tags made entirely of these words are not meaningful.
 * SYNC: backend/src/services/tagging.service.ts → STOPWORDS (authoritative)
 */
const STOPWORDS = new Set([
    // articles, prepositions, conjunctions
    'a', 'an', 'and', 'the', 'to', 'of', 'in', 'on', 'for', 'with', 'at', 'from', 'by', 'as',
    'or', 'but', 'so', 'if', 'then', 'than', 'too', 'into', 'over', 'after', 'before',
    'between', 'under', 'through', 'down', 'out', 'off', 'up',
    // pronouns & determiners
    'is', 'it', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they',
    'my', 'your', 'our', 'their', 'me', 'him', 'her', 'us', 'them',
    'each', 'every', 'all', 'both', 'few', 'other', 'such', 'only', 'own', 'same',
    'some', 'what', 'when', 'where', 'how', 'which', 'who', 'whom', 'why',
    // common verbs (not topical as standalone tags)
    'be', 'been', 'being', 'was', 'were', 'am', 'are',
    'im', 'ive', 'id', 'ill', 'its', 'dont', 'didnt', 'wont', 'cant',
    'has', 'had', 'have', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'shall',
    'may', 'might', 'must', 'need', 'get', 'got',
    'like', 'want', 'know', 'think', 'make', 'made',
    'come', 'came', 'went', 'going', 'doing', 'said', 'says', 'tell', 'told',
    'go', 'see', 'saw', 'seen', 'give', 'gave', 'take', 'took', 'taken', 'put',
    'let', 'try', 'tried', 'keep', 'kept', 'leave', 'left', 'call', 'called',
    'run', 'ran', 'look', 'looked', 'ask', 'asked', 'use', 'used', 'find', 'found',
    'say', 'set', 'help', 'helped', 'show', 'showed', 'turn', 'turned', 'move', 'moved',
    'start', 'started', 'stop', 'stopped', 'end', 'ended', 'open', 'opened',
    'talk', 'talked', 'hear', 'heard', 'bring', 'brought', 'begin', 'began',
    'seem', 'seemed', 'happen', 'happened', 'become', 'became', 'stay', 'stayed',
    // common adjectives & adverbs (not meaningful as tags)
    'not', 'no', 'yes', 'very', 'just', 'really', 'even', 'still', 'also', 'about',
    'here', 'there', 'now', 'more', 'much', 'many', 'any', 'again', 'back',
    'right', 'well', 'good', 'bad', 'big', 'small', 'long', 'new', 'old', 'last', 'next',
    'first', 'great', 'little', 'different', 'important', 'hard', 'best', 'whole', 'able',
    'happy', 'okay', 'yeah', 'nice', 'sure', 'real', 'fine', 'pretty', 'enough',
    // generic nouns (too vague for meaningful tags)
    'one', 'two', 'three', 'way', 'thing', 'things', 'time', 'day', 'today',
    'yesterday', 'week', 'month', 'year', 'lot', 'kind', 'part', 'place', 'point',
    'nothing', 'something', 'anything', 'everything',
    'people', 'person', 'life', 'work', 'stuff', 'bit',
    // feelings as standalone (mood is stored separately)
    'feels', 'felt', 'feel', 'feeling',
    // platform noise
    'features', 'node', 'nodeo', 'instagram', 'facebook', 'imported',
]);

/** @deprecated Use STOPWORDS directly. Kept for backward compat. */
export const CARD_TAG_NOISE = STOPWORDS;

/** Returns true if a tag is meaningful enough to display on a card */
export const isCardTag = (t: string): boolean =>
    t.length >= 4 && !STOPWORDS.has(t.toLowerCase().replace(/[^a-z0-9-]/g, ''));

const MIN_TAG_LENGTH = 3;

/**
 * Gerunds that are valid noun-topics despite the -ing suffix.
 * SYNC: backend/src/services/tagging.service.ts → NOUN_GERUNDS
 */
const NOUN_GERUNDS = new Set([
    'writing', 'reading', 'coding', 'meeting', 'training', 'learning', 'teaching',
    'building', 'cooking', 'painting', 'drawing', 'swimming', 'running', 'boxing',
    'singing', 'dancing', 'gaming', 'hiking', 'climbing', 'cycling', 'skating',
    'journaling', 'tutoring', 'volunteering', 'mentoring', 'networking',
    'brainstorming', 'programming', 'engineering', 'designing', 'planning',
    'budgeting', 'investing', 'marketing', 'consulting', 'parenting',
]);

/**
 * Returns true if a normalized tag is meaningful enough to persist.
 * Mirrors backend stopword / gerund / past-tense blocking so the UI
 * doesn't show tags that the server will reject on the next round-trip.
 * SYNC: backend/src/services/tagging.service.ts → isValidTag (authoritative)
 */
export const isValidTag = (normalized: string): boolean => {
    if (normalized.length < MIN_TAG_LENGTH) return false;

    const parts = normalized.split(/[\s-]+/);
    // Reject if every part is a stopword or too short
    if (parts.every(p => STOPWORDS.has(p) || p.length < 2)) return false;
    // For single-word tags, block non-noun gerunds and past-tense stopwords
    if (parts.length === 1) {
        const word = parts[0];
        if (word.endsWith('ing') && word.length > 4 && !NOUN_GERUNDS.has(word)) return false;
        if (word.endsWith('ed') && word.length > 4 && STOPWORDS.has(word)) return false;
    }
    return true;
};
