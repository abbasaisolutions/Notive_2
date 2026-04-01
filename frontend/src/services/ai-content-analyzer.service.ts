/**
 * AI Content Analyzer Service
 * Automatically extracts metadata from journal entry content
 */
import { normalizeMood } from '@/constants/moods';

export interface ContentAnalysis {
    suggestedTitle: string;
    extractedTags: string[];
    detectedMood: string | null;
    suggestedChapter: string | null;
    keyEntities: {
        people: string[];
        places: string[];
        activities: string[];
    };
    sentiment: 'positive' | 'negative' | 'neutral';
    wordCount: number;
    readingTime: number; // in minutes
}

class AIContentAnalyzerService {
    /**
     * Analyze content and extract all metadata
     */
    async analyzeContent(content: string): Promise<ContentAnalysis> {
        const cleanContent = this.cleanContent(content);

        return {
            suggestedTitle: this.generateTitle(cleanContent),
            extractedTags: this.extractTags(cleanContent),
            detectedMood: this.detectMood(cleanContent),
            suggestedChapter: this.suggestChapter(cleanContent),
            keyEntities: this.extractEntities(cleanContent),
            sentiment: this.analyzeSentiment(cleanContent),
            wordCount: this.countWords(cleanContent),
            readingTime: this.calculateReadingTime(cleanContent),
        };
    }

    /**
     * Generate a title from content
     * Uses first sentence or key phrases
     */
    generateTitle(content: string): string {
        if (!content || content.trim().length === 0) {
            return 'Untitled Entry';
        }

        // Remove HTML tags if present
        const textOnly = content.replace(/<[^>]*>/g, '');

        // Get first sentence
        const firstSentence = textOnly.split(/[.!?]/)[0]?.trim();

        if (!firstSentence) {
            return 'Untitled Entry';
        }

        // If first sentence is too long, extract key phrase
        if (firstSentence.length > 60) {
            return this.extractKeyPhrase(firstSentence);
        }

        // Capitalize properly
        return this.capitalizeTitle(firstSentence);
    }

