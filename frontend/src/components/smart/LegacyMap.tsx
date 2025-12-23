'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/auth-context';
import { Star, X, Sparkles } from 'lucide-react';
import Skeleton from '@/components/ui/SkeletonLoader';

interface WisdomStar {
    id: string;
    text: string;
    title: string;
    type: string;
    x: number;
    y: number;
    size: number;
}

export default function LegacyMap() {
    const { accessToken } = useAuth();
    const [stars, setStars] = useState<WisdomStar[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedStar, setSelectedStar] = useState<WisdomStar | null>(null);

    useEffect(() => {
        const fetchWisdom = async () => {
            if (!accessToken) return;
            try {
                // Fetching from existing analytics/stats and simulating a distribution
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/analytics/stats`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });

                if (response.ok) {
                    const data = await response.json();
                    // Simulating stars based on stats for the demo
                    // In a real app, this would be a dedicated "wisdom" endpoint
                    const mockStars: WisdomStar[] = [
                        { id: '1', title: 'Resilience', text: 'Growth comes from persistence during difficult chapters.', type: 'wisdom', x: 20, y: 30, size: 2 },
                        { id: '2', title: 'Creativity', text: 'Documenting ideas regularly sparks unexpected connections.', type: 'insight', x: 60, y: 20, size: 1.5 },
                        { id: '3', title: 'Self-Awareness', text: 'Mood tracking reveals patterns in emotional energy.', type: 'growth', x: 40, y: 70, size: 2.5 },
                        { id: '4', title: 'Focus', text: 'Morning journaling sets a clear intention for the day.', type: 'wisdom', x: 75, y: 55, size: 1.8 },
                        { id: '5', title: 'Empathy', text: 'Reflecting on interactions improves relationship depth.', type: 'insight', x: 15, y: 80, size: 1.2 },
                    ];
                    setStars(mockStars);
                }
            } catch (error) {
                console.error('Failed to fetch legacy map data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchWisdom();
    }, [accessToken]);

    if (isLoading) {
        return (
            <div className="h-[70vh] glass-card rounded-3xl flex items-center justify-center overflow-hidden relative">
                <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-3xl" />
                <div className="relative z-10 flex flex-col items-center gap-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary animate-pulse">
                        <circle cx="12" cy="12" r="10" /><path d="m16 10-4 4-4-4" />
                    </svg>
                    <p className="text-slate-400 animate-pulse">Mapping your wisdom constellation...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[75vh] w-full glass-card rounded-3xl relative overflow-hidden bg-slate-950 cursor-crosshair group">
            {/* Background Atmosphere */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent opacity-50" />
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20" />

            {/* Stars Layer */}
            <div className="absolute inset-0">
                {stars.map((star) => (
                    <motion.button
                        key={star.id}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{
                            opacity: 1,
                            scale: 1,
                            y: [0, -10, 0],
                        }}
                        transition={{
                            duration: 2,
                            y: { duration: 4 + Math.random() * 2, repeat: Infinity, ease: "easeInOut" },
                            delay: Math.random() * 2
                        }}
                        onClick={() => setSelectedStar(star)}
                        className="absolute flex items-center justify-center p-4 hover:z-20 group/star"
                        style={{ left: `${star.x}%`, top: `${star.y}%` }}
                    >
                        <div className="relative">
                            <Star
                                className={cn(
                                    "text-white transition-all duration-500 group-hover/star:text-yellow-400 group-hover/star:scale-150",
                                    selectedStar?.id === star.id ? "text-yellow-400 scale-150" : "opacity-60"
                                )}
                                size={12 * star.size}
                                fill={selectedStar?.id === star.id ? "currentColor" : "none"}
                            />
                            <div className="absolute inset-0 bg-white/40 blur-xl group-hover/star:bg-yellow-400/40 rounded-full scale-150 animate-pulse" />

                            {/* Label that shows on hover */}
                            <motion.span
                                className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 rounded-md bg-white/10 backdrop-blur-md border border-white/10 text-[10px] text-white opacity-0 group-hover/star:opacity-100 transition-opacity whitespace-nowrap"
                            >
                                {star.title}
                            </motion.span>
                        </div>
                    </motion.button>
                ))}
            </div>

            {/* Detail Modal */}
            <AnimatePresence>
                {selectedStar && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="absolute bottom-8 left-8 right-8 z-30"
                    >
                        <div className="glass-card p-6 rounded-2xl border-white/20 shadow-2xl relative overflow-hidden max-w-2xl mx-auto">
                            <div className="absolute top-0 right-0 p-2">
                                <button
                                    onClick={() => setSelectedStar(null)}
                                    className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="flex gap-4 items-start">
                                <div className="p-3 rounded-xl bg-yellow-500/20 text-yellow-400">
                                    <Sparkles size={24} />
                                </div>
                                <div className="flex-1">
                                    <div className="text-xs font-bold text-yellow-400 uppercase tracking-widest mb-1">
                                        Extracted Truth
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-3">
                                        {selectedStar.title}
                                    </h3>
                                    <p className="text-slate-300 text-lg leading-relaxed italic">
                                        "{selectedStar.text}"
                                    </p>
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-white/5 flex justify-between items-center text-xs text-slate-500">
                                <span>Reflected on Dec 15, 2025</span>
                                <button className="text-primary hover:underline font-medium">View Original Entry</button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Instructions */}
            <div className="absolute top-6 left-6 text-slate-400 flex items-center gap-2 pointer-events-none group-hover:opacity-0 transition-opacity duration-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><path d="m16 10-4 4-4-4" />
                </svg>
                <span className="text-xs font-medium tracking-wide">EXPLORE YOUR MENTAL LANDSCAPE</span>
            </div>
        </div>
    );
}

// Helper for conditional classes
function cn(...classes: any[]) {
    return classes.filter(Boolean).join(' ');
}
