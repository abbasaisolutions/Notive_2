import { buildHomeActionContent } from '../src/services/home-action.service.ts';

type StudentActionResponse = import('../src/components/action/types.ts').StudentActionResponse;
type HomeActionEntry = import('../src/services/home-action.service.ts').HomeActionEntry;
type HomeActionScenario = import('../src/services/home-action.service.ts').HomeActionScenario;
type HomeActionContent = import('../src/services/home-action.service.ts').HomeActionContent;

type ScenarioFixture = {
    id: string;
    title: string;
    entries: HomeActionEntry[];
    onboardingTrackLabel: string;
    fallbackPrompt: string;
    todayAction: StudentActionResponse | null;
    expectedScenario: HomeActionScenario;
    expectedCtaIncludes: string;
    expectedPromptIncludes: string[];
};

const NOW = '2026-03-25T10:00:00.000Z';
const BANNED_PHRASES = ['best friend', "you've got this", 'you got this', '❤️', '!!!', 'teen-proof'];

const makeRisk = (level: StudentActionResponse['risk']['level']): StudentActionResponse['risk'] => ({
    level,
    mode: level === 'none' ? 'normal' : level === 'yellow' ? 'supportive' : level === 'orange' ? 'elevated' : 'emergency',
    signals: [],
    generatedAt: NOW,
});

const makeHighlight = (id: string, reason: string, excerpt: string) => ({
    id,
    title: null,
    createdAt: 'Mar 25, 2026',
    mood: null,
    reason,
    excerpt,
});

const makeAction = (input: {
    riskLevel?: StudentActionResponse['risk']['level'];
    headline: string;
    pattern: string;
    nextMove: NonNullable<NonNullable<StudentActionResponse['brief']>['nextMove']>;
    followUpPrompt: string;
    keep?: NonNullable<NonNullable<StudentActionResponse['brief']>['keep']> | null;
    whatHelpedBefore?: NonNullable<NonNullable<StudentActionResponse['brief']>['whatHelpedBefore']> | null;
    reachOut?: NonNullable<NonNullable<StudentActionResponse['brief']>['reachOut']> | null;
    groundingEntryIds?: string[];
    highlights?: StudentActionResponse['highlights'];
    starter?: StudentActionResponse['starter'] | null;
}): StudentActionResponse => ({
    brief: {
        headline: input.headline,
        pattern: input.pattern,
        whatHelpedBefore: input.whatHelpedBefore ?? null,
        nextMove: input.nextMove,
        reachOut: input.reachOut ?? null,
        keep: input.keep ?? null,
        followUpPrompt: input.followUpPrompt,
        confidence: 0.72,
        groundingEntryIds: input.groundingEntryIds ?? [],
        createdAt: NOW,
    },
    bridge: null,
    risk: makeRisk(input.riskLevel ?? 'none'),
    safetyCard: null,
    highlights: input.highlights ?? [],
    starter: input.starter ?? null,
    source: 'recent_entry',
});

