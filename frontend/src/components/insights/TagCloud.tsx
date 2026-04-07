'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useApi from '@/hooks/use-api';
import { API_URL } from '@/constants/config';
import { getMoodColor } from '@/constants/moods';
import { isCardTag } from '@/utils/tags';

interface TagTheme {
    tag: string;
    count: number;
    lastSeen: string;
}

interface TagMoodPattern {
    tag: string;
    dominantMood: string;
    percentage: number;
    entryCount: number;
}

interface TagCloudProps {
    /** When a tag is selected / deselected */
    onSelectTag?: (tag: string | null) => void;
    /** Currently selected tag (controlled) */
    selectedTag?: string | null;
}

export default function TagCloud({ onSelectTag, selectedTag = null }: TagCloudProps) {
    const { apiFetch } = useApi();
    const [themes, setThemes] = useState<TagTheme[]>([]);
    const [moodPatterns, setMoodPatterns] = useState<TagMoodPattern[]>([]);
    const [themesLoaded, setThemesLoaded] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            // Fire both requests concurrently but handle failures independently
            // so a mood-patterns failure doesn't suppress the themes data.
            const themesPromise = apiFetch(`${API_URL}/analytics/tag-themes`);
            const moodPromise = apiFetch(`${API_URL}/analytics/tag-mood-patterns`);

            try {
                const themesRaw = await themesPromise;
                if (!cancelled) {
                    const themesRes = themesRaw.ok ? await themesRaw.json() : {};
                    setThemes((themesRes?.themes || []).filter((t: TagTheme) => isCardTag(t.tag)));
                    setThemesLoaded(true);
                }
            } catch {
                if (!cancelled) setThemesLoaded(true);
            }

            try {
                const moodRaw = await moodPromise;
                if (!cancelled) {
                    const moodRes = moodRaw.ok ? await moodRaw.json() : {};
                    setMoodPatterns(moodRes?.patterns || []);
                }
            } catch { /* mood fetch failed — decorative, safe to skip */ }
        })();
        return () => { cancelled = true; };
    }, [apiFetch]);

    const moodMap = useMemo(() => {
        const map = new Map<string, string>();
        moodPatterns.forEach(p => map.set(p.tag, p.dominantMood));
        return map;
    }, [moodPatterns]);

    const maxCount = useMemo(() => Math.max(...themes.map(t => t.count), 1), [themes]);

    if (!themesLoaded || themes.length === 0) return null;

    const handleSelect = (tag: string) => {
        onSelectTag?.(selectedTag === tag ? null : tag);
    };

    return (
        <div className="workspace-soft-panel rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="type-overline text-ink-muted tracking-wider text-[0.65rem] uppercase">
                    Your themes
                </h3>
                {selectedTag && (
                    <button
                        onClick={() => onSelectTag?.(null)}
                        className="text-[0.65rem] text-primary hover:text-primary/80 transition-colors font-medium"
                    >
                        Clear filter
                    </button>
                )}
            </div>

            <div className="flex flex-wrap gap-2">
                <AnimatePresence mode="popLayout">
                    {themes.map(theme => {
                        const isSelected = selectedTag === theme.tag;
                        const isFiltered = selectedTag !== null && !isSelected;
                        const dominantMood = moodMap.get(theme.tag);
                        const moodColor = dominantMood ? getMoodColor(dominantMood) : null;

                        // Size tier based on frequency
                        const ratio = theme.count / maxCount;
                        const sizeClass = ratio > 0.7 ? 'text-sm px-3 py-1.5'
                            : ratio > 0.4 ? 'text-xs px-2.5 py-1'
                            : 'text-[0.65rem] px-2 py-0.5';

                        return (
                            <motion.button
                                key={theme.tag}
                                layout
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{
                                    opacity: isFiltered ? 0.4 : 1,
                                    scale: isSelected ? 1.08 : 1,
                                }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                whileTap={{ scale: 0.95 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                onClick={() => handleSelect(theme.tag)}
                                className={[
                                    'rounded-full font-medium transition-colors border',
                                    sizeClass,
                                    isSelected
                                        ? 'bg-primary/20 border-primary/50 text-primary shadow-sm shadow-primary/10'
                                        : 'workspace-pill border-transparent text-ink-muted hover:text-strong hover:border-primary/20',
                                ].join(' ')}
                                style={moodColor && !isSelected ? { borderColor: `${moodColor}30` } : undefined}
                                aria-pressed={isSelected}
                            >
                                <span className="flex items-center gap-1.5">
                                    {moodColor && (
                                        <span
                                            className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: moodColor }}
                                        />
                                    )}
                                    #{theme.tag}
                                    <span className="opacity-50 font-normal">{theme.count}</span>
                                </span>
                            </motion.button>
                        );
                    })}
                </AnimatePresence>
            </div>
        </div>
    );
}
