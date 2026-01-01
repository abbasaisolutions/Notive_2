// NLP Analysis Service - Sentiment, Entity Extraction, and Smart Insights
// File: backend/src/services/nlp.service.ts

import OpenAI from 'openai';

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

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export class NLPService {

    /**
     * Analyze text content for sentiment, entities, and insights using OpenAI
     */
    async analyzeContent(content: string): Promise<AnalysisResult> {
        const words = content.split(/\s+/);
        const wordCount = words.length;
        const readingTime = Math.ceil(wordCount / 200);

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
     * Chat with journal context using OpenAI or HuggingFace
     */
    async chat(query: string, context: string): Promise<string> {
        try {
            // Try OpenAI first if Key exists
            if (process.env.OPENAI_API_KEY) {
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
}

export default new NLPService();
