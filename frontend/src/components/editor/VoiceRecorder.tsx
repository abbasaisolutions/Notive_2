'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

// Extend Window interface for webkit speech recognition
declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognition;
        webkitSpeechRecognition: new () => SpeechRecognition;
    }
    interface SpeechRecognition {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        start: () => void;
        stop: () => void;
        onresult: (event: SpeechRecognitionEvent) => void;
        onerror: (event: SpeechRecognitionErrorEvent) => void;
        onend: () => void;
        onstart: () => void;
    }
    interface SpeechRecognitionEvent {
        resultIndex: number;
        results: SpeechRecognitionResultList;
    }
    interface SpeechRecognitionResultList {
        readonly length: number;
        item: (index: number) => SpeechRecognitionResult;
        [index: number]: SpeechRecognitionResult;
    }
    interface SpeechRecognitionResult {
        readonly isFinal: boolean;
        [index: number]: SpeechRecognitionAlternative;
    }
    interface SpeechRecognitionAlternative {
        readonly transcript: string;
        readonly confidence: number;
    }
    interface SpeechRecognitionErrorEvent {
        error: string;
        message: string;
    }
}

interface VoiceRecorderProps {
    onTranscript: (text: string) => void;
    language?: string;
    showInterimResults?: boolean;
}

const ERROR_MESSAGES: Record<string, string> = {
    'no-speech': 'No speech detected. Please try again.',
    'audio-capture': 'Microphone not found. Please check your device.',
    'not-allowed': 'Microphone access denied. Please allow microphone access in your browser settings.',
    'network': 'Network error occurred. Please check your connection.',
    'aborted': 'Speech recognition was aborted.',
    'default': 'An error occurred with speech recognition.',
};

export default function VoiceRecorder({
    onTranscript,
    language = 'en-US',
    showInterimResults = false
}: VoiceRecorderProps) {
    const [isListening, setIsListening] = useState(false);
    const [isSupported, setIsSupported] = useState(true);
    const [interimText, setInterimText] = useState('');
    const [error, setError] = useState<string | null>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Check for both standard and webkit prefixed API
        const SpeechRecognitionAPI =
            (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition;

        if (typeof window !== 'undefined' && SpeechRecognitionAPI) {
            recognitionRef.current = new SpeechRecognitionAPI();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = language;

            recognitionRef.current.onstart = () => {
                setError(null);
                setInterimText('');
            };

            recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
                let finalTranscript = '';
                let interim = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    const transcript = result[0].transcript;

                    if (result.isFinal) {
                        finalTranscript += transcript;
                    } else if (showInterimResults) {
                        interim += transcript;
                    }
                }

                if (showInterimResults) {
                    setInterimText(interim);
                }

                if (finalTranscript) {
                    // Add proper spacing and capitalization
                    const formattedText = finalTranscript.trim();
                    onTranscript(formattedText);
                    setInterimText('');
                }
            };

            recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
                const errorMessage = ERROR_MESSAGES[event.error] || ERROR_MESSAGES.default;
                setError(errorMessage);
                setIsListening(false);

                // Auto-restart on certain recoverable errors
                if (event.error === 'no-speech' && isListening) {
                    restartTimeoutRef.current = setTimeout(() => {
                        if (recognitionRef.current && isListening) {
                            try {
                                recognitionRef.current.start();
                            } catch (e) {
                                // Ignore if already started
                            }
                        }
                    }, 1000);
                }
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
                setInterimText('');
            };
        } else {
            setIsSupported(false);
        }

        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (e) {
                    // Ignore errors on cleanup
                }
            }
            if (restartTimeoutRef.current) {
                clearTimeout(restartTimeoutRef.current);
            }
        };
    }, [onTranscript, language, showInterimResults, isListening]);

    const toggleListening = useCallback(() => {
        if (!recognitionRef.current) return;

        if (isListening) {
            try {
                recognitionRef.current.stop();
                setIsListening(false);
                setInterimText('');
                setError(null);
            } catch (e) {
                // Ignore errors
            }
        } else {
            try {
                recognitionRef.current.start();
                setIsListening(true);
                setError(null);
            } catch (e: any) {
                setError('Failed to start voice recognition. Please try again.');
            }
        }
    }, [isListening]);

    if (!isSupported) {
        return null;
    }

    return (
        <div className="relative">
            <button
                type="button"
                onClick={toggleListening}
                className={`p-2 rounded-lg transition-all ${isListening
                        ? 'bg-red-500/20 text-red-400 animate-pulse'
                        : error
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                title={
                    isListening
                        ? 'Stop listening'
                        : error
                            ? error
                            : 'Start voice input'
                }
                aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                aria-pressed={isListening}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
            </button>

            {/* Interim results tooltip */}
            {showInterimResults && interimText && (
                <div className="absolute top-full left-0 mt-2 px-3 py-2 bg-slate-800 text-slate-300 text-sm rounded-lg shadow-lg whitespace-nowrap z-10">
                    {interimText}...
                </div>
            )}
        </div>
    );
}
