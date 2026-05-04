'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiBell, FiBellOff, FiBookOpen, FiCheck, FiClock, FiMessageCircle, FiMoon, FiRefreshCw, FiShare2, FiStar } from 'react-icons/fi';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import useApi from '@/hooks/use-api';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import { refreshNotificationBadge } from '@/hooks/use-notification-count';
import { useSharedUnreadCount } from '@/hooks/use-shared-unread-count';
import { pickRotatingCopy } from '@/utils/rotating-copy';
import {
    extractNotificationPreferences,
    mergeNotificationPreferencesIntoSignals,
    resolveDefaultNotificationTimezone,
    type ResolvedNotificationPreferences,
} from '@/services/notification-preferences.service';
import UserAvatar from '@/components/ui/UserAvatar';

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
const EMPTY_INBOX_VARIANTS = [
    {
        title: 'No notifications yet',
        description: 'Reminders, shared-memory reactions, and gentle nudges will gather here.',
    },
    {
        title: 'Your inbox is quiet',
        description: 'Once Notive has something worth tapping you about, it will land here first.',
    },
    {
        title: 'Nothing waiting right now',
        description: 'This space fills with reminder notes, shared moments, and reflection follow-ups.',
    },
    {
        title: 'A calm page for now',
        description: 'When your writing rhythm picks up, this inbox starts carrying the small signals around it.',
    },
] as const;
const EMPTY_UNREAD_VARIANTS = [
    {
        title: "You're all caught up",
        description: 'No unread pings are sitting in the stack right now.',
    },
    {
        title: 'Everything here has been opened',
        description: 'Your unread list is clear for the moment.',
    },
    {
        title: 'No unread notes left',
        description: 'You cleared the latest reminders and shared-memory activity.',
    },
] as const;

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

const getNotificationSender = (notification: InboxNotification) => {
    const avatarUrl = typeof notification.data?.senderAvatarUrl === 'string'
        ? notification.data.senderAvatarUrl
        : typeof notification.data?.avatarUrl === 'string'
            ? notification.data.avatarUrl
            : null;
    const name = typeof notification.data?.senderName === 'string'
        ? notification.data.senderName
        : null;
    return { avatarUrl, name };
};

const getNotificationSignal = (type: string) => {
    if (type === 'reminder') return { label: 'Reminder', Icon: FiClock, tone: 'amber' as const };
    if (type === 'shared_memory' || type === 'memory_share_request') return { label: 'Shared', Icon: FiShare2, tone: 'sage' as const };
    if (type === 'share_reaction' || type === 'shared_memory_response') return { label: 'Reply', Icon: FiMessageCircle, tone: 'apricot' as const };
    if (type.includes('insight')) return { label: 'Insight', Icon: FiStar, tone: 'sky' as const };
    return { label: 'Memory', Icon: FiBookOpen, tone: 'sage' as const };
};

