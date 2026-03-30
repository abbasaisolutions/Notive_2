'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FiMic, FiSquare } from 'react-icons/fi';

type FloatingRecordBarProps = {
    /** Audio level 0-1 from voice capture monitor */
    audioLevel: number;
    /** Elapsed recording time in seconds */
    elapsed: number;
    /** Current interim text from speech recognition */
    interimText: string;
    onStop: () => void;
};

function formatElapsed(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

const BAR_COUNT = 24;

/**
 * Floating record bar shown at the bottom of the entry page during voice recording.
 * Shows a waveform visualizer, elapsed timer, live text preview, and stop button.
 */
export default function FloatingRecordBar({ audioLevel, elapsed, interimText, onStop }: FloatingRecordBarProps) {
    const barsRef = useRef<number[]>(Array(BAR_COUNT).fill(0.08));
    const [bars, setBars] = useState<number[]>(barsRef.current);
    const frameRef = useRef<number>(0);

    // Drive waveform bars from audioLevel
    useEffect(() => {
        let rafId: number;
        const tick = () => {
            const prev = barsRef.current;
            const next = prev.map((h, i) => {
                // Each bar gets a slightly different phase for organic look
                const phase = (Date.now() / 300 + i * 0.7) % (Math.PI * 2);
                const wave = (Math.sin(phase) + 1) / 2;
                const target = Math.max(0.08, audioLevel * 0.6 + wave * audioLevel * 0.4);
                // Smooth interpolation
                return h + (target - h) * 0.18;
            });
            barsRef.current = next;
            frameRef.current++;
            // Only update React state at ~20fps to avoid excessive rerenders
            if (frameRef.current % 3 === 0) {
                setBars([...next]);
            }
            rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, [audioLevel]);

    const previewWords = interimText.trim().split(/\s+/).filter(Boolean);
    const displayWords = previewWords.slice(-8); // Show last 8 words

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 voice-record-bar-enter">
            <div
                className="mx-auto max-w-3xl px-3"
                style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.5rem)' }}
            >
                <div className="rounded-t-2xl border border-b-0 border-[rgba(138,154,111,0.25)] bg-[rgba(var(--surface-1),0.97)] backdrop-blur-xl shadow-lg px-4 py-3">
                    {/* Waveform + timer row */}
                    <div className="flex items-center gap-3 mb-2">
                        {/* Recording indicator */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                            </span>
                            <span className="type-label-sm text-muted tabular-nums">{formatElapsed(elapsed)}</span>
                        </div>

                        {/* Waveform bars */}
                        <div className="flex flex-1 items-center justify-center gap-[2px] h-8 overflow-hidden">
                            {bars.map((h, i) => (
                                <div
                                    key={i}
                                    className="w-[3px] rounded-full bg-[rgb(var(--paper-sage))] transition-[height] duration-75"
                                    style={{
                                        height: `${Math.max(3, h * 28)}px`,
                                        opacity: 0.5 + h * 0.5,
                                    }}
                                />
                            ))}
                        </div>

                        {/* Stop button */}
                        <button
                            onClick={onStop}
                            className="flex-shrink-0 flex items-center gap-1.5 rounded-full bg-[rgba(138,154,111,0.15)] border border-[rgba(138,154,111,0.3)] px-3 py-1.5 text-[rgb(var(--paper-sage))] transition-all active:scale-95"
                            aria-label="Stop recording"
                        >
                            <FiSquare size={14} aria-hidden="true" />
                            <span className="type-label-sm font-medium">Done</span>
                        </button>
                    </div>

                    {/* Live text preview */}
                    {displayWords.length > 0 && (
                        <div className="flex items-center gap-2 overflow-hidden">
                            <FiMic size={12} className="flex-shrink-0 text-[rgb(var(--paper-sage))] opacity-60" aria-hidden="true" />
                            <p className="type-body-sm text-muted italic truncate">
                                {displayWords.map((word, i) => (
                                    <span
                                        key={`${word}-${i}`}
                                        className="word-appear-in mr-[0.25em]"
                                        style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                                    >
                                        {word}
                                    </span>
                                ))}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
