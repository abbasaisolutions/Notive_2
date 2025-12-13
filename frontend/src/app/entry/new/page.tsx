'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/auth-context';
import { useGamification } from '@/context/gamification-context';
import { structuredDataService, StructuredEntryData } from '@/services/structured-data.service';

const TiptapEditor = dynamic(() => import('@/components/editor/TiptapEditor'), {
    ssr: false,
    loading: () => <div className="glass-card rounded-2xl h-[300px] animate-pulse" />,
});

const MOODS = [
    { emoji: '😊', label: 'Happy', value: 'happy' },
    { emoji: '😌', label: 'Calm', value: 'calm' },
    { emoji: '😔', label: 'Sad', value: 'sad' },
    { emoji: '😰', label: 'Anxious', value: 'anxious' },
    { emoji: '😤', label: 'Frustrated', value: 'frustrated' },
    { emoji: '🤔', label: 'Thoughtful', value: 'thoughtful' },
    { emoji: '💪', label: 'Motivated', value: 'motivated' },
    { emoji: '😴', label: 'Tired', value: 'tired' },
    { emoji: '🙏', label: 'Grateful', value: 'grateful' },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export default function NewEntryPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, accessToken, isLoading: authLoading } = useAuth();
    const { awardXP, refreshStats } = useGamification();

    // Core content - use ref to avoid stale closures
    const [content, setContent] = useState('');
    const [contentHtml, setContentHtml] = useState('');
    const contentRef = useRef('');

    // AI-extracted metadata
    const [extractedData, setExtractedData] = useState<StructuredEntryData | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Override fields
    const [titleOverride, setTitleOverride] = useState('');
    const [moodOverride, setMoodOverride] = useState<string | null>(null);
    const [tagsOverride, setTagsOverride] = useState<string[]>([]);

    // Voice recording state
    const [isRecording, setIsRecording] = useState(false);
    const [interimText, setInterimText] = useState('');
    const isRecordingRef = useRef(false);
    const recognitionRef = useRef<any>(null);

    // UI state
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [showDetails, setShowDetails] = useState(false);
    const analysisTimeoutRef = useRef<NodeJS.Timeout>();

    // Sync content ref
    useEffect(() => {
        contentRef.current = content;
    }, [content]);

    // Sync recording ref
    useEffect(() => {
        isRecordingRef.current = isRecording;
    }, [isRecording]);

    // Initialize speech recognition ONCE
    useEffect(() => {
        const SpeechRecognitionAPI =
            (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition;

        if (!SpeechRecognitionAPI) return;

        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
            let interim = '';
            let final = '';

            // Process results correctly - only add FINAL results to content
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    final += result[0].transcript + ' ';
                } else {
                    interim += result[0].transcript;
                }
            }

            // Show interim text for visual feedback
            setInterimText(interim);

            // Only add final transcripts to content
            if (final.trim()) {
                const currentContent = contentRef.current;
                const separator = currentContent && !currentContent.endsWith(' ') ? ' ' : '';
                setContent(currentContent + separator + final.trim());
                setInterimText('');
            }
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            if (event.error !== 'no-speech') {
                setIsRecording(false);
            }
        };

        recognition.onend = () => {
            // Only restart if still recording
            if (isRecordingRef.current) {
                try {
                    recognition.start();
                } catch (e) {
                    // Ignore - already started or browser issue
                }
            }
        };

        recognitionRef.current = recognition;

        return () => {
            try {
                recognition.stop();
            } catch (e) {
                // Ignore
            }
        };
    }, []); // Empty dependency - only run once

    // Process voice input from URL params
    useEffect(() => {
        const voiceText = searchParams.get('voice');
        const promptText = searchParams.get('prompt');

        if (voiceText) {
            setContent(voiceText);
        } else if (promptText) {
            setContent(promptText);
        }
    }, [searchParams]);

    // Real-time content analysis
    const analyzeContent = useCallback(async (text: string) => {
        if (text.length < 30) {
            setExtractedData(null);
            return;
        }

        setIsAnalyzing(true);
        try {
            const data = await structuredDataService.extractStructuredData(text);
            setExtractedData(data);
        } catch (error) {
            console.error('Analysis failed:', error);
        } finally {
            setIsAnalyzing(false);
        }
    }, []);

    // Debounced analysis
    useEffect(() => {
        if (analysisTimeoutRef.current) {
            clearTimeout(analysisTimeoutRef.current);
        }

        analysisTimeoutRef.current = setTimeout(() => {
            analyzeContent(content);
        }, 1200);

        return () => {
            if (analysisTimeoutRef.current) {
                clearTimeout(analysisTimeoutRef.current);
            }
        };
    }, [content, analyzeContent]);

    const startRecording = () => {
        if (!recognitionRef.current) {
            setError('Speech recognition not supported in this browser');
            return;
        }

        setIsRecording(true);
        setInterimText('');
        try {
            recognitionRef.current.start();
        } catch (error: any) {
            if (error.message?.includes('already started')) {
                // Already running, that's fine
            } else {
                console.error('Failed to start recording:', error);
                setIsRecording(false);
            }
        }
    };

    const stopRecording = () => {
        setIsRecording(false);
        setInterimText('');
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {
                // Ignore
            }
        }
    };

    const handleEditorChange = useCallback((text: string, html: string) => {
        setContent(text);
        setContentHtml(html);
    }, []);

    const handleSave = async () => {
        if (!content.trim()) {
            setError('Please write or speak something before saving.');
            return;
        }

        setIsSaving(true);
        setError('');

        const finalTitle = titleOverride || extractedData?.title || null;
        const finalMood = moodOverride || extractedData?.primaryEmotion?.emotion || null;
        const finalTags = tagsOverride.length > 0 ? tagsOverride : (extractedData?.suggestedTags || []);

        try {
            const response = await fetch(`${API_URL}/entries`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                credentials: 'include',
                body: JSON.stringify({
                    title: finalTitle,
                    content,
                    contentHtml,
                    mood: finalMood,
                    tags: finalTags,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to save entry');
            }

            localStorage.setItem('lastEntryTime', Date.now().toString());
            awardXP(50, 'Entry created');
            refreshStats();
            router.push('/dashboard');
        } catch (err: any) {
            setError(err.message || 'Failed to save entry');
        } finally {
            setIsSaving(false);
        }
    };

    const addTag = (tag: string) => {
        if (tag && !tagsOverride.includes(tag)) {
            setTagsOverride([...tagsOverride, tag]);
        }
    };

    const removeTag = (tag: string) => {
        setTagsOverride(tagsOverride.filter(t => t !== tag));
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!user) {
        router.push('/login');
        return null;
    }

    const displayTitle = titleOverride || extractedData?.title || '';
    const displayMood = moodOverride || extractedData?.primaryEmotion?.emotion || null;
    const displayTags = tagsOverride.length > 0 ? tagsOverride : (extractedData?.suggestedTags || []);

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950">
            <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[150px] pointer-events-none" />

            <div className="max-w-3xl mx-auto px-4 py-6 relative z-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <Link href="/dashboard" className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="m15 18-6-6 6-6" />
                        </svg>
                    </Link>

                    <button
                        onClick={handleSave}
                        disabled={isSaving || !content.trim()}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-medium 
                                   disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-primary/25 
                                   transition-all flex items-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                </svg>
                                Save
                            </>
                        )}
                    </button>
                </div>

                {error && (
                    <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
                        {error}
                    </div>
                )}

                {/* Voice Recording Section */}
                <div className="glass-card rounded-2xl p-6 mb-4">
                    <div className="flex items-center justify-center mb-4">
                        <button
                            onClick={isRecording ? stopRecording : startRecording}
                            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${isRecording
                                    ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30'
                                    : 'bg-gradient-to-br from-primary to-secondary hover:shadow-lg hover:shadow-primary/30 hover:scale-105'
                                }`}
                        >
                            {isRecording ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white">
                                    <rect x="6" y="6" width="12" height="12" rx="2" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                    <line x1="12" x2="12" y1="19" y2="22" />
                                </svg>
                            )}
                        </button>
                    </div>

                    {/* Recording Status */}
                    {isRecording && (
                        <div className="text-center mb-4">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/20">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                <span className="text-red-400 text-sm font-medium">Recording...</span>
                            </div>
                        </div>
                    )}

                    {/* Interim Text (what's being recognized) */}
                    {interimText && (
                        <div className="text-center text-slate-400 italic text-sm mb-4 px-4">
                            "{interimText}"
                        </div>
                    )}

                    <p className="text-center text-slate-500 text-sm mb-4">
                        {isRecording ? 'Speak naturally, tap stop when done' : 'Tap to speak or type below'}
                    </p>

                    {/* Text Editor */}
                    <TiptapEditor
                        onChange={handleEditorChange}
                        placeholder="What's on your mind today?"
                        content={content}
                    />
                </div>

                {/* AI Analysis Summary */}
                {(extractedData || isAnalyzing) && (
                    <div className="glass-card rounded-2xl overflow-hidden mb-4">
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center ${isAnalyzing ? 'animate-pulse' : ''}`}>
                                    <span className="text-sm">🤖</span>
                                </div>
                                <div>
                                    <div className="text-white font-medium text-sm">
                                        {isAnalyzing ? 'Analyzing...' : 'AI Summary'}
                                    </div>
                                    {extractedData && !isAnalyzing && (
                                        <div className="text-slate-400 text-xs">
                                            {extractedData.wordCount} words
                                            {displayMood && ` • ${MOODS.find(m => m.value === displayMood)?.emoji || '😊'} ${displayMood}`}
                                            {displayTags.length > 0 && ` • ${displayTags.length} tags`}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className={`text-slate-400 transition-transform ${showDetails ? 'rotate-180' : ''}`}
                            >
                                <path d="m6 9 6 6 6-6" />
                            </svg>
                        </button>

                        {showDetails && extractedData && (
                            <div className="px-4 pb-4 space-y-4 border-t border-white/5">
                                {/* Title */}
                                <div className="pt-4">
                                    <label className="text-xs text-slate-400 mb-1 block">Title</label>
                                    <input
                                        type="text"
                                        value={displayTitle}
                                        onChange={(e) => setTitleOverride(e.target.value)}
                                        placeholder="Auto-generated title..."
                                        className="w-full bg-white/5 rounded-xl px-4 py-2 text-white placeholder-slate-500 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    />
                                </div>

                                {/* Mood */}
                                <div>
                                    <label className="text-xs text-slate-400 mb-2 block">Mood</label>
                                    <div className="flex flex-wrap gap-2">
                                        {MOODS.map((m) => (
                                            <button
                                                key={m.value}
                                                type="button"
                                                onClick={() => setMoodOverride(moodOverride === m.value ? null : m.value)}
                                                className={`px-3 py-1.5 rounded-xl text-sm flex items-center gap-1.5 transition-all ${displayMood === m.value
                                                        ? 'bg-primary text-white'
                                                        : 'bg-white/5 text-slate-300 hover:bg-white/10'
                                                    }`}
                                            >
                                                <span>{m.emoji}</span>
                                                <span>{m.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Tags */}
                                <div>
                                    <label className="text-xs text-slate-400 mb-2 block">Tags</label>
                                    <div className="flex flex-wrap gap-2">
                                        {displayTags.map((tag) => (
                                            <span key={tag} className="px-3 py-1 rounded-full bg-white/10 text-sm text-slate-200 flex items-center gap-2">
                                                #{tag}
                                                <button onClick={() => removeTag(tag)} className="text-slate-400 hover:text-white">×</button>
                                            </span>
                                        ))}
                                        <input
                                            type="text"
                                            placeholder="+ Add"
                                            className="px-3 py-1 rounded-full bg-white/5 text-sm text-white placeholder-slate-500 border border-white/10 focus:outline-none w-20"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    addTag((e.target as HTMLInputElement).value.trim());
                                                    (e.target as HTMLInputElement).value = '';
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Tips for empty state */}
                {!content && (
                    <div className="text-center text-slate-500 text-sm py-4">
                        <p>✨ Just speak or type — AI handles the rest!</p>
                    </div>
                )}
            </div>
        </div>
    );
}
