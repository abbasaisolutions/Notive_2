/**
 * Voice Command Parser
 * Parses natural language commands from voice input
 */

export interface VoiceCommand {
    type: 'formatting' | 'action' | 'mood' | 'tag' | 'none';
    command: string;
    value?: string;
    originalText: string;
}

class VoiceCommandService {
    private formattingCommands = [
        { pattern: /new paragraph/i, command: 'newParagraph' },
        { pattern: /make (?:that|this) bold/i, command: 'bold' },
        { pattern: /make (?:that|this) italic/i, command: 'italic' },
        { pattern: /heading:?\s*(.+)/i, command: 'heading', hasValue: true },
        { pattern: /bullet point/i, command: 'bulletList' },
        { pattern: /numbered list/i, command: 'numberedList' },
        { pattern: /quote:?\s*(.+)/i, command: 'quote', hasValue: true },
    ];

    private actionCommands = [
        { pattern: /add (?:a )?photo/i, command: 'addPhoto' },
        { pattern: /take (?:a )?picture/i, command: 'takePhoto' },
        { pattern: /save (?:this|entry)/i, command: 'save' },
        { pattern: /start over/i, command: 'startOver' },
        { pattern: /discard/i, command: 'discard' },
    ];

    private moodCommands = [
        { pattern: /i'?m feeling (.+)/i, command: 'setMood', hasValue: true },
        { pattern: /feeling (.+)/i, command: 'setMood', hasValue: true },
    ];

    private tagCommands = [
        { pattern: /tag (?:this|it) as (.+)/i, command: 'addTag', hasValue: true },
        { pattern: /add tag (.+)/i, command: 'addTag', hasValue: true },
    ];

    /**
     * Parse voice input for commands
     */
    parseCommand(text: string): VoiceCommand {
        // Check formatting commands
        for (const cmd of this.formattingCommands) {
            const match = text.match(cmd.pattern);
            if (match) {
                return {
                    type: 'formatting',
                    command: cmd.command,
                    value: cmd.hasValue ? match[1]?.trim() : undefined,
                    originalText: text,
                };
            }
        }

        // Check action commands
        for (const cmd of this.actionCommands) {
            const match = text.match(cmd.pattern);
            if (match) {
                return {
                    type: 'action',
                    command: cmd.command,
                    originalText: text,
                };
            }
        }

        // Check mood commands
        for (const cmd of this.moodCommands) {
            const match = text.match(cmd.pattern);
            if (match) {
                return {
                    type: 'mood',
                    command: cmd.command,
                    value: match[1]?.trim(),
                    originalText: text,
                };
            }
        }

        // Check tag commands
        for (const cmd of this.tagCommands) {
            const match = text.match(cmd.pattern);
            if (match) {
                return {
                    type: 'tag',
                    command: cmd.command,
                    value: match[1]?.trim(),
                    originalText: text,
                };
            }
        }

        return {
            type: 'none',
            command: 'none',
            originalText: text,
        };
    }

    /**
     * Clean transcript by removing filler words
     */
    cleanTranscript(text: string): string {
        const fillerWords = /\b(um|uh|like|you know|sort of|kind of)\b/gi;
        return text.replace(fillerWords, '').replace(/\s+/g, ' ').trim();
    }

    /**
     * Add smart punctuation
     */
    addSmartPunctuation(text: string): string {
        let result = text;

        // Capitalize first letter
        result = result.charAt(0).toUpperCase() + result.slice(1);

        // Add period at end if missing
        if (!/[.!?]$/.test(result)) {
            result += '.';
        }

        // Capitalize after periods
        result = result.replace(/\.\s+([a-z])/g, (match, letter) => {
            return '. ' + letter.toUpperCase();
        });

        // Add question marks for questions
        result = result.replace(/\b(what|when|where|who|why|how)\s+[^.!?]+$/i, (match) => {
            return match + '?';
        });

        return result;
    }

    /**
     * Process full transcript with all enhancements
     */
    processTranscript(text: string): {
        cleanedText: string;
        commands: VoiceCommand[];
    } {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim());
        const commands: VoiceCommand[] = [];
        const cleanedSentences: string[] = [];

        for (const sentence of sentences) {
            const command = this.parseCommand(sentence);

            if (command.type !== 'none') {
                commands.push(command);
            } else {
                // Clean and add punctuation
                const cleaned = this.cleanTranscript(sentence);
                if (cleaned) {
                    cleanedSentences.push(this.addSmartPunctuation(cleaned));
                }
            }
        }

        return {
            cleanedText: cleanedSentences.join(' '),
            commands,
        };
    }

    /**
     * Extract mood from text using sentiment analysis
     */
    extractMood(text: string): string | null {
        const moodKeywords = {
            happy: /\b(happy|joyful|excited|great|wonderful|amazing|fantastic)\b/i,
            sad: /\b(sad|depressed|down|unhappy|miserable|terrible)\b/i,
            anxious: /\b(anxious|worried|nervous|stressed|overwhelmed)\b/i,
            calm: /\b(calm|peaceful|relaxed|serene|tranquil)\b/i,
            angry: /\b(angry|mad|furious|irritated|frustrated)\b/i,
            motivated: /\b(motivated|inspired|energized|determined)\b/i,
            tired: /\b(tired|exhausted|drained|sleepy|fatigued)\b/i,
        };

        for (const [mood, pattern] of Object.entries(moodKeywords)) {
            if (pattern.test(text)) {
                return mood;
            }
        }

        return null;
    }

    /**
     * Extract tags from text
     */
    extractTags(text: string): string[] {
        const tags: string[] = [];

        // Common journaling topics
        const topicPatterns = {
            work: /\b(work|job|office|meeting|project|deadline)\b/i,
            family: /\b(family|mom|dad|sister|brother|parents|kids)\b/i,
            friends: /\b(friend|friends|buddy|pal)\b/i,
            health: /\b(health|exercise|workout|gym|run|diet)\b/i,
            travel: /\b(travel|trip|vacation|journey|flight)\b/i,
            food: /\b(food|meal|dinner|lunch|breakfast|restaurant)\b/i,
            hobby: /\b(hobby|hobbies|reading|music|art|photography)\b/i,
        };

        for (const [tag, pattern] of Object.entries(topicPatterns)) {
            if (pattern.test(text)) {
                tags.push(tag);
            }
        }

        return tags;
    }
}

// Export singleton instance
export const voiceCommandService = new VoiceCommandService();

export default voiceCommandService;
