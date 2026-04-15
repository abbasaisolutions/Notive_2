'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppPanel, SectionHeader, TagPill } from '@/components/ui/surface';
import { useToast } from '@/context/toast-context';
import type { SupportAnchor, SupportMapResponse } from './types';

const TYPE_STYLES: Record<SupportAnchor['type'], string> = {
    person: 'border-amber-300/40 bg-amber-200/35 text-[rgb(var(--text-primary))]',
    group: 'border-sky-300/40 bg-sky-200/35 text-[rgb(var(--text-primary))]',
    place: 'border-emerald-300/40 bg-emerald-200/35 text-[rgb(var(--text-primary))]',
    routine: 'border-violet-300/40 bg-violet-200/35 text-[rgb(var(--text-primary))]',
};

const TYPE_LABELS: Record<SupportAnchor['type'], string> = {
    person: 'Person',
    group: 'Group',
    place: 'Place',
    routine: 'Routine',
};

const VALENCE_TONES: Record<'supportive' | 'mixed' | 'stressful', 'primary' | 'default' | 'muted'> = {
    supportive: 'primary',
    mixed: 'default',
    stressful: 'muted',
};

const CHANNEL_LABELS: Record<'text' | 'call' | 'in_person', string> = {
    text: 'Text',
    call: 'Call',
    in_person: 'In person',
};

const formatOutcomeMemoryLine = (anchor: SupportAnchor) => {
    const memory = anchor.outcomeMemory;
    if (!memory) return '';

    if (memory.helpedCount > 0 && memory.stillNeedCount > 0) {
        return `${anchor.label} helped after ${memory.helpedCount} reach-out${memory.helpedCount === 1 ? '' : 's'}, but there were also ${memory.stillNeedCount} times you still needed more support afterward.`;
    }

    if (memory.helpedCount > 0) {
        return `${anchor.label} helped after ${memory.helpedCount} past reach-out${memory.helpedCount === 1 ? '' : 's'}.`;
    }

    if (memory.stillNeedCount > 0) {
        return `You reached out here before, but still needed more support ${memory.stillNeedCount === 1 ? 'once' : `${memory.stillNeedCount} times`}. Keep backup options visible too.`;
    }

    return '';
};

