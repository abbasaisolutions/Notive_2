import { aiRuntime, createLlmChatCompletion, hasLlmProvider } from '../config/ai';
import nlpService from './nlp.service';

interface TagSuggestion {
    name: string;
    confidence: number;
    source?: 'user' | 'nlp' | 'ai';
}

const allowLLMTagging = process.env.USE_LLM_TAGGING === 'true' && hasLlmProvider();
const llmTaggingMinLocalTags = Number.parseInt(process.env.LLM_TAGGING_MIN_LOCAL_TAGS || '3', 10) || 3;

const STOPWORDS = new Set([
    'a', 'an', 'and', 'the', 'to', 'of', 'in', 'on', 'for', 'with', 'at', 'from', 'by', 'as',
    'is', 'it', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they',
    'my', 'your', 'our', 'their', 'me', 'him', 'her', 'us', 'them', 'be', 'been', 'being',
    'was', 'were', 'am', 'are', 'or', 'but', 'so', 'if', 'then', 'than', 'too', 'very', 'just',
]);

const normalizeTag = (tag: string) =>
    tag
        .replace(/^#+/, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^a-z0-9\s-]/g, '')
        .slice(0, 32);

export class TaggingService {
    private collectDeterministicTags(text: string, analysis: Awaited<ReturnType<typeof nlpService.analyzeContent>>): Map<string, number> {
        const tags = new Map<string, number>();

        (analysis.topics || []).forEach(tag => {
            const normalized = normalizeTag(tag);
            if (!normalized) return;
            tags.set(normalized, Math.max(tags.get(normalized) || 0, 0.8));
        });

        (analysis.keywords || []).forEach(tag => {
            const normalized = normalizeTag(tag);
            if (!normalized) return;
            tags.set(normalized, Math.max(tags.get(normalized) || 0, 0.6));
        });

        (analysis.entities || []).forEach(entity => {
            const normalized = normalizeTag(entity.text);
            if (!normalized) return;
            tags.set(normalized, Math.max(tags.get(normalized) || 0, 0.55));
        });

        if (analysis.suggestedMood) {
            const normalized = normalizeTag(analysis.suggestedMood);
            if (normalized) tags.set(normalized, Math.max(tags.get(normalized) || 0, 0.5));
        }

        (analysis.suggestions?.tags || []).forEach((tag) => {
            const normalized = normalizeTag(tag.value);
            if (!normalized) return;
            tags.set(
                normalized,
                Math.max(tags.get(normalized) || 0, Math.min(0.82, Math.max(0.58, tag.confidence)))
            );
        });

        const hashtagMatches = text.match(/#(\w+)/g) || [];
        hashtagMatches.forEach(tag => {
            const normalized = normalizeTag(tag);
            if (!normalized) return;
            tags.set(normalized, Math.max(tags.get(normalized) || 0, 0.7));
        });

        if (tags.size === 0) {
            const tokens = text.toLowerCase().match(/\b[a-z']+\b/g) || [];
            const counts: Record<string, number> = {};
            tokens.forEach(token => {
                if (token.length < 4 || STOPWORDS.has(token)) return;
                counts[token] = (counts[token] || 0) + 1;
            });

            Object.entries(counts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .forEach(([word]) => tags.set(word, 0.4));
        }

        return tags;
    }

    private mapTagScores(tags: Map<string, number>, source: 'nlp' | 'ai'): TagSuggestion[] {
        return Array.from(tags.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, confidence]) => ({ name, confidence, source }));
    }

    private mergeTagSuggestions(base: TagSuggestion[], extras: TagSuggestion[]): TagSuggestion[] {
        const merged = new Map<string, TagSuggestion>();

        [...base, ...extras].forEach((tag) => {
            const key = normalizeTag(tag.name);
            if (!key) return;
            const existing = merged.get(key);
            if (!existing || (tag.confidence ?? 0) > (existing.confidence ?? 0)) {
                merged.set(key, {
                    name: key,
                    confidence: Math.max(tag.confidence ?? 0.4, existing?.confidence ?? 0),
                    source: (tag.source === 'ai' || existing?.source === 'ai') ? 'ai' : 'nlp',
                });
            }
        });

        return Array.from(merged.values())
            .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
            .slice(0, 5);
    }

    async suggestTagsFromAnalysis(
        text: string,
        analysis: Awaited<ReturnType<typeof nlpService.analyzeContent>>
    ): Promise<TagSuggestion[]> {
        const deterministicTags = this.mapTagScores(this.collectDeterministicTags(text, analysis), 'nlp');

        if (!allowLLMTagging || deterministicTags.length >= llmTaggingMinLocalTags) {
            return deterministicTags;
        }

        const llmTags = await this.suggestTagsWithLLM(text);
        if (llmTags.length === 0) return deterministicTags;
        return this.mergeTagSuggestions(deterministicTags, llmTags);
    }

    /**
     * Automatically suggest tags for a journal entry.
     * Prefers deterministic NLP, optional LLM if explicitly enabled.
     */
    async suggestTags(
        content: string,
        title?: string,
        options: { userId?: string; excludeEntryId?: string | null } = {}
    ): Promise<TagSuggestion[]> {
        const text = `${title ? `Title: ${title}\n` : ''}${content}`.trim();
        if (text.length < 10) return [];

        // Deterministic: use NLP analysis topics/keywords + hashtag extraction
        const analysis = await nlpService.analyzeContent(content, {
            title,
            userId: options.userId,
            excludeEntryId: options.excludeEntryId || null,
        });
        return this.suggestTagsFromAnalysis(text, analysis);
    }

    private async suggestTagsWithLLM(text: string): Promise<TagSuggestion[]> {
        try {
            const response = await createLlmChatCompletion({
                model: aiRuntime.taggingModel,
                response_format: { type: 'json_object' },
                messages: [
                    {
                        role: 'system',
                        content: `You are an AI tagging assistant for a personal journal. 
                        Analyze the following journal entry and generate 3-5 relevant tags.
                        Rules:
                        1. Tags should be short (1-2 words).
                        2. Respect negation (e.g., "I did not study" should NOT be tagged "Study").
                        3. Focus on topics, activities, emotions, and locations.
                        4. Return ONLY a JSON object with a "tags" key containing an array of strings, e.g., {"tags": ["Work", "Anxiety", "Cafe"]}.`
                    },
                    { role: 'user', content: text },
                ],
                max_tokens: 50,
                temperature: 0.4,
            });

            const contentStr = response?.choices[0]?.message?.content?.trim();
            if (!contentStr) return [];

            let tags: string[] = [];
            try {
                const parsed = JSON.parse(contentStr);
                tags = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.tags) ? parsed.tags : []);
            } catch (e) {
                tags = contentStr.replace(/[\[\]"]+/g, '').split(',').map(t => t.trim());
            }

            return tags.slice(0, 5)
                .map((tag): TagSuggestion => ({
                    name: normalizeTag(tag),
                    confidence: 0.9,
                    source: 'ai',
                }))
                .filter(t => t.name.length > 0);
        } catch (error) {
            console.error('Error generating AI tags:', error);
            return [];
        }
    }
}

export default new TaggingService();
