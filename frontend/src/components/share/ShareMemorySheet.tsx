'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useApi } from '@/hooks/use-api';
import { useToast } from '@/context/toast-context';
import { API_URL } from '@/constants/config';

export type ShareableEntry = {
    id: string;
    title: string | null;
    content: string;
    mood: string | null;
    createdAt: string;
};

type ShareState = 'NONE' | 'PENDING' | 'ACCEPTED' | 'DECLINED';

type SearchUser = {
    id: string;
    name: string | null;
    avatarUrl: string | null;
    email: string;
    shareState: ShareState;
};

type ShareMemorySheetProps = {
    initialEntry: ShareableEntry;
    allEntries: ShareableEntry[];
    onClose: () => void;
};

type ShareDeliverySummary = {
    acceptedCount: number;
    pendingCount: number;
    recipientCount: number;
};

const MOOD_COLORS: Record<string, string> = {
    happy: '#F59E0B', excited: '#EF4444', calm: '#6B8F71',
    thoughtful: '#6366F1', tired: '#94A3B8', sad: '#3B82F6',
    anxious: '#F97316', frustrated: '#DC2626', grateful: '#10B981',
    motivated: '#8B5CF6',
};

const SHARE_STATE_META: Record<ShareState, { label: string; tone: string; selectable: boolean }> = {
    NONE: {
        label: 'First share needs approval',
        tone: 'border-[rgba(107,143,113,0.18)] bg-[rgba(107,143,113,0.08)] text-[rgb(107,143,113)]',
        selectable: true,
    },
    PENDING: {
        label: 'Waiting for approval',
        tone: 'border-[rgba(217,119,6,0.18)] bg-[rgba(245,158,11,0.08)] text-[rgb(180,83,9)]',
        selectable: true,
    },
    ACCEPTED: {
        label: 'Can share now',
        tone: 'border-[rgba(14,116,144,0.18)] bg-[rgba(14,116,144,0.08)] text-[rgb(14,116,144)]',
        selectable: true,
    },
    DECLINED: {
        label: 'Not accepting right now',
        tone: 'border-[rgba(220,38,38,0.15)] bg-[rgba(220,38,38,0.08)] text-[rgb(185,28,28)]',
        selectable: false,
    },
};

const avatarInitial = (name: string | null) => (name || '?').charAt(0).toUpperCase();
const truncate = (text: string, len: number) => (text.length <= len ? text : `${text.slice(0, len).trimEnd()}...`);

const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};

const getCompletionCopy = (summary: ShareDeliverySummary, recipientNames: string) => {
    if (summary.pendingCount > 0 && summary.acceptedCount === 0) {
        return {
            title: `Request sent to ${recipientNames}`,
            body: "They'll need to accept before these memories appear in Shared.",
        };
    }

    if (summary.pendingCount > 0) {
        return {
            title: `Shared with ${recipientNames}`,
            body: `${summary.acceptedCount} ${summary.acceptedCount === 1 ? 'person can' : 'people can'} see it now. ${summary.pendingCount} ${summary.pendingCount === 1 ? 'person is' : 'people are'} waiting on approval.`,
        };
    }

    return {
        title: `Shared with ${recipientNames}`,
        body: "They'll see it in Shared the next time they open Notive.",
    };
};

