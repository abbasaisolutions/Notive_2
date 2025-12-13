/**
 * Structured Data Extraction Service
 * Advanced extraction of entities, emotions, and insights from journal content
 * incorporating Social Science and Emotional Intelligence principles.
 */

export interface ExtractedPerson {
    name: string;
    relationship?: 'family' | 'friend' | 'colleague' | 'partner' | 'acquaintance' | 'other';
    context: string;
    sentiment: number; // -1 to 1
}

export interface ExtractedPlace {
    name: string;
    type?: 'home' | 'work' | 'restaurant' | 'outdoor' | 'travel' | 'entertainment' | 'other';
    sentiment: number;
}

export interface ExtractedActivity {
    name: string;
    category: 'health' | 'work' | 'social' | 'hobby' | 'self-care' | 'learning' | 'other';
    duration?: string;
    sentiment: number;
}

export interface ExtractedEmotion {
    emotion: string;
    intensity: number; // 1-10
    trigger?: string;
}

export interface ExtractedGoal {
    goal: string;
    status: 'new' | 'in-progress' | 'achieved' | 'struggling';
    category: 'health' | 'career' | 'personal' | 'relationship' | 'financial' | 'learning';
}

export interface GrowthPoint {
    category: 'personal' | 'professional' | 'relational' | 'spiritual';
    insight: string;
    actionable: boolean;
    type: 'lesson' | 'strength' | 'opportunity' | 'pattern';
}

export interface EmotionalIntelligence {
    selfAwareness: number; // 0-10
    socialAwareness: number; // 0-10
    regulation: number; // 0-10
    dominantTrait: 'empathy' | 'resilience' | 'adaptability' | 'reflection' | 'reactive';
}

export interface ExtractedInsight {
    type: 'gratitude' | 'lesson' | 'challenge' | 'intention' | 'achievement' | 'worry';
    content: string;
}

export interface StructuredEntryData {
    // Content analysis
    title: string;
    summary: string;
    wordCount: number;
    readingTime: number;

    // Emotions
    primaryEmotion: ExtractedEmotion;
    secondaryEmotions: ExtractedEmotion[];
    overallSentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
    sentimentScore: number;

    // Entities
    people: ExtractedPerson[];
    places: ExtractedPlace[];
    activities: ExtractedActivity[];

    // Goals & Growth
    goals: ExtractedGoal[];
    insights: ExtractedInsight[];
    growthPoints: GrowthPoint[];
    emotionalIntelligence: EmotionalIntelligence;

    // Metadata
    suggestedTags: string[];
    suggestedChapter: string | null;
    timeReferences: string[];
    keyPhrases: string[];
}

class StructuredDataService {
    // Enhanced Emotion patterns with intensity weights
    private emotionPatterns = {
        joy: {
            keywords: ['happy', 'joyful', 'excited', 'thrilled', 'delighted', 'ecstatic', 'cheerful', 'content', 'pleased', 'radiant', 'elated'],
            intensity: [7, 8, 8, 9, 8, 10, 7, 6, 6, 9, 10]
        },
        sadness: {
            keywords: ['sad', 'unhappy', 'depressed', 'miserable', 'heartbroken', 'devastated', 'gloomy', 'down', 'melancholy', 'grief'],
            intensity: [6, 6, 8, 8, 9, 10, 6, 5, 7, 10]
        },
        anxiety: {
            keywords: ['anxious', 'worried', 'nervous', 'stressed', 'overwhelmed', 'panicked', 'tense', 'uneasy', 'fearful', 'dread'],
            intensity: [7, 6, 6, 7, 9, 10, 6, 5, 8, 9]
        },
        peace: {
            keywords: ['calm', 'peaceful', 'relaxed', 'serene', 'tranquil', 'content', 'comfortable', 'at ease', 'mindful', 'grounded'],
            intensity: [7, 8, 7, 9, 9, 6, 6, 7, 8, 8]
        },
        anger: {
            keywords: ['angry', 'furious', 'irritated', 'frustrated', 'annoyed', 'livid', 'mad', 'upset', 'rage', 'resentful'],
            intensity: [7, 10, 5, 7, 5, 10, 6, 6, 10, 8]
        },
        drive: {
            keywords: ['motivated', 'inspired', 'driven', 'determined', 'ambitious', 'energized', 'focused', 'productive', 'unstoppable'],
            intensity: [8, 8, 8, 8, 7, 8, 7, 7, 10]
        },
        gratitude: {
            keywords: ['grateful', 'thankful', 'blessed', 'appreciative', 'fortunate', 'lucky', 'humbled', 'moved'],
            intensity: [8, 8, 9, 7, 7, 6, 8, 7]
        },
        exhaustion: {
            keywords: ['tired', 'exhausted', 'drained', 'fatigued', 'burned out', 'weary', 'sleepy', 'lethargic'],
            intensity: [5, 9, 8, 7, 9, 7, 4, 6]
        },
        hope: {
            keywords: ['hopeful', 'optimistic', 'positive', 'confident', 'encouraged', 'expectant', 'looking forward'],
            intensity: [7, 8, 6, 7, 7, 7, 7]
        },
        loneliness: {
            keywords: ['lonely', 'isolated', 'alone', 'disconnected', 'abandoned', 'forgotten', 'invisible'],
            intensity: [7, 8, 5, 7, 9, 8, 8]
        },
        confusion: {
            keywords: ['confused', 'lost', 'uncertain', 'unsure', 'perplexed', 'conflicted', 'torn'],
            intensity: [6, 8, 7, 6, 7, 8, 8]
        }
    };

