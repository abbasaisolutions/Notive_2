'use client';

import React, { RefObject } from 'react';
import dynamic from 'next/dynamic';
import { FiImage, FiMic, FiSquare } from 'react-icons/fi';

const TiptapEditor = dynamic(() => import('@/components/editor/TiptapEditor'), {
    ssr: false,
    loading: () => <div className="glass-card rounded-2xl h-[300px] animate-pulse" />,
});

type UploadResult = {
    id: string;
    fileName: string;
    url: string;
};

type EntryEditorCardProps = {
    isRecording: boolean;
    isVoiceSupported: boolean;
    voiceError: string | null;
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
};

export default function EntryEditorCard({
    isRecording,
    isVoiceSupported,
    voiceError,
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
    content,
    editorPlaceholder,
    onEditorChange,
    autoFocus = false,
    minimalEditor = false,
    showImageUpload = true,
}: EntryEditorCardProps) {
    const recordingLabel = isRecording ? 'Listening' : 'Voice On';

    return (
        <div className="relative mb-6 group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative glass-card rounded-[2rem] p-8 border border-white/10 shadow-2xl">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <p className="text-xs uppercase tracking-[0.15em] text-ink-muted">
                            {minimalEditor ? 'Quick Note' : 'Write'}
                        </p>
                        <h3 className="text-base font-semibold text-white">
                            {minimalEditor ? 'One thought, quick save' : 'Voice or typing'}
                        </h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${
                                isRecording
                                    ? 'border-white/15 bg-white/[0.04] text-white'
                                    : 'border-white/15 bg-white/[0.03] text-ink-secondary'
                            }`}
                        >
                            {recordingLabel}
                        </span>
                        {queueCount > 0 && (
                            <span className="rounded-full border border-zinc-400/35 bg-zinc-500/12 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-zinc-200">
                                Queue {queueCount}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex flex-col items-center justify-center mb-7">
                    <button
                        onClick={isRecording ? onStopRecording : onStartRecording}
                        disabled={!isVoiceSupported}
                        className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${!isVoiceSupported
                            ? 'bg-surface-2 text-ink-secondary cursor-not-allowed'
                            : isRecording
                                ? 'bg-primary scale-110 shadow-[0_0_40px_rgba(100,116,139,0.4)]'
                                : 'bg-gradient-to-br from-primary to-secondary hover:shadow-[0_0_30px_rgba(148,163,184,0.45)] hover:scale-105'
                            }`}
                    >
                        {isRecording ? (
                            <div className="relative">
                                <div className="absolute inset-0 animate-ping opacity-75 bg-white rounded-full"></div>
                                <FiSquare size={28} className="relative z-10 text-white" aria-hidden="true" />
                            </div>
                        ) : (
                            <FiMic size={32} className="text-white" aria-hidden="true" />
                        )}
                    </button>

                    <div className="mt-4 h-6 flex flex-col items-center">
                        {isRecording ? (
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/60 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary/80"></span>
                                </span>
                                <span className="text-ink-secondary text-sm font-medium tracking-wide uppercase">Listening</span>
                            </div>
                        ) : (
                            <span className="text-ink-muted text-sm font-medium">Tap to dictate</span>
                        )}
                    </div>
                    {voiceError && (
                        <p className="mt-2 text-xs text-zinc-300 text-center max-w-xs rounded-lg border border-zinc-500/20 bg-zinc-500/10 px-2 py-1">
                            {voiceError}
                        </p>
                    )}
                </div>

                {showImageUpload && (
                    <div className="flex justify-end mb-4 px-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={onImageUpload}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="p-2 rounded-xl text-ink-secondary hover:text-white hover:bg-white/5 transition-all flex items-center gap-2 text-sm"
                            title="Upload Image"
                        >
                            {isUploading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <FiImage size={20} aria-hidden="true" />
                            )}
                            <span>{isUploading ? 'Uploading' : 'Add Image'}</span>
                        </button>
                    </div>
                )}

                {(queueCount > 0 || recentUploads.length > 0) && (
                    <div className="mb-4 mx-2 p-3 rounded-xl bg-white/5 border border-white/10">
                        {queueCount > 0 && (
                            <p className="text-xs uppercase tracking-[0.1em] text-ink-muted mb-2">
                                {queueCount} waiting to upload again
                            </p>
                        )}
                        {recentUploads.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {recentUploads.map(upload => (
                                    <div key={upload.id} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-2 py-1">
                                        <span className="text-xs text-ink-muted truncate max-w-[120px]">{upload.fileName}</span>
                                        <button
                                            onClick={() => onInsertUploadedImage(upload.url, upload.id)}
                                            className="text-xs uppercase tracking-[0.08em] text-ink-secondary hover:text-white font-medium"
                                        >
                                            Insert
                                        </button>
                                        <button
                                            onClick={() => onDismissUploaded(upload.id)}
                                            className="text-xs uppercase tracking-[0.08em] text-ink-muted hover:text-ink-secondary"
                                        >
                                            Hide
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {interimText && (
                    <div className="mb-6 p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted mb-1">Live Words</p>
                        <p className="text-ink-secondary italic text-base animate-pulse">"{interimText}"</p>
                    </div>
                )}

                {audioUrl && (
                    <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10">
                        <p className="text-xs text-ink-muted mb-2 uppercase tracking-[0.12em]">Voice Clip</p>
                        <audio controls src={audioUrl} className="w-full h-10" />
                    </div>
                )}

                <div className="relative">
                    <TiptapEditor
                        onChange={onEditorChange}
                        placeholder={editorPlaceholder}
                        content={content}
                        showToolbar={!minimalEditor}
                        autoFocus={autoFocus}
                    />
                </div>
            </div>
        </div>
    );
}

