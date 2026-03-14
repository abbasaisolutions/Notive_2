const SCRIPT_TAG_REGEX = /<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi;
const EVENT_HANDLER_ATTR_REGEX = /\son[a-z]+\s*=\s*(['"]).*?\1/gi;
const JS_PROTOCOL_REGEX = /\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi;
const DATA_HTML_REGEX = /\s(href|src)\s*=\s*(['"])\s*data:text\/html[\s\S]*?\2/gi;
const STYLE_ATTR_REGEX = /\sstyle\s*=\s*(['"]).*?\1/gi;
const IFRAME_OBJECT_EMBED_REGEX = /<\s*(iframe|object|embed|link|meta)[^>]*>/gi;

export const sanitizeHtml = (input: string | null | undefined): string | null => {
    if (!input) return null;

    return input
        .replace(SCRIPT_TAG_REGEX, '')
        .replace(IFRAME_OBJECT_EMBED_REGEX, '')
        .replace(EVENT_HANDLER_ATTR_REGEX, '')
        .replace(JS_PROTOCOL_REGEX, '')
        .replace(DATA_HTML_REGEX, '')
        .replace(STYLE_ATTR_REGEX, '');
};
