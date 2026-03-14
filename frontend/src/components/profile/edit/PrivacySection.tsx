'use client';

import React from 'react';
import Link from 'next/link';
import { FiDownload, FiExternalLink, FiLink, FiRefreshCw, FiShield, FiTrash2 } from 'react-icons/fi';
import { SelectField } from './fields';
import { PROMPT_FREQUENCY_OPTIONS, type PromptFrequency, type SignalEntry } from './types';
import { toDateLabel } from './types';

type PrivacySectionProps = {
    promptFrequency: PromptFrequency;
    signalEntries: SignalEntry[];
    promptedCount: number;
    answeredCount: number;
    dismissedCount: number;
    lastSignalAction: string | null;
    isExporting: boolean;
    onPromptFrequencyChange: (value: PromptFrequency) => void;
    onResetSignals: () => void;
    onRemoveSignal: (entry: SignalEntry) => void;
    onExportData: () => void;
};

export function PrivacySection({
    promptFrequency,
    signalEntries,
    promptedCount,
    answeredCount,
    dismissedCount,
    lastSignalAction,
    isExporting,
    onPromptFrequencyChange,
    onResetSignals,
    onRemoveSignal,
    onExportData,
}: PrivacySectionProps) {
    return (
        <div className="space-y-6">
            <section className="grid gap-6 xl:grid-cols-[1.35fr,1fr]">
                <div className="bento-box p-8 space-y-6">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-ink-muted font-bold">Privacy & Data</p>
                        <h2 className="mt-2 text-2xl font-serif text-white">Inspect and control adaptive personalization</h2>
                        <p className="mt-2 text-sm text-ink-secondary">
                            This is where users should be able to see what signals exist, how frequently the app adapts prompts, and remove specific stored answers without wiping everything blindly.
                        </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <SelectField
                            label="Adaptive Prompt Frequency"
                            value={promptFrequency}
                            onChange={(value) => onPromptFrequencyChange(value as PromptFrequency)}
                            options={PROMPT_FREQUENCY_OPTIONS}
                            emptyLabel="Normal"
                            helper="This controls how often Notive asks adaptive setup questions."
                        />
                        <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-5">
                            <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Stored Signals</p>
                            <p className="mt-2 text-3xl font-serif text-white">{signalEntries.length}</p>
                            <p className="mt-1 text-sm text-ink-secondary">
                                Direct answers currently used to personalize your experience.
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Prompts Shown</p>
                            <p className="mt-2 text-2xl font-semibold text-white">{promptedCount}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Prompts Answered</p>
                            <p className="mt-2 text-2xl font-semibold text-white">{answeredCount}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Prompts Dismissed</p>
                            <p className="mt-2 text-2xl font-semibold text-white">{dismissedCount}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Last Signal Activity</p>
                            <p className="mt-2 text-sm text-white">{toDateLabel(lastSignalAction)}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border border-white/10 bg-white/[0.03] px-4 py-4">
                        <div>
                            <p className="text-sm font-semibold text-white">Reset adaptive memory</p>
                            <p className="mt-1 text-xs text-ink-secondary">
                                Removes stored answers and history while keeping your prompt frequency preference intact.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onResetSignals}
                            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-ink-secondary hover:text-white hover:border-white/30 transition-colors"
                        >
                            <FiRefreshCw size={14} aria-hidden="true" />
                            <span>Reset Stored Signals</span>
                        </button>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <h3 className="text-lg font-serif text-white">Captured answers</h3>
                            <p className="text-sm text-ink-secondary">
                                Remove individual items if they are outdated, wrong, or too sensitive to keep.
                            </p>
                        </div>

                        {signalEntries.length === 0 ? (
                            <div className="rounded-[1.4rem] border border-dashed border-white/15 bg-black/20 px-5 py-8 text-sm text-ink-secondary">
                                No adaptive answers are stored right now.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {signalEntries.map((entry) => (
                                    <div
                                        key={`${entry.key}-${entry.answeredAt}`}
                                        className="rounded-[1.4rem] border border-white/10 bg-black/20 px-4 py-4"
                                    >
                                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                                            <div className="space-y-2">
                                                <div className="flex flex-wrap gap-2">
                                                    <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs uppercase tracking-[0.12em] text-primary">
                                                        {entry.field || 'signal'}
                                                    </span>
                                                    {entry.questionId && (
                                                        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-ink-secondary">
                                                            {entry.questionId}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-white font-semibold">{entry.label || entry.value}</p>
                                                <p className="text-sm text-ink-secondary">{entry.value}</p>
                                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                                                    Captured {toDateLabel(entry.answeredAt)}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => onRemoveSignal(entry)}
                                                className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-ink-secondary hover:text-white hover:border-white/30 transition-colors"
                                            >
                                                <FiTrash2 size={14} aria-hidden="true" />
                                                <span>Remove</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <section className="bento-box p-6 space-y-4">
                        <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-ink-muted font-bold">What Notive stores</p>
                            <h3 className="mt-2 text-xl font-serif text-white">Transparent by default</h3>
                        </div>
                        <div className="space-y-3 text-sm text-ink-secondary">
                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                Adaptive answers, prompt history, and prompt frequency preference are stored inside your profile settings.
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                These signals affect capture prompts, guidance tone, and how portfolio-ready context is framed.
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                Removing an answer stops that item from being used as profile context going forward.
                            </div>
                        </div>
                    </section>

                    <section className="bento-box p-6 space-y-4">
                        <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-ink-muted font-bold">Data Actions</p>
                            <h3 className="mt-2 text-xl font-serif text-white">Move or review your data</h3>
                        </div>
                        <button
                            type="button"
                            onClick={onExportData}
                            disabled={isExporting}
                            className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-left transition-all hover:bg-white/10 disabled:opacity-50"
                        >
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-primary/10 p-2 text-primary">
                                    <FiDownload size={16} aria-hidden="true" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white">Export My Data</p>
                                    <p className="text-xs text-ink-secondary">Download a JSON export of your account data.</p>
                                </div>
                            </div>
                            <FiExternalLink size={16} aria-hidden="true" className="text-ink-muted" />
                        </button>

                        <Link
                            href="/profile?panel=social-import"
                            className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 transition-all hover:bg-white/10"
                        >
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-secondary/10 p-2 text-secondary">
                                    <FiLink size={16} aria-hidden="true" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white">Manage Social Imports</p>
                                    <p className="text-xs text-ink-secondary">Review connected sources and import preferences.</p>
                                </div>
                            </div>
                            <FiExternalLink size={16} aria-hidden="true" className="text-ink-muted" />
                        </Link>

                        <Link
                            href="/profile/edit?tab=security"
                            className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 transition-all hover:bg-white/10"
                        >
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-white/10 p-2 text-white">
                                    <FiShield size={16} aria-hidden="true" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white">Open Security Controls</p>
                                    <p className="text-xs text-ink-secondary">Go to the canonical place for sign-in, password, and account access changes.</p>
                                </div>
                            </div>
                            <FiExternalLink size={16} aria-hidden="true" className="text-ink-muted" />
                        </Link>
                    </section>
                </div>
            </section>
        </div>
    );
}
