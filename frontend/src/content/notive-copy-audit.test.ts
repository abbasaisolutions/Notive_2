import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    NOTIVE_BANNED_PUBLIC_LANGUAGE,
    NOTIVE_PUBLIC_COPY_AUDIT_PATHS,
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

    it('keeps dashboard goal labels wired to the shared voice source', () => {
        const dashboardPath = path.resolve(process.cwd(), 'src/app/dashboard/page.tsx');
        const source = fs.readFileSync(dashboardPath, 'utf8');

        expect(source).toContain('NOTIVE_VOICE.onboarding.goalLabels');
    });
});
