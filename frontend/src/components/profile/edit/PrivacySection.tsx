'use client';

import React from 'react';
import Link from 'next/link';
import { FiDownload, FiExternalLink, FiLink, FiPlus, FiRefreshCw, FiShield, FiStar, FiTrash2 } from 'react-icons/fi';
import { SelectField, TagInput, TextField } from './fields';
import {
    PROMPT_FREQUENCY_OPTIONS,
    SAFETY_REGION_OPTIONS,
    TRUSTED_CONTACT_CHANNEL_OPTIONS,
    type PromptFrequency,
    type SafetyRegion,
    type SignalEntry,
    type TrustedContactDraft,
    type TrustedContactPreference,
} from './types';
import { toDateLabel } from './types';

type PrivacySectionProps = {
    promptFrequency: PromptFrequency;
    safetyRegion: SafetyRegion;
    pinnedPeople: string[];
    pinnedPeopleDraft: string;
    groundingRoutines: string[];
    groundingRoutinesDraft: string;
    trustedContacts: TrustedContactPreference[];
    trustedContactDraft: TrustedContactDraft;
    signalEntries: SignalEntry[];
    promptedCount: number;
    answeredCount: number;
    dismissedCount: number;
    lastSignalAction: string | null;
    isExporting: boolean;
    onPromptFrequencyChange: (value: PromptFrequency) => void;
    onSafetyRegionChange: (value: SafetyRegion) => void;
    onPinnedPeopleDraftChange: (value: string) => void;
    onAddPinnedPerson: () => void;
    onRemovePinnedPerson: (value: string) => void;
    onGroundingRoutinesDraftChange: (value: string) => void;
    onAddGroundingRoutine: () => void;
    onRemoveGroundingRoutine: (value: string) => void;
    onTrustedContactDraftChange: (patch: Partial<TrustedContactDraft>) => void;
    onAddTrustedContact: () => void;
    onRemoveTrustedContact: (id: string) => void;
    onSetPrimaryTrustedContact: (id: string) => void;
    onResetSignals: () => void;
    onRemoveSignal: (entry: SignalEntry) => void;
    onExportData: () => void;
};

