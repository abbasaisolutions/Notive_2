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
        }, 1000); // Faster feedback (1s)

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
                    extractedData, // Store full extracted data for insights
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
        <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white selection:bg-primary/30">
            <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[150px] pointer-events-none" />
            <div className="fixed bottom-0 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-3xl mx-auto px-4 py-8 relative z-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <Link href="/dashboard" className="p-3 -ml-2 rounded-2xl text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="m15 18-6-6 6-6" />
                        </svg>
                    </Link>

                    <button
                        onClick={handleSave}
                        disabled={isSaving || !content.trim()}
                        className="px-6 py-3 rounded-2xl bg-gradient-to-r from-primary to-purple-600 text-white font-semibold 
                                   disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-primary/25 hover:scale-105
                                   transition-all flex items-center gap-2 active:scale-95"
                    >
                        {isSaving ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                </svg>
                                Save Entry
                            </>
                        )}
                    </button>
                </div>

                {error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-300 px-6 py-4 rounded-2xl text-sm flex items-center gap-3 backdrop-blur-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
                        {error}
                    </div>
                )}

                {/* Main Capture Area */}
                <div className="relative mb-6 group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-purple-600/20 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    <div className="relative glass-card rounded-[2rem] p-8 border border-white/10 bg-slate-900/40 backdrop-blur-xl shadow-2xl">
                        {/* Voice Control - Floating Centered */}
                        <div className="flex flex-col items-center justify-center mb-8">
                            <button
                                onClick={isRecording ? stopRecording : startRecording}
                                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${isRecording
                                    ? 'bg-red-500 scale-110 shadow-[0_0_40px_rgba(239,68,68,0.4)]'
                                    : 'bg-gradient-to-br from-primary to-purple-600 hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:scale-105'
                                    }`}
                            >
                                {isRecording ? (
                                    <div className="relative">
                                        <div className="absolute inset-0 animate-ping opacity-75 bg-white rounded-full"></div>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white" className="relative z-10">
                                            <rect x="6" y="6" width="12" height="12" rx="2" />
                                        </svg>
                                    </div>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                        <line x1="12" x2="12" y1="19" y2="22" />
                                    </svg>
                                )}
                            </button>

                            <div className="mt-4 h-6">
                                {isRecording ? (
                                    <div className="flex items-center gap-2">
                                        <span className="relative flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                        </span>
                                        <span className="text-red-300 text-sm font-medium tracking-wide uppercase">Recording</span>
                                    </div>
                                ) : (
                                    <span className="text-slate-500 text-sm font-medium">Tap to speak</span>
                                )}
                            </div>
                        </div>

                        {/* Interim Text Display */}
                        {interimText && (
                            <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                                <p className="text-slate-300 italic text-lg animate-pulse">"{interimText}"</p>
                            </div>
                        )}

                        {/* Editor */}
                        <div className="relative">
                            <TiptapEditor
                                onChange={handleEditorChange}
                                placeholder="Start writing or speaking..."
                                content={content}
                            />
                        </div>
                    </div>
                </div>

                {/* AI Intelligence Panel */}
                {(extractedData || isAnalyzing) && (
                    <div className="relative group transition-all duration-300">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-2xl blur opacity-75 group-hover:opacity-100 transition-opacity" />

                        <div className="relative glass-card rounded-2xl overflow-hidden border border-white/10 bg-slate-900/60 backdrop-blur-xl">
                            <button
                                onClick={() => setShowDetails(!showDetails)}
                                className="w-full p-5 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg ${isAnalyzing ? 'animate-pulse' : ''}`}>
                                        <span className="text-lg">✨</span>
                                    </div>
                                    <div>
                                        <div className="text-white font-semibold flex items-center gap-2">
                                            AI Insights
                                            {isAnalyzing && (
                                                <span className="text-xs font-normal text-cyan-300 animate-pulse bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                                                    Analyzing...
                                                </span>
                                            )}
                                        </div>
                                        {extractedData && (
                                            <div className="text-slate-400 text-xs mt-1 flex items-center gap-2">
                                                <span>{extractedData.wordCount} words</span>
                                                {displayMood && (
                                                    <>
                                                        <span className="w-1 h-1 rounded-full bg-slate-600" />
                                                        <span className="text-white bg-white/10 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                                            {MOODS.find(m => m.value === displayMood)?.emoji} {displayMood}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className={`w-8 h-8 rounded-full bg-white/5 flex items-center justify-center transition-transform duration-300 ${showDetails ? 'rotate-180 bg-white/10' : ''}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400"><path d="m6 9 6 6 6-6" /></svg>
                                </div>
                            </button>

                            {/* Expanded Details */}
                            <div className={`transition-all duration-300 ease-in-out ${showDetails ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                                <div className="p-5 space-y-6 border-t border-white/5 bg-black/20">
                                    {extractedData && (
                                        <>
                                            {/* Insights Grid */}
                                            {extractedData.insights.length > 0 && (
                                                <div className="grid gap-3 p-4 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
                                                    <label className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-1">Key Insights</label>
                                                    {extractedData.insights.map((insight, i) => (
                                                        <div key={i} className="flex items-start gap-3 text-sm text-slate-200">
                                                            <span className="mt-1 text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 capitalize">
                                                                {insight.type}
                                                            </span>
                                                            <span className="leading-relaxed">{insight.content}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Growth & Patterns (Social Science Model) */}
                                            {extractedData.growthPoints && extractedData.growthPoints.length > 0 && (
                                                <div className="grid gap-3 p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <label className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">Growth & Patterns</label>
                                                        <span className="text-[10px] text-emerald-400/50 bg-emerald-500/10 px-1.5 rounded border border-emerald-500/10">Social Science Model</span>
                                                    </div>
                                                    {extractedData.growthPoints.map((point, i) => (
                                                        <div key={i} className="flex items-start gap-3 text-sm text-slate-200">
                                                            <span className={`mt-1 text-xs px-2 py-0.5 rounded border capitalize whitespace-nowrap ${point.category === 'professional' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                                                                point.category === 'relational' ? 'bg-pink-500/20 text-pink-300 border-pink-500/30' :
                                                                    point.category === 'spiritual' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                                                                        'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                                                }`}>
                                                                {point.category}
                                                            </span>
                                                            <div className="flex-1">
                                                                <p className="leading-relaxed opacity-90">{point.insight}</p>
                                                                {point.actionable && (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 mt-1 font-medium opacity-80">
                                                                        🚀 Actionable Step
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* EQ Metrics */}
                                            {extractedData.emotionalIntelligence && (
                                                <div className="p-5 rounded-xl bg-white/5 border border-white/5 transition-all hover:bg-white/[0.07]">
                                                    <div className="flex items-center justify-between mb-5">
                                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Emotional Intelligence</label>
                                                        <span className="text-xs px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 capitalize font-medium">
                                                            Dominant: {extractedData.emotionalIntelligence.dominantTrait}
                                                        </span>
                                                    </div>
                                                    <div className="space-y-4">
                                                        {/* Self Awareness */}
                                                        <div>
                                                            <div className="flex justify-between text-xs text-slate-300 mb-2">
                                                                <span>Self Awareness</span>
                                                                <span className="opacity-70">{extractedData.emotionalIntelligence.selfAwareness}/10</span>
                                                            </div>
                                                            <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                                                                    style={{ width: `${extractedData.emotionalIntelligence.selfAwareness * 10}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                        {/* Regulation */}
                                                        <div>
                                                            <div className="flex justify-between text-xs text-slate-300 mb-2">
                                                                <span>Self Regulation</span>
                                                                <span className="opacity-70">{extractedData.emotionalIntelligence.regulation}/10</span>
                                                            </div>
                                                            <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                                                                    style={{ width: `${extractedData.emotionalIntelligence.regulation * 10}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                        {/* Social Awareness */}
                                                        <div>
                                                            <div className="flex justify-between text-xs text-slate-300 mb-2">
                                                                <span>Social Awareness</span>
                                                                <span className="opacity-70">{extractedData.emotionalIntelligence.socialAwareness}/10</span>
                                                            </div>
                                                            <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                                                                    style={{ width: `${extractedData.emotionalIntelligence.socialAwareness * 10}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Smart Fields */}
                                            <div className="grid md:grid-cols-2 gap-6">
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="text-xs font-medium text-slate-400 mb-2 block uppercase tracking-wider">Suggested Title</label>
                                                        <input
                                                            type="text"
                                                            value={displayTitle}
                                                            onChange={(e) => setTitleOverride(e.target.value)}
                                                            className="w-full bg-white/5 hover:bg-white/10 transition-colors rounded-xl px-4 py-3 text-white placeholder-slate-500 border border-white/10 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="text-xs font-medium text-slate-400 mb-2 block uppercase tracking-wider">Mood</label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {MOODS.map((m) => (
                                                                <button
                                                                    key={m.value}
                                                                    onClick={() => setMoodOverride(moodOverride === m.value ? null : m.value)}
                                                                    className={`px-3 py-2 rounded-xl text-sm flex items-center gap-2 transition-all border ${displayMood === m.value
                                                                        ? 'bg-primary border-primary text-white shadow-lg shadow-primary/25'
                                                                        : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10 hover:border-white/10'
                                                                        }`}
                                                                >
                                                                    <span>{m.emoji}</span>
                                                                    <span>{m.label}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-4">
                                                    {(extractedData.people.length > 0 || extractedData.places.length > 0) && (
                                                        <div>
                                                            <label className="text-xs font-medium text-slate-400 mb-2 block uppercase tracking-wider">Deteceted Entities</label>
                                                            <div className="flex flex-wrap gap-2">
                                                                {extractedData.people.map((p, i) => (
                                                                    <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/20 text-sm">
                                                                        👤 {p.name} <span className="text-blue-500/50 text-xs">({p.relationship})</span>
                                                                    </span>
                                                                ))}
                                                                {extractedData.places.map((p, i) => (
                                                                    <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-sm">
                                                                        📍 {p.name}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div>
                                                        <label className="text-xs font-medium text-slate-400 mb-2 block uppercase tracking-wider">Tags</label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {displayTags.map((tag) => (
                                                                <span key={tag} className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 text-sm transition-colors">
                                                                    #{tag}
                                                                    <button onClick={() => removeTag(tag)} className="text-slate-500 hover:text-red-400 ml-1">×</button>
                                                                </span>
                                                            ))}
                                                            <input
                                                                type="text"
                                                                placeholder="+ Tag"
                                                                className="px-3 py-1.5 rounded-lg bg-transparent text-sm text-white placeholder-slate-600 border border-white/10 focus:border-primary/50 focus:outline-none w-24 hover:bg-white/5 focus:bg-white/5 transition-colors"
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
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Empty State Hint */}
                {!content && !isRecording && (
                    <div className="mt-12 text-center">
                        <p className="text-slate-500 text-sm font-medium">
                            <span className="text-primary">Tip:</span> Just speak naturally. AI will capture, format, and organize everything for you.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
