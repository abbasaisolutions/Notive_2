'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import useApi from '@/hooks/use-api';
import { API_URL } from '@/constants/config';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import useContextNavigation from '@/hooks/use-context-navigation';
import { NOTIVE_VOICE } from '@/content/notive-voice';
import { ActionBar, AppPanel, SectionHeader, StatTile, TagPill } from '@/components/ui/surface';
import { appendReturnTo, buildCurrentReturnTo } from '@/utils/navigation';
import { writeWorkspaceResume } from '@/utils/workspace-resume';
import { FiArrowLeft, FiArrowRight, FiBook, FiEdit3, FiPlus } from 'react-icons/fi';
import { Spinner } from '@/components/ui';
import { CHAPTER_ICON_OPTIONS, CHAPTER_ICON_MAP, ChapterIconKey, getChapterIconComponent, normalizeChapterIcon } from '@/constants/chapter-icons';
import { pickRotatingCopy } from '@/utils/rotating-copy';

const EMPTY_CHAPTERS_VARIANTS = [
    {
        title: 'No groups yet',
        description: 'Create groups to keep related notes, projects, or recurring life themes together.',
    },
    {
        title: 'Ready to group your notes?',
        description: 'A group is just a shelf — pull together everything about one season, one person, or one project.',
    },
    {
        title: 'Start your first collection',
        description: 'Groups help you find, compare, and revisit notes that belong to the same story.',
    },
] as const;

interface Chapter {
    id: string;
    name: string;
    description: string | null;
    color: string;
    icon: string;
    _count: { entries: number };
    createdAt: string;
}

const COLORS = ['#64748b', '#4b5563', '#6b7280', '#78716c', '#71717a', '#52525b', '#334155', '#0f172a'];