    // Relationship indicators
    private relationshipPatterns = {
        family: /\b(mom|mother|dad|father|sister|brother|parents|grandma|grandpa|aunt|uncle|cousin|family|son|daughter|wife|husband)\b/i,
        friend: /\b(friend|bestie|buddy|pal|mate|bff)\b/i,
        colleague: /\b(colleague|coworker|boss|manager|team|client|partner at work)\b/i,
        partner: /\b(boyfriend|girlfriend|partner|spouse|fiancé|fiancee|significant other|love of my life)\b/i,
    };

    // Place type patterns
    private placePatterns = {
        home: /\b(home|house|apartment|bedroom|living room|kitchen)\b/i,
        work: /\b(office|work|workplace|desk|meeting room|conference)\b/i,
        restaurant: /\b(restaurant|cafe|coffee shop|bar|diner|bistro|eatery)\b/i,
        outdoor: /\b(park|beach|mountain|trail|garden|forest|lake|river|nature)\b/i,
        travel: /\b(airport|hotel|flight|vacation|trip|destination|abroad)\b/i,
        entertainment: /\b(movie|theater|concert|museum|gallery|stadium|gym)\b/i,
    };

    // Activity patterns
    private activityPatterns = {
        health: /\b(exercise|workout|run|running|gym|yoga|meditation|walk|walking|swim|cycling|hiking)\b/i,
        work: /\b(meeting|presentation|project|deadline|email|call|conference|work)\b/i,
        social: /\b(dinner|lunch|party|gathering|hangout|catch up|visited|met)\b/i,
        hobby: /\b(reading|writing|painting|drawing|photography|music|gaming|cooking|baking)\b/i,
        'self-care': /\b(spa|massage|bath|relaxing|sleep|rest|nap|skincare)\b/i,
        learning: /\b(studying|learning|course|class|book|lesson|tutorial|practice)\b/i,
    };

    // Growth & EQ Patterns
    private growthPatterns = {
        lesson: [
            /(?:learned|realized|discovered|found out|understood) that (.+?)(?:[.!?]|$)/i,
            /(?:takeaway|lesson) is (.+?)(?:[.!?]|$)/i,
            /taught me (.+?)(?:[.!?]|$)/i
        ],
        strength: [
            /(?:proud of|pleased with) (?:myself for|how i) (.+?)(?:[.!?]|$)/i,
            /(?:managed to|succeeded in|overcame) (.+?)(?:[.!?]|$)/i,
            /(?:strength|resilience|courage) to (.+?)(?:[.!?]|$)/i
        ],
        opportunity: [
            /(?:need to|should|could) (?:improve|work on|change|adjust) (.+?)(?:[.!?]|$)/i,
            /(?:opportunity|chance) to (.+?)(?:[.!?]|$)/i,
            /(?:next time|in the future) i (?:will|want to) (.+?)(?:[.!?]|$)/i
        ],
        pattern: [
            /(?:always|often|tend to|usually|pattern of) (.+?)(?:[.!?]|$)/i,
            /(?:keep|continually) (?:doing|feeling|thinking) (.+?)(?:[.!?]|$)/i
        ]
    };

