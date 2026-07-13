import { useCallback, useEffect, useRef, useState } from 'react';
import { getNativePlatform } from '@/utils/platform';
import type { PluginListenerHandle } from '@capacitor/core';
import type { SpeechRecognitionPlugin } from '@capacitor-community/speech-recognition';

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

// Android's native SpeechRecognizer session ends after a short pause in speech,
// even when we intend to keep listening (autoRestart). Restart it promptly so
// continuous dictation feels uninterrupted, mirroring the Web Speech API's
// `continuous: true` behavior which Android's WebView doesn't implement at all.
const NATIVE_RESTART_DELAY_MS = 400;

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
    const optionsRef = useRef({ language, interimResults, continuous, autoRestart });
    optionsRef.current = { language, interimResults, continuous, autoRestart };

    // Native (Android) speech recognition plumbing — Android's Capacitor WebView
    // has no `webkitSpeechRecognition`, so live/interim text needs the device's
    // native SpeechRecognizer via a Capacitor plugin instead of the browser API.
    const isNativeAndroidRef = useRef(getNativePlatform() === 'android');
    const nativePluginRef = useRef<SpeechRecognitionPlugin | null>(null);
    const nativeListenersRef = useRef<PluginListenerHandle[]>([]);
    const nativeInterimRef = useRef('');
    const nativeRestartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        callbacksRef.current = { onFinal, onInterim };
    }, [onFinal, onInterim]);

    const clearNativeRestartTimeout = useCallback(() => {
        if (nativeRestartTimeoutRef.current) {
            clearTimeout(nativeRestartTimeoutRef.current);
            nativeRestartTimeoutRef.current = null;
        }
    }, []);

    const teardownNativeListeners = useCallback(async () => {
        const handles = nativeListenersRef.current;
        nativeListenersRef.current = [];
        await Promise.all(handles.map((handle) => handle.remove().catch(() => {})));
    }, []);

    const startNativeListening = useCallback(async () => {
        const plugin = nativePluginRef.current;
        if (!plugin) return;

        try {
            let permission = await plugin.checkPermissions();
            if (permission.speechRecognition !== 'granted') {
                permission = await plugin.requestPermissions();
            }
            if (permission.speechRecognition !== 'granted') {
                setError(ERROR_MESSAGES['not-allowed']);
                setIsListening(false);
                listeningRef.current = false;
                return;
            }

            await teardownNativeListeners();
            nativeInterimRef.current = '';
            setInterimText('');
            setError(null);

            const partialHandle = await plugin.addListener('partialResults', (data) => {
                const top = data.matches?.[0]?.trim() ?? '';
                nativeInterimRef.current = top;
                if (optionsRef.current.interimResults) {
                    setInterimText(top);
                    callbacksRef.current.onInterim?.(top);
                }
            });

            const stateHandle = await plugin.addListener('listeningState', (data) => {
                if (data.status !== 'stopped') return;

                const finalText = nativeInterimRef.current.trim();
                nativeInterimRef.current = '';
                setInterimText('');
                if (finalText) {
                    callbacksRef.current.onFinal?.(finalText);
                }

                if (listeningRef.current && optionsRef.current.autoRestart) {
                    clearNativeRestartTimeout();
                    nativeRestartTimeoutRef.current = setTimeout(() => {
                        if (listeningRef.current) {
                            void startNativeListening();
                        }
                    }, NATIVE_RESTART_DELAY_MS);
                } else {
                    setIsListening(false);
                    listeningRef.current = false;
                }
            });

            nativeListenersRef.current = [partialHandle, stateHandle];

            await plugin.start({
                language: optionsRef.current.language,
                partialResults: true,
                popup: false,
            });
        } catch (e) {
            setError(ERROR_MESSAGES.default);
            setIsListening(false);
            listeningRef.current = false;
        }
    }, [clearNativeRestartTimeout, teardownNativeListeners]);

    const stopNativeListening = useCallback(async () => {
        clearNativeRestartTimeout();
        await teardownNativeListeners();
        nativeInterimRef.current = '';
        setInterimText('');
        try {
            await nativePluginRef.current?.stop();
        } catch (e) {
            // Ignore errors
        }
    }, [clearNativeRestartTimeout, teardownNativeListeners]);

    useEffect(() => {
        if (isNativeAndroidRef.current) {
            let cancelled = false;
            void (async () => {
                try {
                    const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
                    if (cancelled) return;
                    nativePluginRef.current = SpeechRecognition;
                    const { available } = await SpeechRecognition.available();
                    if (!cancelled) setIsSupported(available);
                } catch (e) {
                    if (!cancelled) setIsSupported(false);
                }
            })();

            return () => {
                cancelled = true;
                listeningRef.current = false;
                void stopNativeListening();
            };
        }

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
    }, [language, interimResults, continuous, autoRestart, stopNativeListening]);

    const start = useCallback(() => {
        if (isNativeAndroidRef.current) {
            if (!nativePluginRef.current) return;
            setIsListening(true);
            listeningRef.current = true;
            setError(null);
            void startNativeListening();
            return;
        }

        if (!recognitionRef.current) return;
        try {
            recognitionRef.current.start();
            setIsListening(true);
            listeningRef.current = true;
            setError(null);
        } catch (e) {
            setError('Couldn’t start voice recognition. Please try again.');
        }
    }, [startNativeListening]);

    const stop = useCallback(() => {
        if (isNativeAndroidRef.current) {
            setIsListening(false);
            listeningRef.current = false;
            void stopNativeListening();
            return;
        }

        if (!recognitionRef.current) return;
        try {
            recognitionRef.current.stop();
        } catch (e) {
            // Ignore errors
        }
        setIsListening(false);
        listeningRef.current = false;
        setInterimText('');
    }, [stopNativeListening]);

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
