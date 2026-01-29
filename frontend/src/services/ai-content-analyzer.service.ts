/**
 * AI Content Analyzer Service
 * Automatically extracts metadata from journal entry content
 */

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

        // Topic patterns
        const topicPatterns = {
            work: /\b(work|job|office|meeting|project|deadline|colleague|boss|client|presentation|conference)\b/gi,
            family: /\b(family|mom|dad|mother|father|sister|brother|parents|kids|children|son|daughter|grandma|grandpa)\b/gi,
            friends: /\b(friend|friends|buddy|pal|bestie|hang out|catch up)\b/gi,
            health: /\b(health|exercise|workout|gym|run|running|yoga|meditation|diet|fitness|doctor|hospital)\b/gi,
            travel: /\b(travel|trip|vacation|journey|flight|hotel|airport|destination|explore|adventure)\b/gi,
            food: /\b(food|meal|dinner|lunch|breakfast|restaurant|cooking|recipe|eat|ate|delicious)\b/gi,
            hobby: /\b(hobby|hobbies|reading|music|art|photography|painting|drawing|gaming|gardening)\b/gi,
            learning: /\b(learn|learning|study|studying|course|class|book|reading|education|school|university)\b/gi,
            relationship: /\b(relationship|dating|love|partner|boyfriend|girlfriend|spouse|marriage|anniversary)\b/gi,
            career: /\b(career|promotion|interview|resume|job search|networking|professional)\b/gi,
            finance: /\b(money|budget|savings|investment|expense|financial|bank|purchase|bought)\b/gi,
            creativity: /\b(creative|creativity|write|writing|create|creating|design|idea|inspiration)\b/gi,
            nature: /\b(nature|outdoors|hiking|camping|beach|mountain|forest|park|garden)\b/gi,
            technology: /\b(tech|technology|computer|software|app|coding|programming|digital)\b/gi,
            mindfulness: /\b(mindful|mindfulness|meditation|reflection|gratitude|peaceful|calm)\b/gi,
        };

        // Check each pattern
        for (const [tag, pattern] of Object.entries(topicPatterns)) {
            if (pattern.test(lowerContent)) {
                tags.add(tag);
            }
        }

        // Extract hashtags if present
        const hashtagMatches = content.match(/#(\w+)/g);
        if (hashtagMatches) {
            hashtagMatches.forEach(tag => {
                tags.add(tag.substring(1).toLowerCase());
            });
        }

        return Array.from(tags).slice(0, 12); // Limit to 12 tags
    }

    /**
     * Detect mood from content with enhanced pattern matching
     */
    detectMood(content: string): string | null {
        const lowerContent = content.toLowerCase();

        const moodPatterns = {
            happy: {
                keywords: /\b(happy|joyful|excited|great|wonderful|amazing|fantastic|awesome|love|loved|perfect|excellent|thrilled|delighted|ecstatic|cheerful|elated|gleeful|pleased|satisfied|beaming|overjoyed|blissful|euphoric)\b/gi,
                weight: 0,
                priority: 1,
            },
            sad: {
                keywords: /\b(sad|depressed|down|unhappy|miserable|terrible|awful|disappointed|heartbroken|lonely|crying|tears|sorrowful|grief|grieving|mourning|despair|despairing|hopeless|dejected|disheartened|gloomy|melancholy|somber|blue)\b/gi,
                weight: 0,
                priority: 1,
            },
            anxious: {
                keywords: /\b(anxious|worried|nervous|stressed|overwhelmed|panic|fear|scared|afraid|tense|uneasy|apprehensive|dreading|dread|on edge|restless|unsettled|frantic|jittery|edgy|agitated|fretful|alarmed|concerned)\b/gi,
                weight: 0,
                priority: 1,
            },
            calm: {
                keywords: /\b(calm|peaceful|relaxed|serene|tranquil|content|comfortable|easy|gentle|quiet|at ease|at peace|soothing|mellow|composed|collected|untroubled|placid|restful|centered|grounded|zen|mindful)\b/gi,
                weight: 0,
                priority: 2,
            },
            frustrated: {
                keywords: /\b(angry|mad|furious|irritated|frustrated|annoyed|upset|rage|pissed|livid|enraged|fuming|irate|aggravated|exasperated|infuriated|resentful|bitter|hostile|seething)\b/gi,
                weight: 0,
                priority: 1,
            },
            motivated: {
                keywords: /\b(motivated|inspired|energized|determined|driven|ambitious|focused|productive|accomplished|achieved|empowered|unstoppable|pumped|fired up|passionate|eager|enthusiastic|zealous|ready|confident)\b/gi,
                weight: 0,
                priority: 2,
            },
            tired: {
                keywords: /\b(tired|exhausted|drained|sleepy|fatigued|weary|worn out|burned out|depleted|spent|lethargic|sluggish|drowsy|wiped out|beat|run down|knackered|bushed|zonked)\b/gi,
                weight: 0,
                priority: 1,
            },
            thoughtful: {
                keywords: /\b(thinking|wondering|pondering|reflecting|considering|contemplating|realizing|understanding|introspective|meditative|pensive|musing|ruminating|analyzing|processing|deep in thought)\b/gi,
                weight: 0,
                priority: 3,
            },
            grateful: {
                keywords: /\b(grateful|thankful|blessed|appreciative|fortunate|lucky|humble|touched|moved|indebted|appreciating|counting blessings|heartwarmed)\b/gi,
                weight: 0,
                priority: 2,
            },
        };

        // Count matches for each mood with increased sensitivity
        for (const [mood, data] of Object.entries(moodPatterns)) {
            const matches = lowerContent.match(data.keywords);
            moodPatterns[mood as keyof typeof moodPatterns].weight = matches ? matches.length : 0;
        }

        // Find mood with highest weight (considering priority for tie-breaking)
        let maxWeight = 0;
        let detectedMood: string | null = null;
        let minPriority = 999;

        for (const [mood, data] of Object.entries(moodPatterns)) {
            if (data.weight > maxWeight || (data.weight === maxWeight && data.weight > 0 && data.priority < minPriority)) {
                maxWeight = data.weight;
                detectedMood = mood;
                minPriority = data.priority;
            }
        }

        // Fallback: analyze overall sentiment if no specific mood detected
        if (!detectedMood && content.length > 20) {
            const positiveMatches = (lowerContent.match(/\b(good|nice|well|better|enjoyed|fun|like|liked|positive|fine|okay|ok|pleasant)\b/gi) || []).length;
            const negativeMatches = (lowerContent.match(/\b(bad|wrong|hard|difficult|struggle|problem|issue|pain|hurt|tough|rough|sucks)\b/gi) || []).length;
            
            if (positiveMatches > negativeMatches && positiveMatches >= 2) {
                detectedMood = 'calm';
            } else if (negativeMatches > positiveMatches && negativeMatches >= 2) {
                detectedMood = 'thoughtful';
            }
        }

        return detectedMood;
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
