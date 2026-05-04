'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/context/auth-context';
import { SmartSearch } from '@/components/search/SmartSearch';
import { setNativeBackHandler } from '@/utils/native-navigation';
import { GLOBAL_SEARCH_OPEN_EVENT } from '@/utils/global-search';

const isMac = () => typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

export default function GlobalSearchOverlay() {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);

    const close = useCallback(() => setIsOpen(false), []);

    useEffect(() => {
        if (!user) return;

        const openHandler = () => setIsOpen(true);
        const handler = (event: KeyboardEvent) => {
            const mod = isMac() ? event.metaKey : event.ctrlKey;
            if (mod && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setIsOpen((current) => !current);
                return;
            }
            if (event.key === 'Escape' && isOpen) {
                event.preventDefault();
                setIsOpen(false);
            }
        };

        window.addEventListener(GLOBAL_SEARCH_OPEN_EVENT, openHandler);
        window.addEventListener('keydown', handler);
        return () => {
            window.removeEventListener(GLOBAL_SEARCH_OPEN_EVENT, openHandler);
            window.removeEventListener('keydown', handler);
        };
    }, [isOpen, user]);

    useEffect(() => {
        if (!isOpen) return;

        setNativeBackHandler(() => {
            setIsOpen(false);
            return true;
        });

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
            setNativeBackHandler(null);
        };
    }, [isOpen]);

    if (!user) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="global-search-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Search your notes"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto bg-[rgba(41,32,22,0.32)] px-3 pb-6 pt-4 backdrop-blur-sm sm:px-4 sm:pt-20 md:pt-28"
                    onClick={close}
                >
                    <motion.div
                        initial={{ opacity: 0, y: -12, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
                        className="w-full max-w-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <SmartSearch autoFocus onResultClick={close} />
                        <p className="type-micro mt-3 text-center text-muted">
                            <kbd className="rounded border border-[rgba(92,92,92,0.2)] bg-white/60 px-1.5 py-0.5 text-[0.7rem] font-semibold">Esc</kbd> to close
                            <span className="mx-2">·</span>
                            <kbd className="rounded border border-[rgba(92,92,92,0.2)] bg-white/60 px-1.5 py-0.5 text-[0.7rem] font-semibold">{isMac() ? '⌘' : 'Ctrl'} K</kbd> to toggle
                        </p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
