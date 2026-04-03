'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import useApi from '@/hooks/use-api';
import useSpeechRecognition from '@/hooks/use-speech-recognition';
import useTelemetry from '@/hooks/use-telemetry';
import { Spinner } from '@/components/ui';
import { DEFAULT_VOICE_LANGUAGE_MODE, VOICE_ALLOW_BROWSER_FALLBACK, VOICE_BACKEND_TRANSCRIPTION_ENABLED } from '@/constants/voice';
import {
    createVoiceTranscriptionJob,
    type VoiceCaptureQualityMetrics,
    type VoiceLanguageMode,
    type VoiceTranscriptionJob,
    type VoiceTranscriptionResponse,
} from '@/services/voice-transcription.service';
import {
    buildBrowserFallbackTranscription,
    createVoiceMediaRecorder,
    getVoiceStartErrorMessage,
    getVoiceRecordingFilename,
    getSpeechPreviewLocale,
    normalizeRecordedAudioMimeType,
    requestVoiceRecordingStream,
    stagePendingVoiceCapture,
} from '@/utils/voice-capture';
import createVoiceCaptureMonitor from '@/utils/voice-capture-metrics';
import { FiMic, FiX } from 'react-icons/fi';

const LANGUAGE_OPTIONS: { value: VoiceLanguageMode; label: string }[] = [
    { value: 'auto', label: 'Auto' },
    { value: 'en', label: 'EN' },
    { value: 'en-ur', label: 'EN+UR' },
    { value: 'en-pa', label: 'EN+PA' },
    { value: 'ur', label: 'UR' },
    { value: 'ar', label: 'AR' },
];

interface FloatingVoiceButtonProps {
    onQuickCapture?: (text: string) => void;
}

const resolveCandidateLanguages = (languageMode: VoiceLanguageMode) => {
    switch (languageMode) {
        case 'en-ur':
            return ['en', 'ur'];
        case 'en-pa':
            return ['en', 'pa'];
        case 'en-ar':
            return ['en', 'ar'];
        case 'auto':
        case 'other':
            return [];
        default:
            return [languageMode];
    }
};

