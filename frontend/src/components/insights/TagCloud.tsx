'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useApi from '@/hooks/use-api';
import { API_URL } from '@/constants/config';
import { getMoodColor } from '@/constants/moods';
import { isCardTag } from '@/utils/tags';
import { hapticTap } from '@/services/haptics.service';

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

    if (!themesLoaded || themes.length === 0) return null;

    const handleSelect = (tag: string) => {
        hapticTap();
        onSelectTag?.(selectedTag === tag ? null : tag);
    };

    return (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide py-0.5">
            <AnimatePresence mode="popLayout">
                {selectedTag && (
                    <motion.button
                        key="__clear__"
                        layout
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        onClick={() => { hapticTap(); onSelectTag?.(null); }}
                        className="flex-shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                    >
                        ✕ clear
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
                                opacity: isFiltered ? 0.4 : 1,
                                scale: isSelected ? 1.08 : 1,
                            }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            whileTap={{ scale: 0.95 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            onClick={() => handleSelect(theme.tag)}
                            className={[
                                'flex-shrink-0 rounded-full font-medium transition-colors border text-xs px-2.5 py-1',
                                isSelected
                                    ? 'bg-primary/20 border-primary/50 text-primary shadow-sm shadow-primary/10 ring-1 ring-primary/30'
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
    );
}
