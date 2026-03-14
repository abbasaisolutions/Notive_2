type EntryAnalysisRecord = {
    summary: string | null;
    topics: string[];
    keywords: string[];
    suggestedMood: string | null;
};

import type { ProfileContextSummary } from './profile-context.service';

export type OpportunityTemplateVariant = 'standard' | 'college' | 'entry_job';

export type OpportunityEntry = {
    id: string;
    title: string | null;
    content: string;
    mood: string | null;
    tags: string[];
    skills: string[];
    lessons: string[];
    reflection: string | null;
    createdAt: Date;
    analysis: unknown;
    analysisRecord?: EntryAnalysisRecord | null;
};

export type EvidenceField = 'situation' | 'action' | 'lesson' | 'outcome' | 'skills';

export type EvidenceCompleteness = {
    score: number;
    presentCount: number;
    totalCount: number;
    missingFields: EvidenceField[];
    readyForVerification: boolean;
    readyForExport: boolean;
};

export type ExperienceEvidence = {
    id: string;
    entryId: string;
    createdAt: string;
    title: string;
    situation: string;
    action: string;
    lesson: string;
    outcome: string;
    skills: string[];
    mood: string | null;
    confidence: number;
    verified: boolean;
    verificationNotes: string;
    completeness: EvidenceCompleteness;
};

export type EntryStorySignal = {
    status: 'needs_attention' | 'ready_to_verify' | 'ready_to_export' | 'verified';
    completenessScore: number;
    verified: boolean;
    confidence: number;
    readyForVerification: boolean;
    readyForExport: boolean;
    missingFields: EvidenceField[];
};

export type ResumeBullet = {
    id: string;
    entryId: string;
    bullet: string;
    skills: string[];
};

export type InterviewStory = {
    id: string;
    entryId: string;
    title: string;
    situation: string;
    task: string;
    action: string;
    result: string;
};

export type OpportunityOverview = {
    generatedAt: string;
    profileContext: ProfileContextSummary | null;
    stats: {
        entryCount: number;
        experienceCount: number;
        verifiedCount: number;
    };
    topSkills: string[];
    topLessons: string[];
    experiences: ExperienceEvidence[];
    resumeBullets: ResumeBullet[];
    interviewStories: InterviewStory[];
    personalStatement: string;
    statementVariants: Record<OpportunityTemplateVariant, string>;
};

export type GrowthTrendPoint = {
    periodStart: string;
    periodLabel: string;
    entries: number;
    experiences: number;
    verified: number;
    averageConfidence: number;
    topSkills: string[];
    dominantMood: string | null;
};

export type OpportunityTrends = {
    period: 'week' | 'month';
    window: number;
    points: GrowthTrendPoint[];
    progression: {
        verifiedRateNow: number;
        verifiedRateThen: number;
        confidenceNow: number;
        confidenceThen: number;
        entriesNow: number;
        entriesThen: number;
    };
};

type OpportunityMeta = {
    verified?: boolean;
    notes?: string;
    title?: string;
    situation?: string;
    action?: string;
    lesson?: string;
    outcome?: string;
    skills?: string[];
};

const ACTION_PATTERNS = [
    /\b(i|we)\s+(led|organized|built|created|managed|supported|volunteered|resolved|improved|launched|coordinated|presented|mentored|planned)\b[^.!?]*/i,
    /\b(decided to|started|committed to|took initiative to)\b[^.!?]*/i,
    /\b(i|we)\s+(worked on|work on|made|make|wrote|write|studied|study|practiced|practice|implemented|implement|designed|design|shipped|deliver(?:ed)?|completed|finished|fixed|solved|applied|submitted|prepared|tested|reviewed)\b[^.!?]*/i,
    /\b(set up|set out to|focused on|followed through|owned|drove)\b[^.!?]*/i,
];

const LESSON_PATTERNS = [
    /\b(learned that|realized that|discovered that|lesson learned|takeaway)\b[^.!?]*/i,
    /\b(i learned|i realized|i discovered)\b[^.!?]*/i,
    /\b(in hindsight|looking back|next time|would do differently|i should)\b[^.!?]*/i,
    /\b(learned|realized|discovered|understood|noticed|found that)\b[^.!?]*/i,
];

const OUTCOME_PATTERNS = [
    /\b(resulted in|led to|which helped|improved|increased|reduced|completed|achieved|received|earned)\b[^.!?]*/i,
    /\b(outcome|impact|result)\b[^.!?]*/i,
    /\b(as a result|therefore|so that|ended up|helped me|was able to|now)\b[^.!?]*/i,
    /\b(\d+%|\d+\s*(users|clients|customers|days|hours|weeks|months|points|tickets|tasks))\b[^.!?]*/i,
];

const TASK_PATTERNS = [
    /\b(needed to|had to|required to|was responsible for|my goal was to)\b[^.!?]*/i,
    /\b(to|so that)\b[^.!?]*/i,
];

const COMMON_STOPWORDS = new Set([
    'and', 'the', 'with', 'from', 'that', 'this', 'have', 'been', 'were', 'what', 'when', 'into', 'about',
    'just', 'very', 'much', 'more', 'also', 'some', 'your', 'their', 'them', 'they', 'than', 'then', 'over',
]);

const takeFirstSentence = (text: string): string => {
    const trimmed = text.trim();
    if (!trimmed) return '';
    const match = trimmed.match(/[^.!?]+[.!?]?/);
    return (match?.[0] || trimmed).trim();
};

const compactWhitespace = (text: string): string => text.replace(/\s+/g, ' ').trim();

const hasText = (value: string | null | undefined): value is string => typeof value === 'string' && value.trim().length > 0;

const getMatchedSentence = (text: string, patterns: RegExp[]): string => {
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match?.[0]) {
            return compactWhitespace(match[0]);
        }
    }
    return '';
};

