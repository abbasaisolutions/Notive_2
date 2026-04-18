'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiBell, FiBellOff, FiCheck, FiClock, FiMoon, FiRefreshCw } from 'react-icons/fi';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import useApi from '@/hooks/use-api';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import { refreshNotificationBadge } from '@/hooks/use-notification-count';
import {
    extractNotificationPreferences,
    mergeNotificationPreferencesIntoSignals,
    resolveDefaultNotificationTimezone,
    type ResolvedNotificationPreferences,
} from '@/services/notification-preferences.service';

type InboxNotification = {
    id: string;
    type: string;
    title: string;
    body: string | null;
    data: Record<string, unknown> | null;
    readAt: string | null;
    createdAt: string;
};

type NotificationFilter = 'all' | 'unread';

const PAGE_SIZE = 25;

const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

const coerceNotification = (value: unknown): InboxNotification | null => {
    const record = asRecord(value);
    if (!record || typeof record.id !== 'string' || typeof record.type !== 'string' || typeof record.title !== 'string') {
        return null;
    }
    return {
        id: record.id,
        type: record.type,
        title: record.title,
        body: typeof record.body === 'string' ? record.body : null,
        data: asRecord(record.data),
        readAt: typeof record.readAt === 'string' ? record.readAt : null,
        createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString(),
    };
};

