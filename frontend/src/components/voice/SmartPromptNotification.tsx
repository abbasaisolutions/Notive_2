'use client';

import React, { useState, useEffect } from 'react';
import { contextService, type PromptData } from '@/services/context.service';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { API_URL } from '@/constants/config';
import { engagementService } from '@/services/engagement.service';
import useTelemetry from '@/hooks/use-telemetry';
import { normalizePromptBehaviorProfile, promptLearningService } from '@/services/prompt-learning.service';
import { FiMic, FiX } from 'react-icons/fi';
import type { HealthContextSummary } from '@/types/health';

const ENTRY_COOLDOWN_MS = 4 * 60 * 60 * 1000;

type ActivePromptState = PromptData & {
    promptInstanceId: string;
};

const createPromptInstanceId = (): string => {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }

    return `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export default function SmartPromptNotification() {
    const router = useRouter();
    const pathname = usePathname();
    const { user, accessToken } = useAuth();
    const { trackEvent } = useTelemetry();
    const [activePrompt, setActivePrompt] = useState<ActivePromptState | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const promptPresentation = activePrompt
        ? engagementService.getSmartPromptPresentation(activePrompt, user?.id)
        : null;

    useEffect(() => {
        if (!user || !accessToken) return;

        let hideTimeout: number | null = null;

        const fetchHealthContext = async (): Promise<HealthContextSummary | null> => {
            try {
                const response = await fetch(`${API_URL}/health/context/today`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });

                if (!response.ok) {
                    return null;
                }

                const data = await response.json();
                return data.context ?? null;
            } catch (error) {
                console.error('Failed to fetch health prompt context:', error);
                return null;
            }
        };

        const fetchBehaviorProfile = async () => {
            try {
                const response = await fetch(`${API_URL}/analytics/prompt-learning`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });

                if (!response.ok) {
                    return null;
                }

                return normalizePromptBehaviorProfile(await response.json());
            } catch (error) {
                console.error('Failed to fetch prompt learning profile:', error);
                return null;
            }
        };

        // Check for prompts periodically
        const checkForPrompts = async () => {
            if (isVisible || activePrompt || engagementService.shouldSuppressForPath(pathname)) {
                return;
            }

            if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
                return;
            }

            // Only show prompts during active hours (not late night)
            const hour = new Date().getHours();
            if (hour < 6 || hour > 23) return;

            // Don't show if user recently journaled (check localStorage)
            const lastEntry = localStorage.getItem('lastEntryTime');
            if (lastEntry) {
                const timeSinceLastEntry = Date.now() - parseInt(lastEntry, 10);
                // Don't prompt if user journaled in the last 4 hours
                if (timeSinceLastEntry < ENTRY_COOLDOWN_MS) return;
            }

            const [healthContext, remoteBehavior] = await Promise.all([
                fetchHealthContext(),
                fetchBehaviorProfile(),
            ]);
            const behavior = remoteBehavior || promptLearningService.getBehaviorProfileOrEmpty(user.id);

            // Generate context-aware prompt
            const promptData = await contextService.generatePrompt({
                healthContext,
                profile: user.profile,
                behavior,
            });
            const nextPrompt: ActivePromptState = {
                ...promptData,
                promptInstanceId: createPromptInstanceId(),
            };
            const nextPresentation = engagementService.getSmartPromptPresentation(nextPrompt, user.id);

            if (!engagementService.canShowSmartPrompt(user.id, nextPrompt)) {
                return;
            }

            setActivePrompt(nextPrompt);
            setIsVisible(true);
            engagementService.recordSmartPromptShown(user.id, nextPrompt);

            promptLearningService.recordEvent({
                userId: user.id,
                action: 'shown',
                lens: nextPrompt.lens,
                signalKind: nextPrompt.signalKind,
                metric: nextPrompt.metric,
                category: nextPrompt.category,
            });
            void trackEvent({
                eventType: 'SMART_PROMPT_SHOWN',
                field: nextPrompt.lens || nextPrompt.category,
                value: nextPrompt.signalKind || nextPrompt.category,
                metadata: {
                    source: nextPrompt.source,
                    category: nextPrompt.category,
                    lens: nextPrompt.lens || null,
                    signalKind: nextPrompt.signalKind || null,
                    metric: nextPrompt.metric || null,
                    priority: nextPrompt.priority,
                    promptInstanceId: nextPrompt.promptInstanceId,
                    promptExperimentId: nextPresentation.experimentId,
                    promptFramingVariant: nextPresentation.framingVariant,
                },
            });

            // Auto-hide after 10 seconds
            if (hideTimeout) {
                window.clearTimeout(hideTimeout);
            }
            hideTimeout = window.setTimeout(() => {
                setIsVisible(false);
            }, 10000);
        };

        // Check on mount
        void checkForPrompts();

        // Check every 2 hours
        const interval = window.setInterval(() => {
            void checkForPrompts();
        }, 2 * 60 * 60 * 1000);

        return () => {
            window.clearInterval(interval);
            if (hideTimeout) {
                window.clearTimeout(hideTimeout);
            }
        };
    }, [accessToken, activePrompt, isVisible, pathname, trackEvent, user]);

    const trackPromptOutcome = (action: 'accepted' | 'dismissed') => {
        if (!user || !activePrompt) {
            return;
        }

        engagementService.recordSmartPromptOutcome(user.id, action);
        promptLearningService.recordEvent({
            userId: user.id,
            action,
            lens: activePrompt.lens,
            signalKind: activePrompt.signalKind,
            metric: activePrompt.metric,
            category: activePrompt.category,
        });

        void trackEvent({
            eventType: action === 'accepted' ? 'SMART_PROMPT_ACCEPTED' : 'SMART_PROMPT_DISMISSED',
            field: activePrompt.lens || activePrompt.category,
            value: activePrompt.signalKind || activePrompt.category,
            metadata: {
                source: activePrompt.source,
                category: activePrompt.category,
                lens: activePrompt.lens || null,
                signalKind: activePrompt.signalKind || null,
                metric: activePrompt.metric || null,
                priority: activePrompt.priority,
                promptInstanceId: activePrompt.promptInstanceId,
                promptExperimentId: promptPresentation?.experimentId || null,
                promptFramingVariant: promptPresentation?.framingVariant || null,
            },
        });
    };

    const handleAccept = () => {
        trackPromptOutcome('accepted');
        localStorage.setItem('lastEntryTime', Date.now().toString());
        setIsVisible(false);
        setActivePrompt(null);
        router.push('/entry/new?prompt=' + encodeURIComponent(activePrompt?.text || ''));
    };

    const handleDismiss = () => {
        trackPromptOutcome('dismissed');
        setIsVisible(false);
        setActivePrompt(null);
    };

    if (!isVisible || !activePrompt?.text) return null;

    return (
        <div className="fixed top-20 right-6 z-40 max-w-sm animate-slide-in-right">
            <div className="workspace-soft-panel rounded-2xl p-4 shadow-2xl">
                {/* Icon */}
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
                        <FiMic size={20} className="text-white" aria-hidden="true" />
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary/80">
                            {promptPresentation?.eyebrow || 'Good time to write'}
                        </p>
                        <h3 className="text-sm font-medium text-white mb-1">
                            {promptPresentation?.title || 'Write this down while it is fresh'}
                        </h3>
                        <p className="text-sm text-ink-secondary mb-2">
                            {promptPresentation?.body || activePrompt.text}
                        </p>
                        <p className="mb-3 text-xs leading-5 text-ink-muted">
                            {promptPresentation?.reason}
                        </p>

                        {/* Actions */}
                        <div className="flex gap-2">
                            <button
                                onClick={handleAccept}
                                className="flex-1 py-2 px-3 bg-primary hover:bg-primary/80 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                {promptPresentation?.ctaLabel || 'Write now'}
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="py-2 px-3 text-ink-secondary hover:text-white text-sm transition-colors"
                            >
                                {promptPresentation?.laterLabel || 'Not now'}
                            </button>
                        </div>
                    </div>

                    {/* Close button */}
                    <button
                        onClick={handleDismiss}
                        aria-label="Dismiss prompt"
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-ink-secondary hover:text-white transition-colors"
                    >
                        <FiX size={18} aria-hidden="true" />
                    </button>
                </div>
            </div>
        </div>
    );
}
