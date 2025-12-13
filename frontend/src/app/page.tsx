import Link from 'next/link';

export default function Home() {
    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden">
            {/* Background Glow Effects */}
            <div className="absolute top-1/3 left-1/4 w-[600px] h-[600px] bg-primary/15 rounded-full blur-[150px] pointer-events-none" />
            <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-secondary/15 rounded-full blur-[150px] pointer-events-none" />

            <div className="z-10 text-center max-w-3xl">
                {/* Logo */}
                <h1 className="text-6xl md:text-8xl font-bold mb-6 bg-gradient-to-r from-primary via-purple-400 to-secondary bg-clip-text text-transparent">
                    Notive.
                </h1>

                <p className="text-xl md:text-2xl text-slate-300 mb-4">
                    Your AI-Powered Journaling Companion
                </p>

                <p className="text-slate-400 mb-10 max-w-xl mx-auto">
                    Capture your thoughts, track your mood, and discover insights about yourself
                    with a beautiful, secure, and intelligent journaling experience.
                </p>

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
                    {['✨ AI Insights', '🔒 End-to-End Encrypted', '📱 Offline First', '📊 Mood Tracking'].map(
                        (feature) => (
                            <span
                                key={feature}
                                className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-slate-300"
                            >
                                {feature}
                            </span>
                        )
                    )}
                </div>
            </div>
        </main>
    );
}
