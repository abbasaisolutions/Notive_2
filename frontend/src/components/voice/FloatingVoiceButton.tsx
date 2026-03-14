'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import useApi from '@/hooks/use-api';
import useSpeechRecognition from '@/hooks/use-speech-recognition';
import { API_URL } from '@/constants/config';
import { FiMic, FiX } from 'react-icons/fi';

interface FloatingVoiceButtonProps {
    onQuickCapture?: (text: string) => void;
}

export default function FloatingVoiceButton({ onQuickCapture }: FloatingVoiceButtonProps) {
    const router = useRouter();
    const { user } = useAuth();
    const { apiFetch } = useApi();
    const [hasMounted, setHasMounted] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const animationFrameRef = useRef<number>();
    const [voiceError, setVoiceError] = useState<string | null>(null);

    const {
        isSupported: isVoiceSupported,
        start: startSpeech,
        stop: stopSpeech,
        error: speechError,
    } = useSpeechRecognition({
        language: 'en-US',
        interimResults: true,
        continuous: true,
        autoRestart: true,
        onFinal: (text) => {
            if (text.trim()) {
                setTranscript(prev => prev + text.trim() + ' ');
            }
        },
    });

    useEffect(() => {
        setHasMounted(true);
    }, []);

    useEffect(() => {
        if (speechError) {
            setVoiceError(speechError);
        }
    }, [speechError]);

    useEffect(() => {
        if (!isVoiceSupported) {
            setVoiceError('Speech recognition not supported on this device.');
        }
    }, [isVoiceSupported]);

    useEffect(() => {
        return () => {
            cleanupAudioResources();
        };
    }, []);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const startRecording = async () => {
        if (!user) return;

        if (!isVoiceSupported) {
            setVoiceError('Speech recognition not supported on this device.');
            return;
        }

        setIsRecording(true);
        setIsExpanded(true);
        setTranscript('');
        audioChunksRef.current = [];

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            // Start visualization
            startAudioVisualization(stream);

            // Start Speech Recognition
            startSpeech();

            // Start Media Recorder
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };
            mediaRecorder.start();
            mediaRecorderRef.current = mediaRecorder;

        } catch (error) {
            console.error('Failed to start recording:', error);
            setIsRecording(false);
            setIsExpanded(false);
        }
    };

    const stopRecording = () => {
        setIsRecording(false);
        stopSpeech();

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();

            // Wait for data to be available
            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await processRecording(audioBlob);
            };
        } else {
            // Fallback if no media recorder (shouldn't happen if started correctly)
            processRecording(null);
        }

        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }

        stopMediaStream();
    };

    const processRecording = async (audioBlob: Blob | null) => {
        if (transcript.trim()) {
            setIsProcessing(true);

            let audioUrl = '';

            if (audioBlob) {
                try {
                    const formData = new FormData();
                    formData.append('file', audioBlob, 'voice-note.webm');

                                        const response = await apiFetch(`${API_URL}/files/upload`, {
                        method: 'POST',
                        body: formData
                    });

                    if (response.ok) {
                        const data = await response.json();
                        audioUrl = data.url;
                    }
                } catch (err) {
                    console.error('Audio upload failed', err);
                }
            }

            // Process the transcript
            setTimeout(() => {
                setIsProcessing(false);
                if (onQuickCapture) {
                    onQuickCapture(transcript);
                } else {
                    // Navigate to new entry with pre-filled content
                    const params = new URLSearchParams();
                    params.set('mode', 'quick');
                    params.set('voice', transcript);
                    if (audioUrl) {
                        params.set('audioUrl', audioUrl);
                    }
                    router.push(`/entry/new?${params.toString()}`);
                }
                setIsExpanded(false);
                setTranscript('');
            }, 500);
        } else {
            setIsExpanded(false);
        }
    };

    // Helper modified to accept stream
    const startAudioVisualization = async (stream: MediaStream) => {
        try {
            audioContextRef.current = new AudioContext();
            analyserRef.current = audioContextRef.current.createAnalyser();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            source.connect(analyserRef.current);
            analyserRef.current.fftSize = 256;

            const updateAudioLevel = () => {
                if (!analyserRef.current) return;

                const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
                analyserRef.current.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                setAudioLevel(average / 255);

                animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
            };

            updateAudioLevel();
        } catch (error) {
            console.error('Error accessing microphone:', error);
        }
    };

    const handleDiscard = () => {
        setIsRecording(false);
        stopSpeech();

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }

        setTranscript('');
        setIsExpanded(false);
        setIsProcessing(false);
        setAudioLevel(0);

        cleanupAudioResources();
    };

    const stopMediaStream = () => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
    };

    const cleanupAudioResources = () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = undefined;
        }

        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        analyserRef.current = null;
        stopMediaStream();
    };

    if (!user || !hasMounted) return null;

    return (
        <>
            {/* Floating Button */}
            <div
                className={`fixed right-4 md:right-6 z-40 transition-all duration-300 ${isExpanded ? 'w-[min(19rem,calc(100vw-1.5rem))] md:w-80' : 'w-12 sm:w-14 md:w-16'}`}
                style={{ bottom: 'var(--app-floating-voice-bottom, 1.5rem)' }}
            >
                {isExpanded ? (
                    // Expanded Recording View
                    <div className="glass-card rounded-2xl p-4 shadow-2xl">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-white/60 animate-pulse' : 'bg-neutral-400'
                                    }`} />
                                <span className="text-sm font-medium text-white">
                                    {isRecording ? 'Recording...' : isProcessing ? 'Processing...' : 'Ready'}
                                </span>
                            </div>
                            <button
                                onClick={handleDiscard}
                                className="text-ink-secondary hover:text-white transition-colors"
                                disabled={isProcessing}
                            >
                                <FiX size={20} aria-hidden="true" />
                            </button>
                        </div>

                        {/* Waveform Visualization */}
                        {isRecording && (
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

                        {/* Transcript Preview */}
                        <div className="bg-surface-2/50 rounded-lg p-3 mb-3 min-h-[60px] max-h-[120px] overflow-y-auto">
                            <p className="text-sm text-ink-secondary">
                                {transcript || (isRecording ? 'Start speaking...' : 'Tap the mic to start')}
                            </p>
                        </div>
                        {voiceError && (
                            <p className="text-xs text-zinc-300 mb-3">
                                {voiceError}
                            </p>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                            {isRecording ? (
                                <button
                                    onClick={stopRecording}
                                    className="flex-1 py-2 px-4 bg-primary hover:bg-primary/85 text-white rounded-lg font-medium transition-colors"
                                >
                                    Stop & Save
                                </button>
                            ) : isProcessing ? (
                                <div className="flex-1 py-2 px-4 bg-primary/50 text-white rounded-lg font-medium flex items-center justify-center">
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                    Processing...
                                </div>
                            ) : null}
                        </div>
                    </div>
                ) : (
                    // Collapsed Button
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