    // Expanded Sentiment Dictionaries
    private positiveWords = new Set([
        'good', 'great', 'happy', 'love', 'wonderful', 'amazing', 'fantastic', 'awesome', 'excellent', 'perfect',
        'beautiful', 'best', 'better', 'enjoyed', 'fun', 'exciting', 'grateful', 'blessed', 'thankful', 'peaceful',
        'calm', 'serene', 'content', 'joy', 'hope', 'proud', 'achieved', 'success', 'triumph', 'progress'
    ]);

    private negativeWords = new Set([
        'bad', 'terrible', 'awful', 'hate', 'horrible', 'worst', 'worse', 'sad', 'angry', 'frustrated',
        'disappointed', 'difficult', 'hard', 'problem', 'issue', 'worried', 'stressed', 'anxious', 'pain',
        'grief', 'loss', 'fail', 'failure', 'stuck', 'hurt', 'upset', 'annoyed', 'lonely', 'afraid'
    ]);

    private negators = new Set(['not', 'never', 'no', "don't", "didn't", "won't", "can't", "cannot"]);

    /**
     * Extract all structured data from content
     */
    async extractStructuredData(content: string): Promise<StructuredEntryData> {
        const cleanContent = this.cleanContent(content);

        // Extract all components
        const emotions = this.extractEmotions(cleanContent);
        const people = this.extractPeople(cleanContent);
        const places = this.extractPlaces(cleanContent);
        const activities = this.extractActivities(cleanContent);
        const goals = this.extractGoals(cleanContent);
        const insights = this.extractInsights(cleanContent);
        const sentiment = this.analyzeSentiment(cleanContent);
        const growthPoints = this.analyzeGrowth(cleanContent);
        const emotionalIntelligence = this.analyzeEmotionalIntelligence(cleanContent);

        return {
            title: this.generateTitle(cleanContent),
            summary: this.generateSummary(cleanContent),
            wordCount: this.countWords(cleanContent),
            readingTime: Math.ceil(this.countWords(cleanContent) / 200),

            primaryEmotion: emotions[0] || { emotion: 'neutral', intensity: 5 },
            secondaryEmotions: emotions.slice(1),
            overallSentiment: sentiment.type,
            sentimentScore: sentiment.score,

            people,
            places,
            activities,
            goals,
            insights,
            growthPoints,
            emotionalIntelligence,

            suggestedTags: this.extractTags(cleanContent, growthPoints),
            suggestedChapter: this.suggestChapter(cleanContent),
            timeReferences: this.extractTimeReferences(cleanContent),
            keyPhrases: this.extractKeyPhrases(cleanContent),
        };
    }

    /**
     * Extract emotions with enhanced intensity
     */
    private extractEmotions(content: string): ExtractedEmotion[] {
        const emotions: ExtractedEmotion[] = [];
        const lowerContent = content.toLowerCase();

        for (const [emotion, data] of Object.entries(this.emotionPatterns)) {
            for (let i = 0; i < data.keywords.length; i++) {
                const keyword = data.keywords[i];
                const regex = new RegExp(`\\b${keyword}\\b`, 'gi');

                if (regex.test(lowerContent)) {
                    // Check for negators (e.g., "not happy")
                    const contextStart = Math.max(0, lowerContent.indexOf(keyword) - 20);
                    const context = lowerContent.substring(contextStart, lowerContent.indexOf(keyword));
                    const isNegated = Array.from(this.negators).some(neg => context.includes(neg));

                    if (isNegated) continue;

                    // Find trigger context
                    const triggerMatch = content.match(new RegExp(`.{0,50}${keyword}.{0,50}`, 'i'));

                    emotions.push({
                        emotion,
                        intensity: data.intensity[i],
                        trigger: triggerMatch ? triggerMatch[0].trim() : undefined,
                    });

                    // Allow multiple matches if they are distinct
                    // but limit to one per category to avoid spam
                    break;
                }
            }
        }

        // Sort by intensity
        return emotions.sort((a, b) => b.intensity - a.intensity);
    }

