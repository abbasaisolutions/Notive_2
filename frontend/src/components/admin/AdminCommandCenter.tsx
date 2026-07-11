'use client';

import { AppPanel, SectionHeader, StatTile, TagPill } from '@/components/ui/surface';

export type AdminCommandCenterData = {
    generatedAt: string;
    activation: {
        newUsers7d: number;
        firstMemoryUsers7d: number;
        firstMemoryRate7d: number;
        activeNewUsers7d: number;
    };
    engagementLeader: {
        id: string;
        name: string | null;
        email: string;
        entries30d: number;
        lastMemoryAt: string | null;
    } | null;
    recentSignups: Array<{
        id: string;
        name: string | null;
        email: string;
        createdAt: string;
        entryCount: number;
        state: 'activated' | 'needs_first_memory';
    }>;
    joinAlerts: {
        unreadCount: number;
        items: Array<{ id: string; title: string; body: string | null; createdAt: string; readAt: string | null }>;
    };
};

const formatWhen = (value: string) => new Date(value).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});

export default function AdminCommandCenter({
    data,
    onReviewUser,
}: {
    data: AdminCommandCenterData;
    onReviewUser: (userId: string) => void;
}) {
    const leader = data.engagementLeader;

    return (
        <AppPanel className="space-y-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <SectionHeader
                    kicker="Command center"
                    title="The next few decisions"
                    description="A private operating view of new-user activation and meaningful writing activity. It never exposes memory content."
                />
                <div className="flex flex-wrap gap-2">
                    {data.joinAlerts.unreadCount > 0 && <TagPill tone="primary">{data.joinAlerts.unreadCount} new join alert{data.joinAlerts.unreadCount === 1 ? '' : 's'}</TagPill>}
                    <TagPill tone="muted">Updated {formatWhen(data.generatedAt)}</TagPill>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatTile label="New users" value={data.activation.newUsers7d} hint="Joined in the last 7 days" />
                <StatTile label="First memory" value={`${data.activation.firstMemoryRate7d}%`} hint={`${data.activation.firstMemoryUsers7d} new users captured a memory`} tone="primary" />
                <StatTile label="Active new users" value={data.activation.activeNewUsers7d} hint="New users who wrote this week" />
                <StatTile label="Join alerts" value={data.joinAlerts.unreadCount} hint="Unread admin-only notifications" />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.05fr_1.45fr]">
                <div className="rounded-2xl workspace-soft-panel p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Engagement signal</p>
                    {leader ? (
                        <div className="mt-3">
                            <p className="text-lg font-semibold workspace-heading">{leader.name || leader.email}</p>
                            <p className="mt-1 text-sm text-ink-secondary">{leader.entries30d} saved memories in 30 days</p>
                            <p className="mt-2 text-xs leading-5 text-ink-muted">This is a health signal, not a leaderboard—use it to learn what sustained use looks like.</p>
                            <button type="button" onClick={() => onReviewUser(leader.id)} className="mt-3 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/20">
                                Review account signals
                            </button>
                        </div>
                    ) : (
                        <p className="mt-3 text-sm leading-6 text-ink-secondary">No one has saved a memory in the last 30 days yet.</p>
                    )}
                </div>

                <div className="rounded-2xl workspace-soft-panel p-4">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Newest users</p>
                        <p className="text-xs text-ink-muted">First-memory status</p>
                    </div>
                    <div className="mt-3 divide-y divide-ink-muted/10">
                        {data.recentSignups.length === 0 ? (
                            <p className="py-3 text-sm text-ink-secondary">No new users in the last 7 days.</p>
                        ) : data.recentSignups.map((user) => (
                            <div key={user.id} className="flex items-center gap-3 py-3">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold workspace-heading">{user.name || user.email}</p>
                                    <p className="truncate text-xs text-ink-muted">{user.entryCount} memor{user.entryCount === 1 ? 'y' : 'ies'} · joined {formatWhen(user.createdAt)}</p>
                                </div>
                                <TagPill tone={user.state === 'activated' ? 'primary' : 'muted'}>{user.state === 'activated' ? 'Activated' : 'Needs first memory'}</TagPill>
                                <button type="button" onClick={() => onReviewUser(user.id)} className="text-xs font-semibold text-primary hover:underline">Review</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </AppPanel>
    );
}
