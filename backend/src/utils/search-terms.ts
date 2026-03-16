const SEARCH_STOPWORDS = new Set([
    'a',
    'an',
    'and',
    'about',
    'are',
    'as',
    'at',
    'be',
    'been',
    'being',
    'but',
    'by',
    'for',
    'from',
    'had',
    'has',
    'have',
    'i',
    'if',
    'in',
    'into',
    'is',
    'it',
    'its',
    'just',
    'my',
    'of',
    'on',
    'or',
    'our',
    'same',
    'so',
    'that',
    'the',
    'their',
    'them',
    'there',
    'these',
    'they',
    'this',
    'those',
    'to',
    'today',
    'was',
    'we',
    'were',
    'what',
    'with',
]);

export const extractSearchTerms = (value: string): string[] =>
    Array.from(
        new Set(
            (value.toLowerCase().match(/[a-z0-9']+/g) || []).filter(
                (token) => token.length >= 3 && !SEARCH_STOPWORDS.has(token)
            )
        )
    );