const extractSentences = (...inputs: Array<string | null | undefined>): string[] => {
    const raw = inputs.filter(hasText).join('\n');
    if (!raw.trim()) return [];

    const matches = raw.match(/[^.!?\n]+[.!?]?/g) || [];
    const seen = new Set<string>();
    const sentences: string[] = [];

    matches.forEach((chunk) => {
        const sentence = compactWhitespace(chunk);
        if (!sentence) return;
        const key = sentence.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        sentences.push(sentence.slice(0, 800));
    });

    return sentences;
};

const findPatternSentence = (sentences: string[], patterns: RegExp[], exclude: Set<string>): string => {
    for (const sentence of sentences) {
        const key = sentence.toLowerCase();
        if (exclude.has(key)) continue;
        if (patterns.some((pattern) => pattern.test(sentence))) {
            return sentence;
        }
    }
    return '';
};

const ensureSentence = (value: string): string => {
    const normalized = compactWhitespace(value);
    if (!normalized) return '';
    return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
};

const ACTION_VERB_HINT = /\b(led|organized|built|created|managed|supported|volunteered|resolved|improved|launched|coordinated|presented|mentored|planned|worked|made|wrote|studied|practiced|implemented|designed|shipped|delivered|completed|finished|fixed|solved|applied|submitted|prepared|tested|reviewed|started|focused|drove|owned)\b/i;
const OUTCOME_HINT = /\b(resulted in|led to|improved|increased|reduced|achieved|earned|completed|finished|delivered|as a result|therefore|was able to|impact)\b/i;
const LESSON_HINT = /\b(learned|realized|discovered|understood|noticed|takeaway|lesson|in hindsight|looking back|next time|i should)\b/i;
const METRIC_HINT = /\b(\d+%|\d+\s*(users|clients|customers|days|hours|weeks|months|points|tickets|tasks))\b/i;

const pickBestSentence = (
    sentences: string[],
    exclude: Set<string>,
    scorer: (sentence: string) => number,
    minScore = 1
): string => {
    let best = '';
    let bestScore = minScore;

    for (const sentence of sentences) {
        const key = sentence.toLowerCase();
        if (exclude.has(key)) continue;
        const score = scorer(sentence);
        if (score > bestScore) {
            best = sentence;
            bestScore = score;
        }
    }

    return best;
};

const scoreActionSentence = (sentence: string): number => {
    let score = 0;
    if (/\b(i|we)\b/i.test(sentence)) score += 2;
    if (ACTION_VERB_HINT.test(sentence)) score += 3;
    if (/\b(to|for|by)\b/i.test(sentence)) score += 1;
    if (sentence.length >= 20) score += 1;
    return score;
};

const scoreOutcomeSentence = (sentence: string): number => {
    let score = 0;
    if (OUTCOME_HINT.test(sentence)) score += 3;
    if (METRIC_HINT.test(sentence)) score += 3;
    if (/\b(i|we)\b/i.test(sentence)) score += 1;
    return score;
};

const scoreLessonSentence = (sentence: string): number => {
    let score = 0;
    if (LESSON_HINT.test(sentence)) score += 3;
    if (/\b(i|we)\b/i.test(sentence)) score += 1;
    if (/\b(should|need to|next time|would)\b/i.test(sentence)) score += 1;
    return score;
};

const deriveEvidenceCompleteness = ({
    situation,
    action,
    lesson,
    outcome,
    skills,
}: {
    situation: string;
    action: string;
    lesson: string;
    outcome: string;
    skills: string[];
}): EvidenceCompleteness => {
    const fields: Array<{ key: EvidenceField; present: boolean }> = [
        { key: 'situation', present: hasText(situation) },
        { key: 'action', present: hasText(action) },
        { key: 'lesson', present: hasText(lesson) },
        { key: 'outcome', present: hasText(outcome) },
        { key: 'skills', present: Array.isArray(skills) && skills.length > 0 },
    ];

    const presentCount = fields.filter((field) => field.present).length;
    const totalCount = fields.length;
    const missingFields = fields.filter((field) => !field.present).map((field) => field.key);

    const readyForVerification = hasText(situation) && hasText(action) && hasText(lesson) && hasText(outcome);
    const readyForExport = readyForVerification && skills.length > 0;

    return {
        score: Math.round((presentCount / totalCount) * 100),
        presentCount,
        totalCount,
        missingFields,
        readyForVerification,
        readyForExport,
    };
};

const toTitleCase = (value: string) =>
    value
        .split(' ')
        .filter(Boolean)
        .map(token => token.charAt(0).toUpperCase() + token.slice(1))
        .join(' ');

const normalizeSkill = (value: string): string => {
    const cleaned = value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!cleaned || COMMON_STOPWORDS.has(cleaned)) return '';
    return toTitleCase(cleaned);
};

const normalizeTextField = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const normalized = compactWhitespace(value);
    if (!normalized) return undefined;
    return normalized.slice(0, 800);
};

const readEvidenceText = (value: unknown): string | undefined => {
    if (typeof value === 'string') return normalizeTextField(value);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const record = value as Record<string, unknown>;
    return normalizeTextField(record.text);
};

