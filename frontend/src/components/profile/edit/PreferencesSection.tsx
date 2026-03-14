'use client';

import React from 'react';
import { FiCheck, FiClock } from 'react-icons/fi';
import { TagInput, TextAreaField, SelectField } from './fields';
import {
    EXPERIENCE_LEVEL_OPTIONS,
    FOCUS_AREA_OPTIONS,
    IMPORT_PREFERENCE_OPTIONS,
    PRIMARY_GOAL_OPTIONS,
    WRITING_PREFERENCE_OPTIONS,
} from './types';
import type { ChecklistItem, PreferencesDraft } from './types';
import type { ProfileContextSummary } from '@/services/profile-context.service';

type PreferencesSectionProps = {
    draft: PreferencesDraft;
    outputGoalsDraft: string;
    checklistItems: ChecklistItem[];
    profileContext: ProfileContextSummary;
    onChange: (updater: (current: PreferencesDraft) => PreferencesDraft) => void;
    onOutputGoalsDraftChange: (value: string) => void;
    onAddOutputGoal: () => void;
    onRemoveOutputGoal: (value: string) => void;
};

export function PreferencesSection({
    draft,
    outputGoalsDraft,
    checklistItems,
    profileContext,
    onChange,
    onOutputGoalsDraftChange,
    onAddOutputGoal,
    onRemoveOutputGoal,
}: PreferencesSectionProps) {
    return (
        <div className="space-y-6">
            <section className="grid gap-6 xl:grid-cols-[1.4fr,1fr]">
                <div className="bento-box p-8 space-y-6">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-ink-muted font-bold">Preferences</p>
                            <h2 className="mt-2 text-2xl font-serif text-white">Setup checklist and product behavior</h2>
                            <p className="mt-2 text-sm text-ink-secondary">
                                These settings shape capture prompts, insights, portfolio framing, and how the product interprets your entries over time.
                            </p>
                        </div>
                        <div className="rounded-[1.4rem] border border-primary/20 bg-primary/10 px-4 py-3 min-w-[180px]">
                            <p className="text-xs uppercase tracking-[0.14em] text-primary font-bold">Completion</p>
                            <p className="mt-2 text-3xl font-serif text-white">{profileContext.completionScore}%</p>
                            <p className="mt-1 text-xs text-ink-secondary">
                                {profileContext.completedFields} of {profileContext.totalFields} setup items complete
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <SelectField
                            label="Primary Goal"
                            value={draft.primaryGoal}
                            onChange={(value) => onChange((current) => ({ ...current, primaryGoal: value }))}
                            options={PRIMARY_GOAL_OPTIONS}
                        />
                        <SelectField
                            label="Focus Area"
                            value={draft.focusArea}
                            onChange={(value) => onChange((current) => ({ ...current, focusArea: value }))}
                            options={FOCUS_AREA_OPTIONS}
                        />
                        <SelectField
                            label="Experience Level"
                            value={draft.experienceLevel}
                            onChange={(value) => onChange((current) => ({ ...current, experienceLevel: value }))}
                            options={EXPERIENCE_LEVEL_OPTIONS}
                        />
                        <SelectField
                            label="Writing Style"
                            value={draft.writingPreference}
                            onChange={(value) => onChange((current) => ({ ...current, writingPreference: value }))}
                            options={WRITING_PREFERENCE_OPTIONS}
                        />
                        <SelectField
                            label="Import Preference"
                            value={draft.importPreference}
                            onChange={(value) => onChange((current) => ({ ...current, importPreference: value }))}
                            options={IMPORT_PREFERENCE_OPTIONS}
                            helper="Use this to tell the app how aggressively to guide social imports."
                        />
                        <div className="md:col-span-2">
                            <TagInput
                                label="Output Goals"
                                values={draft.outputGoals}
                                draft={outputGoalsDraft}
                                placeholder="Add an outcome and press Enter"
                                helper="These goals influence portfolio and application-ready outputs."
                                onDraftChange={onOutputGoalsDraftChange}
                                onAdd={onAddOutputGoal}
                                onRemove={onRemoveOutputGoal}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <TextAreaField
                                label="Starter Prompt Preference"
                                value={draft.starterPrompt}
                                onChange={(value) => onChange((current) => ({ ...current, starterPrompt: value }))}
                                placeholder="Example: What happened today that I want to remember and learn from?"
                                helper="Shown when you want a faster on-ramp into writing."
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <section className="bento-box p-6 space-y-4">
                        <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-ink-muted font-bold">Setup Checklist</p>
                            <h3 className="mt-2 text-xl font-serif text-white">Persistent setup, not a one-time flow</h3>
                        </div>
                        <div className="space-y-3">
                            {checklistItems.map((item) => (
                                <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                                    <div className="flex items-start gap-3">
                                        <span className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border ${item.done ? 'border-primary/40 bg-primary/15 text-primary' : 'border-white/15 bg-white/[0.03] text-ink-muted'}`}>
                                            {item.done ? <FiCheck size={14} aria-hidden="true" /> : <FiClock size={14} aria-hidden="true" />}
                                        </span>
                                        <div>
                                            <p className="text-sm font-semibold text-white">{item.label}</p>
                                            <p className="mt-1 text-xs text-ink-secondary">{item.hint}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="bento-box p-6 space-y-4">
                        <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-ink-muted font-bold">Live Impact</p>
                            <h3 className="mt-2 text-xl font-serif text-white">How the current setup reads</h3>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Stage</p>
                                <p className="mt-1 text-white capitalize">{profileContext.stage.replace('_', ' ')}</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Track</p>
                                <p className="mt-1 text-white capitalize">{profileContext.track}</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Personal Growth</p>
                                <p className="mt-1 text-white">{profileContext.personalGrowthScore}%</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Professional Readiness</p>
                                <p className="mt-1 text-white">{profileContext.professionalReadinessScore}%</p>
                            </div>
                        </div>
                    </section>
                </div>
            </section>
        </div>
    );
}
