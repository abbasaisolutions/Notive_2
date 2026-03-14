import { sanitizeReturnTo } from '@/utils/redirect';

export type WorkspaceResumeStage = 'capture' | 'organize' | 'reflect' | 'apply' | 'account';

export type WorkspaceResumeState = {
    key: 'timeline' | 'portfolio' | 'insights' | 'chapters' | 'chapter' | 'import';
    title: string;
    summary: string;
    href: string;
    updatedAt: string;
    stage: WorkspaceResumeStage;
    actionLabel?: string;
};

const STORAGE_KEY = 'notive_workspace_resume_v1';
const MAX_AGE_MS = 1000 * 60 * 60 * 72;

const canUseLocalStorage = () => typeof window !== 'undefined' && !!window.localStorage;

export const readWorkspaceResume = (): WorkspaceResumeState | null => {
    if (!canUseLocalStorage()) return null;

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as Partial<WorkspaceResumeState>;
        const safeHref = sanitizeReturnTo(parsed.href);
        if (!safeHref || typeof parsed.title !== 'string' || typeof parsed.summary !== 'string' || typeof parsed.updatedAt !== 'string' || typeof parsed.stage !== 'string') {
            return null;
        }

        const updatedAtMs = new Date(parsed.updatedAt).getTime();
        if (!Number.isFinite(updatedAtMs) || Date.now() - updatedAtMs > MAX_AGE_MS) {
            window.localStorage.removeItem(STORAGE_KEY);
            return null;
        }

        return {
            key: (parsed.key as WorkspaceResumeState['key']) || 'timeline',
            title: parsed.title,
            summary: parsed.summary,
            href: safeHref,
            updatedAt: parsed.updatedAt,
            stage: parsed.stage as WorkspaceResumeStage,
            actionLabel: typeof parsed.actionLabel === 'string' ? parsed.actionLabel : undefined,
        };
    } catch {
        return null;
    }
};

export const writeWorkspaceResume = (state: WorkspaceResumeState) => {
    if (!canUseLocalStorage()) return;

    const safeHref = sanitizeReturnTo(state.href);
    if (!safeHref) return;

    try {
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                ...state,
                href: safeHref,
            })
        );
    } catch {
        // Ignore storage write failures so workspace navigation still works.
    }
};
