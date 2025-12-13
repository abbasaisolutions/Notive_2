'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface Entry {
    id: string;
    title: string | null;
    content: string;
    mood: string | null;
    category: 'PERSONAL' | 'PROFESSIONAL';
    createdAt: string;
    coverImage: string | null;
    skills?: string[];
    lessons?: string[];
}

interface TimelineViewProps {
    entries: Entry[];
}

export default function TimelineView({ entries }: TimelineViewProps) {
    // Sort entries by date desc
    const sortedEntries = useMemo(() => {
        return [...entries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [entries]);

    return (
        <div className="relative py-10 px-4">
            {/* Center Line */}
            <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/50 via-purple-500/30 to-transparent" />

            <div className="space-y-12">
                {sortedEntries.map((entry, index) => {
                    const isLeft = index % 2 === 0;

                    return (
                        <motion.div
                            key={entry.id}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-100px" }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            className={`relative flex flex-col md:flex-row gap-8 ${isLeft ? 'md:flex-row-reverse' : ''}`}
                        >
                            {/* Date Node */}
                            <div className="absolute left-4 md:left-1/2 w-4 h-4 bg-primary rounded-full transform -translate-x-1/2 mt-6 border-4 border-slate-900 z-10 shadow-[0_0_15px_rgba(99,102,241,0.5)]" />

                            {/* Content Card */}
                            <div className="flex-1 md:w-1/2 pl-12 md:pl-0">
                                <Link href={`/entry/view?id=${entry.id}`} className="block group">
                                    <div className="glass-card p-6 rounded-2xl border border-white/5 hover:border-primary/30 transition-all duration-300 hover:transform hover:-translate-y-1 relative overflow-hidden">
                                        {/* Colorful Glow */}
                                        <div className={`absolute -right-10 -top-10 w-32 h-32 blur-[60px] opacity-20 rounded-full pointer-events-none transition-opacity group-hover:opacity-40
                                            ${entry.mood === 'Happy' ? 'bg-yellow-500' :
                                                entry.mood === 'Sad' ? 'bg-blue-500' :
                                                    entry.mood === 'Energetic' ? 'bg-orange-500' : 'bg-primary'}`}
                                        />

                                        <div className="flex justify-between items-start mb-3">
                                            <span className="text-sm font-mono text-primary/80 bg-primary/10 px-2 py-1 rounded">
                                                {new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </span>
                                            {entry.category === 'PROFESSIONAL' && (
                                                <span className="text-xs font-bold text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                    Pro
                                                </span>
                                            )}
                                        </div>

                                        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-primary transition-colors">
                                            {entry.title || 'Untitled Memory'}
                                        </h3>

                                        <p className="text-slate-400 text-sm line-clamp-3 mb-4">
                                            {entry.content}
                                        </p>

                                        {/* Skills/Lessons Tags */}
                                        {(entry.skills?.length || 0) > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-3">
                                                {entry.skills?.slice(0, 3).map(skill => (
                                                    <span key={skill} className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                                        +{skill}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </Link>
                            </div>

                            {/* Empty space for the other side */}
                            <div className="flex-1 md:w-1/2 hidden md:block" />
                        </motion.div>
                    );
                })}
            </div>

            {entries.length === 0 && (
                <div className="text-center py-20">
                    <p className="text-slate-500">No memories in your timeline yet.</p>
                </div>
            )}
        </div>
    );
}
