import { useCallback, useEffect, useRef, useState } from 'react';

interface UseSpeechRecognitionOptions {
    language?: string;
    interimResults?: boolean;
    continuous?: boolean;
    autoRestart?: boolean;
    onFinal?: (text: string) => void;
    onInterim?: (text: string) => void;
}

const ERROR_MESSAGES: Record<string, string> = {
    'no-speech': 'No speech detected. Please try again.',
    'audio-capture': 'Microphone not found. Please check your device.',
    'not-allowed': 'Microphone access denied. Please allow microphone access.',
    'network': 'Network error occurred. Please check your connection.',
    'aborted': 'Speech recognition was aborted.',
    'default': 'An error occurred with speech recognition.',
};

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
    const {
        language = 'en-US',
        interimResults = true,
        continuous = true,
        autoRestart = false,
        onFinal,
        onInterim,
    } = options;

    const [isSupported, setIsSupported] = useState(true);
    const [isListening, setIsListening] = useState(false);
    const [interimText, setInterimText] = useState('');
    const [error, setError] = useState<string | null>(null);

    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const listeningRef = useRef(false);
    const callbacksRef = useRef({ onFinal, onInterim });

    useEffect(() => {
        callbacksRef.current = { onFinal, onInterim };
    }, [onFinal, onInterim]);

    useEffect(() => {
        const SpeechRecognitionAPI =
            (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition;

        if (typeof window !== 'undefined' && SpeechRecognitionAPI) {
            const recognition = new SpeechRecognitionAPI();
            recognition.continuous = continuous;
            recognition.interimResults = interimResults;
            recognition.lang = language;

            recognition.onstart = () => {
                setError(null);
                setInterimText('');
            };

            recognition.onresult = (event: SpeechRecognitionEvent) => {
                let finalTranscript = '';
                let interim = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    const transcript = result[0].transcript;

                    if (result.isFinal) {
                        finalTranscript += transcript;
                    } else if (interimResults) {
                        interim += transcript;
                    }
                }

                if (interimResults) {
                    setInterimText(interim);
                    callbacksRef.current.onInterim?.(interim);
                }

                if (finalTranscript.trim()) {
                    const formatted = finalTranscript.trim();
                    callbacksRef.current.onFinal?.(formatted);
                    setInterimText('');
                }
            };

            recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
                const message = ERROR_MESSAGES[event.error] || ERROR_MESSAGES.default;
                setError(message);
                const shouldRestart = autoRestart && event.error === 'no-speech';
                if (!shouldRestart) {
                    setIsListening(false);
                    listeningRef.current = false;
                }

                if (shouldRestart) {
                    setTimeout(() => {
                        if (recognitionRef.current && listeningRef.current) {
                            try {
                                recognitionRef.current.start();
                            } catch (e) {
                                // Ignore if already started
                            }
                        }
                    }, 1000);
                }
            };

            recognition.onend = () => {
                if (autoRestart && listeningRef.current) {
                    try {
                        recognition.start();
                        return;
                    } catch (e) {
                        // Ignore and fall through to stop state
                    }
                }

                setIsListening(false);
                setInterimText('');
                listeningRef.current = false;
            };

            recognitionRef.current = recognition;
        } else {
            setIsSupported(false);
        }

        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
        };
    }, [language, interimResults, continuous, autoRestart]);

    const start = useCallback(() => {
        if (!recognitionRef.current) return;
        try {
            recognitionRef.current.start();
            setIsListening(true);
            listeningRef.current = true;
            setError(null);
        } catch (e) {
            setError('Failed to start voice recognition. Please try again.');
        }
    }, []);

    const stop = useCallback(() => {
        if (!recognitionRef.current) return;
        try {
            recognitionRef.current.stop();
        } catch (e) {
            // Ignore errors
        }
        setIsListening(false);
        listeningRef.current = false;
        setInterimText('');
    }, []);

    return {
        isSupported,
        isListening,
        interimText,
        error,
        start,
        stop,
    };
}

export default useSpeechRecognition;
