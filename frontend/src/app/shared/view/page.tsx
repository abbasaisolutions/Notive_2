'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/context/auth-context';
import { useAuthRedirect } from '@/hooks/use-auth-redirect';
import { useToast } from '@/context/toast-context';
import { refreshNotificationBadge } from '@/hooks/use-notification-count';
import { API_URL } from '@/constants/config';
import { passthroughImageLoader } from '@/lib/image-loader';
import { Spinner } from '@/components/ui';

/* ─── Types ────────────────────────────────────────────── */

type BundleSender = { id: string; name: string | null; avatarUrl: string | null };

type BundleRecipient = {
    recipientId: string;
    status: string;
    readAt: string | null;
    reaction: string | null;
    recipient: { id: string; name: string | null; avatarUrl: string | null };
};

type BundleItem = {
    id: string;
    snapshotTitle: string | null;
    snapshotContent: string;
    snapshotMood: string | null;
    snapshotTags: string[];
    snapshotCoverImage: string | null;
    snapshotCreatedAt: string;
};

type BundleDetail = {
    id: string;
    sender: BundleSender;
    message: string | null;
    items: BundleItem[];
    recipients?: BundleRecipient[];
    viewerReaction: string | null;
    createdAt: string;
};

/* ─── Constants ────────────────────────────────────────── */

const MOOD_COLORS: Record<string, string> = {
    happy: '#F59E0B', excited: '#EF4444', calm: '#6B8F71',
    thoughtful: '#6366F1', tired: '#94A3B8', sad: '#3B82F6',
    anxious: '#F97316', frustrated: '#DC2626', grateful: '#10B981',
    motivated: '#8B5CF6',
};

const REACTIONS = [
    { value: 'grateful', label: 'Grateful', emoji: '🤝' },
    { value: 'inspired', label: 'Inspired', emoji: '✨' },
    { value: 'understood', label: 'Understood', emoji: '💛' },
] as const;

const REACTION_MAP = Object.fromEntries(REACTIONS.map((r) => [r.value, r]));

const avatarInitial = (name: string | null) => (name || '?').charAt(0).toUpperCase();

/* ─── Page ─────────────────────────────────────────────── */

function SharedBundleViewContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { apiFetch } = useApi();
    const { user } = useAuth();
    const { isLoading: authLoading, isAuthenticated } = useAuthRedirect();
    const toast = useToast();

    const bundleId = searchParams.get('id');
    const [bundle, setBundle] = useState<BundleDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reaction, setReaction] = useState<string | null>(null);
    const [reactSending, setReactSending] = useState(false);

    useEffect(() => {
        if (authLoading || !isAuthenticated) return;
        if (!bundleId) { setError('No bundle ID'); setLoading(false); return; }
        (async () => {
            try {
                const r = await apiFetch(`/memory-share/bundles/${bundleId}`);
                if (r.status === 410) { setError('This shared memory has been revoked.'); setLoading(false); return; }
                if (!r.ok) {
                    const data = await r.json().catch(() => ({}));
                    setError(data.message || 'Couldn\u2019t load these shared memories.');
                    setLoading(false);
                    return;
                }
                const data = await r.json();
                setBundle(data.bundle);
                setReaction(data.bundle?.viewerReaction ?? null);
                refreshNotificationBadge();
            } catch {
                setError('Couldn\u2019t load shared memories. Try refreshing.');
            }
            setLoading(false);
        })();
    }, [bundleId, apiFetch, authLoading, isAuthenticated]);

    const handleReact = useCallback(async (value: string) => {
        if (!bundleId || reactSending) return;
        setReactSending(true);
        const newReaction = reaction === value ? null : value;
        try {
            const r = await apiFetch(`/memory-share/bundles/${bundleId}/react`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reaction: newReaction }),
            });
            if (r.ok) {
                const data = await r.json().catch(() => null);
                setReaction(data?.reaction ?? newReaction);
            } else {
                toast.error('Couldn\u2019t send your reaction.');
            }
        } catch { toast.error('Couldn\u2019t send your reaction.'); }
        setReactSending(false);
    }, [bundleId, reaction, reactSending, apiFetch, toast]);

    if (authLoading || !isAuthenticated || loading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <Spinner size="md" variant="accent" />
            </div>
        );
    }

    if (error || !bundle) {
        return (
            <div className="mx-auto max-w-xl px-4 py-12 text-center">
                <h2 className="notebook-title text-lg">{error || 'Not found'}</h2>
                <button type="button" onClick={() => router.push('/timeline')} className="workspace-button-outline mt-4 rounded-xl px-4 py-2.5 text-sm font-semibold">
                    Back to timeline
                </button>
            </div>
        );
    }

    const isSender = bundle.recipients !== undefined;
    const senderName = bundle.sender.name || 'Someone';
    const relativeTime = formatRelativeTime(bundle.createdAt);

    return (
        <div className="mx-auto max-w-2xl px-4 py-6">
            {/* Header */}
            <div className="mb-6 flex items-center gap-3">
                <Link href="/timeline?view=shared" className="text-[0.78rem] font-medium text-[rgb(107,143,113)] hover:underline">
                    &larr; Back
                </Link>
            </div>

            {/* Sender / viewer info */}
            {isSender ? (
                <div className="mb-6">
                    <p className="text-[0.85rem] font-semibold text-[rgb(var(--paper-ink))]">
                        You shared {bundle.items.length} {bundle.items.length === 1 ? 'memory' : 'memories'}
                    </p>
                    <p className="mt-0.5 text-[0.7rem] text-[rgb(130,130,130)]">{relativeTime}</p>

                    {/* Shared with list */}
                    {bundle.recipients && bundle.recipients.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[rgb(130,130,130)]">
                                Shared with
                            </span>
                            {bundle.recipients.map((r) => (
                                <span
                                    key={r.recipientId}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(92,92,92,0.1)] bg-[rgba(248,244,237,0.5)] px-2.5 py-1 text-[0.7rem] font-medium text-[rgb(var(--paper-ink))]"
                                >
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(107,143,113,0.14)] text-[0.55rem] font-bold text-[rgb(107,143,113)]">
                                        {avatarInitial(r.recipient.name)}
                                    </span>
                                    {r.recipient.name || 'Someone'}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="mb-6 flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(107,143,113,0.14)] text-sm font-bold text-[rgb(107,143,113)]">
                        {avatarInitial(bundle.sender.name)}
                    </span>
                    <div>
                        <p className="text-[0.85rem] font-semibold text-[rgb(var(--paper-ink))]">{senderName}</p>
                        <p className="text-[0.7rem] text-[rgb(130,130,130)]">
                            shared {bundle.items.length} {bundle.items.length === 1 ? 'memory' : 'memories'} &middot; {relativeTime}
                        </p>
                    </div>
                </div>
            )}

            {/* Sender message */}
            {bundle.message && (
                <div className="mb-6 rounded-xl border border-[rgba(92,92,92,0.1)] bg-[rgba(248,244,237,0.6)] px-4 py-3">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[rgb(130,130,130)]">Personal note</p>
                    <p className="mt-1 text-[0.82rem] leading-6 text-[rgb(var(--paper-ink))]">{bundle.message}</p>
                </div>
            )}

            {/* Memory cards */}
            <div className="space-y-4">
                {bundle.items.map((item, i) => (
                    <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08, duration: 0.3 }}
                        className="entry-paper-canvas overflow-hidden rounded-2xl border border-[rgba(92,92,92,0.12)] p-5"
                    >
                        {item.snapshotCoverImage && (
                            <div className="relative mb-4 h-36 overflow-hidden rounded-xl">
                                <Image
                                    src={item.snapshotCoverImage}
                                    loader={passthroughImageLoader}
                                    unoptimized
                                    alt=""
                                    fill
                                    sizes="(max-width: 768px) 100vw, 768px"
                                    className="object-cover"
                                />
                            </div>
                        )}
                        <div className="mb-2 flex items-center gap-2">
                            {item.snapshotMood && (
                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: MOOD_COLORS[item.snapshotMood] || '#94A3B8' }} />
                            )}
                            <span className="text-[0.68rem] text-[rgb(130,130,130)]">
                                {new Date(item.snapshotCreatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </span>
                        </div>
                        {item.snapshotTitle && (
                            <h3 className="mb-2 font-serif text-[1.05rem] font-semibold leading-snug text-[rgb(var(--paper-ink))]">{item.snapshotTitle}</h3>
                        )}
                        <p className="whitespace-pre-line text-[0.84rem] leading-7 text-[rgb(var(--paper-ink))]">{item.snapshotContent}</p>
                        {item.snapshotTags.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                                {item.snapshotTags.map((tag) => (
                                    <span key={tag} className="workspace-pill-muted rounded-full px-2 py-0.5 text-[0.65rem]">{tag}</span>
                                ))}
                            </div>
                        )}
                    </motion.div>
                ))}
            </div>

            {/* Sender: recipient reactions overview */}
            {isSender && bundle.recipients && bundle.recipients.length > 0 && (
                <div className="mt-8 mb-12">
                    <p className="mb-4 text-center text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[rgb(130,130,130)]">
                        Responses
                    </p>
                    <div className="space-y-2">
                        {bundle.recipients.map((r) => {
                            const reactionInfo = r.reaction ? REACTION_MAP[r.reaction] : null;
                            const recipientName = r.recipient.name || 'Someone';
                            return (
                                <div
                                    key={r.recipientId}
                                    className="flex items-center gap-3 rounded-xl border border-[rgba(92,92,92,0.1)] bg-[rgba(248,244,237,0.4)] px-4 py-3"
                                >
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(107,143,113,0.14)] text-[0.7rem] font-bold text-[rgb(107,143,113)]">
                                        {avatarInitial(r.recipient.name)}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-[0.82rem] font-medium text-[rgb(var(--paper-ink))]">
                                        {recipientName}
                                    </span>
                                    {reactionInfo ? (
                                        <span className="shrink-0 rounded-full border border-[rgba(107,143,113,0.2)] bg-[rgba(107,143,113,0.06)] px-3 py-1 text-[0.72rem] font-medium text-[rgb(107,143,113)]">
                                            {reactionInfo.emoji} {reactionInfo.label}
                                        </span>
                                    ) : r.readAt ? (
                                        <span className="shrink-0 text-[0.7rem] text-[rgb(160,160,160)]">
                                            Seen
                                        </span>
                                    ) : (
                                        <span className="shrink-0 text-[0.7rem] italic text-[rgb(180,180,180)]">
                                            Not opened yet
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Recipient: reaction buttons */}
            {!isSender && (
                <div className="mt-8 mb-12">
                    <p className="mb-3 text-center text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[rgb(130,130,130)]">
                        How does this make you feel?
                    </p>
                    <div className="flex justify-center gap-3">
                        {REACTIONS.map((r) => {
                            const isSelected = reaction === r.value;
                            return (
                                <motion.button
                                    key={r.value}
                                    type="button"
                                    disabled={reactSending}
                                    onClick={() => handleReact(r.value)}
                                    whileTap={{ scale: 0.93 }}
                                    animate={isSelected ? { scale: [1, 1.08, 1] } : {}}
                                    transition={{ duration: 0.25 }}
                                    className={`rounded-full border px-4 py-2 text-[0.78rem] font-medium transition-all duration-200 ${
                                        isSelected
                                            ? 'border-[rgba(107,143,113,0.5)] bg-[rgba(107,143,113,0.12)] text-[rgb(107,143,113)] shadow-[0_0_0_2px_rgba(107,143,113,0.1)]'
                                            : 'border-[rgba(92,92,92,0.15)] bg-white/60 text-[rgb(var(--paper-ink))] hover:border-[rgba(107,143,113,0.3)] hover:bg-[rgba(107,143,113,0.04)]'
                                    }`}
                                >
                                    {r.emoji} {r.label}
                                </motion.button>
                            );
                        })}
                    </div>
                    {reaction && (
                        <motion.p
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-3 text-center text-[0.68rem] text-[rgb(107,143,113)]"
                        >
                            Your reaction has been shared
                        </motion.p>
                    )}
                </div>
            )}
        </div>
    );
}

export default function SharedBundleViewPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-[50vh] items-center justify-center">
                    <Spinner size="md" variant="accent" />
                </div>
            }
        >
            <SharedBundleViewContent />
        </Suspense>
    );
}

/* ─── Helpers ──────────────────────────────────────────── */

function formatRelativeTime(dateString: string): string {
    const diff = Date.now() - new Date(dateString).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
