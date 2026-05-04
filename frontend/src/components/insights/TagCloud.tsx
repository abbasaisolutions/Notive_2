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
            const themesPromise = apiFetch(`/analytics/tag-themes`);
            const moodPromise = apiFetch(`/analytics/tag-mood-patterns`);

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

    if (!themesLoaded || themes.length === 0) return null;

    const handleSelect = (tag: string) => {
        onSelectTag?.(selectedTag === tag ? null : tag);
    };

    return (
        <div className="-mx-1 px-1">
            <div className="chip-scroller gap-2 py-1" aria-label="Timeline topics">
                <AnimatePresence mode="popLayout">
                    {selectedTag && (
                        <motion.button
                            key="__clear__"
                            layout
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            onClick={() => { onSelectTag?.(null); }}
                            className="flex-shrink-0 rounded-full border border-primary/40 bg-primary/12 px-3 py-1.5 text-xs font-semibold text-primary shadow-sm shadow-primary/10 transition-colors hover:bg-primary/20"
                        >
                            Clear topic
                        </motion.button>
                    )}
                    {themes.map(theme => {
                        const isSelected = selectedTag === theme.tag;
                        const isFiltered = selectedTag !== null && !isSelected;
                        const dominantMood = moodMap.get(theme.tag);
                        const moodColor = dominantMood ? getMoodColor(dominantMood) : null;

                        return (
                            <motion.button
                                key={theme.tag}
                                layout
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{
                                    opacity: isFiltered ? 0.55 : 1,
                                    scale: isSelected ? 1.04 : 1,
                                }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                whileTap={{ scale: 0.95 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                onClick={() => handleSelect(theme.tag)}
                                className={[
                                    'flex-shrink-0 rounded-full border text-xs transition-colors px-2.5 py-1.5',
                                    isSelected
                                        ? 'border-primary/45 bg-primary/18 text-primary shadow-sm shadow-primary/10 ring-1 ring-primary/25'
                                        : 'border-[rgba(var(--paper-border),0.55)] bg-[rgba(255,255,255,0.5)] text-ink-secondary hover:border-primary/25 hover:bg-primary/8 hover:text-[rgb(var(--text-primary))]',
                                ].join(' ')}
                                style={moodColor && !isSelected ? { borderColor: `${moodColor}36` } : undefined}
                                aria-pressed={isSelected}
                            >
                                <span className="flex items-center gap-1.5">
                                    {moodColor && (
                                        <span
                                            className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
                                            style={{ backgroundColor: moodColor }}
                                        />
                                    )}
                                    <span className="font-medium">#{theme.tag}</span>
                                    <span className={isSelected
                                        ? 'rounded-full bg-primary/15 px-1.5 py-0.5 text-[0.62rem] font-semibold text-primary'
                                        : 'rounded-full bg-[rgba(141,123,105,0.08)] px-1.5 py-0.5 text-[0.62rem] font-semibold text-ink-muted'
                                    }>
                                        {theme.count}
                                    </span>
                                </span>
                            </motion.button>
                        );
                    })}
                </AnimatePresence>
            </div>
        </div>
    );
}
