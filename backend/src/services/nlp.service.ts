// NLP Analysis Service - Sentiment, Entity Extraction, and Smart Insights
// File: backend/src/services/nlp.service.ts

import OpenAI from 'openai';
import { InferenceClient } from '@huggingface/inference';
import axios from 'axios';
import prisma from '../config/prisma';
import { healthSyncService, HealthContextSummary } from './health-sync.service';

// Similarity Service URL (from docker-compose or environment)
const SIMILARITY_SERVICE_URL = process.env.SIMILARITY_SERVICE_URL || 'http://localhost:8001';

// Initialize Hugging Face Inference Client
const hfClient = process.env.HF_TOKEN
    ? new InferenceClient(process.env.HF_TOKEN)
    : null;

interface SentimentResult {
    score: number; // -1 (negative) to 1 (positive)
    label: 'positive' | 'negative' | 'neutral';
    confidence: number;
    summary?: string; // Short emotional summary
}

interface EntityResult {
    text: string;
    type: 'person' | 'place' | 'activity' | 'thing' | 'emotion';
    confidence: number;
}

interface AnalysisResult {
    sentiment: SentimentResult;
    entities: EntityResult[];
    topics: string[];
    suggestedMood: string | null;
    wordCount: number;
    readingTime: number; // minutes
}

const openai = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

export class NLPService {