export default function ShareMemorySheet({ initialEntry, allEntries, onClose }: ShareMemorySheetProps) {
    const { apiFetch } = useApi();
    const toast = useToast();
    const [isMounted, setIsMounted] = useState(false);
    const [step, setStep] = useState(0);
    const [direction, setDirection] = useState(1);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set([initialEntry.id]));
    const [showMore, setShowMore] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
    const [recentUsers, setRecentUsers] = useState<SearchUser[]>([]);
    const [selectedRecipients, setSelectedRecipients] = useState<SearchUser[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState(false);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [completionTitle, setCompletionTitle] = useState('Shared');
    const [completionBody, setCompletionBody] = useState("They'll see it in Shared the next time they open Notive.");
    const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

    const goForward = () => { setDirection(1); setStep((current) => current + 1); };
    const goBack = () => { setDirection(-1); setStep((current) => current - 1); };

    useEffect(() => {
        apiFetch(`${API_URL}/memory-share/users/recent?limit=5`)
            .then(async (response) => {
                if (!response.ok) return;
                const data = await response.json();
                setRecentUsers(data.users ?? []);
            })
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

    useEffect(() => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (searchQuery.trim().length < 2) {
            setSearchResults([]);
            setSearchError(false);
            setSearching(false);
            return;
        }

        setSearching(true);
        setSearchError(false);
        searchTimeout.current = setTimeout(async () => {
            try {
                const response = await apiFetch(`${API_URL}/memory-share/users/search?q=${encodeURIComponent(searchQuery)}&limit=8`);
                if (response.ok) {
                    const data = await response.json();
                    setSearchResults(data.users ?? []);
                } else {
                    setSearchError(true);
                    setSearchResults([]);
                }
            } catch {
                setSearchError(true);
                setSearchResults([]);
            }
            setSearching(false);
        }, 300);

        return () => {
            if (searchTimeout.current) clearTimeout(searchTimeout.current);
        };
    }, [searchQuery, apiFetch]);

    const toggleEntry = useCallback((id: string) => {
        setSelectedIds((previous) => {
            const next = new Set(previous);
            if (next.has(id)) {
                if (next.size > 1) next.delete(id);
            } else if (next.size < 10) {
                next.add(id);
            }
            return next;
        });
    }, []);

    const addRecipient = useCallback((user: SearchUser) => {
        if (!SHARE_STATE_META[user.shareState].selectable) {
            return;
        }

        setSelectedRecipients((previous) => {
            if (previous.length >= 5 || previous.some((recipient) => recipient.id === user.id)) {
                return previous;
            }
            return [...previous, user];
        });
    }, []);

    const removeRecipient = useCallback((id: string) => {
        setSelectedRecipients((previous) => previous.filter((recipient) => recipient.id !== id));
    }, []);

    const recipientNames = useMemo(
        () => selectedRecipients.map((recipient) => recipient.name || 'Someone').join(', '),
        [selectedRecipients],
    );

    const approvalRecipientCount = useMemo(
        () => selectedRecipients.filter((recipient) => recipient.shareState !== 'ACCEPTED').length,
        [selectedRecipients],
    );

    const handleSend = useCallback(async () => {
        setSending(true);
        try {
            const response = await apiFetch(`${API_URL}/memory-share/bundles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    entryIds: [...selectedIds],
                    recipientIds: selectedRecipients.map((user) => user.id),
                    message: message.trim() || undefined,
                }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                toast.error(data.message || 'Couldn\u2019t share these memories. Try again?');
                setSending(false);
                return;
            }

            const data = await response.json().catch(() => ({}));
            const delivery = (data.delivery ?? {
                acceptedCount: selectedRecipients.length,
                pendingCount: 0,
                recipientCount: selectedRecipients.length,
            }) as ShareDeliverySummary;

            const nextCompletion = getCompletionCopy(delivery, recipientNames);
            setCompletionTitle(nextCompletion.title);
            setCompletionBody(nextCompletion.body);
            setDirection(1);
            setStep(3);

            if (delivery.pendingCount > 0 && delivery.acceptedCount === 0) {
                toast.success('Share request sent', "They'll need to accept before these memories appear in Shared.");
            } else if (delivery.pendingCount > 0) {
                toast.success(
                    'Shared and pending approval',
                    `${delivery.acceptedCount} ${delivery.acceptedCount === 1 ? 'person can' : 'people can'} see it now. ${delivery.pendingCount} ${delivery.pendingCount === 1 ? 'person is' : 'people are'} waiting on approval.`,
                );
            } else {
                toast.success('Memories shared', "They'll see them in Shared the next time they open Notive.");
            }
        } catch {
            toast.error('Couldn\u2019t complete the share. Try again?');
        }
        setSending(false);
    }, [apiFetch, selectedIds, selectedRecipients, message, recipientNames, toast]);

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
                {checked && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6l2.5 2.5 4.5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )}
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

    const renderRecipientOption = (user: SearchUser) => {
        const meta = SHARE_STATE_META[user.shareState];
        const isDisabled = !meta.selectable;

        return (
            <button
                key={user.id}
                type="button"
                onClick={() => addRecipient(user)}
                disabled={isDisabled}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    isDisabled
                        ? 'cursor-not-allowed opacity-60'
                        : 'hover:bg-[rgba(107,143,113,0.06)]'
                }`}
            >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(107,143,113,0.14)] text-[0.72rem] font-bold text-[rgb(107,143,113)]">
                    {avatarInitial(user.name)}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <p className="truncate text-[0.78rem] font-medium text-[rgb(var(--paper-ink))]">{user.name || 'Notive User'}</p>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.08em] ${meta.tone}`}>
                            {meta.label}
                        </span>
                    </div>
                    <p className="truncate text-[0.65rem] text-[rgb(130,130,130)]">{user.email}</p>
                </div>
            </button>
        );
    };

    const stepContent = [
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
                    {allEntries.filter((entry) => entry.id !== initialEntry.id).slice(0, 19).map((entry) => (
                        renderCompactCard(entry, selectedIds.has(entry.id), () => toggleEntry(entry.id))
                    ))}
                </div>
            )}
        </div>,

        <div key="step1" className="space-y-4">
            <div>
                <p className="section-label">Recipients</p>
                <h3 className="notebook-title mt-1 text-lg">Who should see this?</h3>
                <p className="mt-1 text-[0.72rem] text-[rgb(130,130,130)]">Anyone can show up in search. First-time shares stay pending until they accept.</p>
            </div>
            {selectedRecipients.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {selectedRecipients.map((user) => (
                        <span key={user.id} className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(107,143,113,0.35)] bg-[rgba(107,143,113,0.08)] px-2.5 py-1 text-[0.72rem] font-medium text-[rgb(var(--paper-ink))]">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgb(107,143,113)] text-[0.6rem] font-bold text-white">{avatarInitial(user.name)}</span>
                            {user.name || user.email}
                            <button type="button" onClick={() => removeRecipient(user.id)} className="ml-0.5 text-[rgb(130,130,130)] hover:text-[rgb(var(--paper-ink))]">&times;</button>
                        </span>
                    ))}
                </div>
            )}
            <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by name or email..."
                className="workspace-input w-full rounded-xl px-3 py-2.5 text-[0.82rem]"
            />
            {searching && <p className="text-[0.72rem] text-[rgb(130,130,130)]">Searching...</p>}
            {searchError && (
                <div className="rounded-xl border border-dashed border-[rgba(220,38,38,0.2)] bg-[rgba(220,38,38,0.04)] px-3 py-3 text-[0.72rem] text-[rgb(185,28,28)]">
                    Search is temporarily unavailable. Please try again in a moment.
                </div>
            )}
            {!searchError && searchResults.length > 0 && (
                <div className="max-h-52 space-y-1 overflow-y-auto">
                    {searchResults
                        .filter((user) => !selectedRecipients.some((recipient) => recipient.id === user.id))
                        .map((user) => renderRecipientOption(user))}
                </div>
            )}
            {!searching && !searchError && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                <div className="rounded-xl border border-dashed border-[rgba(92,92,92,0.14)] px-3 py-3 text-[0.72rem] text-[rgb(130,130,130)]">
                    No matching people yet. Try a different name or email.
                </div>
            )}
            {!searchQuery && recentUsers.length > 0 && (
                <div>
                    <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[rgb(130,130,130)]">Recent</p>
                    <div className="space-y-1.5">
                        {recentUsers
                            .filter((user) => !selectedRecipients.some((recipient) => recipient.id === user.id))
                            .map((user) => renderRecipientOption(user))}
                    </div>
                </div>
            )}
        </div>,

        <div key="step2" className="space-y-4">
            <div>
                <p className="section-label">Almost there</p>
                <h3 className="notebook-title mt-1 text-lg">Add a note?</h3>
            </div>
            <textarea
                value={message}
                onChange={(event) => { if (event.target.value.length <= 500) setMessage(event.target.value); }}
                placeholder="Add a personal note (optional)"
                rows={3}
                className="workspace-input w-full resize-none rounded-xl px-3 py-2.5 text-[0.82rem]"
            />
            <p className="text-right text-[0.65rem] text-[rgb(130,130,130)]">{message.length}/500</p>
            <div className="rounded-xl border border-[rgba(92,92,92,0.1)] bg-[rgba(248,244,237,0.6)] px-3 py-2.5">
                <p className="text-[0.72rem] leading-5 text-[rgb(130,130,130)]">
                    They&apos;ll see a snapshot of your entries as they are now. Future edits stay private.
                </p>
                {approvalRecipientCount > 0 && (
                    <p className="mt-2 text-[0.72rem] leading-5 text-[rgb(130,130,130)]">
                        {approvalRecipientCount} {approvalRecipientCount === 1 ? 'recipient needs' : 'recipients need'} approval before the memories unlock.
                    </p>
                )}
            </div>
            <div className="space-y-1.5 text-[0.75rem] text-[rgb(var(--paper-ink))]">
                <p><span className="font-medium">{selectedIds.size}</span> {selectedIds.size === 1 ? 'memory' : 'memories'}</p>
                <p>To: <span className="font-medium">{recipientNames}</span></p>
            </div>
        </div>,

        <div key="step3" className="flex flex-col items-center py-6 text-center">
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.15, 1] }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(107,143,113,0.14)]"
            >
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path d="M7 14.5l5 5L21 9" stroke="rgb(107,143,113)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </motion.div>
            <h3 className="notebook-title mt-4 text-lg">{completionTitle}</h3>
            <p className="mt-2 text-[0.78rem] text-[rgb(130,130,130)]">{completionBody}</p>
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
            <motion.div
                key="share-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            <motion.div
                key="share-sheet"
                initial={{ opacity: 0, y: '100%' }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: '100%' }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="fixed inset-x-0 bottom-0 z-[100] max-h-[85vh] overflow-hidden rounded-t-[1.5rem] border-t border-[rgba(92,92,92,0.12)] bg-[rgb(var(--paper-bg))] shadow-xl md:inset-x-auto md:inset-y-0 md:m-auto md:max-h-[560px] md:max-w-lg md:rounded-[1.5rem] md:border"
                style={{ bottom: 'var(--app-bottom-clearance, 0px)' }}
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Share memories"
            >
                <div className="flex items-center justify-between border-b border-[rgba(92,92,92,0.1)] px-5 py-3">
                    <div className="flex gap-1.5">
                        {[0, 1, 2].map((index) => (
                            <div key={index} className={`h-1 rounded-full transition-all ${index <= step && step < 3 ? 'w-6 bg-[rgb(107,143,113)]' : 'w-3 bg-[rgba(92,92,92,0.18)]'}`} />
                        ))}
                    </div>
                    <button type="button" onClick={onClose} className="text-[0.78rem] font-medium text-[rgb(130,130,130)] hover:text-[rgb(var(--paper-ink))]">
                        {step === 3 ? 'Done' : 'Cancel'}
                    </button>
                </div>

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
