'use client';

import Link from 'next/link';

type DigestHighlight = {
    category: string;
    insight: string;
};

type WeeklyReflectionDigestCardProps = {
    title: string;
    editorial: string;
    highlights: DigestHighlight[];
    entryCount?: number;
    href: string;
};

export default function WeeklyReflectionDigestCard({
    title,
    editorial,
    highlights,
    entryCount,
    href,
}: WeeklyReflectionDigestCardProps) {
    return (
        <section className="rounded-card-125 border border-[rgba(191,214,221,0.34)] bg-[rgba(191,214,221,0.12)] p-3.5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="section-label">Weekly read</p>
                    <h3 className="notebook-title mt-1 text-[1.02rem] leading-tight">{title}</h3>
                </div>
                {typeof entryCount === 'number' && (
                    <span className="rounded-full border border-[rgba(92,92,92,0.1)] bg-[rgba(255,255,255,0.46)] px-2 py-1 text-[0.62rem] font-semibold text-[rgb(var(--text-soft))]">
                        {entryCount} {entryCount === 1 ? 'note' : 'notes'}
                    </span>
                )}
            </div>
            <p className="mt-2 text-[0.78rem] leading-5 text-[rgb(var(--text-soft))]">{editorial}</p>
            {highlights.length > 0 && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {highlights.slice(0, 2).map((highlight) => (
                        <div key={`${highlight.category}-${highlight.insight}`} className="rounded-card-95 border border-[rgba(92,92,92,0.1)] bg-[rgba(255,255,255,0.42)] px-3 py-2.5">
                            <p className="text-[0.56rem] font-bold uppercase tracking-[0.1em] text-[rgb(var(--text-soft))]">{highlight.category}</p>
                            <p className="mt-1 text-[0.74rem] leading-5 text-[rgb(var(--paper-ink))]">{highlight.insight}</p>
                        </div>
                    ))}
                </div>
            )}
            <Link href={href} className="mt-3 inline-flex text-[0.72rem] font-semibold text-[rgb(118,134,91)] transition-opacity hover:opacity-80">
                Review the thread →
            </Link>
        </section>
    );
}
