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
    /** Optional: stop recording and immediately save the entry */
    onStopAndSave?: () => void;
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
export default function FloatingRecordBar({ audioLevel, elapsed, transcriptText, interimText, onStop, onStopAndSave }: FloatingRecordBarProps) {
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

    const waveform = (heightScale: number, className = '') => (
        <div className={`flex flex-1 items-center justify-center gap-1 overflow-hidden ${className}`}>
            {bars.map((h, i) => (
                <div
                    key={i}
                    className="w-1.5 rounded-full bg-[rgb(var(--paper-sage))] shadow-[0_0_22px_rgba(126,157,149,0.42)] transition-[height] duration-75 md:w-2"
                    style={{
                        height: `${Math.max(8, h * heightScale)}px`,
                        opacity: 0.32 + h * 0.68,
                    }}
                />
            ))}
        </div>
    );

    return (
        <div
            className="fixed inset-0 z-50 overflow-hidden bg-[rgb(var(--bg-canvas))]/95 px-5 backdrop-blur-2xl voice-record-bar-enter"
            style={{
                paddingTop: 'max(env(safe-area-inset-top, 0px), 1.25rem)',
                paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 1.25rem)',
            }}
        >
            <div className="pointer-events-none absolute inset-x-[12%] top-1/2 h-72 -translate-y-1/2 rounded-full bg-[rgba(126,157,149,0.14)] blur-3xl" aria-hidden="true" />
            <div className="relative mx-auto flex h-full w-full max-w-5xl flex-col">
                <header className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-ink-muted">
                        <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                        </span>
                        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.16em]">Recording</span>
                    </div>
                    <span className="rounded-full border border-[rgba(138,154,111,0.22)] bg-white/45 px-3 py-1.5 text-xs tabular-nums text-ink-secondary">
                        {formatElapsed(elapsed)}
                    </span>
                </header>

                <main className="relative flex min-h-0 flex-1 flex-col items-center justify-center py-6">
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
                        {waveform(330, 'h-[32vh] min-h-48 md:h-[38vh] md:min-h-64')}
                    </div>
                    <div className="relative z-10 max-h-[38vh] w-full max-w-3xl overflow-y-auto px-2 text-center" aria-live="polite">
                        {committedTranscript ? (
                            <p className="font-serif text-2xl font-medium leading-relaxed text-[rgb(var(--text-primary))]/70 md:text-4xl">
                                {committedTranscript}
                            </p>
                        ) : (
                            <p className="font-serif text-2xl italic leading-relaxed text-ink-muted/65 md:text-4xl">
                                Listening for your words...
                            </p>
                        )}
                        {previewWords.length > 0 && (
                            <p className="mt-3 font-serif text-2xl leading-relaxed text-[rgb(var(--text-primary))] md:text-4xl">
                                {previewWords.map((word, i) => (
                                    <span
                                        key={`${word}-${i}`}
                                        className="word-appear-in mr-[0.25em] inline-block"
                                        style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                                    >
                                        {word}
                                    </span>
                                ))}
                            </p>
                        )}
                    </div>
                </main>

                <footer className="mx-auto grid w-full max-w-md grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={onStop}
                        className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-[rgba(138,154,111,0.35)] bg-white/55 px-4 py-3 text-sm font-semibold text-ink-secondary backdrop-blur-sm transition-transform active:scale-[0.98]"
                        aria-label="Stop recording and review"
                    >
                        <FiSquare size={15} aria-hidden="true" />
                        Stop
                    </button>
                    <button
                        type="button"
                        onClick={onStopAndSave ?? onStop}
                        className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[rgb(var(--paper-sage))] px-4 py-3 text-sm font-semibold text-white shadow-lg transition-transform active:scale-[0.98]"
                        aria-label="Stop recording and save entry"
                    >
                        <FiSquare size={15} aria-hidden="true" />
                        Stop &amp; Save
                    </button>
                </footer>
            </div>
        </div>
    );
}
