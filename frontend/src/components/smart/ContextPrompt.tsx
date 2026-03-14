'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiCpu } from 'react-icons/fi';

export default function ContextPrompt() {
    const [isVisible, setIsVisible] = useState(false);
    const [message, setMessage] = useState('');
    const router = useRouter();

    useEffect(() => {
        const handlePrompt = (e: Event) => {
            const customEvent = e as CustomEvent;
            setMessage(customEvent.detail.message);
            setIsVisible(true);
        };

        window.addEventListener('smart-prompt', handlePrompt);
        return () => window.removeEventListener('smart-prompt', handlePrompt);
    }, []);

    const handleDismiss = () => {
        setIsVisible(false);
    };

    const handleAction = () => {
        setIsVisible(false);
        // Navigate to new entry with pre-filled context (conceptually)
        // We could pass query params here like ?context=workout
        router.push('/entry/new');
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-8 right-8 z-50 animate-slide-up">
            <div className="glass-card p-6 rounded-2xl shadow-2xl border border-primary/20 max-w-sm relative overflow-hidden">
                {/* Decorative background */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/20 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

                <div className="flex items-start gap-4 relative z-10">
                    <div className="p-3 rounded-xl bg-primary/20 text-primary">
                        <FiCpu size={24} aria-hidden="true" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white mb-1">Neural Spark</h3>
                        <p className="text-ink-secondary text-sm mb-4">{message}</p>
                        <div className="flex gap-2">
                            <button
                                onClick={handleAction}
                                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
                            >
                                Capture the Moment
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="px-4 py-2 rounded-lg bg-white/5 text-ink-secondary text-sm font-medium hover:bg-white/10 hover:text-white transition-colors"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
