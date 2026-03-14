import Link from 'next/link';

export default function PrivacyPage() {
    return (
        <main className="min-h-screen px-6 py-12 md:px-10 md:py-16">
            <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-surface-1/70 p-8 md:p-10">
                <p className="mb-3 text-xs uppercase tracking-[0.18em] text-ink-muted">Notive Legal</p>
                <h1 className="mb-6 text-3xl font-serif text-white md:text-4xl">Privacy Policy</h1>

                <div className="space-y-5 text-sm text-ink-secondary">
                    <p>Notive collects account details and journal content you provide to operate core features.</p>
                    <p>We use your data to deliver journaling, insights, synchronization, and optional social import functionality.</p>
                    <p>You can export your data and request deletion from your profile settings.</p>
                    <p>We apply security controls to protect account and content data, but no system is perfectly risk-free.</p>
                    <p>By using Notive, you consent to this policy and any future updates posted on this page.</p>
                </div>

                <div className="mt-8 flex items-center gap-3">
                    <Link href="/register" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">
                        Back to Sign Up
                    </Link>
                    <Link href="/terms" className="rounded-xl border border-white/15 px-4 py-2 text-sm text-ink-secondary hover:text-white">
                        View Terms
                    </Link>
                </div>
            </div>
        </main>
    );
}
