import type { StudentActionResponse } from '@/components/action/types';

export type HomeActionEntry = {
    mood: string | null;
    tags: string[];
};

export type HomeActionScenario = 'support' | 'school' | 'conflict' | 'future' | 'energy' | 'general';

export type HomeActionContent = {
    intro: string;
    title: string;
    body: string;
    evidence: string;
    prompt: string;
    promptSource: 'follow_up' | 'starter' | 'fallback';
    primaryCtaLabel: string;
    smallWinTitle: string;
    smallWinBody: string;
    scenario: HomeActionScenario;
    groundingCount: number;
};

const SCHOOL_PATTERN = /\b(class|school|teacher|counselor|exam|quiz|assignment|grade|study|studying|homework|deadline|project|semester|college app|application)\b/i;
const CONFLICT_PATTERN = /\b(friend|friendship|drama|fight|argument|bully|bullying|parent|mom|dad|family|coach|roommate|relationship|conversation|message)\b/i;
const FUTURE_PATTERN = /\b(future|college|career|major|resume|statement|interview|scholarship|path|direction)\b/i;
const ENERGY_PATTERN = /\b(tired|exhausted|drained|burned out|burnt out|stressed|overwhelmed|anxious|panic|low energy|reset)\b/i;
const GENERIC_KEEP_PATTERN = /^(you are still showing up|a lesson worth keeping)$/i;

