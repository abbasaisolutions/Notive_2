'use client';

import React from 'react';
import { FiInfo } from 'react-icons/fi';
import { TagInput, TextAreaField, TextField } from './fields';
import type { ProfileDraft } from './types';

type ProfileSectionProps = {
    draft: ProfileDraft;
    lifeGoalsDraft: string;
    onChange: (updater: (current: ProfileDraft) => ProfileDraft) => void;
    onLifeGoalsDraftChange: (value: string) => void;
    onAddLifeGoal: () => void;
    onRemoveLifeGoal: (value: string) => void;
};

export function ProfileSection({
    draft,
    lifeGoalsDraft,
    onChange,
    onLifeGoalsDraftChange,
    onAddLifeGoal,
    onRemoveLifeGoal,
}: ProfileSectionProps) {
    return (
        <div className="space-y-6">
            <section className="grid gap-6 lg:grid-cols-[1.6fr,1fr]">
                <div className="bento-box p-8 space-y-6">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-ink-muted font-bold">Profile</p>
                        <h2 className="mt-2 text-2xl font-serif text-white">Basic identity and account details</h2>
                        <p className="mt-2 text-sm text-ink-secondary">
                            Keep the public-facing identity details together. Sign-in email and destructive account controls now live in Security.
                        </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <TextField
                            label="Display Name"
                            value={draft.name}
                            onChange={(value) => onChange((current) => ({ ...current, name: value }))}
                            placeholder="How your name should appear"
                        />
                        <TextField
                            label="Avatar URL"
                            type="url"
                            value={draft.avatarUrl}
                            onChange={(value) => onChange((current) => ({ ...current, avatarUrl: value }))}
                            placeholder="https://..."
                            helper="Optional. Used for your account avatar."
                        />
                        <TextField
                            label="Website"
                            type="url"
                            value={draft.website}
                            onChange={(value) => onChange((current) => ({ ...current, website: value }))}
                            placeholder="https://..."
                        />
                        <TextField
                            label="Location"
                            value={draft.location}
                            onChange={(value) => onChange((current) => ({ ...current, location: value }))}
                            placeholder="City, State"
                        />
                        <TextField
                            label="Occupation"
                            value={draft.occupation}
                            onChange={(value) => onChange((current) => ({ ...current, occupation: value }))}
                            placeholder="Student, designer, engineer..."
                        />
                        <div className="md:col-span-2">
                            <TextAreaField
                                label="Bio"
                                value={draft.bio}
                                onChange={(value) => onChange((current) => ({ ...current, bio: value }))}
                                placeholder="Describe what matters most about your work, goals, or story."
                                helper="Use this for human-readable context, not system settings."
                                minHeight={140}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <TagInput
                                label="Life Goals"
                                values={draft.lifeGoals}
                                draft={lifeGoalsDraft}
                                placeholder="Add a long-term goal and press Enter"
                                helper="These goals shape reflection and growth context."
                                onDraftChange={onLifeGoalsDraftChange}
                                onAdd={onAddLifeGoal}
                                onRemove={onRemoveLifeGoal}
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <section className="bento-box p-6 space-y-4">
                        <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-ink-muted font-bold">Account Snapshot</p>
                            <h3 className="mt-2 text-xl font-serif text-white">What other screens depend on</h3>
                        </div>
                        <div className="space-y-3 text-sm text-ink-secondary">
                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Name</p>
                                <p className="mt-1 text-white">{draft.name || 'Not set'}</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Email</p>
                                <p className="mt-1 text-white break-all">{draft.email || 'Not set'}</p>
                                <p className="mt-2 text-xs text-ink-secondary">
                                    Sign-in email changes now live in the Security tab.
                                </p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Profile Summary</p>
                                <p className="mt-1 text-white">
                                    {draft.bio.trim() || 'No profile summary added yet.'}
                                </p>
                            </div>
                        </div>
                    </section>

                    <section className="bento-box p-6 space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="mt-1 rounded-xl bg-primary/10 p-2 text-primary">
                                <FiInfo size={16} aria-hidden="true" />
                            </div>
                            <div>
                                <h3 className="text-lg font-serif text-white">Why this section is separate</h3>
                                <p className="mt-2 text-sm text-ink-secondary">
                                    Identity details change less often than writing behavior or privacy choices. Separating them makes save intent clear and reduces accidental overwrites.
                                </p>
                            </div>
                        </div>
                    </section>
                </div>
            </section>
        </div>
    );
}
