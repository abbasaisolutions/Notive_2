'use client';

import React from 'react';
import Link from 'next/link';
import { FiDownload, FiExternalLink, FiLink, FiMapPin, FiPlus, FiRefreshCw, FiShield, FiStar, FiTrash2 } from 'react-icons/fi';
import SpotifyConnection from '@/components/profile/SpotifyConnection';
import { SelectField, TagInput, TextField } from './fields';
import type { VoiceLexiconItem } from '@/services/voice-lexicon.service';
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
    dailyGentleReflectionsEnabled: boolean;
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
    isLoadingVoiceLexicon: boolean;
    isSavingVoiceLexicon: boolean;
    voiceLexiconItems: VoiceLexiconItem[];
    voiceLexiconDraft: string;
    voiceLexiconAliasesDraft: string;
    voiceLexiconLocaleDraft: string;
    voiceLexiconTypeDraft: string;
    voiceLexiconError: string | null;
    onPromptFrequencyChange: (value: PromptFrequency) => void;
    onDailyGentleReflectionsChange: (enabled: boolean) => void;
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
    onVoiceLexiconDraftChange: (value: string) => void;
    onVoiceLexiconAliasesDraftChange: (value: string) => void;
    onVoiceLexiconLocaleDraftChange: (value: string) => void;
    onVoiceLexiconTypeDraftChange: (value: string) => void;
    onSaveVoiceLexiconItem: () => void;
    onDeleteVoiceLexiconItem: (id: string) => void;
};

