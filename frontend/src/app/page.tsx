import Link from 'next/link';
import { FiBarChart2, FiCpu, FiLock, FiSmartphone } from 'react-icons/fi';

export default function Home() {
    const features = [
        { label: 'AI Insights', Icon: FiCpu },
        { label: 'End-to-End Encrypted', Icon: FiLock },
        { label: 'Offline First', Icon: FiSmartphone },
        { label: 'Mood Tracking', Icon: FiBarChart2 },
    ];

    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden">
            {/* Background Glow Effects */}
            <div className="absolute top-1/3 left-1/4 w-[600px] h-[600px] bg-primary/15 rounded-full blur-[150px] pointer-events-none" />
            <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-secondary/15 rounded-full blur-[150px] pointer-events-none" />

            <div className="z-10 text-center max-w-3xl">
                {/* Logo */}
                <h1 className="text-6xl md:text-8xl font-bold mb-6 bg-gradient-to-r from-primary via-ink-secondary to-secondary bg-clip-text text-transparent">
                    Notive.
                </h1>

                <p className="text-xl md:text-2xl text-ink-secondary mb-4">
                    Your AI-Powered Journaling Companion
                </p>

                <p className="text-ink-muted mb-10 max-w-xl mx-auto">
                    Capture your thoughts, track your mood, and discover insights about yourself
                    with a beautiful, secure, and intelligent journaling experience.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-10 text-left">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-ink-muted mb-1">Step 1</div>
                        <div className="text-white font-semibold">Capture</div>
                        <p className="text-xs text-ink-muted mt-1">Write or speak naturally in minutes.</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-ink-muted mb-1">Step 2</div>
                        <div className="text-white font-semibold">Understand</div>
                        <p className="text-xs text-ink-muted mt-1">AI extracts lessons, skills, and patterns.</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-ink-muted mb-1">Step 3</div>
                        <div className="text-white font-semibold">Apply</div>
                        <p className="text-xs text-ink-muted mt-1">Turn growth into portfolio-ready stories.</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link
                        href="/register"
                        className="bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-xl font-medium transition-all shadow-lg shadow-primary/30 hover:shadow-primary/50 text-lg"
                    >
                        Get Started — It's Free
                    </Link>
                    <Link
                        href="/login"
                        className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-8 py-4 rounded-xl font-medium transition-all text-lg"
                    >
                        Sign In
                    </Link>
                </div>

                {/* Feature Pills */}
                <div className="flex flex-wrap justify-center gap-3 mt-12">
                    {features.map(({ label, Icon }) => (
                            <span
                                key={label}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-ink-secondary"
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

