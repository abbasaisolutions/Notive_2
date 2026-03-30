'use client';

import React from 'react';
import { motion } from 'framer-motion';

type DeviceSignalSummary = {
    location?: { placeName: string; visitCount: number } | null;
    spotify?: { mood: string; topGenre: string; tracksPlayed: number } | null;
    screenTime?: { feeling: string; level: number } | null;
    appSession?: { totalMinutes: number; sessions: number } | null;
    wellness?: {
        energyLevel: number;
        stressLevel: number;
        socialBattery: number;
    } | null;
};

type DeviceContextStripProps = {
    signals: DeviceSignalSummary;
};

const LEVEL_DOT = (level: number, max: number = 5) => {
    const filled = Math.min(level, max);
    return Array.from({ length: max }, (_, i) => (
        <div
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{
                backgroundColor: i < filled
                    ? 'rgba(199,220,203,0.85)'
                    : 'rgba(var(--paper-border), 0.25)',
            }}
        />
    ));
};

/**
 * DeviceContextStrip — horizontal scrollable strip showing today's device signals.
 * Each signal is a compact pill with icon + data.
 * Mobile-first: swipeable, snap scroll.
 */
export default function DeviceContextStrip({ signals }: DeviceContextStripProps) {
    const { location, spotify, screenTime, appSession, wellness } = signals;

    const cards: Array<{ key: string; icon: string; label: string; value: React.ReactNode }> = [];

    if (location) {
        cards.push({
            key: 'location',
            icon: '📍',
            label: 'Writing from',
            value: <span className="text-[0.7rem] font-medium">{location.placeName}</span>,
        });
    }

    if (spotify) {
        cards.push({
            key: 'spotify',
            icon: '🎵',
            label: 'Music mood',
            value: (
                <div>
                    <span className="text-[0.7rem] font-medium capitalize">{spotify.mood}</span>
                    <span className="notebook-muted text-[0.55rem] ml-1">{spotify.topGenre}</span>
                </div>
            ),
        });
    }

    if (appSession) {
        cards.push({
            key: 'session',
            icon: '⏱',
            label: 'Notive today',
            value: (
                <span className="text-[0.7rem] font-medium">
                    {appSession.totalMinutes}m · {appSession.sessions} sessions
                </span>
            ),
        });
    }

    if (wellness) {
        cards.push({
            key: 'energy',
            icon: '⚡',
            label: 'Energy',
            value: <div className="flex items-center gap-0.5">{LEVEL_DOT(wellness.energyLevel)}</div>,
        });
        cards.push({
            key: 'stress',
            icon: '🌊',
            label: 'Stress',
            value: <div className="flex items-center gap-0.5">{LEVEL_DOT(wellness.stressLevel)}</div>,
        });
    }

    if (screenTime) {
        cards.push({
            key: 'screen',
            icon: '📱',
            label: 'Screen load',
            value: <span className="text-[0.7rem] font-medium capitalize">{screenTime.feeling}</span>,
        });
    }

    if (cards.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full overflow-x-auto scrollbar-hide snap-x snap-mandatory"
            style={{ WebkitOverflowScrolling: 'touch' }}
        >
            <div className="flex gap-2 px-0.5 py-1" style={{ minWidth: 'min-content' }}>
                {cards.map((card, i) => (
                    <motion.div
                        key={card.key}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="notebook-card-soft rounded-xl px-3 py-2 snap-start shrink-0"
                        style={{ minWidth: 120 }}
                    >
                        <div className="flex items-center gap-1 mb-0.5">
                            <span className="text-xs" aria-hidden="true">{card.icon}</span>
                            <span className="notebook-muted text-[0.6rem]">{card.label}</span>
                        </div>
                        <div style={{ color: 'rgb(var(--paper-ink))' }}>
                            {card.value}
                        </div>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
}
