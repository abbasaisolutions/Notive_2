'use client';

import React, { useState, useEffect } from 'react';
import { contextService } from '@/services/context.service';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';

export default function SmartPromptNotification() {
    const router = useRouter();
    const { user } = useAuth();
    const [prompt, setPrompt] = useState<string | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (!user) return;

        // Check for prompts periodically
        const checkForPrompts = async () => {
            // Only show prompts during active hours (not late night)
            const hour = new Date().getHours();
            if (hour < 6 || hour > 23) return;

            // Don't show if user recently journaled (check localStorage)
            const lastEntry = localStorage.getItem('lastEntryTime');
            if (lastEntry) {
                const timeSinceLastEntry = Date.now() - parseInt(lastEntry);
                // Don't prompt if user journaled in the last 4 hours
                if (timeSinceLastEntry < 4 * 60 * 60 * 1000) return;
            }

            // Generate context-aware prompt
            const promptData = await contextService.generatePrompt();
            setPrompt(promptData.text);
            setIsVisible(true);

            // Auto-hide after 10 seconds
            setTimeout(() => {
                setIsVisible(false);
            }, 10000);
        };

        // Check on mount
        checkForPrompts();

        // Check every 2 hours
        const interval = setInterval(checkForPrompts, 2 * 60 * 60 * 1000);

        return () => clearInterval(interval);
    }, [user]);

    const handleAccept = () => {
        setIsVisible(false);
        router.push('/entry/new?prompt=' + encodeURIComponent(prompt || ''));
    };

    const handleDismiss = () => {
        setIsVisible(false);
        // Remember dismissal to avoid showing again too soon
        localStorage.setItem('lastPromptDismissed', Date.now().toString());
    };

    if (!isVisible || !prompt) return null;

    return (
        <div className="fixed top-20 right-6 z-40 max-w-sm animate-slide-in-right">
            <div className="glass-card rounded-2xl p-4 shadow-2xl border border-white/10">
                {/* Icon */}
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" x2="12" y1="19" y2="22" />
                        </svg>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                        <h3 className="text-sm font-medium text-white mb-1">
                            Time to reflect?
                        </h3>
                        <p className="text-sm text-slate-300 mb-3">
                            {prompt}
                        </p>

                        {/* Actions */}
                        <div className="flex gap-2">
                            <button
                                onClick={handleAccept}
                                className="flex-1 py-2 px-3 bg-primary hover:bg-primary/80 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                Start Journaling
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="py-2 px-3 text-slate-400 hover:text-white text-sm transition-colors"
                            >
                                Later
                            </button>
                        </div>
                    </div>

                    {/* Close button */}
                    <button
                        onClick={handleDismiss}
                        className="text-slate-400 hover:text-white transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
