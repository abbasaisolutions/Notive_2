/**
 * Rewrite Service
 * Provides AI-powered text rewriting with different styles/tones
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export type RewriteStyle = 'clearer' | 'summary' | 'lessons' | 'formal' | 'casual' | 'encouraging';

export interface RewriteOption {
    id: RewriteStyle;
    label: string;
    description: string;
    iconName: 'sparkles' | 'fileText' | 'lightbulb' | 'briefcase' | 'messageCircle' | 'heart';
}

export const REWRITE_OPTIONS: RewriteOption[] = [
    {
        id: 'clearer',
        label: 'Make it clearer',
        description: 'Improve clarity and readability',
        iconName: 'sparkles'
    },
    {
        id: 'summary',
        label: 'Short summary',
        description: 'Condense into key points',
        iconName: 'fileText'
    },
    {
        id: 'lessons',
        label: 'Lessons learned',
        description: 'Extract key takeaways',
        iconName: 'lightbulb'
    },
    {
        id: 'formal',
        label: 'More formal',
        description: 'Professional tone',
        iconName: 'briefcase'
    },
    {
        id: 'casual',
        label: 'More casual',
        description: 'Conversational tone',
        iconName: 'messageCircle'
    },
    {
        id: 'encouraging',
        label: 'Encouraging',
        description: 'Positive and supportive',
        iconName: 'heart'
    }
];

export interface RewriteResult {
    original: string;
    rewritten: string;
    style: RewriteStyle;
}

class RewriteService {
    /**
     * Rewrite text using the AI backend
     */
    async rewriteText(
        text: string,
        style: RewriteStyle,
        accessToken: string
    ): Promise<RewriteResult> {
        if (!text.trim()) {
            throw new Error('Text is required for rewriting');
        }

        const response = await fetch(`${API_URL}/ai/rewrite`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ text, style })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to rewrite text');
        }

        return response.json();
    }
}

export const rewriteService = new RewriteService();
export default rewriteService;