export default function FloatingVoiceButton({ onQuickCapture }: FloatingVoiceButtonProps) {
    const router = useRouter();
    const { user } = useAuth();
    const { apiFetch } = useApi();
    const { trackEvent } = useTelemetry();
    const [hasMounted, setHasMounted] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);
    const [voiceError, setVoiceError] = useState<string | null>(null);
    const [languageMode, setLanguageMode] = useState<VoiceLanguageMode>(DEFAULT_VOICE_LANGUAGE_MODE);
    const [voiceJob, setVoiceJob] = useState<VoiceTranscriptionJob | null>(null);

    const mediaStreamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const shouldProcessOnStopRef = useRef(false);
    const recordingStartedAtRef = useRef<number | null>(null);
    const captureMonitorRef = useRef<Awaited<ReturnType<typeof createVoiceCaptureMonitor>> | null>(null);

    const canRecordAudio = hasMounted
        && typeof navigator !== 'undefined'
        && !!navigator.mediaDevices?.getUserMedia
        && typeof MediaRecorder !== 'undefined';

    const {
        isSupported: isSpeechPreviewSupported,
        interimText,
        start: startSpeech,
        stop: stopSpeech,
        error: speechError,
    } = useSpeechRecognition({
        language: getSpeechPreviewLocale(languageMode),
        interimResults: true,
        continuous: true,
        autoRestart: true,
        onFinal: (text) => {
            if (text.trim()) {
                setTranscript((prev) => `${prev}${text.trim()} `.trimStart());
            }
        },
    });

    const isVoiceSupported = canRecordAudio || isSpeechPreviewSupported;
    const previewText = [transcript.trim(), interimText.trim()].filter(Boolean).join(' ').trim();

    useEffect(() => {
        setHasMounted(true);
    }, []);

    useEffect(() => {
        if (speechError && !canRecordAudio) {
            setVoiceError(speechError);
        }
    }, [canRecordAudio, speechError]);

    useEffect(() => {
        if (!isVoiceSupported && hasMounted) {
            setVoiceError('Voice capture is not supported on this device.');
        }
    }, [hasMounted, isVoiceSupported]);

    useEffect(() => {
        return () => {
            shouldProcessOnStopRef.current = false;
            captureMonitorRef.current?.dispose();
            captureMonitorRef.current = null;
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach((track) => track.stop());
                mediaStreamRef.current = null;
            }
        };
    }, []);

    const stopMediaStream = () => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
        }
    };

    const cleanupAudioResources = () => {
        captureMonitorRef.current?.dispose();
        captureMonitorRef.current = null;
        stopMediaStream();
        setAudioLevel(0);
    };

    const processRecording = async (
        audioBlob: Blob | null,
        captureMeta: VoiceCaptureQualityMetrics | null,
        recordedMimeType?: string | null
    ) => {
        const browserTranscript = transcript.trim();
        if (!audioBlob && !browserTranscript) {
            setVoiceError('No voice note was captured. Please try again.');
            setIsExpanded(false);
            return;
        }

        setIsProcessing(true);
        setVoiceJob(null);
        let transcription: VoiceTranscriptionResponse | null = null;
        const finalJobRef = { current: null as VoiceTranscriptionJob | null };

        try {
            if (audioBlob && VOICE_BACKEND_TRANSCRIPTION_ENABLED) {
                void trackEvent({
                    eventType: 'voice_transcribe_requested',
                    value: 'floating_button',
                    metadata: {
                        languageMode,
                        captureRating: captureMeta?.rating || null,
                    },
                });
                finalJobRef.current = await createVoiceTranscriptionJob(apiFetch, {
                    audioBlob,
                    languageMode,
                    candidateLanguages: resolveCandidateLanguages(languageMode),
                    previewText: browserTranscript || null,
                    recordingDurationMs: recordingStartedAtRef.current ? Date.now() - recordingStartedAtRef.current : null,
                    captureMeta,
                    filename: getVoiceRecordingFilename(recordedMimeType),
                });
                setVoiceJob(finalJobRef.current);
            }
        } catch (error: any) {
            console.error('Voice transcription failed:', error);
            void trackEvent({
                eventType: 'voice_transcribe_failed',
                value: 'floating_button',
                metadata: {
                    code: error?.code || null,
                    retryable: Boolean(error?.retryable),
                },
            });
            setVoiceError(error?.message || 'Voice transcription failed. Using fallback if available.');
        }

        if (finalJobRef.current) {
            stagePendingVoiceCapture({
                jobId: finalJobRef.current.id,
                pendingJob: finalJobRef.current,
                languageMode,
                previewText: browserTranscript || null,
                captureMeta,
                audioUrl: finalJobRef.current.audioUrl || null,
            });

            if (onQuickCapture) {
                onQuickCapture(browserTranscript || '');
            } else {
                router.push('/entry/new?mode=quick&voiceSession=1');
            }

            setIsProcessing(false);
            setIsExpanded(false);
            setTranscript('');
            setVoiceError(null);
            setVoiceJob(finalJobRef.current);
            return;
        }

        if (!transcription && VOICE_ALLOW_BROWSER_FALLBACK && browserTranscript) {
            transcription = buildBrowserFallbackTranscription(browserTranscript, languageMode);
            setVoiceError('Transcript may need review before saving.');
            void trackEvent({
                eventType: 'voice_fallback_used',
                value: 'floating_button',
                metadata: {
                    reason: VOICE_BACKEND_TRANSCRIPTION_ENABLED ? 'backend_failed' : 'backend_disabled',
                },
            });
        }

        if (!transcription) {
            setIsProcessing(false);
            setIsExpanded(false);
            return;
        }

        transcription.captureMeta = captureMeta;

        stagePendingVoiceCapture({
            transcript: transcription,
            languageMode,
            audioUrl: null,
        });

        if (onQuickCapture) {
            onQuickCapture(transcription.cleanTranscript);
        } else {
            router.push('/entry/new?mode=quick&voiceSession=1');
        }

        setIsProcessing(false);
        setIsExpanded(false);
        setTranscript('');
        setVoiceError(null);
        setVoiceJob(finalJobRef.current);
    };

    const startRecording = async () => {
        if (!user || isProcessing) return;

        if (!isVoiceSupported) {
            setVoiceError('Voice capture is not supported on this device.');
            return;
        }

        setIsRecording(true);
        setIsExpanded(true);
        setTranscript('');
        setVoiceError(null);
        setVoiceJob(null);
        audioChunksRef.current = [];
        shouldProcessOnStopRef.current = true;
        recordingStartedAtRef.current = Date.now();

        try {
            if (canRecordAudio) {
                const stream = await requestVoiceRecordingStream();
                mediaStreamRef.current = stream;
                captureMonitorRef.current = await createVoiceCaptureMonitor(stream, {
                    onLevel: setAudioLevel,
                });

                const mediaRecorder = createVoiceMediaRecorder(stream);
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunksRef.current.push(event.data);
                    }
                };
                mediaRecorder.onstop = async () => {
                    const shouldProcess = shouldProcessOnStopRef.current;
                    const chunks = [...audioChunksRef.current];
                    audioChunksRef.current = [];
                    const captureMeta = captureMonitorRef.current ? await captureMonitorRef.current.stop() : null;
                    captureMonitorRef.current = null;
                    stopMediaStream();
                    setAudioLevel(0);

                    if (!shouldProcess) {
                        return;
                    }

                    const recordedMimeType = normalizeRecordedAudioMimeType(
                        mediaRecorder.mimeType || chunks[0]?.type || 'audio/webm'
                    );
                    const audioBlob = chunks.length > 0
                        ? new Blob(chunks, { type: recordedMimeType })
                        : null;
                    await processRecording(audioBlob, captureMeta, recordedMimeType);
                };
                mediaRecorder.start();
                mediaRecorderRef.current = mediaRecorder;
            }

            if (isSpeechPreviewSupported) {
                startSpeech();
            }

            void trackEvent({
                eventType: 'voice_recording_started',
                value: 'floating_button',
                metadata: {
                    hasAudioRecorder: canRecordAudio,
                    hasBrowserPreview: isSpeechPreviewSupported,
                },
            });
        } catch (error) {
            console.error('Failed to start voice capture:', error);
            setIsRecording(false);
            setIsExpanded(false);
            setVoiceError(getVoiceStartErrorMessage(error));
            cleanupAudioResources();
        }
    };

    const stopRecording = () => {
        setIsRecording(false);
        stopSpeech();

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            return;
        }

        cleanupAudioResources();
        void processRecording(null, null);
    };

    const handleDiscard = () => {
        shouldProcessOnStopRef.current = false;
        setIsRecording(false);
        stopSpeech();

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        } else {
            cleanupAudioResources();
        }

        setTranscript('');
        setIsExpanded(false);
        setIsProcessing(false);
        setVoiceError(null);
        setVoiceJob(null);
        setLanguageMode(DEFAULT_VOICE_LANGUAGE_MODE);
    };

    const statusMessage = voiceJob
        ? voiceJob.status === 'PENDING'
            ? 'Uploading and queuing your voice note...'
            : voiceJob.status === 'PROCESSING'
                ? 'Polishing transcript for accuracy...'
                : voiceJob.status === 'FAILED'
                    ? voiceJob.lastError || 'Voice transcription failed.'
                    : voiceJob.status === 'CANCELED'
                        ? 'Voice transcription was canceled.'
                        : voiceJob.captureMeta?.rating === 'poor'
                            ? 'Recording quality was rough, so review the transcript before saving.'
                            : null
        : null;

    if (!user || !hasMounted) return null;

    return (
        <>
            <div
                className={`fixed right-4 md:right-6 z-40 transition-all duration-300 ${isExpanded ? 'w-[min(19rem,calc(100vw-1.5rem))] md:w-80' : 'w-12 sm:w-14 md:w-16'}`}
                style={{ bottom: 'var(--app-floating-voice-bottom, 1.5rem)' }}
            >
                {isExpanded ? (
                    <div className="workspace-soft-panel rounded-2xl p-4 shadow-2xl">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-primary/70 animate-pulse' : 'bg-ink-muted/60'}`} />
                                <span className="text-sm font-medium workspace-heading">
                                    {isRecording ? 'Recording...' : isProcessing ? 'Processing...' : 'Ready'}
                                </span>
                            </div>
                            <button
                                onClick={handleDiscard}
                                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-ink-secondary hover:text-[rgb(var(--text-primary))] transition-colors"
                                disabled={isProcessing}
                                aria-label="Discard recording"
                            >
                                <FiX size={20} aria-hidden="true" />
                            </button>
                        </div>

                        <div className="flex items-center gap-1 mb-3 flex-wrap">
                            {LANGUAGE_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => !isRecording && setLanguageMode(opt.value)}
                                    disabled={isRecording || isProcessing}
                                    className={`px-2 py-2.5 rounded-md text-xs font-medium transition-colors ${
                                        languageMode === opt.value
                                            ? 'bg-primary text-white'
                                            : 'workspace-pill text-ink-secondary hover:text-[rgb(var(--text-primary))] disabled:opacity-40'
                                    }`}
                                    aria-pressed={languageMode === opt.value}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        {isRecording && canRecordAudio && (
                            <div className="flex items-center justify-center gap-1 h-12 mb-3">
                                {[...Array(20)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="w-1 bg-primary rounded-full transition-all duration-100"
                                        style={{
                                            height: `${Math.max(4, audioLevel * 100 * (0.5 + Math.random() * 0.5))}%`,
                                        }}
                                    />
                                ))}
                            </div>
                        )}

                        <div className="workspace-soft-panel rounded-lg p-3 mb-3 min-h-[60px] max-h-[120px] overflow-y-auto">
                            <p className="text-sm text-ink-secondary">
                                {previewText || (isRecording ? 'Start speaking...' : 'Tap the mic to start')}
                            </p>
                        </div>
                        {voiceError && (
                            <p className="text-xs text-ink-secondary mb-3">
                                {voiceError}
                            </p>
                        )}
                        {statusMessage && !voiceError && (
                            <p className="text-xs text-ink-secondary mb-3">
                                {statusMessage}
                            </p>
                        )}

                        <div className="flex gap-2">
                            {isRecording ? (
                                <button
                                    onClick={stopRecording}
                                    className="flex-1 py-2 px-4 bg-primary hover:bg-primary/85 text-white rounded-lg font-medium transition-colors"
                                >
                                    Stop & Save
                                </button>
                            ) : isProcessing ? (
                                <div className="flex-1 py-2 px-4 bg-primary/50 text-white rounded-lg font-medium flex items-center justify-center gap-2">
                                    <Spinner size="sm" variant="white" />
                                    Processing...
                                </div>
                            ) : null}
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={startRecording}
                        className="h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 rounded-full bg-gradient-to-br from-primary to-secondary shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-200 flex items-center justify-center group"
                        aria-label="Start voice recording"
                    >
                        <FiMic size={24} className="text-white group-hover:scale-110 transition-transform md:h-7 md:w-7" aria-hidden="true" />
                    </button>
                )}
            </div>
        </>
    );
}
