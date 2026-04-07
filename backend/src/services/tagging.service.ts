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
    // articles, prepositions, conjunctions
    'a', 'an', 'and', 'the', 'to', 'of', 'in', 'on', 'for', 'with', 'at', 'from', 'by', 'as',
    'or', 'but', 'so', 'if', 'then', 'than', 'too', 'into', 'over', 'after', 'before',
    'between', 'under', 'through', 'down', 'out', 'off', 'up',
    // pronouns & determiners
    'is', 'it', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they',
    'my', 'your', 'our', 'their', 'me', 'him', 'her', 'us', 'them',
    'each', 'every', 'all', 'both', 'few', 'other', 'such', 'only', 'own', 'same',
    'some', 'what', 'when', 'where', 'how', 'which', 'who', 'whom', 'why',
    // common verbs (not topical as standalone tags)
    'be', 'been', 'being', 'was', 'were', 'am', 'are',
    'im', 'ive', 'id', 'ill', 'its', 'dont', 'didnt', 'wont', 'cant',
    'has', 'had', 'have', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'shall',
    'may', 'might', 'must', 'need', 'get', 'got',
    'like', 'want', 'know', 'think', 'make', 'made',
    'come', 'came', 'went', 'going', 'doing', 'said', 'says', 'tell', 'told',
    'go', 'see', 'saw', 'seen', 'give', 'gave', 'take', 'took', 'taken', 'put',
    'let', 'try', 'tried', 'keep', 'kept', 'leave', 'left', 'call', 'called',
    'run', 'ran', 'look', 'looked', 'ask', 'asked', 'use', 'used', 'find', 'found',
    'say', 'set', 'help', 'helped', 'show', 'showed', 'turn', 'turned', 'move', 'moved',
    'start', 'started', 'stop', 'stopped', 'end', 'ended', 'open', 'opened',
    'talk', 'talked', 'hear', 'heard', 'bring', 'brought', 'begin', 'began',
    'seem', 'seemed', 'happen', 'happened', 'become', 'became', 'stay', 'stayed',
    // common adjectives & adverbs (not meaningful as tags)
    'not', 'no', 'yes', 'very', 'just', 'really', 'even', 'still', 'also', 'about',
    'here', 'there', 'now', 'more', 'much', 'many', 'any', 'again', 'back',
    'right', 'well', 'good', 'bad', 'big', 'small', 'long', 'new', 'old', 'last', 'next',
    'first', 'great', 'little', 'different', 'important', 'hard', 'best', 'whole', 'able',
    'happy', 'okay', 'yeah', 'nice', 'sure', 'real', 'fine', 'pretty', 'enough',
    // generic nouns (too vague for meaningful tags)
    'one', 'two', 'three', 'way', 'thing', 'things', 'time', 'day', 'today',
    'yesterday', 'week', 'month', 'year', 'lot', 'kind', 'part', 'place', 'point',
    'nothing', 'something', 'anything', 'everything',
    'people', 'person', 'life', 'work', 'stuff', 'bit',
    // feelings as standalone (mood is stored separately)
    'feels', 'felt', 'feel', 'feeling',
    // platform noise
    'features', 'node', 'nodeo', 'instagram', 'facebook', 'imported',
]);

/** Gerunds that are valid noun-topics despite the -ing suffix */
const NOUN_GERUNDS = new Set([
    'writing', 'reading', 'coding', 'meeting', 'training', 'learning', 'teaching',
    'building', 'cooking', 'painting', 'drawing', 'swimming', 'running', 'boxing',
    'singing', 'dancing', 'gaming', 'hiking', 'climbing', 'cycling', 'skating',
    'journaling', 'tutoring', 'volunteering', 'mentoring', 'networking',
    'brainstorming', 'programming', 'engineering', 'designing', 'planning',
    'budgeting', 'investing', 'marketing', 'consulting', 'parenting',
]);

/** Minimum character length for a tag to be valid */
const MIN_TAG_LENGTH = 3;

/** Returns true only for tags that are meaningful keywords (not stopwords, long enough) */
export const isValidTag = (normalized: string): boolean => {
    if (normalized.length < MIN_TAG_LENGTH) return false;
    const parts = normalized.split(/[\s-]+/);
    // Reject if every part is a stopword or too short
    if (parts.every(p => STOPWORDS.has(p) || p.length < 2)) return false;
    // For single-word tags, block non-noun gerunds (e.g. "feeling", "going")
    if (parts.length === 1) {
        const word = parts[0];
        if (word.endsWith('ing') && word.length > 4 && !NOUN_GERUNDS.has(word)) return false;
        // Block past-tense words ending in -ed (e.g. "started", "happened")
        if (word.endsWith('ed') && word.length > 4 && STOPWORDS.has(word)) return false;
    }
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
