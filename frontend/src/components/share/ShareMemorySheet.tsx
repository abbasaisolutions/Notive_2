'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useApi } from '@/hooks/use-api';
import { useToast } from '@/context/toast-context';
import { API_URL } from '@/constants/config';

/* ─── Types ────────────────────────────────────────────── */

export type ShareableEntry = {
    id: string;
    title: string | null;
    content: string;
    mood: string | null;
    createdAt: string;
};

type SearchUser = {
    id: string;
    name: string | null;
    avatarUrl: string | null;
    email: string;
};

type ShareMemorySheetProps = {
    /** The entry the user originally tapped "share" on */
    initialEntry: ShareableEntry;
    /** All recent entries for the "add more" list */
    allEntries: ShareableEntry[];
    onClose: () => void;
};

/* ─── Helpers ──────────────────────────────────────────── */

const MOOD_COLORS: Record<string, string> = {
    happy: '#F59E0B', excited: '#EF4444', calm: '#6B8F71',
    thoughtful: '#6366F1', tired: '#94A3B8', sad: '#3B82F6',
    anxious: '#F97316', frustrated: '#DC2626', grateful: '#10B981',
    motivated: '#8B5CF6',
};

const avatarInitial = (name: string | null) =>
    (name || '?').charAt(0).toUpperCase();

const truncate = (text: string, len: number) =>
    text.length <= len ? text : `${text.slice(0, len).trimEnd()}...`;

const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};

/* ─── Component ────────────────────────────────────────── */

