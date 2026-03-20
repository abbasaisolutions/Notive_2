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

export type OpportunityProfileIdentity = {
    name: string | null;
    email: string | null;
    occupation: string | null;
    location: string | null;
    website: string | null;
    bio: string | null;
};

export type OpportunityOverview = {
    generatedAt: string;
    profileContext: ProfileContextSummary | null;
    profileIdentity: OpportunityProfileIdentity | null;
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

const SKILL_STOPWORDS = new Set([
    'learned', 'realized', 'noticed', 'discovered', 'because', 'after', 'before', 'today', 'yesterday',
    'feeling', 'felt', 'feels', 'should', 'could', 'would', 'need', 'needed', 'trying', 'tried',
]);

const THEME_STOPWORDS = new Set([
    ...COMMON_STOPWORDS,
    'learned', 'realized', 'noticed', 'discovered', 'lesson', 'takeaway',
]);

const RESULT_HINT = /\b(achieved|improved|increased|reduced|launched|completed|delivered|resolved|saved|earned|won|shipped|published|grew|raised|improved|helped)\b/i;
const METRIC_SIGNAL = /\b(\d+%|\d+\s*(users|clients|customers|days|hours|weeks|months|years|points|tickets|tasks|people|students|projects|events)|\$[\d,.]+)\b/i;
const FIRST_PERSON_LEAD = /^(i|we)\s+/i;
const RESUME_RESULT_LEAD = /^(the result was|this led to|it led to|it resulted in|resulted in|led to|was able to)\s+/i;
const LESSON_LEAD = /^(i|we)\s+(learned|realized|noticed|discovered|understood)(\s+that)?\s+/i;

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

const normalizeSkillLabel = (value: string): string => {
    const cleaned = value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!cleaned || COMMON_STOPWORDS.has(cleaned) || SKILL_STOPWORDS.has(cleaned)) return '';

    const tokens = cleaned.split(' ').filter(Boolean);
    if (tokens.length === 0 || tokens.length > 4) return '';
    if (tokens.some((token) => COMMON_STOPWORDS.has(token) || SKILL_STOPWORDS.has(token))) return '';
    if (/\b(i|we|my|our|me|us)\b/.test(cleaned)) return '';

    return toTitleCase(cleaned);
};

