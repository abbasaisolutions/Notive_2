import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize an HTML string, stripping XSS vectors (scripts, event handlers,
 * javascript: hrefs, data: URIs, SVG animation, etc.).
 *
 * Uses isomorphic-dompurify which runs the JSDOM-backed DOMPurify on the
 * server — safer than hand-rolled regexes against mutation XSS.
 */
export const sanitizeHtml = (input: string | null | undefined): string | null => {
    if (!input) return null;
    return DOMPurify.sanitize(input, {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'link', 'meta', 'style'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
    });
};