const fixtures: ScenarioFixture[] = [
    {
        id: 'school_burnout',
        title: 'School burnout and procrastination',
        expectedScenario: 'school',
        expectedCtaIncludes: 'next step',
        expectedPromptIncludes: ['school', 'lighter'],
        onboardingTrackLabel: 'Life + Career Growth',
        fallbackPrompt: 'What felt heaviest, clearest, or most unfinished today?',
        entries: [
            { mood: 'overwhelmed', tags: ['school', 'tests'] },
            { mood: 'stressed', tags: ['deadline'] },
            { mood: 'overwhelmed', tags: ['homework'] },
        ],
        todayAction: makeAction({
            headline: 'Make the school problem smaller than it feels.',
            pattern: 'School pressure is crowding the whole picture again around tests and deadlines.',
            nextMove: {
                label: 'Shrink the task',
                description: 'Repeat the easiest version of what helped before, then do one school step for 15 to 20 minutes.',
                effort: 'low',
                type: 'school',
            },
            followUpPrompt: 'Which school task would feel lighter tonight if you made it smaller?',
            whatHelpedBefore: {
                summary: 'Last week, a 15-minute outline helped you start without getting stuck.',
                entryId: 'entry-school-1',
                title: 'After the chemistry quiz',
                reason: 'Helped before',
            },
            keep: {
                label: 'Starting small',
                evidence: 'You keep getting yourself moving by shrinking the first step.',
            },
            groundingEntryIds: ['entry-school-1', 'entry-school-2', 'entry-school-3'],
            highlights: [
                makeHighlight('entry-school-1', 'School pressure', 'The work felt huge until I picked one part.'),
            ],
        }),
    },
    {
        id: 'friendship_drama',
        title: 'Friendship drama and feeling left out',
        expectedScenario: 'conflict',
        expectedCtaIncludes: 'first lines',
        expectedPromptIncludes: ['understood', 'conversation'],
        onboardingTrackLabel: 'Personal Growth',
        fallbackPrompt: 'What felt heaviest, clearest, or most unfinished today?',
        entries: [
            { mood: 'hurt', tags: ['friend'] },
            { mood: 'angry', tags: ['drama'] },
            { mood: 'hurt', tags: ['left out'] },
        ],
        todayAction: makeAction({
            headline: 'Give the conversation a slower first move.',
            pattern: 'A friendship thread is taking up a lot of room right now after a hard message.',
            nextMove: {
                label: 'Draft two calm lines',
                description: 'Write the first two calm lines you want to say before sending a message or starting the conversation.',
                effort: 'low',
                type: 'reach_out',
            },
            followUpPrompt: 'What do you want understood before this becomes a bigger conversation?',
            keep: {
                label: 'Staying thoughtful under pressure',
                evidence: 'You keep trying to respond with care instead of only reacting.',
            },
            groundingEntryIds: ['entry-friend-1', 'entry-friend-2'],
            highlights: [
                makeHighlight('entry-friend-1', 'Friendship tension', 'I want to say something honest without making it worse.'),
            ],
        }),
    },
    {
        id: 'family_grades_conflict',
        title: 'Family tension around grades',
        expectedScenario: 'conflict',
        expectedCtaIncludes: 'first lines',
        expectedPromptIncludes: ['understood', 'conversation'],
        onboardingTrackLabel: 'Personal Growth',
        fallbackPrompt: 'What felt heaviest, clearest, or most unfinished today?',
        entries: [
            { mood: 'frustrated', tags: ['family', 'grades'] },
            { mood: 'frustrated', tags: ['mom'] },
            { mood: 'sad', tags: ['school'] },
        ],
        todayAction: makeAction({
            headline: 'Give the conversation a slower first move.',
            pattern: 'Family pressure is colliding with school stress after another argument about grades.',
            nextMove: {
                label: 'Draft two calm lines',
                description: 'Write the first two calm lines you want to say before starting the next family conversation.',
                effort: 'low',
                type: 'reach_out',
            },
            followUpPrompt: 'What do you want understood before this becomes a bigger conversation?',
            keep: {
                label: 'Holding onto your voice',
                evidence: 'You keep trying to name what is true for you instead of shutting down completely.',
            },
            groundingEntryIds: ['entry-family-1', 'entry-family-2'],
        }),
    },
    {
        id: 'future_anxiety',
        title: 'Future anxiety and college pressure',
        expectedScenario: 'future',
        expectedCtaIncludes: 'next step',
        expectedPromptIncludes: ['future question', 'curiosity'],
        onboardingTrackLabel: 'Career Growth',
        fallbackPrompt: 'What future question feels loudest right now?',
        entries: [
            { mood: 'anxious', tags: ['college'] },
            { mood: 'uncertain', tags: ['future'] },
            { mood: 'anxious', tags: ['career'] },
        ],
        todayAction: makeAction({
            headline: 'Treat this like a direction check, not a final verdict.',
            pattern: 'Future pressure is showing up as uncertainty, not just a planning task.',
            nextMove: {
                label: 'Name one next exposure',
                description: 'Pick one tiny future-facing step this week, like a question to ask, a person to talk to, or one path to read about.',
                effort: 'medium',
                type: 'reflect',
            },
            followUpPrompt: 'Which part of your future question feels like pressure, and which part feels like curiosity?',
            keep: {
                label: 'Staying curious',
                evidence: 'Even when the future feels loud, you keep looking for a real next step instead of freezing.',
            },
            groundingEntryIds: ['entry-future-1', 'entry-future-2', 'entry-future-3'],
        }),
    },
    {
        id: 'energy_reset',
        title: 'Low energy and burnout',
        expectedScenario: 'energy',
        expectedCtaIncludes: 'reset',
        expectedPromptIncludes: ['caring-for-yourself', 'today'],
        onboardingTrackLabel: 'Personal Growth',
        fallbackPrompt: 'What would help you reset before doing anything else?',
        entries: [
            { mood: 'drained', tags: ['burnout'] },
            { mood: 'tired', tags: ['stress'] },
            { mood: 'drained', tags: ['sleep'] },
        ],
        todayAction: makeAction({
            headline: 'Start with the easiest steadying move, then decide what is next.',
            pattern: 'This looks like stress mixed with low energy after a packed week.',
            nextMove: {
                label: 'Do a short reset',
                description: 'Repeat the easiest steadying move that worked before, then choose only one thing to finish or name.',
                effort: 'low',
                type: 'routine',
            },
            followUpPrompt: 'What does the easiest caring-for-yourself version of today look like?',
            whatHelpedBefore: {
                summary: 'A short walk and no-phone break helped you come back steadier last time.',
                entryId: 'entry-energy-1',
                title: 'After practice',
                reason: 'Helped before',
            },
            keep: {
                label: 'Protecting your energy',
                evidence: 'You keep noticing when your body needs something gentler before you can think clearly.',
            },
            groundingEntryIds: ['entry-energy-1', 'entry-energy-2', 'entry-energy-3'],
        }),
    },
    {
        id: 'support_first',
        title: 'Heavy day that needs support first',
        expectedScenario: 'support',
        expectedCtaIncludes: 'what to say',
        expectedPromptIncludes: ['someone else', 'know'],
        onboardingTrackLabel: 'Personal Growth',
        fallbackPrompt: 'What do you need someone else to understand today?',
        entries: [
            { mood: 'overwhelmed', tags: ['alone'] },
            { mood: 'anxious', tags: ['spiral'] },
            { mood: 'overwhelmed', tags: ['support'] },
        ],
        todayAction: makeAction({
            riskLevel: 'orange',
            headline: 'Start with support, not the whole problem.',
            pattern: 'This looks heavier than a normal rough patch and may need real support, not just self-management.',
            nextMove: {
                label: 'Talk to someone today',
                description: 'Choose one trusted adult, counselor, caregiver, or coach and let them know this feels hard to carry alone.',
                effort: 'low',
                type: 'reach_out',
            },
            followUpPrompt: 'If this keeps building tonight, what would you want someone else to know first?',
            keep: {
                label: 'You are still showing up',
                evidence: 'Even a hard note is proof that you are paying attention to what matters.',
            },
            groundingEntryIds: ['entry-support-1', 'entry-support-2', 'entry-support-3'],
        }),
    },
    {
        id: 'first_note',
        title: 'Brand-new user with no history yet',
        expectedScenario: 'general',
        expectedCtaIncludes: 'write',
        expectedPromptIncludes: ['heaviest', 'unfinished'],
        onboardingTrackLabel: 'Personal Reflection',
        fallbackPrompt: 'What felt heaviest, clearest, or most unfinished today?',
        entries: [],
        todayAction: null,
    },
];

