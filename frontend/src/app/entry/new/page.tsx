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

    // Core content
    const [content, setContent] = useState('');
    const [contentHtml, setContentHtml] = useState('');

    // AI-extracted metadata (shown in summary panel)
    const [extractedData, setExtractedData] = useState<StructuredEntryData | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Override fields (user can modify AI suggestions)
    const [titleOverride, setTitleOverride] = useState('');
    const [moodOverride, setMoodOverride] = useState<string | null>(null);
    const [tagsOverride, setTagsOverride] = useState<string[]>([]);

    // Voice recording state
    const [isRecording, setIsRecording] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);
    const recognitionRef = useRef<any>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);

    // UI state
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [showDetails, setShowDetails] = useState(false);
    const analysisTimeoutRef = useRef<NodeJS.Timeout>();

    // Initialize speech recognition
    useEffect(() => {
        const SpeechRecognitionAPI =
            (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition;

        if (SpeechRecognitionAPI) {
            recognitionRef.current = new SpeechRecognitionAPI();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event: any) => {
                let transcript = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    transcript += event.results[i][0].transcript;
                }
                if (transcript) {
                    setContent(prev => prev + ' ' + transcript);
                }
            };

            recognitionRef.current.onerror = () => stopRecording();
            recognitionRef.current.onend = () => {
                if (isRecording) {
                    try { recognitionRef.current.start(); } catch (e) { }
                }
            };
        }

        return () => {
            if (recognitionRef.current) recognitionRef.current.stop();
            if (audioContextRef.current) audioContextRef.current.close();
        };
    }, [isRecording]);

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
        if (text.length < 20) {
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

    // Debounced analysis on content change
    useEffect(() => {
        if (analysisTimeoutRef.current) {
            clearTimeout(analysisTimeoutRef.current);
        }

        analysisTimeoutRef.current = setTimeout(() => {
            analyzeContent(content);
        }, 800);

        return () => {
            if (analysisTimeoutRef.current) {
                clearTimeout(analysisTimeoutRef.current);
            }
        };
    }, [content, analyzeContent]);

    const startRecording = async () => {
        setIsRecording(true);
        try {
            recognitionRef.current?.start();

            // Start audio visualization
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContextRef.current = new AudioContext();
            analyserRef.current = audioContextRef.current.createAnalyser();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            source.connect(analyserRef.current);
            analyserRef.current.fftSize = 256;

            const updateLevel = () => {
                if (!analyserRef.current || !isRecording) return;
                const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
                analyserRef.current.getByteFrequencyData(dataArray);
                const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
                setAudioLevel(avg / 255);
                requestAnimationFrame(updateLevel);
            };
            updateLevel();
        } catch (error) {
            console.error('Failed to start recording:', error);
            setIsRecording(false);
        }
    };

    const stopRecording = () => {
        setIsRecording(false);
        recognitionRef.current?.stop();
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
    };

    const handleEditorChange = (text: string, html: string) => {
        setContent(text);
        setContentHtml(html);
    };

    const handleSave = async () => {
        if (!content.trim()) {
            setError('Please write or speak something before saving.');
            return;
        }

        setIsSaving(true);
        setError('');

        // Use overrides if set, otherwise use extracted data
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

            // Store entry time for smart prompts
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

    // Get display values (overrides or extracted)
    const displayTitle = titleOverride || extractedData?.title || '';
    const displayMood = moodOverride || extractedData?.primaryEmotion?.emotion || null;
    const displayTags = tagsOverride.length > 0 ? tagsOverride : (extractedData?.suggestedTags || []);

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950">
            {/* Ambient background */}
            <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[150px] pointer-events-none" />
            <div className="fixed bottom-0 right-1/4 w-64 h-64 bg-secondary/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="max-w-3xl mx-auto px-4 py-6 relative z-10">
                {/* Minimal Header */}
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
                                    <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
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

                {/* Main Content Area - Voice First */}
                <div className="glass-card rounded-2xl p-6 mb-4">
                    {/* Voice Recording Button - Prominent */}
                    <div className="flex items-center justify-center mb-6">
                        <button
                            onClick={isRecording ? stopRecording : startRecording}
                            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${isRecording
                                    ? 'bg-red-500 hover:bg-red-600 animate-pulse shadow-lg shadow-red-500/30'
                                    : 'bg-gradient-to-br from-primary to-secondary hover:shadow-lg hover:shadow-primary/30 hover:scale-105'
                                }`}
                        >
                            {isRecording ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2">
                                    <rect x="6" y="6" width="12" height="12" rx="2" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                    <line x1="12" x2="12" y1="19" y2="22" />
                                </svg>
                            )}
                        </button>
                    </div>

                    {/* Recording Indicator */}
                    {isRecording && (
                        <div className="flex items-center justify-center gap-2 mb-4">
                            <div className="flex items-center gap-1">
                                {[...Array(10)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="w-1 bg-red-400 rounded-full transition-all"
                                        style={{ height: `${Math.max(8, audioLevel * 100 * (0.5 + Math.random() * 0.5))}px` }}
                                    />
                                ))}
                            </div>
                            <span className="text-red-400 text-sm font-medium ml-2">Listening...</span>
                        </div>
                    )}

                    {/* Prompt text */}
                    <p className="text-center text-slate-400 mb-4">
                        {isRecording ? 'Speak your thoughts...' : 'Tap the mic to start speaking, or type below'}
                    </p>

                    {/* Text Editor */}
                    <TiptapEditor
                        onChange={handleEditorChange}
                        placeholder="What's on your mind today? Just start writing or speaking..."
                        initialContent={content}
                    />
                </div>

                {/* AI Analysis Summary - Shows extracted info */}
                {(extractedData || isAnalyzing) && (
                    <div className="glass-card rounded-2xl overflow-hidden mb-4">
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center ${isAnalyzing ? 'animate-pulse' : ''}`}>
                                    <span className="text-white text-sm">🤖</span>
                                </div>
                                <div className="text-left">
                                    <div className="text-white font-medium text-sm">
                                        {isAnalyzing ? 'Analyzing...' : 'AI Summary'}
                                    </div>
                                    {extractedData && !isAnalyzing && (
                                        <div className="text-slate-400 text-xs">
                                            {extractedData.wordCount} words • {displayMood && `${MOODS.find(m => m.value === displayMood)?.emoji || '😊'} ${displayMood}`}
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

                        {/* Expanded Details */}
                        {showDetails && extractedData && (
                            <div className="px-4 pb-4 space-y-4 border-t border-white/5">
                                {/* Title */}
                                <div className="pt-4">
                                    <label className="text-xs text-slate-400 mb-1 block">Title (auto-generated)</label>
                                    <input
                                        type="text"
                                        value={displayTitle}
                                        onChange={(e) => setTitleOverride(e.target.value)}
                                        placeholder="Title will be generated..."
                                        className="w-full bg-white/5 rounded-xl px-4 py-2 text-white placeholder-slate-500 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    />
                                </div>

                                {/* Mood */}
                                <div>
                                    <label className="text-xs text-slate-400 mb-2 block">Mood (auto-detected)</label>
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
                                    <label className="text-xs text-slate-400 mb-2 block">Tags (auto-extracted)</label>
                                    <div className="flex flex-wrap gap-2">
                                        {displayTags.map((tag) => (
                                            <span
                                                key={tag}
                                                className="px-3 py-1 rounded-full bg-white/10 text-sm text-slate-200 flex items-center gap-2"
                                            >
                                                #{tag}
                                                <button onClick={() => removeTag(tag)} className="text-slate-400 hover:text-white">×</button>
                                            </span>
                                        ))}
                                        <input
                                            type="text"
                                            placeholder="+ Add tag"
                                            className="px-3 py-1 rounded-full bg-white/5 text-sm text-white placeholder-slate-500 border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50 w-24"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    addTag((e.target as HTMLInputElement).value.trim());
                                                    (e.target as HTMLInputElement).value = '';
                                                }
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Extracted Insights */}
                                {extractedData.insights.length > 0 && (
                                    <div>
                                        <label className="text-xs text-slate-400 mb-2 block">Insights Found</label>
                                        <div className="space-y-2">
                                            {extractedData.insights.slice(0, 3).map((insight, i) => (
                                                <div key={i} className="text-sm text-slate-300 bg-white/5 rounded-lg px-3 py-2">
                                                    <span className="text-primary capitalize">{insight.type}:</span> {insight.content}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* People & Places */}
                                {(extractedData.people.length > 0 || extractedData.places.length > 0) && (
                                    <div className="flex gap-4">
                                        {extractedData.people.length > 0 && (
                                            <div className="flex-1">
                                                <label className="text-xs text-slate-400 mb-1 block">People</label>
                                                <div className="flex flex-wrap gap-1">
                                                    {extractedData.people.slice(0, 3).map((p, i) => (
                                                        <span key={i} className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">
                                                            👤 {p.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {extractedData.places.length > 0 && (
                                            <div className="flex-1">
                                                <label className="text-xs text-slate-400 mb-1 block">Places</label>
                                                <div className="flex flex-wrap gap-1">
                                                    {extractedData.places.slice(0, 3).map((p, i) => (
                                                        <span key={i} className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded-full">
                                                            📍 {p.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Quick Tips */}
                {!content && (
                    <div className="text-center text-slate-500 text-sm py-6">
                        <p className="mb-2">✨ Tips for effortless journaling:</p>
                        <p>Just speak or type naturally — AI will extract title, mood, tags, and insights automatically!</p>
                    </div>
                )}
            </div>
        </div>
    );
}
