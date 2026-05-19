'use client';

import Link from 'next/link';
import { FiArrowRight, FiCheckCircle } from 'react-icons/fi';

type DailyPathCardProps = {
    eyebrow: string;
    title: string;
    body: string;
    reason: string;
    href: string;
    cta: string;
};

export default function DailyPathCard({ eyebrow, title, body, reason, href, cta }: DailyPathCardProps) {
    return (
        <section className="rounded-[1.25rem] border border-[rgba(138,154,111,0.26)] bg-[rgba(138,154,111,0.1)] p-3.5">
            <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(138,154,111,0.16)] text-[rgb(118,134,91)]">
                    <FiCheckCircle size={17} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="section-label">{eyebrow}</p>
                    <h2 className="notebook-title mt-1 text-[1.08rem] leading-tight">{title}</h2>
                    <p className="mt-2 text-[0.78rem] leading-5 text-[rgb(107,107,107)]">{body}</p>
                    <p className="mt-2 text-[0.68rem] leading-5 text-[rgb(118,134,91)]">{reason}</p>
                    <Link
                        href={href}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[rgb(var(--paper-ink))] px-3 py-2 text-[0.75rem] font-semibold text-[rgb(var(--paper-bg))] transition-opacity hover:opacity-90"
                    >
                        {cta}
                        <FiArrowRight size={13} aria-hidden="true" />
                    </Link>
                </div>
            </div>
        </section>
    );
}
