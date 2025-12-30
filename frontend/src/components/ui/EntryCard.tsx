'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

interface EntryCardProps {
    entry: {
        id: string;
        title: string | null;
        content: string;
        mood: string | null;
        tags: string[];
        coverImage: string | null;
        createdAt: string;
    };
    delay?: number;
}

export default function EntryCard({ entry, delay = 0 }: EntryCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay }}
            whileHover={{ y: -5 }}
            className="h-full"
        >
            <Link
                href={`/entry/view?id=${entry.id}`}
                className="bento-box group flex flex-col h-full overflow-hidden relative"
            >
                {/* Image Section */}
                {entry.coverImage && (
                    <div className="h-48 w-full relative overflow-hidden">
                        <Image
                            src={entry.coverImage}
                            alt={entry.title || 'Entry Cover'}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover group-hover:scale-110 transition-transform duration-700 brightness-75 group-hover:brightness-100"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-60" />

                        {/* Overlay text for date/heart if needed, but keeping clean for now */}
                    </div>
                )}

                {/* Content Section */}
                <div className="p-6 flex-1 flex flex-col relative">
                    <div className="flex justify-between items-start mb-4">
                        <div className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold">
                            {new Date(entry.createdAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                            })}
                        </div>
                        {entry.mood && (
                            <span className="px-3 py-1 rounded-full bg-white/5 text-[10px] text-white/70 uppercase tracking-widest font-bold border border-white/5 group-hover:bg-primary/10 group-hover:text-primary group-hover:border-primary/20 transition-all">
                                {entry.mood}
                            </span>
                        )}
                    </div>

                    <h4 className="text-xl font-serif text-white mb-2 group-hover:text-primary transition-colors line-clamp-1">
                        {entry.title || 'Untitled Entry'}
                    </h4>

                    <p className="zen-text text-sm line-clamp-3 mb-6 flex-1 opacity-70 group-hover:opacity-100 transition-opacity">
                        {entry.content}
                    </p>

                    <div className="flex flex-wrap gap-2 mt-auto">
                        {entry.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="text-[10px] text-primary/80 bg-primary/5 px-2 py-1 rounded-md border border-primary/10 group-hover:border-primary/30 transition-all">
                                #{tag}
                            </span>
                        ))}
                        {entry.tags.length > 3 && (
                            <span className="text-[10px] text-slate-500 px-1 py-1">
                                +{entry.tags.length - 3}
                            </span>
                        )}
                    </div>
                </div>

                {/* Hover Glow Effect */}
                <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-500 ring-1 ring-primary/20" />
            </Link>
        </motion.div>
    );
}
