'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { NOTIVE_VOICE } from '@/content/notive-voice';
import useApi from '@/hooks/use-api';
import { ActionBar, AppPanel, EmptyState, SectionHeader, StatTile, TagPill } from '@/components/ui/surface';
import AdminPerformanceOverview, { type AdminPerformanceOverviewData } from '@/components/admin/AdminPerformanceOverview';
import { NotebookDoodle } from '@/components/dashboard/NotebookDoodles';
import { FiAlertCircle, FiLock, FiSearch, FiShield, FiX } from 'react-icons/fi';
import { Spinner } from '@/components/ui';

type TrackFilter = 'all' | 'personal' | 'professional' | 'blended' | 'unknown';
type StageFilter = 'all' | 'not_started' | 'in_progress' | 'completed';
type RoleFilter = 'all' | 'USER' | 'ADMIN' | 'SUPERADMIN';
type AdminActionType = 'role' | 'ban' | 'revoke' | 'delete';

type User = {
    id: string;
    email: string;
    name: string | null;
    role: 'USER' | 'ADMIN' | 'SUPERADMIN';
    isBanned: boolean;
    _count: { entries: number };
    profileContext: {
        completionScore: number;
        stage: 'not_started' | 'in_progress' | 'completed';
        track: 'personal' | 'professional' | 'blended' | 'unknown';
        personalGrowthScore: number;
        professionalReadinessScore: number;
    };
    evidenceRollup: {
        totalExperiences: number;
        averageCompletenessScore: number;
        readyForVerificationCount: number;
        readyForExportCount: number;
        incompleteCount: number;
    };
};

type Stats = {
    totalUsers: number;
    totalEntries: number;
    newUsersThisWeek: number;
    activeUsersToday: number;
    adminUsers: number;
    superAdmins: number;
    bannedUsers: number;
};

type EvidenceSummary = {
    userCount: number;
    usersWithEntries: number;
    usersReadyForVerification: number;
    usersReadyForExport: number;
    averageCompletenessScore: number;
};

type PerformanceOverview = AdminPerformanceOverviewData;

type SupportIssue = {
    id: string;
    severity: 'healthy' | 'watch' | 'action';
    title: string;
    detail: string;
};

type UserDetail = User & {
    avatarUrl?: string | null;
    hasPassword?: boolean;
    hasGoogle?: boolean;
    createdAt: string;
    updatedAt: string;
    socialConnections: Array<{
        provider: string;
        updatedAt: string;
        expiresAt: string | null;
    }>;
    profile: {
        bio?: string | null;
        location?: string | null;
        occupation?: string | null;
        website?: string | null;
        importPreference?: string | null;
        outputGoals?: string[];
    } | null;
    _count: {
        entries: number;
        chapters: number;
        refreshTokens: number;
    };
    supportSummary: {
        state: 'healthy' | 'watch' | 'action';
        recommendedAction: string;
        issues: SupportIssue[];
        permissions: {
            canChangeRole: boolean;
            canBan: boolean;
            canDelete: boolean;
            canGrantSuperAdmin: boolean;
        };
    };
    recentEntries: Array<{
        id: string;
        title: string | null;
        source: string;
        mood: string | null;
        createdAt: string;
    }>;
    recentTelemetry: Array<{
        eventType: string;
        field: string | null;
        pathname: string | null;
        occurredAt: string;
    }>;
    recentAdminActions: Array<{
        eventType: string;
        field: string | null;
        value: string | null;
        metadata?: Record<string, unknown> | null;
        occurredAt: string;
    }>;
};

type RetrievalDebugResult = {
    id: string;
    title: string | null;
    content: string;
    mood: string | null;
    createdAt: string;
    relevance: number;
    strategy: 'lexical' | 'semantic' | 'hybrid' | 'fallback';
    lexicalScore: number;
    semanticScore: number;
    rerankScore: number;
    matchReasons: string[];
    debug: {
        embeddingProvider: string;
        embeddingModel: string;
        rerankerUsed: boolean;
        rerankerModel: string | null;
    };
};

type RetrievalDebugResponse = {
    targetUser: {
        id: string;
        email: string;
        name: string | null;
        role: 'USER' | 'ADMIN' | 'SUPERADMIN';
        entryCount: number;
    };
    results: RetrievalDebugResult[];
    count: number;
    query: string;
    searchMode: 'lexical' | 'semantic' | 'hybrid' | 'fallback';
    debug: {
        embeddingProvider: string;
        embeddingModel: string;
        embeddingDimensions: number;
        rerankerConfigured: boolean;
        rerankerModel: string | null;
        rerankerUsed: boolean;
        candidateCounts: {
            lexical: number;
            dense: number;
            rerankPool: number;
        };
    };
};

const TRACK_OPTIONS: Array<{ id: TrackFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'personal', label: 'Personal' },
    { id: 'professional', label: 'Professional' },
    { id: 'blended', label: 'Blended' },
    { id: 'unknown', label: 'Unknown' },
];

const STAGE_OPTIONS: Array<{ id: StageFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'not_started', label: 'Not Started' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'completed', label: 'Completed' },
];

const ROLE_OPTIONS: Array<{ id: RoleFilter; label: string }> = [
    { id: 'all', label: 'All Roles' },
    { id: 'USER', label: 'Users' },
    { id: 'ADMIN', label: 'Admins' },
    { id: 'SUPERADMIN', label: 'Super Admins' },
];

const formatStage = (value: string) => value.split('_').map((token) => token.charAt(0).toUpperCase() + token.slice(1)).join(' ');
const formatRole = (value: string) => value === 'SUPERADMIN' ? 'Super Admin' : value.charAt(0) + value.slice(1).toLowerCase();
const formatDate = (value: string) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const getAuditMetadataText = (metadata?: Record<string, unknown> | null, key?: 'reason' | 'supportNote'): string | null => {
    if (!metadata || !key) return null;
    const value = metadata[key];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
};

function MetricBar({ label, value, gradient }: { label: string; value: number; gradient: string }) {
    return (
        <div>
            <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-[0.12em] text-ink-muted">
                <span>{label}</span>
                <span className="workspace-heading">{value}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-ink-muted/20">
                <div className="h-full rounded-full" style={{ width: `${value}%`, background: gradient }} />
            </div>
        </div>
    );
}