const getOpportunityMeta = (analysis: unknown): OpportunityMeta => {
    if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) return {};
    const record = analysis as Record<string, unknown>;
    const opportunity = record.opportunity;
    const ai = record.ai && typeof record.ai === 'object' && !Array.isArray(record.ai)
        ? (record.ai as Record<string, unknown>)
        : {};
    const aiEvidence = ai.evidence && typeof ai.evidence === 'object' && !Array.isArray(ai.evidence)
        ? (ai.evidence as Record<string, unknown>)
        : {};

    const evidenceSituation = readEvidenceText(aiEvidence.situation);
    const evidenceAction = readEvidenceText(aiEvidence.action);
    const evidenceLesson = readEvidenceText(aiEvidence.lesson);
    const evidenceOutcome = readEvidenceText(aiEvidence.outcome);

    const obj =
        opportunity && typeof opportunity === 'object' && !Array.isArray(opportunity)
            ? (opportunity as Record<string, unknown>)
            : {};
    return {
        verified: typeof obj.verified === 'boolean' ? obj.verified : undefined,
        notes: typeof obj.notes === 'string' ? obj.notes : undefined,
        title: normalizeTextField(obj.title),
        situation: normalizeTextField(obj.situation) || evidenceSituation,
        action: normalizeTextField(obj.action) || evidenceAction,
        lesson: normalizeTextField(obj.lesson) || evidenceLesson,
        outcome: normalizeTextField(obj.outcome) || evidenceOutcome,
        skills: Array.isArray(obj.skills)
            ? obj.skills
                .filter((value): value is string => typeof value === 'string')
                .map(normalizeSkill)
                .filter(Boolean)
                .slice(0, 10)
            : undefined,
    };
};

const getTopValues = (values: string[], limit: number): string[] => {
    const countMap = new Map<string, number>();
    values.forEach((raw) => {
        const normalized = normalizeSkill(raw);
        if (!normalized) return;
        countMap.set(normalized, (countMap.get(normalized) || 0) + 1);
    });

    return [...countMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([value]) => value);
};

const deriveSkills = (entry: OpportunityEntry, opportunityMeta?: OpportunityMeta): string[] => {
    if (opportunityMeta?.skills && opportunityMeta.skills.length > 0) {
        return Array.from(new Set(opportunityMeta.skills.map(normalizeSkill).filter(Boolean))).slice(0, 6);
    }

    const combined = [
        ...(entry.skills || []),
        ...(entry.lessons || []),
        ...(entry.tags || []),
        ...(entry.analysisRecord?.topics || []),
        ...(entry.analysisRecord?.keywords || []),
    ];
    const unique = Array.from(new Set(combined.map(normalizeSkill).filter(Boolean)));
    return unique.slice(0, 6);
};

const deriveTitle = (entry: OpportunityEntry, opportunityMeta?: OpportunityMeta): string => {
    if (opportunityMeta?.title) return opportunityMeta.title;
    if (entry.title && entry.title.trim()) return entry.title.trim();
    if (entry.analysisRecord?.summary) {
        return takeFirstSentence(entry.analysisRecord.summary).slice(0, 90);
    }
    return takeFirstSentence(entry.content).slice(0, 90) || `Entry ${entry.createdAt.toISOString().slice(0, 10)}`;
};

export const deriveExperienceEvidence = (entry: OpportunityEntry): ExperienceEvidence => {
    const baseText = compactWhitespace(`${entry.content}\n${entry.reflection || ''}`);
    const opportunityMeta = getOpportunityMeta(entry.analysis);
    const sentences = extractSentences(entry.content, entry.reflection, entry.analysisRecord?.summary);

    const situation =
        opportunityMeta.situation ||
        takeFirstSentence(entry.content) ||
        sentences[0] ||
        `Entry recorded on ${entry.createdAt.toISOString().slice(0, 10)}`;

    const used = new Set<string>([situation.toLowerCase()]);

    const actionFromPattern = findPatternSentence(sentences, ACTION_PATTERNS, used) || getMatchedSentence(baseText, ACTION_PATTERNS);
    const actionFallback = pickBestSentence(sentences, used, scoreActionSentence, 2);
    const action = opportunityMeta.action || actionFromPattern || actionFallback || '';
    if (action) used.add(action.toLowerCase());

    const primaryLesson = (entry.lessons || []).map(compactWhitespace).find(Boolean) || '';
    const lessonFromPattern = findPatternSentence(sentences, LESSON_PATTERNS, used) || getMatchedSentence(baseText, LESSON_PATTERNS);
    const lessonFallback = pickBestSentence(sentences, used, scoreLessonSentence, 2);
    const reflectionLesson = hasText(entry.reflection) ? takeFirstSentence(entry.reflection) : '';
    const lesson = opportunityMeta.lesson || primaryLesson || lessonFromPattern || lessonFallback || reflectionLesson || '';
    if (lesson) used.add(lesson.toLowerCase());

    const outcomeFromPattern = findPatternSentence(sentences, OUTCOME_PATTERNS, used) || getMatchedSentence(baseText, OUTCOME_PATTERNS);
    const outcomeFallback = pickBestSentence(sentences, used, scoreOutcomeSentence, 2);
    const outcome = opportunityMeta.outcome || outcomeFromPattern || outcomeFallback || '';
    const skills = deriveSkills(entry, opportunityMeta);
    const completeness = deriveEvidenceCompleteness({
        situation,
        action,
        lesson,
        outcome,
        skills,
    });

    const evidenceFields = [situation, action, lesson, outcome].filter((value) => hasText(value)).length;
    let confidence = 0.2 + evidenceFields * 0.16;
    if (entry.title) confidence += 0.05;
    if (entry.lessons?.length) confidence += 0.05;
    if (entry.skills?.length) confidence += 0.05;
    if (entry.analysisRecord?.summary) confidence += 0.05;
    if (skills.length >= 3) confidence += 0.05;
    if (opportunityMeta.verified === true) confidence += 0.08;
    confidence = Math.min(0.98, Number(confidence.toFixed(2)));

    return {
        id: `exp-${entry.id}`,
        entryId: entry.id,
        createdAt: entry.createdAt.toISOString(),
        title: deriveTitle(entry, opportunityMeta),
        situation,
        action,
        lesson,
        outcome,
        skills,
        mood: entry.mood || entry.analysisRecord?.suggestedMood || null,
        confidence,
        verified: opportunityMeta.verified === true,
        verificationNotes: opportunityMeta.notes || '',
        completeness,
    };
};

