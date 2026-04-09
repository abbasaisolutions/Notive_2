'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { getMoodColor, getMoodEmoji, normalizeMood } from '@/constants/moods';
import { FiPlay } from 'react-icons/fi';
import { appendReturnTo, buildCurrentReturnTo } from '@/utils/navigation';
import { formatStoryConfidence, storyStatusClassName, storyStatusLabel, type StorySignal } from '@/utils/story-engine';
import { clipCompactPillByLimit, COMPACT_PILL_LIMITS } from '@/utils/tags';

interface EntryCardProps {
    entry: {
        id: string;
        title: string | null;
        content: string;
        mood: string | null;
        tags: string[];
        coverImage: string | null;
        audioUrl?: string | null;
        createdAt: string;
        storySignal?: StorySignal;
    };
    delay?: number;
}

export default function EntryCard({ entry, delay = 0 }: EntryCardProps) {
    const pathname = usePathname();
    const [isPlaying, setIsPlaying] = React.useState(false);
    const audioRef = React.useRef<HTMLAudioElement>(null);
    const normalizedMood = normalizeMood(entry.mood);
    const moodLabel = normalizedMood
        ? normalizedMood.charAt(0).toUpperCase() + normalizedMood.slice(1)
        : null;
    const moodColor = getMoodColor(normalizedMood);
    const displayDate = new Date(entry.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
    const currentReturnTo = buildCurrentReturnTo(pathname, typeof window !== 'undefined' ? window.location.search : '');
    const storySignal = entry.storySignal;

    const togglePlay = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleEnded = () => {
        setIsPlaying(false);
    };
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay }}
            whileHover={{ y: -4 }}
            className="h-full"
        >
            <Link
                href={appendReturnTo(`/entry/view?id=${entry.id}`, currentReturnTo)}
                className="workspace-panel rounded-[2rem] group flex h-full flex-col overflow-hidden relative"
            >
                {/* Image Section */}
                {entry.coverImage && (
                    <div className="h-48 w-full relative overflow-hidden">
                        <Image
                            src={entry.coverImage}
                            alt={entry.title || 'Entry Cover'}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover group-hover:scale-105 transition-transform duration-700 brightness-[0.8] group-hover:brightness-[0.96]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent opacity-70" />
                    </div>
                )}

                {/* Audio Indicator / Play Button */}
                {entry.audioUrl && (
                    <div className="absolute top-4 right-4 z-20">
                        <button
                            onClick={togglePlay}
                            className="w-10 h-10 rounded-full bg-black/35 hover:bg-black/50 backdrop-blur-md border border-white/25 flex items-center justify-center transition-all hover:scale-105 active:scale-95 group/audio"
                            aria-label={isPlaying ? 'Pause entry audio' : 'Play entry audio'}
                        >
                            {isPlaying ? (
                                <div className="flex gap-1 items-end h-4">
                                    <span className="w-1 h-2 bg-white rounded-full animate-[bounce_0.8s_infinite]" />
                                    <span className="w-1 h-4 bg-white rounded-full animate-[bounce_0.8s_infinite_0.2s]" />
                                    <span className="w-1 h-3 bg-white rounded-full animate-[bounce_0.8s_infinite_0.4s]" />
                                </div>
                            ) : (
                                <FiPlay size={18} className="text-white ml-0.5" aria-hidden="true" />
                            )}
                        </button>
                        <audio ref={audioRef} src={entry.audioUrl} onEnded={handleEnded} className="hidden" />
                    </div>
                )}

                {/* Content Section */}
                <div className="p-6 flex-1 flex flex-col relative">
                    <div className="flex justify-between items-start mb-4">
                        <div className="text-xs text-ink-muted uppercase tracking-[0.2em] font-semibold">
                            {displayDate}
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                            {storySignal && (
                                <span className={`px-3 py-1 rounded-full text-xs uppercase tracking-widest font-semibold border ${storyStatusClassName[storySignal.status]}`}>
                                    {storyStatusLabel[storySignal.status]}
                                </span>
                            )}
                            {moodLabel && (
                                <span
                                    className="px-3 py-1 rounded-full text-xs uppercase tracking-widest font-semibold border transition-all"
                                    style={{
                                        backgroundColor: `${moodColor}20`,
                                        color: moodColor,
                                        borderColor: `${moodColor}66`,
                                    }}
                                >
                                    {getMoodEmoji(normalizedMood)} {moodLabel}
                                </span>
                            )}
                        </div>
                    </div>

                    <h4 className="text-xl font-serif text-white mb-2 group-hover:text-primary transition-colors line-clamp-2">
                        {entry.title || 'Untitled Entry'}
                    </h4>

                    <p className="zen-text text-sm line-clamp-3 mb-6 flex-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        {entry.content}
                    </p>

                    <div className="flex flex-wrap gap-2 mt-auto">
                        {storySignal && (
                            <span className="text-xs text-ink-secondary border border-white/15 bg-white/[0.03] px-2 py-1 rounded-md">
                                {storySignal.completenessScore}% ready / {formatStoryConfidence(storySignal.confidence)} confidence
                            </span>
                        )}
                        {entry.tags.slice(0, 3).map(tag => (
                            <span key={tag} title={`#${tag}`} className="inline-flex max-w-[8.5rem] items-center truncate rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs text-primary/90 transition-all group-hover:border-primary/50">
                                {clipCompactPillByLimit(`#${tag}`, COMPACT_PILL_LIMITS.entryCardTag)}
                            </span>
                        ))}
                        {entry.tags.length > 3 && (
                            <span className="text-xs text-ink-muted px-1 py-1">
                                +{entry.tags.length - 3}
                            </span>
                        )}
                    </div>
                </div>

                {/* Hover Glow Effect */}
                <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-500 ring-1 ring-primary/30" />
            </Link>
        </motion.div>
    );
}