export function PrivacySection({
    promptFrequency,
    safetyRegion,
    pinnedPeople,
    pinnedPeopleDraft,
    groundingRoutines,
    groundingRoutinesDraft,
    trustedContacts,
    trustedContactDraft,
    signalEntries,
    promptedCount,
    answeredCount,
    dismissedCount,
    lastSignalAction,
    isExporting,
    onPromptFrequencyChange,
    onSafetyRegionChange,
    onPinnedPeopleDraftChange,
    onAddPinnedPerson,
    onRemovePinnedPerson,
    onGroundingRoutinesDraftChange,
    onAddGroundingRoutine,
    onRemoveGroundingRoutine,
    onTrustedContactDraftChange,
    onAddTrustedContact,
    onRemoveTrustedContact,
    onSetPrimaryTrustedContact,
    onResetSignals,
    onRemoveSignal,
    onExportData,
}: PrivacySectionProps) {
    const pinnedCount = pinnedPeople.length + groundingRoutines.length + trustedContacts.length;

    return (
        <div className="space-y-6">
            <section className="grid gap-6 xl:grid-cols-[1.35fr,1fr]">
                <div className="bento-box p-8 space-y-6">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-ink-muted font-bold">Data</p>
                        <h2 className="mt-2 text-2xl font-serif text-white">See and control saved answers</h2>
                        <p className="mt-2 text-sm text-ink-secondary">
                            See what Notive remembers to personalize prompts. You can change how often it asks questions, remove answers, or export your data.
                        </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <SelectField
                            label="Question frequency"
                            value={promptFrequency}
                            onChange={(value) => onPromptFrequencyChange(value as PromptFrequency)}
                            options={PROMPT_FREQUENCY_OPTIONS}
                            emptyLabel="Normal"
                            helper="This changes how often Notive asks short setup questions."
                        />
                        <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-5">
                            <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Saved Answers</p>
                            <p className="mt-2 text-3xl font-serif text-white">{signalEntries.length}</p>
                            <p className="mt-1 text-sm text-ink-secondary">
                                Answers Notive uses to fit prompts and help.
                            </p>
                        </div>
                    </div>

                    <div className="rounded-[1.6rem] border border-amber-300/20 bg-[linear-gradient(135deg,rgba(251,191,36,0.08),rgba(17,24,39,0.35))] p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="max-w-xl">
                                <p className="text-xs uppercase tracking-[0.16em] text-amber-200/80 font-bold">Bridge Fallback</p>
                                <h3 className="mt-2 text-xl font-serif text-white">Keep trusted people, channels, and steady routines visible</h3>
                                <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                    Pin the people you trust, choose how you usually reach them, and keep the routines that steady you close. When a note feels vague or overwhelmed, Notive can lean on these anchors instead of guessing.
                                </p>
                            </div>
                            <div className="rounded-[1.3rem] border border-white/10 bg-black/20 px-4 py-4">
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Pinned Anchors</p>
                                <p className="mt-2 text-3xl font-serif text-white">{pinnedCount}</p>
                                <p className="mt-1 text-sm text-ink-secondary">
                                    Kept visible for Bridge Builder and low-signal action support.
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 grid gap-5 lg:grid-cols-2">
                            <TagInput
                                label="Trusted people"
                                values={pinnedPeople}
                                draft={pinnedPeopleDraft}
                                placeholder="Add a trusted adult, friend, coach, or counselor"
                                helper="Pin up to six people you would actually feel okay reaching out to."
                                onDraftChange={onPinnedPeopleDraftChange}
                                onAdd={onAddPinnedPerson}
                                onRemove={onRemovePinnedPerson}
                            />
                            <TagInput
                                label="Grounding routines"
                                values={groundingRoutines}
                                draft={groundingRoutinesDraft}
                                placeholder="Add a short walk, music, journaling, or another reset"
                                helper="Pin the small routines that usually help you steady yourself."
                                onDraftChange={onGroundingRoutinesDraftChange}
                                onAdd={onAddGroundingRoutine}
                                onRemove={onRemoveGroundingRoutine}
                            />
                        </div>

                        <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr,0.9fr]">
                            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5 space-y-4">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Trusted Contacts</p>
                                    <h4 className="mt-2 text-lg font-serif text-white">Save the person and the channel</h4>
                                    <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                        Add up to four real contacts Notive can prioritize in Bridge Builder or Safety Mode.
                                    </p>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <TextField
                                        label="Name"
                                        value={trustedContactDraft.name}
                                        onChange={(value) => onTrustedContactDraftChange({ name: value })}
                                        placeholder="Coach Rivera"
                                    />
                                    <TextField
                                        label="Relationship"
                                        value={trustedContactDraft.relationship}
                                        onChange={(value) => onTrustedContactDraftChange({ relationship: value })}
                                        placeholder="Coach, aunt, counselor"
                                    />
                                </div>

                                <div className="grid gap-4 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
                                    <SelectField
                                        label="Best channel"
                                        value={trustedContactDraft.channel}
                                        onChange={(value) => onTrustedContactDraftChange({ channel: value as TrustedContactDraft['channel'] })}
                                        options={TRUSTED_CONTACT_CHANNEL_OPTIONS}
                                        emptyLabel="Text"
                                        helper="This shapes how Bridge Builder frames the handoff."
                                    />
                                    <TextField
                                        label="Context note"
                                        value={trustedContactDraft.note}
                                        onChange={(value) => onTrustedContactDraftChange({ note: value })}
                                        placeholder="Helps when school stress starts spiraling"
                                        helper="Optional note to explain why this person feels steady."
                                    />
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <TextField
                                        label="Phone for text / call"
                                        value={trustedContactDraft.phoneNumber}
                                        onChange={(value) => onTrustedContactDraftChange({ phoneNumber: value })}
                                        placeholder="+1 555 123 4567"
                                        type="tel"
                                        helper="Optional. If you add a number, Notive can open a text or call draft."
                                    />
                                    <TextField
                                        label="Email"
                                        value={trustedContactDraft.emailAddress}
                                        onChange={(value) => onTrustedContactDraftChange({ emailAddress: value })}
                                        placeholder="coach@example.org"
                                        type="email"
                                        helper="Optional. Useful when email is the most realistic school or mentor handoff."
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={onAddTrustedContact}
                                    className="inline-flex items-center gap-2 rounded-xl border border-amber-300/25 bg-amber-200/[0.08] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-200/[0.14]"
                                >
                                    <FiPlus size={14} aria-hidden="true" />
                                    <span>Add trusted contact</span>
                                </button>
                            </div>

                            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5 space-y-4">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Safety Region</p>
                                    <h4 className="mt-2 text-lg font-serif text-white">Choose which crisis guidance to show</h4>
                                </div>

                                <SelectField
                                    label="Safety resources"
                                    value={safetyRegion}
                                    onChange={(value) => onSafetyRegionChange(value as SafetyRegion)}
                                    options={SAFETY_REGION_OPTIONS}
                                    emptyLabel="Auto detect"
                                    helper="Auto uses the profile location when it can. Outside the U.S., Notive shifts to local-emergency language instead of 988."
                                />

                                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-7 text-ink-secondary">
                                    {safetyRegion === 'us'
                                        ? 'Safety Mode will show 988 and 911 guidance.'
                                        : safetyRegion === 'intl'
                                            ? 'Safety Mode will point toward local emergency services and a trusted person instead of U.S.-only numbers.'
                                            : 'Safety Mode will try to use your profile location first, then fall back to general local-emergency guidance.'}
                                </div>
                            </div>
                        </div>

                        <div className="mt-5 space-y-3">
                            <div>
                                <h4 className="text-lg font-serif text-white">Saved trusted contacts</h4>
                                <p className="text-sm text-ink-secondary">
                                    Mark one primary contact so Notive knows who to surface first when a note feels heavy.
                                </p>
                            </div>

                            {trustedContacts.length === 0 ? (
                                <div className="rounded-[1.4rem] border border-dashed border-white/15 bg-black/20 px-5 py-6 text-sm text-ink-secondary">
                                    No trusted contacts saved yet.
                                </div>
                            ) : (
                                <div className="grid gap-3">
                                    {trustedContacts.map((contact) => (
                                        <div key={contact.id} className="rounded-[1.4rem] border border-white/10 bg-black/20 px-4 py-4">
                                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                <div className="space-y-2">
                                                    <div className="flex flex-wrap gap-2">
                                                        {contact.isPrimary && (
                                                            <span className="rounded-full border border-amber-300/25 bg-amber-200/[0.10] px-3 py-1 text-xs uppercase tracking-[0.12em] text-white">
                                                                Primary
                                                            </span>
                                                        )}
                                                        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-ink-secondary">
                                                            {contact.channel === 'in_person' ? 'In person' : contact.channel === 'call' ? 'Call' : 'Text'}
                                                        </span>
                                                        {contact.relationship && (
                                                            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-ink-secondary">
                                                                {contact.relationship}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-white font-semibold">{contact.name}</p>
                                                    {contact.note && (
                                                        <p className="text-sm text-ink-secondary">{contact.note}</p>
                                                    )}
                                                    {(contact.phoneNumber || contact.emailAddress) && (
                                                        <div className="flex flex-wrap gap-2">
                                                            {contact.phoneNumber && (
                                                                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-ink-secondary">
                                                                    Direct text / call ready
                                                                </span>
                                                            )}
                                                            {contact.emailAddress && (
                                                                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-ink-secondary">
                                                                    Email ready
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {!contact.isPrimary && (
                                                        <button
                                                            type="button"
                                                            onClick={() => onSetPrimaryTrustedContact(contact.id)}
                                                            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-ink-secondary hover:text-white hover:border-white/30 transition-colors"
                                                        >
                                                            <FiStar size={14} aria-hidden="true" />
                                                            <span>Make Primary</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => onRemoveTrustedContact(contact.id)}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-ink-secondary hover:text-white hover:border-white/30 transition-colors"
                                                    >
                                                        <FiTrash2 size={14} aria-hidden="true" />
                                                        <span>Remove</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Questions Shown</p>
                            <p className="mt-2 text-2xl font-semibold text-white">{promptedCount}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Questions Answered</p>
                            <p className="mt-2 text-2xl font-semibold text-white">{answeredCount}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Questions Skipped</p>
                            <p className="mt-2 text-2xl font-semibold text-white">{dismissedCount}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Last Update</p>
                            <p className="mt-2 text-sm text-white">{toDateLabel(lastSignalAction)}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border border-white/10 bg-white/[0.03] px-4 py-4">
                        <div>
                            <p className="text-sm font-semibold text-white">Clear saved answers</p>
                            <p className="mt-1 text-xs text-ink-secondary">
                                This removes saved answers and history but keeps your question frequency and pinned support anchors.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onResetSignals}
                            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-ink-secondary hover:text-white hover:border-white/30 transition-colors"
                        >
                            <FiRefreshCw size={14} aria-hidden="true" />
                            <span>Clear Saved Answers</span>
                        </button>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <h3 className="text-lg font-serif text-white">Saved answers</h3>
                            <p className="text-sm text-ink-secondary">
                                Remove individual items if they are outdated, wrong, or too sensitive to keep.
                            </p>
                        </div>

                        {signalEntries.length === 0 ? (
                            <div className="rounded-[1.4rem] border border-dashed border-white/15 bg-black/20 px-5 py-8 text-sm text-ink-secondary">
                                No saved answers right now.
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
                                                        {entry.field || 'answer'}
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
                                                    Saved {toDateLabel(entry.answeredAt)}
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
                            <p className="text-xs uppercase tracking-[0.16em] text-ink-muted font-bold">What Notive Saves</p>
                            <h3 className="mt-2 text-xl font-serif text-white">Easy to review</h3>
                        </div>
                        <div className="space-y-3 text-sm text-ink-secondary">
                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                Saved answers, question history, and question frequency are stored in your settings.
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                These answers affect prompts, tone, and how Notive helps you.
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                Removing an answer stops Notive from using it going forward.
                            </div>
                            <div className="rounded-2xl border border-amber-300/20 bg-amber-200/[0.06] p-4">
                                Pinned anchors, trusted contacts, and safety-region choices are different from saved prompt answers. They act like a manual fallback for support suggestions and safety handoffs.
                            </div>
                        </div>
                    </section>

                    <section className="bento-box p-6 space-y-4">
                        <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-ink-muted font-bold">Data Tools</p>
                            <h3 className="mt-2 text-xl font-serif text-white">Download or manage your data</h3>
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
                                    <p className="text-sm font-semibold text-white">Download my data</p>
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
                                    <p className="text-sm font-semibold text-white">Manage Bring In</p>
                                    <p className="text-xs text-ink-secondary">Review connected sources and import choices.</p>
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
                                    <p className="text-sm font-semibold text-white">Open security</p>
                                    <p className="text-xs text-ink-secondary">Go to the place for sign-in, password, and account access changes.</p>
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