    /**
     * Analyze Growth Points (Lessons, Patterns, Opportunities)
     */
    private analyzeGrowth(content: string): GrowthPoint[] {
        const points: GrowthPoint[] = [];

        // Check for specific growth patterns
        for (const [type, patterns] of Object.entries(this.growthPatterns)) {
            for (const pattern of patterns) {
                let match;
                const regex = new RegExp(pattern, 'gi');
                while ((match = regex.exec(content)) !== null) {
                    const insight = match[1].trim();

                    // Categorize based on keywords in insight
                    let category: GrowthPoint['category'] = 'personal';
                    if (/\b(work|job|career|boss|colleague|project)\b/i.test(insight)) category = 'professional';
                    else if (/\b(friend|partner|spouse|family|relationship|love)\b/i.test(insight)) category = 'relational';
                    else if (/\b(god|universe|spirit|soul|faith)\b/i.test(insight)) category = 'spiritual';

                    points.push({
                        category,
                        insight,
                        actionable: /\b(will|going to|plan|need to)\b/i.test(insight),
                        type: type as GrowthPoint['type']
                    });
                }
            }
        }

        return points.slice(0, 5);
    }

    /**
     * Analyze Emotional Intelligence Metrics
     */
    private analyzeEmotionalIntelligence(content: string): EmotionalIntelligence {
        const lowerContent = content.toLowerCase();

        // Self Awareness: "I feel", "I noticed", "I realized"
        const selfTokens = (content.match(/\b(i (feel|felt|noticed|realized|thought|wondered))\b/gi) || []).length;
        const selfAwareness = Math.min(10, selfTokens * 2);

        // Social Awareness: "They felt", "Understood them", "Empathy"
        const socialTokens = (content.match(/\b(they (felt|thought)|understood (him|her|them)|empath|perspective)\b/gi) || []).length;
        const socialAwareness = Math.min(10, socialTokens * 2.5);

        // Regulation: "calmed down", "decided to", "chose to", "breathed"
        const regulationTokens = (content.match(/\b(calm|breathe|decide|choose|control|pause|reflect)\b/gi) || []).length;
        const regulation = Math.min(10, regulationTokens * 2);

        // Determine dominant trait
        let dominantTrait: EmotionalIntelligence['dominantTrait'] = 'reflection';
        if (socialAwareness > selfAwareness && socialAwareness > regulation) dominantTrait = 'empathy';
        else if (regulation > selfAwareness && regulation > socialAwareness) dominantTrait = 'adaptability';
        else if (content.match(/\b(overcame|kept going|strong)\b/i)) dominantTrait = 'resilience';
        else if (content.match(/\b(angry|upset|hate|furious)\b/i) && regulation < 3) dominantTrait = 'reactive';

        return {
            selfAwareness,
            socialAwareness,
            regulation,
            dominantTrait
        };
    }

    /**
     * Analyze overall sentiment with negation handling
     */
    private analyzeSentiment(content: string): { type: StructuredEntryData['overallSentiment']; score: number } {
        const words = content.toLowerCase().split(/\s+/);
        let score = 0;
        let wordCount = 0;

        for (let i = 0; i < words.length; i++) {
            const word = words[i].replace(/[.,!?]/g, '');

            // Check previous word for negation
            const prevWord = i > 0 ? words[i - 1].replace(/[.,!?]/g, '') : '';
            const isNegated = this.negators.has(prevWord);
            const multiplier = isNegated ? -1 : 1;

            if (this.positiveWords.has(word)) {
                score += 1 * multiplier;
                wordCount++;
            } else if (this.negativeWords.has(word)) {
                score -= 1 * multiplier;
                wordCount++;
            }
        }

        const normalizedScore = wordCount > 0 ? score / wordCount : 0;

        if (Math.abs(normalizedScore) < 0.1) { // Stricter neutral threshold
            // Check for mixed signals
            const hasPos = words.some(w => this.positiveWords.has(w));
            const hasNeg = words.some(w => this.negativeWords.has(w));
            if (hasPos && hasNeg) return { type: 'mixed', score: normalizedScore };
            return { type: 'neutral', score: normalizedScore };
        }

        return { type: normalizedScore > 0 ? 'positive' : 'negative', score: normalizedScore };
    }