export default function ShareMemorySheet({ initialEntry, allEntries, onClose }: ShareMemorySheetProps) {
    const { apiFetch } = useApi();
    const toast = useToast();
    const [isMounted, setIsMounted] = useState(false);

    // Steps: 0 = select entries, 1 = pick recipients, 2 = confirm, 3 = done
    const [step, setStep] = useState(0);
    const [direction, setDirection] = useState(1);

    // Step 0 — entry selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set([initialEntry.id]));
    const [showMore, setShowMore] = useState(false);

    // Step 1 — recipient picker
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
    const [recentUsers, setRecentUsers] = useState<SearchUser[]>([]);
    const [selectedRecipients, setSelectedRecipients] = useState<SearchUser[]>([]);
    const [searching, setSearching] = useState(false);
    const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

    // Step 2 — message
    const [message, setMessage] = useState('');

    // Step 3 — sending
    const [sending, setSending] = useState(false);

    const goForward = () => { setDirection(1); setStep((s) => s + 1); };
    const goBack = () => { setDirection(-1); setStep((s) => s - 1); };

    // Load recent recipients on mount
    useEffect(() => {
        apiFetch(`${API_URL}/memory-share/users/recent?limit=5`)
            .then(async (r) => { if (r.ok) { const d = await r.json(); setRecentUsers(d.users ?? []); } })
            .catch(() => {});
    }, [apiFetch]);

    useEffect(() => {
        setIsMounted(true);

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    // Debounced user search
    useEffect(() => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (searchQuery.trim().length < 2) { setSearchResults([]); setSearching(false); return; }
        setSearching(true);
        searchTimeout.current = setTimeout(async () => {
            try {
                const r = await apiFetch(`${API_URL}/memory-share/users/search?q=${encodeURIComponent(searchQuery)}&limit=8`);
                if (r.ok) { const d = await r.json(); setSearchResults(d.users ?? []); }
            } catch { /* ignore */ }
            setSearching(false);
        }, 300);
        return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
    }, [searchQuery, apiFetch]);

    const toggleEntry = useCallback((id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) { if (next.size > 1) next.delete(id); }
            else if (next.size < 10) next.add(id);
            return next;
        });
    }, []);

    const addRecipient = useCallback((user: SearchUser) => {
        setSelectedRecipients((prev) => {
            if (prev.length >= 5 || prev.some((r) => r.id === user.id)) return prev;
            return [...prev, user];
        });
    }, []);

    const removeRecipient = useCallback((id: string) => {
        setSelectedRecipients((prev) => prev.filter((r) => r.id !== id));
    }, []);

    const handleSend = useCallback(async () => {
        setSending(true);
        try {
            const r = await apiFetch(`${API_URL}/memory-share/bundles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    entryIds: [...selectedIds],
                    recipientIds: selectedRecipients.map((u) => u.id),
                    message: message.trim() || undefined,
                }),
            });
            if (!r.ok) { const d = await r.json().catch(() => ({})); toast.error(d.message || 'Failed to share'); setSending(false); return; }
            setDirection(1);
            setStep(3);
            toast.success('Memories shared', 'They will see them next time they open Notive.');
        } catch {
            toast.error('Something went wrong');
        }
        setSending(false);
    }, [apiFetch, selectedIds, selectedRecipients, message, toast]);

    const recipientNames = useMemo(
        () => selectedRecipients.map((r) => r.name || 'Someone').join(', '),
        [selectedRecipients],
    );

    /* ─── Render helpers ───────────────────────────────── */

    const renderCompactCard = (entry: ShareableEntry, checked: boolean, onClick?: () => void) => (
        <button
            key={entry.id}
            type="button"
            onClick={onClick}
            className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                checked
                    ? 'border-[rgba(107,143,113,0.4)] bg-[rgba(107,143,113,0.08)]'
                    : 'border-[rgba(92,92,92,0.12)] bg-white/60 hover:bg-white/80'
            }`}
        >
            <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                checked ? 'border-[rgb(107,143,113)] bg-[rgb(107,143,113)]' : 'border-[rgba(92,92,92,0.25)] bg-white'
            }`}>
                {checked && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6l2.5 2.5 4.5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    {entry.mood && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: MOOD_COLORS[entry.mood] || '#94A3B8' }} />}
                    <span className="truncate text-[0.78rem] font-medium text-[rgb(var(--paper-ink))]">{entry.title || 'Untitled'}</span>
                    <span className="ml-auto shrink-0 text-[0.65rem] text-[rgb(107,107,107)]">
                        {new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                </div>
                <p className="mt-0.5 line-clamp-1 text-[0.72rem] text-[rgb(130,130,130)]">{truncate(entry.content, 80)}</p>
            </div>
        </button>
    );

    /* ─── Steps ────────────────────────────────────────── */

    const stepContent = [
        // Step 0 — Select entries
        <div key="step0" className="space-y-4">
            <div>
                <p className="section-label">Sharing</p>
                <h3 className="notebook-title mt-1 text-lg">Choose memories to share</h3>
                <p className="mt-1 text-[0.75rem] text-[rgb(130,130,130)]">{selectedIds.size} of 10 selected</p>
            </div>
            <div className="space-y-2">
                {renderCompactCard(initialEntry, selectedIds.has(initialEntry.id), () => toggleEntry(initialEntry.id))}
            </div>
            {!showMore && allEntries.length > 1 && (
                <button type="button" onClick={() => setShowMore(true)} className="workspace-button-outline w-full rounded-xl py-2.5 text-[0.78rem] font-semibold">
                    + Add more memories
                </button>
            )}
            {showMore && (
                <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                    {allEntries.filter((e) => e.id !== initialEntry.id).slice(0, 19).map((e) =>
                        renderCompactCard(e, selectedIds.has(e.id), () => toggleEntry(e.id))
                    )}
                </div>
            )}
        </div>,

        // Step 1 — Choose recipients
        <div key="step1" className="space-y-4">
            <div>
                <p className="section-label">Recipients</p>
                <h3 className="notebook-title mt-1 text-lg">Who should see this?</h3>
            </div>
            {selectedRecipients.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {selectedRecipients.map((u) => (
                        <span key={u.id} className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(107,143,113,0.35)] bg-[rgba(107,143,113,0.08)] px-2.5 py-1 text-[0.72rem] font-medium text-[rgb(var(--paper-ink))]">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgb(107,143,113)] text-[0.6rem] font-bold text-white">{avatarInitial(u.name)}</span>
                            {u.name || u.email}
                            <button type="button" onClick={() => removeRecipient(u.id)} className="ml-0.5 text-[rgb(130,130,130)] hover:text-[rgb(var(--paper-ink))]">&times;</button>
                        </span>
                    ))}
                </div>
            )}
            <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or email..."
                className="workspace-input w-full rounded-xl px-3 py-2.5 text-[0.82rem]"
            />
            {searching && <p className="text-[0.72rem] text-[rgb(130,130,130)]">Searching...</p>}
            {searchResults.length > 0 && (
                <div className="max-h-44 space-y-1 overflow-y-auto">
                    {searchResults
                        .filter((u) => !selectedRecipients.some((r) => r.id === u.id))
                        .map((u) => (
                            <button
                                key={u.id}
                                type="button"
                                onClick={() => addRecipient(u)}
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[rgba(107,143,113,0.06)]"
                            >
                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(107,143,113,0.14)] text-[0.72rem] font-bold text-[rgb(107,143,113)]">{avatarInitial(u.name)}</span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[0.78rem] font-medium text-[rgb(var(--paper-ink))]">{u.name || 'Notive User'}</p>
                                    <p className="truncate text-[0.65rem] text-[rgb(130,130,130)]">{u.email}</p>
                                </div>
                            </button>
                        ))}
                </div>
            )}
            {!searchQuery && recentUsers.length > 0 && (
                <div>
                    <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[rgb(130,130,130)]">Recent</p>
                    <div className="flex flex-wrap gap-2">
                        {recentUsers
                            .filter((u) => !selectedRecipients.some((r) => r.id === u.id))
                            .map((u) => (
                                <button
                                    key={u.id}
                                    type="button"
                                    onClick={() => addRecipient(u)}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(92,92,92,0.12)] bg-white/70 px-2.5 py-1.5 text-[0.72rem] transition-colors hover:border-[rgba(107,143,113,0.3)] hover:bg-[rgba(107,143,113,0.06)]"
                                >
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(107,143,113,0.14)] text-[0.55rem] font-bold text-[rgb(107,143,113)]">{avatarInitial(u.name)}</span>
                                    {u.name || u.email}
                                </button>
                            ))}
                    </div>
                </div>
            )}
        </div>,

        // Step 2 — Message + confirm
        <div key="step2" className="space-y-4">
            <div>
                <p className="section-label">Almost there</p>
                <h3 className="notebook-title mt-1 text-lg">Add a note?</h3>
            </div>
            <textarea
                value={message}
                onChange={(e) => { if (e.target.value.length <= 500) setMessage(e.target.value); }}
                placeholder="Add a personal note (optional)"
                rows={3}
                className="workspace-input w-full resize-none rounded-xl px-3 py-2.5 text-[0.82rem]"
            />
            <p className="text-right text-[0.65rem] text-[rgb(130,130,130)]">{message.length}/500</p>
            <div className="rounded-xl border border-[rgba(92,92,92,0.1)] bg-[rgba(248,244,237,0.6)] px-3 py-2.5">
                <p className="text-[0.72rem] leading-5 text-[rgb(130,130,130)]">
                    They&apos;ll see a snapshot of your entries as they are now. Future edits stay private.
                </p>
            </div>
            <div className="space-y-1.5 text-[0.75rem] text-[rgb(var(--paper-ink))]">
                <p><span className="font-medium">{selectedIds.size}</span> {selectedIds.size === 1 ? 'memory' : 'memories'}</p>
                <p>To: <span className="font-medium">{recipientNames}</span></p>
            </div>
        </div>,

        // Step 3 — Done
        <div key="step3" className="flex flex-col items-center py-6 text-center">
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.15, 1] }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(107,143,113,0.14)]"
            >
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M7 14.5l5 5L21 9" stroke="rgb(107,143,113)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </motion.div>
            <h3 className="notebook-title mt-4 text-lg">Shared with {recipientNames}</h3>
            <p className="mt-2 text-[0.78rem] text-[rgb(130,130,130)]">They&apos;ll see it next time they open their timeline.</p>
        </div>,
    ];

    const canProceed = [
        selectedIds.size > 0,
        selectedRecipients.length > 0,
        true,
        true,
    ];

    if (!isMounted) {
        return null;
    }

    return createPortal((
        <AnimatePresence>
            {/* Backdrop */}
            <motion.div
                key="share-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Sheet */}
            <motion.div
                key="share-sheet"
                initial={{ opacity: 0, y: '100%' }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: '100%' }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="fixed inset-x-0 bottom-0 z-[100] max-h-[85vh] overflow-hidden rounded-t-[1.5rem] border-t border-[rgba(92,92,92,0.12)] bg-[rgb(var(--paper-bg))] shadow-xl md:inset-x-auto md:inset-y-0 md:m-auto md:max-h-[560px] md:max-w-lg md:rounded-[1.5rem] md:border"
                style={{ bottom: 'var(--app-bottom-clearance, 0px)' }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Share memories"
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[rgba(92,92,92,0.1)] px-5 py-3">
                    <div className="flex gap-1.5">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className={`h-1 rounded-full transition-all ${i <= step && step < 3 ? 'w-6 bg-[rgb(107,143,113)]' : 'w-3 bg-[rgba(92,92,92,0.18)]'}`} />
                        ))}
                    </div>
                    <button type="button" onClick={onClose} className="text-[0.78rem] font-medium text-[rgb(130,130,130)] hover:text-[rgb(var(--paper-ink))]">
                        {step === 3 ? 'Done' : 'Cancel'}
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: 'calc(85vh - 120px)' }}>
                    <AnimatePresence mode="wait" custom={direction}>
                        <motion.div
                            key={step}
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.22, ease: 'easeInOut' }}
                        >
                            {stepContent[step]}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Footer */}
                {step < 3 && (
                    <div className="flex items-center gap-3 border-t border-[rgba(92,92,92,0.1)] px-5 py-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.75rem)' }}>
                        {step > 0 && (
                            <button type="button" onClick={goBack} className="workspace-button-outline rounded-xl px-4 py-2.5 text-[0.78rem] font-semibold">
                                Back
                            </button>
                        )}
                        <button
                            type="button"
                            disabled={!canProceed[step] || sending}
                            onClick={step === 2 ? handleSend : goForward}
                            className="workspace-button-primary ml-auto rounded-xl px-5 py-2.5 text-[0.78rem] font-semibold disabled:opacity-40"
                        >
                            {sending ? 'Sharing...' : step === 2 ? `Share ${selectedIds.size} ${selectedIds.size === 1 ? 'memory' : 'memories'}` : 'Next'}
                        </button>
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    ), document.body);
}
