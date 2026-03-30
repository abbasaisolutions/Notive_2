import type { ReactNode } from 'react';
import Link from 'next/link';
import NotiveLogo from '@/components/ui/NotiveLogo';
import { NotebookDoodle } from '@/components/dashboard/NotebookDoodles';

type LegalAction = {
    href: string;
    label: string;
    tone?: 'primary' | 'secondary';
};

export default function LegalPaperShell({
    title,
    intro,
    actions,
    footer,
    children,
}: {
    title: string;
    intro: string;
    actions: LegalAction[];
    footer: string;
    children: ReactNode;
}) {
    return (
        <main className="page-paper-canvas min-h-screen px-4 py-4 md:px-6 md:py-6">
            <div className="mx-auto max-w-4xl">
                <section className="app-paper rounded-[2rem] p-6 md:p-10">
                    <div className="flex items-start justify-between gap-4">
                        <div className="max-w-2xl">
                            <NotiveLogo href="/" size="sm" />
                            <p className="mt-6 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[rgb(var(--paper-ink-soft))]">
                                Notive Legal
                            </p>
                            <h1 className="mt-3 text-3xl font-semibold text-[rgb(var(--paper-ink))] md:text-4xl">
                                {title}
                            </h1>
                            <p className="mt-4 text-sm leading-7 text-[rgb(var(--paper-ink-soft))] md:text-base">
                                {intro}
                            </p>
                        </div>
                        <NotebookDoodle name="sprout" accent="sage" className="hidden shrink-0 md:block" />
                    </div>

                    <div className="mt-8 space-y-5 text-sm leading-7 text-[rgb(var(--paper-ink-soft))]">
                        {children}
                    </div>

                    <div className="mt-8 flex flex-wrap items-center gap-3">
                        {actions.map((action) => (
                            <Link
                                key={`${action.href}-${action.label}`}
                                href={action.href}
                                className={
                                    action.tone === 'primary'
                                        ? 'workspace-button-primary inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold'
                                        : 'workspace-button-outline inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold'
                                }
                            >
                                {action.label}
                            </Link>
                        ))}
                    </div>

                    <p className="mt-6 text-xs text-[rgb(var(--paper-ink-muted))]">{footer}</p>
                </section>
            </div>
        </main>
    );
}
