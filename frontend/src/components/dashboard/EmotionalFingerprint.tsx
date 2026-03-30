'use client';

import React from 'react';
import { motion } from 'framer-motion';

type Axis = {
    emotion: string;
    score: number; // 0-1
    entryCount: number;
};

type EmotionalFingerprintProps = {
    axes: Axis[];
    summary: string;
};

const ACCENT_COLORS: Record<string, string> = {
    joy: 'rgba(199,220,203,0.85)',
    happiness: 'rgba(199,220,203,0.85)',
    calm: 'rgba(191,214,221,0.85)',
    serenity: 'rgba(191,214,221,0.85)',
    motivation: 'rgba(240,205,184,0.85)',
    determination: 'rgba(240,205,184,0.85)',
    anxiety: 'rgba(234,216,189,0.85)',
    sadness: 'rgba(216,199,232,0.85)',
    frustration: 'rgba(234,216,189,0.7)',
    anger: 'rgba(234,216,189,0.7)',
    gratitude: 'rgba(199,220,203,0.7)',
    hope: 'rgba(191,214,221,0.7)',
    fear: 'rgba(234,216,189,0.6)',
    surprise: 'rgba(240,205,184,0.7)',
};

const DEFAULT_COLOR = 'rgba(var(--brand-strong), 0.5)';

function getEmotionColor(emotion: string): string {
    return ACCENT_COLORS[emotion.toLowerCase()] ?? DEFAULT_COLOR;
}

export default function EmotionalFingerprint({ axes, summary }: EmotionalFingerprintProps) {
    if (axes.length < 3) return null;

    const cx = 90;
    const cy = 90;
    const maxR = 70;
    const minR = 20;
    const count = Math.min(axes.length, 8);
    const angleStep = (2 * Math.PI) / count;

    // Build radar polygon points
    const points = axes.slice(0, count).map((axis, i) => {
        const angle = -Math.PI / 2 + i * angleStep;
        const r = minR + axis.score * (maxR - minR);
        return {
            x: cx + r * Math.cos(angle),
            y: cy + r * Math.sin(angle),
            labelX: cx + (maxR + 14) * Math.cos(angle),
            labelY: cy + (maxR + 14) * Math.sin(angle),
            emotion: axis.emotion,
            score: axis.score,
        };
    });

    const polygonPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';

    // Background guide rings
    const guideRings = [0.33, 0.66, 1].map((ratio) => {
        const r = minR + ratio * (maxR - minR);
        return <circle key={ratio} cx={cx} cy={cy} r={r} fill="none" stroke="rgba(var(--paper-border), 0.3)" strokeWidth="1" />;
    });

    // Guide spokes
    const spokes = points.map((p, i) => {
        const angle = -Math.PI / 2 + i * angleStep;
        const endX = cx + maxR * Math.cos(angle);
        const endY = cy + maxR * Math.sin(angle);
        return <line key={i} x1={cx} y1={cy} x2={endX} y2={endY} stroke="rgba(var(--paper-border), 0.2)" strokeWidth="1" />;
    });

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="notebook-card rounded-[1.75rem] p-5"
        >
            <p
                className="section-label mb-1"
                style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)' }}
            >
                Emotional fingerprint
            </p>
            <p className="notebook-muted text-xs mb-4">{summary}</p>

            {/* Radar chart */}
            <svg viewBox="0 0 180 180" className="w-full max-w-[240px] mx-auto" aria-hidden="true">
                {guideRings}
                {spokes}

                {/* Filled shape */}
                <motion.path
                    d={polygonPath}
                    fill="rgba(var(--brand-strong), 0.08)"
                    stroke="rgba(var(--brand-strong), 0.6)"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.5, ease: 'easeOut' }}
                    style={{ transformOrigin: `${cx}px ${cy}px` }}
                />

                {/* Data points */}
                {points.map((p, i) => (
                    <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r="3.5"
                        fill={getEmotionColor(p.emotion)}
                        stroke="rgba(var(--paper-ink), 0.3)"
                        strokeWidth="1"
                    />
                ))}

                {/* Labels */}
                {points.map((p, i) => (
                    <text
                        key={`label-${i}`}
                        x={p.labelX}
                        y={p.labelY}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="rgb(var(--paper-ink-muted))"
                        fontSize="7"
                        fontFamily="var(--font-sans, system-ui)"
                    >
                        {p.emotion.charAt(0).toUpperCase() + p.emotion.slice(1)}
                    </text>
                ))}
            </svg>
        </motion.div>
    );
}
