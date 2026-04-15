'use client';

import React, { useEffect, useState } from 'react';
import { useGamification } from '@/context/gamification-context';
import { FiAward, FiTrendingUp } from 'react-icons/fi';

const Confetti = () => {
    const [particles, setParticles] = useState<Array<{ id: number; x: number; color: string; delay: number }>>([]);

    useEffect(() => {
        const colors = ['#64748b', '#6b7280', '#78716c', '#52525b', '#334155', '#94a3b8'];
        const newParticles = Array.from({ length: 50 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            color: colors[Math.floor(Math.random() * colors.length)],
            delay: Math.random() * 0.5,
        }));
        setParticles(newParticles);
    }, []);

    return (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
            {particles.map((p) => (
                <div
                    key={p.id}
                    className="absolute w-3 h-3 rounded-full animate-confetti"
                    style={{
                        left: `${p.x}%`,
                        backgroundColor: p.color,
                        animationDelay: `${p.delay}s`,
                    }}
                />
            ))}
        </div>
    );
};

export default function CelebrationModal() {
    const { showCelebration, celebrationType, newBadge, dismissCelebration, stats } = useGamification();

    if (!showCelebration) return null;

    return (
        <>
            <Confetti />
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onClick={dismissCelebration}
                onKeyDown={(e) => { if (e.key === 'Escape') dismissCelebration(); }}
            >
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Celebration"
                    className="workspace-panel p-8 rounded-3xl text-center max-w-sm animate-celebration"
                    onClick={(e) => e.stopPropagation()}
                >
                    {celebrationType === 'badge' && newBadge && (
                        <>
                            <div className="mb-4 flex items-center justify-center text-primary animate-bounce">
                                {(() => {
                                    const BadgeIcon = newBadge.icon;
                                    return <BadgeIcon size={56} aria-hidden="true" />;
                                })()}
                            </div>
                            <h2 className="text-2xl font-bold text-ink mb-2">Badge Unlocked!</h2>
                            <p className="text-xl text-primary mb-2">{newBadge.name}</p>
                            <p className="text-ink-secondary mb-6">{newBadge.description}</p>
                        </>
                    )}

                    {celebrationType === 'levelup' && (
                        <>
                            <div className="mb-4 flex items-center justify-center text-primary">
                                <FiAward size={56} aria-hidden="true" />
                            </div>
                            <h2 className="text-2xl font-bold text-ink mb-2">Level Up!</h2>
                            <p className="text-5xl font-bold text-primary mb-2">{stats?.level}</p>
                            <p className="text-ink-secondary mb-6">You&apos;re building a deeper memory-and-signal practice.</p>
                        </>
                    )}

                    {celebrationType === 'streak' && (
                        <>
                            <div className="mb-4 flex items-center justify-center text-primary">
                                <FiTrendingUp size={56} aria-hidden="true" />
                            </div>
                            <h2 className="text-2xl font-bold text-ink mb-2">Streak Milestone!</h2>
                            <p className="text-5xl font-bold text-primary mb-2">{stats?.currentStreak} Days</p>
                            <p className="text-ink-secondary mb-6">Keep the momentum going!</p>
                        </>
                    )}

                    <button
                        onClick={dismissCelebration}
                        className="px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-all"
                    >
                        Awesome
                    </button>
                </div>
            </div>
        </>
    );
}