const normalizeLessonTheme = (value: string): string => {
    const sentence = compactWhitespace(value)
        .replace(LESSON_LEAD, '')
        .replace(/^(that|how)\s+/i, '')
        .trim();
    if (!sentence) return '';

    const tokens = (sentence.toLowerCase().match(/\b[a-z0-9'-]+\b/g) || [])
        .filter((token) => token.length >= 3 && !THEME_STOPWORDS.has(token))
        .slice(0, 6);
    if (tokens.length === 0) {
        return takeFirstSentence(sentence).slice(0, 72);
    }
    return toTitleCase(tokens.join(' '));
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
                .map(normalizeSkillLabel)
                .filter(Boolean)
                .slice(0, 10)
            : undefined,
    };
};

const incrementCount = (countMap: Map<string, number>, key: string) => {
    countMap.set(key, (countMap.get(key) || 0) + 1);
};

const addNormalizedCount = (countMap: Map<string, number>, raw: string, normalizer: (value: string) => string = normalizeSkill) => {
    const normalized = normalizer(raw);
    if (!normalized) return;
    incrementCount(countMap, normalized);
};

const getTopCountValues = (countMap: Map<string, number>, limit: number): string[] =>
    [...countMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([value]) => value);

const deriveSkills = (entry: OpportunityEntry, opportunityMeta?: OpportunityMeta): string[] => {
    if (opportunityMeta?.skills && opportunityMeta.skills.length > 0) {
        return Array.from(new Set(opportunityMeta.skills.map(normalizeSkillLabel).filter(Boolean))).slice(0, 6);
    }

    const combined = [
        ...(entry.skills || []),
        ...(entry.tags || []),
        ...(entry.analysisRecord?.topics || []),
        ...(entry.analysisRecord?.keywords || []),
    ];
    const unique = Array.from(new Set(combined.map(normalizeSkillLabel).filter(Boolean)));
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

const buildExperiencePriority = (experience: ExperienceEvidence): number => {
    const ageDays = Math.max(
        0,
        Math.floor((Date.now() - new Date(experience.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    );
    const recencyScore = Math.max(0, 1 - Math.min(ageDays, 365) / 365);
    const quantifiedOutcome = METRIC_SIGNAL.test(experience.outcome);
    const resultSignal = RESULT_HINT.test(experience.outcome) || quantifiedOutcome;
    const completeCore = hasText(experience.action) && hasText(experience.outcome);

    let score = 0;
    score += experience.verified ? 3.2 : 0;
    score += (experience.completeness.score / 100) * 2.4;
    score += experience.confidence * 2;
    score += completeCore ? 1.2 : 0;
    score += quantifiedOutcome ? 1.5 : 0;
    score += resultSignal ? 0.8 : 0;
    score += Math.min(experience.skills.length, 4) * 0.2;
    score += recencyScore * 0.35;

    return Number(score.toFixed(3));
};

const selectTopExperiences = (
    experiences: ExperienceEvidence[],
    limit: number,
    predicate: (experience: ExperienceEvidence) => boolean = () => true
): ExperienceEvidence[] => {
    const pool = experiences.filter(predicate).slice();
    const selected: ExperienceEvidence[] = [];
    const usedSkillKeys = new Set<string>();
    const usedTitleKeys = new Set<string>();

    while (pool.length > 0 && selected.length < limit) {
        let bestIndex = 0;
        let bestScore = -Infinity;

        pool.forEach((experience, index) => {
            const novelSkillCount = experience.skills.filter((skill) => !usedSkillKeys.has(skill.toLowerCase())).length;
            const titleKey = experience.title.toLowerCase();
            const diversityBonus = novelSkillCount * 0.45 - (usedTitleKeys.has(titleKey) ? 0.75 : 0);
            const totalScore = buildExperiencePriority(experience) + diversityBonus;

            if (totalScore > bestScore) {
                bestScore = totalScore;
                bestIndex = index;
            }
        });

        const [chosen] = pool.splice(bestIndex, 1);
        if (!chosen) break;
        selected.push(chosen);
        usedTitleKeys.add(chosen.title.toLowerCase());
        chosen.skills.forEach((skill) => usedSkillKeys.add(skill.toLowerCase()));
    }

    return selected;
};

const stripTrailingPunctuation = (value: string) => value.replace(/[.!?]+$/g, '').trim();

const normalizeResumeLead = (value: string): string => {
    const normalized = stripTrailingPunctuation(compactWhitespace(value))
        .replace(FIRST_PERSON_LEAD, '')
        .replace(/^was able to\s+/i, '')
        .trim();
    if (!normalized) return '';
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const normalizeResumeOutcome = (value: string): string => {
    const normalized = stripTrailingPunctuation(compactWhitespace(value))
        .replace(RESUME_RESULT_LEAD, '')
        .replace(FIRST_PERSON_LEAD, '')
        .trim();
    if (!normalized) return '';
    if (RESULT_HINT.test(normalized) || METRIC_SIGNAL.test(normalized)) {
        return `resulting in ${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}`;
    }
    return `with impact on ${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}`;
};

const normalizeResumeContext = (value: string): string => {
    const normalized = stripTrailingPunctuation(compactWhitespace(value));
    if (!normalized || normalized.length > 90) return '';
    return `in ${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}`;
};

const buildResumeBullet = (experience: ExperienceEvidence): ResumeBullet => {
    const lead = normalizeResumeLead(experience.action || experience.title);
    const outcome = normalizeResumeOutcome(experience.outcome);
    const context = outcome ? '' : normalizeResumeContext(experience.situation);
    const skills = experience.skills.length > 0 ? `using ${experience.skills.slice(0, 3).join(', ')}` : '';
    const clauses = [lead, context, outcome];

    if (skills && clauses.join(', ').length < 145) {
        clauses.push(skills);
    }

    const bullet = ensureSentence(clauses.filter(Boolean).join(', '));

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

const buildNarrativeAction = (value: string): string => {
    const normalized = stripTrailingPunctuation(compactWhitespace(value))
        .replace(FIRST_PERSON_LEAD, '')
        .trim();
    if (!normalized) return '';
    return `${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}`;
};

const buildNarrativeOutcome = (value: string): string => {
    const normalized = stripTrailingPunctuation(compactWhitespace(value))
        .replace(RESUME_RESULT_LEAD, '')
        .replace(FIRST_PERSON_LEAD, '')
        .trim();
    if (!normalized) return '';
    return `${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}`;
};

const buildStatementDraft = (
    overview: Pick<OpportunityOverview, 'profileContext' | 'topSkills' | 'topLessons' | 'experiences'>,
    variant: OpportunityTemplateVariant
): string => {
    if (overview.experiences.length === 0) {
        return 'Add detailed entries with concrete actions, outcomes, and lessons to generate a stronger draft.';
    }

    const anchors = selectTopExperiences(
        overview.experiences,
        3,
        (experience) => hasText(experience.action) || hasText(experience.outcome) || hasText(experience.lesson)
    );
    const lead = anchors[0] || overview.experiences[0];
    const growth = anchors.find((experience) => experience.entryId !== lead.entryId && hasText(experience.lesson)) || anchors[1] || null;
    const support = anchors.find((experience) => experience.entryId !== lead.entryId && (!growth || experience.entryId !== growth.entryId)) || anchors[2] || null;
    const topSkills = overview.topSkills.slice(0, 3);
    const topLessons = overview.topLessons.slice(0, 2);
    const primaryGoal = overview.profileContext?.primaryGoal;
    const focusArea = overview.profileContext?.focusArea;
    const outputGoal = overview.profileContext?.outputGoals?.[0] || null;
    const experienceLevel = overview.profileContext?.experienceLevel;
    const skillPhrase = topSkills.length > 0 ? topSkills.join(', ') : 'adaptability and follow-through';

    const sentences: string[] = [];
    if (variant === 'college') {
        sentences.push(
            primaryGoal
                ? `I am building toward ${primaryGoal}, and my journal shows that the work I care about most is grounded in ${skillPhrase}.`
                : `My journal points to a consistent pattern of curiosity, effort, and growth through ${skillPhrase}.`
        );
    } else if (variant === 'entry_job') {
        sentences.push(
            primaryGoal
                ? `I am preparing for ${primaryGoal} by building repeatable strengths in ${skillPhrase}.`
                : `I am early in my journey, but my entries already show dependable strengths in ${skillPhrase}.`
        );
    } else {
        sentences.push(
            primaryGoal
                ? `I am building toward ${primaryGoal}, with repeated evidence of ${skillPhrase}.`
                : `Across my entries, a clear direction emerges through repeated strengths in ${skillPhrase}.`
        );
    }

    const leadAction = buildNarrativeAction(lead.action);
    const leadOutcome = buildNarrativeOutcome(lead.outcome);
    if (leadAction && leadOutcome) {
        sentences.push(`In "${lead.title}", I ${leadAction}, which ${leadOutcome}.`);
    } else if (leadAction) {
        sentences.push(`In "${lead.title}", I ${leadAction}.`);
    } else if (leadOutcome) {
        sentences.push(`A defining result from "${lead.title}" was that it ${leadOutcome}.`);
    }

    if (growth?.lesson) {
        const lesson = stripTrailingPunctuation(growth.lesson).replace(LESSON_LEAD, '').trim();
        if (lesson) {
            sentences.push(
                variant === 'college'
                    ? `That process also taught me ${lesson.charAt(0).toLowerCase()}${lesson.slice(1)}, which is shaping how I approach new challenges.`
                    : `That work taught me ${lesson.charAt(0).toLowerCase()}${lesson.slice(1)}, and it now shapes how I work.`
            );
        }
    } else if (topLessons.length > 0) {
        sentences.push(`A recurring lesson across these entries is ${topLessons.join(' and ').toLowerCase()}.`);
    }

    if (support) {
        const supportAction = buildNarrativeAction(support.action);
        const supportOutcome = buildNarrativeOutcome(support.outcome);
        if (supportAction && supportOutcome) {
            sentences.push(`That same pattern appears again in "${support.title}", where I ${supportAction} and ${supportOutcome}.`);
        }
    }

    if (variant === 'college') {
        sentences.push(
            outputGoal
                ? `I want to bring that mix of reflection and initiative into ${outputGoal.replace(/-/g, ' ')}.`
                : `I want to bring that mix of reflection and initiative into the next learning environment I join.`
        );
    } else if (variant === 'entry_job') {
        sentences.push(
            outputGoal
                ? `I am ready to keep growing in ${outputGoal.replace(/-/g, ' ')}, while contributing with the same consistency.`
                : `I am ready to contribute in an early-career role while continuing to grow through real work.`
        );
    } else {
        const direction = outputGoal || primaryGoal || focusArea || experienceLevel;
        sentences.push(
            direction
                ? `Together, these experiences shape how I approach ${String(direction).replace(/-/g, ' ')}.`
                : 'Together, these experiences show how I approach growth with intention, evidence, and follow-through.'
        );
    }

    return sentences.filter(Boolean).join(' ');
};

const buildPersonalStatementVariant = (
    overview: Pick<OpportunityOverview, 'personalStatement' | 'topSkills' | 'topLessons' | 'experiences' | 'profileContext'>,
    variant: OpportunityTemplateVariant
): string => {
    return variant === 'standard'
        ? overview.personalStatement
        : buildStatementDraft(overview, variant);
};

const sortExperiencesByPriority = (experiences: ExperienceEvidence[]): ExperienceEvidence[] =>
    experiences.sort((a, b) => {
        const scoreDiff = buildExperiencePriority(b) - buildExperiencePriority(a);
        if (scoreDiff !== 0) return scoreDiff;
        return b.createdAt.localeCompare(a.createdAt);
    });

export const buildOpportunityOverview = (
    entries: OpportunityEntry[],
    profileContext: ProfileContextSummary | null = null,
    profileIdentity: OpportunityProfileIdentity | null = null
): OpportunityOverview => {
    const experiences = sortExperiencesByPriority(entries.map(deriveExperienceEvidence));
    const skillCounts = new Map<string, number>();
    const lessonCounts = new Map<string, number>();
    let verifiedCount = 0;

    experiences.forEach((experience) => {
        if (experience.verified) {
            verifiedCount += 1;
        }

        experience.skills.forEach((skill) => addNormalizedCount(skillCounts, skill, normalizeSkillLabel));
        if (hasText(experience.lesson)) {
            addNormalizedCount(lessonCounts, experience.lesson, normalizeLessonTheme);
        }
    });

    const topSkills = getTopCountValues(skillCounts, 8);
    const topLessons = getTopCountValues(lessonCounts, 6);
    const resumeBullets = selectTopExperiences(
        experiences,
        12,
        (experience) => hasText(experience.action) && hasText(experience.outcome)
    ).map(buildResumeBullet);
    const interviewStories = selectTopExperiences(
        experiences,
        6,
        (experience) => hasText(experience.situation) && hasText(experience.action) && hasText(experience.outcome)
    ).map(buildInterviewStory);
    const statementVariants: Record<OpportunityTemplateVariant, string> = {
        standard: '',
        college: '',
        entry_job: '',
    };

    const overview: OpportunityOverview = {
        generatedAt: new Date().toISOString(),
        profileContext,
        profileIdentity,
        stats: {
            entryCount: entries.length,
            experienceCount: experiences.length,
            verifiedCount,
        },
        topSkills,
        topLessons,
        experiences,
        resumeBullets,
        interviewStories,
        personalStatement: '',
        statementVariants,
    };

    overview.personalStatement = buildStatementDraft(overview, 'standard');
    overview.statementVariants.standard = overview.personalStatement;
    overview.statementVariants.college = buildPersonalStatementVariant(overview, 'college');
    overview.statementVariants.entry_job = buildPersonalStatementVariant(overview, 'entry_job');
    return overview;
};

type ExportType = 'resume' | 'statement' | 'interview' | 'growth';
type ExportFormat = 'markdown' | 'json' | 'html';
type TrendPeriod = 'week' | 'month';
type TrendBucketAccumulator = {
    entries: number;
    verified: number;
    confidenceTotal: number;
    moodCounts: Map<string, number>;
    skillCounts: Map<string, number>;
};

const createTrendBucketAccumulator = (): TrendBucketAccumulator => ({
    entries: 0,
    verified: 0,
    confidenceTotal: 0,
    moodCounts: new Map<string, number>(),
    skillCounts: new Map<string, number>(),
});

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

const normalizeIdentityText = (value: string | null | undefined): string | null => {
    if (!hasText(value)) return null;
    return compactWhitespace(value).slice(0, 240);
};

const stripProtocol = (value: string): string =>
    value.replace(/^https?:\/\//i, '').replace(/\/$/, '');

const sanitizeFileStem = (value: string | null | undefined): string => {
    const normalized = normalizeIdentityText(value);
    if (!normalized) return 'notive';
    const slug = normalized
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
    return slug || 'notive';
};

const getDocumentOwnerName = (overview: OpportunityOverview): string =>
    normalizeIdentityText(overview.profileIdentity?.name) ||
    normalizeIdentityText(overview.profileIdentity?.email?.split('@')[0]) ||
    'Notive User';

const getDocumentDescriptor = (overview: OpportunityOverview): string | null => {
    const parts = [
        normalizeIdentityText(overview.profileIdentity?.occupation),
        normalizeIdentityText(overview.profileIdentity?.location),
    ].filter(Boolean) as string[];

    if (parts.length > 0) return parts.join(' | ');

    if (overview.profileContext?.focusArea) {
        return `Focus: ${toTitleCaseLabel(overview.profileContext.focusArea)}`;
    }

    return null;
};

const getDocumentContactLine = (overview: OpportunityOverview): string | null => {
    const parts = [
        normalizeIdentityText(overview.profileIdentity?.email),
        overview.profileIdentity?.website ? stripProtocol(overview.profileIdentity.website) : null,
    ].filter(Boolean) as string[];

    return parts.length > 0 ? parts.join(' | ') : null;
};

const buildDocumentIdentityHeader = (
    overview: OpportunityOverview,
    title: string,
    variant: OpportunityTemplateVariant
): string[] => {
    const lines = [`# ${getDocumentOwnerName(overview)}`];
    const descriptor = getDocumentDescriptor(overview);
    const contactLine = getDocumentContactLine(overview);

    if (descriptor) lines.push(descriptor);
    if (contactLine) lines.push(contactLine);
    lines.push(`${title} · ${toTitleCaseLabel(variant)}`);
    lines.push('');
    return lines;
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

const buildIdentitySectionLines = (overview: OpportunityOverview): string[] => {
    const identity = overview.profileIdentity;
    if (!identity) return [];

    const lines: string[] = [];

    if (identity.name) {
        lines.push(`- Name: ${identity.name}`);
    }
    if (identity.occupation) {
        lines.push(`- Current role: ${identity.occupation}`);
    }
    if (identity.location) {
        lines.push(`- Location: ${identity.location}`);
    }
    if (identity.email) {
        lines.push(`- Contact: ${identity.email}`);
    }
    if (identity.website) {
        lines.push(`- Website: ${stripProtocol(identity.website)}`);
    }
    if (identity.bio) {
        lines.push(`- Profile note: ${identity.bio}`);
    }

    return lines;
};

const buildProfileSnapshotLines = (overview: OpportunityOverview): string[] => {
    const lines = [
        `- Generated: ${formatExportTimestamp(overview.generatedAt)}`,
        `- Verified evidence: ${overview.stats.verifiedCount} of ${overview.stats.experienceCount} experiences`,
        `- Top skills: ${formatListLabel(overview.topSkills)}`,
        `- Top lessons: ${formatListLabel(overview.topLessons)}`,
        ...buildIdentitySectionLines(overview),
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

const buildPersonalizationLines = (overview: OpportunityOverview): string[] => {
    const lines: string[] = [];

    if (overview.profileContext?.primaryGoal) {
        lines.push(`- Primary goal: ${overview.profileContext.primaryGoal}`);
    }

    if (overview.profileContext?.focusArea) {
        lines.push(`- Focus area: ${toTitleCaseLabel(overview.profileContext.focusArea)}`);
    }

    if (overview.profileContext?.experienceLevel) {
        lines.push(`- Experience level: ${toTitleCaseLabel(overview.profileContext.experienceLevel)}`);
    }

    if (overview.profileContext?.outputGoals.length) {
        lines.push(`- Output goals: ${overview.profileContext.outputGoals.map((goal) => toTitleCaseLabel(goal)).join(', ')}`);
    }

    if (overview.profileContext?.writingPreference) {
        lines.push(`- Writing style: ${toTitleCaseLabel(overview.profileContext.writingPreference)}`);
    }

    if (overview.profileContext?.lifeGoals.length) {
        lines.push(`- Long-term themes: ${overview.profileContext.lifeGoals.slice(0, 4).join(', ')}`);
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

const getHighlightedExperiences = (overview: OpportunityOverview, limit = 4): ExperienceEvidence[] =>
    selectTopExperiences(
        overview.experiences,
        limit,
        (experience) => hasText(experience.action) || hasText(experience.outcome) || experience.verified
    );

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

const renderOpportunityHtmlDocument = (type: ExportType, markdownBody: string, title: string): string => {
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
  <title>${escapeHtml(title)}</title>
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
    markdownBody: string,
    title: string
): { fileName: string; contentType: string; body: string } => {
    if (format === 'html') {
        return {
            fileName: fileName.replace(/\.md$/i, '.html'),
            contentType: 'text/html; charset=utf-8',
            body: renderOpportunityHtmlDocument(type, markdownBody, title),
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

const getPeriodStart = (date: Date, period: TrendPeriod): Date =>
    period === 'week' ? getWeekStart(date) : getMonthStart(date);

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
    const currentStart = getPeriodStart(now, period);
    const starts: Date[] = [];
    for (let i = safeWindow - 1; i >= 0; i--) {
        starts.push(addPeriods(currentStart, period, -i));
    }

    const bucketMap = new Map<string, TrendBucketAccumulator>();
    experiences.forEach((experience) => {
        const createdAt = new Date(experience.createdAt);
        if (Number.isNaN(createdAt.getTime())) return;

        const periodStart = getPeriodStart(createdAt, period).toISOString();
        const bucket = bucketMap.get(periodStart) || createTrendBucketAccumulator();
        bucket.entries += 1;
        bucket.verified += experience.verified ? 1 : 0;
        bucket.confidenceTotal += experience.confidence;

        if (experience.mood) {
            incrementCount(bucket.moodCounts, experience.mood);
        }
        experience.skills.forEach((skill) => incrementCount(bucket.skillCounts, skill));

        if (!bucketMap.has(periodStart)) {
            bucketMap.set(periodStart, bucket);
        }
    });

    const points: GrowthTrendPoint[] = starts.map((start) => {
        const bucket = bucketMap.get(start.toISOString()) || createTrendBucketAccumulator();
        const dominantMood = getTopCountValues(bucket.moodCounts, 1)[0] || null;
        const topSkills = getTopCountValues(bucket.skillCounts, 3);

        const averageConfidence = bucket.entries === 0
            ? 0
            : Number((bucket.confidenceTotal / bucket.entries).toFixed(3));

        return {
            periodStart: start.toISOString(),
            periodLabel: formatPeriodLabel(start, period),
            entries: bucket.entries,
            experiences: bucket.entries,
            verified: bucket.verified,
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
    const ownerStem = sanitizeFileStem(overview.profileIdentity?.name || overview.profileIdentity?.email?.split('@')[0] || null);

    if (format === 'json') {
        const payload =
            type === 'resume'
                ? {
                    generatedAt: overview.generatedAt,
                    variant,
                    profileIdentity: overview.profileIdentity,
                    profileContext: overview.profileContext,
                    resumeBullets: overview.resumeBullets,
                }
                : type === 'statement'
                    ? {
                        generatedAt: overview.generatedAt,
                        variant,
                        profileIdentity: overview.profileIdentity,
                        profileContext: overview.profileContext,
                        personalStatement: overview.statementVariants[variant] || overview.personalStatement,
                    }
                    : type === 'interview'
                        ? {
                            generatedAt: overview.generatedAt,
                            variant,
                            profileIdentity: overview.profileIdentity,
                            profileContext: overview.profileContext,
                            interviewStories: overview.interviewStories,
                        }
                        : {
                            generatedAt: overview.generatedAt,
                            variant,
                            profileIdentity: overview.profileIdentity,
                            profileContext: overview.profileContext,
                            stats: overview.stats,
                            topSkills: overview.topSkills,
                            topLessons: overview.topLessons,
                            experiences: overview.experiences,
                        };

        return {
            fileName: `${ownerStem}-notive-${type}-${variant}.json`,
            contentType: 'application/json',
            body: JSON.stringify(payload, null, 2),
        };
    }

    if (type === 'resume') {
        const heading = variant === 'college'
            ? 'Application Experience Pack'
            : variant === 'entry_job'
                ? 'Early-Career Resume Pack'
                : 'Resume Pack';
        const highlightExperiences = getHighlightedExperiences(overview, 4);
        const lines = buildDocumentIdentityHeader(overview, heading, variant);

        pushSection(lines, 'Positioning Snapshot', [
            ...buildProfileSnapshotLines(overview),
            `- Resume bullets ready: ${overview.resumeBullets.length}`,
        ]);
        pushSection(lines, 'Professional Lens', buildPersonalizationLines(overview));

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

        return finalizeOpportunityDocument(
            type,
            format,
            `${ownerStem}-resume-pack-${variant}.md`,
            lines.join('\n'),
            `${getDocumentOwnerName(overview)} Resume Pack`
        );
    }

    if (type === 'statement') {
        const statement = overview.statementVariants[variant] || overview.personalStatement;
        const heading = variant === 'college'
            ? 'College Statement Draft'
            : variant === 'entry_job'
                ? 'Early-Career Personal Profile'
                : 'Personal Statement Draft';
        const storyAnchors = getHighlightedExperiences(overview, 3);
        const lines = buildDocumentIdentityHeader(overview, heading, variant);

        pushSection(lines, 'Narrative Frame', buildProfileSnapshotLines(overview));
        pushSection(lines, 'Personal Context', buildPersonalizationLines(overview));
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

        return finalizeOpportunityDocument(
            type,
            format,
            `${ownerStem}-personal-statement-${variant}.md`,
            lines.join('\n'),
            `${getDocumentOwnerName(overview)} Personal Statement`
        );
    }

    if (type === 'interview') {
        const experienceMap = buildExperienceMap(overview);
        const lines = buildDocumentIdentityHeader(overview, 'Interview Story Bank', variant);

        pushSection(lines, 'Candidate Snapshot', [
            ...buildIdentitySectionLines(overview),
            ...buildPersonalizationLines(overview),
        ]);
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

        return finalizeOpportunityDocument(
            type,
            format,
            `${ownerStem}-interview-stories-${variant}.md`,
            lines.join('\n'),
            `${getDocumentOwnerName(overview)} Interview Story Bank`
        );
    }

    const averageConfidence = overview.experiences.length > 0
        ? overview.experiences.reduce((sum, experience) => sum + experience.confidence, 0) / overview.experiences.length
        : 0;
    const lines = buildDocumentIdentityHeader(overview, 'Growth Portfolio Report', variant);

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
    pushSection(lines, 'Personal Context', [
        ...buildIdentitySectionLines(overview),
        ...buildPersonalizationLines(overview),
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

    return finalizeOpportunityDocument(
        type,
        format,
        `${ownerStem}-growth-portfolio-${variant}.md`,
        lines.join('\n'),
        `${getDocumentOwnerName(overview)} Growth Portfolio`
    );
};