const formatRelativeTime = (value: string) => {
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) return 'Just now';
    const diff = Date.now() - timestamp;
    if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.round(diff / 60000))}m ago`;
    if (diff < 24 * 60 * 60 * 1000) return `${Math.max(1, Math.round(diff / (60 * 60 * 1000)))}h ago`;
    return `${Math.max(1, Math.round(diff / (24 * 60 * 60 * 1000)))}d ago`;
};

const resolveHref = (notification: InboxNotification): string | null => {
    if (notification.type === 'reminder') return `/entry/new?source=reminder&notificationId=${notification.id}`;
    if (notification.type === 'share_reaction' && typeof notification.data?.bundleId === 'string') {
        return `/shared/view?id=${notification.data.bundleId}`;
    }
    return typeof notification.data?.link === 'string'
        ? notification.data.link
        : typeof notification.data?.route === 'string'
            ? notification.data.route
            : null;
};

const clonePreferences = (value: ResolvedNotificationPreferences): ResolvedNotificationPreferences => ({
    reminders: value.reminders,
    sharedMemories: value.sharedMemories,
    friendActivity: value.friendActivity,
    insights: value.insights,
    quietHours: { ...value.quietHours },
    ...(value.updatedAt ? { updatedAt: value.updatedAt } : {}),
});

export default function NotificationsPage() {
    const router = useRouter();
    const { apiFetch } = useApi();
    const { user, syncUser } = useAuth();
    const { isLoading: authLoading, isAuthenticated } = useAuthRedirect();
    const toast = useToast();

    const [filter, setFilter] = useState<NotificationFilter>('all');
    const [notifications, setNotifications] = useState<InboxNotification[]>([]);
    const [total, setTotal] = useState(0);
    const [unreadCount, setUnreadCount] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [markingAll, setMarkingAll] = useState(false);
    const [activeNotificationId, setActiveNotificationId] = useState<string | null>(null);
    const [savingPreferences, setSavingPreferences] = useState(false);
    const [activePanel, setActivePanel] = useState<'inbox' | 'settings'>('inbox');
    const [preferences, setPreferences] = useState<ResolvedNotificationPreferences>(() => extractNotificationPreferences(null));

    useEffect(() => {
        setPreferences(extractNotificationPreferences(user?.profile?.personalizationSignals));
    }, [user?.profile?.personalizationSignals]);

    const loadNotifications = useCallback(async (nextFilter: NotificationFilter, nextPage = 1, append = false) => {
        append ? setLoadingMore(true) : setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(nextPage), limit: String(PAGE_SIZE), ...(nextFilter === 'unread' ? { unreadOnly: 'true' } : {}) });
            const response = await apiFetch(`/notifications?${params.toString()}`);
            if (!response.ok) throw new Error('Couldn’t load notifications.');
            const data = await response.json();
            const nextItems = Array.isArray(data.notifications)
                ? data.notifications
                    .map(coerceNotification)
                    .filter((item: InboxNotification | null): item is InboxNotification => item !== null)
                : [];
            setNotifications((current) => append ? [...current, ...nextItems] : nextItems);
            setTotal(typeof data.total === 'number' ? data.total : nextItems.length);
            setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0);
            setPage(nextPage);
        } catch (error: any) {
            toast.error(error?.message || 'Couldn’t load notifications.');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [apiFetch, toast]);

    useEffect(() => {
        if (authLoading || !isAuthenticated) return;
        void loadNotifications(filter);
    }, [authLoading, filter, isAuthenticated, loadNotifications]);

    const markRead = useCallback(async (notification: InboxNotification) => {
        if (notification.readAt) return true;
        setActiveNotificationId(notification.id);
        try {
            const response = await apiFetch(`/notifications/${notification.id}/read`, { method: 'PATCH' });
            if (!response.ok) throw new Error('Couldn’t mark that notification as read.');
            setNotifications((current) => filter === 'unread'
                ? current.filter((item) => item.id !== notification.id)
                : current.map((item) => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item));
            setUnreadCount((current) => Math.max(0, current - 1));
            refreshNotificationBadge();
            return true;
        } catch (error: any) {
            toast.error(error?.message || 'Couldn’t update that notification.');
            return false;
        } finally {
            setActiveNotificationId(null);
        }
    }, [apiFetch, filter, toast]);

    const openNotification = useCallback(async (notification: InboxNotification) => {
        const updated = await markRead(notification);
        const href = resolveHref(notification);
        if (updated && href) router.push(href);
    }, [markRead, router]);

    const markAllRead = useCallback(async () => {
        setMarkingAll(true);
        try {
            const response = await apiFetch('/notifications/read-all', { method: 'PATCH' });
            if (!response.ok) throw new Error('Couldn’t mark everything as read.');
            setNotifications((current) => filter === 'unread' ? [] : current.map((item) => ({ ...item, readAt: new Date().toISOString() })));
            setUnreadCount(0);
            refreshNotificationBadge();
        } catch (error: any) {
            toast.error(error?.message || 'Couldn’t mark everything as read.');
        } finally {
            setMarkingAll(false);
        }
    }, [apiFetch, filter, toast]);

    const savePreferences = useCallback(async (next: ResolvedNotificationPreferences) => {
        const previous = clonePreferences(preferences);
        setPreferences(next);
        setSavingPreferences(true);
        try {
            const response = await apiFetch('/user/profile/privacy', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    personalizationSignals: mergeNotificationPreferencesIntoSignals(
                        asRecord(user?.profile?.personalizationSignals),
                        { ...next, updatedAt: new Date().toISOString() }
                    ),
                }),
            });
            const data = await response.json().catch(() => null);
            if (!response.ok) throw new Error(data?.message || 'Couldn’t save notification settings.');
            if (data?.user) syncUser(data.user);
        } catch (error: any) {
            setPreferences(previous);
            toast.error(error?.message || 'Couldn’t save notification settings.');
        } finally {
            setSavingPreferences(false);
        }
    }, [apiFetch, preferences, syncUser, toast, user?.profile?.personalizationSignals]);

    const hasMore = notifications.length < total;
    const empty = !loading && notifications.length === 0;
    const deviceTimezone = useMemo(() => preferences.quietHours.timezone || resolveDefaultNotificationTimezone(), [preferences.quietHours.timezone]);

    if (authLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="md" /></div>;
    if (!isAuthenticated) return null;

    return (
        <div className="min-h-screen px-4 py-6 md:px-8 md:py-10">
            <div className="mx-auto max-w-6xl space-y-6">
                <section className="workspace-panel rounded-[2rem] p-6 md:p-8">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-muted">Notification Center</p>
                    <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <h1 className="workspace-heading text-3xl font-serif md:text-4xl">See what landed, then tune the noise</h1>
                            <p className="mt-2 max-w-3xl text-sm leading-7 text-ink-secondary">Review reminders, shared-memory activity, and friend updates in one place.</p>
                        </div>
                        <div className="flex gap-3">
                            <div className="workspace-soft-panel rounded-[1.4rem] px-4 py-3 text-center"><div className="text-xs uppercase tracking-[0.12em] text-ink-muted">Unread</div><div className="workspace-heading mt-1 text-2xl font-serif">{unreadCount}</div></div>
                            <div className="workspace-soft-panel rounded-[1.4rem] px-4 py-3 text-center"><div className="text-xs uppercase tracking-[0.12em] text-ink-muted">Visible</div><div className="workspace-heading mt-1 text-2xl font-serif">{notifications.length}</div></div>
                        </div>
                    </div>
                </section>

                <section className="workspace-panel rounded-[2rem] p-4 md:p-5">
                    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Notifications sections">
                        {([
                            ['inbox', 'Inbox'],
                            ['settings', 'Settings'],
                        ] as const).map(([id, label]) => {
                            const isActive = activePanel === id;
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    role="tab"
                                    aria-selected={isActive}
                                    onClick={() => setActivePanel(id)}
                                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                                        isActive ? 'bg-[rgb(107,143,113)] text-white' : 'workspace-pill'
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                    <p className="mt-3 text-sm text-ink-secondary">
                        {activePanel === 'inbox'
                            ? 'Review what landed first, then open settings only when you want less noise.'
                            : 'Control what can interrupt you and when it should stay quiet.'}
                    </p>
                </section>

                {activePanel === 'inbox' ? (
                    <section className="workspace-panel rounded-[2rem] p-6">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex gap-2">
                                {(['all', 'unread'] as NotificationFilter[]).map((option) => (
                                    <button key={option} type="button" onClick={() => setFilter(option)} className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === option ? 'bg-[rgb(107,143,113)] text-white' : 'workspace-pill'}`}>
                                        {option === 'all' ? 'All activity' : 'Unread only'}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => void loadNotifications(filter)} className="workspace-button-outline rounded-xl px-4 py-2 text-sm font-semibold"><FiRefreshCw size={14} className="inline-block mr-2" />Refresh</button>
                                <button type="button" onClick={() => void markAllRead()} disabled={markingAll || unreadCount === 0} className="workspace-button-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60">{markingAll ? 'Saving…' : 'Mark all read'}</button>
                            </div>
                        </div>

                        <div className="mt-5 space-y-3">
                            {loading && <div className="flex items-center justify-center py-16"><Spinner size="md" /></div>}
                            {empty && (
                                <div className="workspace-soft-panel rounded-[1.6rem] px-5 py-10 text-center">
                                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(107,143,113,0.12)] text-[rgb(107,143,113)]">{filter === 'unread' ? <FiBellOff size={20} /> : <FiBell size={20} />}</div>
                                    <h2 className="workspace-heading mt-4 text-xl font-serif">{filter === 'unread' ? 'You’re all caught up' : 'No notifications yet'}</h2>
                                </div>
                            )}
                            {!loading && notifications.map((notification) => (
                                <button key={notification.id} type="button" onClick={() => void openNotification(notification)} className={`w-full rounded-[1.4rem] border p-4 text-left ${notification.readAt ? 'border-[rgba(92,92,92,0.1)] bg-white/60' : 'border-[rgba(107,143,113,0.22)] bg-[rgba(107,143,113,0.05)]'}`}>
                                    <div className="flex items-start gap-3">
                                        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${notification.readAt ? 'bg-[rgba(92,92,92,0.18)]' : 'bg-[rgb(107,143,113)]'}`} />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-ink-muted">{notification.type.replace(/_/g, ' ')}</span>
                                                <span className="text-[0.72rem] text-ink-muted">{formatRelativeTime(notification.createdAt)}</span>
                                            </div>
                                            <p className="workspace-heading mt-2 text-base font-semibold">{notification.title}</p>
                                            {notification.body && <p className="mt-1 text-sm leading-7 text-ink-secondary">{notification.body}</p>}
                                        </div>
                                        {activeNotificationId === notification.id && <Spinner size="sm" />}
                                    </div>
                                </button>
                            ))}
                        </div>

                        {hasMore && (
                            <div className="mt-5 flex justify-center">
                                <button type="button" onClick={() => void loadNotifications(filter, page + 1, true)} disabled={loadingMore} className="workspace-button-outline rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60">
                                    {loadingMore ? 'Loading…' : 'Load more'}
                                </button>
                            </div>
                        )}
                    </section>
                ) : (
                    <section className="space-y-6">
                        <section className="workspace-panel rounded-[2rem] p-6">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-muted">Settings</p>
                                    <h2 className="workspace-heading mt-2 text-2xl font-serif">Notification settings</h2>
                                    <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                        Choose which updates can reach you before you tune quiet hours.
                                    </p>
                                </div>
                                <div className="text-xs text-ink-secondary">{savingPreferences ? 'Saving…' : 'Saved automatically'}</div>
                            </div>
                            <div className="mt-5 space-y-3">
                                {([
                                    ['reminders', 'Reminders'],
                                    ['sharedMemories', 'Shared memories'],
                                    ['friendActivity', 'Friend activity'],
                                    ['insights', 'Insights'],
                                ] as const).map(([key, label]) => (
                                    <div key={key} className="workspace-soft-panel flex items-center justify-between rounded-[1.3rem] px-4 py-3">
                                        <span className="text-sm font-semibold text-[rgb(var(--text-primary))]">{label}</span>
                                        <button type="button" role="switch" aria-checked={preferences[key]} onClick={() => void savePreferences({ ...preferences, [key]: !preferences[key] })} className={`inline-flex h-7 w-12 items-center rounded-full border px-1 ${preferences[key] ? 'border-[rgb(107,143,113)] bg-[rgb(107,143,113)] justify-end' : 'border-[rgba(92,92,92,0.14)] bg-[rgba(92,92,92,0.12)] justify-start'}`}>
                                            <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="workspace-panel rounded-[2rem] p-6">
                            <div className="flex items-start gap-3">
                                <FiMoon className="mt-1 text-ink-muted" />
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-muted">Quiet Hours</p>
                                    <h2 className="workspace-heading mt-2 text-2xl font-serif">Quiet hours</h2>
                                    <p className="mt-2 text-sm leading-7 text-ink-secondary">Quiet hours suppress push banners, but keep the in-app notification here.</p>
                                </div>
                            </div>
                            <div className="mt-5 space-y-4">
                                <div className="workspace-soft-panel flex items-center justify-between rounded-[1.3rem] px-4 py-3">
                                    <div className="text-sm text-ink-secondary">Using {deviceTimezone}</div>
                                    <button type="button" role="switch" aria-checked={preferences.quietHours.enabled} onClick={() => void savePreferences({ ...preferences, quietHours: { ...preferences.quietHours, enabled: !preferences.quietHours.enabled, timezone: deviceTimezone } })} className={`inline-flex h-7 w-12 items-center rounded-full border px-1 ${preferences.quietHours.enabled ? 'border-[rgb(107,143,113)] bg-[rgb(107,143,113)] justify-end' : 'border-[rgba(92,92,92,0.14)] bg-[rgba(92,92,92,0.12)] justify-start'}`}>
                                        <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
                                    </button>
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <label className="workspace-soft-panel rounded-[1.3rem] px-4 py-3"><span className="text-xs uppercase tracking-[0.12em] text-ink-muted">Start</span><input type="time" value={preferences.quietHours.start} onChange={(event) => void savePreferences({ ...preferences, quietHours: { ...preferences.quietHours, start: event.target.value, timezone: deviceTimezone } })} className="workspace-input mt-3 h-11 w-full px-3" /></label>
                                    <label className="workspace-soft-panel rounded-[1.3rem] px-4 py-3"><span className="text-xs uppercase tracking-[0.12em] text-ink-muted">End</span><input type="time" value={preferences.quietHours.end} onChange={(event) => void savePreferences({ ...preferences, quietHours: { ...preferences.quietHours, end: event.target.value, timezone: deviceTimezone } })} className="workspace-input mt-3 h-11 w-full px-3" /></label>
                                </div>
                            </div>
                        </section>

                        <section className="workspace-panel rounded-[2rem] p-6">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-muted">Related</p>
                            <div className="mt-4 grid gap-3">
                                <Link href="/profile/edit?tab=reminders" className="workspace-soft-panel flex items-center justify-between rounded-[1.3rem] px-4 py-3 transition-colors hover:opacity-90"><span className="text-sm font-semibold">Reminder schedule</span><FiClock size={16} /></Link>
                                <Link href="/profile" className="workspace-soft-panel flex items-center justify-between rounded-[1.3rem] px-4 py-3 transition-colors hover:opacity-90"><span className="text-sm font-semibold">Device permissions</span><FiCheck size={16} /></Link>
                            </div>
                        </section>
                    </section>
                )}
            </div>
        </div>
    );
}
