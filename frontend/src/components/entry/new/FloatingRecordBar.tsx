'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FiMic, FiSquare } from 'react-icons/fi';

type FloatingRecordBarProps = {
    /** Audio level 0-1 from voice capture monitor */
    audioLevel: number;
    /** Elapsed recording time in seconds */
    elapsed: number;
    /** Finalized transcript captured during this recording */
    transcriptText: string;
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
export default function FloatingRecordBar({ audioLevel, elapsed, transcriptText, interimText, onStop }: FloatingRecordBarProps) {
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

    const committedTranscript = transcriptText.trim();
    const previewWords = interimText.trim().split(/\s+/).filter(Boolean);

    const transcriptBlock = (maxHeightClass: string) => (
        <div className="rounded-2xl border border-[rgba(138,154,111,0.2)] bg-white/75 px-4 py-3 backdrop-blur-sm">
            <div className="mb-2 flex items-center gap-2">
                <FiMic size={13} className="flex-shrink-0 text-[rgb(var(--paper-sage))]" aria-hidden="true" />
                <p className="type-overline text-xs font-semibold text-muted">Live transcript</p>
            </div>
            <div className={`${maxHeightClass} overflow-y-auto rounded-lg bg-[rgba(126,157,149,0.08)] p-2.5 pr-2`} aria-live="polite">
                {committedTranscript ? (
                    <p className="text-sm font-medium leading-relaxed text-[rgb(40,36,32)]">
                        {committedTranscript}
                    </p>
                ) : (
                    <p className="text-sm text-ink-secondary">
                        Listening for your words...
                    </p>
                )}
                {previewWords.length > 0 && (
                    <div className="mt-2 border-t border-[rgba(126,157,149,0.15)] pt-2">
                        <p className="text-sm leading-relaxed text-[rgb(60,55,48)]">
                            {previewWords.map((word, i) => (
                                <span
                                    key={i}
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
    );

    const waveform = (heightScale: number, className = '') => (
        <div className={`flex flex-1 items-center justify-center gap-[3px] overflow-hidden ${className}`}>
            {bars.map((h, i) => (
                <div
                    key={i}
                    className="w-[4px] rounded-full bg-[rgb(var(--paper-sage))] transition-[height] duration-75"
                    style={{
                        height: `${Math.max(4, h * heightScale)}px`,
                        opacity: 0.5 + h * 0.5,
                    }}
                />
            ))}
        </div>
    );

    return (
        <>
            <div className="fixed inset-0 z-50 bg-[rgb(var(--bg-canvas))]/95 px-5 pb-5 pt-6 backdrop-blur-xl voice-record-bar-enter md:hidden">
                <div
                    className="mx-auto flex h-full max-w-md flex-col"
                    style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.25rem)' }}
                >
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Voice capture</p>
                            <h2 className="workspace-heading mt-1 text-2xl font-semibold">You are live</h2>
                        </div>
                        <div className="flex items-center gap-2 rounded-full border border-[rgba(138,154,111,0.22)] bg-white/50 px-3 py-2">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                            </span>
                            <span className="type-label-sm tabular-nums text-ink-secondary">{formatElapsed(elapsed)}</span>
                        </div>
                    </div>

                    <div className="my-8 flex min-h-[10rem] items-center rounded-[2rem] border border-[rgba(138,154,111,0.22)] bg-white/45 px-5 shadow-lg">
                        {waveform(112, 'h-36')}
                    </div>

                    <div className="min-h-0 flex-1">
                        {transcriptBlock('max-h-[32vh]')}
                    </div>

                    <button
                        type="button"
                        onClick={onStop}
                        className="mt-5 flex min-h-[64px] w-full items-center justify-center gap-3 rounded-[1.35rem] bg-[rgb(var(--paper-sage))] px-5 py-4 text-base font-semibold text-white shadow-xl transition-transform active:scale-[0.98]"
                        aria-label="Stop recording"
                    >
                        <FiSquare size={18} aria-hidden="true" />
                        Stop and review
                    </button>
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 z-50 hidden voice-record-bar-enter md:block">
                <div
                    className="mx-auto max-w-3xl px-3"
                    style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.5rem)' }}
                >
                    <div className="rounded-t-2xl border border-b-0 border-[rgba(138,154,111,0.25)] bg-[rgba(var(--surface-1),0.97)] px-4 py-3 shadow-lg backdrop-blur-xl">
                        <div className="mb-2 flex items-center gap-3">
                            <div className="flex flex-shrink-0 items-center gap-2">
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                                </span>
                                <span className="type-label-sm tabular-nums text-muted">{formatElapsed(elapsed)}</span>
                            </div>

                            {waveform(28, 'h-8')}

                            <button
                                type="button"
                                onClick={onStop}
                                className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-[rgba(138,154,111,0.3)] bg-[rgba(138,154,111,0.15)] px-3 py-1.5 text-[rgb(var(--paper-sage))] transition-all active:scale-95"
                                aria-label="Stop recording"
                            >
                                <FiSquare size={14} aria-hidden="true" />
                                <span className="type-label-sm font-medium">Done</span>
                            </button>
                        </div>

                        {transcriptBlock('max-h-24')}
                    </div>
                </div>
            </div>
        </>
    );
}
