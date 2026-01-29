'use client';

import React, { useEffect, useState } from 'react';
import { useGamification, BADGES } from '@/context/gamification-context';
import { Flame, Rocket, Sparkles, Trophy } from 'lucide-react';

const Confetti = () => {
    const [particles, setParticles] = useState<Array<{ id: number; x: number; color: string; delay: number }>>([]);

    useEffect(() => {
        const colors = ['#6366f1', '#ec4899', '#22c55e', '#f59e0b', '#06b6d4', '#8b5cf6'];
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
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={dismissCelebration}>
                <div className="glass-card p-8 rounded-3xl text-center max-w-sm animate-celebration" onClick={(e) => e.stopPropagation()}>
                    {celebrationType === 'badge' && newBadge && (
                        <>
                            <div className="flex justify-center mb-4 animate-bounce">
                                {(() => {
                                    const BadgeIcon = newBadge.icon;
                                    return <BadgeIcon className="w-12 h-12 text-white" />;
                                })()}
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Badge Unlocked!</h2>
                            <p className="text-xl text-primary mb-2">{newBadge.name}</p>
                            <p className="text-slate-400 mb-6">{newBadge.description}</p>
                        </>
                    )}

                    {celebrationType === 'levelup' && (
                        <>
                            <div className="flex justify-center mb-4">
                                <Trophy className="w-12 h-12 text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Level Up!</h2>
                            <p className="text-5xl font-bold text-primary mb-2">{stats?.level}</p>
                            <p className="text-slate-400 mb-6">You're becoming a journaling master!</p>
                        </>
                    )}

                    {celebrationType === 'streak' && (
                        <>
                            <div className="flex justify-center mb-4">
                                <Flame className="w-12 h-12 text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Streak Milestone!</h2>
                            <p className="text-5xl font-bold text-orange-500 mb-2">{stats?.currentStreak} Days</p>
                            <p className="text-slate-400 mb-6">Keep the momentum going!</p>
                        </>
                    )}

                    <button
                        onClick={dismissCelebration}
                        className="px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-all"
                    >
                        <span className="inline-flex items-center gap-2">
                            <Rocket className="w-4 h-4" /> Awesome!
                        </span>
                    </button>
                </div>
            </div>
        </>
    );
}
