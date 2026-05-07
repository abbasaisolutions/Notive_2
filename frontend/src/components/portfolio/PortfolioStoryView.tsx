'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
    FiArrowLeft,
    FiBookOpen,
    FiCheckCircle,
    FiChevronLeft,
    FiChevronRight,
    FiEdit2,
    FiEye,
    FiFileText,
    FiMessageSquare,
    FiSave,
    FiX,
} from 'react-icons/fi';
import { AppPanel, EmptyState, TagPill } from '@/components/ui/surface';
import { ErrorState, Spinner } from '@/components/ui';
import useApi from '@/hooks/use-api';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import { appendReturnTo } from '@/utils/navigation';

type EvidenceField = 'situation' | 'action' | 'lesson' | 'outcome' | 'skills';
type EvidenceCompleteness = {
    score: number;
    presentCount: number;
    totalCount: number;
    missingFields: EvidenceField[];
    readyForVerification: boolean;
    readyForExport: boolean;
};

type Experience = {
    id: string;
    entryId: string;
    createdAt: string;
    title: string;
    situation: string;
    action: string;
    lesson: string;
    outcome: string;
    skills: string[];
    confidence: number;
    verified: boolean;
    verificationNotes: string;
    completeness?: EvidenceCompleteness;
};

type InterviewStory = {
    id: string;
    entryId: string;
    title: string;
    situation: string;
    task: string;
    action: string;
    result: string;
};

type Overview = {
    experiences: Experience[];
    interviewStories: InterviewStory[];
};

type StoryDraft = {
    title: string;
    situation: string;
    action: string;
    outcome: string;
    lesson: string;
    skillsText: string;
    notes: string;
};

type StoryDraftField = keyof Pick<StoryDraft, 'title' | 'situation' | 'action' | 'outcome' | 'lesson'>;

const fieldLabels: Record<EvidenceField, string> = {
    situation: 'Situation',
    action: 'Action',
    lesson: 'Lesson',
    outcome: 'Result',
    skills: 'Skills',
};

const hasValue = (value: string | null | undefined) => typeof value === 'string' && value.trim().length > 0;

const formatShortDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatRatioPercent = (value: number) => `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;

const parseSkillsInput = (skillsText: string) =>
    skillsText.split(/[\n,]/g).map((value) => value.trim()).filter(Boolean).slice(0, 10);

const getCompleteness = (experience: Experience): EvidenceCompleteness => {
    if (experience.completeness) return experience.completeness;

    const missingFields: EvidenceField[] = [];
    if (!hasValue(experience.situation)) missingFields.push('situation');
    if (!hasValue(experience.action)) missingFields.push('action');
    if (!hasValue(experience.lesson)) missingFields.push('lesson');
    if (!hasValue(experience.outcome)) missingFields.push('outcome');
    if (experience.skills.length === 0) missingFields.push('skills');

    const totalCount = 5;
    const presentCount = totalCount - missingFields.length;

    return {
        score: Math.round((presentCount / totalCount) * 100),
        presentCount,
        totalCount,
        missingFields,
        readyForVerification: !missingFields.some((field) => field !== 'skills'),
        readyForExport: missingFields.length === 0,
    };
};

const missingCopy: Record<EvidenceField, string> = {
    situation: 'This setup is missing from the memory. Add what was happening before the story started.',
    action: 'This action is missing from the memory. Add what you actually did or decided.',
    outcome: 'This ending is missing from the memory. Add what changed, improved, or happened next.',
    lesson: 'This lesson is missing from the memory. Add what the moment proves or taught you.',
    skills: 'Skills are not tagged yet. Add one to three abilities this story can prove.',
};

const storyDraftFields: Array<{
    field: StoryDraftField;
    label: string;
    helper: string;
    placeholder: string;
    rows?: number;
}> = [
    {
        field: 'title',
        label: 'Title',
        helper: 'Use a short label that makes this story easy to find later.',
        placeholder: 'Name this story',
    },
    {
        field: 'situation',
        label: 'Situation',
        helper: 'Set the context before the action starts.',
        placeholder: 'What was happening?',
        rows: 4,
    },
    {
        field: 'action',
        label: 'Action',
        helper: 'Name what you did, decided, changed, or tried.',
        placeholder: 'What did you actually do?',
        rows: 4,
    },
    {
        field: 'outcome',
        label: 'Result',
        helper: 'Capture what changed, improved, happened next, or became clearer.',
        placeholder: 'What happened because of it?',
        rows: 4,
    },
    {
        field: 'lesson',
        label: 'Lesson',
        helper: 'Write what this moment proves, teaches, or reveals.',
        placeholder: 'What does this story show?',
        rows: 4,
    },
];

export default function PortfolioStoryView() {
    const params = useSearchParams();
    const { isLoading: authLoading, isAuthenticated } = useAuthRedirect();
    const { apiFetch } = useApi();
    const [overview, setOverview] = useState<Overview | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [mobileStep, setMobileStep] = useState(0);
    const [draft, setDraft] = useState<StoryDraft | null>(null);
    const [saveMessage, setSaveMessage] = useState('');
    const [error, setError] = useState('');

    const entryId = params.get('id') || '';
    const returnTo = params.get('returnTo') || '/portfolio?view=evidence';
    const story = useMemo(() => overview?.experiences.find((item) => item.entryId === entryId) || null, [entryId, overview]);
    const interviewStory = useMemo(
        () => overview?.interviewStories.find((item) => item.entryId === entryId) || null,
        [entryId, overview]
    );
    const completeness = story ? getCompleteness(story) : null;
    const storyBlocks = story
        ? [
            { label: 'Situation', value: story.situation, missing: missingCopy.situation },
            { label: 'Action', value: story.action, missing: missingCopy.action },
            { label: 'Result', value: story.outcome, missing: missingCopy.outcome },
            { label: 'Lesson', value: story.lesson, missing: missingCopy.lesson },
        ]
        : [];

    useEffect(() => {
        if (!story) return;
        setDraft({
            title: story.title,
            situation: story.situation,
            action: story.action,
            outcome: story.outcome,
            lesson: story.lesson,
            skillsText: story.skills.join(', '),
            notes: story.verificationNotes || '',
        });
        setMobileStep(0);
    }, [story]);

    useEffect(() => {
        if (!isAuthenticated) return;

        let mounted = true;
        setIsLoading(true);
        setError('');

        apiFetch('/ai/opportunity/overview')
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Could not load this story.');
                if (mounted) setOverview(data.overview as Overview);
            })
            .catch((err: unknown) => {
                if (mounted) setError(err instanceof Error ? err.message : 'Could not load this story.');
            })
            .finally(() => {
                if (mounted) setIsLoading(false);
            });

        return () => {
            mounted = false;
        };
    }, [apiFetch, isAuthenticated]);

    const updateDraft = (field: keyof StoryDraft, value: string) => {
        setDraft((current) => current ? { ...current, [field]: value } : current);
        setSaveMessage('');
    };

    const saveDraft = async () => {
        if (!story || !draft) return;

        setIsSaving(true);
        setError('');

        try {
            const response = await apiFetch(`/ai/opportunity/entry/${story.entryId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: draft.title,
                    situation: draft.situation,
                    action: draft.action,
                    outcome: draft.outcome,
                    lesson: draft.lesson,
                    notes: draft.notes,
                    skills: parseSkillsInput(draft.skillsText),
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Could not save this story.');

            setOverview((current) => current ? ({
                ...current,
                experiences: current.experiences.map((item) =>
                    item.entryId === story.entryId
                        ? {
                            ...item,
                            title: draft.title,
                            situation: draft.situation,
                            action: draft.action,
                            outcome: draft.outcome,
                            lesson: draft.lesson,
                            skills: parseSkillsInput(draft.skillsText),
                            verificationNotes: draft.notes,
                        }
                        : item
                ),
                interviewStories: current.interviewStories.map((item) =>
                    item.entryId === story.entryId
                        ? {
                            ...item,
                            title: draft.title,
                            situation: draft.situation,
                            action: draft.action,
                            result: draft.outcome,
                        }
                        : item
                ),
            }) : current);
            setIsEditing(false);
            setSaveMessage('Story saved. Choose what you want to do with it next.');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Could not save this story.');
        } finally {
            setIsSaving(false);
        }
    };

    if (authLoading || isLoading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <Spinner size="lg" />
            </div>
        );
    }

    if (!isAuthenticated) return null;

    if (error) {
        return <ErrorState title="Story did not load" message={error} variant="full-page" />;
    }

    if (!story || !completeness) {
        return (
            <div className="px-3 py-6">
                <EmptyState
                    title="Story not found"
                    description="This story may have moved, or the memory no longer has reusable story material."
                    actionLabel="Back to stories"
                    actionHref={returnTo}
                />
            </div>
        );
    }

    const sourceHref = appendReturnTo(`/entry/view?id=${story.entryId}`, `/portfolio/story?id=${story.entryId}`);
    const resumeHref = '/portfolio?view=export&pack=resume';
    const statementHref = '/portfolio?view=export&pack=statement';
    const interviewHref = `/portfolio?view=interview&story=${story.entryId}`;
    const currentMobileField = storyDraftFields[mobileStep] || storyDraftFields[0];
    const canGoBack = mobileStep > 0;
    const canGoNext = mobileStep < storyDraftFields.length - 1;
    const renderDraftField = ({ field, label, helper, placeholder, rows }: typeof storyDraftFields[number]) => (
        <label key={field} className="block">
            <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">{label}</span>
            <span className="mt-2 block text-sm leading-6 text-ink-secondary">{helper}</span>
            {rows ? (
                <textarea
                    value={draft?.[field] || ''}
                    rows={rows}
                    onChange={(event) => updateDraft(field, event.target.value)}
                    placeholder={placeholder}
                    className="workspace-input mt-3 min-h-[8rem] w-full rounded-2xl px-4 py-3 text-base leading-7 outline-none transition-colors focus:border-primary/35 sm:text-sm"
                />
            ) : (
                <input
                    value={draft?.[field] || ''}
                    onChange={(event) => updateDraft(field, event.target.value)}
                    placeholder={placeholder}
                    className="workspace-input mt-3 w-full rounded-2xl px-4 py-3 text-base outline-none transition-colors focus:border-primary/35 sm:text-sm"
                />
            )}
        </label>
    );

    return (
        <main className="mx-auto max-w-4xl space-y-4 px-3 pb-28 pt-4 sm:px-5">
            <Link href={returnTo} className="workspace-button-ghost inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary">
                <FiArrowLeft size={14} aria-hidden="true" />
                Back to Stories
            </Link>

            <AppPanel className="space-y-5 p-5 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">{formatShortDate(story.createdAt)}</p>
                        <h1 className="workspace-heading mt-2 text-3xl font-semibold leading-tight text-strong">
                            {isEditing ? 'Tune this story' : story.title || 'Untitled story'}
                        </h1>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <TagPill tone={story.verified ? 'primary' : completeness.readyForExport ? 'default' : 'muted'}>
                            {story.verified ? 'Saved as reusable' : completeness.readyForExport ? 'Ready to use' : 'Needs shaping'}
                        </TagPill>
                        <button
                            type="button"
                            onClick={() => setIsEditing((value) => !value)}
                            className="workspace-button-outline inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em]"
                        >
                            {isEditing ? <FiX size={14} aria-hidden="true" /> : <FiEdit2 size={14} aria-hidden="true" />}
                            {isEditing ? 'Close edit' : 'Edit here'}
                        </button>
                    </div>
                </div>

                {saveMessage && (
                    <div className="rounded-2xl border border-primary/25 bg-primary/12 p-4" role="status">
                        <p className="text-sm font-semibold text-strong">{saveMessage}</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                            <Link href={interviewHref} className="workspace-button-outline inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em]">
                                <FiMessageSquare size={14} aria-hidden="true" />
                                Practice it
                            </Link>
                            <Link href={resumeHref} className="workspace-button-outline inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em]">
                                <FiFileText size={14} aria-hidden="true" />
                                Resume
                            </Link>
                            <Link href={statementHref} className="workspace-button-outline inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em]">
                                <FiBookOpen size={14} aria-hidden="true" />
                                Statement
                            </Link>
                        </div>
                    </div>
                )}

                {isEditing ? (
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-primary/25 bg-primary/12 p-4">
                            <p className="text-xs uppercase tracking-[0.12em] text-primary/80">Mobile composer</p>
                            <p className="workspace-heading mt-2 text-lg font-semibold">Tune one story block at a time</p>
                            <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                On phone, move through the story in order. On wider screens, the full draft stays open.
                            </p>
                        </div>

                        <div className="block sm:hidden">
                            <div className="rounded-2xl border border-[rgba(141,123,105,0.14)] p-4">
                                <div className="mb-4 flex items-center justify-between gap-3">
                                    <TagPill>{mobileStep + 1}/{storyDraftFields.length}</TagPill>
                                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">{currentMobileField.label}</p>
                                </div>
                                {renderDraftField(currentMobileField)}
                                <div className="mt-4 grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => canGoBack && setMobileStep((step) => step - 1)}
                                        disabled={!canGoBack}
                                        className="workspace-button-outline inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] disabled:opacity-40"
                                    >
                                        <FiChevronLeft size={14} aria-hidden="true" />
                                        Back
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => canGoNext && setMobileStep((step) => step + 1)}
                                        disabled={!canGoNext}
                                        className="workspace-button-outline inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] disabled:opacity-40"
                                    >
                                        Next
                                        <FiChevronRight size={14} aria-hidden="true" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="hidden space-y-4 sm:block">
                            {storyDraftFields.map(renderDraftField)}
                        </div>

                        <details className="group rounded-2xl border border-[rgba(141,123,105,0.16)] bg-[rgba(255,255,255,0.04)]">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                                <span>
                                    <span className="block text-xs uppercase tracking-[0.12em] text-ink-muted">Optional polish</span>
                                    <span className="workspace-heading mt-1 block text-sm font-semibold">Skills and proof notes</span>
                                </span>
                                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted group-open:hidden">Open</span>
                                <span className="hidden text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted group-open:inline">Hide</span>
                            </summary>
                            <div className="grid gap-4 border-t border-[rgba(141,123,105,0.14)] p-4 sm:grid-cols-2">
                                <label className="block">
                                    <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Skills</span>
                                    <span className="mt-2 block text-sm leading-6 text-ink-secondary">Comma-separated skills this story can prove.</span>
                                    <input
                                        value={draft?.skillsText || ''}
                                        onChange={(event) => updateDraft('skillsText', event.target.value)}
                                        placeholder="communication, initiative, analysis"
                                        className="workspace-input mt-3 w-full rounded-2xl px-4 py-3 text-base outline-none transition-colors focus:border-primary/35 sm:text-sm"
                                    />
                                </label>
                                <label className="block">
                                    <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Proof notes</span>
                                    <span className="mt-2 block text-sm leading-6 text-ink-secondary">Add metrics, facts, or context you want before reuse.</span>
                                    <textarea
                                        value={draft?.notes || ''}
                                        rows={4}
                                        onChange={(event) => updateDraft('notes', event.target.value)}
                                        placeholder="What proof should this story keep?"
                                        className="workspace-input mt-3 min-h-[8rem] w-full rounded-2xl px-4 py-3 text-base leading-7 outline-none transition-colors focus:border-primary/35 sm:text-sm"
                                    />
                                </label>
                            </div>
                        </details>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {storyBlocks.map((block) => (
                            <section key={block.label} className="rounded-2xl border border-[rgba(141,123,105,0.14)] bg-[rgba(255,255,255,0.035)] p-4">
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">{block.label}</p>
                                <p className={`mt-3 text-base leading-8 ${hasValue(block.value) ? 'text-strong' : 'text-ink-secondary'}`}>
                                    {hasValue(block.value) ? block.value : block.missing}
                                </p>
                            </section>
                        ))}
                    </div>
                )}

                <div className="grid gap-2 sm:grid-cols-2">
                    {isEditing ? (
                        <button
                            type="button"
                            onClick={() => {
                                void saveDraft();
                            }}
                            disabled={isSaving}
                            className="workspace-button-primary hidden items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60 sm:inline-flex"
                        >
                            <FiSave size={15} aria-hidden="true" />
                            {isSaving ? 'Saving Story...' : 'Save Story'}
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setIsEditing(true)}
                            className="workspace-button-primary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
                        >
                            <FiEdit2 size={15} aria-hidden="true" />
                            Tune Story
                        </button>
                    )}
                    <Link href={sourceHref} className="workspace-button-outline inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold">
                        <FiEye size={15} aria-hidden="true" />
                        Open Memory
                    </Link>
                </div>
            </AppPanel>

            <details className="group rounded-2xl border border-[rgba(141,123,105,0.16)] bg-[rgba(255,255,255,0.04)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                    <span>
                        <span className="block text-xs uppercase tracking-[0.12em] text-ink-muted">Optional context</span>
                        <span className="workspace-heading mt-1 block text-sm font-semibold">Proof, skills, and reuse paths</span>
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted group-open:hidden">Open</span>
                    <span className="hidden text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted group-open:inline">Hide</span>
                </summary>
                <div className="space-y-4 border-t border-[rgba(141,123,105,0.14)] p-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                        <div className="workspace-panel rounded-2xl p-4">
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Readiness</p>
                            <p className="workspace-heading mt-2 text-lg font-semibold">{completeness.score}%</p>
                            <p className="mt-2 text-sm text-ink-secondary">{completeness.presentCount}/{completeness.totalCount} blocks filled</p>
                        </div>
                        <div className="workspace-panel rounded-2xl p-4">
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Source strength</p>
                            <p className="workspace-heading mt-2 text-lg font-semibold">{formatRatioPercent(story.confidence || 0)}</p>
                            <p className="mt-2 text-sm text-ink-secondary">{story.verified ? 'Saved proof' : 'Review before final use'}</p>
                        </div>
                        <div className="workspace-panel rounded-2xl p-4">
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Use next</p>
                            <p className="workspace-heading mt-2 text-lg font-semibold">{interviewStory ? 'Interview' : 'Story pack'}</p>
                            <p className="mt-2 text-sm text-ink-secondary">Reuse this in a draft, answer, or reflection.</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {story.skills.length > 0 ? story.skills.map((skill) => <TagPill key={skill}>{skill}</TagPill>) : <TagPill tone="muted">{missingCopy.skills}</TagPill>}
                        {completeness.missingFields.map((field) => <TagPill key={field} tone="muted">Add {fieldLabels[field]}</TagPill>)}
                    </div>

                    {interviewStory && (
                        <div className="workspace-panel rounded-2xl p-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <FiMessageSquare size={15} aria-hidden="true" className="text-primary" />
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Interview scaffold</p>
                            </div>
                            <p className="mt-3 text-sm leading-7 text-ink-secondary">{interviewStory.task || 'Use this story as an answer anchor.'}</p>
                        </div>
                    )}

                    <div className="grid gap-2 sm:grid-cols-3">
                        <Link href={resumeHref} className="workspace-button-outline inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em]">
                            <FiFileText size={14} aria-hidden="true" />
                            Resume
                        </Link>
                        <Link href={statementHref} className="workspace-button-outline inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em]">
                            <FiBookOpen size={14} aria-hidden="true" />
                            Statement
                        </Link>
                        <Link href={interviewHref} className="workspace-button-outline inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em]">
                            <FiCheckCircle size={14} aria-hidden="true" />
                            Interview
                        </Link>
                    </div>
                </div>
            </details>

            {isEditing && (
                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[rgba(var(--paper-border),0.92)] bg-[rgb(var(--paper-bg))]/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-2xl backdrop-blur sm:hidden">
                    <button
                        type="button"
                        onClick={() => {
                            void saveDraft();
                        }}
                        disabled={isSaving}
                        className="workspace-button-primary inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
                    >
                        <FiSave size={15} aria-hidden="true" />
                        {isSaving ? 'Saving Story...' : 'Save Story'}
                    </button>
                </div>
            )}
        </main>
    );
}