export default function ChaptersPage() {
    const { user, isLoading: authLoading, isAuthenticated } = useAuthRedirect();
    const { apiFetch } = useApi();
    const { backLabel, navigateBack } = useContextNavigation('/dashboard', 'dashboard');
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
    const [formData, setFormData] = useState<{ name: string; description: string; color: string; icon: ChapterIconKey }>({
        name: '',
        description: '',
        color: '#64748b',
        icon: 'book-open',
    });

    const currentReturnTo = buildCurrentReturnTo('/chapters', '');
    const captureHref = appendReturnTo('/entry/new?mode=quick', currentReturnTo);

    const resetForm = () => {
        setEditingChapter(null);
        setFormData({ name: '', description: '', color: '#64748b', icon: 'book-open' });
    };

    const fetchChapters = useCallback(async (signal?: AbortSignal) => {
        try {
            const response = await apiFetch(`${API_URL}/chapters`, { signal });
            if (response.ok) {
                const data = await response.json();
                setChapters(data.chapters);
            }
        } catch (error) {
            if (signal?.aborted) return;
            console.error('Failed to fetch chapters:', error);
        } finally {
            setIsLoading(false);
        }
    }, [apiFetch]);

    useEffect(() => {
        const controller = new AbortController();
        fetchChapters(controller.signal);
        return () => controller.abort();
    }, [fetchChapters]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!formData.name.trim()) return;

        try {
            const url = editingChapter ? `${API_URL}/chapters/${editingChapter.id}` : `${API_URL}/chapters`;
            const method = editingChapter ? 'PUT' : 'POST';

            const response = await apiFetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                await fetchChapters();
                setShowModal(false);
                resetForm();
            }
        } catch (error) {
            console.error('Failed to save chapter:', error);
        }
    };

    const openEditModal = (chapter: Chapter) => {
        setEditingChapter(chapter);
        setFormData({
            name: chapter.name,
            description: chapter.description || '',
            color: chapter.color,
            icon: normalizeChapterIcon(chapter.icon),
        });
        setShowModal(true);
    };

    const openCreateModal = () => {
        resetForm();
        setShowModal(true);
    };

    const totalEntries = useMemo(
        () => chapters.reduce((sum, chapter) => sum + chapter._count.entries, 0),
        [chapters]
    );
    const emptyCollections = useMemo(
        () => chapters.filter((chapter) => chapter._count.entries === 0).length,
        [chapters]
    );

    useEffect(() => {
        if (authLoading || !isAuthenticated) return;

        writeWorkspaceResume({
            key: 'chapters',
            title: NOTIVE_VOICE.surfaces.storyCollections,
            summary: chapters.length > 0
                ? `${chapters.length} groups · ${totalEntries} notes`
                : 'Group your notes in simple collections',
            href: currentReturnTo,
            updatedAt: new Date().toISOString(),
            stage: 'organize',
            actionLabel: `Resume ${NOTIVE_VOICE.surfaces.storyCollections.toLowerCase()}`,
        });
    }, [authLoading, chapters.length, currentReturnTo, isAuthenticated, totalEntries]);

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Spinner size="md" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="min-h-screen px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto max-w-6xl space-y-6">
                <AppPanel className="space-y-5">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                        <div className="flex items-start gap-3">
                            <button
                                type="button"
                                onClick={navigateBack}
                                aria-label={backLabel}
                                title={backLabel}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl workspace-button-outline text-ink-secondary transition-colors hover:text-[rgb(var(--text-primary))]"
                            >
                                <FiArrowLeft size={20} aria-hidden="true" />
                            </button>
                            <SectionHeader
                                kicker={NOTIVE_VOICE.surfaces.storyCollections}
                                title="Group related notes"
                                description="Put notes together by project, season, or part of life so they are easier to find and use later."
                                as="h1"
                            />
                        </div>

                        <ActionBar scroll>
                            <Link
                                href={captureHref}
                                className="rounded-xl px-4 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:text-[rgb(var(--text-primary))]"
                            >
                                Quick Capture
                            </Link>
                            <button
                                type="button"
                                onClick={openCreateModal}
                                className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/15 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
                            >
                                <FiPlus size={16} aria-hidden="true" />
                                New Group
                            </button>
                        </ActionBar>
                    </div>

                    <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
                        <StatTile label="Groups" value={chapters.length} hint="Groups you have created" />
                        <StatTile label="Notes Inside" value={totalEntries} hint="Notes placed into groups" tone="primary" />
                        <StatTile label="Empty Groups" value={emptyCollections} hint="Groups ready for new notes" />
                    </div>
                </AppPanel>

                {isLoading ? (
                    <AppPanel className="flex justify-center py-16">
                        <Spinner size="md" />
                    </AppPanel>
                ) : chapters.length === 0 ? (
                    (() => {
                        const emptyCopy = pickRotatingCopy('empty-chapters', EMPTY_CHAPTERS_VARIANTS);
                        return (
                            <AppPanel className="space-y-6 text-center">
                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                                    <FiBook size={30} aria-hidden="true" />
                                </div>
                                <SectionHeader
                                    kicker={NOTIVE_VOICE.surfaces.storyCollections}
                                    title={emptyCopy.title}
                                    description={emptyCopy.description}
                                    className="justify-center text-center"
                                />
                                <div className="flex flex-wrap justify-center gap-3">
                                    <button
                                        type="button"
                                        onClick={openCreateModal}
                                        className="rounded-xl border border-primary/30 bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
                                    >
                                        Create Your First Group
                                    </button>
                                    <Link
                                        href={captureHref}
                                        className="workspace-button-outline rounded-xl px-5 py-3 text-sm font-semibold text-ink-secondary transition-colors hover:text-[rgb(var(--text-primary))]"
                                    >
                                        Quick Capture
                                    </Link>
                                </div>
                            </AppPanel>
                        );
                    })()
                ) : (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {chapters.map((chapter) => {
                            const ChapterIcon = getChapterIconComponent(chapter.icon);
                            const openHref = appendReturnTo(`/chapters/view?id=${chapter.id}`, currentReturnTo);

                            return (
                                <article
                                    key={chapter.id}
                                    className="overflow-hidden rounded-[28px] workspace-soft-panel transition-colors hover:border-white/20"
                                >
                                    <div className="relative h-32 overflow-hidden bg-surface-1">
                                        <div className="absolute inset-0 opacity-20" style={{ backgroundColor: chapter.color }} />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <ChapterIcon className="text-[rgb(var(--text-primary))] transition-transform duration-500 group-hover:scale-110" size={60} aria-hidden="true" />
                                        </div>
                                        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: chapter.color }} />
                                    </div>
                                    <div className="space-y-4 p-5">
                                        <div className="flex flex-wrap gap-2">
                                            <TagPill tone="primary">{chapter._count.entries} entries</TagPill>
                                            <TagPill>Started {new Date(chapter.createdAt).getFullYear()}</TagPill>
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-semibold workspace-heading">{chapter.name}</h3>
                                            <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                                {chapter.description || 'A simple group for related notes, scenes, and turning points.'}
                                            </p>
                                        </div>
                                        <div className="flex flex-col gap-2 sm:flex-row">
                                            <button
                                                type="button"
                                                onClick={() => openEditModal(chapter)}
                                                className="inline-flex items-center justify-center gap-2 rounded-xl workspace-button-outline px-4 py-2.5 text-sm font-semibold text-ink-secondary transition-colors hover:text-[rgb(var(--text-primary))]"
                                            >
                                                <FiEdit3 size={15} aria-hidden="true" />
                                                Edit
                                            </button>
                                            <Link
                                                href={openHref}
                                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/12 px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
                                            >
                                                Open Group
                                                <FiArrowRight size={15} aria-hidden="true" />
                                            </Link>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>

            {showModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                    onClick={() => { setShowModal(false); setEditingChapter(null); }}
                    onKeyDown={(e) => { if (e.key === 'Escape') { setShowModal(false); setEditingChapter(null); } }}
                >
                    <AppPanel
                        className="w-full max-w-xl space-y-5"
                        role="dialog"
                        aria-modal="true"
                        aria-label={editingChapter ? 'Edit group' : 'New group'}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                        <SectionHeader
                            kicker={NOTIVE_VOICE.surfaces.storyCollections}
                            title={editingChapter ? 'Edit group' : 'New group'}
                            description="Name the group, add a short note, then choose the icon and color that make it easy to spot."
                        />
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-ink-muted">Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                                    placeholder="My group"
                                    className="w-full workspace-input rounded-xl px-4 py-3 text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-ink-muted">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                                    placeholder="What belongs in this group?"
                                    rows={3}
                                    className="w-full workspace-input resize-none rounded-xl px-4 py-3 text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-ink-muted">Icon</label>
                                <div className="flex flex-wrap gap-2">
                                    {CHAPTER_ICON_OPTIONS.map(({ key, label }) => {
                                        const Icon = CHAPTER_ICON_MAP[key];
                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, icon: key })}
                                                title={label}
                                                aria-label={`Select ${label} icon`}
                                                className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
                                                    formData.icon === key
                                                        ? 'bg-primary text-white'
                                                        : 'workspace-pill text-ink-secondary hover:text-[rgb(var(--text-primary))]'
                                                }`}
                                            >
                                                <Icon size={18} aria-hidden="true" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-ink-muted">Color</label>
                                <div className="flex flex-wrap gap-2">
                                    {COLORS.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, color })}
                                            aria-label={`Select color ${color}`}
                                            className={`h-8 w-8 rounded-full transition-all ${formData.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-1' : ''}`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        resetForm();
                                    }}
                                    className="flex-1 workspace-button-outline rounded-xl px-4 py-3 text-sm font-semibold text-ink-secondary transition-colors hover:text-[rgb(var(--text-primary))]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 rounded-xl border border-primary/30 bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
                                >
                                    {editingChapter ? 'Save Changes' : 'Create Group'}
                                </button>
                            </div>
                        </form>
                    </AppPanel>
                </div>
            )}
        </div>
    );
}
