import { aiRuntime, createLlmChatCompletion, hasLlmProvider } from '../config/ai';

export class AIService {
    /**
     * Analyze the sentiment of text and suggest a mood
     */
    static async analyzeSentiment(text: string): Promise<string> {
        if (!hasLlmProvider()) {
            console.warn('No LLM provider configured, returning default mood');
            return 'thoughtful';
        }
        const response = await createLlmChatCompletion({
            model: aiRuntime.sentimentModel,
            messages: [
                {
                    role: 'system',
                    content: `You are a sentiment analysis assistant for a student journal (ages 15-22). Analyze the emotional tone of the text and respond with ONLY ONE of these moods: happy, calm, sad, anxious, frustrated, thoughtful, motivated, tired, grateful, hopeful, overwhelmed, nostalgic, proud, lonely, curious, relieved. Just the single word, nothing else.`,
                },
                {
                    role: 'user',
                    content: text,
                },
            ],
            max_tokens: 15,
            temperature: 0.3,
        });

        if (!response) {
            return 'thoughtful';
        }

        const mood = response.choices[0]?.message?.content?.trim().toLowerCase() || 'thoughtful';

        // Validate the mood is in our allowed list
        const validMoods = ['happy', 'calm', 'sad', 'anxious', 'frustrated', 'thoughtful', 'motivated', 'tired', 'grateful', 'hopeful', 'overwhelmed', 'nostalgic', 'proud', 'lonely', 'curious', 'relieved'];
        return validMoods.includes(mood) ? mood : 'thoughtful';
    }

    /**
     * Chat with the journal using RAG (Retrieval-Augmented Generation)
     */
    static async chatWithJournal(query: string, entries: { title: string | null; content: string; createdAt: Date }[]): Promise<string> {
        if (!hasLlmProvider()) {
            return 'AI features are not available. Please configure a supported LLM provider.';
        }
        // Format entries as context (truncate each to avoid token bloat)
        const MAX_ENTRY_CHARS = 3000;
        const context = entries.map((entry, i) => {
            const date = new Date(entry.createdAt).toLocaleDateString();
            const truncatedContent = entry.content.length > MAX_ENTRY_CHARS
                ? entry.content.slice(0, MAX_ENTRY_CHARS) + '… [entry continues]'
                : entry.content;
            return `[Entry ${i + 1} - ${date}]
Title: ${entry.title || 'Untitled'}
${truncatedContent}`;
        }).join('\n\n---\n\n');

        const response = await createLlmChatCompletion({
            model: aiRuntime.chatModel,
            messages: [
                {
                    role: 'system',
                    content: `You are a helpful journal companion for a student aged 15-22. Help them reflect on their journal entries thoughtfully and empathetically. Use supportive, direct, age-appropriate language. If you don't find relevant information in the entries, say so kindly.

Here are the user's recent journal entries:

${context || 'No entries available yet.'}`,
                },
                {
                    role: 'user',
                    content: query,
                },
            ],
            max_tokens: 500,
            temperature: 0.7,
        });

        if (!response) {
            return 'I apologize, but I was unable to generate a response. Please try again.';
        }

        return response.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response. Please try again.';
    }

    /**
     * Generate a writing prompt based on context
     */
    static async generatePrompt(context?: string): Promise<string> {
        if (!hasLlmProvider()) {
            return 'What made you smile today?';
        }
        const response = await createLlmChatCompletion({
            model: aiRuntime.promptModel,
            messages: [
                {
                    role: 'system',
                    content: `You are a creative writing prompt generator for a student journaling app (ages 15-22). Generate a short, thoughtful prompt (1-2 sentences) to inspire reflection. Make it personal, grounded, and age-appropriate — avoid clinical or generic phrasing.${context ? ` Context: ${context}` : ''}`,
                },
                {
                    role: 'user',
                    content: 'Generate a journaling prompt for me.',
                },
            ],
            max_tokens: 100,
            temperature: 0.9,
        });

        if (!response) {
            return 'What made you smile today?';
        }

        return response.choices[0]?.message?.content || 'What made you smile today?';
    }
}