const formatRecordedAt = (value: string | null | undefined) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function SupportConstellation({
    supportMap,
    openEntryHref,
    onAnchorSelect,
    onCopyStarter,
}: {
    supportMap: SupportMapResponse | null;
    openEntryHref?: (entryId: string) => string;
    onAnchorSelect?: (anchor: SupportAnchor) => void;
    onCopyStarter?: (anchor: SupportAnchor) => void;
}) {
    const anchors = useMemo(() => supportMap?.anchors || [], [supportMap]);
    const [selectedId, setSelectedId] = useState<string | null>(anchors[0]?.id || null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const toast = useToast();

    useEffect(() => {
        setSelectedId((current) => (current && anchors.some((anchor) => anchor.id === current) ? current : anchors[0]?.id || null));
    }, [anchors]);

    const activeAnchor = useMemo(
        () => anchors.find((anchor) => anchor.id === selectedId) || anchors[0] || null,
        [anchors, selectedId]
    );

    const handleSelect = (anchor: SupportAnchor) => {
        setSelectedId(anchor.id);
        onAnchorSelect?.(anchor);
    };

    const handleCopy = async (anchor: SupportAnchor) => {
        if (!anchor.messageStarter) return;
        try {
            await navigator.clipboard.writeText(anchor.messageStarter);
            setCopiedId(anchor.id);
            toast.success('Copied to clipboard!');
            onCopyStarter?.(anchor);
            window.setTimeout(() => {
                setCopiedId((current) => (current === anchor.id ? null : current));
            }, 1800);
        } catch (error) {
            console.error('Failed to copy support starter:', error);
        }
    };

    if (!supportMap || anchors.length === 0) {
        return (
            <AppPanel className="space-y-4">
                <SectionHeader
                    kicker="Support"
                    title="Support anchors will form here"
                    description="Once a few notes show who or what helps, Notive will turn them into a visible support map."
                />
                <div className="workspace-soft-panel rounded-[1.8rem] p-5 text-sm leading-7 text-ink-secondary">
                    People, places, and routines do not need to be perfect to matter. Notive will start surfacing them when the pattern gets strong enough.
                </div>
            </AppPanel>
        );
    }

    return (
        <AppPanel className="space-y-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <SectionHeader
                    kicker="Support"
                    title="See what helps you feel steadier"
                    description={supportMap.summary}
                />
                <div className="flex flex-wrap gap-2">
                    <TagPill tone="primary">{supportMap.basedOnEntries} notes</TagPill>
                    <TagPill>{anchors.length} anchors</TagPill>
                </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)]">
                <div className="workspace-soft-panel relative overflow-hidden rounded-[2rem] p-5">
                    <div className="pointer-events-none absolute inset-0 opacity-40">
                        <div className="absolute left-[-8%] top-[18%] h-36 w-36 rounded-full border border-[rgba(var(--paper-border),0.76)]" />
                        <div className="absolute right-[4%] top-[10%] h-24 w-24 rounded-full border border-[rgba(var(--paper-border),0.76)]" />
                        <div className="absolute bottom-[12%] left-[12%] h-20 w-20 rounded-full border border-[rgba(var(--paper-border),0.76)]" />
                        <div className="absolute bottom-[18%] right-[10%] h-32 w-32 rounded-full border border-[rgba(var(--paper-border),0.76)]" />
                    </div>
                    <div className="relative flex min-h-[18rem] flex-wrap items-center justify-center gap-3">
                        {anchors.map((anchor, index) => {
                            const isActive = activeAnchor?.id === anchor.id;
                            const minWidth = Math.round(96 + (anchor.strength * 72));
                            const offset = index % 2 === 0 ? '-6px' : '6px';

                            return (
                                <button
                                    key={anchor.id}
                                    type="button"
                                    onClick={() => handleSelect(anchor)}
                                    className={`rounded-[1.8rem] border px-4 py-3 text-left transition-all ${TYPE_STYLES[anchor.type]} ${
                                        isActive
                                            ? 'scale-[1.02] shadow-[0_16px_40px_rgba(0,0,0,0.28)]'
                                            : 'opacity-90 hover:opacity-100'
                                    }`}
                                    style={{
                                        minWidth: `${minWidth}px`,
                                        transform: `translateY(${offset})`,
                                    }}
                                >
                                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">{TYPE_LABELS[anchor.type]}</p>
                                    <p className="workspace-heading mt-1 text-sm font-semibold">{anchor.label}</p>
                                    <p className="mt-1 text-xs text-ink-secondary">{anchor.supportCount} steady notes</p>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {activeAnchor && (
                    <div className="space-y-4">
                        <div className="workspace-panel rounded-[1.8rem] p-5">
                            <div className="flex flex-wrap items-center gap-2">
                                <TagPill tone="primary">{TYPE_LABELS[activeAnchor.type]}</TagPill>
                                <TagPill>{Math.round(activeAnchor.strength * 100)}% strength</TagPill>
                                <TagPill>{activeAnchor.lastSeen}</TagPill>
                                {activeAnchor.source === 'pinned' && <TagPill>Pinned in Me</TagPill>}
                                {activeAnchor.source === 'blended' && <TagPill>Pinned + Notes</TagPill>}
                                {activeAnchor.relationship && <TagPill>{activeAnchor.relationship}</TagPill>}
                                {activeAnchor.preferredChannel && <TagPill>{CHANNEL_LABELS[activeAnchor.preferredChannel]}</TagPill>}
                                {activeAnchor.outcomeMemory?.helpedCount ? (
                                    <TagPill tone="primary">
                                        Helped {activeAnchor.outcomeMemory.helpedCount}x
                                    </TagPill>
                                ) : null}
                                {activeAnchor.outcomeMemory?.stillNeedCount ? (
                                    <TagPill>
                                        Backup needed {activeAnchor.outcomeMemory.stillNeedCount}x
                                    </TagPill>
                                ) : null}
                            </div>
                            <h3 className="workspace-heading mt-4 text-2xl font-semibold">{activeAnchor.label}</h3>
                            <p className="mt-3 text-sm leading-7 text-ink-secondary">{activeAnchor.whyItHelps}</p>
                        </div>

                        {activeAnchor.outcomeMemory && (
                            <div className="rounded-[1.8rem] border border-emerald-300/20 bg-emerald-300/[0.06] p-5">
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">After reach-outs</p>
                                <p className="mt-2 text-sm leading-7 text-[rgb(var(--text-primary))]">
                                    {formatOutcomeMemoryLine(activeAnchor)}
                                </p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <TagPill tone="primary">
                                        Helped {activeAnchor.outcomeMemory.helpedCount} time{activeAnchor.outcomeMemory.helpedCount === 1 ? '' : 's'}
                                    </TagPill>
                                    {activeAnchor.outcomeMemory.stillNeedCount > 0 && (
                                        <TagPill>
                                            Still needed support {activeAnchor.outcomeMemory.stillNeedCount} time{activeAnchor.outcomeMemory.stillNeedCount === 1 ? '' : 's'}
                                        </TagPill>
                                    )}
                                    {activeAnchor.outcomeMemory.lastOutcome && (
                                        <TagPill>
                                            {activeAnchor.outcomeMemory.lastOutcome === 'helped'
                                                ? 'Last check-in helped'
                                                : 'Last check-in needed backup'}
                                        </TagPill>
                                    )}
                                    {formatRecordedAt(activeAnchor.outcomeMemory.lastRecordedAt) && (
                                        <TagPill>{formatRecordedAt(activeAnchor.outcomeMemory.lastRecordedAt)}</TagPill>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="rounded-[1.8rem] border border-amber-300/20 bg-amber-200/[0.06] p-5">
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Reconnect move</p>
                            <p className="mt-2 text-sm leading-7 text-[rgb(var(--text-primary))]">{activeAnchor.reconnectSuggestion}</p>
                            {activeAnchor.messageStarter && (
                                <>
                                    <p className="mt-4 text-xs uppercase tracking-[0.12em] text-ink-muted">What to say</p>
                                    <p className="mt-2 text-sm leading-7 text-[rgb(var(--text-primary))]">{activeAnchor.messageStarter}</p>
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(activeAnchor)}
                                        className="workspace-button-outline mt-4 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em]"
                                    >
                                        {copiedId === activeAnchor.id ? 'Copied' : 'Copy check-in line'}
                                    </button>
                                </>
                            )}
                        </div>

                        <div className="workspace-soft-panel rounded-[1.8rem] p-5">
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Grounding notes</p>
                            {activeAnchor.evidence.length === 0 ? (
                                <div className="workspace-muted-panel mt-4 rounded-2xl border-dashed p-4 text-sm leading-7 text-ink-secondary">
                                    {activeAnchor.source === 'pinned'
                                        ? 'This anchor is pinned in Me, so it stays available even before enough notes build evidence around it.'
                                        : 'No grounding notes are attached to this anchor yet.'}
                                </div>
                            ) : (
                                <div className="mt-4 space-y-3">
                                    {activeAnchor.evidence.map((evidence) => (
                                        <div key={`${activeAnchor.id}-${evidence.entryId}-${evidence.createdAt}`} className="workspace-muted-panel rounded-2xl p-4">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <TagPill tone={VALENCE_TONES[evidence.valence]}>{evidence.valence}</TagPill>
                                                <TagPill>{evidence.createdAt}</TagPill>
                                            </div>
                                            <p className="workspace-heading mt-3 text-sm font-semibold">{evidence.title || 'Untitled note'}</p>
                                            <p className="mt-2 text-sm leading-7 text-ink-secondary">{evidence.excerpt}</p>
                                            <p className="mt-2 text-xs leading-6 text-ink-muted">{evidence.reason}</p>
                                            {openEntryHref && (
                                                <Link
                                                    href={openEntryHref(evidence.entryId)}
                                                    className="workspace-button-outline mt-3 inline-flex rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em]"
                                                >
                                                    Open note
                                                </Link>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </AppPanel>
    );
}