    /**
     * Calculate sentiment for specific context
     */
    private calculateContextSentiment(context: string): number {
        const positive = (context.match(/\b(good|great|happy|love|wonderful|amazing)\b/gi) || []).length;
        const negative = (context.match(/\b(bad|terrible|hate|horrible|awful|sad)\b/gi) || []).length;

        if (positive === 0 && negative === 0) return 0;
        return (positive - negative) / (positive + negative);
    }

    /**
     * Extract people mentions with relationship detection
     */
    private extractPeople(content: string): ExtractedPerson[] {
        const people: ExtractedPerson[] = [];

        // Extract names (capitalized words that aren't at sentence start)
        const namePattern = /(?<=[a-z]\s)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g;
        const matches = content.match(namePattern) || [];

        // Common words to exclude
        const excludeWords = new Set(['I', 'The', 'This', 'That', 'It', 'Monday', 'Tuesday', 'Wednesday',
            'Thursday', 'Friday', 'Saturday', 'Sunday', 'January', 'February', 'March', 'April',
            'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']);

        for (const name of matches) {
            if (excludeWords.has(name)) continue;

            // Find context around name
            const contextMatch = content.match(new RegExp(`.{0,100}${name}.{0,100}`, 'i'));
            const context = contextMatch ? contextMatch[0] : '';

            // Determine relationship
            let relationship: ExtractedPerson['relationship'] = 'other';
            for (const [rel, pattern] of Object.entries(this.relationshipPatterns)) {
                if (pattern.test(context)) {
                    relationship = rel as ExtractedPerson['relationship'];
                    break;
                }
            }

            // Calculate sentiment in context
            const sentiment = this.calculateContextSentiment(context);

            people.push({
                name,
                relationship,
                context: context.substring(0, 100),
                sentiment,
            });
        }

        // Deduplicate by name
        const uniquePeople = Array.from(new Map(people.map(p => [p.name, p])).values());
        return uniquePeople.slice(0, 10);
    }

