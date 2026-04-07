import { aiRuntime, createLlmChatCompletion, hasLlmProvider } from '../config/ai';
import nlpService from './nlp.service';
import { normalizeTag } from './tag-manager.service';

interface TagSuggestion {
    name: string;
    confidence: number;
    source?: 'user' | 'nlp' | 'ai';
}

const allowLLMTagging = process.env.USE_LLM_TAGGING === 'true' && hasLlmProvider();
// LLM always augments NLP tags unless explicitly overridden by env var
const llmTaggingMinLocalTags = Number.parseInt(process.env.LLM_TAGGING_MIN_LOCAL_TAGS || '10', 10) || 10;

const STOPWORDS = new Set([
    'a', 'an', 'and', 'the', 'to', 'of', 'in', 'on', 'for', 'with', 'at', 'from', 'by', 'as',
    'is', 'it', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they',
    'my', 'your', 'our', 'their', 'me', 'him', 'her', 'us', 'them', 'be', 'been', 'being',
    'was', 'were', 'am', 'are', 'or', 'but', 'so', 'if', 'then', 'than', 'too', 'very', 'just',
    'im', 'ive', 'id', 'ill', 'its', 'dont', 'didnt', 'wont', 'cant', 'not', 'no', 'yes',
    'has', 'had', 'have', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'shall',
    'may', 'might', 'must', 'need', 'get', 'got', 'one', 'two', 'three', 'also', 'about',
    'like', 'want', 'know', 'think', 'make', 'made', 'some', 'what', 'when', 'where', 'how',
    'which', 'who', 'whom', 'why', 'here', 'there', 'now', 'more', 'much', 'many', 'any',
    'each', 'every', 'all', 'both', 'few', 'other', 'such', 'only', 'own', 'same', 'into',
    'over', 'after', 'before', 'between', 'under', 'again', 'still', 'really', 'even', 'back',
    'come', 'came', 'went', 'going', 'doing', 'been', 'said', 'says', 'tell', 'told',
    'through', 'down', 'out', 'off', 'up', 'way', 'thing', 'things', 'time', 'day', 'today',
    'yesterday', 'week', 'feels', 'felt', 'feel', 'right', 'well', 'good', 'yeah', 'okay',
    'features', 'node', 'nodeo', 'happy', 'just', 'something', 'anything', 'everything',
    'instagram', 'facebook', 'imported',
]);

/** Minimum character length for a tag to be valid */
const MIN_TAG_LENGTH = 3;

/** Returns true only for tags that are meaningful keywords (not stopwords, long enough) */
export const isValidTag = (normalized: string): boolean => {
    if (normalized.length < MIN_TAG_LENGTH) return false;
    // Reject single-word tags that are stopwords
    const parts = normalized.split(/[\s-]+/);
    if (parts.every(p => STOPWORDS.has(p) || p.length < 2)) return false;
    return true;
};

export class TaggingService {
    private collectDeterministicTags(text: string, analysis: Awaited<ReturnType<typeof nlpService.analyzeContent>>): Map<string, number> {
        const tags = new Map<string, number>();

        (analysis.topics || []).forEach(tag => {
            const normalized = normalizeTag(tag);
            if (!normalized || !isValidTag(normalized)) return;
            tags.set(normalized, Math.max(tags.get(normalized) || 0, 0.8));
        });

        (analysis.keywords || []).forEach(tag => {
            const normalized = normalizeTag(tag);
            if (!normalized || !isValidTag(normalized)) return;
            tags.set(normalized, Math.max(tags.get(normalized) || 0, 0.6));
        });

        (analysis.entities || []).forEach(entity => {
            const normalized = normalizeTag(entity.text);
            if (!normalized || !isValidTag(normalized)) return;
            tags.set(normalized, Math.max(tags.get(normalized) || 0, 0.55));
        });

        // Note: suggestedMood is intentionally excluded — mood is stored in Entry.mood already.

        (analysis.suggestions?.tags || []).forEach((tag) => {
            const normalized = normalizeTag(tag.value);
            if (!normalized || !isValidTag(normalized)) return;
            tags.set(
                normalized,
                Math.max(tags.get(normalized) || 0, Math.min(0.82, Math.max(0.58, tag.confidence)))
            );
        });

        const hashtagMatches = text.match(/#(\w+)/g) || [];
        hashtagMatches.forEach(tag => {
            const normalized = normalizeTag(tag);
            if (!normalized || !isValidTag(normalized)) return;
            tags.set(normalized, Math.max(tags.get(normalized) || 0, 0.7));
        });

        if (tags.size === 0) {
            const tokens = text.toLowerCase().match(/\b[a-z']+\b/g) || [];
            const counts: Record<string, number> = {};
            tokens.forEach(token => {
                if (token.length < 5 || STOPWORDS.has(token)) return;
                counts[token] = (counts[token] || 0) + 1;
            });

            Object.entries(counts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .forEach(([word]) => {
                    if (isValidTag(word)) tags.set(word, 0.4);
                });
        }

        return tags;
    }

    private mapTagScores(tags: Map<string, number>, source: 'nlp' | 'ai'): TagSuggestion[] {
        return Array.from(tags.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
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
            .slice(0, 3);
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
                        content: `You are a journaling intelligence engine for students aged 15–24.
Read this journal entry and extract 2–3 precise, specific tags that reflect the actual situation, challenge, or theme — NOT broad category labels.

Rules:
1. Be specific: "exam-pressure" not "school", "friend-conflict" not "social", "late-night-grind" not "work"
2. Capture named challenges students face: "self-doubt", "parental-pressure", "rejection", "burnout", "procrastination"
3. Capture growth moments: "breakthrough", "boundary-set", "apology-given", "lesson-learned"
4. Use 1–2 word hyphenated lowercase tags only
5. Do NOT output the mood itself (e.g. not "anxious", "happy") — mood is stored separately
6. Respect negation: "I didn't study" → no "studying" tag
7. Return ONLY valid JSON: {"tags": ["tag-one", "tag-two"]}`
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

            return tags.slice(0, 3)
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
