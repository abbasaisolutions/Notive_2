import Link from 'next/link';
import { ACCOUNT_DELETION_PATH, LEGAL_COPYRIGHT_NOTICE, LEGAL_ENTITY_NAME } from '@/config/legal';

export default function TermsPage() {
    return (
        <main className="min-h-screen px-6 py-12 md:px-10 md:py-16">
            <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-surface-1/70 p-8 md:p-10">
                <p className="mb-3 text-xs uppercase tracking-[0.18em] text-ink-muted">Notive Legal</p>
                <h1 className="mb-6 text-3xl font-serif text-white md:text-4xl">Terms of Service</h1>

                <div className="space-y-5 text-sm text-ink-secondary">
                    <p>Notive is developed and operated by {LEGAL_ENTITY_NAME}.</p>
                    <p>By using Notive, you agree to use the service lawfully and keep your account credentials secure.</p>
                    <p>You own your content. You grant Notive permission to process it to provide capture, signal reading, synchronization, and output features.</p>
                    <p>Do not upload illegal content, infringing material, or content intended to harm the service or other users.</p>
                    <p>Notive may suspend accounts for abuse, policy violations, or security risk.</p>
                    <p>These terms may be updated. Continued use of Notive after updates means you accept the revised terms.</p>
                    <p>Notive software, branding, and related materials remain proprietary to {LEGAL_ENTITY_NAME} unless expressly licensed otherwise in writing.</p>
                </div>

                <div className="mt-8 flex items-center gap-3">
                    <Link href="/register" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">
                        Back to Sign Up
                    </Link>
                    <Link href="/privacy" className="rounded-xl border border-white/15 px-4 py-2 text-sm text-ink-secondary hover:text-white">
                        View Privacy Policy
                    </Link>
                    <Link href={ACCOUNT_DELETION_PATH} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-ink-secondary hover:text-white">
                        Account Deletion
                    </Link>
                </div>

                <p className="mt-6 text-xs text-ink-muted">{LEGAL_COPYRIGHT_NOTICE}</p>
            </div>
        </main>
    );
}