    /**
     * Extract places with type detection
     */
    private extractPlaces(content: string): ExtractedPlace[] {
        const places: ExtractedPlace[] = [];

        // Pattern for "at/in/to [Place]"
        const placePattern = /\b(?:at|in|to|from|near)\s+(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g;
        let match;

        while ((match = placePattern.exec(content)) !== null) {
            const name = match[1];

            // Find context
            const contextMatch = content.match(new RegExp(`.{0,50}${name}.{0,50}`, 'i'));
            const context = contextMatch ? contextMatch[0] : '';

            // Determine place type
            let type: ExtractedPlace['type'] = 'other';
            for (const [placeType, pattern] of Object.entries(this.placePatterns)) {
                if (pattern.test(context) || pattern.test(name)) {
                    type = placeType as ExtractedPlace['type'];
                    break;
                }
            }

            places.push({
                name,
                type,
                sentiment: this.calculateContextSentiment(context),
            });
        }

        return Array.from(new Map(places.map(p => [p.name, p])).values()).slice(0, 10);
    }

    /**
     * Extract activities with categorization
     */
    private extractActivities(content: string): ExtractedActivity[] {
        const activities: ExtractedActivity[] = [];
        const lowerContent = content.toLowerCase();

        for (const [category, pattern] of Object.entries(this.activityPatterns)) {
            const matches = lowerContent.match(pattern);
            if (matches) {
                for (const match of matches) {
                    // Find duration if mentioned
                    const durationMatch = content.match(new RegExp(`${match}[^.]*?(\\d+\\s*(?:hour|minute|min|hr)s?)`, 'i'));

                    // Find context for sentiment
                    const contextMatch = content.match(new RegExp(`.{0,50}${match}.{0,50}`, 'i'));
                    const context = contextMatch ? contextMatch[0] : '';

                    activities.push({
                        name: match,
                        category: category as ExtractedActivity['category'],
                        duration: durationMatch ? durationMatch[1] : undefined,
                        sentiment: this.calculateContextSentiment(context),
                    });
                }
            }
        }

        return Array.from(new Map(activities.map(a => [a.name, a])).values()).slice(0, 10);
    }

    /**
     * Extract goals and progress
     */
    private extractGoals(content: string): ExtractedGoal[] {
        const goals: ExtractedGoal[] = [];
        const lowerContent = content.toLowerCase();

        // Goal patterns
        const goalPatterns = [
            { pattern: /i want to ([^.!?]+)/gi, status: 'new' as const },
            { pattern: /my goal is to ([^.!?]+)/gi, status: 'new' as const },
            { pattern: /i'm working on ([^.!?]+)/gi, status: 'in-progress' as const },
            { pattern: /i achieved ([^.!?]+)/gi, status: 'achieved' as const },
            { pattern: /i finally ([^.!?]+)/gi, status: 'achieved' as const },
            { pattern: /struggling with ([^.!?]+)/gi, status: 'struggling' as const },
            { pattern: /need to improve ([^.!?]+)/gi, status: 'struggling' as const },
        ];

        for (const { pattern, status } of goalPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const goalText = match[1].trim();

                // Categorize goal
                let category: ExtractedGoal['category'] = 'personal';
                if (/\b(health|fitness|exercise|weight|diet)\b/i.test(goalText)) category = 'health';
                else if (/\b(work|career|job|promotion|business)\b/i.test(goalText)) category = 'career';
                else if (/\b(relationship|family|friend|social)\b/i.test(goalText)) category = 'relationship';
                else if (/\b(money|finance|save|invest|budget)\b/i.test(goalText)) category = 'financial';
                else if (/\b(learn|study|skill|course|education)\b/i.test(goalText)) category = 'learning';

                goals.push({ goal: goalText, status, category });
            }
        }

        return goals.slice(0, 5);
    }

    /**
     * Extract insights (gratitude, lessons, challenges, intentions)
     */
    private extractInsights(content: string): ExtractedInsight[] {
        const insights: ExtractedInsight[] = [];

        const insightPatterns: { pattern: RegExp; type: ExtractedInsight['type'] }[] = [
            { pattern: /(?:grateful for|thankful for|blessed to have|appreciate) ([^.!?]+)/gi, type: 'gratitude' },
            { pattern: /(?:learned that|realized that|understood that) ([^.!?]+)/gi, type: 'lesson' },
            { pattern: /(?:challenge was|struggled with|difficult to|hard to) ([^.!?]+)/gi, type: 'challenge' },
            { pattern: /(?:tomorrow i will|going to|plan to|intend to) ([^.!?]+)/gi, type: 'intention' },
            { pattern: /(?:achieved|accomplished|managed to|succeeded in) ([^.!?]+)/gi, type: 'achievement' },
            { pattern: /(?:worried about|concerned about|anxious about) ([^.!?]+)/gi, type: 'worry' },
        ];

        for (const { pattern, type } of insightPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                insights.push({
                    type,
                    content: match[1].trim(),
                });
            }
        }

        return insights;
    }

    /**
     * Extract tags
     */
    private extractTags(content: string, growthPoints?: GrowthPoint[]): string[] {
        const tags = new Set<string>();
        const lowerContent = content.toLowerCase();

        const tagPatterns = {
            work: /\b(work|job|office|meeting|project|deadline)\b/i,
            family: /\b(family|mom|dad|mother|father|sister|brother)\b/i,
            health: /\b(health|exercise|workout|gym|yoga|meditation)\b/i,
            travel: /\b(travel|trip|vacation|journey|adventure)\b/i,
            creativity: /\b(creative|art|writing|music|painting)\b/i,
            learning: /\b(learn|study|course|book|reading)\b/i,
            social: /\b(friend|friends|party|gathering|dinner)\b/i,
            reflection: /\b(reflect|thinking|realized|grateful|thankful)\b/i,
            goals: /\b(goal|goals|achieve|plan|future)\b/i,
            nature: /\b(nature|outdoor|park|beach|mountain|hiking)\b/i,
        };

        for (const [tag, pattern] of Object.entries(tagPatterns)) {
            if (pattern.test(lowerContent)) {
                tags.add(tag);
            }
        }

        // Add growth tags
        if (growthPoints) {
            if (growthPoints.some(g => g.category === 'professional')) tags.add('professional-growth');
            if (growthPoints.some(g => g.category === 'personal')) tags.add('personal-growth');
        }

        return Array.from(tags).slice(0, 5);
    }

