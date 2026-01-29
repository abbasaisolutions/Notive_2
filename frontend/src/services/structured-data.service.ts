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
    category: 'personal' | 'professional' | 'relational' | 'spiritual' | 'intellectual' | 'creative' | 'emotional' | 'health';
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
     * Extract emotions with enhanced intensity and better detection
     */
    private extractEmotions(content: string): ExtractedEmotion[] {
        const emotions: ExtractedEmotion[] = [];
        const lowerContent = content.toLowerCase();
        const words = lowerContent.split(/\s+/);

        // Track which emotions we've found
        const foundEmotions = new Set<string>();

        for (const [emotion, data] of Object.entries(this.emotionPatterns)) {
            let totalIntensity = 0;
            let matchCount = 0;
            let bestTrigger: string | undefined;

            for (let i = 0; i < data.keywords.length; i++) {
                const keyword = data.keywords[i];
                const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                const matches = lowerContent.match(regex);

                if (matches && matches.length > 0) {
                    // Check for negators (e.g., "not happy")
                    const keywordIndex = lowerContent.indexOf(keyword.toLowerCase());
                    const contextStart = Math.max(0, keywordIndex - 20);
                    const context = lowerContent.substring(contextStart, keywordIndex);
                    const isNegated = Array.from(this.negators).some(neg => context.includes(neg));

                    if (isNegated) continue;

                    matchCount += matches.length;
                    totalIntensity += data.intensity[i] * matches.length;

                    // Find trigger context for the first match
                    if (!bestTrigger) {
                        const triggerMatch = content.match(new RegExp(`.{0,50}${keyword}.{0,50}`, 'i'));
                        bestTrigger = triggerMatch ? triggerMatch[0].trim() : undefined;
                    }
                }
            }

            if (matchCount > 0) {
                // Calculate average intensity, boosted by multiple mentions
                const avgIntensity = Math.min(10, Math.round((totalIntensity / matchCount) + Math.min(2, matchCount - 1)));
                
                emotions.push({
                    emotion,
                    intensity: avgIntensity,
                    trigger: bestTrigger,
                });
                foundEmotions.add(emotion);
            }
        }

        // Contextual emotion detection for indirect emotional expressions
        if (!foundEmotions.has('joy') && !foundEmotions.has('gratitude')) {
            if (/\b(can't wait|looking forward|so excited|best day|made my day|love this)\b/i.test(content)) {
                emotions.push({ emotion: 'joy', intensity: 7, trigger: 'Positive anticipation or experience' });
            }
        }
        
        if (!foundEmotions.has('sadness') && !foundEmotions.has('loneliness')) {
            if (/\b(miss (him|her|them|you)|wish (I|things) (could|were)|if only)\b/i.test(content)) {
                emotions.push({ emotion: 'sadness', intensity: 6, trigger: 'Longing or regret' });
            }
        }

        if (!foundEmotions.has('anxiety')) {
            if (/\b(what if|can't stop thinking|keeps me up|on my mind|couldn't sleep)\b/i.test(content)) {
                emotions.push({ emotion: 'anxiety', intensity: 6, trigger: 'Persistent thoughts or worry' });
            }
        }

        if (!foundEmotions.has('drive') && !foundEmotions.has('hope')) {
            if (/\b(going to|will achieve|determined to|I will|ready to|committed to)\b/i.test(content)) {
                emotions.push({ emotion: 'drive', intensity: 6, trigger: 'Commitment or determination' });
            }
        }

        if (!foundEmotions.has('peace')) {
            if (/\b(at peace|letting go|accepting|it's okay|okay with|made peace)\b/i.test(content)) {
                emotions.push({ emotion: 'peace', intensity: 7, trigger: 'Acceptance' });
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

                    // Enhanced categorization with more categories
                    let category: GrowthPoint['category'] = 'personal';
                    if (/\b(work|job|career|boss|colleague|project|office|business|professional|company|client)\b/i.test(insight)) {
                        category = 'professional';
                    } else if (/\b(friend|partner|spouse|family|relationship|love|dating|marriage|social|people)\b/i.test(insight)) {
                        category = 'relational';
                    } else if (/\b(god|universe|spirit|soul|faith|pray|church|meditat|mindful|purpose|meaning)\b/i.test(insight)) {
                        category = 'spiritual';
                    } else if (/\b(learn|knowledge|understand|study|read|course|skill|education|curious|discover)\b/i.test(insight)) {
                        category = 'intellectual';
                    } else if (/\b(creat|art|writ|music|design|paint|draw|imagination|innovate|express|craft)\b/i.test(insight)) {
                        category = 'creative';
                    } else if (/\b(feel|emotion|mood|mental|anxiety|stress|cope|therapy|heal|process)\b/i.test(insight)) {
                        category = 'emotional';
                    } else if (/\b(health|fitness|exercise|diet|sleep|energy|body|workout|nutrition|wellness)\b/i.test(insight)) {
                        category = 'health';
                    }

                    points.push({
                        category,
                        insight,
                        actionable: /\b(will|going to|plan|need to|want to|should|must|have to)\b/i.test(insight),
                        type: type as GrowthPoint['type']
                    });
                }
            }
        }

        return points.slice(0, 8);
    }

    /**
     * Analyze Emotional Intelligence Metrics
     */
    private analyzeEmotionalIntelligence(content: string): EmotionalIntelligence {
        const lowerContent = content.toLowerCase();
        const words = lowerContent.split(/\s+/);
        const wordCount = words.length;

        // Self Awareness: "I feel", "I noticed", "I realized", "my emotions", first-person emotional statements
        const selfAwarenessPatterns = [
            /\bi (feel|felt|am feeling|was feeling)\b/gi,
            /\bi (noticed|realized|recognized|understood|became aware)\b/gi,
            /\bi (thought|think|wondered|pondered)\b/gi,
            /\bmy (emotions?|feelings?|mood|state of mind)\b/gi,
            /\bi (am|was|'m) (happy|sad|anxious|excited|worried|grateful|frustrated|calm|stressed)\b/gi,
            /\bself-reflect|introspect|awareness\b/gi,
            /\bi (know|knew) (myself|that i|how i)\b/gi,
            /\bwhen i (feel|felt)\b/gi,
            /\bi can (sense|tell|see) that i\b/gi,
            /\bmy (inner|emotional|mental)\b/gi,
        ];
        
        let selfScore = 0;
        for (const pattern of selfAwarenessPatterns) {
            const matches = content.match(pattern) || [];
            selfScore += matches.length * 1.5;
        }
        // Bonus for emotional vocabulary richness
        const emotionWords = content.match(/\b(happy|sad|anxious|excited|worried|grateful|frustrated|calm|stressed|peaceful|angry|hopeful|scared|confident|uncertain|proud|ashamed|content|disappointed|joyful|melancholy)\b/gi) || [];
        const uniqueEmotions = new Set(emotionWords.map(w => w.toLowerCase())).size;
        selfScore += uniqueEmotions * 0.8;
        
        // Scale based on content length (longer entries naturally have more)
        const selfAwareness = Math.min(10, Math.round((selfScore / Math.max(1, wordCount / 50)) * 2.5));

        // Social Awareness: references to others' feelings, empathy, understanding others
        const socialAwarenessPatterns = [
            /\b(they|he|she) (felt|feels|seemed|looked|appeared)\b/gi,
            /\bunderstood (them|him|her|their|his|her)\b/gi,
            /\b(empathy|empathize|sympathize|compassion)\b/gi,
            /\b(their|his|her) (perspective|point of view|feelings?|emotions?)\b/gi,
            /\bi (could|can) (see|tell|sense|understand) (how|why|that) (they|he|she)\b/gi,
            /\bput myself in (their|his|her) shoes\b/gi,
            /\b(cared|caring|care) about (them|him|her|others|people)\b/gi,
            /\blistened to\b/gi,
            /\bsupported\b/gi,
            /\bhelped (them|him|her|someone|a friend)\b/gi,
            /\b(noticed|saw) that (they|he|she|someone)\b/gi,
            /\bwondered (how|what|why) (they|he|she)\b/gi,
        ];
        
        let socialScore = 0;
        for (const pattern of socialAwarenessPatterns) {
            const matches = content.match(pattern) || [];
            socialScore += matches.length * 2;
        }
        // Bonus for mentioning other people
        const peopleRefs = content.match(/\b(friend|family|mom|dad|brother|sister|colleague|partner|wife|husband|boyfriend|girlfriend|they|them|he|she)\b/gi) || [];
        socialScore += Math.min(5, peopleRefs.length * 0.3);
        
        const socialAwareness = Math.min(10, Math.round((socialScore / Math.max(1, wordCount / 50)) * 2));

        // Regulation: self-control, coping, managing emotions, calming down
        const regulationPatterns = [
            /\b(calmed?|calming) (down|myself|my nerves)\b/gi,
            /\b(decided|chose|choose) to\b/gi,
            /\b(controlled?|managing|manage) (my|the) (emotions?|feelings?|anger|anxiety|stress)\b/gi,
            /\btook a (breath|moment|step back|break)\b/gi,
            /\bbreath(ed?|ing) (deeply?|slowly?|in|out)\b/gi,
            /\b(paused?|stopped) (to think|before|and thought)\b/gi,
            /\b(reflect(ed|ing)?|meditat(ed|ing)?)\b/gi,
            /\b(cope|coped|coping|deal|dealt|dealing) with\b/gi,
            /\b(instead of|rather than) (react|getting|being)\b/gi,
            /\blet (it|things) go\b/gi,
            /\b(focused|focus) on\b/gi,
            /\bstayed? (calm|patient|composed)\b/gi,
            /\btried (to|not to)\b/gi,
            /\bmanaged to\b/gi,
            /\bhandled\b/gi,
        ];
        
        let regScore = 0;
        for (const pattern of regulationPatterns) {
            const matches = content.match(pattern) || [];
            regScore += matches.length * 2;
        }
        // Bonus for resolution/positive ending indicators
        if (/\b(eventually|finally|in the end|after a while)\b/i.test(content)) regScore += 2;
        if (/\b(better now|feel better|worked out|resolved)\b/i.test(content)) regScore += 2;
        
        const regulation = Math.min(10, Math.round((regScore / Math.max(1, wordCount / 50)) * 2));

        // Determine dominant trait based on content and scores
        let dominantTrait: EmotionalIntelligence['dominantTrait'] = 'reflection';
        
        const maxScore = Math.max(selfAwareness, socialAwareness, regulation);
        
        if (socialAwareness === maxScore && socialAwareness >= 3) {
            dominantTrait = 'empathy';
        } else if (regulation === maxScore && regulation >= 3) {
            dominantTrait = 'adaptability';
        } else if (/\b(overcame?|persever|kept going|didn'?t give up|strong|strength|resilient|bounced back)\b/i.test(content)) {
            dominantTrait = 'resilience';
        } else if (/\b(angry|furious|rage|hate|exploded|yelled|screamed|lost (my|it))\b/i.test(content) && regulation < 3) {
            dominantTrait = 'reactive';
        } else if (selfAwareness === maxScore && selfAwareness >= 3) {
            dominantTrait = 'reflection';
        }

        // Ensure minimum scores if content has any emotional content
        const hasEmotionalContent = emotionWords.length > 0 || selfScore > 0 || socialScore > 0 || regScore > 0;
        
        return {
            selfAwareness: hasEmotionalContent ? Math.max(1, selfAwareness) : 0,
            socialAwareness: hasEmotionalContent && peopleRefs.length > 0 ? Math.max(1, socialAwareness) : socialAwareness,
            regulation: hasEmotionalContent ? Math.max(1, regulation) : 0,
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
     * Extract tags - comprehensive tagging system that extracts at least 10 relevant tags
     */
    private extractTags(content: string, growthPoints?: GrowthPoint[]): string[] {
        const tags = new Set<string>();
        const lowerContent = content.toLowerCase();

        // Comprehensive tag patterns organized by category
        const tagPatterns = {
            // Life Categories
            work: /\b(work|working|job|office|meeting|project|deadline|boss|colleague|career|profession)\b/i,
            family: /\b(family|mom|dad|mother|father|sister|brother|parent|child|kids|son|daughter|husband|wife|spouse)\b/i,
            relationships: /\b(relationship|boyfriend|girlfriend|partner|dating|love|romance|married|marriage)\b/i,
            friends: /\b(friend|friends|buddy|bestie|pal|companion|hangout|hanging out)\b/i,
            health: /\b(health|healthy|exercise|workout|gym|yoga|meditation|fitness|diet|nutrition|sleep|rest)\b/i,
            travel: /\b(travel|trip|vacation|journey|adventure|explore|visited|traveling|flight|hotel)\b/i,
            nature: /\b(nature|outdoor|outdoors|park|beach|mountain|hiking|forest|garden|camping|sunrise|sunset)\b/i,
            
            // Activities
            creativity: /\b(creative|art|artistic|writing|wrote|music|painting|drawing|craft|design|photography)\b/i,
            learning: /\b(learn|learned|study|studying|course|book|reading|read|education|class|lesson|skill)\b/i,
            cooking: /\b(cook|cooking|baked|baking|recipe|meal|food|kitchen|dinner|lunch|breakfast)\b/i,
            sports: /\b(sport|sports|running|ran|jogging|swimming|cycling|basketball|football|soccer|tennis|golf)\b/i,
            entertainment: /\b(movie|film|show|tv|netflix|watching|watched|concert|theater|game|gaming)\b/i,
            shopping: /\b(shop|shopping|bought|purchase|store|mall|market)\b/i,
            
            // Mental & Emotional
            reflection: /\b(reflect|reflection|thinking|thought|contemplat|pondering|introspect)\b/i,
            gratitude: /\b(grateful|thankful|blessed|appreciate|appreciation|gratitude|lucky)\b/i,
            mindfulness: /\b(mindful|mindfulness|present|awareness|conscious|meditat|calm|peaceful|serene)\b/i,
            motivation: /\b(motivat|inspired|inspiring|determined|driven|ambitious|aspir)\b/i,
            stress: /\b(stress|stressed|overwhelm|pressure|anxious|anxiety|worried|worry|tense|tension)\b/i,
            happiness: /\b(happy|happiness|joy|joyful|excited|excitement|thrilled|delighted|cheerful|elated)\b/i,
            sadness: /\b(sad|sadness|upset|down|depressed|unhappy|melancholy|gloomy|miserable|heartbroken)\b/i,
            anger: /\b(angry|anger|frustrated|frustration|annoyed|irritated|furious|mad|rage)\b/i,
            fear: /\b(fear|afraid|scared|terrified|nervous|dread|panic|phobia)\b/i,
            
            // Goals & Growth
            goals: /\b(goal|goals|achieve|achievement|accomplish|target|objective|milestone)\b/i,
            planning: /\b(plan|planning|planned|strategy|prepare|preparation|schedule|organize)\b/i,
            success: /\b(success|successful|succeed|accomplished|won|victory|triumph|breakthrough)\b/i,
            challenge: /\b(challenge|challenging|difficult|hard|struggle|struggling|obstacle|problem)\b/i,
            growth: /\b(grow|growth|growing|improve|improvement|progress|develop|development|better)\b/i,
            change: /\b(change|changing|changed|transition|transform|transformation|evolve|evolution)\b/i,
            
            // Social & Communication
            social: /\b(social|party|gathering|event|celebration|meetup|community)\b/i,
            conversation: /\b(talk|talked|talking|conversation|discuss|chat|chatted|spoke|speaking)\b/i,
            support: /\b(support|supported|help|helped|helping|encourage|encouraged|comfort)\b/i,
            conflict: /\b(conflict|argument|argue|disagreement|fight|tension|dispute)\b/i,
            
            // Time & Routine
            morning: /\b(morning|woke|wake|sunrise|breakfast|start of day)\b/i,
            evening: /\b(evening|night|sunset|dinner|end of day|bedtime)\b/i,
            weekend: /\b(weekend|saturday|sunday|day off|relax)\b/i,
            routine: /\b(routine|habit|daily|everyday|regular|usual)\b/i,
            
            // Life Events
            celebration: /\b(birthday|anniversary|holiday|christmas|thanksgiving|celebration|celebrate|party)\b/i,
            milestone: /\b(milestone|graduation|promotion|engagement|wedding|pregnant|birth|retirement)\b/i,
            decision: /\b(decision|decide|decided|choice|chose|option)\b/i,
            newbeginning: /\b(new beginning|fresh start|starting over|chapter|new job|new place|moving)\b/i,
            
            // Productivity & Finance
            productivity: /\b(productive|productivity|efficient|accomplish|complete|finish|done|task)\b/i,
            finance: /\b(money|finance|financial|budget|save|saving|invest|expense|income|salary|pay)\b/i,
            
            // Wellness
            selfcare: /\b(self-care|self care|pamper|relax|relaxing|spa|massage|treat myself)\b/i,
            therapy: /\b(therapy|therapist|counseling|mental health|psychologist)\b/i,
            spirituality: /\b(spiritual|spirituality|faith|pray|prayer|church|temple|mosque|god|soul|blessing)\b/i,
            
            // Weather & Season
            weather: /\b(rain|rainy|sunny|cloudy|snow|snowy|storm|windy|cold|hot|warm|humid)\b/i,
            seasons: /\b(spring|summer|fall|autumn|winter|seasonal)\b/i,
        };

        // Match patterns and add tags
        for (const [tag, pattern] of Object.entries(tagPatterns)) {
            if (pattern.test(lowerContent)) {
                tags.add(tag);
            }
        }

        // Add emotion-based tags from content analysis
        const emotionTags = this.extractEmotionTags(lowerContent);
        emotionTags.forEach(tag => tags.add(tag));

        // Add growth tags
        if (growthPoints) {
            if (growthPoints.some(g => g.category === 'professional')) tags.add('professional-growth');
            if (growthPoints.some(g => g.category === 'personal')) tags.add('personal-growth');
            if (growthPoints.some(g => g.category === 'spiritual')) tags.add('spiritual-growth');
            if (growthPoints.some(g => g.category === 'intellectual')) tags.add('intellectual-growth');
            if (growthPoints.some(g => g.category === 'creative')) tags.add('creative-growth');
            if (growthPoints.some(g => g.category === 'emotional')) tags.add('emotional-growth');
        }

        // Add time-based tags
        if (/\b(today|this morning|tonight|this evening|right now|just now)\b/i.test(content)) {
            tags.add('present-moment');
        }
        if (/\b(yesterday|last night|last week|recently|the other day)\b/i.test(content)) {
            tags.add('recent-past');
        }
        if (/\b(tomorrow|next week|future|upcoming|soon|planning to)\b/i.test(content)) {
            tags.add('future-focused');
        }

        // Add sentiment-based tags
        const sentiment = this.analyzeSentiment(content);
        if (sentiment.score > 0.3) tags.add('positive-vibes');
        if (sentiment.score < -0.3) tags.add('working-through-it');
        if (Math.abs(sentiment.score) < 0.1) tags.add('neutral-reflection');

        // Ensure we return up to 15 tags (more than the requested 10)
        return Array.from(tags).slice(0, 15);
    }

    /**
     * Extract emotion-based tags from content
     */
    private extractEmotionTags(content: string): string[] {
        const emotionTags: string[] = [];
        
        // Positive emotion tags
        if (/\b(love|loving|loved|adore|cherish)\b/i.test(content)) emotionTags.push('love');
        if (/\b(hope|hopeful|hoping|optimistic|optimism)\b/i.test(content)) emotionTags.push('hope');
        if (/\b(confident|confidence|self-assured|believe in myself)\b/i.test(content)) emotionTags.push('confidence');
        if (/\b(proud|pride|accomplished)\b/i.test(content)) emotionTags.push('pride');
        if (/\b(curious|curiosity|wondering|interested|fascinated)\b/i.test(content)) emotionTags.push('curiosity');
        if (/\b(content|satisfied|fulfil|at peace)\b/i.test(content)) emotionTags.push('contentment');
        
        // Challenging emotion tags
        if (/\b(lonely|loneliness|alone|isolated)\b/i.test(content)) emotionTags.push('loneliness');
        if (/\b(confused|confusion|uncertain|unsure|lost)\b/i.test(content)) emotionTags.push('confusion');
        if (/\b(guilt|guilty|regret|remorse|sorry)\b/i.test(content)) emotionTags.push('guilt');
        if (/\b(jealous|jealousy|envious|envy)\b/i.test(content)) emotionTags.push('jealousy');
        if (/\b(embarrass|shame|ashamed|humiliated)\b/i.test(content)) emotionTags.push('embarrassment');
        
        return emotionTags;
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
