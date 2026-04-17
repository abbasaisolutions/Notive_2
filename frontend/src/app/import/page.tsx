'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SocialImportPanel from '@/components/import/SocialImportPanel';
import { NOTIVE_VOICE } from '@/content/notive-voice';
import { ActionBar, AppPanel, SectionHeader, TagPill } from '@/components/ui/surface';
import { ErrorState, Spinner } from '@/components/ui';
import { API_URL } from '@/constants/config';
import useApi from '@/hooks/use-api';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import useTelemetry from '@/hooks/use-telemetry';
import { appendReturnTo, buildCurrentReturnTo } from '@/utils/navigation';
import { storyStatusClassName, storyStatusLabel, type StoryEngineStatus } from '@/utils/story-engine';
import { writeWorkspaceResume } from '@/utils/workspace-resume';
import { FiArrowRight, FiCheckCircle, FiChevronDown, FiGrid, FiLayers } from 'react-icons/fi';

type ImportStatus = {
    instagram: number;
    facebook: number;
    notive: number;
    total: number;
};

type ConnectionSummary = {
    connected: boolean;
    isExpired?: boolean;
};

type OverviewExperience = {
    verified: boolean;
    completeness?: {
        readyForVerification: boolean;
        readyForExport: boolean;
    };
};

type OverviewPayload = {
    stats: {
        entryCount: number;
        experienceCount: number;
        verifiedCount: number;
    };
    experiences: OverviewExperience[];
    topSkills: string[];
    topLessons: string[];
};

const getExperienceStatus = (experience: OverviewExperience): StoryEngineStatus => {
    if (experience.verified) return 'verified';
    if (experience.completeness?.readyForExport) return 'ready_to_export';
    if (experience.completeness?.readyForVerification) return 'ready_to_verify';
    return 'needs_attention';
};

