'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';

interface FloatingVoiceButtonProps {
    onQuickCapture?: (text: string) => void;
}

export default function FloatingVoiceButton({ onQuickCapture }: FloatingVoiceButtonProps) {
    const router = useRouter();
    const { user } = useAuth();
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);
    const recognitionRef = useRef<any>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number>();

    useEffect(() => {
        // Initialize speech recognition
        const SpeechRecognitionAPI =
            (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition;

        if (SpeechRecognitionAPI) {
            recognitionRef.current = new SpeechRecognitionAPI();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event: any) => {
                let finalTranscript = '';
                let interimTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    if (result.isFinal) {
                        finalTranscript += result[0].transcript + ' ';
                    } else {
                        interimTranscript += result[0].transcript;
                    }
                }

                if (finalTranscript) {
                    setTranscript(prev => prev + finalTranscript);
                }
            };

            recognitionRef.current.onerror = (event: any) => {
                console.error('Speech recognition error:', event.error);
                stopRecording();
            };

            recognitionRef.current.onend = () => {
                if (isRecording) {
                    // Auto-restart if still in recording mode
                    try {
                        recognitionRef.current.start();
                    } catch (e) {
                        // Ignore
                    }
                }
            };
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isRecording]);

    const startAudioVisualization = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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

    const startRecording = async () => {
        if (!user) {
            router.push('/login');
            return;
        }

        setIsRecording(true);
        setIsExpanded(true);
        setTranscript('');

        try {
            recognitionRef.current?.start();
            await startAudioVisualization();
        } catch (error) {
            console.error('Failed to start recording:', error);
            setIsRecording(false);
            setIsExpanded(false);
        }
    };

    const stopRecording = () => {
        setIsRecording(false);
        recognitionRef.current?.stop();

        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }

        if (transcript.trim()) {
            setIsProcessing(true);
            // Process the transcript
            setTimeout(() => {
                setIsProcessing(false);
                if (onQuickCapture) {
                    onQuickCapture(transcript);
                } else {
                    // Navigate to new entry with pre-filled content
                    router.push(`/entry/new?voice=${encodeURIComponent(transcript)}`);
                }
                setIsExpanded(false);
                setTranscript('');
            }, 1000);
        } else {
            setIsExpanded(false);
        }
    };

    const handleDiscard = () => {
        setIsRecording(false);
        recognitionRef.current?.stop();
        setTranscript('');
        setIsExpanded(false);

        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
    };

    if (!user) return null;

    return (
        <>
            {/* Floating Button */}
            <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${isExpanded ? 'w-80' : 'w-16'
                }`}>
                {isExpanded ? (
                    // Expanded Recording View
                    <div className="glass-card rounded-2xl p-4 shadow-2xl">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-green-500'
                                    }`} />
                                <span className="text-sm font-medium text-white">
                                    {isRecording ? 'Recording...' : isProcessing ? 'Processing...' : 'Ready'}
                                </span>
                            </div>
                            <button
                                onClick={handleDiscard}
                                className="text-slate-400 hover:text-white transition-colors"
                                disabled={isProcessing}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 6 6 18M6 6l12 12" />
                                </svg>
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
                        <div className="bg-slate-800/50 rounded-lg p-3 mb-3 min-h-[60px] max-h-[120px] overflow-y-auto">
                            <p className="text-sm text-slate-300">
                                {transcript || (isRecording ? 'Start speaking...' : 'Tap the mic to start')}
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                            {isRecording ? (
                                <button
                                    onClick={stopRecording}
                                    className="flex-1 py-2 px-4 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
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
                        className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-200 flex items-center justify-center group"
                        aria-label="Start voice recording"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="28"
                            height="28"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="group-hover:scale-110 transition-transform"
                        >
                            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" x2="12" y1="19" y2="22" />
                        </svg>
                    </button>
                )}
            </div>
        </>
    );
}
