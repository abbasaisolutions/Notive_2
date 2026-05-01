'use client';

import { FiCheckCircle, FiEdit3, FiFeather } from 'react-icons/fi';

type InsightReadinessMeterProps = {
    content: string;
    compact?: boolean;
};

const getWordCount = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;

export default function InsightReadinessMeter({ content, compact = false }: InsightReadinessMeterProps) {
    const wordCount = getWordCount(content);
    const hasEnoughToRemember = wordCount >= 12;
    const hasEnoughForPatterns = wordCount >= 45;
    const hasEnoughForStory = wordCount >= 90;
    const score = hasEnoughForStory ? 3 : hasEnoughForPatterns ? 2 : hasEnoughToRemember ? 1 : 0;
    const percent = Math.max(8, Math.round((score / 3) * 100));
    const label = score === 3
        ? 'Ready for story ideas'
        : score === 2
            ? 'Ready for patterns'
            : score === 1
                ? 'Enough to remember'
                : 'Keep going for better insights';
    const helper = score === 3
        ? 'This has context, detail, and enough texture for Notive to reuse later.'
        : score === 2
            ? 'A few more specifics can make this stronger for stories or applications.'
            : score === 1
                ? 'Add what changed, who was involved, or what you learned.'
                : 'Write a little more about what happened and why it mattered.';

    return (
        <aside
            aria-label="Insight readiness"
            className={`rounded-2xl border border-[rgba(var(--paper-border),0.5)] bg-[rgba(255,255,255,0.34)] ${compact ? 'px-3 py-2' : 'px-3.5 py-3'}`}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted">
                        <FiFeather size={12} aria-hidden />
                        Insight readiness
                    </p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-strong">{label}</p>
                </div>
                <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[0.68rem] font-semibold text-primary">
                    {wordCount}w
                </span>
            </div>

            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[rgba(var(--paper-ink),0.08)]">
                <div
                    className="h-full rounded-full bg-[rgb(var(--paper-sage))] transition-all duration-300"
                    style={{ width: `${percent}%` }}
                />
            </div>

            {!compact && (
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {[
                        { label: 'Memory', active: hasEnoughToRemember },
                        { label: 'Patterns', active: hasEnoughForPatterns },
                        { label: 'Story', active: hasEnoughForStory },
                    ].map((item) => (
                        <div
                            key={item.label}
                            className={`flex items-center justify-center gap-1 rounded-full px-2 py-1 text-[0.64rem] font-semibold ${
                                item.active ? 'bg-primary/12 text-primary' : 'bg-[rgba(var(--paper-ink),0.05)] text-muted'
                            }`}
                        >
                            {item.active ? <FiCheckCircle size={10} aria-hidden /> : <FiEdit3 size={10} aria-hidden />}
                            {item.label}
                        </div>
                    ))}
                </div>
            )}

            <p className="mt-2 text-xs leading-5 text-muted">{helper}</p>
        </aside>
    );
}
