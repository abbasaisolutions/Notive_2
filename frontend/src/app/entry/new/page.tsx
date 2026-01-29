'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/auth-context';
import { useGamification } from '@/context/gamification-context';
import { structuredDataService, StructuredEntryData } from '@/services/structured-data.service';
import { MOOD_ICONS } from '@/constants/moods';
import { MapPin, Rocket, Sparkles, User } from 'lucide-react';
import RewriteToolbar from '@/components/editor/RewriteToolbar';

const TiptapEditor = dynamic(() => import('@/components/editor/TiptapEditor'), {
    ssr: false,
    loading: () => <div className="glass-card rounded-2xl h-[300px] animate-pulse" />,
});

const MOODS = [
    { icon: MOOD_ICONS.happy, label: 'Happy', value: 'happy' },
    { icon: MOOD_ICONS.calm, label: 'Calm', value: 'calm' },
    { icon: MOOD_ICONS.sad, label: 'Sad', value: 'sad' },
    { icon: MOOD_ICONS.anxious, label: 'Anxious', value: 'anxious' },
    { icon: MOOD_ICONS.frustrated, label: 'Frustrated', value: 'frustrated' },
    { icon: MOOD_ICONS.thoughtful, label: 'Thoughtful', value: 'thoughtful' },
    { icon: MOOD_ICONS.motivated, label: 'Motivated', value: 'motivated' },
    { icon: MOOD_ICONS.tired, label: 'Tired', value: 'tired' },
    { icon: MOOD_ICONS.grateful, label: 'Grateful', value: 'grateful' },
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
    const [extractedData, setExtractedData] = useState<StructuredEntryData | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Override fields
    const [titleOverride, setTitleOverride] = useState('');
    const [moodOverride, setMoodOverride] = useState<string | null>(null);
    const [tagsOverride, setTagsOverride] = useState<string[]>([]);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [coverImage, setCoverImage] = useState<string | null>(null);

    // Voice recording state
    const [isRecording, setIsRecording] = useState(false);
    const [interimText, setInterimText] = useState('');
    const isRecordingRef = useRef(false);
    const recognitionRef = useRef<any>(null);

    // UI state
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [error, setError] = useState('');
    const [showDetails, setShowDetails] = useState(false);
    const [entryId, setEntryId] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();
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
        const audioParam = searchParams.get('audioUrl');

        if (voiceText) {
            setContent(voiceText);
            if (audioParam) setAudioUrl(audioParam);
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

    // Auto-save logic
    useEffect(() => {
        // Don't auto-save if empty or just loaded
        if (!content.trim() || isSaving) return;

        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
        }

        autoSaveTimeoutRef.current = setTimeout(() => {
            handleSave(true); // true = isAutoSave
        }, 3000); // Auto-save after 3 seconds of inactivity

        return () => {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
        };
    }, [content, contentHtml, titleOverride, moodOverride, tagsOverride, audioUrl, coverImage, extractedData]);

    const handleSave = async (isAutoSave = false) => {
        if (!content.trim()) {
            if (!isAutoSave) setError('Please write or speak something before saving.');
            return;
        }

        setIsSaving(true);
        if (!isAutoSave) setError('');

        const finalTitle = titleOverride || extractedData?.title || null;
        const finalMood = moodOverride || extractedData?.primaryEmotion?.emotion || null;
        const finalTags = tagsOverride.length > 0 ? tagsOverride : (extractedData?.suggestedTags || []);

        try {
            const method = entryId ? 'PUT' : 'POST';
            const url = entryId ? `${API_URL}/entries/${entryId}` : `${API_URL}/entries`;

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    title: finalTitle,
                    content,
                    contentHtml,
                    mood: finalMood,
                    tags: finalTags,
                    audioUrl,
                    coverImage,
                    extractedData,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to save entry');
            }

            // If created, set entry ID for future updates
            if (!entryId && data.entry?.id) {
                setEntryId(data.entry.id);
            }

            setLastSaved(new Date());

            if (!isAutoSave) {
                localStorage.setItem('lastEntryTime', Date.now().toString());
                if (!entryId) {
                    // Only award XP on first manual save/creation if we decide auto-save shouldn't grant XP repeatedly
                    // But actually, XP logic should probably handle this or be on first creation only.
                    awardXP(50, 'Entry created');
                    refreshStats();
                }
                router.push('/dashboard');
            }
        } catch (err: any) {
            console.error('Save error:', err);
            if (!isAutoSave) setError(err.message || 'Failed to save entry');
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

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${API_URL}/files/upload`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to upload image');
            }

            // Append image to content (Tiptap handles this better with extensions, but for now specific markdown/html)
            // Or ideally store as `coverImage` if first one, or insert into content.
            // Let's insert into content as markdown image for simplicity with text-based editor fallback
            // But since we use Tiptap, inserting HTML is better if Tiptap supports it via props or we append.
            // Current Tiptap setup seems basic. Let's append to content.

            // Actually, TiptapEditor likely updates `contentHtml`?
            // Since we don't have direct access to editor instance here without refactor, 
            // let's append HTML image tag to `contentHtml` and `content` text.

            const imageMarkdown = `\n![Image](${data.url})\n`;
            const newContent = content + imageMarkdown;
            setContent(newContent);

            const imageHtml = `<p><img src="${data.url}" alt="Entry image" /></p>`;
            const updatedHtml = contentHtml ? `${contentHtml}${imageHtml}` : imageHtml;
            setContentHtml(updatedHtml);

            if (!coverImage) {
                setCoverImage(data.url);
            }

            // Also set as cover image if none set
            // Note: coverImage state wasn't explicitly managed in NewEntryPage before (it was in props/body but not state)
            // We should add state for it or just ignore for now.
            // Let's just append to body.

            // Reset input
            if (fileInputRef.current) fileInputRef.current.value = '';

        } catch (err: any) {
            setError(err.message || 'Failed to upload image');
        } finally {
            setIsUploading(false);
        }
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
        <div className="min-h-screen bg-gradient-to-b from-neutral-900 to-neutral-950 text-white selection:bg-primary/30">
            <div className="fixed top-0 left-1/4 w-96 h-96 bg-neutral-500/10 rounded-full blur-[150px] pointer-events-none" />
            <div className="fixed bottom-0 right-1/4 w-64 h-64 bg-neutral-500/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-3xl mx-auto px-4 py-8 relative z-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="p-3 -ml-2 rounded-2xl text-neutral-400 hover:text-white hover:bg-white/10 transition-all">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="m15 18-6-6 6-6" />
                            </svg>
                        </Link>

                        {/* Status Indicator */}
                        <div className="text-xs font-medium text-neutral-500 animate-fade-in flex items-center gap-2">
                            {isSaving ? (
                                <>
                                    <div className="w-2 h-2 rounded-full bg-neutral-500 animate-pulse" />
                                    Saving...
                                </>
                            ) : lastSaved ? (
                                <>
                                    <div className="w-2 h-2 rounded-full bg-neutral-400" />
                                    Draft Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </>
                            ) : (
                                <span className="opacity-0">Ready</span>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={() => handleSave(false)}
                        disabled={isSaving || !content.trim()}
                        className="px-6 py-3 rounded-2xl bg-gradient-to-r from-primary to-neutral-700 text-white font-semibold 
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
                                {entryId ? 'Update Entry' : 'Save Entry'}
                            </>
                        )}
                    </button>
                </div>

                {error && (
                    <div className="mb-6 bg-neutral-500/10 border border-neutral-500/20 text-neutral-300 px-6 py-4 rounded-2xl text-sm flex items-center gap-3 backdrop-blur-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
                        {error}
                    </div>
                )}

                {/* Main Capture Area */}
                <div className="relative mb-6 group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-neutral-700/20 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    <div className="relative glass-card rounded-[2rem] p-8 border border-white/10 bg-neutral-900/40 backdrop-blur-xl shadow-2xl">
                        {/* Voice Control - Floating Centered */}
                        <div className="flex flex-col items-center justify-center mb-8">
                            <button
                                onClick={isRecording ? stopRecording : startRecording}
                                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${isRecording
                                    ? 'bg-neutral-500 scale-110 shadow-[0_0_40px_rgba(82,82,91,0.4)]'
                                    : 'bg-gradient-to-br from-primary to-neutral-700 hover:shadow-[0_0_30px_rgba(82,82,91,0.4)] hover:scale-105'
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

                            <div className="mt-4 h-6 flex flex-col items-center">
                                {isRecording ? (
                                    <div className="flex items-center gap-2">
                                        <span className="relative flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neutral-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-neutral-500"></span>
                                        </span>
                                        <span className="text-neutral-300 text-sm font-medium tracking-wide uppercase">Recording</span>
                                    </div>
                                ) : (
                                    <span className="text-neutral-500 text-sm font-medium">Tap to speak</span>
                                )}
                            </div>
                        </div>

                        {/* Toolbar */}
                        <div className="flex justify-between items-center mb-4 px-2">
                            {/* Rewrite Toolbar */}
                            <RewriteToolbar 
                                content={content}
                                onRewrite={(newContent) => {
                                    setContent(newContent);
                                    setContentHtml(`<p>${newContent}</p>`);
                                }}
                                disabled={isSaving}
                            />
                            
                            {/* Image Upload */}
                            <div className="flex items-center">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                    className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2 text-sm"
                                    title="Upload Image"
                                >
                                    {isUploading ? (
                                        <div className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                                    )}
                                    <span>Add Image</span>
                                </button>
                            </div>
                        </div>

                        {coverImage && (
                            <div className="mb-6">
                                <div className="relative w-full h-48 md:h-64 rounded-2xl overflow-hidden group">
                                    <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
                                    <button
                                        onClick={() => setCoverImage(null)}
                                        className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                                        title="Remove cover image"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Interim Text Display */}
                        {interimText && (
                            <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                                <p className="text-neutral-300 italic text-lg animate-pulse">"{interimText}"</p>
                            </div>
                        )}


                        {/* Audio Player */}
                        {audioUrl && (
                            <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/5">
                                <p className="text-xs text-neutral-400 mb-2 uppercase tracking-wider">Voice Recording</p>
                                <audio controls src={audioUrl} className="w-full h-10" />
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
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-neutral-500/20 to-neutral-700/20 rounded-2xl blur opacity-75 group-hover:opacity-100 transition-opacity" />

                            <div className="relative glass-card rounded-2xl overflow-hidden border border-white/10 bg-neutral-900/60 backdrop-blur-xl">
                            <button
                                onClick={() => setShowDetails(!showDetails)}
                                className="w-full p-5 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-neutral-500 to-neutral-700 flex items-center justify-center shadow-lg ${isAnalyzing ? 'animate-pulse' : ''}`}>
                                    <Sparkles className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <div className="text-white font-semibold flex items-center gap-2">
                                            AI Insights
                                            {isAnalyzing && (
                                                    <span className="text-xs font-normal text-neutral-300 animate-pulse bg-neutral-500/10 px-2 py-0.5 rounded-full border border-neutral-500/20">
                                                    Analyzing...
                                                </span>
                                            )}
                                        </div>
                                        {extractedData && (
                                                <div className="text-neutral-400 text-xs mt-1 flex items-center gap-2">
                                                <span>{extractedData.wordCount} words</span>
                                                {displayMood && (
                                                    <>
                                                            <span className="w-1 h-1 rounded-full bg-neutral-600" />
                                                        <span className="text-white bg-white/10 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                                            {(() => {
                                                                const MoodIcon = MOOD_ICONS[displayMood] || MOOD_ICONS.neutral;
                                                                return <MoodIcon className="w-3 h-3 text-white" />;
                                                            })()} {displayMood}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className={`w-8 h-8 rounded-full bg-white/5 flex items-center justify-center transition-transform duration-300 ${showDetails ? 'rotate-180 bg-white/10' : ''}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-400"><path d="m6 9 6 6 6-6" /></svg>
                                </div>
                            </button>

                            {/* Expanded Details */}
                            <div className={`transition-all duration-300 ease-in-out ${showDetails ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                                <div className="p-5 space-y-6 border-t border-white/5 bg-black/20">
                                    {extractedData && (
                                        <>
                                            {/* Insights Grid */}
                                            {extractedData.insights.length > 0 && (
                                                <div className="grid gap-3 p-4 rounded-xl bg-gradient-to-br from-neutral-500/10 to-neutral-700/10 border border-neutral-500/20">
                                                    <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1">Key Insights</label>
                                                    {extractedData.insights.map((insight, i) => (
                                                        <div key={i} className="flex items-start gap-3 text-sm text-neutral-200">
                                                            <span className="mt-1 text-xs px-2 py-0.5 rounded bg-neutral-500/20 text-neutral-300 border border-neutral-500/30 capitalize">
                                                                {insight.type}
                                                            </span>
                                                            <span className="leading-relaxed">{insight.content}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Growth & Patterns (Social Science Model) */}
                                            {extractedData.growthPoints && extractedData.growthPoints.length > 0 && (
                                                <div className="grid gap-3 p-4 rounded-xl bg-gradient-to-br from-neutral-500/10 to-neutral-700/10 border border-neutral-500/20">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">Growth & Patterns</label>
                                                        <span className="text-[10px] text-neutral-400/50 bg-neutral-500/10 px-1.5 rounded border border-neutral-500/10">Social Science Model</span>
                                                    </div>
                                                    {extractedData.growthPoints.map((point, i) => (
                                                        <div key={i} className="flex items-start gap-3 text-sm text-neutral-200">
                                                            <span className={`mt-1 text-xs px-2 py-0.5 rounded border capitalize whitespace-nowrap ${point.category === 'professional' ? 'bg-neutral-600/20 text-neutral-300 border-neutral-600/30' :
                                                                point.category === 'relational' ? 'bg-neutral-500/20 text-neutral-300 border-neutral-500/30' :
                                                                    point.category === 'spiritual' ? 'bg-neutral-700/20 text-neutral-300 border-neutral-700/30' :
                                                                        'bg-neutral-400/20 text-neutral-300 border-neutral-400/30'
                                                                }`}>
                                                                {point.category}
                                                            </span>
                                                            <div className="flex-1">
                                                                <p className="leading-relaxed opacity-90">{point.insight}</p>
                                                                {point.actionable && (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] text-neutral-300 mt-1 font-medium opacity-80">
                                                                        <Rocket className="w-3 h-3" /> Actionable Step
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
                                                        <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Emotional Intelligence</label>
                                                        <span className="text-xs px-2.5 py-1 rounded-lg bg-neutral-500/20 text-neutral-300 border border-neutral-500/30 capitalize font-medium">
                                                            Dominant: {extractedData.emotionalIntelligence.dominantTrait}
                                                        </span>
                                                    </div>
                                                    <div className="space-y-4">
                                                        {/* Self Awareness */}
                                                        <div>
                                                            <div className="flex justify-between text-xs text-neutral-300 mb-2">
                                                                <span>Self Awareness</span>
                                                                <span className="opacity-70">{extractedData.emotionalIntelligence.selfAwareness}/10</span>
                                                            </div>
                                                            <div className="h-2 bg-neutral-700/50 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-gradient-to-r from-neutral-500 to-neutral-300 rounded-full shadow-[0_0_10px_rgba(82,82,91,0.3)]"
                                                                    style={{ width: `${extractedData.emotionalIntelligence.selfAwareness * 10}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                        {/* Regulation */}
                                                        <div>
                                                            <div className="flex justify-between text-xs text-neutral-300 mb-2">
                                                                <span>Self Regulation</span>
                                                                <span className="opacity-70">{extractedData.emotionalIntelligence.regulation}/10</span>
                                                            </div>
                                                            <div className="h-2 bg-neutral-700/50 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-gradient-to-r from-neutral-500 to-neutral-300 rounded-full shadow-[0_0_10px_rgba(82,82,91,0.3)]"
                                                                    style={{ width: `${extractedData.emotionalIntelligence.regulation * 10}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                        {/* Social Awareness */}
                                                        <div>
                                                            <div className="flex justify-between text-xs text-neutral-300 mb-2">
                                                                <span>Social Awareness</span>
                                                                <span className="opacity-70">{extractedData.emotionalIntelligence.socialAwareness}/10</span>
                                                            </div>
                                                            <div className="h-2 bg-neutral-700/50 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-gradient-to-r from-neutral-500 to-neutral-300 rounded-full shadow-[0_0_10px_rgba(82,82,91,0.3)]"
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
                                                        <label className="text-xs font-medium text-neutral-400 mb-2 block uppercase tracking-wider">Suggested Title</label>
                                                        <input
                                                            type="text"
                                                            value={displayTitle}
                                                            onChange={(e) => setTitleOverride(e.target.value)}
                                                            className="w-full bg-white/5 hover:bg-white/10 transition-colors rounded-xl px-4 py-3 text-white placeholder-neutral-500 border border-white/10 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="text-xs font-medium text-neutral-400 mb-2 block uppercase tracking-wider">Mood</label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {MOODS.map((m) => (
                                                                <button
                                                                    key={m.value}
                                                                    onClick={() => setMoodOverride(moodOverride === m.value ? null : m.value)}
                                                                    className={`px-3 py-2 rounded-xl text-sm flex items-center gap-2 transition-all border ${displayMood === m.value
                                                                        ? 'bg-primary border-primary text-white shadow-lg shadow-primary/25'
                                                                        : 'bg-white/5 border-white/5 text-neutral-300 hover:bg-white/10 hover:border-white/10'
                                                                        }`}
                                                                >
                                                                    {(() => {
                                                                        const MoodIcon = m.icon;
                                                                        return <MoodIcon className="w-4 h-4 text-white" />;
                                                                    })()}
                                                                    <span>{m.label}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-4">
                                                    {(extractedData.people.length > 0 || extractedData.places.length > 0) && (
                                                        <div>
                                                            <label className="text-xs font-medium text-neutral-400 mb-2 block uppercase tracking-wider">Deteceted Entities</label>
                                                            <div className="flex flex-wrap gap-2">
                                                                {extractedData.people.map((p, i) => (
                                                                    <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-500/10 text-neutral-300 border border-neutral-500/20 text-sm">
                                                                        <User className="w-3.5 h-3.5" /> {p.name}{' '}
                                                                        <span className="text-neutral-500/50 text-xs">({p.relationship})</span>
                                                                    </span>
                                                                ))}
                                                                {extractedData.places.map((p, i) => (
                                                                    <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-500/10 text-neutral-300 border border-neutral-500/20 text-sm">
                                                                        <MapPin className="w-3.5 h-3.5" /> {p.name}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div>
                                                        <label className="text-xs font-medium text-neutral-400 mb-2 block uppercase tracking-wider">Tags</label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {displayTags.map((tag) => (
                                                                <span key={tag} className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/5 text-sm transition-colors">
                                                                    #{tag}
                                                                    <button onClick={() => removeTag(tag)} className="text-neutral-500 hover:text-neutral-200 ml-1">×</button>
                                                                </span>
                                                            ))}
                                                            <input
                                                                type="text"
                                                                placeholder="+ Tag"
                                                                className="px-3 py-1.5 rounded-lg bg-transparent text-sm text-white placeholder-neutral-600 border border-white/10 focus:border-primary/50 focus:outline-none w-24 hover:bg-white/5 focus:bg-white/5 transition-colors"
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
                        <p className="text-neutral-500 text-sm font-medium">
                            <span className="text-primary">Tip:</span> Just speak naturally. AI will capture, format, and organize everything for you.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