const normalizeText = (value: string | null | undefined, maxLength = 220) => {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

const asSentence = (value: string | null | undefined) => {
    const normalized = normalizeText(value);
    if (!normalized) return '';
    return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
};

const joinSentences = (...parts: Array<string | null | undefined>) =>
    parts
        .map((part) => asSentence(part))
        .filter(Boolean)
        .join(' ');

const toTitleCase = (value: string) =>
    value
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

const getRepeatedMood = (entries: HomeActionEntry[]) => {
    const counts = new Map<string, number>();

    entries.slice(0, 5).forEach((entry) => {
        const mood = normalizeText(entry.mood, 40).toLowerCase();
        if (!mood) return;
        counts.set(mood, (counts.get(mood) || 0) + 1);
    });

    let topMood = '';
    let topCount = 0;
    counts.forEach((count, mood) => {
        if (count > topCount) {
            topMood = mood;
            topCount = count;
        }
    });

    return topCount >= 2 ? topMood : '';
};

const describeMood = (mood: string) => {
    if (!mood) return '';

    if (/(overwhelmed|stressed|stress|anxious|anxiety|panic)/.test(mood)) return 'a lot of pressure';
    if (/(tired|exhausted|drained|low energy|burned out|burnt out)/.test(mood)) return 'low energy';
    if (/(sad|down|hurt|lonely)/.test(mood)) return 'a heavier mood';
    if (/(angry|mad|frustrated)/.test(mood)) return 'some frustration';
    if (/(confused|unsure|uncertain)/.test(mood)) return 'uncertainty';
    if (/(hopeful|calm|steady)/.test(mood)) return 'some steadiness';
    return mood;
};

const inferScenario = (action: StudentActionResponse | null) => {
    if (action?.risk.level === 'orange' || action?.risk.level === 'red') return 'support';

    const nextMoveType = action?.brief?.nextMove?.type || null;
    if (nextMoveType === 'school') return 'school';
    if (nextMoveType === 'routine') return 'energy';

    const combinedText = [
        action?.brief?.headline,
        action?.brief?.pattern,
        action?.brief?.nextMove?.label,
        action?.brief?.nextMove?.description,
        action?.brief?.followUpPrompt,
        action?.brief?.reachOut?.rationale,
        action?.highlights?.map((highlight) => highlight.reason).join(' '),
    ].join(' ');

    if (nextMoveType === 'reach_out' && CONFLICT_PATTERN.test(combinedText)) return 'conflict';
    if (SCHOOL_PATTERN.test(combinedText)) return 'school';
    if (CONFLICT_PATTERN.test(combinedText)) return 'conflict';
    if (FUTURE_PATTERN.test(combinedText)) return 'future';
    if (ENERGY_PATTERN.test(combinedText)) return 'energy';
    return 'general';
};

const buildIntro = (scenario: HomeActionScenario, entriesCount: number) => {
    if (scenario === 'support') return 'Keep today small. Support counts as progress.';
    if (scenario === 'school') return 'You do not need to solve school all at once today.';
    if (scenario === 'conflict') return 'Slow the moment down before it gets louder.';
    if (scenario === 'future') return 'Treat this like a direction check, not a final verdict.';
    if (scenario === 'energy') return 'Start with steadiness before you ask more from yourself.';
    return entriesCount > 2
        ? 'Keep it light. One useful next move is enough for today.'
        : 'Start small. One honest note is enough to turn today into something clearer.';
};

const buildTitle = (scenario: HomeActionScenario) => {
    if (scenario === 'support') return 'Put support first today';
    if (scenario === 'school') return 'Make tonight smaller';
    if (scenario === 'conflict') return 'Slow the next conversation down';
    if (scenario === 'future') return 'Turn the future question into one step';
    if (scenario === 'energy') return 'Reset first, decide second';
    return 'Write the next two sentences';
};

const buildBody = (input: {
    scenario: HomeActionScenario;
    nextMoveDescription: string;
    hasHelpedBefore: boolean;
}) => {
    const { scenario, nextMoveDescription, hasHelpedBefore } = input;

    if (scenario === 'support') {
        return joinSentences(
            'This looks heavier than a normal rough patch.',
            nextMoveDescription || 'You do not need to carry the whole thing alone. Put one steady person in the loop today.'
        );
    }

    if (scenario === 'school') {
        return joinSentences(
            hasHelpedBefore
                ? 'School pressure is loud right now, so start with the easiest version of what has helped before.'
                : 'School pressure is loud right now, so only aim for one short start.',
            nextMoveDescription || 'Pick one task that would make tonight feel lighter, give it a short stretch of attention, and stop there.'
        );
    }

    if (scenario === 'conflict') {
        return joinSentences(
            'A relationship thread is taking up a lot of room.',
            nextMoveDescription || 'Draft the first calm lines before you reply or try to solve the whole thing.'
        );
    }

    if (scenario === 'future') {
        return joinSentences(
            'This feels like pressure more than a final answer.',
            nextMoveDescription || 'Pick one tiny exposure step so the future becomes a little more real and a little less abstract.'
        );
    }

    if (scenario === 'energy') {
        return joinSentences(
            hasHelpedBefore
                ? 'Stress and low energy are showing up together, so start with the smallest reset that has helped before.'
                : 'Stress and low energy are showing up together, so start with the smallest reset you can manage.',
            nextMoveDescription || 'After that, choose one thing to finish or one feeling to name.'
        );
    }

    return joinSentences(
        'You do not need the full answer right now.',
        nextMoveDescription || 'Capture what happened and what you need next in a few honest lines.'
    );
};

const buildEvidence = (input: {
    scenario: HomeActionScenario;
    groundingCount: number;
    repeatedMood: string;
    onboardingTrackLabel: string;
    hasHelpedBefore: boolean;
}) => {
    const evidenceLead = input.groundingCount > 0
        ? `Built from ${input.groundingCount} recent note${input.groundingCount === 1 ? '' : 's'}.`
        : `Current focus: ${input.onboardingTrackLabel}.`;

    const moodDetail = input.repeatedMood ? `Recent notes have been carrying ${describeMood(input.repeatedMood)}.` : '';

    if (input.scenario === 'support') {
        return joinSentences(
            evidenceLead,
            'A few recent notes suggest this needs support, not just more self-management.',
            input.hasHelpedBefore ? 'There is already a steadier note worth reopening.' : null
        );
    }

    if (input.scenario === 'school') {
        return joinSentences(
            evidenceLead,
            'School pressure has shown up more than once lately.',
            input.hasHelpedBefore ? 'There is also a note about what helped before.' : moodDetail
        );
    }

    if (input.scenario === 'conflict') {
        return joinSentences(
            evidenceLead,
            'Relationship tension has shown up more than once lately.',
            input.hasHelpedBefore ? 'There is also a steadier note worth reopening.' : moodDetail
        );
    }

    if (input.scenario === 'future') {
        return joinSentences(
            evidenceLead,
            'Future pressure keeps showing up as something worth making smaller.',
            moodDetail
        );
    }

    if (input.scenario === 'energy') {
        return joinSentences(
            evidenceLead,
            moodDetail || 'Recent notes point to stress mixed with low energy.',
            input.hasHelpedBefore ? 'There is also a note about what helped before.' : null
        );
    }

    const generalDetail = moodDetail || (input.groundingCount > 0 ? `Current focus: ${input.onboardingTrackLabel}.` : '');

    return joinSentences(
        evidenceLead,
        generalDetail,
        input.hasHelpedBefore ? 'There is also a steadier note worth reopening.' : null
    );
};

const buildPrimaryCtaLabel = (scenario: HomeActionScenario) => {
    if (scenario === 'support') return 'Write what to say';
    if (scenario === 'school') return 'Capture the next step';
    if (scenario === 'conflict') return 'Draft the first lines';
    if (scenario === 'future') return 'Name the next step';
    if (scenario === 'energy') return 'Start the reset';
    return 'Write now';
};

const buildFallbackPrompt = (scenario: HomeActionScenario) => {
    if (scenario === 'support') return 'What do you need someone else to understand today, and who could hear it first?';
    if (scenario === 'school') return 'What is the smallest school step that would make tonight feel lighter?';
    if (scenario === 'conflict') return 'What do you want understood before this becomes a bigger conversation?';
    if (scenario === 'future') return 'What part of the future question feels urgent, and what is one tiny next step?';
    if (scenario === 'energy') return 'What reset would help first, and what is the one thing that matters after it?';
    return 'What happened, and what do you need next?';
};

const buildSmallWin = (input: {
    keepLabel: string;
    keepEvidence: string;
    entriesCount: number;
}) => {
    if (input.keepEvidence) {
        return {
            title: input.keepLabel && !GENERIC_KEEP_PATTERN.test(input.keepLabel)
                ? `Growing skill: ${toTitleCase(input.keepLabel)}`
                : input.keepLabel || 'Small wins are still counting',
            body: input.keepEvidence,
        };
    }

    if (input.entriesCount >= 8) {
        return {
            title: 'You have real signal now',
            body: `${input.entriesCount} notes are already enough to make the next suggestion feel more personal instead of generic.`,
        };
    }

    if (input.entriesCount >= 3) {
        return {
            title: 'The pattern is getting easier to see',
            body: `${input.entriesCount} notes are enough for Notive to start noticing what returns, not just what hurts.`,
        };
    }

    if (input.entriesCount >= 1) {
        return {
            title: 'The first notes count',
            body: 'Even a few honest lines give you something real to come back to later.',
        };
    }

    return {
        title: 'Start small',
        body: 'The first honest note is enough to begin.',
    };
};

export const buildHomeActionContent = (input: {
    todayAction: StudentActionResponse | null;
    entries: HomeActionEntry[];
    onboardingTrackLabel: string;
    fallbackPrompt: string;
}): HomeActionContent => {
    const scenario = inferScenario(input.todayAction);
    const groundingCount = input.todayAction?.brief?.groundingEntryIds?.length || input.todayAction?.highlights?.length || 0;
    const repeatedMood = getRepeatedMood(input.entries);
    const nextMoveDescription = normalizeText(input.todayAction?.brief?.nextMove?.description, 190);
    const keepLabel = normalizeText(input.todayAction?.brief?.keep?.label, 80);
    const keepEvidence = normalizeText(input.todayAction?.brief?.keep?.evidence, 170);
    const followUpPrompt = normalizeText(input.todayAction?.brief?.followUpPrompt, 170);
    const starterPrompt = normalizeText(input.todayAction?.starter?.prompt, 170);

    const prompt = followUpPrompt || starterPrompt || normalizeText(input.fallbackPrompt, 170) || buildFallbackPrompt(scenario);
    const promptSource = followUpPrompt ? 'follow_up' : starterPrompt ? 'starter' : 'fallback';

    const smallWin = buildSmallWin({
        keepLabel,
        keepEvidence,
        entriesCount: input.entries.length,
    });

    return {
        intro: buildIntro(scenario, input.entries.length),
        title: buildTitle(scenario),
        body: buildBody({
            scenario,
            nextMoveDescription,
            hasHelpedBefore: Boolean(input.todayAction?.brief?.whatHelpedBefore),
        }),
        evidence: buildEvidence({
            scenario,
            groundingCount,
            repeatedMood,
            onboardingTrackLabel: input.onboardingTrackLabel,
            hasHelpedBefore: Boolean(input.todayAction?.brief?.whatHelpedBefore),
        }),
        prompt,
        promptSource,
        primaryCtaLabel: buildPrimaryCtaLabel(scenario),
        smallWinTitle: smallWin.title,
        smallWinBody: smallWin.body,
        scenario,
        groundingCount,
    };
};

export default buildHomeActionContent;