const signalToneClass = {
    sage: 'border-[rgba(138,154,111,0.24)] bg-[rgba(138,154,111,0.12)] text-[rgb(107,143,113)]',
    amber: 'border-[rgba(201,168,107,0.28)] bg-[rgba(234,216,189,0.18)] text-[rgb(145,111,56)]',
    apricot: 'border-[rgba(216,164,139,0.28)] bg-[rgba(240,205,184,0.18)] text-[rgb(153,99,78)]',
    sky: 'border-[rgba(140,174,187,0.28)] bg-[rgba(191,214,221,0.18)] text-[rgb(82,122,136)]',
} as const;

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
    const { unreadCount: sharedUnreadCount } = useSharedUnreadCount();

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
            const [inboxResponse, sharedResponse] = await Promise.all([
                apiFetch('/notifications/read-all', { method: 'PATCH' }),
                apiFetch('/memory-share/received/read-all', { method: 'PATCH' }).catch(() => null),
            ]);
            if (!inboxResponse.ok) throw new Error('Couldn’t mark everything as read.');
            setNotifications((current) => filter === 'unread' ? [] : current.map((item) => ({ ...item, readAt: new Date().toISOString() })));
            setUnreadCount(0);
            refreshNotificationBadge();
            if (sharedResponse && !sharedResponse.ok) {
                // Inbox cleared but shared-memory bulk update failed — surface a soft warning.
                toast.error('Inbox cleared, but shared memories didn’t update. Try again.');
            }
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
    const emptyCopy = filter === 'unread'
        ? pickRotatingCopy('empty-notifications-unread', EMPTY_UNREAD_VARIANTS)
        : pickRotatingCopy('empty-notifications-all', EMPTY_INBOX_VARIANTS);

    if (authLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner size="md" /></div>;
    if (!isAuthenticated) return null;

    return (
        <div className="px-4 py-4 md:px-8 md:py-6">
            <div className="mx-auto max-w-3xl space-y-3">
                {/* Compact header */}
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="type-page-title text-strong">Notifications</h1>
                        <p className="type-micro text-muted">
                            {(() => {
                                const parts: string[] = [];
                                if (unreadCount > 0) parts.push(`${unreadCount} unread`);
                                if (sharedUnreadCount > 0) parts.push(`${sharedUnreadCount} new memor${sharedUnreadCount === 1 ? 'y' : 'ies'}`);
                                if (parts.length === 0) return 'All caught up';
                                return parts.join(' · ');
                            })()}
                        </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => void loadNotifications(filter)}
                            aria-label="Refresh"
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(92,92,92,0.15)] bg-white/60 text-soft transition-colors hover:text-strong"
                        >
                            <FiRefreshCw size={15} aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            onClick={() => void markAllRead()}
                            disabled={markingAll || (unreadCount === 0 && sharedUnreadCount === 0)}
                            className="type-label-sm rounded-full bg-[rgb(107,143,113)] px-3 py-1.5 font-semibold text-white transition-opacity disabled:opacity-40"
                        >
                            {markingAll ? 'Saving…' : 'Mark all read'}
                        </button>
                    </div>
                </div>

                {/* Combined tab + filter row */}
                <div className="chip-scroller" role="tablist" aria-label="Notifications sections">
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
                                className={`type-label-sm shrink-0 rounded-full px-3 py-1.5 font-semibold transition-colors ${
                                    isActive ? 'bg-[rgb(107,143,113)] text-white' : 'border border-[rgba(92,92,92,0.15)] bg-white/50 text-soft hover:text-strong'
                                }`}
                            >
                                {label}
                            </button>
                        );
                    })}
                    {activePanel === 'inbox' && (
                        <>
                            <span className="mx-1 h-5 w-px shrink-0 bg-[rgba(92,92,92,0.18)]" aria-hidden="true" />
                            {(['all', 'unread'] as NotificationFilter[]).map((option) => {
                                const isActive = filter === option;
                                return (
                                    <button
                                        key={option}
                                        type="button"
                                        onClick={() => setFilter(option)}
                                        className={`type-label-sm shrink-0 rounded-full px-3 py-1.5 font-semibold transition-colors ${
                                            isActive ? 'bg-[rgba(107,143,113,0.14)] text-[rgb(107,143,113)] ring-1 ring-[rgba(107,143,113,0.35)]' : 'text-soft hover:text-strong'
                                        }`}
                                    >
                                        {option === 'all' ? 'All' : 'Unread'}
                                    </button>
                                );
                            })}
                        </>
                    )}
                </div>

                {activePanel === 'inbox' ? (
                    <div className="space-y-1.5">
                        {loading && <div className="flex items-center justify-center py-12"><Spinner size="md" /></div>}
                        {empty && (
                            <div className="rounded-2xl border border-[rgba(92,92,92,0.12)] bg-white/60 px-5 py-10 text-center">
                                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(107,143,113,0.12)] text-[rgb(107,143,113)]">
                                    {filter === 'unread' ? <FiBellOff size={18} /> : <FiBell size={18} />}
                                </div>
                                <p className="type-label-md mt-3 text-strong">
                                    {emptyCopy.title}
                                </p>
                                <p className="type-body-sm mx-auto mt-1.5 max-w-xs text-soft">
                                    {emptyCopy.description}
                                </p>
                                {filter !== 'unread' && (
                                    <>
                                        <Link
                                            href="/profile/edit?tab=reminders"
                                            className="type-label-sm mt-4 inline-flex items-center gap-1.5 rounded-full bg-[rgb(107,143,113)] px-4 py-1.5 font-semibold text-white transition-opacity hover:opacity-90"
                                        >
                                            <FiClock size={14} aria-hidden="true" />
                                            Set up a reminder
                                        </Link>
                                    </>
                                )}
                            </div>
                        )}
                        {!loading && notifications.map((notification) => {
                            const isRead = Boolean(notification.readAt);
                            const signal = getNotificationSignal(notification.type);
                            const SignalIcon = signal.Icon;
                            const sender = getNotificationSender(notification);
                            const hasSenderAvatar = Boolean(sender.avatarUrl || sender.name);
                            return (
                                <button
                                    key={notification.id}
                                    type="button"
                                    onClick={() => void openNotification(notification)}
                                    aria-label={`${isRead ? 'Read' : 'Unread'} notification: ${notification.title}`}
                                    className={`density-compact w-full border text-left transition-all ${
                                        isRead
                                            ? 'border-dashed border-[rgba(92,92,92,0.18)] bg-transparent opacity-60 hover:opacity-100 hover:bg-white/60'
                                            : 'border-[rgba(107,143,113,0.3)] bg-[rgba(107,143,113,0.08)] shadow-sm hover:bg-[rgba(107,143,113,0.12)]'
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <span className="relative mt-0.5 shrink-0">
                                            {hasSenderAvatar ? (
                                                <UserAvatar
                                                    avatarUrl={sender.avatarUrl}
                                                    name={sender.name || signal.label}
                                                    size={40}
                                                    className={isRead ? 'opacity-60 grayscale' : ''}
                                                />
                                            ) : (
                                                <span className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${signalToneClass[signal.tone]} ${isRead ? 'opacity-55 grayscale' : ''}`}>
                                                    <SignalIcon size={17} aria-hidden="true" />
                                                </span>
                                            )}
                                            {hasSenderAvatar && (
                                                <span className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-[rgb(var(--paper-bg))] ${signalToneClass[signal.tone]}`}>
                                                    <SignalIcon size={10} aria-hidden="true" />
                                                </span>
                                            )}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`type-micro font-semibold uppercase tracking-wide ${isRead ? 'text-muted' : 'text-[rgb(107,143,113)]'}`}>
                                                    {signal.label}
                                                </span>
                                                <span className="type-micro text-muted">· {formatRelativeTime(notification.createdAt)}</span>
                                            </div>
                                            <p className={`type-label-md mt-0.5 ${isRead ? 'font-normal text-muted' : 'font-semibold text-strong'}`}>
                                                {notification.title}
                                            </p>
                                            {notification.body && (
                                                <p className={`type-body-sm mt-0.5 line-clamp-2 ${isRead ? 'text-muted' : 'text-soft'}`}>
                                                    {notification.body}
                                                </p>
                                            )}
                                        </div>
                                        {activeNotificationId === notification.id && <Spinner size="sm" />}
                                    </div>
                                </button>
                            );
                        })}

                        {hasMore && (
                            <div className="flex justify-center pt-2">
                                <button
                                    type="button"
                                    onClick={() => void loadNotifications(filter, page + 1, true)}
                                    disabled={loadingMore}
                                    className="type-label-sm rounded-full border border-[rgba(92,92,92,0.18)] bg-white/60 px-4 py-1.5 font-semibold text-soft disabled:opacity-60"
                                >
                                    {loadingMore ? 'Loading…' : 'Load more'}
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        <section className="rounded-2xl border border-[rgba(92,92,92,0.12)] bg-white/60 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="type-label-md font-semibold text-strong">Notification types</h2>
                                    <p className="type-micro text-muted">Choose which updates can reach you.</p>
                                </div>
                                <span className="type-micro text-muted">{savingPreferences ? 'Saving…' : 'Auto-saved'}</span>
                            </div>
                            <div className="mt-3 space-y-1.5">
                                {([
                                    ['reminders', 'Reminders'],
                                    ['sharedMemories', 'Shared memories'],
                                    ['friendActivity', 'Friend activity'],
                                    ['insights', 'Insights'],
                                ] as const).map(([key, label]) => (
                                    <div key={key} className="flex items-center justify-between rounded-xl bg-white/50 px-3 py-2">
                                        <span className="type-label-md text-strong">{label}</span>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={preferences[key]}
                                            onClick={() => void savePreferences({ ...preferences, [key]: !preferences[key] })}
                                            className={`inline-flex h-6 w-10 items-center rounded-full border px-0.5 transition-colors ${
                                                preferences[key]
                                                    ? 'border-[rgb(107,143,113)] bg-[rgb(107,143,113)] justify-end'
                                                    : 'border-[rgba(92,92,92,0.14)] bg-[rgba(92,92,92,0.12)] justify-start'
                                            }`}
                                        >
                                            <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="rounded-2xl border border-[rgba(92,92,92,0.12)] bg-white/60 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2">
                                    <FiMoon className="mt-0.5 text-ink-muted" size={16} />
                                    <div>
                                        <h2 className="type-label-md font-semibold text-strong">Quiet hours</h2>
                                        <p className="type-micro text-muted">Suppresses push banners · keeps in-app items</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={preferences.quietHours.enabled}
                                    onClick={() => void savePreferences({ ...preferences, quietHours: { ...preferences.quietHours, enabled: !preferences.quietHours.enabled, timezone: deviceTimezone } })}
                                    className={`inline-flex h-6 w-10 shrink-0 items-center rounded-full border px-0.5 transition-colors ${
                                        preferences.quietHours.enabled
                                            ? 'border-[rgb(107,143,113)] bg-[rgb(107,143,113)] justify-end'
                                            : 'border-[rgba(92,92,92,0.14)] bg-[rgba(92,92,92,0.12)] justify-start'
                                    }`}
                                >
                                    <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
                                </button>
                            </div>
                            {preferences.quietHours.enabled && (
                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    <label className="rounded-xl bg-white/50 px-3 py-2">
                                        <span className="type-micro uppercase tracking-wide text-muted">Start</span>
                                        <input
                                            type="time"
                                            value={preferences.quietHours.start}
                                            onChange={(event) => void savePreferences({ ...preferences, quietHours: { ...preferences.quietHours, start: event.target.value, timezone: deviceTimezone } })}
                                            className="workspace-input mt-1 h-9 w-full px-2 text-sm"
                                        />
                                    </label>
                                    <label className="rounded-xl bg-white/50 px-3 py-2">
                                        <span className="type-micro uppercase tracking-wide text-muted">End</span>
                                        <input
                                            type="time"
                                            value={preferences.quietHours.end}
                                            onChange={(event) => void savePreferences({ ...preferences, quietHours: { ...preferences.quietHours, end: event.target.value, timezone: deviceTimezone } })}
                                            className="workspace-input mt-1 h-9 w-full px-2 text-sm"
                                        />
                                    </label>
                                </div>
                            )}
                            <p className="type-micro mt-2 text-muted">Using {deviceTimezone}</p>
                        </section>

                        <section className="rounded-2xl border border-[rgba(92,92,92,0.12)] bg-white/60 p-4">
                            <h2 className="type-label-md font-semibold text-strong">Related</h2>
                            <div className="mt-2 grid gap-1.5">
                                <Link href="/profile/edit?tab=reminders" className="flex items-center justify-between rounded-xl bg-white/50 px-3 py-2 transition-colors hover:bg-white/80">
                                    <span className="type-label-md text-strong">Reminder schedule</span>
                                    <FiClock size={14} className="text-soft" />
                                </Link>
                                <Link href="/profile" className="flex items-center justify-between rounded-xl bg-white/50 px-3 py-2 transition-colors hover:bg-white/80">
                                    <span className="type-label-md text-strong">Device permissions</span>
                                    <FiCheck size={14} className="text-soft" />
                                </Link>
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
}
