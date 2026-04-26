'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiBell } from 'react-icons/fi';
import { Button } from '@/components/ui/form-elements';
import { TagPill } from '@/components/ui/surface';

type EntrySaveCompletionSummary = {
    lesson?: string;
    strengths?: string[];
    goals?: string[];
    people?: string[];
    topics?: string[];
    growthFlag?: boolean;
    phrase?: string;
};

export type ReminderPromptOptions = {
    onEnable: () => Promise<boolean> | boolean;
    onDismiss: () => void;
};

type EntrySaveCompletionSheetProps = {
    open: boolean;
    kicker: string;
    description: string;
    title?: string | null;
    summary: EntrySaveCompletionSummary | null;
    primaryLabel: string;
    secondaryLabel: string;
    tertiaryLabel: string;
    onPrimary: () => void;
    onSecondary: () => void;
    onTertiary: () => void;
    onClose: () => void;
    reminderPrompt?: ReminderPromptOptions | null;
};

type Highlight = {
    key: string;
    label: string;
    value: string;
};

const summarizePeople = (people: string[]) => {
    if (people.length === 0) return null;
    if (people.length === 1) return `${people[0]} came through in this memory.`;
    if (people.length === 2) return `${people[0]} and ${people[1]} came through in this memory.`;
    return `${people.slice(0, 2).join(', ')}, and more came through in this memory.`;
};