const collectText = (content: HomeActionContent) =>
    [
        content.intro,
        content.title,
        content.body,
        content.evidence,
        content.prompt,
        content.primaryCtaLabel,
        content.smallWinTitle,
        content.smallWinBody,
    ].join(' ');

const reviewFixture = (fixture: ScenarioFixture) => {
    const content = buildHomeActionContent({
        todayAction: fixture.todayAction,
        entries: fixture.entries,
        onboardingTrackLabel: fixture.onboardingTrackLabel,
        fallbackPrompt: fixture.fallbackPrompt,
    });

    const errors: string[] = [];
    const combined = collectText(content).toLowerCase();

    if (content.scenario !== fixture.expectedScenario) {
        errors.push(`expected scenario "${fixture.expectedScenario}" but got "${content.scenario}"`);
    }

    if (!content.primaryCtaLabel.toLowerCase().includes(fixture.expectedCtaIncludes.toLowerCase())) {
        errors.push(`expected CTA to include "${fixture.expectedCtaIncludes}" but got "${content.primaryCtaLabel}"`);
    }

    fixture.expectedPromptIncludes.forEach((phrase) => {
        if (!content.prompt.toLowerCase().includes(phrase.toLowerCase())) {
            errors.push(`expected prompt to include "${phrase}" but got "${content.prompt}"`);
        }
    });

    if (!content.prompt.endsWith('?')) {
        errors.push(`prompt should end with a question mark: "${content.prompt}"`);
    }

    if (content.title.length > 48) {
        errors.push(`title is too long (${content.title.length} chars): "${content.title}"`);
    }

    if (content.body.length > 220) {
        errors.push(`body is too long (${content.body.length} chars)`);
    }

    if (content.evidence.length > 220) {
        errors.push(`evidence is too long (${content.evidence.length} chars)`);
    }

    if (content.smallWinBody.length > 170) {
        errors.push(`small-win body is too long (${content.smallWinBody.length} chars)`);
    }

    if (/\bstreak\b/i.test(content.smallWinTitle) || /\bstreak\b/i.test(content.smallWinBody)) {
        errors.push('small-win copy should avoid streak language');
    }

    BANNED_PHRASES.forEach((phrase) => {
        if (combined.includes(phrase.toLowerCase())) {
            errors.push(`copy includes banned phrase "${phrase}"`);
        }
    });

    return { content, errors };
};

let totalFailures = 0;

console.log('Home Action Scenario Review');
console.log('---------------------------');

fixtures.forEach((fixture) => {
    const { content, errors } = reviewFixture(fixture);
    const outcome = errors.length === 0 ? 'PASS' : 'FAIL';

    console.log(`\n[${outcome}] ${fixture.id} (${fixture.title})`);
    console.log(` scenario: ${content.scenario}`);
    console.log(` intro: ${content.intro}`);
    console.log(` title: ${content.title}`);
    console.log(` body: ${content.body}`);
    console.log(` evidence: ${content.evidence}`);
    console.log(` prompt: ${content.prompt}`);
    console.log(` cta: ${content.primaryCtaLabel}`);
    console.log(` small win: ${content.smallWinTitle} -> ${content.smallWinBody}`);

    if (errors.length > 0) {
        totalFailures += errors.length;
        errors.forEach((error) => console.log(`  - ${error}`));
    }
});

if (totalFailures > 0) {
    console.error(`\nScenario review failed with ${totalFailures} issue${totalFailures === 1 ? '' : 's'}.`);
    process.exit(1);
}

console.log(`\nAll ${fixtures.length} home-action scenarios passed.`);
