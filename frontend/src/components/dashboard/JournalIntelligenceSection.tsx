'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import WordGarden from './WordGarden';
import LifeBalanceWheel from './LifeBalanceWheel';
import PeopleConstellation from './PeopleConstellation';
import GrowthMindsetMeter from './GrowthMindsetMeter';
import GratitudePulseCard from './GratitudePulseCard';
import WritingVoiceCard from './WritingVoiceCard';

/**
 * Shapes matching the JournalIntelligence backend type.
 * Kept inline to avoid a barrel import — these are display-only props.
 */
type JournalIntel = {
    vocabulary: { totalUniqueWords: number; richness: number; readingGradeLevel: number; avgWordsPerEntry: number; emotionWordCount: number; emotionWords: string[]; rarityScore: number; recentNewWords: string[]; growthRate: number };
    lifeBalance: { areas: Array<{ area: string; score: number; entryCount: number; dominantMood: string | null; recentTrend: 'up' | 'stable' | 'down' }>; balanceScore: number; dominantArea: string; neglectedArea: string | null };
    peopleMap: { people: Array<{ name: string; count: number; avgMoodWhenMentioned: number; sentiment: 'positive' | 'neutral' | 'negative' | 'mixed'; recentMention: string; contexts: string[] }>; totalPeopleMentioned: number; socialDiversity: number };
    growthLanguage: { totalGrowthPhrases: number; growthDensity: number; topPhrases: Array<{ phrase: string; count: number }>; recentTrend: 'increasing' | 'stable' | 'decreasing'; mindsetRatio: number; fixedMindsetCount: number; growthMindsetCount: number };
    emotionalRange: { uniqueEmotions: number; emotionList: string[]; rangeScore: number; dominantEmotion: string; rarestEmotion: string | null; emotionFrequency: Array<{ emotion: string; count: number; percentage: number }>; complexityScore: number };
    gratitude: { totalExpressions: number; avgPerWeek: number; streak: number; topThemes: string[]; recentTrend: 'growing' | 'stable' | 'fading'; depthScore: number };
    selfTalk: { growthStatements: number; fixedStatements: number; ratio: number; label: string; topGrowthPhrases: string[]; topFixedPhrases: string[] };
    writingVoice: { avgSentenceLength: number; avgParagraphLength: number; readingLevel: string; readingGrade: number; questionFrequency: number; exclamationFrequency: number; firstPersonRatio: number; tenseDistribution: { past: number; present: number; future: number } };
    entryCount: number;
};

type InsightPill = {
    key: string;
    icon: string;
    label: string;
    value: string;
    accent: string;
    interestScore: number; // higher = more worth showing
};

type Props = {
    intel: JournalIntel;
};

/**
 * JournalIntelligenceSection
 *
 * Instead of dumping 6 KPI cards, this component:
 * 1. Ranks which metrics are most "interesting" (changed, extreme, or novel)
 * 2. Shows 3 compact insight pills at the top
 * 3. Lets users tap a pill to expand ONE card at a time
 * 4. Keeps the dashboard clean and uncluttered
 */
