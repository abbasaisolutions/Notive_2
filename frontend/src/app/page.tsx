import Link from 'next/link';
import { FiBarChart2, FiCpu, FiLock, FiSmartphone } from 'react-icons/fi';
import { NOTIVE_VOICE } from '@/content/notive-voice';

export default function Home() {
    const features = [
        { label: 'Patterns', Icon: FiCpu },
        { label: 'Private', Icon: FiLock },
        { label: 'Write Anywhere', Icon: FiSmartphone },
        { label: 'Memories and Feelings', Icon: FiBarChart2 },
    ];

    return (
        <main className="min-h-screen px-4 py-10 md:px-8 md:py-14">
            <div className="mx-auto max-w-5xl space-y-6">
                <div className="text-center">
                    <h1 className="text-4xl font-bold tracking-tight text-white md:text-6xl">Notive.</h1>
                    <p className="mt-3 text-lg text-ink-secondary md:text-xl">{NOTIVE_VOICE.signature}</p>
                </div>

                <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 md:p-10">
                    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)] lg:items-end">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Write. Notice. Use.</p>
                            <h2 className="mt-3 text-3xl font-serif text-white md:text-5xl">
                                Save real moments, understand patterns, and build stories you can reuse later.
                            </h2>
                            <p className="mt-4 max-w-2xl text-sm leading-7 text-ink-secondary md:text-base">
                                Notive helps you write what happened, come back to what matters, and shape your notes into something useful for life, school, and work.
                            </p>
                            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                                <Link
                                    href="/register"
                                    className="rounded-[1.2rem] border border-primary/25 bg-primary px-6 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-primary/90"
                                >
                                    Get Started
                                </Link>
                                <Link
                                    href="/login"
                                    className="rounded-[1.2rem] border border-white/12 bg-black/20 px-6 py-3 text-center text-sm font-semibold text-ink-secondary transition-colors hover:bg-black/30 hover:text-white"
                                >
                                    Sign In
                                </Link>
                            </div>
                        </div>

                        <div className="grid gap-3 text-left">
                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <div className="text-xs uppercase tracking-[0.16em] text-ink-muted">Step 1</div>
                                <div className="mt-2 text-white font-semibold">Write</div>
                                <p className="mt-1 text-sm text-ink-secondary">Save a real moment while it is still fresh.</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <div className="text-xs uppercase tracking-[0.16em] text-ink-muted">Step 2</div>
                                <div className="mt-2 text-white font-semibold">Notice</div>
                                <p className="mt-1 text-sm text-ink-secondary">See feelings, themes, and what keeps showing up.</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <div className="text-xs uppercase tracking-[0.16em] text-ink-muted">Step 3</div>
                                <div className="mt-2 text-white font-semibold">Use</div>
                                <p className="mt-1 text-sm text-ink-secondary">Turn strong moments into clear stories you can use later.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="flex flex-wrap justify-center gap-3">
                    {features.map(({ label, Icon }) => (
                        <span
                            key={label}
                            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-ink-secondary"
                        >
                            <Icon size={14} aria-hidden="true" />
                            {label}
                        </span>
                    ))}
                </div>
            </div>
        </main>
    );
}

