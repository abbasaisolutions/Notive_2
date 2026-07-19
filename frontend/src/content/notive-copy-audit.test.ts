import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    NOTIVE_BANNED_PUBLIC_LANGUAGE,
    NOTIVE_POSTLOGIN_COPY_AUDIT_PATHS,
    NOTIVE_PUBLIC_COPY_AUDIT_PATHS,
    NOTIVE_VOICE_BANNED_PATTERNS,
} from '@/content/notive-voice';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('public copy audit', () => {
    it('keeps banned therapy-coded language off audited public surfaces', () => {
        const frontendRoot = path.resolve(process.cwd(), 'src');
        const offenders: string[] = [];

        NOTIVE_PUBLIC_COPY_AUDIT_PATHS.forEach((relativePath) => {
            const absolutePath = path.resolve(frontendRoot, '..', relativePath);
            const source = fs.readFileSync(absolutePath, 'utf8');

            NOTIVE_BANNED_PUBLIC_LANGUAGE.forEach((phrase) => {
                const pattern = new RegExp(`\\b${escapeRegex(phrase)}\\b`, 'i');
                if (pattern.test(source)) {
                    offenders.push(`${relativePath} -> ${phrase}`);
                }
            });
        });

        expect(offenders).toEqual([]);
    });

    it('keeps banned voice constructions out of post-login copy sources', () => {
        const frontendRoot = path.resolve(process.cwd(), 'src');
        const offenders: string[] = [];

        NOTIVE_POSTLOGIN_COPY_AUDIT_PATHS.forEach((relativePath) => {
            const absolutePath = path.resolve(frontendRoot, '..', relativePath);
            const lines = fs.readFileSync(absolutePath, 'utf8').split('\n');

            lines.forEach((line, index) => {
                // Narrow, documented opt-out: `// voice-ok: <reason>`
                if (line.includes('voice-ok')) return;
                // The banned-pattern definitions themselves are not copy.
                if (/pattern:\s*['"]/.test(line)) return;

                NOTIVE_VOICE_BANNED_PATTERNS.forEach(({ pattern, flags, reason }) => {
                    if (new RegExp(pattern, flags).test(line)) {
                        offenders.push(`${relativePath}:${index + 1} -> ${reason} (${pattern})`);
                    }
                });
            });
        });

        expect(offenders).toEqual([]);
    });

    it('keeps post-login copy inside the 90-char word budget', () => {
        // docs/design-audit/word-budget-plan.md: state replaces sentences.
        // Prose over 90 chars in a copy source is a design smell, not a style
        // choice. Opt out with `voice-ok: <reason>` (legal, safety, pre-login).
        const MAX = 90;
        const frontendRoot = path.resolve(process.cwd(), 'src');
        const literalRe = /(['"])((?:(?!\1)[^\n]){91,})\1/g;
        const codeyRe = /[<>{}=;'"`()[\]&$]/;
        const cssishRe = /\b(?:px|py|pt|pb|pl|pr|mt|mb|ml|mr|mx|my|text|bg|border|rounded|flex|grid|items|justify|gap|shadow|ring|hover|transition|inline|absolute|relative|hidden|block|w|h|z|top|left|right|bottom|min|max|sm|md|lg|xl)-/;
        const isProse = (s: string) => (s.match(/ /g) || []).length >= 8;
        const offenders: string[] = [];

        NOTIVE_POSTLOGIN_COPY_AUDIT_PATHS.forEach((relativePath) => {
            const absolutePath = path.resolve(frontendRoot, '..', relativePath);
            const lines = fs.readFileSync(absolutePath, 'utf8').split('\n');

            lines.forEach((line, index) => {
                if (line.includes('voice-ok') || /pattern:\s*['"]/.test(line)) return;
                const stripped = line.trim();
                if (stripped.length > MAX && isProse(stripped) && !codeyRe.test(stripped)) {
                    offenders.push(`${relativePath}:${index + 1} (jsx text, ${stripped.length} chars)`);
                    return;
                }
                for (const m of stripped.matchAll(literalRe)) {
                    const s = m[2];
                    if (isProse(s) && !s.includes('${') && !s.includes('`') && !cssishRe.test(s)) {
                        offenders.push(`${relativePath}:${index + 1} (literal, ${s.length} chars)`);
                    }
                }
            });
        });

        expect(offenders).toEqual([]);
    });

    it('keeps dashboard goal labels wired to the shared voice source', () => {
        const dashboardPath = path.resolve(process.cwd(), 'src/app/dashboard/page.tsx');
        const source = fs.readFileSync(dashboardPath, 'utf8');

        expect(source).toContain('NOTIVE_VOICE.onboarding.goalLabels');
    });
});
