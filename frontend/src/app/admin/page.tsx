'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import useApi from '@/hooks/use-api';
import { ActionBar, AppPanel, EmptyState, SectionHeader, StatTile, TagPill } from '@/components/ui/surface';
import { FiAlertCircle, FiLock, FiShield, FiX } from 'react-icons/fi';

type TrackFilter = 'all' | 'personal' | 'professional' | 'blended' | 'unknown';
type StageFilter = 'all' | 'not_started' | 'in_progress' | 'completed';
type RoleFilter = 'all' | 'USER' | 'ADMIN' | 'SUPERADMIN';
type AdminActionType = 'role' | 'ban' | 'revoke';

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

type SupportIssue = {
    id: string;
    severity: 'healthy' | 'watch' | 'action';
    title: string;
    detail: string;
};

type UserDetail = User & {
    avatarUrl?: string | null;
    googleId?: string | null;
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
            <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-ink-muted">
                <span>{label}</span>
                <span className="text-white">{value}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
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
                throw new Error('Failed to fetch users');
            }

            const data = await response.json();
            setUsers(data.users || []);
            setEvidenceSummary(data.evidenceSummary || null);
            setTotalPages(data.pagination?.totalPages || 1);
            setScanLimitReached(Boolean(data.filters?.scanLimitReached));
        } catch (err: any) {
            setError(err.message || 'Failed to fetch users');
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

    useEffect(() => {
        if (user && !authLoading) {
            Promise.all([fetchUsers(), fetchStats()]).finally(() => setIsLoading(false));
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
            if (!response.ok) throw new Error(data.message || 'Failed to fetch user details');
            setSelectedUser(data.user as UserDetail);
            setRoleDraft((data.user as UserDetail).role);
            resetActionDrafts();
        } catch (err: any) {
            setDetailError(err.message || 'Failed to fetch user details');
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
        resetActionDrafts();
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
            } else {
                response = await apiFetch(`/admin/users/${selectedUser.id}/revoke-sessions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reason: trimmedReason,
                        supportNote: trimmedSupportNote || undefined,
                    }),
                });
            }

            const data = await response.json().catch(() => null);
            if (!response.ok) throw new Error(data?.message || 'Failed to complete admin action');

            setDetailNotice(data?.message || `${pendingAction.label} completed`);
            resetActionDrafts();
            void fetchUsers();
            void fetchUserDetails(selectedUser.id);
        } catch (err: any) {
            setActionError(err.message || 'Failed to complete admin action');
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
                : 'Remove all active refresh sessions so the user must sign in again on every device.'
        : null;

    if (authLoading || isLoading) {
        return <div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
    }

    if (error === 'Admin access required') {
        return (
            <div className="min-h-screen px-4 py-10">
                <div className="mx-auto max-w-2xl">
                    <AppPanel className="space-y-5 text-center">
                        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] border border-white/15 bg-white/[0.03]">
                            <FiLock size={32} className="text-white" aria-hidden="true" />
                        </div>
                        <SectionHeader kicker="Admin" title="Access denied" description="You need admin privileges to open moderation and health controls." className="justify-center text-center" />
                        <div className="flex justify-center">
                            <Link href="/dashboard" className="rounded-xl border border-primary/30 bg-primary/15 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/25">Go to Dashboard</Link>
                        </div>
                    </AppPanel>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen px-4 py-6 pb-24 md:px-8 md:py-8">
            <div className="mx-auto max-w-6xl space-y-6">
                <AppPanel className="space-y-5">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                        <SectionHeader kicker="Admin" title="User Operations" description="Monitor user health, spot support risk, and moderate accounts with the same workspace shell used across the rest of the product." />
                        <ActionBar className="overflow-x-auto border-white/10 bg-black/20">
                            <TagPill tone="primary" className="gap-1.5"><FiShield size={12} aria-hidden="true" />Moderation</TagPill>
                            <TagPill tone="muted">Active filters {activeFilterCount}</TagPill>
                            <TagPill tone="muted">Results {users.length}</TagPill>
                            {onlyNeedsSupport && <TagPill>Support queue &lt;= {completionLte}%</TagPill>}
                            <Link href="/profile" className="rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:text-white">Profile</Link>
                        </ActionBar>
                    </div>
                    {stats && (
                        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
                            <StatTile label="Users" value={stats.totalUsers} hint="Total accounts" tone="primary" />
                            <StatTile label="Entries" value={stats.totalEntries} hint="Archive volume" />
                            <StatTile label="New This Week" value={stats.newUsersThisWeek} hint="Fresh signups" />
                            <StatTile label="Active Today" value={stats.activeUsersToday} hint="Daily engagement" />
                            {isSuperAdmin && <StatTile label="Admins" value={stats.adminUsers} hint="Support operators" />}
                            <StatTile label="Banned" value={stats.bannedUsers} hint={isSuperAdmin ? `${stats.superAdmins} super admin${stats.superAdmins === 1 ? '' : 's'}` : 'Suspended accounts'} />
                        </div>
                    )}
                </AppPanel>

                <AppPanel className="space-y-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <SectionHeader kicker="Filters" title="Prioritize the right users" description="Search by identity, then narrow by track, onboarding stage, and completion risk." />
                        <ActionBar className="border-white/10 bg-black/20">
                            <TagPill tone="muted">Page {page} of {totalPages}</TagPill>
                            <button type="button" onClick={clearFilters} className="rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:text-white">Clear Filters</button>
                        </ActionBar>
                    </div>

                    <form onSubmit={onSearchSubmit} className="flex flex-col gap-3 md:flex-row">
                        <input type="text" placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-primary/35" />
                        <button type="submit" className="rounded-xl border border-primary/30 bg-primary/15 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/25">Search</button>
                    </form>

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_320px]">
                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Track</p>
                            <ActionBar className="border-white/10 bg-black/20">
                                {TRACK_OPTIONS.map((item) => (
                                    <button key={item.id} type="button" onClick={() => { setTrackFilter(item.id); setPage(1); }} className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${trackFilter === item.id ? 'bg-primary/15 text-primary' : 'text-ink-secondary hover:text-white'}`}>{item.label}</button>
                                ))}
                            </ActionBar>
                        </div>
                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Stage</p>
                            <ActionBar className="border-white/10 bg-black/20">
                                {STAGE_OPTIONS.map((item) => (
                                    <button key={item.id} type="button" onClick={() => { setStageFilter(item.id); setPage(1); }} className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${stageFilter === item.id ? 'bg-primary/15 text-primary' : 'text-ink-secondary hover:text-white'}`}>{item.label}</button>
                                ))}
                            </ActionBar>
                        </div>
                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Role</p>
                            <ActionBar className="border-white/10 bg-black/20">
                                {visibleRoleOptions.map((item) => (
                                    <button key={item.id} type="button" onClick={() => { setRoleFilter(item.id); setPage(1); }} className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${roleFilter === item.id ? 'bg-primary/15 text-primary' : 'text-ink-secondary hover:text-white'}`}>{item.label}</button>
                                ))}
                            </ActionBar>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold text-white">Needs support focus</p>
                                    <p className="mt-1 text-xs text-ink-secondary">Prioritize users at or below a completion threshold.</p>
                                </div>
                                <button type="button" onClick={() => { setOnlyNeedsSupport((prev) => !prev); setPage(1); }} className={`relative h-7 w-12 rounded-full border transition-colors ${onlyNeedsSupport ? 'border-primary/35 bg-primary/15' : 'border-white/15 bg-white/[0.03]'}`} aria-pressed={onlyNeedsSupport}>
                                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${onlyNeedsSupport ? 'left-6' : 'left-1'}`} />
                                </button>
                            </div>
                            {onlyNeedsSupport && (
                                <div className="mt-4">
                                    <div className="mb-2 flex items-center justify-between text-xs text-ink-secondary"><span>Completion ceiling</span><span>{completionLte}%</span></div>
                                    <input type="range" min={0} max={100} step={5} value={completionLte} onChange={(event) => { setCompletionLte(Number(event.target.value)); setPage(1); }} className="w-full accent-primary" />
                                </div>
                            )}
                        </div>
                    </div>

                    {scanLimitReached && (
                        <div className="flex items-start gap-3 rounded-2xl border border-white/12 bg-white/[0.03] p-4 text-sm text-white">
                            <FiAlertCircle size={18} className="mt-0.5 text-white" aria-hidden="true" />
                            <p>Showing filtered results from the most recent 5000 users. Refine filters or search for tighter targeting.</p>
                        </div>
                    )}
                </AppPanel>

                {evidenceSummary && (
                    <AppPanel tone="accent" className="space-y-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <SectionHeader kicker="Evidence" title="Readiness snapshot" description="See how much of the current page can move from raw experience into verification and export." />
                            <TagPill tone="primary">Avg completeness {evidenceSummary.averageCompletenessScore}%</TagPill>
                        </div>
                        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
                            <StatTile label="Users Scored" value={evidenceSummary.userCount} hint="Current result page" />
                            <StatTile label="With Entries" value={evidenceSummary.usersWithEntries} hint="Users with journal volume" />
                            <StatTile label="Verify Ready" value={evidenceSummary.usersReadyForVerification} hint="Ready for review" />
                            <StatTile label="Export Ready" value={evidenceSummary.usersReadyForExport} hint="Pack-ready evidence" tone="primary" />
                        </div>
                    </AppPanel>
                )}

                {users.length === 0 ? (
                    <EmptyState title="No users match this view" description="Adjust filters or search to widen the admin queue." actionLabel="Open Admin" actionHref="/admin" />
                ) : (
                    <AppPanel className="overflow-hidden p-0">
                        <div className="border-b border-white/10 px-5 py-5 md:px-6">
                            <SectionHeader kicker="Directory" title="User queue" description="Review activity, profile readiness, evidence quality, and moderation actions from one table." />
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead className="bg-white/[0.03]">
                                    <tr>
                                        <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">User</th>
                                        <th className="hidden px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted md:table-cell">Entries</th>
                                        <th className="hidden px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted md:table-cell">Role</th>
                                        <th className="hidden px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted lg:table-cell">Profile</th>
                                        <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Status</th>
                                        <th className="px-4 py-4 text-right text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((currentUser) => (
                                        <tr key={currentUser.id} className="border-t border-white/8 align-top transition-colors hover:bg-white/[0.03]">
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/70 to-secondary/70 text-sm font-semibold text-white">{currentUser.name?.charAt(0) || currentUser.email.charAt(0)}</div>
                                                    <div className="space-y-1">
                                                        <p className="text-sm font-semibold text-white">{currentUser.name || 'No name'}</p>
                                                        <p className="text-sm text-ink-secondary">{currentUser.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="hidden px-4 py-4 text-sm text-white md:table-cell">{currentUser._count.entries}</td>
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
                                                        <MetricBar label="Professional" value={currentUser.profileContext.professionalReadinessScore} gradient="linear-gradient(90deg, rgba(248,113,113,0.7), rgba(252,165,165,0.7))" />
                                                        <MetricBar label="Evidence" value={currentUser.evidenceRollup.averageCompletenessScore} gradient="linear-gradient(90deg, rgba(245,158,11,0.75), rgba(251,191,36,0.75))" />
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <TagPill tone="muted">Verify {currentUser.evidenceRollup.readyForVerificationCount}/{currentUser.evidenceRollup.totalExperiences}</TagPill>
                                                        <TagPill tone="muted">Export {currentUser.evidenceRollup.readyForExportCount}/{currentUser.evidenceRollup.totalExperiences}</TagPill>
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
                    <ActionBar className="justify-center border-white/10 bg-black/20">
                        <button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="rounded-xl px-4 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
                        <TagPill tone="muted">Page {page} of {totalPages}</TagPill>
                        <button onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="rounded-xl px-4 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50">Next</button>
                    </ActionBar>
                )}

                {selectedUserId && (
                    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm md:items-center">
                        <div className="w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 bg-surface-1 shadow-2xl shadow-black/30">
                            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 md:px-6">
                                <SectionHeader
                                    kicker="Support Review"
                                    title={selectedUser?.name || selectedUser?.email || 'User details'}
                                    description={selectedUser ? `${selectedUser.email} · ${formatRole(selectedUser.role)}` : 'Loading account context'}
                                />
                                <button
                                    type="button"
                                    onClick={closeDetail}
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/12 bg-white/[0.03] text-ink-secondary transition-colors hover:text-white"
                                    aria-label="Close user detail"
                                >
                                    <FiX size={18} aria-hidden="true" />
                                </button>
                            </div>

                            {isDetailLoading ? (
                                <div className="flex min-h-[240px] items-center justify-center">
                                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                                </div>
                            ) : detailError ? (
                                <div className="px-5 py-8 md:px-6">
                                    <AppPanel className="text-center">
                                        <p className="text-sm text-white">{detailError}</p>
                                    </AppPanel>
                                </div>
                            ) : selectedUser ? (
                                <div className="max-h-[78vh] overflow-y-auto px-5 py-5 md:px-6">
                                    {detailNotice && (
                                        <div className="mb-4 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-white">
                                            {detailNotice}
                                        </div>
                                    )}
                                    {actionError && (
                                        <div className="mb-4 rounded-2xl border border-white/12 bg-white/[0.03] px-4 py-3 text-sm text-white">
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
                                                <p className="text-sm leading-7 text-white">{selectedUser.supportSummary.recommendedAction}</p>
                                                <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3">
                                                    <StatTile label="Entries" value={selectedUser._count.entries} hint="Captured moments" />
                                                    <StatTile label="Chapters" value={selectedUser._count.chapters} hint="Collections" />
                                                    <StatTile label="Sessions" value={selectedUser._count.refreshTokens} hint="Active refresh tokens" />
                                                    <StatTile label="Connections" value={selectedUser.socialConnections.length} hint="Linked providers" />
                                                </div>
                                            </AppPanel>

                                            <AppPanel className="space-y-4">
                                                <SectionHeader kicker="Support Signals" title="Troubleshooting checklist" description="Use these to identify whether the user is blocked by setup, activity, imports, or moderation." />
                                                <div className="space-y-3">
                                                    {selectedUser.supportSummary.issues.map((issue) => (
                                                        <div key={issue.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <TagPill tone={issue.severity === 'action' ? 'primary' : issue.severity === 'watch' ? 'default' : 'muted'}>
                                                                    {issue.severity}
                                                                </TagPill>
                                                                <p className="text-sm font-semibold text-white">{issue.title}</p>
                                                            </div>
                                                            <p className="mt-2 text-sm leading-6 text-ink-secondary">{issue.detail}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </AppPanel>

                                            <AppPanel className="space-y-4">
                                                <SectionHeader kicker="Recent Activity" title="Latest entries" description="Quick context for support issues without leaving the admin workspace." />
                                                <div className="space-y-3">
                                                    {selectedUser.recentEntries.length > 0 ? selectedUser.recentEntries.map((entry) => (
                                                        <div key={entry.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <TagPill tone="muted">{entry.source}</TagPill>
                                                                {entry.mood && <TagPill>{entry.mood}</TagPill>}
                                                                <span className="text-xs text-ink-muted">{formatDate(entry.createdAt)}</span>
                                                            </div>
                                                            <p className="mt-2 text-sm font-semibold text-white">{entry.title || 'Untitled entry'}</p>
                                                        </div>
                                                    )) : (
                                                        <p className="text-sm text-ink-secondary">No recent entries yet.</p>
                                                    )}
                                                </div>
                                            </AppPanel>
                                        </div>

                                        <div className="space-y-4">
                                            <AppPanel className="space-y-4">
                                                <SectionHeader kicker="Admin Actions" title="Role-safe controls" description="Super admins handle role changes. Admins can still review and moderate ordinary user issues." />
                                                <div className="space-y-3">
                                                    {selectedUser.supportSummary.permissions.canChangeRole ? (
                                                        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
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
                                                                    className="w-full rounded-xl border border-white/12 bg-black/20 px-3 py-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                                                                >
                                                                    <option value="USER">User</option>
                                                                    <option value="ADMIN">Admin</option>
                                                                    {selectedUser.supportSummary.permissions.canGrantSuperAdmin && <option value="SUPERADMIN">Super Admin</option>}
                                                                </select>
                                                            </label>
                                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                                <p className="text-xs text-ink-secondary">
                                                                    Role changes now require a reviewed confirmation and support reason.
                                                                </p>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => stageAdminAction({ type: 'role', label: 'Role change' })}
                                                                    disabled={!canStageRoleChange || isSubmittingAction}
                                                                    className="rounded-xl border border-primary/25 bg-primary/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                                                                >
                                                                    Review Role Change
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-ink-secondary">
                                                            Role changes are restricted to super admins.
                                                        </div>
                                                    )}

                                                    {selectedUser.supportSummary.permissions.canBan ? (
                                                        <div className="grid gap-3">
                                                            <button
                                                                type="button"
                                                                onClick={() => stageAdminAction({ type: 'ban', label: selectedUser.isBanned ? 'Access restore' : 'Account suspension' })}
                                                                className="w-full rounded-xl border border-white/12 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                                                            >
                                                                Review {selectedUser.isBanned ? 'Restore Access' : 'Suspend Account'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => stageAdminAction({ type: 'revoke', label: 'Session revocation' })}
                                                                className="w-full rounded-xl border border-white/12 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                                                            >
                                                                Review Session Revoke
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-ink-secondary">
                                                            This account cannot be suspended by your current role.
                                                        </div>
                                                    )}

                                                    {(selectedUser.supportSummary.permissions.canChangeRole || selectedUser.supportSummary.permissions.canBan) && (
                                                        <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                                                            <div>
                                                                <p className="text-sm font-semibold text-white">Support reason and operator note</p>
                                                                <p className="mt-1 text-xs text-ink-secondary">
                                                                    Reasons are required for role changes, suspensions, restores, and session revocations. Notes are optional context for later review.
                                                                </p>
                                                            </div>
                                                            <label className="block space-y-2">
                                                                <span className="text-xs uppercase tracking-[0.12em] text-ink-muted">Reason</span>
                                                                <textarea
                                                                    value={actionReason}
                                                                    onChange={(event) => setActionReason(event.target.value)}
                                                                    rows={3}
                                                                    className="w-full rounded-xl border border-white/12 bg-white/[0.03] px-3 py-3 text-sm text-white placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-primary/35"
                                                                    placeholder="Summarize why this action is needed for support, security, or policy."
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
                                                                    className="w-full rounded-xl border border-white/12 bg-white/[0.03] px-3 py-3 text-sm text-white placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-primary/35"
                                                                    placeholder="Optional note for other admins or future support follow-up."
                                                                />
                                                            </label>
                                                        </div>
                                                    )}

                                                    {pendingAction && (
                                                        <div className="space-y-3 rounded-2xl border border-primary/25 bg-primary/10 p-4">
                                                            <div>
                                                                <p className="text-sm font-semibold text-white">Review before confirming</p>
                                                                <p className="mt-1 text-sm text-white/80">{pendingActionSummary}</p>
                                                            </div>
                                                            <div className="space-y-1 text-xs text-white/75">
                                                                <p>Target: {selectedUser.email}</p>
                                                                <p>Action: {pendingAction.label}</p>
                                                                {pendingAction.type === 'role' && <p>New role: {formatRole(roleDraft)}</p>}
                                                            </div>
                                                            <div className="flex flex-wrap gap-3">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => void executePendingAction()}
                                                                    disabled={isSubmittingAction}
                                                                    className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
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
                                                                    className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </AppPanel>

                                            <AppPanel className="space-y-4">
                                                <SectionHeader kicker="Identity" title="Account context" description="Useful for debugging login, onboarding, and import questions." />
                                                <div className="space-y-3 text-sm text-ink-secondary">
                                                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Created</p>
                                                        <p className="mt-2 text-white">{formatDate(selectedUser.createdAt)}</p>
                                                    </div>
                                                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Profile</p>
                                                        <p className="mt-2 text-white">{selectedUser.profile?.occupation || 'Occupation not set'}</p>
                                                        <p className="mt-1">{selectedUser.profile?.location || 'Location not set'}</p>
                                                    </div>
                                                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Connections</p>
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            {selectedUser.socialConnections.length > 0 ? selectedUser.socialConnections.map((connection) => (
                                                                <TagPill key={`${selectedUser.id}-${connection.provider}`}>
                                                                    {connection.provider}
                                                                </TagPill>
                                                            )) : <span className="text-white">No linked providers</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </AppPanel>

                                            <AppPanel className="space-y-4">
                                                <SectionHeader kicker="Recent Signals" title="Telemetry trail" description="Helpful when the user says something broke but the issue is actually flow-related." />
                                                <div className="space-y-3">
                                                    {selectedUser.recentTelemetry.length > 0 ? selectedUser.recentTelemetry.map((event) => (
                                                        <div key={`${event.eventType}-${event.occurredAt}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <TagPill tone="muted">{event.eventType}</TagPill>
                                                                <span className="text-xs text-ink-muted">{formatDate(event.occurredAt)}</span>
                                                            </div>
                                                            {event.pathname && <p className="mt-2 text-sm text-white">{event.pathname}</p>}
                                                            {event.field && <p className="mt-1 text-xs text-ink-secondary">Field: {event.field}</p>}
                                                        </div>
                                                    )) : (
                                                        <p className="text-sm text-ink-secondary">No recent telemetry for this user yet.</p>
                                                    )}
                                                </div>
                                            </AppPanel>

                                            <AppPanel className="space-y-4">
                                                <SectionHeader kicker="Audit Trail" title="Admin actions" description="Recent privileged actions against this account for support and compliance review." />
                                                <div className="space-y-3">
                                                    {selectedUser.recentAdminActions.length > 0 ? selectedUser.recentAdminActions.map((action) => (
                                                        <div key={`${action.eventType}-${action.occurredAt}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <TagPill tone="muted">{action.eventType.replace('ADMIN_', '').replaceAll('_', ' ')}</TagPill>
                                                                <span className="text-xs text-ink-muted">{formatDate(action.occurredAt)}</span>
                                                            </div>
                                                            {action.value && <p className="mt-2 text-sm text-white">Value: {action.value}</p>}
                                                            {action.field && <p className="mt-1 text-xs text-ink-secondary">Field: {action.field}</p>}
                                                            {getAuditMetadataText(action.metadata, 'reason') && (
                                                                <p className="mt-2 text-sm text-white">Reason: {getAuditMetadataText(action.metadata, 'reason')}</p>
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
