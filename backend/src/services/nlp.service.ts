// NLP Analysis Service - Deterministic + Optional LLM + Optional Python microservice
// File: backend/src/services/nlp.service.ts

import { aiRuntime, createLlmChatCompletion, hasLlmProvider, type AnalysisProvider } from '../config/ai';
import analysisMemoryService, { type AnalysisMemoryContext } from './analysis-memory.service';
import entryPersonalizationService, { type EntryPersonalizationSuggestions } from './entry-personalization.service';
import { MIN_WORDS_FOR_ENTRY_INSIGHTS } from '../constants/entry-requirements';

export interface SentimentResult {
    score: number; // -1 (negative) to 1 (positive)
    label: 'positive' | 'negative' | 'neutral';
    confidence: number;
    summary?: string; // Short emotional summary
}

export interface EntityResult {
    text: string;
    type: 'person' | 'place' | 'activity' | 'thing' | 'emotion';
    confidence: number;
}

export interface AnalysisResult {
    sentiment: SentimentResult;
    entities: EntityResult[];
    topics: string[];
    suggestedMood: string | null;
    wordCount: number;
    readingTime: number; // minutes
    keywords?: string[];
    emotions?: Record<string, number>;
    highlights?: string[];
    evidence?: {
        situation?: { text?: string; confidence?: number; source?: string } | null;
        action?: { text?: string; confidence?: number; source?: string } | null;
        lesson?: { text?: string; confidence?: number; source?: string } | null;
        outcome?: { text?: string; confidence?: number; source?: string } | null;
    };
    modelInfo?: Record<string, string>;
    analysisLine?: string;
    takeawayLine?: string;
    provider?: AnalysisProvider;
    memory?: AnalysisMemoryContext;
    suggestions?: EntryPersonalizationSuggestions;
}

export interface AnalyzeContentOptions {
    title?: string;
    userId?: string;
    excludeEntryId?: string | null;
    preferAdvanced?: boolean;
}

export interface OpportunityEvidenceSynthesis {
    situation: string;
    action: string;
    lesson: string;
    outcome: string;
    skills: string[];
    confidence: number;
    provider: 'llm' | 'deterministic';
}

export interface ChatAvailability {
    available: boolean;
    provider: 'llm' | 'huggingface' | 'disabled';
    vendor: string;
    model?: string;
    message?: string;
}

const allowLLM = process.env.USE_LLM_NLP === 'true' && hasLlmProvider();

const parseFloatInRange = (value: string | undefined, fallback: number, min: number, max: number) => {
    const parsed = Number.parseFloat(String(value || ''));
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
};

