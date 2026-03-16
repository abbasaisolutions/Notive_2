'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SocialImportPanel from '@/components/import/SocialImportPanel';
import { NOTIVE_VOICE } from '@/content/notive-voice';
import { ActionBar, AppPanel, SectionHeader, StatTile, TagPill } from '@/components/ui/surface';
import { API_URL } from '@/constants/config';
import useApi from '@/hooks/use-api';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import useTelemetry from '@/hooks/use-telemetry';
import { appendReturnTo, buildCurrentReturnTo } from '@/utils/navigation';
import { storyStatusClassName, storyStatusLabel, type StoryEngineStatus } from '@/utils/story-engine';
import { writeWorkspaceResume } from '@/utils/workspace-resume';
import { FiArrowRight, FiCheckCircle, FiGrid, FiLayers } from 'react-icons/fi';

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
                    throw new Error(statusData?.message || 'Failed to load import status');
                }

                if (!overviewResponse.ok) {
                    throw new Error(overviewData?.message || 'Failed to load story overview');
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
                setError(err instanceof Error ? err.message : 'Failed to load import inbox');
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
                label: 'Strengthen weak stories',
                href: appendReturnTo('/portfolio?view=evidence&filter=needs_attention', currentReturnTo),
                description: `${queueCounts.needs_attention} stories need more detail before they become reusable evidence.`,
            };
        }

        if (queueCounts.ready_to_verify > 0) {
            return {
                label: 'Verify strong imports',
                href: appendReturnTo('/portfolio?view=evidence&filter=ready_to_verify', currentReturnTo),
                description: `${queueCounts.ready_to_verify} stories are structured and ready for verification.`,
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
            description: 'Start with Instagram or Facebook so imported memories can move into your evidence queue.',
        };
    }, [currentReturnTo, queueCounts.needs_attention, queueCounts.ready_to_verify, status?.facebook, status?.instagram]);

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
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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
                            title="Bring old notes and posts into Notive"
                            description="Connect apps, review old memories, and move the strongest ones into useful stories."
                        />

                        <div className="flex flex-wrap gap-2">
                            <TagPill tone="primary">{connectedCount}/2 connected</TagPill>
                            <TagPill>{(status?.instagram || 0) + (status?.facebook || 0)} imported entries</TagPill>
                            <TagPill>{overview?.stats?.experienceCount || 0} stories found</TagPill>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        <StatTile label="Connected" value={connectedCount} hint="Active import providers" tone="primary" />
                        <StatTile label="Imported Notes" value={(status?.instagram || 0) + (status?.facebook || 0)} hint={`Instagram and Facebook notes in ${NOTIVE_VOICE.surfaces.memoryAtlas.toLowerCase()}`} />
                        <StatTile label="Needs More Detail" value={queueCounts.needs_attention} hint="Stories that still need structure" />
                        <StatTile label="Ready To Check" value={queueCounts.ready_to_verify} hint="Imported stories close to ready" />
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Recommended next step</p>
                            <h2 className="mt-2 text-xl font-semibold text-white">{nextAction.label}</h2>
                            <p className="mt-2 max-w-2xl text-sm leading-7 text-ink-secondary">{nextAction.description}</p>
                            <Link
                                href={nextAction.href}
                                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-primary transition-colors hover:bg-primary/20"
                            >
                                Continue
                                <FiArrowRight size={14} aria-hidden="true" />
                            </Link>
                        </div>

                        <div className="grid gap-2">
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Pipeline</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <TagPill>Connect</TagPill>
                                    <TagPill>Select</TagPill>
                                    <TagPill>Review</TagPill>
                                    <TagPill>Verify</TagPill>
                                    <TagPill tone="primary">Export</TagPill>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Top topics</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {overview?.topSkills?.slice(0, 4).map((skill) => (
                                        <TagPill key={skill}>{skill}</TagPill>
                                    ))}
                                    {overview?.topLessons?.slice(0, 2).map((lesson) => (
                                        <TagPill key={lesson} tone="primary">{lesson}</TagPill>
                                    ))}
                                    {(!overview?.topSkills?.length && !overview?.topLessons?.length) && (
                                        <p className="text-sm text-ink-secondary">Import a few stronger memories to surface themes here.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </AppPanel>

                {error && (
                    <AppPanel tone="soft" className="border-white/15">
                        <p className="text-sm text-white">{error}</p>
                    </AppPanel>
                )}

                <AppPanel className="space-y-4">
                    <SectionHeader
                        kicker="Pathways"
                        title="Move imports to the right next place"
                        description="Jump straight into the next view that matches how ready your imported stories are."
                    />
                    <div className="grid gap-3 lg:grid-cols-3">
                        <Link
                            href={appendReturnTo('/timeline?source=instagram', currentReturnTo)}
                            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/15 hover:bg-white/[0.05]"
                        >
                            <FiLayers size={18} className="text-primary" aria-hidden="true" />
                            <h3 className="mt-3 text-lg font-semibold text-white">Review imported notes</h3>
                            <p className="mt-2 text-sm leading-7 text-ink-secondary">Open imported memories in time order and read them before editing.</p>
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
                            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/15 hover:bg-white/[0.05]"
                        >
                            <FiGrid size={18} className="text-primary" aria-hidden="true" />
                            <h3 className="mt-3 text-lg font-semibold text-white">Fix weak stories</h3>
                            <p className="mt-2 text-sm leading-7 text-ink-secondary">Send low-detail notes into the story queue and fill in the missing parts.</p>
                        </Link>
                        <Link
                            href={appendReturnTo('/portfolio?view=export&pack=resume', currentReturnTo)}
                            onClick={() => {
                                void trackEvent({
                                    eventType: 'import_to_evidence',
                                    value: 'export',
                                    metadata: {
                                        source: 'import_inbox',
                                    },
                                });
                            }}
                            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/15 hover:bg-white/[0.05]"
                        >
                            <FiCheckCircle size={18} className="text-primary" aria-hidden="true" />
                            <h3 className="mt-3 text-lg font-semibold text-white">Open stories</h3>
                            <p className="mt-2 text-sm leading-7 text-ink-secondary">Once strong stories are checked, move straight into resume, statement, or interview packs.</p>
                        </Link>
                    </div>
                </AppPanel>

                <AppPanel className="space-y-4">
                    <SectionHeader
                        kicker="Story Status"
                        title="What each import needs next"
                        description="Use story status to decide whether imports need more detail, checking, or are ready to use."
                    />
                    <ActionBar className="gap-2 overflow-x-auto bg-black/20 border-white/10">
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
                                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[11px] text-white">
                                    {queueCounts[statusKey]}
                                </span>
                            </Link>
                        ))}
                    </ActionBar>
                </AppPanel>

                <div id="social-import-panel">
                    <SocialImportPanel returnToPath="/import" compact />
                </div>
            </div>
        </div>
    );
}
