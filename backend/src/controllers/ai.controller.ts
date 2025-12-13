import { Request, Response } from 'express';
import prisma from '../config/prisma';

// Mock AI Service until real API key is provided
const mockAnalyzeEntry = async (content: string, mood: string | null) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const lessons = [
        "Consistency is key to progress.",
        "Reflecting on small wins boosts morale.",
        "Taking breaks improves long-term productivity."
    ];

    const skills = [
        "Time Management",
        "Self-Reflection",
        "Resilience",
        "Communication"
    ];

    const reflectionQuestions = [
        "What triggered this feeling?",
        "How would you handle this differently next time?",
        "What is one thing you are grateful for in this situation?"
    ];

    // Randomly select subsets
    const selectedLessons = lessons.sort(() => 0.5 - Math.random()).slice(0, 2);
    const selectedSkills = skills.sort(() => 0.5 - Math.random()).slice(0, 2);
    const selectedQuestions = reflectionQuestions.sort(() => 0.5 - Math.random()).slice(0, 1);

    return {
        lessons: selectedLessons,
        skills: selectedSkills,
        reflectionQuestions: selectedQuestions
    };
};

/**
 * Analyze an entry to extract insights
 */
export const analyzeEntry = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.userId;
        const { entryId } = req.params;
        const { content, mood } = req.body; // Can analyze unsaved content too

        if (!content && !entryId) {
            return res.status(400).json({ message: 'Content or Entry ID required' });
        }

        let contentToAnalyze = content;
        let moodToAnalyze = mood;

        // If entryId is provided, fetch from DB
        if (entryId) {
            const entry = await prisma.entry.findUnique({
                where: { id: entryId, userId },
            });
            if (!entry) return res.status(404).json({ message: 'Entry not found' });
            contentToAnalyze = entry.content;
            moodToAnalyze = entry.mood;
        }

        const insights = await mockAnalyzeEntry(contentToAnalyze, moodToAnalyze);

        // If we analyzed an existing entry, we could optionally save these insights immediately
        // For now, we return them to the frontend to let the user decide

        // If it's a saved entry, let's update it with the generated lessons/skills if they are empty
        if (entryId) {
            await prisma.entry.update({
                where: { id: entryId },
                data: {
                    lessons: insights.lessons,
                    skills: insights.skills,
                }
            });
        }

        return res.json({
            message: 'Analysis complete',
            insights
        });

    } catch (error) {
        console.error('AI Analysis error:', error);
        return res.status(500).json({ message: 'Failed to analyze entry' });
    }
};

/**
 * Generate a personal statement based on accumulated skills
 */
export const generatePersonalStatement = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.userId;

        // Fetch all user entries that have skills
        const entries = await prisma.entry.findMany({
            where: {
                userId,
                skills: { isEmpty: false }
            },
            select: { skills: true }
        });

        const allSkills: string[] = [];
        entries.forEach(e => allSkills.push(...e.skills));

        // Count frequency
        const skillCounts: Record<string, number> = {};
        allSkills.forEach(skill => {
            skillCounts[skill] = (skillCounts[skill] || 0) + 1;
        });

        // Top 5 skills
        const topSkills = Object.entries(skillCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([skill]) => skill);

        const statement = `Based on your journal entries, you have consistently demonstrated strengths in ${topSkills.join(', ')}. Your reflections show a pattern of growth and self-awareness that would be valuable in any professional setting.`;

        return res.json({
            topSkills,
            statement
        });
    } catch (error) {
        console.error('Personal Statement generation error:', error);
        return res.status(500).json({ message: 'Failed to generate statement' });
    }
};
