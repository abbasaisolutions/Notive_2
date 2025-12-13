'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/auth-context';
import { useGamification } from '@/context/gamification-context';
import { Button } from '@/components/ui/form-elements';
import { useAutoSave } from '@/hooks/use-auto-save';
import TemplatesModal from '@/components/templates/TemplatesModal';
import { voiceCommandService } from '@/services/voice-command.service';
import { aiContentAnalyzer } from '@/services/ai-content-analyzer.service';

const TiptapEditor = dynamic(() => import('@/components/editor/TiptapEditor'), {
    ssr: false,
    loading: () => <div className="glass-card rounded-2xl h-[400px] animate-pulse" />,
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
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface Chapter {
    id: string;
    name: string;
    icon: string;
    color: string;
}

export default function NewEntryPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, accessToken, isLoading: authLoading } = useAuth();
    const { awardXP, refreshStats } = useGamification();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [contentHtml, setContentHtml] = useState('');
    const [mood, setMood] = useState<string | null>(null);
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [coverImage, setCoverImage] = useState<string | null>(null);
    const [chapterId, setChapterId] = useState<string | null>(null);
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [error, setError] = useState('');
    const [voiceProcessed, setVoiceProcessed] = useState(false);
    const [isAnalyzingContent, setIsAnalyzingContent] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState<any>(null);

    // Process voice input from URL params
    useEffect(() => {
        if (voiceProcessed) return;

        const voiceText = searchParams.get('voice');
        const promptText = searchParams.get('prompt');

        if (voiceText) {
            // Process voice transcript
            const processed = voiceCommandService.processTranscript(voiceText);
            setContent(processed.cleanedText);

            // Extract and set mood
            const extractedMood = voiceCommandService.extractMood(voiceText);
            if (extractedMood) {
                setMood(extractedMood);
            }

            // Extract and set tags
            const extractedTags = voiceCommandService.extractTags(voiceText);
            if (extractedTags.length > 0) {
                setTags(extractedTags);
            }

            setVoiceProcessed(true);
        } else if (promptText) {
            // Set content from prompt
            setContent(promptText);
            setVoiceProcessed(true);
        }
    }, [searchParams, voiceProcessed]);

    useEffect(() => {
        const fetchChapters = async () => {
            if (!accessToken) return;
            try {
                const response = await fetch(`${API_URL}/chapters`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (response.ok) {
                    const data = await response.json();
                    setChapters(data.chapters);
                }
            } catch (err) {
                console.error('Failed to fetch chapters:', err);
            }
        };
        fetchChapters();
    }, [accessToken]);

    const handleEditorChange = async (text: string, html: string) => {
        setContent(text);
        setContentHtml(html);

        // Analyze content for AI suggestions (debounced)
        if (text.trim().length > 20) {
            setIsAnalyzingContent(true);

            // Debounce the analysis
            setTimeout(async () => {
                try {
                    const analysis = await aiContentAnalyzer.analyzeContent(text);
                    setAiSuggestions(analysis);

                    // Auto-fill if fields are empty
                    if (!title && analysis.suggestedTitle !== 'Untitled Entry') {
                        setTitle(analysis.suggestedTitle);
                    }

                    if (!mood && analysis.detectedMood) {
                        setMood(analysis.detectedMood);
                    }

                    if (tags.length === 0 && analysis.extractedTags.length > 0) {
                        setTags(analysis.extractedTags);
                    }
                } catch (error) {
                    console.error('Content analysis failed:', error);
                } finally {
                    setIsAnalyzingContent(false);
                }
            }, 1000); // 1 second debounce
        }
    };

    const handleAddTag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            if (!tags.includes(tagInput.trim())) {
                setTags([...tags, tagInput.trim()]);
            }
            setTagInput('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(tags.filter((t) => t !== tagToRemove));
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('image', file);

        try {
            const response = await fetch(`${API_URL}/entries/upload`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${accessToken}` },
                body: formData,
            });

            if (!response.ok) throw new Error('Upload failed');

            const data = await response.json();
            setCoverImage(data.url);
        } catch (err) {
            console.error('Upload error:', err);
            setError('Failed to upload image');
        } finally {
            setIsUploading(false);
        }
    };

    const handleAnalyzeMood = async () => {
        if (!content.trim()) {
            setError('Write something first so I can analyze your mood.');
            return;
        }

        setIsAnalyzing(true);
        setError('');
        try {
            const response = await fetch(`${API_URL}/ai/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ text: content }),
            });

            if (!response.ok) throw new Error('Analysis failed');

            const data = await response.json();
            setMood(data.mood);
        } catch (err) {
            console.error('Analysis error:', err);
            setError('Failed to analyze mood');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSave = async () => {
        if (!content.trim()) {
            setError('Please write something before saving.');
            return;
        }

        setIsSaving(true);
        setError('');

        try {
            const response = await fetch(`${API_URL}/entries`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                credentials: 'include',
                body: JSON.stringify({
                    title: title || null,
                    content,
                    contentHtml,
                    mood,
                    tags,
                    coverImage,
                    chapterId,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to save entry');
            }

            setLastSaved(new Date());
            awardXP(50, 'Entry created');
            refreshStats();
            router.push('/dashboard');
        } catch (err: any) {
            setError(err.message || 'Failed to save entry');
        } finally {
            setIsSaving(false);
        }
    };

    const autoSaveEntry = async (data: any) => {
        if (!data.content.trim()) return;
        // Auto-save functionality (currently disabled)
    };

    const { isSaving: isAutoSaving } = useAutoSave({
        data: { title, content, contentHtml, mood, tags, coverImage, chapterId },
        onSave: autoSaveEntry,
        enabled: false,
    });

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

    return (
        <div className="min-h-screen p-4 md:p-8">
            <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[150px] pointer-events-none" />

            <div className="max-w-4xl mx-auto relative z-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
                            </svg>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-white">New Entry</h1>
                            <div className="flex items-center gap-2">
                                {lastSaved && <p className="text-xs text-slate-500">Last saved: {lastSaved.toLocaleTimeString()}</p>}
                                {isAutoSaving && <p className="text-xs text-primary animate-pulse">Saving...</p>}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowTemplates(true)}
                            className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 transition-all flex items-center gap-2"
                        >
                            <span>📝</span>
                            Templates
                        </button>
                        <Button onClick={handleSave} isLoading={isSaving}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
                            </svg>
                            Save Entry
                        </Button>
                    </div>
                </div>
                {error && (
                    <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">{error}</div>
                )}

                {/* Cover Image */}
                <div className="mb-6">
                    {coverImage ? (
                        <div className="relative w-full h-48 md:h-64 rounded-2xl overflow-hidden group">
                            <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
                            <button onClick={() => setCoverImage(null)} className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            </button>
                        </div>
                    ) : (
                        <label className="w-full h-32 rounded-2xl border-2 border-dashed border-white/10 hover:border-primary/50 hover:bg-white/5 flex flex-col items-center justify-center cursor-pointer transition-all group">
                            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={isUploading} />
                            {isUploading ? (
                                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 group-hover:text-primary mb-2 transition-colors">
                                        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                                    </svg>
                                    <span className="text-sm text-slate-400 group-hover:text-white transition-colors">Add Cover Image</span>
                                </>
                            )}
                        </label>
                    )}
                </div>

                {/* Title */}
                <input
                    type="text"
                    placeholder="Entry title (optional)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-transparent border-none text-3xl font-bold text-white placeholder-slate-600 focus:outline-none mb-6"
                />

                {/* Chapter Selector */}
                {chapters.length > 0 && (
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-400 mb-2">Add to Chapter (optional)</label>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setChapterId(null)}
                                className={`px-3 py-2 rounded-xl text-sm transition-all ${!chapterId ? 'bg-primary text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
                            >
                                None
                            </button>
                            {chapters.map((ch) => (
                                <button
                                    key={ch.id}
                                    type="button"
                                    onClick={() => setChapterId(ch.id)}
                                    className={`px-3 py-2 rounded-xl text-sm flex items-center gap-2 transition-all ${chapterId === ch.id ? 'bg-primary text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
                                >
                                    <span>{ch.icon}</span>
                                    <span>{ch.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Mood Selector */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-slate-400">How are you feeling?</label>
                        <button
                            type="button"
                            onClick={handleAnalyzeMood}
                            disabled={isAnalyzing || !content.trim()}
                            className="text-xs px-3 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                        >
                            {isAnalyzing ? (
                                <><div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />Analyzing...</>
                            ) : (
                                <><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></svg>AI Suggest</>
                            )}
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {MOODS.map((m) => (
                            <button
                                key={m.value}
                                type="button"
                                onClick={() => setMood(mood === m.value ? null : m.value)}
                                className={`px-3 py-2 rounded-xl text-sm flex items-center gap-2 transition-all ${mood === m.value ? 'bg-primary text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
                            >
                                <span>{m.emoji}</span>
                                <span>{m.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Editor */}
                <TiptapEditor onChange={handleEditorChange} placeholder="What's on your mind today?" />

                {/* Tags */}
                <div className="mt-6">
                    <label className="block text-sm font-medium text-slate-400 mb-2">Tags</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                        {tags.map((tag) => (
                            <span key={tag} className="px-3 py-1 rounded-full bg-white/10 text-sm text-slate-200 flex items-center gap-2">
                                #{tag}
                                <button type="button" onClick={() => handleRemoveTag(tag)} className="text-slate-400 hover:text-white">×</button>
                            </span>
                        ))}
                    </div>
                    <input
                        type="text"
                        placeholder="Add a tag and press Enter..."
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleAddTag}
                        className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                </div>
            </div>

            {/* Templates Modal */}
            <TemplatesModal
                isOpen={showTemplates}
                onClose={() => setShowTemplates(false)}
                onSelect={(template) => setContent(template)}
            />
        </div>
    );
}
