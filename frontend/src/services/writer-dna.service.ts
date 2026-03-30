/**
 * Writer DNA — derives personality archetype + trait badges from journal data.
 *
 * Inputs: entries (mood, createdAt, content length), theme clusters, gamification stats.
 * Outputs: archetype name, one-liner, 3 trait badges, matched doodle.
 */

import type { NotebookAccentName, NotebookDoodleName } from '@/components/dashboard/NotebookDoodles';

// ── Types ────────────────────────────────────────────────────

export type WriterTrait = {
    label: string;
    description: string;
};

export type WriterArchetype = {
    name: string;
    oneLiner: string;
    doodle: NotebookDoodleName;
    accent: NotebookAccentName;
};

export type WriterDNA = {
    archetype: WriterArchetype;
    traits: [WriterTrait, WriterTrait, WriterTrait];
};

type EntrySignal = {
    mood: string | null;
    createdAt: string;
    contentLength: number;
};

type ThemeSignal = {
    label: string;
    dominantMood: string | null;
    entryCount: number;
};

export type WriterDNAInput = {
    entries: EntrySignal[];
    themeClusters: ThemeSignal[];
    totalWords: number;
    currentStreak: number;
};

// ── Trait derivation ─────────────────────────────────────────

const REFLECTIVE_MOODS = new Set(['thoughtful', 'calm', 'grateful']);
const INTENSE_MOODS = new Set(['anxious', 'frustrated', 'motivated', 'excited']);
const SOFT_MOODS = new Set(['sad', 'tired', 'hopeful']);

function deriveRhythm(entries: EntrySignal[], streak: number): WriterTrait {
    if (entries.length < 3) return { label: 'Getting started', description: 'Building your rhythm' };

    const hours = entries.slice(0, 20).map((e) => new Date(e.createdAt).getHours());
    const nightCount = hours.filter((h) => h >= 22 || h < 5).length;
    const morningCount = hours.filter((h) => h >= 5 && h < 10).length;
    const eveningCount = hours.filter((h) => h >= 17 && h < 22).length;

    if (nightCount / hours.length > 0.4) return { label: 'Night thinker', description: 'Your best thoughts come after dark' };
    if (morningCount / hours.length > 0.4) return { label: 'Morning clarity', description: 'You process best at first light' };
    if (eveningCount / hours.length > 0.4) return { label: 'Evening unwinder', description: 'You decompress through writing' };
    if (streak >= 7) return { label: 'Steady pulse', description: 'You show up consistently' };
    return { label: 'Spontaneous', description: 'You write when the moment hits' };
}

function deriveEmotionalColor(entries: EntrySignal[]): WriterTrait {
    if (entries.length < 3) return { label: 'Warming up', description: 'Your emotional palette is forming' };

    const moods = entries.slice(0, 30).map((e) => e.mood).filter(Boolean) as string[];
    if (moods.length === 0) return { label: 'Reserved', description: 'You keep feelings close' };

    const uniqueMoods = new Set(moods);
    const reflective = moods.filter((m) => REFLECTIVE_MOODS.has(m)).length;
    const intense = moods.filter((m) => INTENSE_MOODS.has(m)).length;
    const soft = moods.filter((m) => SOFT_MOODS.has(m)).length;

    if (uniqueMoods.size >= 5) return { label: 'Emotionally wide', description: 'You feel the full spectrum' };
    if (reflective / moods.length > 0.5) return { label: 'Deep feeler', description: 'You sit with what you feel' };
    if (intense / moods.length > 0.5) return { label: 'High energy', description: 'Emotions fuel your momentum' };
    if (soft / moods.length > 0.5) return { label: 'Tender observer', description: 'You notice the quiet things' };
    return { label: 'Emotionally aware', description: 'You name what you feel' };
}

function deriveThinkingStyle(entries: EntrySignal[], themes: ThemeSignal[], totalWords: number): WriterTrait {
    if (entries.length < 3) return { label: 'Exploring', description: 'Your thinking style is emerging' };

    const avgLength = totalWords / Math.max(entries.length, 1);
    const focusedThemes = themes.filter((t) => t.entryCount >= 3).length;

    if (focusedThemes >= 3) return { label: 'Pattern finder', description: 'You connect the dots across topics' };
    if (avgLength > 200) return { label: 'Deep diver', description: 'You think in long form' };
    if (avgLength < 50 && entries.length > 10) return { label: 'Quick capturer', description: 'You think in snapshots' };
    if (focusedThemes >= 1) return { label: 'Focused explorer', description: 'You orbit a few key themes' };
    return { label: 'Free thinker', description: 'You let thoughts wander' };
}

// ── Archetype mapping ────────────────────────────────────────

type ArchetypeKey = 'observer' | 'processor' | 'explorer' | 'builder' | 'dreamer' | 'starter';

const ARCHETYPES: Record<ArchetypeKey, WriterArchetype> = {
    observer: {
        name: 'The Quiet Observer',
        oneLiner: 'You write most when processing change',
        doodle: 'moon',
        accent: 'sky',
    },
    processor: {
        name: 'The Deep Processor',
        oneLiner: 'You think by writing it out',
        doodle: 'knot',
        accent: 'lilac',
    },
    explorer: {
        name: 'The Curious Explorer',
        oneLiner: 'Your journal follows your curiosity',
        doodle: 'walker',
        accent: 'apricot',
    },
    builder: {
        name: 'The Steady Builder',
        oneLiner: 'You show up and build, one note at a time',
        doodle: 'ladder',
        accent: 'sage',
    },
    dreamer: {
        name: 'The Open Dreamer',
        oneLiner: 'You capture ideas before they disappear',
        doodle: 'star',
        accent: 'amber',
    },
    starter: {
        name: 'Fresh Page',
        oneLiner: 'Your story is just beginning',
        doodle: 'sprout',
        accent: 'sage',
    },
};

function pickArchetype(traits: [WriterTrait, WriterTrait, WriterTrait], entries: EntrySignal[], streak: number): ArchetypeKey {
    if (entries.length < 3) return 'starter';

    const labels = traits.map((t) => t.label);
    const hasNight = labels.includes('Night thinker');
    const hasDeep = labels.includes('Deep diver') || labels.includes('Deep feeler');
    const hasPattern = labels.includes('Pattern finder') || labels.includes('Focused explorer');
    const hasSteady = labels.includes('Steady pulse') || streak >= 7;
    const hasQuick = labels.includes('Quick capturer') || labels.includes('Spontaneous');
    const hasWide = labels.includes('Emotionally wide') || labels.includes('Free thinker');

    if (hasNight && hasDeep) return 'observer';
    if (hasDeep && hasPattern) return 'processor';
    if (hasWide || (hasQuick && !hasSteady)) return 'explorer';
    if (hasSteady && (hasPattern || hasDeep)) return 'builder';
    if (hasQuick && hasWide) return 'dreamer';
    if (hasSteady) return 'builder';
    if (hasDeep) return 'processor';

    return 'explorer';
}

// ── Public API ───────────────────────────────────────────────

export function deriveWriterDNA(input: WriterDNAInput): WriterDNA {
    const rhythm = deriveRhythm(input.entries, input.currentStreak);
    const emotion = deriveEmotionalColor(input.entries);
    const thinking = deriveThinkingStyle(input.entries, input.themeClusters, input.totalWords);
    const traits: [WriterTrait, WriterTrait, WriterTrait] = [rhythm, emotion, thinking];
    const archetypeKey = pickArchetype(traits, input.entries, input.currentStreak);

    return {
        archetype: ARCHETYPES[archetypeKey],
        traits,
    };
}