export function PrivacySection({
    promptFrequency,
    dailyGentleReflectionsEnabled,
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
    isLoadingVoiceLexicon,
    isSavingVoiceLexicon,
    voiceLexiconItems,
    voiceLexiconDraft,
    voiceLexiconAliasesDraft,
    voiceLexiconLocaleDraft,
    voiceLexiconTypeDraft,
    voiceLexiconError,
    onPromptFrequencyChange,
    onDailyGentleReflectionsChange,
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
    onVoiceLexiconDraftChange,
    onVoiceLexiconAliasesDraftChange,
    onVoiceLexiconLocaleDraftChange,
    onVoiceLexiconTypeDraftChange,
    onSaveVoiceLexiconItem,
    onDeleteVoiceLexiconItem,
}: PrivacySectionProps) {
    const pinnedCount = pinnedPeople.length + groundingRoutines.length + trustedContacts.length;
    const lexiconCount = voiceLexiconItems.length;

    return (
        <div className="space-y-6">
            <section className="grid gap-6 xl:grid-cols-[1.35fr,1fr]">
                <div className="workspace-panel rounded-[2rem] p-8 space-y-6">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-ink-muted font-bold">Data</p>
                        <h2 className="workspace-heading mt-2 text-2xl font-serif">See and control saved answers</h2>
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
                        <div className="workspace-soft-panel rounded-[1.4rem] p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Daily Gentle Reflections</p>
                                    <p className="mt-2 text-lg font-semibold text-[rgb(var(--text-primary))]">
                                        {dailyGentleReflectionsEnabled ? 'On' : 'Off'}
                                    </p>
                                    <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                        Warm, optional journal nudges on the dashboard. This build uses recent notes, moods, and resurfaced journal themes only.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={dailyGentleReflectionsEnabled}
                                    onClick={() => onDailyGentleReflectionsChange(!dailyGentleReflectionsEnabled)}
                                    className={`inline-flex h-8 w-16 items-center rounded-full border px-1 transition-colors ${
                                        dailyGentleReflectionsEnabled
                                            ? 'border-[rgb(var(--brand))]/30 bg-[rgb(var(--brand))]/15 justify-end'
                                            : 'workspace-pill justify-start'
                                    }`}
                                >
                                    <span className="h-6 w-6 rounded-full bg-white shadow-sm" />
                                </button>
                            </div>
                            <p className="mt-4 text-xs leading-6 text-ink-secondary">
                                Cover images and media are stored privately and never shared.
                            </p>
                        </div>
                        <div className="workspace-soft-panel rounded-[1.4rem] p-5">
                            <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Saved Answers</p>
                            <p className="workspace-heading mt-2 text-3xl font-serif">{signalEntries.length}</p>
                            <p className="mt-1 text-sm text-ink-secondary">
                                Answers Notive uses to fit prompts and help.
                            </p>
                        </div>
                    </div>

                    <div className="workspace-soft-panel rounded-[1.6rem] p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="max-w-xl">
                                <p className="text-xs uppercase tracking-[0.16em] text-ink-muted font-bold">Bridge Fallback</p>
                                <h3 className="workspace-heading mt-2 text-xl font-serif">Keep trusted people, channels, and steady routines visible</h3>
                                <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                    Pin the people you trust, choose how you usually reach them, and keep the routines that steady you close. When a note feels vague or overwhelmed, Notive can lean on these anchors instead of guessing.
                                </p>
                            </div>
                            <div className="workspace-soft-panel rounded-[1.3rem] px-4 py-4">
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Pinned Anchors</p>
                                <p className="workspace-heading mt-2 text-3xl font-serif">{pinnedCount}</p>
                                <p className="mt-1 text-sm text-ink-secondary">
                                    We use these contacts to suggest support in Bridge Builder when your notes feel unclear.
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 grid gap-5 lg:grid-cols-2">
                            <TagInput
                                label="Trusted people"
                                values={pinnedPeople}
                                draft={pinnedPeopleDraft}
                                placeholder="Add a trusted adult, friend, coach, or counselor"
                                helper="Connect us with up to six people you trust—we may suggest them when reflection gets unclear."
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
                            <div className="workspace-soft-panel rounded-[1.5rem] p-5 space-y-4">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Trusted Contacts</p>
                                    <h4 className="workspace-heading mt-2 text-lg font-serif">Save the person and the channel</h4>
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
                                        helper="Notive uses this to suggest the best way to reach out."
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
                                    className="workspace-button-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
                                >
                                    <FiPlus size={14} aria-hidden="true" />
                                    <span>Add trusted contact</span>
                                </button>
                            </div>

                            <div className="workspace-soft-panel rounded-[1.5rem] p-5 space-y-4">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Safety Region</p>
                                    <h4 className="workspace-heading mt-2 text-lg font-serif">Choose which crisis guidance to show</h4>
                                </div>

                                <SelectField
                                    label="Safety resources"
                                    value={safetyRegion}
                                    onChange={(value) => onSafetyRegionChange(value as SafetyRegion)}
                                    options={SAFETY_REGION_OPTIONS}
                                    emptyLabel="Auto detect"
                                    helper="We auto-detect your location to show emergency resources that match where you are."
                                />

                                <div className="workspace-muted-panel rounded-2xl p-4 text-sm leading-7 text-ink-secondary">
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
                                <h4 className="workspace-heading text-lg font-serif">Saved trusted contacts</h4>
                                <p className="text-sm text-ink-secondary">
                                    When you're feeling stuck or overwhelmed, we may suggest reaching out to someone who steadies you. Mark one as primary so we know who to surface first.
                                </p>
                            </div>

                            {trustedContacts.length === 0 ? (
                                <div className="workspace-muted-panel rounded-[1.4rem] border-dashed px-5 py-6 text-sm text-ink-secondary">
                                    No trusted contacts saved yet.
                                </div>
                            ) : (
                                <div className="grid gap-3">
                                    {trustedContacts.map((contact) => (
                                        <div key={contact.id} className="workspace-muted-panel rounded-[1.4rem] px-4 py-4">
                                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                <div className="space-y-2">
                                                    <div className="flex flex-wrap gap-2">
                                                        {contact.isPrimary && (
                                                            <span className="rounded-full border border-amber-300/25 bg-amber-200/[0.10] px-3 py-1 text-xs uppercase tracking-[0.12em] text-[rgb(var(--text-primary))]">
                                                                Primary
                                                            </span>
                                                        )}
                                                        <span className="workspace-pill rounded-full px-3 py-1 text-xs text-ink-secondary">
                                                            {contact.channel === 'in_person' ? 'In person' : contact.channel === 'call' ? 'Call' : 'Text'}
                                                        </span>
                                                        {contact.relationship && (
                                                            <span className="workspace-pill rounded-full px-3 py-1 text-xs text-ink-secondary">
                                                                {contact.relationship}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="workspace-heading font-semibold">{contact.name}</p>
                                                    {contact.note && (
                                                        <p className="text-sm text-ink-secondary">{contact.note}</p>
                                                    )}
                                                    {(contact.phoneNumber || contact.emailAddress) && (
                                                        <div className="flex flex-wrap gap-2">
                                                            {contact.phoneNumber && (
                                                                <span className="workspace-pill rounded-full px-3 py-1 text-xs text-ink-secondary">
                                                                    Direct text / call ready
                                                                </span>
                                                            )}
                                                            {contact.emailAddress && (
                                                                <span className="workspace-pill rounded-full px-3 py-1 text-xs text-ink-secondary">
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
                                                            className="workspace-button-outline inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
                                                        >
                                                            <FiStar size={14} aria-hidden="true" />
                                                            <span>Make Primary</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => onRemoveTrustedContact(contact.id)}
                                                        className="workspace-button-outline inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
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
                        <div className="workspace-soft-panel rounded-2xl p-4">
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Questions Shown</p>
                            <p className="workspace-heading mt-2 text-2xl font-semibold">{promptedCount}</p>
                        </div>
                        <div className="workspace-soft-panel rounded-2xl p-4">
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Questions Answered</p>
                            <p className="workspace-heading mt-2 text-2xl font-semibold">{answeredCount}</p>
                        </div>
                        <div className="workspace-soft-panel rounded-2xl p-4">
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Questions Skipped</p>
                            <p className="workspace-heading mt-2 text-2xl font-semibold">{dismissedCount}</p>
                        </div>
                        <div className="workspace-soft-panel rounded-2xl p-4">
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Last Update</p>
                            <p className="workspace-heading mt-2 text-sm">{toDateLabel(lastSignalAction)}</p>
                        </div>
                    </div>

                    <div className="workspace-soft-panel flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] px-4 py-4">
                        <div>
                            <p className="workspace-heading text-sm font-semibold">Clear saved answers</p>
                            <p className="mt-1 text-xs text-ink-secondary">
                                This removes saved answers and history but keeps your question frequency and pinned support anchors.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onResetSignals}
                            className="workspace-button-outline inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
                        >
                            <FiRefreshCw size={14} aria-hidden="true" />
                            <span>Clear Saved Answers</span>
                        </button>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <h3 className="workspace-heading text-lg font-serif">Saved answers</h3>
                            <p className="text-sm text-ink-secondary">
                                Remove individual items if they are outdated, wrong, or too sensitive to keep.
                            </p>
                        </div>

                        {signalEntries.length === 0 ? (
                            <div className="workspace-muted-panel rounded-[1.4rem] border-dashed px-5 py-8 text-sm text-ink-secondary">
                                No saved answers right now.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {signalEntries.map((entry) => (
                                    <div
                                        key={`${entry.key}-${entry.answeredAt}`}
                                        className="workspace-muted-panel rounded-[1.4rem] px-4 py-4"
                                    >
                                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                                            <div className="space-y-2">
                                                <div className="flex flex-wrap gap-2">
                                                    <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs uppercase tracking-[0.12em] text-primary">
                                                        {entry.field || 'answer'}
                                                    </span>
                                                    {entry.questionId && (
                                                        <span className="workspace-pill rounded-full px-3 py-1 text-xs text-ink-secondary">
                                                            {entry.questionId}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="workspace-heading font-semibold">{entry.label || entry.value}</p>
                                                <p className="text-sm text-ink-secondary">{entry.value}</p>
                                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                                                    Saved {toDateLabel(entry.answeredAt)}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => onRemoveSignal(entry)}
                                                className="workspace-button-outline inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
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
                    <section className="workspace-panel rounded-[2rem] p-6 space-y-4">
                        <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-ink-muted font-bold">What Notive Saves</p>
                            <h3 className="workspace-heading mt-2 text-xl font-serif">Easy to review</h3>
                        </div>
                        <div className="space-y-3 text-sm text-ink-secondary">
                            <div className="workspace-soft-panel rounded-2xl p-4">
                                Saved answers, question history, and question frequency are stored in your settings.
                            </div>
                            <div className="workspace-soft-panel rounded-2xl p-4">
                                These answers affect prompts, tone, and how Notive helps you.
                            </div>
                            <div className="workspace-soft-panel rounded-2xl p-4">
                                Removing an answer stops Notive from using it going forward.
                            </div>
                            <div className="rounded-2xl border border-amber-300/20 bg-amber-200/[0.06] p-4">
                                Pinned anchors, trusted contacts, and safety-region choices are different from saved prompt answers. They act like a manual fallback for support suggestions and safety handoffs.
                            </div>
                        </div>
                    </section>

                    <section className="workspace-panel rounded-[2rem] p-6 space-y-4">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs uppercase tracking-[0.16em] text-ink-muted font-bold">Voice Spellings</p>
                                <h3 className="workspace-heading mt-2 text-xl font-serif">Teach names and places once</h3>
                                <p className="mt-2 text-sm text-ink-secondary">
                                    Add people, locations, schools, or event names that should keep their spelling across voice notes.
                                </p>
                            </div>
                            <div className="workspace-soft-panel rounded-2xl px-4 py-3">
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Saved Terms</p>
                                <p className="workspace-heading mt-2 text-2xl font-semibold">{lexiconCount}</p>
                            </div>
                        </div>

                        <div className="grid gap-4">
                            <TextField
                                label="Canonical spelling"
                                value={voiceLexiconDraft}
                                onChange={onVoiceLexiconDraftChange}
                                placeholder="Sialkot"
                                helper="Use the exact spelling you want Notive to prefer."
                            />
                            <TextField
                                label="Aliases"
                                value={voiceLexiconAliasesDraft}
                                onChange={onVoiceLexiconAliasesDraftChange}
                                placeholder="seal coat, سیالکوٹ"
                                helper="Optional. Separate alternate spellings or transliterations with commas."
                            />
                            <div className="grid gap-4 sm:grid-cols-2">
                                <SelectField
                                    label="Language"
                                    value={voiceLexiconLocaleDraft}
                                    onChange={onVoiceLexiconLocaleDraftChange}
                                    options={[
                                        { value: 'en', label: 'English' },
                                        { value: 'ur', label: 'Urdu' },
                                        { value: 'pa', label: 'Punjabi' },
                                        { value: 'ar', label: 'Arabic' },
                                        { value: 'hi', label: 'Hindi' },
                                    ]}
                                    emptyLabel="Any language"
                                    helper="Optional. Leave open if the term should apply everywhere."
                                />
                                <SelectField
                                    label="Type"
                                    value={voiceLexiconTypeDraft}
                                    onChange={onVoiceLexiconTypeDraftChange}
                                    options={[
                                        { value: 'person', label: 'Person' },
                                        { value: 'place', label: 'Place' },
                                        { value: 'event', label: 'Event' },
                                        { value: 'org', label: 'Organization' },
                                    ]}
                                    emptyLabel="General term"
                                    helper="This helps future routing and review."
                                />
                            </div>
                            <button
                                type="button"
                                onClick={onSaveVoiceLexiconItem}
                                disabled={isSavingVoiceLexicon || !voiceLexiconDraft.trim()}
                                className="workspace-button-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
                            >
                                <FiPlus size={14} aria-hidden="true" />
                                <span>{isSavingVoiceLexicon ? 'Saving...' : 'Save spelling'}</span>
                            </button>
                        </div>

                        {voiceLexiconError && (
                            <div className="workspace-soft-panel rounded-2xl p-4 text-sm text-ink-secondary">
                                {voiceLexiconError}
                            </div>
                        )}

                        {isLoadingVoiceLexicon ? (
                            <div className="workspace-muted-panel rounded-[1.4rem] border-dashed px-5 py-6 text-sm text-ink-secondary">
                                Loading saved voice spellings...
                            </div>
                        ) : voiceLexiconItems.length === 0 ? (
                            <div className="workspace-muted-panel rounded-[1.4rem] border-dashed px-5 py-6 text-sm text-ink-secondary">
                                No custom spellings saved yet.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {voiceLexiconItems.map((item) => (
                                    <div key={item.id} className="workspace-muted-panel rounded-[1.4rem] px-4 py-4">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="space-y-2">
                                                <div className="flex flex-wrap gap-2">
                                                    {item.locale && (
                                                        <span className="workspace-pill rounded-full px-3 py-1 text-xs text-ink-secondary">
                                                            {item.locale.toUpperCase()}
                                                        </span>
                                                    )}
                                                    {item.itemType && (
                                                        <span className="workspace-pill rounded-full px-3 py-1 text-xs text-ink-secondary">
                                                            {item.itemType}
                                                        </span>
                                                    )}
                                                    <span className="workspace-pill rounded-full px-3 py-1 text-xs text-ink-secondary">
                                                        Used {item.usageCount} times
                                                    </span>
                                                </div>
                                                <p className="workspace-heading font-semibold">{item.canonical}</p>
                                                {item.aliases.length > 0 && (
                                                    <p className="text-sm text-ink-secondary">
                                                        Aliases: {item.aliases.join(', ')}
                                                    </p>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => onDeleteVoiceLexiconItem(item.id)}
                                                className="workspace-button-outline inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
                                            >
                                                <FiTrash2 size={14} aria-hidden="true" />
                                                <span>Remove</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="workspace-panel rounded-[2rem] p-6 space-y-4">
                        <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-ink-muted font-bold">Data Tools</p>
                            <h3 className="workspace-heading mt-2 text-xl font-serif">Download or manage your data</h3>
                        </div>
                        <button
                            type="button"
                            onClick={onExportData}
                            disabled={isExporting}
                            className="workspace-soft-panel flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left transition-all hover:opacity-90 disabled:opacity-50"
                        >
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-primary/10 p-2 text-primary">
                                    <FiDownload size={16} aria-hidden="true" />
                                </div>
                                <div>
                                    <p className="workspace-heading text-sm font-semibold">Download my data</p>
                                    <p className="text-xs text-ink-secondary">Download a JSON export of your account data.</p>
                                </div>
                            </div>
                            <FiExternalLink size={16} aria-hidden="true" className="text-ink-muted" />
                        </button>

                        <Link
                            href="/import"
                            className="workspace-soft-panel flex w-full items-center justify-between rounded-2xl px-4 py-4 transition-all hover:opacity-90"
                        >
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-secondary/10 p-2 text-secondary">
                                    <FiLink size={16} aria-hidden="true" />
                                </div>
                                <div>
                                    <p className="workspace-heading text-sm font-semibold">Manage Bring In</p>
                                    <p className="text-xs text-ink-secondary">Review connected sources and import choices.</p>
                                </div>
                            </div>
                            <FiExternalLink size={16} aria-hidden="true" className="text-ink-muted" />
                        </Link>

                        <Link
                            href="/profile/edit?tab=security"
                            className="workspace-soft-panel flex w-full items-center justify-between rounded-2xl px-4 py-4 transition-all hover:opacity-90"
                        >
                            <div className="flex items-center gap-3">
                                <div className="workspace-icon-badge rounded-xl p-2">
                                    <FiShield size={16} aria-hidden="true" />
                                </div>
                                <div>
                                    <p className="workspace-heading text-sm font-semibold">Open security</p>
                                    <p className="text-xs text-ink-secondary">Go to the place for sign-in, password, and account access changes.</p>
                                </div>
                            </div>
                            <FiExternalLink size={16} aria-hidden="true" className="text-ink-muted" />
                        </Link>
                    </section>
                </div>
            </section>

            {/* ── Connected Services ── */}
            <section className="grid gap-6 xl:grid-cols-2">
                <SpotifyConnection />
            </section>

            {/* ── Device Preferences ── */}
            <section className="workspace-panel rounded-[2rem] p-8 space-y-6">
                <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-ink-muted font-bold">Device Context</p>
                    <h2 className="workspace-heading mt-2 text-2xl font-serif">What Notive notices</h2>
                    <p className="mt-2 text-sm text-ink-secondary">
                        These signals enrich your insights — where you write, what you listen to, how your day felt. Nothing is shared.
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="workspace-soft-panel rounded-2xl px-4 py-4">
                        <div className="flex items-center gap-3 mb-2">
                            <FiMapPin size={16} className="text-ink-secondary" />
                            <p className="workspace-heading text-sm font-semibold">Location</p>
                        </div>
                        <p className="text-xs text-ink-secondary">
                            Captures a general place name when you write (e.g., &ldquo;Library&rdquo;, &ldquo;Home&rdquo;).
                            Uses your device GPS — never stored precisely.
                        </p>
                        <p className="text-xs text-ink-muted mt-2">Managed per-entry · disable in your device settings</p>
                    </div>
                    <div className="workspace-soft-panel rounded-2xl px-4 py-4">
                        <div className="flex items-center gap-3 mb-2">
                            <FiShield size={16} className="text-ink-secondary" />
                            <p className="workspace-heading text-sm font-semibold">Daily check-in</p>
                        </div>
                        <p className="text-xs text-ink-secondary">
                            A quick energy / stress / social check-in on your dashboard.
                            Entirely optional — only shows when you haven&apos;t submitted one today.
                        </p>
                        <p className="text-xs text-ink-muted mt-2">Self-reported · appears on dashboard</p>
                    </div>
                </div>

                <div className="health-quiet flex items-center gap-2 px-1 text-xs">
                    <FiShield className="w-3 h-3" />
                    <span>All your data stays private with us. We never share it, sell it, or use it for ads.</span>
                </div>
            </section>
        </div>
    );
}