export default function AdminPage() {
    const { user, isLoading: authLoading } = useAuth();
    const { apiFetch } = useApi();
    const [users, setUsers] = useState<User[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [evidenceSummary, setEvidenceSummary] = useState<EvidenceSummary | null>(null);
    const [performanceOverview, setPerformanceOverview] = useState<PerformanceOverview | null>(null);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [trackFilter, setTrackFilter] = useState<TrackFilter>('all');
    const [stageFilter, setStageFilter] = useState<StageFilter>('all');
    const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
    const [onlyNeedsSupport, setOnlyNeedsSupport] = useState(false);
    const [completionLte, setCompletionLte] = useState(40);
    const [scanLimitReached, setScanLimitReached] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
    const [roleDraft, setRoleDraft] = useState<'USER' | 'ADMIN' | 'SUPERADMIN'>('USER');
    const [actionReason, setActionReason] = useState('');
    const [supportNote, setSupportNote] = useState('');
    const [pendingAction, setPendingAction] = useState<{ type: AdminActionType; label: string } | null>(null);
    const [isSubmittingAction, setIsSubmittingAction] = useState(false);
    const [detailError, setDetailError] = useState('');
    const [actionError, setActionError] = useState('');
    const [detailNotice, setDetailNotice] = useState('');
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [retrievalQuery, setRetrievalQuery] = useState('');
    const [retrievalDebug, setRetrievalDebug] = useState<RetrievalDebugResponse | null>(null);
    const [retrievalDebugError, setRetrievalDebugError] = useState('');
    const [isRetrievalDebugLoading, setIsRetrievalDebugLoading] = useState(false);
    const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');

    const viewerRole = user?.role || 'USER';
    const isSuperAdmin = viewerRole === 'SUPERADMIN';
    const visibleRoleOptions = isSuperAdmin
        ? ROLE_OPTIONS
        : ROLE_OPTIONS.filter((option) => option.id === 'all' || option.id === 'USER');
    const activeFilterCount = [trackFilter !== 'all', stageFilter !== 'all', roleFilter !== 'all', onlyNeedsSupport].filter(Boolean).length;

    const resetActionDrafts = () => {
        setActionReason('');
        setSupportNote('');
        setPendingAction(null);
        setIsSubmittingAction(false);
        setActionError('');
        setDeleteConfirmEmail('');
    };

    const fetchUsers = async () => {
        try {
            const params = new URLSearchParams({
                page: String(page),
                search,
                track: trackFilter,
                stage: stageFilter,
                role: roleFilter,
            });
            if (onlyNeedsSupport) params.set('completionLte', String(completionLte));

            const response = await apiFetch(`/admin/users?${params.toString()}`);
            if (!response.ok) {
                if (response.status === 403) {
                    setError('Admin access required');
                    return;
                }
                throw new Error('Couldn\u2019t load the user list.');
            }

            const data = await response.json();
            setUsers(data.users || []);
            setEvidenceSummary(data.evidenceSummary || null);
            setTotalPages(data.pagination?.totalPages || 1);
            setScanLimitReached(Boolean(data.filters?.scanLimitReached));
        } catch (err: any) {
            setError(err.message || 'Couldn\u2019t load the user list.');
        }
    };

    const fetchStats = async () => {
        try {
            const response = await apiFetch('/admin/stats');
            if (response.ok) {
                setStats(await response.json());
            }
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    };

    const fetchPerformanceOverview = async () => {
        try {
            const response = await apiFetch('/admin/performance-overview');
            if (response.ok) {
                setPerformanceOverview(await response.json());
            }
        } catch (err) {
            console.error('Failed to fetch performance overview:', err);
        }
    };

    useEffect(() => {
        if (user && !authLoading) {
            Promise.all([fetchUsers(), fetchStats(), fetchPerformanceOverview()]).finally(() => setIsLoading(false));
        }
    }, [user, authLoading, page, trackFilter, stageFilter, roleFilter, onlyNeedsSupport, completionLte]);

    useEffect(() => {
        if (isSuperAdmin) return;
        if (roleFilter === 'ADMIN' || roleFilter === 'SUPERADMIN') {
            setRoleFilter('all');
        }
    }, [isSuperAdmin, roleFilter]);

    const clearFilters = () => {
        setTrackFilter('all');
        setStageFilter('all');
        setRoleFilter('all');
        setOnlyNeedsSupport(false);
        setCompletionLte(40);
        setPage(1);
    };

    const onSearchSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        setPage(1);
        void fetchUsers();
    };

    const stageAdminAction = (action: { type: AdminActionType; label: string }) => {
        setActionError('');
        setDetailNotice('');
        setPendingAction(action);
    };

    const fetchUserDetails = async (userId: string) => {
        setSelectedUserId(userId);
        setIsDetailLoading(true);
        setDetailError('');
        setActionError('');
        setDetailNotice('');

        try {
            const response = await apiFetch(`/admin/users/${userId}`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Couldn\u2019t load user details.');
            setSelectedUser(data.user as UserDetail);
            setRoleDraft((data.user as UserDetail).role);
            resetActionDrafts();
        } catch (err: any) {
            setDetailError(err.message || 'Couldn\u2019t load user details.');
            setSelectedUser(null);
        } finally {
            setIsDetailLoading(false);
        }
    };

    const closeDetail = () => {
        setSelectedUserId(null);
        setSelectedUser(null);
        setDetailError('');
        setActionError('');
        setDetailNotice('');
        setRetrievalQuery('');
        setRetrievalDebug(null);
        setRetrievalDebugError('');
        resetActionDrafts();
    };

    const runRetrievalDebug = async () => {
        if (!selectedUser) return;
        const normalizedQuery = retrievalQuery.trim();
        if (normalizedQuery.length < 2) {
            setRetrievalDebugError('Enter at least 2 characters to inspect retrieval.');
            return;
        }

        setIsRetrievalDebugLoading(true);
        setRetrievalDebugError('');

        try {
            const params = new URLSearchParams({
                q: normalizedQuery,
                userId: selectedUser.id,
                limit: '6',
            });
            const response = await apiFetch(`/admin/retrieval-debug?${params.toString()}`);
            const data = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(data?.message || 'Couldn\u2019t run the retrieval debug.');
            }
            setRetrievalDebug(data as RetrievalDebugResponse);
        } catch (err: any) {
            setRetrievalDebugError(err.message || 'Couldn\u2019t run the retrieval debug.');
            setRetrievalDebug(null);
        } finally {
            setIsRetrievalDebugLoading(false);
        }
    };

    const executePendingAction = async () => {
        if (!selectedUser || !pendingAction) return;
        const trimmedReason = actionReason.trim();
        const trimmedSupportNote = supportNote.trim();

        if (trimmedReason.length < 8) {
            setActionError('Add a reason of at least 8 characters before confirming this action.');
            return;
        }

        setIsSubmittingAction(true);
        setActionError('');
        setDetailNotice('');

        try {
            let response: Response;
            if (pendingAction.type === 'role') {
                response = await apiFetch(`/admin/users/${selectedUser.id}/role`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        role: roleDraft,
                        reason: trimmedReason,
                        supportNote: trimmedSupportNote || undefined,
                    }),
                });
            } else if (pendingAction.type === 'ban') {
                response = await apiFetch(`/admin/users/${selectedUser.id}/ban`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reason: trimmedReason,
                        supportNote: trimmedSupportNote || undefined,
                    }),
                });
            } else if (pendingAction.type === 'revoke') {
                response = await apiFetch(`/admin/users/${selectedUser.id}/revoke-sessions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reason: trimmedReason,
                        supportNote: trimmedSupportNote || undefined,
                    }),
                });
            } else {
                // delete
                response = await apiFetch(`/admin/users/${selectedUser.id}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reason: trimmedReason,
                        supportNote: trimmedSupportNote || undefined,
                    }),
                });
            }

            const data = await response.json().catch(() => null);
            if (!response.ok) throw new Error(data?.message || 'Couldn\u2019t complete that action.');

            setDetailNotice(data?.message || `${pendingAction.label} completed`);
            resetActionDrafts();
            void fetchUsers();
            if (pendingAction.type === 'delete') {
                closeDetail();
            } else {
                void fetchUserDetails(selectedUser.id);
            }
        } catch (err: any) {
            setActionError(err.message || 'Couldn\u2019t complete that action.');
        } finally {
            setIsSubmittingAction(false);
        }
    };

    const canStageRoleChange = Boolean(
        selectedUser &&
        selectedUser.supportSummary.permissions.canChangeRole &&
        selectedUser.id !== user?.id &&
        roleDraft !== selectedUser.role
    );

    const actionReasonLength = actionReason.trim().length;
    const pendingActionSummary = pendingAction
        ? pendingAction.type === 'role'
            ? `Change this account from ${selectedUser ? formatRole(selectedUser.role) : 'current role'} to ${formatRole(roleDraft)}.`
            : pendingAction.type === 'ban'
                ? selectedUser?.isBanned
                    ? 'Restore access for this account and allow sign-in again.'
                    : 'Suspend this account and block new sessions until access is restored.'
                : pendingAction.type === 'delete'
                    ? 'Permanently delete this account and all associated data. This cannot be undone.'
                    : 'Remove all active refresh sessions so the user must sign in again on every device.'
        : null;

    useEffect(() => {
        setRetrievalQuery('');
        setRetrievalDebug(null);
        setRetrievalDebugError('');
        setIsRetrievalDebugLoading(false);
    }, [selectedUserId]);

    if (authLoading || isLoading) {
        return (
            <div className="admin-stage min-h-screen flex items-center justify-center">
                <Spinner size="md" />
            </div>
        );
    }

    if (error === 'Admin access required') {
        return (
            <div className="admin-stage page-paper-canvas min-h-screen px-4 py-10">
                <div className="mx-auto max-w-2xl">
                    <AppPanel className="space-y-5 text-center">
                        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] workspace-soft-panel">
                            <FiLock size={32} className="text-ink-secondary" aria-hidden="true" />
                        </div>
                        <SectionHeader kicker="Admin" title="Access denied" description="You need admin access to open this page." className="justify-center text-center" />
                        <div className="flex justify-center">
                            <Link href="/dashboard" className="workspace-button-primary rounded-xl px-5 py-3 text-sm font-semibold">Go to {NOTIVE_VOICE.surfaces.homeBase}</Link>
                        </div>
                    </AppPanel>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-stage page-paper-canvas min-h-screen px-4 py-6 pb-24 md:px-8 md:py-8">
            <div className="mx-auto max-w-6xl space-y-6">
                <AppPanel className="admin-header-panel relative overflow-hidden space-y-5">
                    <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-48 md:block">
                        <div className="absolute right-6 top-5 opacity-75">
                            <NotebookDoodle name="star" accent="amber" className="h-16 w-16 rotate-[8deg]" />
                        </div>
                        <div className="absolute bottom-4 right-16 opacity-55">
                            <NotebookDoodle name="walker" accent="sky" className="h-14 w-14 -rotate-[10deg]" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                        <SectionHeader kicker="Admin" title="Manage users" description="Check user activity, find people who need help, and manage accounts." />
                        <ActionBar className="overflow-x-auto">
                            <TagPill tone="primary" className="gap-1.5"><FiShield size={12} aria-hidden="true" />Admin tools</TagPill>
                            <TagPill tone="muted">Active filters {activeFilterCount}</TagPill>
                            <TagPill tone="muted">Results {users.length}</TagPill>
                            {onlyNeedsSupport && <TagPill>Help list &lt;= {completionLte}%</TagPill>}
                            <Link href="/profile" className="rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:text-[rgb(var(--text-primary))]">Me</Link>
                        </ActionBar>
                    </div>
                    {stats && (
                        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
                            <StatTile label="Users" value={stats.totalUsers} hint="Total accounts" tone="primary" />
                            <StatTile label="Notes" value={stats.totalEntries} hint="Total notes" />
                            <StatTile label="New This Week" value={stats.newUsersThisWeek} hint="New accounts" />
                            <StatTile label="Active Today" value={stats.activeUsersToday} hint="Users active today" />
                            {isSuperAdmin && <StatTile label="Admins" value={stats.adminUsers} hint="Admin accounts" />}
                            <StatTile label="Blocked" value={stats.bannedUsers} hint={isSuperAdmin ? `${stats.superAdmins} super admin${stats.superAdmins === 1 ? '' : 's'}` : 'Blocked accounts'} />
                        </div>
                    )}
                </AppPanel>

                {performanceOverview && (
                    <AdminPerformanceOverview overview={performanceOverview} />
                )}

                <AppPanel className="space-y-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <SectionHeader kicker="Filters" title="Find the right users" description="Search by name or email, then narrow by track, setup stage, or who needs help." />
                        <ActionBar>
                            <TagPill tone="muted">Page {page} of {totalPages}</TagPill>
                            <button type="button" onClick={clearFilters} className="rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:text-[rgb(var(--text-primary))]">Clear Filters</button>
                        </ActionBar>
                    </div>

                    <form onSubmit={onSearchSubmit} className="flex flex-col gap-3 md:flex-row">
                        <input type="text" placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} className="workspace-input flex-1 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/35" />
                        <button type="submit" className="rounded-xl border border-primary/30 bg-primary/15 px-6 py-3 text-sm font-semibold text-[rgb(var(--text-primary))] transition-colors hover:bg-primary/25">Search</button>
                    </form>

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_320px]">
                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Track</p>
                            <ActionBar>
                                {TRACK_OPTIONS.map((item) => (
                                    <button key={item.id} type="button" onClick={() => { setTrackFilter(item.id); setPage(1); }} className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${trackFilter === item.id ? 'bg-primary/15 text-primary' : 'text-ink-secondary hover:text-[rgb(var(--text-primary))]'}`}>{item.label}</button>
                                ))}
                            </ActionBar>
                        </div>
                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Stage</p>
                            <ActionBar>
                                {STAGE_OPTIONS.map((item) => (
                                    <button key={item.id} type="button" onClick={() => { setStageFilter(item.id); setPage(1); }} className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${stageFilter === item.id ? 'bg-primary/15 text-primary' : 'text-ink-secondary hover:text-[rgb(var(--text-primary))]'}`}>{item.label}</button>
                                ))}
                            </ActionBar>
                        </div>
                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Role</p>
                            <ActionBar>
                                {visibleRoleOptions.map((item) => (
                                    <button key={item.id} type="button" onClick={() => { setRoleFilter(item.id); setPage(1); }} className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${roleFilter === item.id ? 'bg-primary/15 text-primary' : 'text-ink-secondary hover:text-[rgb(var(--text-primary))]'}`}>{item.label}</button>
                                ))}
                            </ActionBar>
                        </div>
                        <div className="workspace-soft-panel rounded-2xl p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold workspace-heading">Help focus</p>
                                    <p className="mt-1 text-xs text-ink-secondary">Show users at or below this setup score.</p>
                                </div>
                                <button type="button" onClick={() => { setOnlyNeedsSupport((prev) => !prev); setPage(1); }} className={`relative h-7 w-12 rounded-full border transition-colors ${onlyNeedsSupport ? 'border-primary/35 bg-primary/15' : 'border-ink-muted/20 bg-white/[0.03]'}`} aria-pressed={onlyNeedsSupport}>
                                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${onlyNeedsSupport ? 'left-6' : 'left-1'}`} />
                                </button>
                            </div>
                            {onlyNeedsSupport && (
                                <div className="mt-4">
                                    <div className="mb-2 flex items-center justify-between text-xs text-ink-secondary"><span>Setup limit</span><span>{completionLte}%</span></div>
                                    <input type="range" min={0} max={100} step={5} value={completionLte} onChange={(event) => { setCompletionLte(Number(event.target.value)); setPage(1); }} className="w-full accent-primary" />
                                </div>
                            )}
                        </div>
                    </div>

                    {scanLimitReached && (
                        <div className="flex items-start gap-3 rounded-2xl workspace-soft-panel p-4 text-sm workspace-heading">
                            <FiAlertCircle size={18} className="mt-0.5 text-ink-secondary" aria-hidden="true" />
                            <p>Showing filtered results from the most recent 5000 users. Use more filters or search to narrow this list.</p>
                        </div>
                    )}
                </AppPanel>

                {evidenceSummary && (
                    <AppPanel tone="accent" className="space-y-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <SectionHeader kicker="Story Status" title="Readiness snapshot" description="See how much of this page is ready to check or use." />
                            <TagPill tone="primary">Avg ready {evidenceSummary.averageCompletenessScore}%</TagPill>
                        </div>
                        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
                            <StatTile label="Users Checked" value={evidenceSummary.userCount} hint="This page" />
                            <StatTile label="With Notes" value={evidenceSummary.usersWithEntries} hint="Users with saved notes" />
                            <StatTile label="Ready to Check" value={evidenceSummary.usersReadyForVerification} hint="Ready for review" />
                            <StatTile label="Ready to Use" value={evidenceSummary.usersReadyForExport} hint="Ready for stories" tone="primary" />
                        </div>
                    </AppPanel>
                )}

                {users.length === 0 ? (
                    <EmptyState title="No users match this view" description="Adjust filters or search to widen the admin queue." actionLabel="Open Admin" actionHref="/admin" />
                ) : (
                    <AppPanel className="overflow-hidden p-0">
                        <div className="border-b border-ink-muted/15 px-5 py-5 md:px-6">
                            <SectionHeader kicker="Directory" title="User list" description="See activity, setup progress, story quality, and account actions in one table." />
                        </div>

                        {/* Mobile card view */}
                        <div className="divide-y divide-ink-muted/10 md:hidden">
                            {users.map((currentUser) => (
                                <div key={currentUser.id} className="flex items-center gap-3 px-4 py-4">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/70 to-secondary/70 text-sm font-semibold text-[rgb(var(--text-primary))]">
                                        {currentUser.name?.charAt(0) || currentUser.email.charAt(0)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold workspace-heading">{currentUser.name || 'No name'}</p>
                                        <p className="truncate text-xs text-ink-muted">{currentUser.email}</p>
                                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                                            <TagPill tone={currentUser.isBanned ? 'muted' : 'primary'}>{currentUser.isBanned ? 'Banned' : 'Active'}</TagPill>
                                            <TagPill tone={currentUser.role === 'USER' ? 'muted' : 'primary'}>{formatRole(currentUser.role)}</TagPill>
                                            <TagPill tone="muted">{currentUser._count.entries} notes</TagPill>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => void fetchUserDetails(currentUser.id)}
                                        className="shrink-0 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                                    >
                                        Review
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Desktop table view */}
                        <div className="hidden overflow-x-auto md:block">
                            <table className="min-w-full">
                                <thead className="bg-[rgba(92,92,92,0.06)]">
                                    <tr>
                                        <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">User</th>
                                        <th className="hidden px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted md:table-cell">Notes</th>
                                        <th className="hidden px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted md:table-cell">Role</th>
                                        <th className="hidden px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted lg:table-cell">Setup</th>
                                        <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Status</th>
                                        <th className="px-4 py-4 text-right text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((currentUser) => (
                                        <tr key={currentUser.id} className="border-t border-ink-muted/10 align-top transition-colors hover:bg-[rgba(255,255,255,0.36)]">
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/70 to-secondary/70 text-sm font-semibold text-[rgb(var(--text-primary))]">{currentUser.name?.charAt(0) || currentUser.email.charAt(0)}</div>
                                                    <div className="space-y-1">
                                                        <p className="text-sm font-semibold workspace-heading">{currentUser.name || 'No name'}</p>
                                                        <p className="text-sm text-ink-secondary">{currentUser.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="hidden px-4 py-4 text-sm workspace-heading md:table-cell">{currentUser._count.entries}</td>
                                            <td className="hidden px-4 py-4 md:table-cell">
                                                <TagPill tone={currentUser.role === 'USER' ? 'muted' : 'primary'}>{formatRole(currentUser.role)}</TagPill>
                                            </td>
                                            <td className="hidden px-4 py-4 lg:table-cell">
                                                <div className="space-y-3">
                                                    <div className="flex flex-wrap gap-2">
                                                        <TagPill>{currentUser.profileContext.track}</TagPill>
                                                        <TagPill>{formatStage(currentUser.profileContext.stage)}</TagPill>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <MetricBar label="Completion" value={currentUser.profileContext.completionScore} gradient="linear-gradient(90deg, rgba(34,211,238,0.7), rgba(103,232,249,0.7))" />
                                                        <MetricBar label="Personal" value={currentUser.profileContext.personalGrowthScore} gradient="linear-gradient(90deg, rgba(34,197,94,0.7), rgba(134,239,172,0.7))" />
                                                        <MetricBar label="School / Work" value={currentUser.profileContext.professionalReadinessScore} gradient="linear-gradient(90deg, rgba(248,113,113,0.7), rgba(252,165,165,0.7))" />
                                                        <MetricBar label="Story Ready" value={currentUser.evidenceRollup.averageCompletenessScore} gradient="linear-gradient(90deg, rgba(245,158,11,0.75), rgba(251,191,36,0.75))" />
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <TagPill tone="muted">Check {currentUser.evidenceRollup.readyForVerificationCount}/{currentUser.evidenceRollup.totalExperiences}</TagPill>
                                                        <TagPill tone="muted">Use {currentUser.evidenceRollup.readyForExportCount}/{currentUser.evidenceRollup.totalExperiences}</TagPill>
                                                        <TagPill tone="muted">Missing {currentUser.evidenceRollup.incompleteCount}</TagPill>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4"><TagPill tone={currentUser.isBanned ? 'muted' : 'primary'}>{currentUser.isBanned ? 'Banned' : 'Active'}</TagPill></td>
                                            <td className="px-4 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => void fetchUserDetails(currentUser.id)} className="rounded-xl border border-primary/25 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20">
                                                        Review
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </AppPanel>
                )}

                {totalPages > 1 && (
                    <ActionBar className="justify-center">
                        <button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="rounded-xl px-4 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:text-[rgb(var(--text-primary))] disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
                        <TagPill tone="muted">Page {page} of {totalPages}</TagPill>
                        <button onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="rounded-xl px-4 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:text-[rgb(var(--text-primary))] disabled:cursor-not-allowed disabled:opacity-50">Next</button>
                    </ActionBar>
                )}

                {selectedUserId && (
                    <div
                        className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(58,58,58,0.24)] p-4 backdrop-blur-sm md:items-center"
                        onClick={closeDetail}
                        onKeyDown={(e) => { if (e.key === 'Escape') closeDetail(); }}
                    >
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-label="User detail"
                            className="w-full max-w-4xl overflow-hidden rounded-[2rem] workspace-panel shadow-2xl shadow-black/30"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-start justify-between gap-4 border-b border-ink-muted/15 px-5 py-5 md:px-6">
                                <SectionHeader
                                    kicker="User Review"
                                    title={selectedUser?.name || selectedUser?.email || 'User details'}
                                    description={selectedUser ? `${selectedUser.email} · ${formatRole(selectedUser.role)}` : 'Loading account context'}
                                    as="h2"
                                />
                                <button
                                    type="button"
                                    onClick={closeDetail}
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl workspace-soft-panel text-ink-secondary transition-colors hover:text-[rgb(var(--text-primary))]"
                                    aria-label="Close user detail"
                                >
                                    <FiX size={18} aria-hidden="true" />
                                </button>
                            </div>

                            {isDetailLoading ? (
                                <div className="flex min-h-[240px] items-center justify-center">
                                    <Spinner size="md" />
                                </div>
                            ) : detailError ? (
                                <div className="px-5 py-8 md:px-6">
                                    <AppPanel className="text-center">
                                        <p className="text-sm workspace-heading">{detailError}</p>
                                    </AppPanel>
                                </div>
                            ) : selectedUser ? (
                                <div className="max-h-[78vh] overflow-y-auto px-5 py-5 md:px-6">
                                    {detailNotice && (
                                        <div className="mb-4 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm workspace-heading">
                                            {detailNotice}
                                        </div>
                                    )}
                                    {actionError && (
                                        <div className="mb-4 rounded-2xl workspace-soft-panel px-4 py-3 text-sm workspace-heading">
                                            {actionError}
                                        </div>
                                    )}
                                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                                        <div className="space-y-4">
                                            <AppPanel tone="accent" className="space-y-4">
                                                <div className="flex flex-wrap gap-2">
                                                    <TagPill tone={selectedUser.supportSummary.state === 'action' ? 'primary' : 'muted'}>
                                                        {selectedUser.supportSummary.state === 'action' ? 'Needs action' : selectedUser.supportSummary.state === 'watch' ? 'Needs review' : 'Healthy'}
                                                    </TagPill>
                                                    <TagPill tone={selectedUser.isBanned ? 'muted' : 'primary'}>
                                                        {selectedUser.isBanned ? 'Banned' : 'Active'}
                                                    </TagPill>
                                                    <TagPill>{formatRole(selectedUser.role)}</TagPill>
                                                </div>
                                                <p className="text-sm leading-7 workspace-heading">{selectedUser.supportSummary.recommendedAction}</p>
                                                <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3">
                                                    <StatTile label="Notes" value={selectedUser._count.entries} hint="Saved notes" />
                                                    <StatTile label="Groups" value={selectedUser._count.chapters} hint="Created note groups" />
                                                    <StatTile label="Sessions" value={selectedUser._count.refreshTokens} hint="Signed-in devices" />
                                                    <StatTile label="Connections" value={selectedUser.socialConnections.length} hint="Linked providers" />
                                                </div>
                                            </AppPanel>

                                            <AppPanel className="space-y-4">
                                                <SectionHeader kicker="Help Checklist" title="Troubleshooting checklist" description="Use this to see if the user is stuck on setup, activity, import, or access." />
                                                <div className="space-y-3">
                                                    {selectedUser.supportSummary.issues.map((issue) => (
                                                        <div key={issue.id} className="rounded-2xl workspace-soft-panel p-4">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <TagPill tone={issue.severity === 'action' ? 'primary' : issue.severity === 'watch' ? 'default' : 'muted'}>
                                                                    {issue.severity}
                                                                </TagPill>
                                                                <p className="text-sm font-semibold workspace-heading">{issue.title}</p>
                                                            </div>
                                                            <p className="mt-2 text-sm leading-6 text-ink-secondary">{issue.detail}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </AppPanel>

                                            <AppPanel className="space-y-4">
                                                <SectionHeader kicker="Recent Activity" title="Latest notes" description="Quick context for support without leaving this page." />
                                                <div className="space-y-3">
                                                    {selectedUser.recentEntries.length > 0 ? selectedUser.recentEntries.map((entry) => (
                                                        <div key={entry.id} className="rounded-2xl workspace-soft-panel p-4">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <TagPill tone="muted">{entry.source}</TagPill>
                                                                {entry.mood && <TagPill>{entry.mood}</TagPill>}
                                                                <span className="text-xs text-ink-muted">{formatDate(entry.createdAt)}</span>
                                                            </div>
                                                            <p className="mt-2 text-sm font-semibold workspace-heading">{entry.title || 'Untitled note'}</p>
                                                        </div>
                                                    )) : (
                                                        <p className="text-sm text-ink-secondary">No recent notes yet.</p>
                                                    )}
                                                </div>
                                            </AppPanel>
                                        </div>

                                        <div className="space-y-4">
                                            <AppPanel className="space-y-4">
                                                <SectionHeader kicker="User Access" title="Auth and session info" description="Authentication method, status, and session overview." />
                                                <div className="space-y-3 text-sm text-ink-secondary">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="rounded-2xl workspace-soft-panel p-4">
                                                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Auth method</p>
                                                            <p className="mt-2 workspace-heading">
                                                                {selectedUser.hasGoogle && selectedUser.hasPassword
                                                                    ? 'Google + Password'
                                                                    : selectedUser.hasGoogle
                                                                        ? 'Google SSO'
                                                                        : selectedUser.hasPassword
                                                                            ? 'Email / Password'
                                                                            : 'Unknown'}
                                                            </p>
                                                        </div>
                                                        <div className="rounded-2xl workspace-soft-panel p-4">
                                                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Status</p>
                                                            <p className="mt-2 workspace-heading">{selectedUser.isBanned ? 'Suspended' : 'Active'}</p>
                                                        </div>
                                                        <div className="rounded-2xl workspace-soft-panel p-4">
                                                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Active sessions</p>
                                                            <p className="mt-2 workspace-heading">{selectedUser._count.refreshTokens}</p>
                                                        </div>
                                                        <div className="rounded-2xl workspace-soft-panel p-4">
                                                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Joined</p>
                                                            <p className="mt-2 workspace-heading">{formatDate(selectedUser.createdAt)}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </AppPanel>

                                            <AppPanel className="space-y-4">
                                                <SectionHeader kicker="Admin Actions" title="Account controls" description="Super admins handle role changes. Admins can still review and manage normal user issues." />
                                                <div className="space-y-3">
                                                    {selectedUser.supportSummary.permissions.canChangeRole ? (
                                                        <div className="space-y-3 rounded-2xl workspace-soft-panel p-4">
                                                            <label className="block space-y-2">
                                                                <span className="text-xs uppercase tracking-[0.12em] text-ink-muted">Role</span>
                                                                <select
                                                                    value={roleDraft}
                                                                    onChange={(event) => {
                                                                        setRoleDraft(event.target.value as 'USER' | 'ADMIN' | 'SUPERADMIN');
                                                                        setPendingAction((current) => current?.type === 'role' ? null : current);
                                                                        setActionError('');
                                                                    }}
                                                                    disabled={selectedUser.id === user?.id}
                                                                    className="workspace-input w-full rounded-xl px-3 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                                                                >
                                                                    <option value="USER">User</option>
                                                                    <option value="ADMIN">Admin</option>
                                                                    {selectedUser.supportSummary.permissions.canGrantSuperAdmin && <option value="SUPERADMIN">Super Admin</option>}
                                                                </select>
                                                            </label>
                                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                                <p className="text-xs text-ink-secondary">
                                                                    Role changes now need a checked reason before you confirm.
                                                                </p>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => stageAdminAction({ type: 'role', label: 'Role change' })}
                                                                    disabled={!canStageRoleChange || isSubmittingAction}
                                                                    className="workspace-button-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                                                                >
                                                                    Review Role Change
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="rounded-2xl workspace-soft-panel p-4 text-sm text-ink-secondary">
                                                            Only super admins can change roles.
                                                        </div>
                                                    )}

                                                    {selectedUser.supportSummary.permissions.canBan ? (
                                                        <div className="grid gap-3">
                                                            <button
                                                                type="button"
                                                                onClick={() => stageAdminAction({ type: 'ban', label: selectedUser.isBanned ? 'Access restore' : 'Account suspension' })}
                                                                className="w-full rounded-xl workspace-button-outline px-4 py-3 text-sm font-semibold transition-colors"
                                                            >
                                                                Review {selectedUser.isBanned ? 'Restore Access' : 'Suspend Account'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => stageAdminAction({ type: 'revoke', label: 'Session revocation' })}
                                                                className="w-full rounded-xl workspace-button-outline px-4 py-3 text-sm font-semibold transition-colors"
                                                            >
                                                                Review Session Revoke
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="rounded-2xl workspace-soft-panel p-4 text-sm text-ink-secondary">
                                                            This account cannot be suspended by your current role.
                                                        </div>
                                                    )}

                                                    {(selectedUser.supportSummary.permissions.canChangeRole || selectedUser.supportSummary.permissions.canBan) && (
                                                        <div className="space-y-3 rounded-2xl workspace-soft-panel p-4">
                                                            <div>
                                                                <p className="text-sm font-semibold workspace-heading">Reason and note</p>
                                                                <p className="mt-1 text-xs text-ink-secondary">
                                                                    Add a reason for role changes, blocks, restores, and session resets. Notes are optional.
                                                                </p>
                                                            </div>
                                                            <label className="block space-y-2">
                                                                <span className="text-xs uppercase tracking-[0.12em] text-ink-muted">Reason</span>
                                                                <textarea
                                                                    value={actionReason}
                                                                    onChange={(event) => setActionReason(event.target.value)}
                                                                    rows={3}
                                                                    className="workspace-input w-full rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/35"
                                                                    placeholder="Say why this action is needed."
                                                                />
                                                                <p className={`text-xs ${actionReasonLength >= 8 ? 'text-ink-secondary' : 'text-primary'}`}>
                                                                    {actionReasonLength >= 8 ? 'Reason ready for confirmation.' : `${Math.max(0, 8 - actionReasonLength)} more characters needed.`}
                                                                </p>
                                                            </label>
                                                            <label className="block space-y-2">
                                                                <span className="text-xs uppercase tracking-[0.12em] text-ink-muted">Operator Note</span>
                                                                <textarea
                                                                    value={supportNote}
                                                                    onChange={(event) => setSupportNote(event.target.value)}
                                                                    rows={2}
                                                                    className="workspace-input w-full rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/35"
                                                                    placeholder="Optional note for other admins later."
                                                                />
                                                            </label>
                                                        </div>
                                                    )}

                                                    {pendingAction && (
                                                        <div className="space-y-3 rounded-2xl border border-primary/25 bg-primary/10 p-4">
                                                            <div>
                                                                <p className="text-sm font-semibold workspace-heading">Review before confirming</p>
                                                                <p className="mt-1 text-sm text-ink-secondary">{pendingActionSummary}</p>
                                                            </div>
                                                            <div className="space-y-1 text-xs text-ink-muted">
                                                                <p>Target: {selectedUser.email}</p>
                                                                <p>Action: {pendingAction.label}</p>
                                                                {pendingAction.type === 'role' && <p>New role: {formatRole(roleDraft)}</p>}
                                                            </div>
                                                            <div className="flex flex-wrap gap-3">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => void executePendingAction()}
                                                                    disabled={isSubmittingAction}
                                                                    className="rounded-xl workspace-button-outline px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                                                                >
                                                                    {isSubmittingAction ? 'Saving...' : `Confirm ${pendingAction.label}`}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setPendingAction(null);
                                                                        setActionError('');
                                                                    }}
                                                                    disabled={isSubmittingAction}
                                                                    className="rounded-xl border border-ink-muted/20 px-4 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:text-[rgb(var(--text-primary))] disabled:cursor-not-allowed disabled:opacity-50"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </AppPanel>

                                            {selectedUser.supportSummary.permissions.canDelete && selectedUser.role !== 'SUPERADMIN' && selectedUser.id !== user?.id && (
                                                <AppPanel className="space-y-4">
                                                    <SectionHeader kicker="Danger Zone" title="Delete account" description="Permanently remove this account and all data. This cannot be undone." />
                                                    <div className="space-y-3 rounded-2xl border border-red-300/40 bg-red-50/30 p-4">
                                                        <p className="text-sm text-ink-secondary">
                                                            Type <strong>{selectedUser.email}</strong> to confirm deletion.
                                                        </p>
                                                        <input
                                                            type="text"
                                                            value={deleteConfirmEmail}
                                                            onChange={(event) => setDeleteConfirmEmail(event.target.value)}
                                                            placeholder={selectedUser.email}
                                                            className="workspace-input w-full rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/35"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => stageAdminAction({ type: 'delete', label: 'Account deletion' })}
                                                            disabled={deleteConfirmEmail.trim().toLowerCase() !== selectedUser.email.toLowerCase() || isSubmittingAction}
                                                            className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                                                        >
                                                            Review Account Deletion
                                                        </button>
                                                    </div>
                                                </AppPanel>
                                            )}

                                            <AppPanel className="space-y-4">
                                                <SectionHeader kicker="Identity" title="Account info" description="Helpful for login, setup, and import questions." />
                                                <div className="space-y-3 text-sm text-ink-secondary">
                                                    <div className="rounded-2xl workspace-soft-panel p-4">
                                                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Created</p>
                                                        <p className="mt-2 workspace-heading">{formatDate(selectedUser.createdAt)}</p>
                                                    </div>
                                                    <div className="rounded-2xl workspace-soft-panel p-4">
                                                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Profile</p>
                                                        <p className="mt-2 workspace-heading">{selectedUser.profile?.occupation || 'Occupation not set'}</p>
                                                        <p className="mt-1">{selectedUser.profile?.location || 'Location not set'}</p>
                                                    </div>
                                                    <div className="rounded-2xl workspace-soft-panel p-4">
                                                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Connections</p>
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            {selectedUser.socialConnections.length > 0 ? selectedUser.socialConnections.map((connection) => (
                                                                <TagPill key={`${selectedUser.id}-${connection.provider}`}>
                                                                    {connection.provider}
                                                                </TagPill>
                                                            )) : <span className="workspace-heading">No linked providers</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </AppPanel>

                                            <AppPanel className="space-y-4">
                                                <SectionHeader
                                                    kicker="Retrieval Debug"
                                                    title="Search stack inspector"
                                                    description="Run a query against this user's notes and see which embedding model and reranker path shaped the results."
                                                />
                                                <div className="space-y-3">
                                                    <div className="flex flex-col gap-3">
                                                        <input
                                                            type="text"
                                                            value={retrievalQuery}
                                                            onChange={(event) => setRetrievalQuery(event.target.value)}
                                                            placeholder="Try: grieving after losing a pet"
                                                            className="workspace-input w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/35"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => void runRetrievalDebug()}
                                                            disabled={isRetrievalDebugLoading}
                                                            className="workspace-button-primary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            <FiSearch size={16} aria-hidden="true" />
                                                            {isRetrievalDebugLoading ? 'Inspecting...' : 'Run Retrieval Debug'}
                                                        </button>
                                                    </div>

                                                    {retrievalDebugError && (
                                                        <div className="rounded-2xl workspace-soft-panel px-4 py-3 text-sm workspace-heading">
                                                            {retrievalDebugError}
                                                        </div>
                                                    )}

                                                    {retrievalDebug && (
                                                        <div className="space-y-3">
                                                            <div className="rounded-2xl workspace-soft-panel p-4">
                                                                <div className="flex flex-wrap gap-2">
                                                                    <TagPill tone="primary">{retrievalDebug.searchMode}</TagPill>
                                                                    <TagPill>{retrievalDebug.debug.embeddingProvider}</TagPill>
                                                                    <TagPill>{retrievalDebug.debug.embeddingModel}</TagPill>
                                                                    <TagPill>{retrievalDebug.debug.embeddingDimensions} dims</TagPill>
                                                                    <TagPill tone={retrievalDebug.debug.rerankerUsed ? 'primary' : 'muted'}>
                                                                        {retrievalDebug.debug.rerankerUsed ? 'Reranker used' : retrievalDebug.debug.rerankerConfigured ? 'Reranker idle' : 'No reranker'}
                                                                    </TagPill>
                                                                </div>
                                                                <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-3 text-xs text-ink-secondary">
                                                                    <div className="rounded-xl workspace-muted-panel px-3 py-2">
                                                                        <p className="uppercase tracking-[0.12em] text-ink-muted">Lexical</p>
                                                                        <p className="mt-1 workspace-heading">{retrievalDebug.debug.candidateCounts.lexical}</p>
                                                                    </div>
                                                                    <div className="rounded-xl workspace-muted-panel px-3 py-2">
                                                                        <p className="uppercase tracking-[0.12em] text-ink-muted">Dense</p>
                                                                        <p className="mt-1 workspace-heading">{retrievalDebug.debug.candidateCounts.dense}</p>
                                                                    </div>
                                                                    <div className="rounded-xl workspace-muted-panel px-3 py-2">
                                                                        <p className="uppercase tracking-[0.12em] text-ink-muted">Rerank Pool</p>
                                                                        <p className="mt-1 workspace-heading">{retrievalDebug.debug.candidateCounts.rerankPool}</p>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="space-y-3">
                                                                {retrievalDebug.results.map((result) => (
                                                                    <div key={result.id} className="rounded-2xl workspace-soft-panel p-4">
                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                            <TagPill tone="primary">{result.strategy}</TagPill>
                                                                            <TagPill>{Math.round(result.relevance * 100)}%</TagPill>
                                                                            <TagPill>{result.debug.embeddingModel}</TagPill>
                                                                            <TagPill tone={result.debug.rerankerUsed ? 'primary' : 'muted'}>
                                                                                {result.debug.rerankerUsed ? 'Reranked' : 'Not reranked'}
                                                                            </TagPill>
                                                                        </div>
                                                                        <p className="mt-3 text-sm font-semibold workspace-heading">{result.title || 'Untitled note'}</p>
                                                                        <p className="mt-2 text-sm leading-6 text-ink-secondary">{result.content}</p>
                                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                                            <TagPill tone="muted">Lexical {result.lexicalScore.toFixed(2)}</TagPill>
                                                                            <TagPill tone="muted">Dense {result.semanticScore.toFixed(2)}</TagPill>
                                                                            <TagPill tone="muted">Rerank {result.rerankScore.toFixed(2)}</TagPill>
                                                                            {result.matchReasons.map((reason) => (
                                                                                <TagPill key={`${result.id}-${reason}`}>{reason}</TagPill>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </AppPanel>

                                            <AppPanel className="space-y-4">
                                                <SectionHeader kicker="Recent App Activity" title="Telemetry trail" description="Helpful when a user says something broke but the issue may be the flow." />
                                                <div className="space-y-3">
                                                    {selectedUser.recentTelemetry.length > 0 ? selectedUser.recentTelemetry.map((event) => (
                                                        <div key={`${event.eventType}-${event.occurredAt}`} className="rounded-2xl workspace-soft-panel p-4">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <TagPill tone="muted">{event.eventType}</TagPill>
                                                                <span className="text-xs text-ink-muted">{formatDate(event.occurredAt)}</span>
                                                            </div>
                                                            {event.pathname && <p className="mt-2 text-sm workspace-heading">{event.pathname}</p>}
                                                            {event.field && <p className="mt-1 text-xs text-ink-secondary">Field: {event.field}</p>}
                                                        </div>
                                                    )) : (
                                                        <p className="text-sm text-ink-secondary">No recent app activity for this user yet.</p>
                                                    )}
                                                </div>
                                            </AppPanel>

                                            <AppPanel className="space-y-4">
                                                <SectionHeader kicker="Admin History" title="Admin actions" description="Recent admin changes on this account." />
                                                <div className="space-y-3">
                                                    {selectedUser.recentAdminActions.length > 0 ? selectedUser.recentAdminActions.map((action) => (
                                                        <div key={`${action.eventType}-${action.occurredAt}`} className="rounded-2xl workspace-soft-panel p-4">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <TagPill tone="muted">{action.eventType.replace('ADMIN_', '').replaceAll('_', ' ')}</TagPill>
                                                                <span className="text-xs text-ink-muted">{formatDate(action.occurredAt)}</span>
                                                            </div>
                                                            {action.value && <p className="mt-2 text-sm workspace-heading">Value: {action.value}</p>}
                                                            {action.field && <p className="mt-1 text-xs text-ink-secondary">Field: {action.field}</p>}
                                                            {getAuditMetadataText(action.metadata, 'reason') && (
                                                                <p className="mt-2 text-sm workspace-heading">Reason: {getAuditMetadataText(action.metadata, 'reason')}</p>
                                                            )}
                                                            {getAuditMetadataText(action.metadata, 'supportNote') && (
                                                                <p className="mt-1 text-xs text-ink-secondary">Note: {getAuditMetadataText(action.metadata, 'supportNote')}</p>
                                                            )}
                                                        </div>
                                                    )) : (
                                                        <p className="text-sm text-ink-secondary">No admin actions recorded for this user yet.</p>
                                                    )}
                                                </div>
                                            </AppPanel>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
