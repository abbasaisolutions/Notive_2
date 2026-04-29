'use client';

import React, { RefObject, useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { FiImage, FiMic, FiSquare } from 'react-icons/fi';
import { NotebookDoodle } from '@/components/dashboard/NotebookDoodles';
import { Spinner } from '@/components/ui';
import { ACCEPTED_IMAGE_UPLOAD_TYPES_ATTR } from '@/utils/image-upload';

const TiptapEditor = dynamic(() => import('@/components/editor/TiptapEditor'), {
    ssr: false,
    loading: () => <div className="workspace-soft-panel rounded-2xl h-[300px] animate-pulse" />,
});

type UploadResult = {
    id: string;
    fileName: string;
    url: string;
};

type EntryEditorCardProps = {
    isRecording: boolean;
    isVoiceProcessing?: boolean;
    isVoiceSupported: boolean;
    voiceError: string | null;
    voiceReviewRequired?: boolean;
    voiceStatusMessage?: string | null;
    transcriptText?: string;
    interimText: string;
    onStartRecording: () => void;
    onStopRecording: () => void;
    fileInputRef: RefObject<HTMLInputElement>;
    onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    isUploading: boolean;
    queueCount: number;
    recentUploads: UploadResult[];
    onInsertUploadedImage: (url: string, id: string) => void;
    onDismissUploaded: (id: string) => void;
    audioUrl: string | null;
    content: string;
    editorPlaceholder: string;
    onEditorChange: (text: string, html: string) => void;
    autoFocus?: boolean;
    minimalEditor?: boolean;
    showImageUpload?: boolean;
    showFormattingToolbar?: boolean;
};

export default function EntryEditorCard({
    isRecording,
    isVoiceProcessing = false,
    isVoiceSupported,
    voiceError,
    transcriptText = '',
    interimText,
    onStartRecording,
    onStopRecording,
    fileInputRef,
    onImageUpload,
    isUploading,
    queueCount,
    recentUploads,
    onInsertUploadedImage,
    onDismissUploaded,
    audioUrl,
    voiceReviewRequired = false,
    voiceStatusMessage = null,
    content,
    editorPlaceholder,
    onEditorChange,
    autoFocus = false,
    minimalEditor = false,
    showImageUpload = true,
    showFormattingToolbar = false,
}: EntryEditorCardProps) {
    const [isTypingActive, setIsTypingActive] = useState(false);
    const [justCaptured, setJustCaptured] = useState(false);
    const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wasRecordingRef = useRef(false);

    const handleEditorChangeInternal = (text: string, html: string) => {
        setIsTypingActive(true);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setIsTypingActive(false), 1600);
        onEditorChange(text, html);
    };

    // Detect recording stop for capture-complete animation
    useEffect(() => {
        if (isRecording) {
            wasRecordingRef.current = true;
        } else if (wasRecordingRef.current) {
            wasRecordingRef.current = false;
            setJustCaptured(true);
            const timer = setTimeout(() => setJustCaptured(false), 700);
            return () => clearTimeout(timer);
        }
    }, [isRecording]);

    useEffect(() => {
        return () => {
            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        };
    }, []);

    const hasContent = content.trim().length > 0;
    const committedTranscript = transcriptText.trim();
    const interimWords = interimText.trim().split(/\s+/).filter(Boolean);
    // Don't show inline panel during recording — FloatingRecordBar covers that.
    const showLiveTranscript = isVoiceProcessing || Boolean(voiceStatusMessage) || (!isRecording && interimWords.length > 0);
    const utilityPanelClass = 'workspace-soft-panel';
    const mutedTextClass = 'text-muted';
    const bodyTextClass = 'text-default';

    return (
        <div className="mb-6 paper-page-turn-enter">
            {/* Editor — with quill watermark + typing glow */}
            <div className={`relative transition-all duration-700 ${justCaptured ? 'voice-capture-complete' : isRecording ? 'voice-active-glow voice-ripple-ring' : isTypingActive && !minimalEditor ? 'entry-typing-glow' : ''}`}>
                {/* Quill watermark — faint ghost doodle, appears once user has written something */}
                {hasContent && !minimalEditor && (
                    <div
                        className="pointer-events-none absolute bottom-5 right-5 z-0 select-none ink-quill-float"
                        aria-hidden="true"
                    >
                        <NotebookDoodle name="quill" accent="sage" size={68} />
                    </div>
                )}
                <TiptapEditor
                    onChange={handleEditorChangeInternal}
                    placeholder={editorPlaceholder}
                    content={content}
                    showToolbar={showFormattingToolbar && !minimalEditor}
                    autoFocus={autoFocus}
                    variant={minimalEditor ? 'glass' : 'paper'}
                    maxWords={500}
                />
            </div>

            {/* Voice feedback: error or review badge */}
            {voiceError && (
                <p role="alert" className="workspace-soft-panel type-micro mx-auto mt-3 max-w-xs rounded-lg px-2 py-1 text-center text-default">
                    {voiceError}
                </p>
            )}
            {voiceReviewRequired && !voiceError && (
                <p aria-live="polite" className="type-micro mx-auto mt-3 max-w-xs rounded-lg border border-amber-500/35 bg-amber-500/10 px-2 py-1 text-center text-amber-700">
                    Check transcript. A few words may need a quick pass.
                </p>
            )}
            {voiceStatusMessage && !voiceError && (
                <p aria-live="polite" className="workspace-soft-panel type-micro mx-auto mt-3 max-w-xs rounded-lg px-2 py-1 text-center text-default">
                    {voiceStatusMessage}
                </p>
            )}

            {/* Live transcription preview — word-by-word stagger with mic arcs */}
            {showLiveTranscript && (
                <div aria-live="polite" aria-label="Live transcription" className={`mt-4 rounded-2xl border p-4 voice-interim-card ${utilityPanelClass}`}>
                    <div className="flex items-start gap-3">
                        <div className="recording-arc-container mt-1 flex-shrink-0">
                            <span className="mic-arc-ring mic-arc-ring-1" />
                            <span className="mic-arc-ring mic-arc-ring-2" />
                            <span className="mic-arc-ring mic-arc-ring-3" />
                            <FiMic size={11} className="relative z-10 text-[rgb(var(--paper-sage))]" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="mb-3">
                                <p className="type-overline text-muted text-xs mb-1">
                                    {isVoiceProcessing ? 'Refining transcript' : isRecording ? 'Live transcript' : 'Transcript preview'}
                                </p>
                                {isVoiceProcessing || isRecording ? (
                                    <p className="text-xs text-ink-secondary leading-snug">
                                        {isVoiceProcessing
                                            ? '✓ Cleaning up your words...'
                                            : '🎤 Speaking...'}
                                    </p>
                                ) : null}
                            </div>
                            <div className="max-h-40 overflow-y-auto pr-2 rounded-lg bg-[rgba(255,255,255,0.4)] p-3">
                                {committedTranscript ? (
                                    <p className="text-sm leading-relaxed text-[rgb(40,36,32)] font-medium">
                                        {committedTranscript}
                                    </p>
                                ) : (
                                    <p className="text-sm text-ink-secondary">
                                        Listening for your words...
                                    </p>
                                )}
                                {interimWords.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-[rgba(126,157,149,0.2)]">
                                        <p className="text-sm leading-relaxed text-[rgb(60,55,48)]">
                                            {interimWords.map((word, i) => (
                                                <span
                                                    key={i}
                                                    className="word-appear-in mr-[0.25em]"
                                                    style={{ animationDelay: `${Math.min(i * 40, 500)}ms` }}
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
                </div>
            )}

            {/* Audio player */}
            {audioUrl && (
                <details className="group">
                    <summary className="cursor-pointer select-none list-none">
                        <div className={`mt-3 rounded-xl border p-3 ${utilityPanelClass}`}>
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Voice recording</p>
                            <p className="mt-1 text-sm text-ink-secondary">Click to listen</p>
                        </div>
                    </summary>
                    <div className={`mt-3 rounded-xl border p-3 ${utilityPanelClass}`}>
                        <audio controls src={audioUrl} className="w-full h-9" />
                    </div>
                </details>
            )}

            {/* Upload queue */}
            {(queueCount > 0 || recentUploads.length > 0) && (
                <div className={`mt-3 rounded-xl border p-3 ${utilityPanelClass}`}>
                    {queueCount > 0 && (
                        <p className={`type-overline mb-2 ${mutedTextClass}`}>
                            {queueCount} waiting to upload
                        </p>
                    )}
                    {recentUploads.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {recentUploads.map(upload => (
                                <div key={upload.id} className={`flex items-center gap-2 rounded-lg border px-2 py-1 ${utilityPanelClass}`}>
                                    <span className={`type-micro max-w-[120px] truncate ${mutedTextClass}`}>{upload.fileName}</span>
                                    <button
                                        type="button"
                                        onClick={() => onInsertUploadedImage(upload.url, upload.id)}
                                        className="type-label-sm text-soft hover:text-strong"
                                    >
                                        Insert
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onDismissUploaded(upload.id)}
                                        className="type-label-sm text-muted hover:text-default"
                                    >
                                        Hide
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Bottom toolbar: image + voice */}
            <div className={`mt-3 flex items-center justify-between rounded-2xl border px-3 py-2 ${utilityPanelClass}`}>
                <div className="flex items-center gap-2">
                    {showImageUpload && (
                        <>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept={ACCEPTED_IMAGE_UPLOAD_TYPES_ATTR}
                                onChange={onImageUpload}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-ink-muted/60 transition-all hover:bg-white/10 hover:text-ink-secondary"
                                title="Add image"
                            >
                                {isUploading ? (
                                    <Spinner size="sm" className="text-ink-muted/50" />
                                ) : (
                                    <FiImage size={16} aria-hidden="true" />
                                )}
                                <span className="type-label-sm text-[11px]">Image</span>
                            </button>
                        </>
                    )}
                </div>

                {/* Voice button — hero-sized, glowing CTA */}
                <button
                    onClick={isRecording ? onStopRecording : onStartRecording}
                    disabled={!isVoiceSupported || isVoiceProcessing}
                    title={isRecording ? 'Stop recording' : isVoiceProcessing ? 'Processing...' : 'Record voice'}
                    className={`flex items-center gap-2 rounded-full transition-all duration-300 min-h-[44px] min-w-[44px] justify-center ${!isVoiceSupported
                        ? 'text-muted cursor-not-allowed opacity-50 px-3 py-2'
                        : isRecording
                            ? 'voice-btn-recording px-4 py-2.5'
                            : isVoiceProcessing
                                ? 'text-muted cursor-wait px-3 py-2'
                                : 'voice-btn-idle px-4 py-2.5'
                    }`}
                >
                    {isRecording ? (
                        <>
                            <div className="recording-arc-container">
                                <span className="mic-arc-ring mic-arc-ring-1" />
                                <span className="mic-arc-ring mic-arc-ring-2" />
                                <span className="mic-arc-ring mic-arc-ring-3" />
                                <FiMic size={12} className="relative z-10" aria-hidden="true" />
                            </div>
                            <FiSquare size={14} aria-hidden="true" />
                            <span className="type-label-sm font-semibold">Stop</span>
                        </>
                    ) : isVoiceProcessing ? (
                        <>
                            <Spinner size="sm" className="text-ink-muted/50" />
                            <span className="type-label-sm">Processing</span>
                        </>
                    ) : (
                        <>
                            <FiMic size={18} aria-hidden="true" />
                            <span className="type-label-sm font-semibold">Speak</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
