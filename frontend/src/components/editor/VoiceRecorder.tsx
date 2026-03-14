'use client';

import React, { useCallback } from 'react';
import useSpeechRecognition from '@/hooks/use-speech-recognition';
import { FiMic, FiMicOff } from 'react-icons/fi';

interface VoiceRecorderProps {
    onTranscript: (text: string) => void;
    language?: string;
    showInterimResults?: boolean;
}

export default function VoiceRecorder({
    onTranscript,
    language = 'en-US',
    showInterimResults = false
}: VoiceRecorderProps) {
    const handleFinal = useCallback((text: string) => {
        if (text.trim()) {
            onTranscript(text.trim());
        }
    }, [onTranscript]);

    const {
        isSupported,
        isListening,
        interimText,
        error,
        start,
        stop,
    } = useSpeechRecognition({
        language,
        interimResults: showInterimResults,
        continuous: true,
        autoRestart: false,
        onFinal: handleFinal,
    });

    const toggleListening = useCallback(() => {
        if (isListening) {
            stop();
        } else {
            start();
        }
    }, [isListening, start, stop]);

    if (!isSupported) {
        return null;
    }

    return (
        <div className="relative">
            <button
                type="button"
                onClick={toggleListening}
                className={`p-2 rounded-lg transition-all ${isListening
                    ? 'bg-primary/20 text-primary animate-pulse'
                    : error
                        ? 'bg-white/[0.07] text-ink-secondary'
                        : 'text-ink-secondary hover:text-white hover:bg-white/10'
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
                {isListening ? <FiMicOff size={18} aria-hidden="true" /> : <FiMic size={18} aria-hidden="true" />}
            </button>

            {/* Interim results tooltip */}
            {showInterimResults && interimText && (
                <div className="absolute top-full left-0 mt-2 px-3 py-2 bg-surface-2 text-ink-secondary text-sm rounded-lg shadow-lg whitespace-nowrap z-10">
                    {interimText}...
                </div>
            )}
        </div>
    );
}
