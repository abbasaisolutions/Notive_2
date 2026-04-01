'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useApi } from '@/hooks/use-api';
import { useToast } from '@/context/toast-context';
import { API_URL } from '@/constants/config';

/* ─── Types ────────────────────────────────────────────── */

type BundleSender = { id: string; name: string | null; avatarUrl: string | null };

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

const avatarInitial = (name: string | null) => (name || '?').charAt(0).toUpperCase();

/* ─── Page ─────────────────────────────────────────────── */

export default function SharedBundleViewPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { apiFetch } = useApi();
    const toast = useToast();

    const bundleId = searchParams.get('id');
    const [bundle, setBundle] = useState<BundleDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reaction, setReaction] = useState<string | null>(null);
    const [reactSending, setReactSending] = useState(false);

    // Fetch bundle detail
    useEffect(() => {
        if (!bundleId) { setError('No bundle ID'); setLoading(false); return; }
        (async () => {
            try {
                const r = await apiFetch(`${API_URL}/memory-share/bundles/${bundleId}`);
                if (r.status === 410) { setError('This shared memory has been revoked.'); setLoading(false); return; }
                if (!r.ok) { setError('Could not load shared memories.'); setLoading(false); return; }
                const data = await r.json();
                setBundle(data.bundle);
            } catch {
                setError('Something went wrong.');
            }
            setLoading(false);
        })();
    }, [bundleId, apiFetch]);

    // React to bundle
    const handleReact = useCallback(async (value: string) => {
        if (!bundleId || reactSending) return;
        setReactSending(true);
        const newReaction = reaction === value ? null : value;
        try {
            const r = await apiFetch(`${API_URL}/memory-share/bundles/${bundleId}/react`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reaction: newReaction }),
            });
            if (r.ok) { setReaction(newReaction); }
            else { toast.error('Could not send reaction'); }
        } catch { toast.error('Something went wrong'); }
        setReactSending(false);
    }, [bundleId, reaction, reactSending, apiFetch, toast]);

    if (loading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgba(107,143,113,0.3)] border-t-[rgb(107,143,113)]" />
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

    const senderName = bundle.sender.name || 'Someone';
    const relativeTime = formatRelativeTime(bundle.createdAt);

    return (
        <div className="mx-auto max-w-2xl px-4 py-6">
            {/* Header */}
            <div className="mb-6 flex items-center gap-3">
                <Link href="/timeline?tab=shared" className="text-[0.78rem] font-medium text-[rgb(107,143,113)] hover:underline">
                    &larr; Back
                </Link>
            </div>

            {/* Sender info */}
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
                            <div className="mb-4 overflow-hidden rounded-xl">
                                <img src={item.snapshotCoverImage} alt="" className="h-36 w-full object-cover" />
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

            {/* Reactions */}
            <div className="mt-8 mb-12">
                <p className="mb-3 text-center text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[rgb(130,130,130)]">How does this make you feel?</p>
                <div className="flex justify-center gap-3">
                    {REACTIONS.map((r) => (
                        <button
                            key={r.value}
                            type="button"
                            disabled={reactSending}
                            onClick={() => handleReact(r.value)}
                            className={`rounded-full border px-4 py-2 text-[0.78rem] font-medium transition-colors ${
                                reaction === r.value
                                    ? 'border-[rgba(107,143,113,0.4)] bg-[rgba(107,143,113,0.1)] text-[rgb(107,143,113)]'
                                    : 'border-[rgba(92,92,92,0.15)] bg-white/60 text-[rgb(var(--paper-ink))] hover:border-[rgba(107,143,113,0.3)]'
                            }`}
                        >
                            {r.emoji} {r.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
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
