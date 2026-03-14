import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY 
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

export class AIService {
    /**
     * Analyze the sentiment of text and suggest a mood
     */
    static async analyzeSentiment(text: string): Promise<string> {
        if (!openai) {
            console.warn('OpenAI API key not configured, returning default mood');
            return 'thoughtful';
        }
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: `You are a sentiment analysis assistant. Analyze the emotional tone of the text and respond with ONLY ONE of these moods: happy, calm, sad, anxious, frustrated, thoughtful, motivated, tired. Just the single word, nothing else.`,
                },
                {
                    role: 'user',
                    content: text,
                },
            ],
            max_tokens: 10,
            temperature: 0.3,
        });

        const mood = response.choices[0]?.message?.content?.trim().toLowerCase() || 'thoughtful';

        // Validate the mood is in our allowed list
        const validMoods = ['happy', 'calm', 'sad', 'anxious', 'frustrated', 'thoughtful', 'motivated', 'tired'];
        return validMoods.includes(mood) ? mood : 'thoughtful';
    }

    /**
     * Chat with the journal using RAG (Retrieval-Augmented Generation)
     */
    static async chatWithJournal(query: string, entries: { title: string | null; content: string; createdAt: Date }[]): Promise<string> {
        if (!openai) {
            return 'AI features are not available. Please configure the OPENAI_API_KEY.';
        }
        // Format entries as context
        const context = entries.map((entry, i) => {
            const date = new Date(entry.createdAt).toLocaleDateString();
            return `[Entry ${i + 1} - ${date}]
Title: ${entry.title || 'Untitled'}
${entry.content}`;
        }).join('\n\n---\n\n');

        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: `You are a helpful AI assistant that helps users reflect on their journal entries. You have access to the user's past journal entries. Answer questions about their entries thoughtfully and empathetically. If you don't find relevant information in the entries, say so kindly. Always be supportive and encouraging.

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

        return response.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response. Please try again.';
    }

    /**
     * Generate a writing prompt based on context
     */
    static async generatePrompt(context?: string): Promise<string> {
        if (!openai) {
            return 'What made you smile today?';
        }
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: `You are a creative writing prompt generator for a journaling app. Generate a short, thoughtful prompt (1-2 sentences) to inspire the user to write. Make it personal and reflective.${context ? ` Context: ${context}` : ''}`,
                },
                {
                    role: 'user',
                    content: 'Generate a journaling prompt for me.',
                },
            ],
            max_tokens: 100,
            temperature: 0.9,
        });

        return response.choices[0]?.message?.content || 'What made you smile today?';
    }
}
