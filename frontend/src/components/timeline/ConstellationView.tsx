'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ActionBar, AppPanel, SectionHeader, TagPill } from '@/components/ui/surface';
import { appendReturnTo } from '@/utils/navigation';
import { type ConstellationModel } from '@/utils/timeline-signature';
import { FiArrowRight, FiCompass, FiLayers, FiZap } from 'react-icons/fi';

type ConstellationViewProps = {
    model: ConstellationModel;
    totalEntries: number;
    currentReturnTo: string;
};

const nodeClasses: Record<string, string> = {
    center: 'border-primary/35 bg-primary/18 text-white shadow-[0_0_50px_rgba(120,150,210,0.25)]',
    theme: 'border-white/15 bg-white/[0.05] text-white',
    skill: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100',
    lesson: 'border-amber-400/25 bg-amber-500/10 text-amber-100',
    mood: 'border-sky-400/25 bg-sky-500/10 text-sky-100',
};

const kindLabels: Record<string, string> = {
    center: 'Center',
    theme: 'Theme',
    skill: 'Skill',
    lesson: 'Lesson',
    mood: 'Mood',
};

export default function ConstellationView({ model, totalEntries, currentReturnTo }: ConstellationViewProps) {
    const [selectedNodeId, setSelectedNodeId] = useState<string>(model.nodes[1]?.id || model.nodes[0]?.id || 'center');

    useEffect(() => {
        setSelectedNodeId(model.nodes[1]?.id || model.nodes[0]?.id || 'center');
    }, [model]);

    const selectedNode = model.nodes.find((node) => node.id === selectedNodeId) || model.nodes[0];
    const relatedEntries = useMemo(() => selectedNode?.previewEntries || [], [selectedNode]);

    return (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_340px]">
            <AppPanel className="overflow-hidden">
                <div className="flex flex-col gap-5">
                    <SectionHeader
                        kicker="Constellation"
                        title="Meaning View"
                        description="Time is one way to read your life. This view lets you browse the ideas, moods, and skills your recent entries orbit around."
                    />
                    <ActionBar className="overflow-x-auto border-white/10 bg-black/20">
                        <TagPill tone="primary">{totalEntries} matching entries</TagPill>
                        <TagPill>{model.nodes.length - 1} active signals</TagPill>
                        <span className="text-xs text-ink-secondary">{model.headline}</span>
                    </ActionBar>
                </div>

                <div className="relative mt-5 overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_center,rgba(110,132,175,0.16),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] min-h-[440px]">
                    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                        {model.links.map((link) => {
                            const source = model.nodes.find((node) => node.id === link.sourceId);
                            const target = model.nodes.find((node) => node.id === link.targetId);
                            if (!source || !target) return null;

                            return (
                                <line
                                    key={`${link.sourceId}-${link.targetId}`}
                                    x1={source.x}
                                    y1={source.y}
                                    x2={target.x}
                                    y2={target.y}
                                    stroke="rgba(255,255,255,0.16)"
                                    strokeWidth="0.18"
                                />
                            );
                        })}
                    </svg>

                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_30%)]" />

                    {model.nodes.map((node, index) => {
                        const isSelected = node.id === selectedNode?.id;
                        const isCenter = node.kind === 'center';
                        const size = node.size;

                        return (
                            <motion.button
                                key={node.id}
                                type="button"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: isSelected ? 1.06 : 1 }}
                                transition={{ duration: 0.28, delay: Math.min(index * 0.03, 0.24) }}
                                onClick={() => setSelectedNodeId(node.id)}
                                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border backdrop-blur-md transition-all ${nodeClasses[node.kind]} ${isSelected ? 'ring-2 ring-white/20' : ''}`}
                                style={{
                                    left: `${node.x}%`,
                                    top: `${node.y}%`,
                                    width: `${size}px`,
                                    height: `${size}px`,
                                }}
                                aria-pressed={isSelected}
                                aria-label={`${node.label}, ${kindLabels[node.kind]}, ${node.count} linked entries`}
                            >
                                <span className={`mx-auto flex h-full w-full items-center justify-center px-2 text-center ${isCenter ? 'text-sm font-semibold' : 'text-[11px] font-semibold uppercase tracking-[0.08em]'}`}>
                                    {node.label}
                                </span>
                            </motion.button>
                        );
                    })}

                    <div className="pointer-events-none absolute left-6 top-6 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-ink-secondary">
                        <FiCompass size={14} aria-hidden="true" />
                        Explore your current meaning graph
                    </div>
                </div>
            </AppPanel>

            <AppPanel className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Focused Signal</p>
                        <h2 className="mt-1 text-xl font-semibold text-white">{selectedNode?.label || 'Meaning node'}</h2>
                    </div>
                    <TagPill tone={selectedNode?.kind === 'center' ? 'primary' : 'default'}>
                        {kindLabels[selectedNode?.kind || 'theme']}
                    </TagPill>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm leading-7 text-ink-secondary">
                        {selectedNode?.kind === 'center'
                            ? 'This is the center of the current constellation. Every surrounding signal is being pulled from the full filtered timeline summary, not just the entries currently on screen.'
                            : `${selectedNode?.count || 0} matching entries connect to this signal. Open one to read it in context or return to the timeline to follow the chronological arc.`}
                    </p>
                </div>

                <div>
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Linked entries</p>
                        <TagPill>{relatedEntries.length} shown</TagPill>
                    </div>
                    <div className="space-y-3">
                        {relatedEntries.length > 0 ? relatedEntries.map((entry) => (
                            <Link
                                key={entry.id}
                                href={appendReturnTo(`/entry/view?id=${entry.id}`, currentReturnTo)}
                                className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/15 hover:bg-white/[0.05]"
                            >
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                                    {new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                                <h3 className="mt-2 text-sm font-semibold text-white">
                                    {entry.title || 'Untitled entry'}
                                </h3>
                                <p className="mt-2 line-clamp-3 text-sm leading-6 text-ink-secondary">
                                    {entry.contentSnippet}
                                </p>
                            </Link>
                        )) : (
                            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-ink-secondary">
                                Matching entries will appear here once this signal has enough source material.
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-ink-muted">
                        <FiZap size={13} aria-hidden="true" />
                        Suggested move
                    </div>
                    <p className="mt-3 text-sm leading-7 text-ink-secondary">
                        If one signal keeps pulling multiple entries together, promote one of those moments into stronger evidence so the portfolio layer reflects the same pattern.
                    </p>
                    <Link
                        href={appendReturnTo('/portfolio?view=evidence', currentReturnTo)}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-primary transition-colors hover:bg-primary/20"
                    >
                        Open Evidence Queue
                        <FiArrowRight size={14} aria-hidden="true" />
                    </Link>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-ink-muted">
                        <FiLayers size={13} aria-hidden="true" />
                        Read this view
                    </div>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-ink-secondary">
                        <li>Large nodes appear more often in the current filtered slice.</li>
                        <li>The center is your current journal state.</li>
                        <li>Use timeline when you want order, constellation when you want meaning.</li>
                    </ul>
                </div>
            </AppPanel>
        </div>
    );
}