export default function JournalIntelligenceSection({ intel }: Props) {
    const [expandedKey, setExpandedKey] = useState<string | null>(null);

    // Rank metrics by interestingness — only surface what's worth seeing
    const pills = useMemo(() => {
        const candidates: InsightPill[] = [];

        // Vocabulary: interesting if growing or rich — show the actual new words
        if (intel.vocabulary.totalUniqueWords > 50) {
            const score = (intel.vocabulary.growthRate > 5 ? 20 : 0)
                + (intel.vocabulary.recentNewWords.length > 0 ? 15 : 0)
                + (intel.vocabulary.rarityScore > 50 ? 10 : 0);
            if (score > 0) {
                const newWords = intel.vocabulary.recentNewWords.slice(0, 3);
                candidates.push({
                    key: 'vocabulary',
                    icon: '🌱',
                    label: 'Words',
                    value: newWords.length > 0
                        ? `New: ${newWords.join(', ')}`
                        : `${intel.vocabulary.totalUniqueWords} unique words`,
                    accent: 'rgba(199,220,203,0.85)',
                    interestScore: score,
                });
            }
        }

        // Life balance: show what they write about most and what's missing
        const activeAreas = intel.lifeBalance.areas.filter((a) => a.entryCount > 0).length;
        if (activeAreas >= 3) {
            const score = (intel.lifeBalance.neglectedArea ? 25 : 0)
                + (intel.lifeBalance.balanceScore < 40 ? 15 : 0)
                + (intel.lifeBalance.areas.some((a) => a.recentTrend !== 'stable') ? 10 : 0);
            if (score > 0) {
                candidates.push({
                    key: 'balance',
                    icon: '⚖️',
                    label: 'Balance',
                    value: intel.lifeBalance.neglectedArea
                        ? `Mostly ${intel.lifeBalance.dominantArea} · ${intel.lifeBalance.neglectedArea} quiet`
                        : `Mostly ${intel.lifeBalance.dominantArea}`,
                    accent: 'rgba(234,216,189,0.85)',
                    interestScore: score,
                });
            }
        }

        // People: interesting if multiple people with sentiment data
        if (intel.peopleMap.people.length >= 2) {
            const topPerson = intel.peopleMap.people[0];
            const score = intel.peopleMap.totalPeopleMentioned * 3
                + (intel.peopleMap.people.some((p) => p.sentiment === 'negative') ? 15 : 0);
            candidates.push({
                key: 'people',
                icon: '✨',
                label: 'People',
                value: `${topPerson.name} (${topPerson.count}×)`,
                accent: 'rgba(216,199,232,0.85)',
                interestScore: Math.min(score, 40),
            });
        }

        // Growth mindset: show the actual phrases extracted
        const totalMindset = intel.selfTalk.growthStatements + intel.selfTalk.fixedStatements;
        if (totalMindset >= 5) {
            const ratio = intel.selfTalk.ratio;
            const score = (ratio > 0.75 || ratio < 0.35 ? 20 : 5)
                + (intel.growthLanguage.recentTrend !== 'stable' ? 15 : 0);
            const topPhrase = intel.growthLanguage.topPhrases[0]?.phrase;
            candidates.push({
                key: 'mindset',
                icon: '🧠',
                label: 'Mindset',
                value: topPhrase
                    ? `"${topPhrase}" (${intel.growthLanguage.totalGrowthPhrases}×)`
                    : intel.selfTalk.label,
                accent: ratio >= 0.5 ? 'rgba(199,220,203,0.85)' : 'rgba(232,186,167,0.85)',
                interestScore: score,
            });
        }

        // Gratitude: show count and themes, not density scores
        if (intel.gratitude.totalExpressions >= 3) {
            const score = (intel.gratitude.streak > 2 ? 20 : 0)
                + (intel.gratitude.recentTrend !== 'stable' ? 15 : 0)
                + (intel.gratitude.depthScore > 50 ? 10 : 0);
            if (score > 0) {
                const theme = intel.gratitude.topThemes[0];
                candidates.push({
                    key: 'gratitude',
                    icon: '🙏',
                    label: 'Gratitude',
                    value: theme
                        ? `${intel.gratitude.totalExpressions}× · mostly ${theme}`
                        : `${intel.gratitude.totalExpressions} moments this week`,
                    accent: 'rgba(199,220,203,0.7)',
                    interestScore: score,
                });
            }
        }

        // Writing voice: show the emotions expressed, not a score
        if (intel.entryCount >= 5) {
            const futureHeavy = intel.writingVoice.tenseDistribution.future > 25;
            const questionHeavy = intel.writingVoice.questionFrequency > 1.5;
            const score = (futureHeavy ? 15 : 0) + (questionHeavy ? 15 : 0)
                + (intel.emotionalRange.complexityScore > 60 ? 10 : 0);
            if (score > 0) {
                const emotions = intel.emotionalRange.emotionList.slice(0, 3).join(', ');
                candidates.push({
                    key: 'voice',
                    icon: '✍️',
                    label: 'Voice',
                    value: questionHeavy ? 'Curious explorer'
                        : futureHeavy ? 'Future thinker'
                            : emotions
                                ? `${intel.emotionalRange.uniqueEmotions} emotions: ${emotions}`
                                : `${intel.emotionalRange.uniqueEmotions} emotions expressed`,
                    accent: 'rgba(199,216,232,0.85)',
                    interestScore: score,
                });
            }
        }

        // Sort by interest score, take top 3
        return candidates.sort((a, b) => b.interestScore - a.interestScore).slice(0, 3);
    }, [intel]);

    if (pills.length === 0) return null;

    const toggle = (key: string) => setExpandedKey((prev) => (prev === key ? null : key));

    return (
        <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="notebook-card rounded-[1.75rem] p-5"
        >
            <p
                className="section-label mb-3"
                style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)' }}
            >
                Your journal DNA
            </p>

            {/* ── Compact pills — tap to expand ── */}
            <div className="flex flex-wrap gap-2">
                {pills.map((pill) => (
                    <button
                        key={pill.key}
                        onClick={() => toggle(pill.key)}
                        className={`
                            notebook-chip rounded-full px-3 py-1.5 text-xs font-medium
                            flex items-center gap-1.5 transition-all
                            ${expandedKey === pill.key ? 'ring-1 ring-offset-1' : ''}
                        `}
                        style={{
                            ...(expandedKey === pill.key
                                ? { backgroundColor: pill.accent, ringColor: pill.accent }
                                : {}),
                        }}
                    >
                        <span aria-hidden="true">{pill.icon}</span>
                        <span>{pill.label}</span>
                        <span className="opacity-60">·</span>
                        <span className="opacity-80">{pill.value}</span>
                    </button>
                ))}
            </div>

            {/* ── Expanded card — only ONE at a time ── */}
            <AnimatePresence mode="wait">
                {expandedKey && (
                    <motion.div
                        key={expandedKey}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="mt-3 overflow-hidden"
                    >
                        {expandedKey === 'vocabulary' && (
                            <WordGarden vocabulary={intel.vocabulary} />
                        )}
                        {expandedKey === 'balance' && (
                            <LifeBalanceWheel lifeBalance={intel.lifeBalance} />
                        )}
                        {expandedKey === 'people' && (
                            <PeopleConstellation peopleMap={intel.peopleMap} />
                        )}
                        {expandedKey === 'mindset' && (
                            <GrowthMindsetMeter
                                growthLanguage={intel.growthLanguage}
                                selfTalk={intel.selfTalk}
                            />
                        )}
                        {expandedKey === 'gratitude' && (
                            <GratitudePulseCard gratitude={intel.gratitude} />
                        )}
                        {expandedKey === 'voice' && (
                            <WritingVoiceCard
                                writingVoice={intel.writingVoice}
                                emotionalRange={intel.emotionalRange}
                            />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.section>
    );
}