export const buildEntryStorySignal = (entry: OpportunityEntry): EntryStorySignal => {
    const experience = deriveExperienceEvidence(entry);
    const completeness = experience.completeness;

    return {
        status: experience.verified
            ? 'verified'
            : completeness.readyForExport
                ? 'ready_to_export'
                : completeness.readyForVerification
                    ? 'ready_to_verify'
                    : 'needs_attention',
        completenessScore: completeness.score,
        verified: experience.verified,
        confidence: experience.confidence,
        readyForVerification: completeness.readyForVerification,
        readyForExport: completeness.readyForExport,
        missingFields: completeness.missingFields,
    };
};

const buildResumeBullet = (experience: ExperienceEvidence): ResumeBullet => {
    const evidence = [experience.action, experience.outcome].map(compactWhitespace).filter(Boolean);
    const skillSuffix = experience.skills.length > 0
        ? ` Skills: ${experience.skills.slice(0, 3).join(', ')}.`
        : '';
    const bullet = `${evidence.map(ensureSentence).join(' ')}${skillSuffix}`;

    return {
        id: `bullet-${experience.entryId}`,
        entryId: experience.entryId,
        bullet: compactWhitespace(bullet),
        skills: experience.skills,
    };
};

const buildInterviewStory = (experience: ExperienceEvidence): InterviewStory => ({
    id: `star-${experience.entryId}`,
    entryId: experience.entryId,
    title: experience.title,
    situation: experience.situation,
    task:
        getMatchedSentence(`${experience.situation} ${experience.action}`, TASK_PATTERNS) ||
        experience.situation ||
        experience.action ||
        experience.title,
    action: experience.action,
    result: experience.outcome,
});

const buildPersonalStatement = (experiences: ExperienceEvidence[], topSkills: string[], topLessons: string[]): string => {
    if (experiences.length === 0) {
        return 'Add detailed entries with concrete actions, outcomes, and lessons to generate a portfolio statement.';
    }

    const strongest = experiences.find((experience) => hasText(experience.action) || hasText(experience.lesson) || hasText(experience.outcome)) || experiences[0];
    const skillPhrase = topSkills.slice(0, 3).join(', ');
    const lessonPhrase = topLessons.slice(0, 2).join('; ');

    const lines = [
        `One defining experience was "${strongest.title}".`,
        hasText(strongest.situation) ? `Situation: ${ensureSentence(strongest.situation)}` : '',
        hasText(strongest.action) ? `Action: ${ensureSentence(strongest.action)}` : '',
        hasText(strongest.outcome) ? `Outcome: ${ensureSentence(strongest.outcome)}` : '',
        skillPhrase ? `Repeated strengths: ${skillPhrase}.` : '',
        lessonPhrase ? `Key lessons: ${lessonPhrase}.` : '',
    ].filter(Boolean);

    return lines.join(' ');
};

const buildPersonalStatementVariant = (
    overview: Pick<OpportunityOverview, 'personalStatement' | 'topSkills' | 'topLessons' | 'experiences'>,
    variant: OpportunityTemplateVariant
): string => {
    if (variant === 'standard') {
        return overview.personalStatement;
    }

    const leadExperience = overview.experiences.find((experience) => hasText(experience.action) || hasText(experience.lesson) || hasText(experience.outcome));
    const skills = overview.topSkills.slice(0, 3).join(', ');
    const lessons = overview.topLessons.slice(0, 2).join('; ');

    if (!leadExperience) {
        return 'Add at least one detailed entry with action, lesson, and outcome to generate this statement variant.';
    }

    if (variant === 'college') {
        return [
            `A defining experience was "${leadExperience.title}".`,
            hasText(leadExperience.action) ? `I took action by ${ensureSentence(leadExperience.action).replace(/[.!?]$/, '')}.` : '',
            hasText(leadExperience.outcome) ? `The result was ${ensureSentence(leadExperience.outcome).replace(/[.!?]$/, '')}.` : '',
            hasText(leadExperience.lesson) ? `That experience taught me ${ensureSentence(leadExperience.lesson).replace(/[.!?]$/, '')}.` : '',
            skills ? `Demonstrated strengths: ${skills}.` : '',
            lessons ? `Across entries, key lessons include ${lessons}.` : '',
        ].filter(Boolean).join(' ');
    }

    const leadLine = hasText(leadExperience.action)
        ? `In "${leadExperience.title}", I ${ensureSentence(leadExperience.action).replace(/[.!?]$/, '')}.`
        : hasText(leadExperience.situation)
            ? `In "${leadExperience.title}", the situation was ${ensureSentence(leadExperience.situation).replace(/[.!?]$/, '')}.`
            : `In "${leadExperience.title}".`;

    return [
        leadLine,
        hasText(leadExperience.outcome) ? `This led to ${ensureSentence(leadExperience.outcome).replace(/[.!?]$/, '')}.` : '',
        skills ? `I consistently demonstrated ${skills}.` : '',
        lessons ? `I learned ${lessons}.` : '',
    ].filter(Boolean).join(' ');
};

