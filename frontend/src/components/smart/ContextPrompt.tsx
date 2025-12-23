'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/form-elements';

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
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5c0-2 2-2 2-2" />
                            <path d="M8.5 8.5v.01" />
                            <path d="M16 15.5v.01" />
                            <path d="M12 12v.01" />
                            <path d="M11 17v.01" />
                            <path d="M7 14v.01" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="font-bold text-white mb-1">Neural Spark</h3>
                        <p className="text-slate-300 text-sm mb-4">{message}</p>
                        <div className="flex gap-2">
                            <button
                                onClick={handleAction}
                                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
                            >
                                Capture the Moment
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="px-4 py-2 rounded-lg bg-white/5 text-slate-400 text-sm font-medium hover:bg-white/10 hover:text-white transition-colors"
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