export default function ImportPage() {
    const pathname = usePathname();
    const { isLoading: authLoading, isAuthenticated } = useAuthRedirect();
    const { apiFetch } = useApi();
    const { trackEvent } = useTelemetry();
    const [status, setStatus] = useState<ImportStatus | null>(null);
    const [connections, setConnections] = useState<Record<'instagram' | 'facebook', ConnectionSummary>>({
        instagram: { connected: false },
        facebook: { connected: false },
    });
    const [overview, setOverview] = useState<OverviewPayload | null>(null);
    const [showImportDetails, setShowImportDetails] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const currentReturnTo = useMemo(() => buildCurrentReturnTo(pathname, ''), [pathname]);

    useEffect(() => {
        if (!isAuthenticated) return;

        let mounted = true;

        const load = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const [statusResponse, overviewResponse] = await Promise.all([
                    apiFetch('/import/status'),
                    apiFetch(`${API_URL}/ai/opportunity/overview`),
                ]);

                const statusData = await statusResponse.json().catch(() => null);
                const overviewData = await overviewResponse.json().catch(() => null);

                if (!statusResponse.ok) {
                    throw new Error(statusData?.message || 'Couldn\u2019t load your import status.');
                }

                if (!overviewResponse.ok) {
                    throw new Error(overviewData?.message || 'Couldn\u2019t load the story overview.');
                }

                if (!mounted) return;

                setStatus(statusData?.entryCount || null);
                setConnections({
                    instagram: {
                        connected: Boolean(statusData?.connections?.instagram?.connected),
                        isExpired: Boolean(statusData?.connections?.instagram?.isExpired),
                    },
                    facebook: {
                        connected: Boolean(statusData?.connections?.facebook?.connected),
                        isExpired: Boolean(statusData?.connections?.facebook?.isExpired),
                    },
                });
                setOverview((overviewData?.overview || null) as OverviewPayload | null);
            } catch (err: unknown) {
                if (!mounted) return;
                setError(err instanceof Error ? err.message : 'Couldn\u2019t load your imports. Try refreshing.');
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        void load();

        return () => {
            mounted = false;
        };
    }, [apiFetch, isAuthenticated]);

    const queueCounts = useMemo<Record<StoryEngineStatus, number>>(() => {
        const base = {
            needs_attention: 0,
            ready_to_verify: 0,
            ready_to_export: 0,
            verified: 0,
        } satisfies Record<StoryEngineStatus, number>;

        if (!overview) return base;

        overview.experiences.forEach((experience) => {
            base[getExperienceStatus(experience)] += 1;
        });

        return base;
    }, [overview]);

    const connectedCount = useMemo(() => {
        return ['instagram', 'facebook'].filter((provider) => {
            const connection = connections[provider as 'instagram' | 'facebook'];
            return connection?.connected && !connection?.isExpired;
        }).length;
    }, [connections]);

    const nextAction = useMemo(() => {
        if (queueCounts.needs_attention > 0) {
            return {
                label: 'Strengthen thin story drafts',
                href: appendReturnTo('/portfolio?view=evidence&filter=needs_attention', currentReturnTo),
                description: `${queueCounts.needs_attention} imported stories need more detail before they become reusable evidence.`,
            };
        }

        if (queueCounts.ready_to_verify > 0) {
            return {
                label: 'Review strong imported stories',
                href: appendReturnTo('/portfolio?view=evidence&filter=ready_to_verify', currentReturnTo),
                description: `${queueCounts.ready_to_verify} imported stories already have enough structure to review and reuse.`,
            };
        }

        if ((status?.instagram || 0) + (status?.facebook || 0) > 0) {
            return {
                label: 'Review imported memories',
                href: appendReturnTo('/timeline?source=instagram', currentReturnTo),
                description: 'Open the timeline and review the memories that came from connected sources.',
            };
        }

        return {
            label: 'Connect a provider',
            href: '#social-import-panel',
            description: 'Start with Instagram or Facebook so older memories can move into the same diary and story system.',
        };
    }, [currentReturnTo, queueCounts.needs_attention, queueCounts.ready_to_verify, status?.facebook, status?.instagram]);

    const importSnapshot = useMemo(() => {
        if (queueCounts.needs_attention > 0) {
            return `${queueCounts.needs_attention} stories still need more detail before they become reusable evidence.`;
        }
        if (queueCounts.ready_to_verify > 0) {
            return `${queueCounts.ready_to_verify} stories are ready for verification next.`;
        }
        if (queueCounts.ready_to_export > 0) {
            return `${queueCounts.ready_to_export} imported stories are already strong enough to move into output packs.`;
        }
        if ((status?.instagram || 0) + (status?.facebook || 0) > 0) {
            return `${(status?.instagram || 0) + (status?.facebook || 0)} imported notes are waiting in your timeline.`;
        }
        return 'Start by connecting a provider so older memories can become useful notes, lessons, and stories here too.';
    }, [queueCounts.needs_attention, queueCounts.ready_to_export, queueCounts.ready_to_verify, status?.facebook, status?.instagram]);

    const leadTopic = useMemo(
        () => overview?.topSkills?.[0] || overview?.topLessons?.[0] || null,
        [overview?.topLessons, overview?.topSkills]
    );

    useEffect(() => {
        if (authLoading || !isAuthenticated) return;

        writeWorkspaceResume({
            key: 'import',
            title: NOTIVE_VOICE.surfaces.memoryInbox,
            summary: `${connectedCount}/2 connected · ${queueCounts.ready_to_verify} ready to verify`,
            href: currentReturnTo,
            updatedAt: new Date().toISOString(),
            stage: 'organize',
            actionLabel: `Resume ${NOTIVE_VOICE.surfaces.memoryInbox.toLowerCase()}`,
        });
    }, [authLoading, connectedCount, currentReturnTo, isAuthenticated, queueCounts.ready_to_verify]);

    if (authLoading || isLoading) {
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
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                        <SectionHeader
                            kicker={NOTIVE_VOICE.surfaces.memoryInbox}
                            title={NOTIVE_VOICE.imports.title}
                            description={NOTIVE_VOICE.imports.description}
                            as="h1"
                        />

                        <div className="flex flex-wrap gap-2">
                            <TagPill tone="primary">{connectedCount}/2 connected</TagPill>
                            <TagPill>{(status?.instagram || 0) + (status?.facebook || 0)} imported entries</TagPill>
                            <TagPill>{queueCounts.ready_to_export} ready to reuse</TagPill>
                        </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
                        <div className="workspace-panel rounded-2xl p-4">
                            <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Recommended next step</p>
                            <h2 className="workspace-heading mt-2 text-xl font-semibold">{nextAction.label}</h2>
                            <p className="mt-2 max-w-2xl text-sm leading-7 text-ink-secondary">{nextAction.description}</p>
                            <Link
                                href={nextAction.href}
                                className="workspace-button-primary mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em]"
                            >
                                Continue
                                <FiArrowRight size={14} aria-hidden="true" />
                            </Link>
                        </div>

                        <div className="space-y-3">
                            <div className="workspace-soft-panel rounded-2xl p-4">
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Import snapshot</p>
                                <p className="mt-2 text-sm leading-7 text-[rgb(var(--text-primary))]">{importSnapshot}</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <TagPill tone="primary">{connectedCount}/2 connected</TagPill>
                                    <TagPill>{(status?.instagram || 0) + (status?.facebook || 0)} imported entries</TagPill>
                                    <TagPill>{queueCounts.ready_to_export} ready to reuse</TagPill>
                                    {leadTopic && <TagPill tone="primary">{leadTopic}</TagPill>}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowImportDetails((current) => !current)}
                                className="workspace-button-outline inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em]"
                                aria-expanded={showImportDetails}
                            >
                                {showImportDetails ? 'Hide other import routes' : 'Show other import routes'}
                                <FiChevronDown size={14} className={`transition-transform ${showImportDetails ? 'rotate-180' : ''}`} aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                </AppPanel>

                {error && (
                    <ErrorState
                        title="Couldn\u2019t Load Imports"
                        message={error}
                        variant="compact"
                        action={{
                            label: "Try Again",
                            onClick: () => window.location.reload(),
                        }}
                    />
                )}

                {showImportDetails && (
                    <>
                        <AppPanel className="space-y-4">
                            <SectionHeader
                                kicker="More Paths"
                                title="Choose how to use imported memories"
                                description="Jump straight into the part of the pipeline that matches what these imported memories can become next."
                            />
                            <div className="grid gap-3 lg:grid-cols-3">
                                <Link
                                    href={appendReturnTo('/timeline?source=instagram', currentReturnTo)}
                                    className="workspace-soft-panel rounded-2xl p-4 transition hover:opacity-95"
                                >
                                    <FiLayers size={18} className="text-primary" aria-hidden="true" />
                                    <h3 className="workspace-heading mt-3 text-lg font-semibold">Review imported notes</h3>
                                    <p className="mt-2 text-sm leading-7 text-ink-secondary">Open imported memories in time order and decide what is worth keeping.</p>
                                </Link>
                                <Link
                                    href={appendReturnTo('/portfolio?view=evidence&filter=needs_attention', currentReturnTo)}
                                    onClick={() => {
                                        void trackEvent({
                                            eventType: 'import_to_evidence',
                                            value: 'needs_attention',
                                            metadata: {
                                                source: 'import_inbox',
                                            },
                                        });
                                    }}
                                    className="workspace-soft-panel rounded-2xl p-4 transition hover:opacity-95"
                                >
                                    <FiGrid size={18} className="text-primary" aria-hidden="true" />
                                    <h3 className="workspace-heading mt-3 text-lg font-semibold">Fill in missing detail</h3>
                                    <p className="mt-2 text-sm leading-7 text-ink-secondary">Send low-detail notes into the story queue and add the missing lesson, skill, or evidence.</p>
                                </Link>
                                <div className="workspace-soft-panel rounded-2xl p-4">
                                    <FiCheckCircle size={18} className="text-primary" aria-hidden="true" />
                                    <h3 className="workspace-heading mt-3 text-lg font-semibold">Open a reusable output</h3>
                                    <p className="mt-2 text-sm leading-7 text-ink-secondary">Once strong stories are checked, jump straight into the output you need later.</p>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <Link
                                            href={appendReturnTo('/portfolio?view=export&pack=resume', currentReturnTo)}
                                            onClick={() => {
                                                void trackEvent({
                                                    eventType: 'import_to_evidence',
                                                    value: 'resume',
                                                    metadata: {
                                                        source: 'import_inbox',
                                                    },
                                                });
                                            }}
                                            className="rounded-full border border-primary/25 bg-primary/12 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-primary transition-colors hover:bg-primary/20"
                                        >
                                            Resume
                                        </Link>
                                        <Link
                                            href={appendReturnTo('/portfolio?view=export&pack=statement', currentReturnTo)}
                                            onClick={() => {
                                                void trackEvent({
                                                    eventType: 'import_to_evidence',
                                                    value: 'statement',
                                                    metadata: {
                                                        source: 'import_inbox',
                                                    },
                                                });
                                            }}
                                            className="workspace-button-outline rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em]"
                                        >
                                            Statement
                                        </Link>
                                        <Link
                                            href={appendReturnTo('/portfolio?view=interview', currentReturnTo)}
                                            onClick={() => {
                                                void trackEvent({
                                                    eventType: 'import_to_evidence',
                                                    value: 'interview',
                                                    metadata: {
                                                        source: 'import_inbox',
                                                    },
                                                });
                                            }}
                                            className="workspace-button-outline rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em]"
                                        >
                                            Interview
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </AppPanel>

                        <AppPanel className="space-y-4">
                            <SectionHeader
                                kicker="Queue Status"
                                title="See what each imported story contains already"
                                description="Use status to decide whether imports need more detail, review, or are ready to reuse."
                            />
                            <ActionBar className="gap-2 overflow-x-auto">
                                {(['needs_attention', 'ready_to_verify', 'ready_to_export', 'verified'] as StoryEngineStatus[]).map((statusKey) => (
                                    <Link
                                        key={statusKey}
                                        href={appendReturnTo(
                                            statusKey === 'verified' || statusKey === 'ready_to_export'
                                                ? `/portfolio?view=${statusKey === 'verified' ? 'evidence' : 'export'}${statusKey === 'ready_to_export' ? '&pack=resume' : '&filter=verified'}`
                                                : `/portfolio?view=evidence&filter=${statusKey}`,
                                            currentReturnTo
                                        )}
                                        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] whitespace-nowrap ${storyStatusClassName[statusKey]}`}
                                    >
                                        {storyStatusLabel[statusKey]}
                                        <span className="workspace-pill-muted rounded-full px-2 py-0.5 text-xs text-[rgb(var(--text-primary))]">
                                            {queueCounts[statusKey]}
                                        </span>
                                    </Link>
                                ))}
                            </ActionBar>
                        </AppPanel>
                    </>
                )}

                <div id="social-import-panel">
                    <SocialImportPanel returnToPath="/import" compact />
                </div>
            </div>
        </div>
    );
}