export const buildOpportunityOverview = (
    entries: OpportunityEntry[],
    profileContext: ProfileContextSummary | null = null
): OpportunityOverview => {
    const experiences = entries
        .map(deriveExperienceEvidence)
        .sort((a, b) => {
            if (a.verified !== b.verified) return a.verified ? -1 : 1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

    const topSkills = getTopValues(experiences.flatMap(e => e.skills), 8);
    const topLessons = getTopValues(experiences.map((e) => e.lesson).filter(Boolean), 6);

    const prioritized = [
        ...experiences.filter(e => e.verified),
        ...experiences.filter(e => !e.verified),
    ];

    const resumeBullets = prioritized
        .filter((experience) => hasText(experience.action) && hasText(experience.outcome))
        .slice(0, 12)
        .map(buildResumeBullet);
    const interviewStories = prioritized
        .filter((experience) => hasText(experience.situation) && hasText(experience.action) && hasText(experience.outcome))
        .slice(0, 6)
        .map(buildInterviewStory);
    const personalStatement = buildPersonalStatement(prioritized, topSkills, topLessons);
    const statementVariants: Record<OpportunityTemplateVariant, string> = {
        standard: personalStatement,
        college: '',
        entry_job: '',
    };

    const overview: OpportunityOverview = {
        generatedAt: new Date().toISOString(),
        profileContext,
        stats: {
            entryCount: entries.length,
            experienceCount: experiences.length,
            verifiedCount: experiences.filter(e => e.verified).length,
        },
        topSkills,
        topLessons,
        experiences,
        resumeBullets,
        interviewStories,
        personalStatement,
        statementVariants,
    };

    overview.statementVariants.college = buildPersonalStatementVariant(overview, 'college');
    overview.statementVariants.entry_job = buildPersonalStatementVariant(overview, 'entry_job');
    return overview;
};

type ExportType = 'resume' | 'statement' | 'interview' | 'growth';
type ExportFormat = 'markdown' | 'json' | 'html';
type TrendPeriod = 'week' | 'month';

const formatExportTimestamp = (value: string): string => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    return parsed.toLocaleString('en-US', {
        dateStyle: 'long',
        timeStyle: 'short',
    });
};

const toDisplayText = (value: string | null | undefined, fallback: string): string => {
    if (typeof value !== 'string') return fallback;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : fallback;
};

const toPercentLabel = (value: number): string => `${Math.round(value * 100)}%`;

const toTitleCaseLabel = (value: string | null | undefined): string => {
    if (!value) return 'Not set';

    return value
        .split(/[_-\s]+/g)
        .filter(Boolean)
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join(' ');
};

const formatListLabel = (values: string[], fallback = 'None yet'): string =>
    values.length > 0 ? values.join(', ') : fallback;

const pushSection = (lines: string[], title: string, sectionLines: string[]) => {
    if (sectionLines.length === 0) return;

    lines.push(`## ${title}`);
    lines.push('');
    lines.push(...sectionLines);
    lines.push('');
};

const buildProfileSnapshotLines = (overview: OpportunityOverview): string[] => {
    const lines = [
        `- Generated: ${formatExportTimestamp(overview.generatedAt)}`,
        `- Verified evidence: ${overview.stats.verifiedCount} of ${overview.stats.experienceCount} experiences`,
        `- Top skills: ${formatListLabel(overview.topSkills)}`,
        `- Top lessons: ${formatListLabel(overview.topLessons)}`,
    ];

    if (overview.profileContext) {
        lines.push(`- Track: ${toTitleCaseLabel(overview.profileContext.track)}`);
        lines.push(`- Profile completion: ${overview.profileContext.completionScore}% (${overview.profileContext.completedFields}/${overview.profileContext.totalFields})`);

        if (overview.profileContext.primaryGoal) {
            lines.push(`- Primary goal: ${overview.profileContext.primaryGoal}`);
        }

        if (overview.profileContext.focusArea) {
            lines.push(`- Focus area: ${toTitleCaseLabel(overview.profileContext.focusArea)}`);
        }

        if (overview.profileContext.experienceLevel) {
            lines.push(`- Experience level: ${toTitleCaseLabel(overview.profileContext.experienceLevel)}`);
        }

        if (overview.profileContext.outputGoals.length > 0) {
            lines.push(`- Output goals: ${overview.profileContext.outputGoals.map((goal) => toTitleCaseLabel(goal)).join(', ')}`);
        }
    }

    return lines;
};

const buildRefinementLines = (overview: OpportunityOverview): string[] => {
    const needsCoreEvidence = overview.experiences.filter((experience) => !experience.completeness.readyForVerification).length;
    const needsSkills = overview.experiences.filter((experience) =>
        experience.completeness.readyForVerification && !experience.completeness.readyForExport
    ).length;
    const unverified = Math.max(overview.stats.experienceCount - overview.stats.verifiedCount, 0);

    const lines: string[] = [];

    if (needsCoreEvidence > 0) {
        lines.push(`- Tighten situation, action, lesson, or outcome detail for ${needsCoreEvidence} experience${needsCoreEvidence === 1 ? '' : 's'}.`);
    }

    if (needsSkills > 0) {
        lines.push(`- Add clearer skill tags to ${needsSkills} export-ready draft${needsSkills === 1 ? '' : 's'} so reviewers can scan them faster.`);
    }

    if (unverified > 0) {
        lines.push(`- Review and verify ${unverified} more experience${unverified === 1 ? '' : 's'} before sending polished packets externally.`);
    }

    if (lines.length === 0) {
        lines.push('- The portfolio is in a strong state for export. The next step is tailoring the draft to a specific role, school, or conversation.');
    }

    return lines;
};

const buildExperienceMap = (overview: OpportunityOverview): Map<string, ExperienceEvidence> =>
    new Map(overview.experiences.map((experience) => [experience.entryId, experience]));

const getHighlightedExperiences = (overview: OpportunityOverview, limit = 4): ExperienceEvidence[] => {
    const experienceMap = buildExperienceMap(overview);
    const selected: ExperienceEvidence[] = [];
    const seen = new Set<string>();

    overview.resumeBullets.forEach((bullet) => {
        const match = experienceMap.get(bullet.entryId);
        if (!match || seen.has(match.entryId) || selected.length >= limit) return;
        selected.push(match);
        seen.add(match.entryId);
    });

    overview.interviewStories.forEach((story) => {
        const match = experienceMap.get(story.entryId);
        if (!match || seen.has(match.entryId) || selected.length >= limit) return;
        selected.push(match);
        seen.add(match.entryId);
    });

    overview.experiences
        .filter((experience) => experience.verified)
        .forEach((experience) => {
            if (seen.has(experience.entryId) || selected.length >= limit) return;
            selected.push(experience);
            seen.add(experience.entryId);
        });

    overview.experiences.forEach((experience) => {
        if (seen.has(experience.entryId) || selected.length >= limit) return;
        selected.push(experience);
        seen.add(experience.entryId);
    });

    return selected.slice(0, limit);
};

const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const renderInlineMarkdown = (value: string): string =>
    escapeHtml(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

const markdownToHtml = (markdown: string): string => {
    const lines = markdown.split('\n');
    const html: string[] = [];
    let inList: 'ul' | 'ol' | null = null;

    const closeList = () => {
        if (!inList) return;
        html.push(`</${inList}>`);
        inList = null;
    };

    lines.forEach((line) => {
        const trimmed = line.trim();

        if (!trimmed) {
            closeList();
            return;
        }

        if (trimmed.startsWith('### ')) {
            closeList();
            html.push(`<h3>${renderInlineMarkdown(trimmed.slice(4))}</h3>`);
            return;
        }

        if (trimmed.startsWith('## ')) {
            closeList();
            html.push(`<h2>${renderInlineMarkdown(trimmed.slice(3))}</h2>`);
            return;
        }

        if (trimmed.startsWith('# ')) {
            closeList();
            html.push(`<h1>${renderInlineMarkdown(trimmed.slice(2))}</h1>`);
            return;
        }

        const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
        if (orderedMatch) {
            if (inList === 'ul') {
                html.push('</ul>');
                inList = null;
            }
            if (inList !== 'ol') {
                html.push('<ol>');
                inList = 'ol';
            }
            html.push(`<li>${renderInlineMarkdown(orderedMatch[1])}</li>`);
            return;
        }

        const bulletMatch = trimmed.match(/^-\s+(.*)$/);
        if (bulletMatch) {
            if (inList === 'ol') {
                html.push('</ol>');
                inList = null;
            }
            if (inList !== 'ul') {
                html.push('<ul>');
                inList = 'ul';
            }
            html.push(`<li>${renderInlineMarkdown(bulletMatch[1])}</li>`);
            return;
        }

        closeList();
        html.push(`<p>${renderInlineMarkdown(trimmed)}</p>`);
    });

    closeList();
    return html.join('\n');
};

const renderOpportunityHtmlDocument = (type: ExportType, markdownBody: string): string => {
    const accents: Record<ExportType, string> = {
        resume: '#174ea6',
        statement: '#9c4221',
        interview: '#0f766e',
        growth: '#2b6b3f',
    };
    const accent = accents[type];
    const body = markdownToHtml(markdownBody);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Notive Export</title>
  <style>
    :root {
      --accent: ${accent};
      --ink: #16202d;
      --muted: #536171;
      --line: #d7dfeb;
      --paper: #ffffff;
      --wash: #eef3f8;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: linear-gradient(180deg, #f3f6fa 0%, var(--wash) 100%); color: var(--ink); font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; }
    body { padding: 32px 18px; }
    .page {
      max-width: 860px;
      margin: 0 auto;
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 28px;
      padding: 44px 52px;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12);
    }
    .page::before {
      content: "NOTIVE EXPORT";
      display: inline-flex;
      align-items: center;
      margin-bottom: 18px;
      padding: 8px 12px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--accent) 12%, white);
      color: var(--accent);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.16em;
    }
    h1, h2, h3 { margin: 0; color: #0f172a; }
    h1 {
      font-size: 2rem;
      line-height: 1.15;
      margin-bottom: 1.2rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid color-mix(in srgb, var(--accent) 18%, white);
      font-family: Georgia, "Times New Roman", serif;
    }
    h2 {
      margin-top: 2rem;
      margin-bottom: 0.85rem;
      font-size: 1.12rem;
      letter-spacing: 0.02em;
      color: var(--accent);
    }
    h3 {
      margin-top: 1.25rem;
      margin-bottom: 0.5rem;
      font-size: 0.98rem;
    }
    p, li {
      margin: 0;
      font-size: 0.98rem;
      line-height: 1.7;
      color: var(--ink);
    }
    p + p { margin-top: 0.85rem; }
    ul, ol {
      margin: 0.6rem 0 0;
      padding-left: 1.3rem;
    }
    li + li { margin-top: 0.35rem; }
    strong { color: #0f172a; }
    @page { margin: 0.5in; }
    @media print {
      body { background: white; padding: 0; }
      .page {
        max-width: none;
        border: 0;
        border-radius: 0;
        box-shadow: none;
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <main class="page">
    ${body}
  </main>
</body>
</html>`;
};

const finalizeOpportunityDocument = (
    type: ExportType,
    format: Exclude<ExportFormat, 'json'>,
    fileName: string,
    markdownBody: string
): { fileName: string; contentType: string; body: string } => {
    if (format === 'html') {
        return {
            fileName: fileName.replace(/\.md$/i, '.html'),
            contentType: 'text/html; charset=utf-8',
            body: renderOpportunityHtmlDocument(type, markdownBody),
        };
    }

    return {
        fileName,
        contentType: 'text/markdown; charset=utf-8',
        body: markdownBody,
    };
};

const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0=Sun
    const diff = (day + 6) % 7; // monday start
    d.setDate(d.getDate() - diff);
    return d;
};

const getMonthStart = (date: Date): Date => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(1);
    return d;
};

const addPeriods = (date: Date, period: TrendPeriod, step: number): Date => {
    const d = new Date(date);
    if (period === 'week') {
        d.setDate(d.getDate() + step * 7);
    } else {
        d.setMonth(d.getMonth() + step);
    }
    return d;
};

const formatPeriodLabel = (start: Date, period: TrendPeriod): string => {
    if (period === 'week') {
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    }
    return start.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

export const buildOpportunityTrends = (
    entries: OpportunityEntry[],
    period: TrendPeriod = 'month',
    window = 6
): OpportunityTrends => {
    const safeWindow = Math.min(Math.max(window, 3), 24);
    const experiences = entries.map(deriveExperienceEvidence);

    const now = new Date();
    const currentStart = period === 'week' ? getWeekStart(now) : getMonthStart(now);
    const starts: Date[] = [];
    for (let i = safeWindow - 1; i >= 0; i--) {
        starts.push(addPeriods(currentStart, period, -i));
    }

    const points: GrowthTrendPoint[] = starts.map((start) => {
        const nextStart = addPeriods(start, period, 1);
        const bucket = experiences.filter((experience) => {
            const created = new Date(experience.createdAt);
            return created >= start && created < nextStart;
        });

        const moodCounts = new Map<string, number>();
        const skillCounts = new Map<string, number>();

        bucket.forEach((experience) => {
            if (experience.mood) {
                moodCounts.set(experience.mood, (moodCounts.get(experience.mood) || 0) + 1);
            }
            experience.skills.forEach((skill) => {
                skillCounts.set(skill, (skillCounts.get(skill) || 0) + 1);
            });
        });

        const dominantMood = [...moodCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
        const topSkills = [...skillCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([skill]) => skill);

        const averageConfidence = bucket.length === 0
            ? 0
            : Number((bucket.reduce((sum, item) => sum + item.confidence, 0) / bucket.length).toFixed(3));

        return {
            periodStart: start.toISOString(),
            periodLabel: formatPeriodLabel(start, period),
            entries: bucket.length,
            experiences: bucket.length,
            verified: bucket.filter((item) => item.verified).length,
            averageConfidence,
            topSkills,
            dominantMood,
        };
    });

    const first = points[0] || {
        verified: 0, experiences: 0, averageConfidence: 0, entries: 0,
    };
    const last = points[points.length - 1] || first;

    const verifiedRateNow = last.experiences > 0 ? Number((last.verified / last.experiences).toFixed(3)) : 0;
    const verifiedRateThen = first.experiences > 0 ? Number((first.verified / first.experiences).toFixed(3)) : 0;

    return {
        period,
        window: safeWindow,
        points,
        progression: {
            verifiedRateNow,
            verifiedRateThen,
            confidenceNow: Number((last.averageConfidence || 0).toFixed(3)),
            confidenceThen: Number((first.averageConfidence || 0).toFixed(3)),
            entriesNow: last.entries || 0,
            entriesThen: first.entries || 0,
        },
    };
};

export const buildOpportunityExport = (
    overview: OpportunityOverview,
    type: ExportType,
    format: ExportFormat,
    variant: OpportunityTemplateVariant = 'standard'
): { fileName: string; contentType: string; body: string } => {
    if (format === 'json') {
        const payload =
            type === 'resume'
                ? { generatedAt: overview.generatedAt, variant, resumeBullets: overview.resumeBullets }
                : type === 'statement'
                    ? { generatedAt: overview.generatedAt, variant, personalStatement: overview.statementVariants[variant] || overview.personalStatement }
                    : type === 'interview'
                        ? { generatedAt: overview.generatedAt, variant, interviewStories: overview.interviewStories }
                        : {
                            generatedAt: overview.generatedAt,
                            variant,
                            stats: overview.stats,
                            topSkills: overview.topSkills,
                            topLessons: overview.topLessons,
                            experiences: overview.experiences,
                        };

        return {
            fileName: `notive-${type}-${variant}-export.json`,
            contentType: 'application/json',
            body: JSON.stringify(payload, null, 2),
        };
    }

    if (type === 'resume') {
        const heading = variant === 'college'
            ? '# Notive Application Experience Pack'
            : variant === 'entry_job'
                ? '# Notive Early-Career Resume Pack'
                : '# Notive Resume Pack';
        const highlightExperiences = getHighlightedExperiences(overview, 4);
        const lines = [heading, '', `Prepared for: ${toTitleCaseLabel(variant)}`, ''];

        pushSection(lines, 'Positioning Snapshot', [
            ...buildProfileSnapshotLines(overview),
            `- Resume bullets ready: ${overview.resumeBullets.length}`,
        ]);

        pushSection(
            lines,
            'Ready-to-Use Resume Bullets',
            overview.resumeBullets.length > 0
                ? overview.resumeBullets.map((item, idx) => `${idx + 1}. ${item.bullet}`)
                : ['No resume-ready evidence yet. Add entries with clear action and outcome details.']
        );

        pushSection(
            lines,
            'Supporting Evidence Highlights',
            highlightExperiences.length > 0
                ? highlightExperiences.flatMap((experience, idx) => [
                    `### ${idx + 1}. ${experience.title}${experience.verified ? ' (Verified)' : ''}`,
                    `- Date: ${new Date(experience.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}`,
                    `- Situation: ${toDisplayText(experience.situation, 'Capture more context before external use.')}`,
                    `- Outcome signal: ${toDisplayText(experience.outcome, 'Quantify the result so this reads stronger in a resume.')}`,
                    `- Skills surfaced: ${formatListLabel(experience.skills, 'Add skill tags before finalizing.')}`,
                    `- Reflection angle: ${toDisplayText(experience.lesson, 'Clarify what this experience taught you.')}`,
                    '',
                ])
                : ['No supporting evidence has been mapped yet.']
        );

        pushSection(lines, 'Refine Before Sending', buildRefinementLines(overview));

        return finalizeOpportunityDocument(type, format, `notive-resume-pack-${variant}.md`, lines.join('\n'));
    }

    if (type === 'statement') {
        const statement = overview.statementVariants[variant] || overview.personalStatement;
        const heading = variant === 'college'
            ? '# Notive College Statement Draft'
            : variant === 'entry_job'
                ? '# Notive Early-Career Personal Profile'
                : '# Notive Personal Statement Draft';
        const storyAnchors = getHighlightedExperiences(overview, 3);
        const lines = [heading, '', `Prepared for: ${toTitleCaseLabel(variant)}`, ''];

        pushSection(lines, 'Narrative Frame', buildProfileSnapshotLines(overview));
        pushSection(lines, 'Draft Statement', [
            statement || 'No statement draft is available yet. Add more evidence and a clearer profile direction.',
        ]);
        pushSection(
            lines,
            'Story Anchors To Weave In',
            storyAnchors.length > 0
                ? storyAnchors.flatMap((experience, idx) => [
                    `### ${idx + 1}. ${experience.title}`,
                    `- Why it matters: ${toDisplayText(experience.outcome, 'Add a clear result so this story carries more weight.')}`,
                    `- Personal growth angle: ${toDisplayText(experience.lesson, 'Add the lesson learned to strengthen the reflection arc.')}`,
                    `- Signals: ${formatListLabel(experience.skills, 'Add a few skills or strengths to reinforce this example.')}`,
                    '',
                ])
                : ['No strong story anchors are available yet. Build out a few verified experiences first.']
        );
        pushSection(lines, 'Refine Before Sending', buildRefinementLines(overview));

        return finalizeOpportunityDocument(type, format, `notive-personal-statement-${variant}.md`, lines.join('\n'));
    }

    if (type === 'interview') {
        const experienceMap = buildExperienceMap(overview);
        const lines = ['# Notive Interview Story Bank', '', `Prepared for: ${toTitleCaseLabel(variant)}`, ''];

        pushSection(lines, 'How To Use This Bank', [
            '- Choose one story that matches the role, challenge, or competency being discussed.',
            '- Keep the spoken answer to roughly 60 to 90 seconds, then expand only if the interviewer asks for more detail.',
            '- Lead with the result, then show the action you owned and what you learned from it.',
        ]);

        if (overview.interviewStories.length === 0) {
            pushSection(lines, 'Stories', [
                'No interview-ready stories yet. Add entries with concrete situation, action, and result details.',
            ]);
        } else {
            overview.interviewStories.forEach((story, idx) => {
                const evidence = experienceMap.get(story.entryId);
                lines.push(`## Story ${idx + 1}: ${story.title}`);
                lines.push('');
                lines.push('**Situation**');
                lines.push(story.situation || 'Add context before using this story live.');
                lines.push('');
                lines.push('**Task**');
                lines.push(story.task || 'Clarify the responsibility or goal you owned.');
                lines.push('');
                lines.push('**Action**');
                lines.push(story.action || 'Add clearer action detail before using this story live.');
                lines.push('');
                lines.push('**Result**');
                lines.push(story.result || 'Add the result or impact to make this answer credible.');
                lines.push('');
                lines.push('**Signals To Mention**');
                lines.push(formatListLabel(evidence?.skills || [], 'Add skill tags to sharpen this answer.'));
                lines.push('');
                lines.push('**Source Notes**');
                lines.push(`- Evidence status: ${evidence?.verified ? 'Verified' : 'Draft'}`);
                lines.push(`- Confidence: ${evidence ? toPercentLabel(evidence.confidence) : 'Not scored'}`);
                lines.push(`- Reflection angle: ${toDisplayText(evidence?.lesson, 'Add a lesson learned so this story feels complete.')}`);
                lines.push('');
            });
        }

        pushSection(lines, 'Refine Before Interviewing', buildRefinementLines(overview));

        return finalizeOpportunityDocument(type, format, `notive-interview-stories-${variant}.md`, lines.join('\n'));
    }

    const averageConfidence = overview.experiences.length > 0
        ? overview.experiences.reduce((sum, experience) => sum + experience.confidence, 0) / overview.experiences.length
        : 0;
    const lines = ['# Notive Growth Portfolio Report', '', `Prepared for: ${toTitleCaseLabel(variant)}`, ''];

    pushSection(lines, 'Portfolio Snapshot', [
        `- Generated: ${formatExportTimestamp(overview.generatedAt)}`,
        `- Entries analyzed: ${overview.stats.entryCount}`,
        `- Experiences mapped: ${overview.stats.experienceCount}`,
        `- Verified experiences: ${overview.stats.verifiedCount}`,
        `- Average confidence: ${toPercentLabel(averageConfidence)}`,
        ...(overview.profileContext
            ? [
                `- Profile completion: ${overview.profileContext.completionScore}% (${overview.profileContext.completedFields}/${overview.profileContext.totalFields})`,
                `- Journey track: ${toTitleCaseLabel(overview.profileContext.track)}`,
                `- Personal growth score: ${overview.profileContext.personalGrowthScore}%`,
                `- Professional readiness score: ${overview.profileContext.professionalReadinessScore}%`,
            ]
            : []),
    ]);

    pushSection(lines, 'Strength Themes', [
        `- Top skills: ${formatListLabel(overview.topSkills)}`,
        `- Top lessons: ${formatListLabel(overview.topLessons)}`,
    ]);

    pushSection(
        lines,
        'Evidence Ledger',
        overview.experiences.slice(0, 12).flatMap((experience, idx) => [
            `### ${idx + 1}. ${experience.title}${experience.verified ? ' (Verified)' : ''}`,
            `- Date: ${new Date(experience.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}`,
            `- Confidence: ${toPercentLabel(experience.confidence)}`,
            `- Completeness: ${experience.completeness.score}%`,
            `- Situation: ${toDisplayText(experience.situation, 'Add more context.')}`,
            `- Action: ${toDisplayText(experience.action, 'Add clearer action detail.')}`,
            `- Outcome: ${toDisplayText(experience.outcome, 'Add a measurable outcome.')}`,
            `- Lesson: ${toDisplayText(experience.lesson, 'Add the growth takeaway.')}`,
            `- Skills: ${formatListLabel(experience.skills, 'Add skill tags.')}`,
            '',
        ])
    );

    pushSection(lines, 'Recommended Next Moves', buildRefinementLines(overview));

    return finalizeOpportunityDocument(type, format, `notive-growth-portfolio-${variant}.md`, lines.join('\n'));
};