    /**
     * Suggest chapter based on content
     */
    private suggestChapter(content: string): string | null {
        const lowerContent = content.toLowerCase();

        const chapterPatterns = {
            'Personal': /\b(personal|private|myself|feeling|thought)\b/i,
            'Work': /\b(work|job|career|professional|office)\b/i,
            'Travel': /\b(travel|trip|vacation|adventure|explore)\b/i,
            'Health': /\b(health|fitness|exercise|wellness)\b/i,
            'Relationships': /\b(relationship|family|friend|love)\b/i,
            'Gratitude': /\b(grateful|thankful|blessed|appreciate)\b/i,
            'Goals': /\b(goal|plan|achieve|future|dream)\b/i,
            'Learning': /\b(learn|study|skill|knowledge)\b/i,
        };

        let maxScore = 0;
        let suggested: string | null = null;

        for (const [chapter, pattern] of Object.entries(chapterPatterns)) {
            const matches = lowerContent.match(new RegExp(pattern.source, 'gi'));
            const score = matches ? matches.length : 0;

            if (score > maxScore) {
                maxScore = score;
                suggested = chapter;
            }
        }

        return suggested;
    }

    /**
     * Generate title from content
     */
    private generateTitle(content: string): string {
        const firstSentence = content.split(/[.!?]/)[0]?.trim();
        if (!firstSentence) return 'Untitled Entry';

        if (firstSentence.length > 60) {
            const words = firstSentence.split(' ').slice(0, 8).join(' ');
            return this.capitalizeTitle(words) + '...';
        }

        return this.capitalizeTitle(firstSentence);
    }

    /**
     * Generate summary from content
     */
    private generateSummary(content: string): string {
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
        if (sentences.length <= 2) return content.substring(0, 200);

        // Take first and last sentence for summary
        const first = sentences[0].trim();
        const last = sentences[sentences.length - 1].trim();

        return `${first}. ... ${last}.`.substring(0, 300);
    }

    /**
     * Extract time references
     */
    private extractTimeReferences(content: string): string[] {
        const refs: string[] = [];

        const timePatterns = [
            /\b(today|yesterday|tomorrow|this morning|this evening|tonight|this week|last week|next week)\b/gi,
            /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
            /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/gi,
            /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?\b/gi,
        ];

        for (const pattern of timePatterns) {
            const matches = content.match(pattern);
            if (matches) refs.push(...matches);
        }

        return Array.from(new Set(refs.map(r => r.toLowerCase())));
    }

    /**
     * Extract key phrases
     */
    private extractKeyPhrases(content: string): string[] {
        // Extract phrases between punctuation that are moderately long
        const phrases = content.split(/[.!?,;]+/)
            .map(p => p.trim())
            .filter(p => p.length > 20 && p.length < 100);

        return phrases.slice(0, 5);
    }

    private capitalizeTitle(text: string): string {
        return text.split(' ').map((word, i) => {
            if (i === 0) return word.charAt(0).toUpperCase() + word.slice(1);
            if (['a', 'an', 'the', 'and', 'or', 'but'].includes(word.toLowerCase())) return word;
            return word.charAt(0).toUpperCase() + word.slice(1);
        }).join(' ');
    }

    private countWords(content: string): number {
        return content.split(/\s+/).filter(w => w.length > 0).length;
    }

    private cleanContent(content: string): string {
        return content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }
}

export const structuredDataService = new StructuredDataService();
export default structuredDataService;