const parsePositiveInt = (value: string | undefined, fallback: number) => {
    const parsed = Number.parseInt(String(value || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const llmConfidenceThreshold = parseFloatInRange(process.env.LLM_NLP_CONFIDENCE_THRESHOLD, 0.28, 0, 1);
const llmMinWords = parsePositiveInt(process.env.LLM_NLP_MIN_WORDS, 80);
const advancedAnalysisMinWords = Math.max(llmMinWords, MIN_WORDS_FOR_ENTRY_INSIGHTS);

const POSITIVE_WORDS = new Set([
    'happy', 'joy', 'joyful', 'excited', 'thrilled', 'grateful', 'thankful', 'blessed', 'love',
    'great', 'good', 'amazing', 'awesome', 'calm', 'peaceful', 'relaxed', 'hopeful', 'proud',
]);

const NEGATIVE_WORDS = new Set([
    'sad', 'angry', 'upset', 'frustrated', 'anxious', 'worried', 'stressed', 'tired', 'exhausted',
    'lonely', 'depressed', 'hurt', 'fear', 'nervous', 'overwhelmed', 'bad', 'awful',
]);

const NEGATORS = new Set(['not', 'never', 'no', "don't", "didn't", "won't", "can't", 'cannot', 'hardly', 'barely']);
const INTENSIFIERS = new Set(['very', 'really', 'extremely', 'super', 'so', 'deeply', 'highly']);
const DOWNTONERS = new Set(['slightly', 'somewhat', 'little', 'mildly', 'kinda']);

const EMOTION_LEXICON: Record<string, string[]> = {
    happy: ['happy', 'joy', 'joyful', 'excited', 'thrilled', 'delighted', 'cheerful', 'elated'],
    sad: ['sad', 'unhappy', 'down', 'depressed', 'heartbroken', 'grief', 'gloomy'],
    anxious: ['anxious', 'worried', 'nervous', 'stressed', 'overwhelmed', 'panicked', 'fearful'],
    calm: ['calm', 'peaceful', 'relaxed', 'serene', 'tranquil', 'grounded', 'mindful'],
    frustrated: ['angry', 'furious', 'irritated', 'frustrated', 'annoyed', 'rage', 'resentful'],
    grateful: ['grateful', 'thankful', 'blessed', 'appreciative', 'fortunate'],
    motivated: ['motivated', 'inspired', 'driven', 'determined', 'ambitious', 'focused'],
    tired: ['tired', 'exhausted', 'drained', 'fatigued', 'burned out'],
    thoughtful: ['reflective', 'thoughtful', 'pondering', 'contemplating', 'considering'],
};

const STOPWORDS = new Set([
    'a', 'an', 'and', 'the', 'to', 'of', 'in', 'on', 'for', 'with', 'at', 'from', 'by', 'as', 'is', 'it',
    'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'my', 'your', 'our', 'their',
    'me', 'him', 'her', 'us', 'them', 'be', 'been', 'being', 'was', 'were', 'am', 'are', 'or', 'but', 'so',
    'if', 'then', 'than', 'too', 'very', 'just', 'about', 'into', 'over', 'under', 'again', 'still', 'really',
]);

const EVIDENCE_ACTION_PATTERNS: RegExp[] = [
    /\b(i|we)\s+(led|organized|built|created|managed|supported|volunteered|resolved|improved|launched|coordinated|presented|mentored|planned|worked|made|wrote|studied|practiced|implemented|designed|shipped|delivered|completed|finished|fixed|solved|applied|submitted|prepared|tested|reviewed|went|go|came|talked|spoke|met|visited|called|attended|helped|trained|exercised|prayed|reflected|journaled|tried|gave|give|wanted|discussed|looked|calculated|understood|understand|tuned)\b[^.!?]*/i,
    /\b(decided to|started|committed to|took initiative to|focused on|followed through|set out to|ready to)\b[^.!?]*/i,
    /\b(working on|building|learning|studying|practicing)\b[^.!?]*/i,
];

const EVIDENCE_LESSON_PATTERNS: RegExp[] = [
    /\b(learned that|realized that|discovered that|lesson learned|takeaway)\b[^.!?]*/i,
    /\b(i learned|i realized|i discovered|looking back|in hindsight|next time)\b[^.!?]*/i,
    /\b(could do better|should|need to|would do better)\b[^.!?]*/i,
];

const EVIDENCE_OUTCOME_PATTERNS: RegExp[] = [
    /\b(resulted in|led to|which helped|improved|increased|reduced|completed|achieved|received|earned)\b[^.!?]*/i,
    /\b(as a result|impact|outcome|result)\b[^.!?]*/i,
    /\b\d+%[^.!?]*/i,
    /\b(i felt|we felt|felt|feel)\b[^.!?]*/i,
];
const LESSON_FALLBACK_PATTERN = /\b(should|need to|could do better|would do better|next time|wish|regret|but|however|although)\b[^.!?]*/i;
const OUTCOME_FALLBACK_PATTERN = /\b(felt|feel|progress|better|worse|calmer|happier|tired|anxious|completed|finished|done)\b[^.!?]*/i;
const ACTION_SIGNAL_PATTERN = /\b(led|organized|built|created|managed|supported|resolved|improved|launched|coordinated|presented|mentored|planned|worked|made|wrote|studied|practiced|implemented|designed|shipped|delivered|completed|finished|fixed|solved|applied|submitted|prepared|tested|reviewed|went|go|came|talked|spoke|met|visited|called|attended|helped|trained|exercised|prayed|reflected|journaled|tried|started|focused|gave|give|wanted|discussed|looked|calculated|understood|understand|tuned)\b/i;
const GENERIC_FOCUS_STOPWORDS = new Set([
    'have', 'has', 'had', 'went', 'came', 'felt', 'feel', 'made', 'this', 'that', 'today', 'yesterday',
    'really', 'very', 'just', 'some', 'thing', 'things', 'week', 'day', 'because', 'said', 'like',
    'wanted', 'understand', 'right', 'ready', 'seems', 'still', 'reflect', 'reflected', 'quick', 'start',
    'better', 'doing', 'going', 'come', 'back',
]);

const tokenize = (text: string) => (text.toLowerCase().match(/\b[a-z']+\b/g) || []);

const EMOTION_TOKEN_MAP = new Map<string, string>();
Object.entries(EMOTION_LEXICON).forEach(([emotion, keywords]) => {
    keywords.forEach(keyword => EMOTION_TOKEN_MAP.set(keyword, emotion));
});

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const mergeUniqueStrings = (primary: string[] = [], secondary: string[] = [], limit = primary.length || secondary.length) => {
    const seen = new Set<string>();
    const result: string[] = [];

    [...primary, ...secondary].forEach((value) => {
        const normalized = String(value || '').replace(/\s+/g, ' ').trim();
        if (!normalized) return;
        const key = normalized.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        result.push(normalized);
    });

    return result.slice(0, limit);
};

const normalizeEmotionScores = (scores: Record<string, number>): Record<string, number> | undefined => {
    const entries = Object.entries(scores);
    if (entries.length === 0) return undefined;
    const maxScore = Math.max(...entries.map(([, score]) => score), 1);

    const normalized: Record<string, number> = {};
    entries.forEach(([emotion, score]) => {
        normalized[emotion] = Number((score / maxScore).toFixed(3));
    });
    return normalized;
};

const mergeAnalysis = (baseline: AnalysisResult, llm: AnalysisResult): AnalysisResult => ({
    sentiment: {
        score: llm.sentiment?.score ?? baseline.sentiment.score,
        label: llm.sentiment?.label ?? baseline.sentiment.label,
        confidence: Math.max(llm.sentiment?.confidence ?? 0, baseline.sentiment.confidence),
        summary: llm.sentiment?.summary || baseline.sentiment.summary,
    },
    entities: (llm.entities && llm.entities.length > 0) ? llm.entities : baseline.entities,
    topics: (llm.topics && llm.topics.length > 0) ? llm.topics : baseline.topics,
    suggestedMood: llm.suggestedMood || baseline.suggestedMood,
    wordCount: baseline.wordCount,
    readingTime: baseline.readingTime,
    keywords: (llm.keywords && llm.keywords.length > 0) ? llm.keywords : baseline.keywords,
    emotions: (llm.emotions && Object.keys(llm.emotions).length > 0) ? llm.emotions : baseline.emotions,
    highlights: (llm.highlights && llm.highlights.length > 0) ? llm.highlights : baseline.highlights,
    evidence: llm.evidence || baseline.evidence,
    modelInfo: llm.modelInfo || baseline.modelInfo,
    provider: llm.provider || baseline.provider,
});

export class NLPService {
    private canUseLlmEvidence = hasLlmProvider();
    private loggedEvidenceProviderDisable = false;

    private enrichWithMemorySignals(
        analysis: AnalysisResult,
        memory: AnalysisMemoryContext | null
    ): AnalysisResult {
        if (!memory) return analysis;

        const memoryHighlights: string[] = [];
        if (memory.summary) {
            memoryHighlights.push(memory.summary);
        }
        if (memory.familiarity === 'repeat') {
            memoryHighlights.push('This note is very close to a recurring pattern in your journal.');
        } else if (memory.familiarity === 'related') {
            memoryHighlights.push('This note lines up with an ongoing pattern in your journal.');
        }

        return {
            ...analysis,
            topics: mergeUniqueStrings(analysis.topics || [], memory.recurringThemes, 6),
            keywords: mergeUniqueStrings(
                analysis.keywords || [],
                [...memory.recurringSkills, ...memory.recurringLessons],
                10
            ),
            highlights: mergeUniqueStrings(analysis.highlights || [], memoryHighlights, 5),
            memory,
        };
    }

    private enrichWithPersonalizationSignals(
        analysis: AnalysisResult,
        suggestions: EntryPersonalizationSuggestions | null
    ): AnalysisResult {
        if (!suggestions) return analysis;

        const personalizationHighlights: string[] = [];
        if (suggestions.summary) {
            personalizationHighlights.push(suggestions.summary);
        }
        if (suggestions.chapter?.confidence && suggestions.chapter.confidence >= 0.8) {
            personalizationHighlights.push(`A similar note history points toward the chapter "${suggestions.chapter.name}".`);
        }

        return {
            ...analysis,
            keywords: mergeUniqueStrings(
                analysis.keywords || [],
                suggestions.tags.map((tag) => tag.value),
                10
            ),
            highlights: mergeUniqueStrings(analysis.highlights || [], personalizationHighlights, 5),
            suggestions,
        };
    }

    private applyAnalysisEnrichment(
        analysis: AnalysisResult,
        memory: AnalysisMemoryContext | null,
        suggestions: EntryPersonalizationSuggestions | null
    ): AnalysisResult {
        return this.enrichWithPersonalizationSignals(
            this.enrichWithMemorySignals(analysis, memory),
            suggestions
        );
    }

    getChatAvailability(): ChatAvailability {
        if (hasLlmProvider()) {
            return {
                available: true,
                provider: 'llm',
                vendor: aiRuntime.llmVendor,
                model: aiRuntime.chatModel,
            };
        }

        const hfToken = (process.env.HF_API_KEY || process.env.HUGGINGFACE_API_KEY || '').trim();
        if (hfToken) {
            return {
                available: true,
                provider: 'huggingface',
                vendor: 'huggingface',
                model: 'mistralai/Mistral-7B-Instruct-v0.2',
            };
        }

        return {
            available: false,
            provider: 'disabled',
            vendor: 'disabled',
            message: 'AI Coach is not enabled yet for this environment.',
        };
    }

    private extractRecentEntryDates(context: string): string[] {
        const matches = context.match(/\[(\d{4}-\d{2}-\d{2})\]/g) || [];
        return [...new Set(matches.map((value) => value.slice(1, -1)))].slice(0, 3);
    }

    private buildManagedChatFallback(context: string): string {
        const normalizedContext = context.trim();
        if (!normalizedContext) {
            return 'AI Coach is temporarily running in limited mode, and there is not enough recent journal context to answer well yet.';
        }

        const analysis = this.analyzeDeterministic(normalizedContext);
        const dates = this.extractRecentEntryDates(normalizedContext);
        const topics = (analysis.topics || []).filter(Boolean).slice(0, 3);
        const parts = ['AI Coach is temporarily running in limited mode while the live model reconnects.'];

        if (dates.length > 0) {
            parts.push(`I can still see recent entries from ${dates.join(', ')}.`);
        }
        if (topics.length > 0) {
            parts.push(`Your recent themes include ${topics.join(', ')}.`);
        }
        if (analysis.suggestedMood) {
            parts.push(`The overall tone looks ${analysis.suggestedMood}.`);
        }

        parts.push('Use Timeline or Insights for a fuller review, then try this question again shortly.');
        return parts.join(' ');
    }

    private async analyzeWithPython(
        content: string,
        options: { title?: string; preferAdvanced?: boolean } = {}
    ): Promise<AnalysisResult | null> {
        const serviceUrl = process.env.NLP_SERVICE_URL;
        if (!serviceUrl) return null;

        try {
            const response = await fetch(`${serviceUrl.replace(/\/$/, '')}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content,
                    title: options.title,
                    preferAdvanced: Boolean(options.preferAdvanced),
                }),
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`NLP service error: ${response.status} ${err}`);
            }

            const data = await response.json();

            return {
                sentiment: data.sentiment,
                entities: data.entities || [],
                topics: data.topics || [],
                suggestedMood: data.suggestedMood || null,
                wordCount: data.wordCount || content.split(/\s+/).length,
                readingTime: data.readingTime || Math.ceil(content.split(/\s+/).length / 200),
                keywords: data.keywords || [],
                emotions: data.emotions || undefined,
                highlights: data.highlights || [],
                evidence: data.evidence || undefined,
                modelInfo: data.modelInfo || undefined,
                provider: 'python',
            };
        } catch (error) {
            console.error('Python NLP service failed:', error);
            return null;
        }
    }

    private analyzeDeterministic(content: string): AnalysisResult {
        const tokens = tokenize(content);
        const wordCount = tokens.length;
        const readingTime = Math.max(1, Math.ceil(wordCount / 200));

        let pos = 0;
        let neg = 0;
        const emotionScores: Record<string, number> = {};

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const prev = i > 0 ? tokens[i - 1] : '';
            const isNegated = NEGATORS.has(prev);

            let intensity = 1;
            if (INTENSIFIERS.has(prev)) intensity = 1.4;
            if (DOWNTONERS.has(prev)) intensity = 0.6;

            if (POSITIVE_WORDS.has(token)) pos += isNegated ? 0 : intensity;
            if (NEGATIVE_WORDS.has(token)) neg += isNegated ? 0 : intensity;

            const emotion = EMOTION_TOKEN_MAP.get(token);
            if (emotion && !isNegated) {
                emotionScores[emotion] = (emotionScores[emotion] || 0) + intensity;
            }
        }

        const signal = Math.max(1, pos + neg);
        const score = wordCount > 0 ? clamp((pos - neg) / signal, -1, 1) : 0;
        const sentimentLabel: SentimentResult['label'] = score > 0.12 ? 'positive' : score < -0.12 ? 'negative' : 'neutral';
        const confidence = clamp(((pos + neg) / Math.max(3, wordCount * 0.05)) * 0.6 + Math.abs(score) * 0.4, 0, 1);

        const topicCounts: Record<string, number> = {};
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (token.length < 3 || STOPWORDS.has(token)) continue;
            topicCounts[token] = (topicCounts[token] || 0) + 1;

            const next = i + 1 < tokens.length ? tokens[i + 1] : null;
            if (next && next.length >= 3 && !STOPWORDS.has(next)) {
                const bigram = `${token} ${next}`;
                topicCounts[bigram] = (topicCounts[bigram] || 0) + 0.75;
            }
        }

        const topics = Object.entries(topicCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([word]) => word);

        const keywords = Object.entries(topicCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([word]) => word);

        const entities: EntityResult[] = [];
        const capitalizedMatches = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
        const seenEntities = new Set<string>();
        for (const match of capitalizedMatches) {
            const key = match.toLowerCase();
            if (seenEntities.has(key)) continue;
            seenEntities.add(key);
            entities.push({ text: match, type: 'thing', confidence: 0.4 });
            if (entities.length >= 6) break;
        }

        const dominantEmotion = Object.entries(emotionScores).sort((a, b) => b[1] - a[1])[0]?.[0];
        const suggestedMood = dominantEmotion || (sentimentLabel === 'positive' ? 'happy' : sentimentLabel === 'negative' ? 'sad' : 'calm');
        const normalizedEmotions = normalizeEmotionScores(emotionScores);

        const highlights: string[] = [];
        if (normalizedEmotions) {
            const topEmotions = Object.entries(normalizedEmotions)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 2)
                .map(([emotion]) => emotion);
            if (topEmotions.length > 0) {
                highlights.push(`Dominant emotions: ${topEmotions.join(', ')}.`);
            }
        }
        if (topics.length > 0) {
            highlights.push(`Main themes: ${topics.slice(0, 3).join(', ')}.`);
        }
        if (entities.length > 0) {
            highlights.push(`Notable references: ${entities.slice(0, 3).map(e => e.text).join(', ')}.`);
        }

        return {
            sentiment: {
                score: score || 0,
                label: sentimentLabel,
                confidence,
                summary: `Tone is ${sentimentLabel}; strongest emotional signal is ${suggestedMood}.`,
            },
            entities,
            topics,
            suggestedMood,
            wordCount,
            readingTime,
            keywords,
            emotions: normalizedEmotions,
            highlights,
            provider: 'deterministic',
        };
    }

    private async analyzeWithLLM(content: string): Promise<AnalysisResult | null> {
        if (!hasLlmProvider()) return null;

        try {
            const response = await createLlmChatCompletion({
                model: aiRuntime.analysisModel,
                response_format: { type: 'json_object' },
                messages: [
                    {
                        role: 'system',
                        content: `You are an NLP analysis assistant for a student journal (ages 15-22).
                        Analyze the given text and return a JSON object with the following structure:
                        {
                            "sentimentScore": number, // -1.0 to 1.0
                            "sentimentLabel": "positive" | "negative" | "neutral",
                            "emotionalSummary": "string", // 1-sentence summary of the emotional state
                            "entities": [ { "text": "string", "type": "person" | "place" | "activity" | "thing" } ], // Max 5 entities
                            "topics": [ "string" ], // Max 5 main topics
                            "suggestedMood": "string", // One word: happy, calm, sad, anxious, frustrated, thoughtful, motivated, tired, grateful, hopeful, overwhelmed, nostalgic, proud, lonely, curious, or relieved
                            "analysisLine": "string", // 1 short sentence (max 80 chars): a specific observation, trend, or key point about this entry that is worth noticing. Be concrete, not generic. Example: "You mention your sister every time stress comes up"
                            "takeawayLine": "string" // 1 short sentence (max 80 chars): a lesson learned, skill practiced, or personal growth takeaway from this entry. Frame it as something the student did or can build on. Example: "You paused before reacting — that's emotional regulation"
                        }`
                    },
                    { role: 'user', content },
                ],
                max_tokens: 300,
                temperature: 0.3,
            });

            if (!response) throw new Error('Empty response from configured LLM');

            const resultText = response.choices[0]?.message?.content?.trim();
            if (!resultText) throw new Error('Empty response from AI');

            const aiData = JSON.parse(resultText);
            const words = content.split(/\s+/).filter(Boolean).length;
            const readingTime = Math.max(1, Math.ceil(words / 200));

            return {
                sentiment: {
                    score: aiData.sentimentScore || 0,
                    label: aiData.sentimentLabel || 'neutral',
                    confidence: 0.8,
                    summary: aiData.emotionalSummary,
                },
                entities: aiData.entities || [],
                topics: aiData.topics || [],
                suggestedMood: aiData.suggestedMood || 'neutral',
                wordCount: words,
                readingTime,
                keywords: aiData.keywords || aiData.topics || [],
                emotions: aiData.emotions || undefined,
                highlights: aiData.highlights || [],
                evidence: aiData.evidence || undefined,
                modelInfo: aiData.modelInfo || undefined,
                analysisLine: typeof aiData.analysisLine === 'string' ? aiData.analysisLine.slice(0, 100) : undefined,
                takeawayLine: typeof aiData.takeawayLine === 'string' ? aiData.takeawayLine.slice(0, 100) : undefined,
                provider: 'llm',
            };
        } catch (error) {
            console.error('LLM analysis failed:', error);
            return null;
        }
    }

    private shouldUseLlmRefinement(content: string, deterministic: AnalysisResult): boolean {
        if (!allowLLM) return false;
        if (deterministic.sentiment.confidence >= llmConfidenceThreshold) return false;
        if (deterministic.topics.length >= 4 && deterministic.entities.length >= 3) return false;

        const words = content.split(/\s+/).filter(Boolean).length;
        return words >= llmMinWords;
    }

    /**
     * Analyze text content for sentiment, entities, and insights.
     * Prefers Python microservice, then deterministic fallback, and only uses LLM if explicitly enabled.
     */
    async analyzeContent(content: string, options: AnalyzeContentOptions = {}): Promise<AnalysisResult> {
        const title = typeof options.title === 'string' && options.title.trim()
            ? options.title.trim()
            : undefined;
        const words = content.split(/\s+/).filter(Boolean);
        const wordCount = words.length;
        const readingTime = Math.max(1, Math.ceil(wordCount / 200));
        const preferAdvanced = options.preferAdvanced ?? (wordCount >= advancedAnalysisMinWords || content.length >= 900);

        if (!content || content.trim().length < 5) {
            return {
                sentiment: { score: 0, label: 'neutral', confidence: 0 },
                entities: [],
                topics: [],
                suggestedMood: 'neutral',
                wordCount,
                readingTime,
                highlights: [],
                provider: 'deterministic',
            };
        }

        const [memoryContext, personalizationSuggestions, pythonResult] = await Promise.all([
            options.userId
                ? analysisMemoryService.buildContext({
                    userId: options.userId,
                    content,
                    title,
                    excludeEntryId: options.excludeEntryId || null,
                })
                : Promise.resolve(null),
            options.userId
                ? entryPersonalizationService.suggestForDraft({
                    userId: options.userId,
                    content,
                    title,
                    excludeEntryId: options.excludeEntryId || null,
                })
                : Promise.resolve(null),
            this.analyzeWithPython(content, {
                title,
                preferAdvanced,
            }),
        ]);

        if (pythonResult) {
            return this.applyAnalysisEnrichment(
                pythonResult,
                memoryContext,
                personalizationSuggestions
            );
        }

        // Default local-first path for cost/perf reliability.
        const deterministic = this.analyzeDeterministic(content);

        // Escalate to LLM only for low-confidence or sparse extraction cases.
        if (this.shouldUseLlmRefinement(content, deterministic)) {
            const llmResult = await this.analyzeWithLLM(content);
            if (llmResult) {
                return this.applyAnalysisEnrichment(
                    mergeAnalysis(deterministic, llmResult),
                    memoryContext,
                    personalizationSuggestions
                );
            }
        }

        return this.applyAnalysisEnrichment(
            deterministic,
            memoryContext,
            personalizationSuggestions
        );
    }

    private splitSentences(content: string): string[] {
        return (content.match(/[^.!?\n]+[.!?]?/g) || [])
            .map((segment) => segment.replace(/\s+/g, ' ').trim())
            .filter(Boolean)
            .map((segment) => segment.slice(0, 500));
    }

    private findSentenceByPatterns(sentences: string[], patterns: RegExp[]): string {
        for (const sentence of sentences) {
            if (patterns.some((pattern) => pattern.test(sentence))) {
                return sentence;
            }
        }
        return '';
    }

    private findSentenceByPattern(sentences: string[], pattern: RegExp): string {
        for (const sentence of sentences) {
            if (pattern.test(sentence)) return sentence;
        }
        return '';
    }

    private normalizeEvidenceText(value: unknown, maxLength = 240): string {
        if (typeof value !== 'string') return '';
        return value
            .replace(/\s+/g, ' ')
            .replace(/^[\s\-:;,]+|[\s\-:;,]+$/g, '')
            .trim()
            .slice(0, maxLength);
    }

    private ensureSentence(value: string): string {
        const normalized = this.normalizeEvidenceText(value);
        if (!normalized) return '';
        const startUpper = normalized.charAt(0).toUpperCase() + normalized.slice(1);
        return /[.!?]$/.test(startUpper) ? startUpper : `${startUpper}.`;
    }

    private ngramSet(value: string, windowSize = 9): Set<string> {
        const tokens = value.toLowerCase().match(/[a-z0-9']+/g) || [];
        const grams = new Set<string>();
        if (tokens.length < windowSize) return grams;
        for (let i = 0; i <= tokens.length - windowSize; i++) {
            grams.add(tokens.slice(i, i + windowSize).join(' '));
        }
        return grams;
    }

    private hasLongVerbatimOverlap(candidate: string, source: string, windowSize = 9): boolean {
        const candidateSet = this.ngramSet(candidate, windowSize);
        if (candidateSet.size === 0) return false;
        const sourceSet = this.ngramSet(source, windowSize);
        for (const gram of candidateSet) {
            if (sourceSet.has(gram)) return true;
        }
        return false;
    }

    private truncateWords(value: string, maxWords = 14): string {
        const words = value.split(/\s+/).filter(Boolean);
        if (words.length <= maxWords) return value;
        return `${words.slice(0, maxWords).join(' ')}`;
    }

    private extractFocusTerm(text: string): string {
        const tokens = tokenize(text)
            .filter((token) => token.length >= 4 && !STOPWORDS.has(token) && !GENERIC_FOCUS_STOPWORDS.has(token))
            .slice(0, 40);
        if (tokens.length === 0) return 'this area';
        const counts = new Map<string, number>();
        tokens.forEach((token) => counts.set(token, (counts.get(token) || 0) + 1));
        const ranked = Array.from(counts.entries())
            .sort((a, b) => {
                if (b[1] !== a[1]) return b[1] - a[1];
                return b[0].length - a[0].length;
            })
            .map(([token]) => token);
        const selected = ranked.slice(0, 2);
        if (selected.length === 2) {
            const lower = text.toLowerCase();
            const [a, b] = selected;
            const ia = lower.indexOf(a);
            const ib = lower.indexOf(b);
            if (ia >= 0 && ib >= 0) {
                return ia <= ib ? `${a} ${b}` : `${b} ${a}`;
            }
        }
        return selected.join(' ');
    }

    private hasActionSignal(value: string): boolean {
        return ACTION_SIGNAL_PATTERN.test(value);
    }

    private trimTrailingConnector(value: string): string {
        return value.replace(/\b(and|or|but|to|for|with)\s*$/i, '').trim();
    }

    private hasOutcomeSignal(value: string): boolean {
        return /\b(resulted in|led to|improved|increased|reduced|achieved|earned|completed|impact|outcome|as a result|therefore|was able to)\b/i.test(value)
            || /\b\d+%|\b\d+\s*(users|clients|customers|days|hours|weeks|months|points|tickets|tasks)\b/i.test(value)
            || /\b(i felt|we felt|felt|feel)\b/i.test(value);
    }

    private hasLessonSignal(value: string): boolean {
        return /\b(learned|realized|discovered|understood|noticed|lesson|takeaway|in hindsight|looking back|next time|should|need to|could do better|would do better)\b/i.test(value);
    }

    private deterministicEvidenceRewrite(
        field: 'situation' | 'action' | 'lesson' | 'outcome',
        value: string,
        source: string
    ): string {
        const base = this.normalizeEvidenceText(value || source, 220);
        if (!base) return '';

        if (field === 'situation') {
            const situation = this.truncateWords(
                base
                    .replace(/^(so|well)\s+/i, '')
                    .replace(/\s+/g, ' ')
                    .trim(),
                18
            );
            return this.ensureSentence(situation);
        }

        const stripped = this.truncateWords(
            base
            .replace(/^(today|yesterday|this week|this month)\b[:,]?\s*/i, '')
            .replace(/^(so|well)\s+/i, '')
            .replace(/^(i|we)\s+/i, '')
            .replace(/^(as a result|in hindsight|looking back|lesson learned|takeaway|key lesson|observed outcome|context|executed work on)[:,]?\s*/i, '')
            .replace(/\b(and then|then)\b/ig, '')
            .replace(/\s+/g, ' ')
            .trim(),
            field === 'action' ? 16 : 14
        );

        if (!stripped) return '';
        const hasEnoughSignal = stripped.split(/\s+/).filter(Boolean).length >= 4;
        if (!hasEnoughSignal && field !== 'action') return '';

        if (field === 'action') {
            if (!hasEnoughSignal) {
                const focus = this.extractFocusTerm(base);
                return this.ensureSentence(`I captured this update on ${focus}`);
            }
            if (!this.hasActionSignal(base)) {
                const focus = this.extractFocusTerm(base);
                return this.ensureSentence(`I reflected on ${focus}`);
            }
            return this.ensureSentence(this.trimTrailingConnector(stripped.replace(/^(to)\s+/i, '')));
        }
        if (field === 'lesson') {
            if (this.hasLessonSignal(base)) return this.ensureSentence(stripped.replace(/^(that)\s+/i, ''));
            const emotionTokens = tokenize(base)
                .map((token) => EMOTION_TOKEN_MAP.get(token))
                .filter((value): value is string => !!value);
            const uniqueEmotions = Array.from(new Set(emotionTokens)).slice(0, 2);
            if (uniqueEmotions.length > 0) {
                const emotionPhrase = uniqueEmotions.join(' and ');
                return this.ensureSentence(`I learned to manage feeling ${emotionPhrase}`);
            }
            const focus = this.extractFocusTerm(base);
            return this.ensureSentence(`I learned to be more intentional about ${focus}`);
        }
        if (field === 'outcome') {
            if (this.hasOutcomeSignal(base)) return this.ensureSentence(stripped);
            const focus = this.extractFocusTerm(base);
            return this.ensureSentence(`I made progress in ${focus}`);
        }
        return this.ensureSentence(stripped);
    }

    private inferLesson(action: string, outcome: string, content: string): string {
        const ruleSentence = this.findSentenceByPattern(this.splitSentences(content), LESSON_FALLBACK_PATTERN);
        if (ruleSentence) {
            return this.ensureSentence(this.deterministicEvidenceRewrite('lesson', ruleSentence, ruleSentence));
        }
        const emotionalMatch = (outcome || content).match(/\b(felt|feel)\s+([a-z]+)/i);
        if (emotionalMatch?.[2]) {
            return this.ensureSentence(`I learned to manage my energy when I feel ${emotionalMatch[2].toLowerCase()}`);
        }
        const focus = this.extractFocusTerm(content);
        return this.ensureSentence(`I learned to stay consistent with ${focus}`);
    }

    private inferOutcome(action: string, content: string): string {
        const outcomeSentence = this.findSentenceByPattern(this.splitSentences(content), OUTCOME_FALLBACK_PATTERN);
        if (outcomeSentence) {
            return this.ensureSentence(this.deterministicEvidenceRewrite('outcome', outcomeSentence, outcomeSentence));
        }
        const focus = this.extractFocusTerm(content);
        return this.ensureSentence(`I made progress in ${focus}`);
    }

    private sanitizeSkills(input: unknown, fallback: string[] = []): string[] {
        const fromInput = Array.isArray(input)
            ? input.filter((item): item is string => typeof item === 'string')
            : [];
        const merged = [...fromInput, ...fallback]
            .map((skill) => skill.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim())
            .filter((skill) => skill.length >= 3 && !STOPWORDS.has(skill) && !GENERIC_FOCUS_STOPWORDS.has(skill));

        const deduped: string[] = [];
        const seen = new Set<string>();
        merged.forEach((skill) => {
            if (seen.has(skill)) return;
            seen.add(skill);
            deduped.push(skill.split(' ').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' '));
        });

        return deduped.slice(0, 6);
    }

    private deterministicOpportunityEvidence(
        content: string,
        seed?: Partial<OpportunityEvidenceSynthesis & { topics: string[]; keywords: string[] }>
    ): OpportunityEvidenceSynthesis {
        const sentences = this.splitSentences(content);
        const firstSentence = sentences[0] || '';
        const normalizedSeedAction = this.normalizeEvidenceText(seed?.action);
        const normalizedSeedLesson = this.normalizeEvidenceText(seed?.lesson);
        const normalizedSeedOutcome = this.normalizeEvidenceText(seed?.outcome);
        const normalizedSeedSituation = this.normalizeEvidenceText(seed?.situation);
        const seedPrefixRegex = /^(context:|executed work on|observed outcome:|key lesson:)/i;

        const actionSource = this.findSentenceByPatterns(sentences, EVIDENCE_ACTION_PATTERNS)
            || (normalizedSeedAction && !seedPrefixRegex.test(normalizedSeedAction) ? normalizedSeedAction : '')
            || firstSentence;
        const lessonSource = this.findSentenceByPatterns(sentences, EVIDENCE_LESSON_PATTERNS)
            || (normalizedSeedLesson && !seedPrefixRegex.test(normalizedSeedLesson) && this.hasLessonSignal(normalizedSeedLesson) ? normalizedSeedLesson : '');
        const outcomeSource = this.findSentenceByPatterns(sentences, EVIDENCE_OUTCOME_PATTERNS)
            || (normalizedSeedOutcome && !seedPrefixRegex.test(normalizedSeedOutcome) && this.hasOutcomeSignal(normalizedSeedOutcome) ? normalizedSeedOutcome : '');
        const situationSource = firstSentence || (normalizedSeedSituation && !seedPrefixRegex.test(normalizedSeedSituation) ? normalizedSeedSituation : '');

        const situation = this.ensureSentence(this.deterministicEvidenceRewrite('situation', situationSource, firstSentence));
        const action = actionSource
            ? this.ensureSentence(this.deterministicEvidenceRewrite('action', actionSource, actionSource))
            : '';
        const lesson = lessonSource
            ? this.ensureSentence(this.deterministicEvidenceRewrite('lesson', lessonSource, lessonSource))
            : this.inferLesson(action || situation, '', content);
        const outcome = outcomeSource
            ? this.ensureSentence(this.deterministicEvidenceRewrite('outcome', outcomeSource, outcomeSource))
            : this.inferOutcome(action || situation, content);

        const fallbackSkills = [...(seed?.topics || []), ...(seed?.keywords || [])].slice(0, 8);
        const skills = this.sanitizeSkills(seed?.skills, fallbackSkills);
        const populated = [situation, action, lesson, outcome].filter((item) => item.length > 0).length;
        const confidence = Number((0.35 + populated * 0.13 + (skills.length > 0 ? 0.06 : 0)).toFixed(2));

        return {
            situation,
            action,
            lesson,
            outcome,
            skills,
            confidence: Math.min(0.9, confidence),
            provider: 'deterministic',
        };
    }

    async synthesizeOpportunityEvidence(
        content: string,
        seed?: Partial<OpportunityEvidenceSynthesis & { topics: string[]; keywords: string[] }>
    ): Promise<OpportunityEvidenceSynthesis | null> {
        const normalizedContent = content.replace(/\s+/g, ' ').trim();
        if (normalizedContent.length < 5) return null;

        const deterministic = this.deterministicOpportunityEvidence(normalizedContent, seed);
        if (!hasLlmProvider() || !this.canUseLlmEvidence) return deterministic;

        try {
            const seedPayload = {
                situation: this.normalizeEvidenceText(seed?.situation),
                action: this.normalizeEvidenceText(seed?.action),
                lesson: this.normalizeEvidenceText(seed?.lesson),
                outcome: this.normalizeEvidenceText(seed?.outcome),
                skills: this.sanitizeSkills(seed?.skills),
                topics: Array.isArray(seed?.topics) ? seed?.topics.slice(0, 8) : [],
                keywords: Array.isArray(seed?.keywords) ? seed?.keywords.slice(0, 8) : [],
            };

            const response = await createLlmChatCompletion({
                model: aiRuntime.evidenceModel,
                temperature: 0.2,
                response_format: { type: 'json_object' },
                max_tokens: 420,
                messages: [
                    {
                        role: 'system',
                        content: `You extract portfolio-ready evidence from a student journal entry (author aged 15-22).
Return strict JSON:
{
  "situation": "string",
  "action": "string",
  "lesson": "string",
  "outcome": "string",
  "skills": ["string"],
  "confidence": number
}

Rules:
- Ground every field in the provided entry. Do not invent facts.
- Keep each field concise (8-24 words), specific, and non-generic.
- Avoid verbatim copying from the entry; rephrase.
- If evidence is weak, keep field as empty string.
- Skills must be concrete capabilities (max 6).`
                    },
                    {
                        role: 'user',
                        content: JSON.stringify({
                            entry: normalizedContent.slice(0, 6000),
                            seed: seedPayload,
                        }),
                    },
                ],
            });

            if (!response) return deterministic;

            const payload = response.choices[0]?.message?.content?.trim();
            if (!payload) return deterministic;

            const parsed = JSON.parse(payload) as Record<string, unknown>;
            const llmResult: OpportunityEvidenceSynthesis = {
                situation: this.ensureSentence(this.normalizeEvidenceText(parsed.situation)),
                action: this.ensureSentence(this.normalizeEvidenceText(parsed.action)),
                lesson: this.ensureSentence(this.normalizeEvidenceText(parsed.lesson)),
                outcome: this.ensureSentence(this.normalizeEvidenceText(parsed.outcome)),
                skills: this.sanitizeSkills(parsed.skills, deterministic.skills),
                confidence: Math.min(0.98, Math.max(0, Number(parsed.confidence) || 0.65)),
                provider: 'llm',
            };

            (['situation', 'action', 'lesson', 'outcome'] as const).forEach((field) => {
                const candidate = llmResult[field];
                if (!candidate) return;
                if (this.hasLongVerbatimOverlap(candidate, normalizedContent, 9)) {
                    llmResult[field] = this.deterministicEvidenceRewrite(field, candidate, normalizedContent);
                }
                if (!llmResult[field]) {
                    llmResult[field] = deterministic[field];
                }
            });

            if (!llmResult.skills.length) llmResult.skills = deterministic.skills;
            return llmResult;
        } catch (error) {
            const status = (error as any)?.status;
            const code = (error as any)?.code;
            const type = (error as any)?.type;
            if (status === 429 || code === 'insufficient_quota' || type === 'insufficient_quota') {
                this.canUseLlmEvidence = false;
                if (!this.loggedEvidenceProviderDisable) {
                    this.loggedEvidenceProviderDisable = true;
                    console.warn('Opportunity evidence synthesis: disabling the configured LLM path due to quota/rate-limit; using deterministic fallback.');
                }
            } else {
                console.error('Opportunity evidence synthesis failed:', error);
            }
            return deterministic;
        }
    }

    /**
     * Chat with journal context using the configured LLM provider or HuggingFace
     */
    async chat(query: string, context: string): Promise<string> {
        try {
            const availability = this.getChatAvailability();
            if (!availability.available) {
                return availability.message || 'AI Coach is not enabled yet for this environment.';
            }

            // Truncate context to prevent token bloat with many entries
            const MAX_CONTEXT_CHARS = 12000;
            const truncatedContext = context.length > MAX_CONTEXT_CHARS
                ? context.slice(0, MAX_CONTEXT_CHARS) + '\n…[additional notes omitted — showing most relevant]'
                : context;

            if (availability.provider === 'llm') {
                const response = await createLlmChatCompletion({
                    model: aiRuntime.chatModel,
                    messages: [
                        {
                        role: 'system',
                        content: `You are a personal journal guide for a student. Answer their question directly and concisely.

Context (note snippets — the only facts you have):
${truncatedContext}

Response rules:
1. Lead with the answer. First sentence should directly address what they asked.
2. Keep it short — 2-4 sentences for simple questions, up to 6 for summaries.
3. Reference specific dates, moods, or words from their notes when relevant.
4. If the snippets don't contain enough to answer, say "I don't have enough notes on that yet" and suggest what to write about.
5. Never lecture, moralize, or give unsolicited advice. Mirror what you see in their words.
6. Use "you" language, not "I found" or "I noticed" — make it about them.
7. One follow-up question at the end is fine. Never more than one.
8. No headers, bullet lists, or numbered lists. Write in natural paragraphs.`
                        },
                        { role: 'user', content: query }
                    ],
                    max_tokens: 300,
                    temperature: 0.7,
                });
                return response?.choices[0]?.message?.content || "I couldn't generate a response.";
            }

            // Fallback to HuggingFace Inference API when explicitly configured.
            const hfToken = (process.env.HF_API_KEY || process.env.HUGGINGFACE_API_KEY || '').trim();
            const hfModel = "mistralai/Mistral-7B-Instruct-v0.2";

            const prompt = `<s>[INST] You are a personal journal guide for a student. Answer their question directly in 2-4 sentences. Reference specific dates or moods from the notes. No bullet lists or headers.

Context:
${truncatedContext}

Question: ${query} [/INST]`;

            const headers: Record<string, string> = {
                "Content-Type": "application/json"
            };
            if (hfToken) {
                headers["Authorization"] = `Bearer ${hfToken}`;
            }

            const response = await fetch(`https://api-inference.huggingface.co/models/${hfModel}`, {
                method: "POST",
                headers: headers,
                body: JSON.stringify({
                    inputs: prompt,
                    parameters: { max_new_tokens: 500, return_full_text: false }
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`HF API Error: ${response.status} ${errText}`);
            }

            const result = await response.json();
            return result[0]?.generated_text || "I couldn't generate a response.";

        } catch (error) {
            console.error('AI Chat failed:', error);
            return this.buildManagedChatFallback(context);
        }
    }

    /**
     * Generate insights from multiple entries
     */
    async generateInsights(entries: Array<{
        content: string;
        mood?: string;
        createdAt: Date;
        skills?: string[];
        lessons?: string[];
    }>): Promise<{
        dominantMood: string;
        moodTrend: 'improving' | 'declining' | 'stable';
        topTopics: string[];
        averageSentiment: number;
        suggestions: string[];
        topLessons?: string[];
        topSkills?: string[];
    }> {
        if (entries.length === 0) {
            return {
                dominantMood: 'neutral',
                moodTrend: 'stable',
                topTopics: [],
                averageSentiment: 0,
                suggestions: ['Start journaling to get personalized insights!'],
            };
        }

        const moodCounts: Record<string, number> = {};
        const skillCounts: Record<string, number> = {};
        const lessonCounts: Record<string, number> = {};
        const topicCounts: Record<string, number> = {};
        const timelineSentiment: Array<{ date: number; score: number }> = [];

        entries.forEach(e => {
            if (e.mood) moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;

            e.skills?.forEach(s => {
                skillCounts[s] = (skillCounts[s] || 0) + 1;
            });

            e.lessons?.forEach(l => {
                lessonCounts[l] = (lessonCounts[l] || 0) + 1;
            });

            tokenize(e.content).forEach(token => {
                if (token.length < 4 || STOPWORDS.has(token)) return;
                topicCounts[token] = (topicCounts[token] || 0) + 1;
            });

            timelineSentiment.push({
                date: new Date(e.createdAt).getTime(),
                score: this.quickSentimentScore(e.content),
            });
        });

        const dominantMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';
        const topSkills = Object.entries(skillCounts).sort((a, b) => b[1] - a[1]).map(x => x[0]).slice(0, 5);
        const topLessons = Object.entries(lessonCounts).sort((a, b) => b[1] - a[1]).map(x => x[0]).slice(0, 5);
        const topTokens = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).map(x => x[0]).slice(0, 5);

        const topTopics = topSkills.length > 0 ? topSkills : (topTokens.length > 0 ? topTokens : ['reflection', 'growth', 'daily life']);

        const averageSentiment = timelineSentiment.length > 0
            ? Number((timelineSentiment.reduce((acc, item) => acc + item.score, 0) / timelineSentiment.length).toFixed(3))
            : 0;

        const sortedTimeline = [...timelineSentiment].sort((a, b) => a.date - b.date);
        const segmentSize = Math.max(1, Math.floor(sortedTimeline.length / 3));
        const early = sortedTimeline.slice(0, segmentSize);
        const recent = sortedTimeline.slice(-segmentSize);
        const earlyAvg = early.length > 0 ? early.reduce((acc, item) => acc + item.score, 0) / early.length : averageSentiment;
        const recentAvg = recent.length > 0 ? recent.reduce((acc, item) => acc + item.score, 0) / recent.length : averageSentiment;
        const delta = recentAvg - earlyAvg;

        const moodTrend: 'improving' | 'declining' | 'stable' =
            delta > 0.08 ? 'improving' : delta < -0.08 ? 'declining' : 'stable';

        const suggestions: string[] = [];
        if (moodTrend === 'declining') {
            suggestions.push('Your recent tone trends lower. Add a short daily reflection on one positive event.');
        } else if (moodTrend === 'improving') {
            suggestions.push('Your emotional trend is improving. Keep the routines that supported this progress.');
        } else {
            suggestions.push('Your emotional trend is stable. Try a weekly review to surface subtle changes.');
        }

        if (dominantMood === 'anxious' || dominantMood === 'sad' || averageSentiment < -0.1) {
            suggestions.push('Consider breaking major concerns into one actionable next step per entry.');
        } else if (dominantMood === 'motivated' || dominantMood === 'happy' || averageSentiment > 0.2) {
            suggestions.push('Capture what is working well so those patterns can be repeated intentionally.');
        }

        if (entries.length < 8) {
            suggestions.push('More entries improve accuracy. Aim for short daily notes to strengthen insights.');
        }

        return {
            dominantMood,
            moodTrend,
            topTopics,
            topSkills,
            topLessons,
            averageSentiment,
            suggestions: suggestions.slice(0, 3),
        };
    }

    private quickSentimentScore(content: string): number {
        const tokens = tokenize(content);
        if (tokens.length === 0) return 0;
        let pos = 0;
        let neg = 0;

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const prev = i > 0 ? tokens[i - 1] : '';
            const isNegated = NEGATORS.has(prev);
            const weight = INTENSIFIERS.has(prev) ? 1.4 : DOWNTONERS.has(prev) ? 0.6 : 1;

            if (POSITIVE_WORDS.has(token) && !isNegated) pos += weight;
            if (NEGATIVE_WORDS.has(token) && !isNegated) neg += weight;
        }

        if (pos + neg === 0) return 0;
        return clamp((pos - neg) / (pos + neg), -1, 1);
    }
}

export default new NLPService();