    /**
     * Analyze text content for sentiment, entities, and insights using OpenAI
     */
    async analyzeContent(content: string): Promise<AnalysisResult> {
        const words = content.split(/\s+/);
        const wordCount = words.length;
        const readingTime = Math.ceil(wordCount / 200);

        if (!openai) {
            return {
                sentiment: { score: 0, label: 'neutral', confidence: 0 },
                entities: [],
                topics: [],
                suggestedMood: null,
                wordCount,
                readingTime
            };
        }

        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: `You are an NLP analysis assistant for a journal.
                        Analyze the given text and return a JSON object with the following structure:
                        {
                            "sentimentScore": number, // -1.0 to 1.0
                            "sentimentLabel": "positive" | "negative" | "neutral",
                            "emotionalSummary": "string", // 1-sentence summary of the emotional state
                            "entities": [ { "text": "string", "type": "person" | "place" | "activity" } ], // Max 5 entities
                            "topics": [ "string" ], // Max 3 main topics
                            "suggestedMood": "string" // One word mood (e.g. happy, sad, calm, anxious, etc)
                        }`
                    },
                    {
                        role: 'user',
                        content: content
                    }
                ],
                max_tokens: 200,
                temperature: 0.3,
            });

            const resultText = response.choices[0]?.message?.content?.trim();
            if (!resultText) throw new Error('Empty response from AI');

            const aiData = JSON.parse(resultText);

            return {
                sentiment: {
                    score: aiData.sentimentScore || 0,
                    label: aiData.sentimentLabel || 'neutral',
                    confidence: 0.8,
                    summary: aiData.emotionalSummary
                },
                entities: aiData.entities || [],
                topics: aiData.topics || [],
                suggestedMood: aiData.suggestedMood || 'neutral',
                wordCount,
                readingTime
            };

        } catch (error) {
            console.error('AI Analysis failed, falling back to basic:', error);
            // Minimal fallback
            return {
                sentiment: { score: 0, label: 'neutral', confidence: 0 },
                entities: [],
                topics: [],
                suggestedMood: 'neutral',
                wordCount,
                readingTime
            };
        }
    }

    /**
     * Call similarity service to find relevant entries based on query
     */
    async findRelevantEntries(
        userId: string,
        query: string,
        entries: string[],
        topK: number = 5,
        threshold: number = 0.1
    ): Promise<string[]> {
        try {
            const response = await axios.post<{ relevant_entries: string[] }>(
                `${SIMILARITY_SERVICE_URL}/similarity`,
                {
                    user_id: userId,
                    query: query,
                    entries: entries,
                    top_k: topK,
                    threshold: threshold
                }
            );

            return response.data.relevant_entries || [];
        } catch (error) {
            console.error('Similarity service error:', error);
            // Fallback: return a few recent entries if similarity service fails
            return entries.slice(0, 5);
        }
    }

    /**
     * Chat with journal context using HuggingFace Inference API with RAG
     */
    async chatWithRelevantContext(
        query: string,
        userId: string,
        entries: Array<{ content: string; createdAt: Date; title?: string | null }>
    ): Promise<string> {
        try {
            // Extract just the content strings for similarity search
            const entryTexts = entries.map(e => e.content);

            // Find relevant entries using similarity service
            const relevantEntryTexts = await this.findRelevantEntries(
                userId,
                query,
                entryTexts,
                5,  // top_k
                0.1 // threshold
            );

            // Map back to full entry data for better context
            const relevantEntries = entries.filter(e => 
                relevantEntryTexts.some(text => e.content === text)
            );

            // Format context from relevant entries
            const context = relevantEntries.length > 0
                ? relevantEntries.map((e, i) => {
                    const date = new Date(e.createdAt).toLocaleDateString();
                    return `[Entry ${i + 1} - ${date}]${e.title ? ` Title: ${e.title}` : ''}\n${e.content}`;
                }).join('\n\n---\n\n')
                : 'No relevant entries found for your question.';

            // System prompt for the chatbot
            const systemPrompt = `You are a helpful and empathetic AI journaling assistant named "Notive AI". 
You have access to the user's relevant journal entries below. Use them to answer questions about their life, patterns, emotions, and experiences.

IMPORTANT INSTRUCTIONS:
- Be supportive, warm, and insightful in your responses.
- Reference specific dates or events from the entries when relevant.
- If the user's question cannot be answered from the entries, say so kindly and offer general supportive advice.
- Keep responses concise but meaningful.
- Never make up information that's not in the entries.
- Respect the user's privacy and emotional wellbeing.

RELEVANT JOURNAL ENTRIES:
${context}`;

            // Try HuggingFace InferenceClient first (preferred)
            if (hfClient) {
                try {
                    const chatCompletion = await hfClient.chatCompletion({
                        model: "openai/gpt-oss-120b:fastest",
                        messages: [
                            {
                                role: "system",
                                content: systemPrompt
                            },
                            {
                                role: "user",
                                content: query
                            }
                        ],
                        max_tokens: 500,
                        temperature: 0.7
                    });

                    return chatCompletion.choices[0]?.message?.content || "I couldn't generate a response. Please try again.";
                } catch (hfError) {
                    console.error('HuggingFace InferenceClient error:', hfError);
                    // Fall through to OpenAI fallback
                }
            }

            // Fallback to OpenAI if HF fails or not configured
            if (openai) {
                const response = await openai.chat.completions.create({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: query }
                    ],
                    max_tokens: 500,
                    temperature: 0.7,
                });
                return response.choices[0]?.message?.content || "I couldn't generate a response.";
            }

            return "AI features are not available. Please configure either HF_TOKEN or OPENAI_API_KEY.";

        } catch (error) {
            console.error('Chat with relevant context failed:', error);
            return "I'm having trouble processing your request right now. Please try again later.";
        }
    }

    /**
     * Chat with journal context using OpenAI or HuggingFace
     */
    async chat(query: string, context: string): Promise<string> {
        try {
            // Try OpenAI first if Key exists
            if (openai) {
                const response = await openai.chat.completions.create({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: `You are a helpful and empathetic AI journaling assistant. 
                            You have access to the user's past journal entries. 
                            Use the context provided to answer the user's question about their life, patterns, and feelings.
                            
                            Context (Journal Entries):
                            ${context}
                            
                            Instructions:
                            - Be supportive and insightful.
                            - Cite specific dates or events if possible from the context.
                            - If the answer isn't in the context, say so gently and offer general advice.`
                        },
                        { role: 'user', content: query }
                    ],
                    max_tokens: 500,
                    temperature: 0.7,
                });
                return response.choices[0]?.message?.content || "I couldn't generate a response.";
            }

            // Fallback to HuggingFace Inference API (if HF_API_KEY is present or we try public)
            // Using a popular instruction tuned model
            const hfToken = process.env.HF_API_KEY || process.env.HUGGINGFACE_API_KEY;
            const hfModel = "mistralai/Mistral-7B-Instruct-v0.2";

            // Construct prompt for Mistral/Llama style
            const prompt = `<s>[INST] You are a helpful and empathetic AI journaling assistant. 
Uses the following journal entries as context to answer the user's question.

Context:
${context}

User Question: ${query} [/INST]`;

            /* 
               Note: axios is not imported at top level in original file, we need to import it or use fetch if available (Node 18+ has fetch).
               Since 'axios' is in package.json, we can use it, but I cannot easily add an import at the top with replace_file_content 
               without replacing the whole file or a chunk including inputs.
               
               I will assume 'fetch' is available (Node 18+) or use 'axios' if I can see where imports are.
               The imports are at lines 1-4.
            */


            // Using global fetch (Node 18+)
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
            // HF Inference usually returns [{ generated_text: "..." }]
            return result[0]?.generated_text || "I couldn't generate a response.";

        } catch (error) {
            console.error('AI Chat failed:', error);
            return "I'm having trouble connecting to my brain right now. Please try again later.";
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

        entries.forEach(e => {
            if (e.mood) moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;

            // Aggregate skills (which are effectively topics)
            e.skills?.forEach(s => {
                skillCounts[s] = (skillCounts[s] || 0) + 1;
            });

            // Lessons 
            e.lessons?.forEach(l => {
                lessonCounts[l] = (lessonCounts[l] || 0) + 1;
            });
        });

        const dominantMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';
        const topSkills = Object.entries(skillCounts).sort((a, b) => b[1] - a[1]).map(x => x[0]).slice(0, 5);
        const topLessons = Object.entries(lessonCounts).sort((a, b) => b[1] - a[1]).map(x => x[0]).slice(0, 5);

        // Fallback for topics if skills empty
        const topTopics = topSkills.length > 0 ? topSkills : ['Reflection', 'Growth', 'Daily Life'];

        return {
            dominantMood,
            moodTrend: 'stable',
            topTopics,
            topSkills,
            topLessons,
            averageSentiment: 0.5,
            suggestions: ['Keep journaling to see more AI insights available in individual entries!']
        };
    }

    /**
     * Rewrite text with different tones/styles using Hugging Face Inference API
     */
    async rewriteText(
        text: string,
        style: 'clearer' | 'summary' | 'lessons' | 'formal' | 'casual' | 'encouraging'
    ): Promise<string> {
        if (!text.trim()) {
            return text;
        }

        const stylePrompts: Record<string, string> = {
            clearer: `Rewrite the following text to make it clearer and more concise while preserving the meaning. Remove any ambiguity and improve readability:\n\n"${text}"`,
            summary: `Create a short, concise summary (2-3 sentences max) of the following text, capturing the key points:\n\n"${text}"`,
            lessons: `Extract and rewrite the following text as "lessons learned" or key takeaways. Format as bullet points if there are multiple lessons:\n\n"${text}"`,
            formal: `Rewrite the following text in a more formal, professional tone while preserving the core message:\n\n"${text}"`,
            casual: `Rewrite the following text in a more casual, conversational tone while preserving the meaning:\n\n"${text}"`,
            encouraging: `Rewrite the following text with an encouraging, positive, and supportive tone while preserving the core message:\n\n"${text}"`
        };

        const prompt = stylePrompts[style] || stylePrompts.clearer;

        try {
            // Try HuggingFace InferenceClient first (preferred)
            if (hfClient) {
                try {
                    const chatCompletion = await hfClient.chatCompletion({
                        model: "Qwen/Qwen2.5-72B-Instruct",
                        messages: [
                            {
                                role: "system",
                                content: "You are a skilled writing assistant that helps improve and transform text. Always respond with ONLY the rewritten text, no explanations or preambles."
                            },
                            {
                                role: "user",
                                content: prompt
                            }
                        ],
                        max_tokens: 500,
                        temperature: 0.7
                    });

                    const result = chatCompletion.choices[0]?.message?.content?.trim();
                    if (result) {
                        // Remove surrounding quotes if present
                        return result.replace(/^["']|["']$/g, '');
                    }
                } catch (hfError) {
                    console.error('HuggingFace InferenceClient error for rewrite:', hfError);
                    // Fall through to OpenAI fallback
                }
            }

            // Fallback to OpenAI if HF fails or not configured
            if (openai) {
                const response = await openai.chat.completions.create({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a skilled writing assistant that helps improve and transform text. Always respond with ONLY the rewritten text, no explanations or preambles.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 500,
                    temperature: 0.7,
                });
                const result = response.choices[0]?.message?.content?.trim();
                if (result) {
                    return result.replace(/^["']|["']$/g, '');
                }
            }

            return "AI features are not available. Please configure either HF_TOKEN or OPENAI_API_KEY.";

        } catch (error) {
            console.error('Rewrite text failed:', error);
            return "I'm having trouble rewriting your text right now. Please try again later.";
        }
    }

    /**
     * Analyze content with health context for enhanced mood detection
     */
    async analyzeContentWithHealth(
        content: string,
        userId: string,
        entryDate?: Date
    ): Promise<AnalysisResult & { healthContext?: HealthContextSummary; healthInsight?: string }> {
        // Get base analysis
        const baseAnalysis = await this.analyzeContent(content);

        // Try to get health context for the entry date
        let healthContext: HealthContextSummary | null = null;
        let healthInsight: string | undefined;

        try {
            const targetDate = entryDate || new Date();
            healthContext = await healthSyncService.getHealthContextForDate(userId, targetDate);

            // If we have health context and a mood, generate a health insight
            if (healthContext && baseAnalysis.suggestedMood && openai) {
                healthInsight = await this.generateHealthAwareInsight(
                    baseAnalysis.suggestedMood,
                    healthContext
                );
            }
        } catch (error) {
            console.warn('Could not get health context for analysis:', error);
        }

        return {
            ...baseAnalysis,
            healthContext: healthContext || undefined,
            healthInsight,
        };
    }

    /**
     * Generate a health-aware insight based on mood and health context
     */
    private async generateHealthAwareInsight(
        mood: string,
        healthContext: HealthContextSummary
    ): Promise<string | undefined> {
        if (!openai) return undefined;

        // Only generate insight if there's something notable
        const sleepLow = healthContext.sleepHours !== null && healthContext.sleepHours < 6;
        const sleepHigh = healthContext.sleepHours !== null && healthContext.sleepHours > 9;
        const activityLow = healthContext.activityLevel === 'low';
        const negativeMoods = ['sad', 'anxious', 'frustrated', 'tired'];
        const positiveMoods = ['happy', 'motivated', 'calm'];

        const isNegativeMood = negativeMoods.includes(mood);
        const isPositiveMood = positiveMoods.includes(mood);

        // Generate insight only for notable patterns
        if (!(sleepLow && isNegativeMood) && 
            !(sleepHigh && isNegativeMood) && 
            !(activityLow && isNegativeMood) &&
            !(healthContext.sleepHours && healthContext.sleepHours >= 7 && isPositiveMood)) {
            return undefined;
        }

        try {
            const healthSummary = [
                healthContext.sleepHours ? `${healthContext.sleepHours}h sleep` : null,
                healthContext.steps ? `${healthContext.steps.toLocaleString()} steps` : null,
                healthContext.activityLevel ? `${healthContext.activityLevel} activity` : null,
            ].filter(Boolean).join(', ');

            const response = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: `You are a gentle journaling assistant. Generate ONE brief, supportive observation (15 words max) connecting health context to mood. Use "may have", "might", "could". NO medical advice. NO diagnosis. Be warm and curious, not prescriptive.`
                    },
                    {
                        role: 'user',
                        content: `Health: ${healthSummary}. Mood: ${mood}. Generate observation or say "skip" if no clear connection.`
                    }
                ],
                max_tokens: 50,
                temperature: 0.5,
            });

            const insight = response.choices[0]?.message?.content?.trim();
            if (insight && insight.toLowerCase() !== 'skip' && insight.length > 5) {
                return insight;
            }
            return undefined;
        } catch (error) {
            console.error('Failed to generate health-aware insight:', error);
            return undefined;
        }
    }

    /**
     * Chat with journal context including health data
     */
    async chatWithHealthContext(
        query: string,
        userId: string,
        entries: Array<{ content: string; createdAt: Date; title?: string | null; mood?: string | null }>
    ): Promise<string> {
        // Get health data for the past 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        let healthSummary = '';
        try {
            const healthContexts = await healthSyncService.getHealthContextRange(
                userId,
                thirtyDaysAgo,
                new Date()
            );

            if (healthContexts.length > 0) {
                const avgSleep = healthContexts
                    .filter(h => h.sleepHours)
                    .reduce((sum, h) => sum + (h.sleepHours || 0), 0) / 
                    healthContexts.filter(h => h.sleepHours).length;

                const avgSteps = healthContexts
                    .filter(h => h.steps)
                    .reduce((sum, h) => sum + (h.steps || 0), 0) /
                    healthContexts.filter(h => h.steps).length;

                healthSummary = `\n\nHEALTH CONTEXT (past ${healthContexts.length} days):
- Average sleep: ${avgSleep.toFixed(1)} hours/night
- Average steps: ${Math.round(avgSteps).toLocaleString()}/day
Note: Use this only to provide gentle context, never medical advice.`;
            }
        } catch (error) {
            console.warn('Could not get health context for chat:', error);
        }

        // Use the existing chat method but with health context added
        const entriesContext = entries.map((e, i) => {
            const date = new Date(e.createdAt).toLocaleDateString();
            return `[Entry ${i + 1} - ${date}]${e.title ? ` Title: ${e.title}` : ''}${e.mood ? ` Mood: ${e.mood}` : ''}\n${e.content}`;
        }).join('\n\n---\n\n');

        const fullContext = entriesContext + healthSummary;

        return this.chat(query, fullContext);
    }

    /**
     * Generate smart reflection prompt based on health and recent entries
     */
    async generateSmartPrompt(userId: string, recentMoods: string[]): Promise<string> {
        if (!openai) {
            return this.getDefaultPrompt(recentMoods);
        }

        let healthContext = '';
        try {
            const todayHealth = await healthSyncService.getTodayHealthContext(userId);
            if (todayHealth) {
                healthContext = [
                    todayHealth.sleepHours ? `${todayHealth.sleepHours}h sleep` : null,
                    todayHealth.activityLevel ? `${todayHealth.activityLevel} activity` : null,
                ].filter(Boolean).join(', ');
            }
        } catch (error) {
            console.warn('Could not get health context for prompt:', error);
        }

        const moodContext = recentMoods.length > 0 
            ? `Recent moods: ${recentMoods.slice(0, 3).join(', ')}`
            : '';

        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: `Generate a short, warm journaling prompt (1-2 sentences) that gently acknowledges the user's context without being prescriptive. Be curious and inviting.`
                    },
                    {
                        role: 'user',
                        content: `Context: ${[healthContext, moodContext].filter(Boolean).join('. ') || 'No context available'}. Generate a reflection prompt.`
                    }
                ],
                max_tokens: 80,
                temperature: 0.8,
            });

            return response.choices[0]?.message?.content?.trim() || this.getDefaultPrompt(recentMoods);
        } catch (error) {
            console.error('Failed to generate smart prompt:', error);
            return this.getDefaultPrompt(recentMoods);
        }
    }

    /**
     * Get a default prompt based on mood patterns
     */
    private getDefaultPrompt(recentMoods: string[]): string {
        const prompts = {
            positive: [
                "What's bringing you joy today?",
                "What are you grateful for right now?",
                "What made today feel good?",
            ],
            negative: [
                "What's on your mind today?",
                "What would make today feel a bit better?",
                "What do you need right now?",
            ],
            neutral: [
                "What's one thing you noticed today?",
                "How are you really feeling?",
                "What's been occupying your thoughts?",
            ],
        };

        const positiveMoods = ['happy', 'motivated', 'calm'];
        const negativeMoods = ['sad', 'anxious', 'frustrated', 'tired'];

        const dominantMood = recentMoods[0];
        let category: 'positive' | 'negative' | 'neutral' = 'neutral';

        if (dominantMood && positiveMoods.includes(dominantMood)) {
            category = 'positive';
        } else if (dominantMood && negativeMoods.includes(dominantMood)) {
            category = 'negative';
        }

        const categoryPrompts = prompts[category];
        return categoryPrompts[Math.floor(Math.random() * categoryPrompts.length)];
    }
}

export default new NLPService();