export default function EntrySaveCompletionSheet({
    open,
    kicker,
    description,
    title,
    summary,
    primaryLabel,
    secondaryLabel,
    tertiaryLabel,
    onPrimary,
    onSecondary,
    onTertiary,
    onClose,
    reminderPrompt,
}: EntrySaveCompletionSheetProps) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const [reminderState, setReminderState] = useState<'idle' | 'saving' | 'enabled'>('idle');

    useEffect(() => {
        if (!open) setReminderState('idle');
    }, [open]);

    const handleEnableReminder = useCallback(async () => {
        if (!reminderPrompt || reminderState !== 'idle') return;
        setReminderState('saving');
        try {
            const ok = await Promise.resolve(reminderPrompt.onEnable());
            setReminderState(ok ? 'enabled' : 'idle');
        } catch {
            setReminderState('idle');
        }
    }, [reminderPrompt, reminderState]);

    const handleDismissReminder = useCallback(() => {
        if (!reminderPrompt) return;
        reminderPrompt.onDismiss();
    }, [reminderPrompt]);

    const highlights = useMemo<Highlight[]>(() => {
        if (!summary) return [];

        const next: Highlight[] = [];
        if (summary.lesson?.trim()) {
            next.push({ key: 'lesson', label: 'Lesson', value: summary.lesson.trim() });
        }
        if (summary.strengths && summary.strengths.length > 0) {
            next.push({
                key: 'strengths',
                label: summary.strengths.length === 1 ? 'Strength' : 'Strengths',
                value: summary.strengths.slice(0, 2).join(', '),
            });
        }
        if (summary.goals && summary.goals.length > 0) {
            next.push({
                key: 'goals',
                label: summary.goals.length === 1 ? 'Goal' : 'Goals',
                value: summary.goals.slice(0, 2).join(', '),
            });
        }
        if (summary.people && summary.people.length > 0) {
            const peopleSummary = summarizePeople(summary.people);
            if (peopleSummary) {
                next.push({ key: 'people', label: 'People', value: peopleSummary });
            }
        }
        if (summary.topics && summary.topics.length > 0) {
            next.push({ key: 'topics', label: 'Thread', value: summary.topics[0] });
        }
        if (summary.phrase?.trim()) {
            next.push({ key: 'phrase', label: 'Phrase', value: `You kept returning to "${summary.phrase.trim()}"` });
        }
        if (summary.growthFlag) {
            next.push({ key: 'growth', label: 'Growth', value: 'Growth language showed up clearly in this memory.' });
        }

        return next.slice(0, 4);
    }, [summary]);

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            onClose();
            return;
        }
        if (event.key !== 'Tab' || !dialogRef.current) return;

        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }, [onClose]);

    useEffect(() => {
        if (!open) return;

        previousFocusRef.current = document.activeElement as HTMLElement;
        document.addEventListener('keydown', handleKeyDown);

        const timer = setTimeout(() => {
            const primaryButton = dialogRef.current?.querySelector<HTMLElement>('[data-autofocus="true"]');
            primaryButton?.focus();
        }, 50);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            clearTimeout(timer);
            previousFocusRef.current?.focus();
        };
    }, [handleKeyDown, open]);

    if (!open) return null;

    return (
        <>
            <div
                className="fixed inset-0 z-[70] bg-[rgb(var(--bg-canvas))]/72 backdrop-blur-sm"
                onClick={onClose}
                role="presentation"
            />

            <div className="fixed inset-x-0 bottom-0 z-[80] flex justify-center p-4 md:inset-0 md:items-center">
                <div
                    ref={dialogRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="entry-save-completion-title"
                    aria-describedby="entry-save-completion-description"
                    className="workspace-soft-panel w-full max-w-xl rounded-[1.75rem] p-5 shadow-2xl md:p-6"
                    onClick={(event) => event.stopPropagation()}
                >
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--paper-sage))]">
                                {kicker}
                            </p>
                            <h2 id="entry-save-completion-title" className="workspace-heading mt-2 text-xl font-semibold">
                                {title?.trim() || (kicker === 'Reflection saved' ? 'Your reflection is safe' : 'Your memory is safe')}
                            </h2>
                            <p id="entry-save-completion-description" className="mt-2 text-sm leading-6 text-ink-secondary">
                                {description}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close save options"
                            className="rounded-full border border-[rgba(var(--paper-border),0.8)] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted transition-colors hover:text-[rgb(var(--text-primary))]"
                        >
                            Close
                        </button>
                    </div>

                    {highlights.length > 0 && (
                        <div className="mt-5 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                                    What stood out
                                </p>
                                <TagPill tone="muted">Fresh from this save</TagPill>
                            </div>

                            <div className="grid gap-2">
                                {highlights.map((highlight) => (
                                    <div
                                        key={highlight.key}
                                        className="rounded-xl border border-[rgba(var(--paper-border),0.82)] bg-[rgba(255,255,255,0.22)] px-3.5 py-3"
                                    >
                                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                                            {highlight.label}
                                        </p>
                                        <p className="mt-1 text-sm leading-6 text-[rgb(var(--text-primary))]">
                                            {highlight.value}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {reminderPrompt && (
                        <div className="mt-5 rounded-xl border border-[rgba(var(--paper-border),0.82)] bg-[rgba(var(--paper-sage),0.08)] p-4">
                            <div className="flex items-start gap-3">
                                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[rgba(var(--paper-sage),0.16)] text-[rgb(var(--paper-sage))]">
                                    <FiBell size={16} aria-hidden />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-[rgb(var(--text-primary))]">
                                        {reminderState === 'enabled' ? 'Reminder set for 8:00 PM' : 'Want a daily nudge to write?'}
                                    </p>
                                    <p className="mt-1 text-xs leading-5 text-ink-secondary">
                                        {reminderState === 'enabled'
                                            ? 'You can change the time or days anytime from your profile.'
                                            : 'A small daily reminder helps the habit stick. We’ll ping you at 8:00 PM — change it later in your profile.'}
                                    </p>
                                    {reminderState !== 'enabled' && (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                onClick={handleEnableReminder}
                                                disabled={reminderState === 'saving'}
                                                className="px-3 py-1.5 text-xs"
                                            >
                                                {reminderState === 'saving' ? 'Setting up…' : 'Yes, remind me daily'}
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                onClick={handleDismissReminder}
                                                disabled={reminderState === 'saving'}
                                                className="px-3 py-1.5 text-xs"
                                            >
                                                Not now
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-5 flex flex-col gap-2.5">
                        <Button
                            type="button"
                            onClick={onPrimary}
                            data-autofocus="true"
                            className="w-full"
                        >
                            {primaryLabel}
                        </Button>
                        <div className="grid gap-2 sm:grid-cols-2">
                            <Button type="button" variant="secondary" onClick={onSecondary} className="w-full">
                                {secondaryLabel}
                            </Button>
                            <Button type="button" variant="ghost" onClick={onTertiary} className="w-full">
                                {tertiaryLabel}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