    /**
     * Extract key phrase from long sentence
     */
    private extractKeyPhrase(sentence: string): string {
        // Remove common starting words
        const cleaned = sentence
            .replace(/^(today|yesterday|this morning|this evening|tonight|i|i'm|i am|just|so)\s+/i, '')
            .trim();

        // Take first 50 characters and find last complete word
        if (cleaned.length <= 50) {
            return this.capitalizeTitle(cleaned);
        }

        const truncated = cleaned.substring(0, 50);
        const lastSpace = truncated.lastIndexOf(' ');

        return this.capitalizeTitle(truncated.substring(0, lastSpace)) + '...';
    }

    /**
     * Capitalize title properly
     */
    private capitalizeTitle(text: string): string {
        const words = text.toLowerCase().split(' ');
        const dontCapitalize = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'by', 'in'];

        return words.map((word, index) => {
            // Always capitalize first and last word
            if (index === 0 || index === words.length - 1) {
                return word.charAt(0).toUpperCase() + word.slice(1);
            }

            // Don't capitalize small words
            if (dontCapitalize.includes(word)) {
                return word;
            }

            return word.charAt(0).toUpperCase() + word.slice(1);
        }).join(' ');
    }

    /**
     * Extract tags from content
     */
    extractTags(content: string): string[] {
        const tags = new Set<string>();
        const lowerContent = content.toLowerCase();

        // Topic patterns — specific to student life situations
        const topicPatterns: Record<string, RegExp> = {
            'exam-pressure': /\b(exam|test|quiz|grade|assignment|homework|study|studying|finals|midterm|deadline)\b/gi,
            'burnout': /\b(exhausted|drained|burnt out|burnout|overwhelmed|can'?t keep up|running on empty)\b/gi,
            'self-doubt': /\b(doubt myself|not good enough|imposter|insecure|inadequate|unsure of myself|don'?t belong)\b/gi,
            'procrastination': /\b(procrastinat|putting off|keep delaying|can'?t start|wasted time|distracted)\b/gi,
            'friend-conflict': /\b(fight with|argument with|falling out|conflict with|friend.*upset|upset.*friend|lost a friend)\b/gi,
            'parental-pressure': /\b(parents expect|mom.*disappointed|dad.*disappointed|family.*pressure|pressure from home|they want me to)\b/gi,
            'late-night-grind': /\b(stayed up|up late|all night|midnight|2am|3am|couldn'?t sleep)\b/gi,
            'rejection': /\b(rejected|rejection|didn'?t get in|turned down|didn'?t make it|not selected)\b/gi,
            'breakthrough': /\b(finally got|it clicked|breakthrough|figured out|moment of clarity|realized i can)\b/gi,
            'boundary-set': /\b(said no|set a boundary|stood up for|spoke up|didn'?t let them)\b/gi,
            'gratitude': /\b(grateful|thankful|appreciate|blessed|lucky to have|means a lot)\b/gi,
            'goal-setting': /\b(goal|plan for|working toward|aim to|by next month|want to achieve|commit to)\b/gi,
            'job-hunt': /\b(internship|application|interview|resume|cv|applied for|job search|hiring|career fair)\b/gi,
            'creative-work': /\b(art|design|writing|music|painting|sketch|compose|poem|creative project)\b/gi,
            'health-habits': /\b(workout|gym|exercise|run|yoga|sleep schedule|eating better|mental health routine)\b/gi,
            'homesick': /\b(miss home|homesick|miss my family|far from home|wish i was home)\b/gi,
        };

        // Check each pattern
        for (const [tag, pattern] of Object.entries(topicPatterns)) {
            if (pattern.test(lowerContent)) {
                tags.add(tag);
            }
        }

        // Extract hashtags if present — filter out stopwords and short/generic tokens
        const TAG_STOPWORDS = new Set([
            'a','an','the','to','of','in','on','for','with','at','from','by','as','is','it',
            'this','that','i','you','he','she','we','they','my','your','our','their','me',
            'him','her','us','them','be','been','was','were','am','are','or','but','so',
            'im','ive','id','ill','its','dont','didnt','wont','cant','not','no','yes',
            'has','had','have','do','does','did','will','would','could','should','get','got',
            'one','two','three','also','about','like','want','know','think','make','some',
            'what','when','where','how','which','who','why','here','there','now','more',
            'happy','sad','good','bad','okay','yeah','just','very','really','still',
            'features','node','nodeo','things','thing','work','day','time','today',
        ]);
        const hashtagMatches = content.match(/#(\w+)/g);
        if (hashtagMatches) {
            hashtagMatches.forEach(ht => {
                const tag = ht.substring(1).toLowerCase();
                if (tag.length >= 4 && !TAG_STOPWORDS.has(tag)) {
                    tags.add(tag);
                }
            });
        }

        return Array.from(tags).slice(0, 3); // Limit to 3 key tags
    }

    /**
     * Detect mood from content
     */
    detectMood(content: string): string | null {
        const lowerContent = content.toLowerCase();

        const moodPatterns = {
            happy: {
                keywords: /\b(happy|joyful|excited|great|wonderful|amazing|fantastic|awesome|love|loved|perfect|excellent|thrilled|delighted)\b/gi,
                weight: 0,
            },
            sad: {
                keywords: /\b(sad|depressed|down|unhappy|miserable|terrible|awful|disappointed|heartbroken|lonely|crying|tears)\b/gi,
                weight: 0,
            },
            anxious: {
                keywords: /\b(anxious|worried|nervous|stressed|overwhelmed|panic|fear|scared|afraid|tense|uneasy)\b/gi,
                weight: 0,
            },
            calm: {
                keywords: /\b(calm|peaceful|relaxed|serene|tranquil|content|comfortable|easy|gentle|quiet)\b/gi,
                weight: 0,
            },
            frustrated: {
                keywords: /\b(angry|mad|furious|irritated|frustrated|annoyed|upset|rage|pissed|livid)\b/gi,
                weight: 0,
            },
            grateful: {
                keywords: /\b(grateful|thankful|blessed|appreciative|fortunate)\b/gi,
                weight: 0,
            },
            motivated: {
                keywords: /\b(motivated|inspired|energized|determined|driven|ambitious|focused|productive|accomplished|achieved)\b/gi,
                weight: 0,
            },
            tired: {
                keywords: /\b(tired|exhausted|drained|sleepy|fatigued|weary|worn out|burned out)\b/gi,
                weight: 0,
            },
            thoughtful: {
                keywords: /\b(thinking|wondering|pondering|reflecting|considering|contemplating|realizing|understanding)\b/gi,
                weight: 0,
            },
        };

        // Count matches for each mood
        for (const [mood, data] of Object.entries(moodPatterns)) {
            const matches = lowerContent.match(data.keywords);
            moodPatterns[mood as keyof typeof moodPatterns].weight = matches ? matches.length : 0;
        }

        // Find mood with highest weight
        let maxWeight = 0;
        let detectedMood: string | null = null;

        for (const [mood, data] of Object.entries(moodPatterns)) {
            if (data.weight > maxWeight) {
                maxWeight = data.weight;
                detectedMood = mood;
            }
        }

        return normalizeMood(detectedMood);
    }

    /**
     * Suggest chapter based on content
     */
    suggestChapter(content: string): string | null {
        const lowerContent = content.toLowerCase();

        const chapterPatterns = {
            'Personal': /\b(personal|private|myself|feelings|emotions|thoughts)\b/gi,
            'Work': /\b(work|job|office|professional|career|business)\b/gi,
            'Travel': /\b(travel|trip|vacation|journey|adventure)\b/gi,
            'Health': /\b(health|fitness|exercise|wellness|medical)\b/gi,
            'Relationships': /\b(relationship|family|friends|love|dating)\b/gi,
            'Goals': /\b(goal|goals|plan|planning|achieve|achievement|objective)\b/gi,
            'Gratitude': /\b(grateful|gratitude|thankful|blessed|appreciate)\b/gi,
            'Dreams': /\b(dream|dreams|dreamed|dreaming|nightmare)\b/gi,
        };

        let maxMatches = 0;
        let suggestedChapter: string | null = null;

        for (const [chapter, pattern] of Object.entries(chapterPatterns)) {
            const matches = lowerContent.match(pattern);
            const count = matches ? matches.length : 0;

            if (count > maxMatches) {
                maxMatches = count;
                suggestedChapter = chapter;
            }
        }

        return suggestedChapter;
    }

    /**
     * Extract entities (people, places, activities)
     */
    extractEntities(content: string): {
        people: string[];
        places: string[];
        activities: string[];
    } {
        const people: string[] = [];
        const places: string[] = [];
        const activities: string[] = [];

        // Extract capitalized words (potential names)
        const capitalizedWords = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g) || [];

        // Common place indicators
        const placeIndicators = /\b(at|in|to|from|near|around)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;
        let match;
        while ((match = placeIndicators.exec(content)) !== null) {
            if (match[2]) {
                places.push(match[2]);
            }
        }

        // Common activity patterns
        const activityPatterns = /\b(went|going|did|doing|played|started|finished|completed|attended|visited)\s+([a-z]+(?:\s+[a-z]+)?)\b/gi;
        while ((match = activityPatterns.exec(content)) !== null) {
            if (match[2]) {
                activities.push(match[2]);
            }
        }

        return {
            people: Array.from(new Set(people)).slice(0, 5),
            places: Array.from(new Set(places)).slice(0, 5),
            activities: Array.from(new Set(activities)).slice(0, 5),
        };
    }

    /**
     * Analyze overall sentiment
     */
    analyzeSentiment(content: string): 'positive' | 'negative' | 'neutral' {
        const lowerContent = content.toLowerCase();

        const positiveWords = /\b(good|great|happy|love|wonderful|amazing|fantastic|awesome|excellent|perfect|beautiful|best|better|enjoyed|fun|exciting)\b/gi;
        const negativeWords = /\b(bad|terrible|awful|hate|horrible|worst|worse|sad|angry|frustrated|disappointed|difficult|hard|problem|issue)\b/gi;

        const positiveMatches = lowerContent.match(positiveWords)?.length || 0;
        const negativeMatches = lowerContent.match(negativeWords)?.length || 0;

        if (positiveMatches > negativeMatches + 2) return 'positive';
        if (negativeMatches > positiveMatches + 2) return 'negative';
        return 'neutral';
    }

    /**
     * Count words in content
     */
    countWords(content: string): number {
        const textOnly = content.replace(/<[^>]*>/g, '');
        const words = textOnly.trim().split(/\s+/);
        return words.filter(word => word.length > 0).length;
    }

    /**
     * Calculate reading time
     */
    calculateReadingTime(content: string): number {
        const wordCount = this.countWords(content);
        const wordsPerMinute = 200;
        return Math.ceil(wordCount / wordsPerMinute);
    }

    /**
     * Clean content for analysis
     */
    private cleanContent(content: string): string {
        return content
            .replace(/<[^>]*>/g, '') // Remove HTML
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
    }
}

// Export singleton instance
export const aiContentAnalyzer = new AIContentAnalyzerService();

export default aiContentAnalyzer;
