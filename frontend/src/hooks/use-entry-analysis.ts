'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_URL } from '@/constants/config';
import { structuredDataService, StructuredEntryData } from '@/services/structured-data.service';
import { EntryDraft } from '@/hooks/use-entry-draft';
import { EntryCategory } from '@/constants/life-areas';

type UseEntryAnalysisArgs = {
    content: string;
    contentHtml: string;
    entryId: string | null;
    apiFetch: (path: string, options?: RequestInit & { retryOnUnauthorized?: boolean }) => Promise<Response>;
    saveDraft: (draft: EntryDraft) => void;
    titleOverride: string;
    moodOverride: string | null;
    tagsOverride: string[];
    audioUrl: string | null;
    category?: EntryCategory;
    lifeArea?: string;
    chapterId?: string | null;
    pendingSync: boolean;
    isSaved?: boolean;
};

export default function useEntryAnalysis({
    content,
    contentHtml,
    entryId,
    apiFetch,
    saveDraft,
    titleOverride,
    moodOverride,
    tagsOverride,
    audioUrl,
    category,
    lifeArea,
    chapterId,
    pendingSync,
    isSaved = false,
}: UseEntryAnalysisArgs) {
    const [extractedData, setExtractedData] = useState<StructuredEntryData | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiInsights, setAiInsights] = useState<Record<string, unknown> | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiError, setAiError] = useState('');
    const analysisTimeoutRef = useRef<NodeJS.Timeout>();

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

    useEffect(() => {
        if (!isSaved) {
            return;
        }

        if (analysisTimeoutRef.current) {
            clearTimeout(analysisTimeoutRef.current);
        }

        analysisTimeoutRef.current = setTimeout(() => {
            analyzeContent(content);
        }, 1000);

        return () => {
            if (analysisTimeoutRef.current) {
                clearTimeout(analysisTimeoutRef.current);
            }
        };
    }, [content, analyzeContent, isSaved]);

    const buildAnalysisPayload = useCallback(() => {
        // Only persist server-grade AI insights; deterministic extraction is local UI guidance.
        if (!aiInsights) return undefined;
        return { ai: aiInsights };
    }, [aiInsights]);

    const handleDeepInsight = useCallback(async () => {
        if (!content.trim()) {
            setAiError('Write something first to generate insights.');
            return;
        }

        setIsAiLoading(true);
        setAiError('');

        try {
            const url = entryId ? `/ai/analyze/${entryId}` : `/ai/analyze`;
            const response = await apiFetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Couldn\u2019t generate insights right now.');
            }

            setAiInsights(data.insights);
            saveDraft({
                content,
                contentHtml,
                title: titleOverride,
                mood: moodOverride,
                tags: tagsOverride,
                audioUrl,
                category,
                lifeArea,
                chapterId,
                analysis: {
                    ...(extractedData ? { deterministic: extractedData } : {}),
                    ai: data.insights,
                },
                updatedAt: Date.now(),
                pendingSync,
            });
        } catch (err: any) {
            setAiError(err.message || 'Couldn\u2019t generate insights right now.');
        } finally {
            setIsAiLoading(false);
        }
    }, [content, entryId, apiFetch, saveDraft, extractedData, titleOverride, moodOverride, tagsOverride, audioUrl, category, lifeArea, chapterId, contentHtml, pendingSync]);

    const aiEmotionEntries = useMemo(
        () => (aiInsights?.emotions && typeof aiInsights.emotions === 'object'
            ? Object.entries(aiInsights.emotions as Record<string, number>)
                .map(([emotion, score]) => [emotion, Number(score) || 0] as const)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
            : []),
        [aiInsights]
    );

    const aiEmotionMax = aiEmotionEntries.length > 0
        ? Math.max(...aiEmotionEntries.map(([, score]) => score), 1)
        : 1;

    return {
        extractedData,
        setExtractedData,
        isAnalyzing,
        aiInsights,
        setAiInsights,
        isAiLoading,
        aiError,
        buildAnalysisPayload,
        handleDeepInsight,
        aiEmotionEntries,
        aiEmotionMax,
    };
}
