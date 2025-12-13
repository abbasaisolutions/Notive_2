'use client';

import React, { useState, useEffect } from 'react';
import { StructuredEntryData, structuredDataService } from '@/services/structured-data.service';

interface StructuredDataPreviewProps {
    content: string;
    onDataExtracted?: (data: StructuredEntryData) => void;
}

const moodEmojis: Record<string, string> = {
    happy: '😊', sad: '😔', anxious: '😰', calm: '😌',
    angry: '😤', motivated: '💪', grateful: '🙏', tired: '😴',
    hopeful: '🌟', thoughtful: '🤔', lonely: '😢', neutral: '😐',
};

export default function StructuredDataPreview({ content, onDataExtracted }: StructuredDataPreviewProps) {
    const [data, setData] = useState<StructuredEntryData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        if (content.length < 20) {
            setData(null);
            return;
        }

        const analyzeContent = async () => {
            setIsLoading(true);
            try {
                const extracted = await structuredDataService.extractStructuredData(content);
                setData(extracted);
                onDataExtracted?.(extracted);
            } catch (error) {
                console.error('Failed to extract structured data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        // Debounce analysis
        const timer = setTimeout(analyzeContent, 1500);
        return () => clearTimeout(timer);
    }, [content, onDataExtracted]);

    if (!data && !isLoading) return null;

    return (
        <div className="mb-6 glass-card rounded-2xl overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span className="text-xl">🤖</span>
                    <span className="font-medium text-white">AI Analysis</span>
                    {isLoading && (
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    )}
                </div>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                >
                    <path d="m6 9 6 6 6-6" />
                </svg>
            </button>

            {/* Quick Stats */}
            {data && (
                <div className="px-4 pb-4 flex flex-wrap gap-3">
                    {/* Sentiment */}
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${data.overallSentiment === 'positive' ? 'bg-green-500/20 text-green-400' :
                            data.overallSentiment === 'negative' ? 'bg-red-500/20 text-red-400' :
                                data.overallSentiment === 'mixed' ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-slate-500/20 text-slate-400'
                        }`}>
                        {data.overallSentiment === 'positive' ? '✨ Positive' :
                            data.overallSentiment === 'negative' ? '💭 Reflective' :
                                data.overallSentiment === 'mixed' ? '🌊 Mixed' : '😐 Neutral'}
                    </div>

                    {/* Primary Mood */}
                    {data.primaryEmotion && (
                        <div className="px-3 py-1 rounded-full text-sm font-medium bg-primary/20 text-primary">
                            {moodEmojis[data.primaryEmotion.emotion] || '😐'} {data.primaryEmotion.emotion}
                            <span className="ml-1 opacity-60">({data.primaryEmotion.intensity}/10)</span>
                        </div>
                    )}

                    {/* Word Count */}
                    <div className="px-3 py-1 rounded-full text-sm bg-slate-500/20 text-slate-300">
                        📖 {data.wordCount} words • {data.readingTime} min read
                    </div>
                </div>
            )}

            {/* Expanded Details */}
            {isExpanded && data && (
                <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4">
                    {/* Suggested Title */}
                    {data.title !== 'Untitled Entry' && (
                        <div>
                            <h4 className="text-xs font-medium text-slate-400 mb-1">Suggested Title</h4>
                            <p className="text-white font-medium">{data.title}</p>
                        </div>
                    )}

                    {/* People Mentioned */}
                    {data.people.length > 0 && (
                        <div>
                            <h4 className="text-xs font-medium text-slate-400 mb-2">People Mentioned</h4>
                            <div className="flex flex-wrap gap-2">
                                {data.people.map((person, i) => (
                                    <span
                                        key={i}
                                        className={`px-3 py-1 rounded-full text-sm ${person.sentiment > 0.3 ? 'bg-green-500/20 text-green-400' :
                                                person.sentiment < -0.3 ? 'bg-red-500/20 text-red-400' :
                                                    'bg-slate-500/20 text-slate-300'
                                            }`}
                                    >
                                        👤 {person.name}
                                        {person.relationship && <span className="opacity-60"> ({person.relationship})</span>}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Activities */}
                    {data.activities.length > 0 && (
                        <div>
                            <h4 className="text-xs font-medium text-slate-400 mb-2">Activities</h4>
                            <div className="flex flex-wrap gap-2">
                                {data.activities.map((activity, i) => (
                                    <span
                                        key={i}
                                        className="px-3 py-1 rounded-full text-sm bg-primary/20 text-primary"
                                    >
                                        🏃 {activity.name}
                                        {activity.duration && <span className="opacity-60"> ({activity.duration})</span>}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Places */}
                    {data.places.length > 0 && (
                        <div>
                            <h4 className="text-xs font-medium text-slate-400 mb-2">Places</h4>
                            <div className="flex flex-wrap gap-2">
                                {data.places.map((place, i) => (
                                    <span
                                        key={i}
                                        className="px-3 py-1 rounded-full text-sm bg-secondary/20 text-secondary"
                                    >
                                        📍 {place.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Goals */}
                    {data.goals.length > 0 && (
                        <div>
                            <h4 className="text-xs font-medium text-slate-400 mb-2">Goals & Progress</h4>
                            <div className="space-y-2">
                                {data.goals.map((goal, i) => (
                                    <div
                                        key={i}
                                        className={`p-3 rounded-xl text-sm ${goal.status === 'achieved' ? 'bg-green-500/20' :
                                                goal.status === 'struggling' ? 'bg-red-500/20' :
                                                    goal.status === 'in-progress' ? 'bg-yellow-500/20' :
                                                        'bg-primary/20'
                                            }`}
                                    >
                                        <span className={`font-medium ${goal.status === 'achieved' ? 'text-green-400' :
                                                goal.status === 'struggling' ? 'text-red-400' :
                                                    goal.status === 'in-progress' ? 'text-yellow-400' :
                                                        'text-primary'
                                            }`}>
                                            {goal.status === 'achieved' ? '✅' :
                                                goal.status === 'struggling' ? '💪' :
                                                    goal.status === 'in-progress' ? '🔄' : '🎯'} {goal.goal}
                                        </span>
                                        <span className="ml-2 text-slate-400 text-xs capitalize">({goal.category})</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Insights */}
                    {data.insights.length > 0 && (
                        <div>
                            <h4 className="text-xs font-medium text-slate-400 mb-2">Key Insights</h4>
                            <div className="space-y-2">
                                {data.insights.map((insight, i) => (
                                    <div
                                        key={i}
                                        className="p-3 rounded-xl bg-white/5 text-sm"
                                    >
                                        <span className="text-slate-400 capitalize">{insight.type}:</span>
                                        <span className="text-white ml-2">{insight.content}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Suggested Tags */}
                    {data.suggestedTags.length > 0 && (
                        <div>
                            <h4 className="text-xs font-medium text-slate-400 mb-2">Suggested Tags</h4>
                            <div className="flex flex-wrap gap-2">
                                {data.suggestedTags.map((tag, i) => (
                                    <span
                                        key={i}
                                        className="px-3 py-1 rounded-full text-sm bg-white/10 text-slate-300"
                                    >
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
