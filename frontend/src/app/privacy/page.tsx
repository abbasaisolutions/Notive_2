import { ACCOUNT_DELETION_PATH, LEGAL_COPYRIGHT_NOTICE, LEGAL_ENTITY_NAME, SUPPORT_EMAIL } from '@/config/legal';
import LegalPaperShell from '@/components/legal/LegalPaperShell';

export default function PrivacyPage() {
    const contactEmail = SUPPORT_EMAIL || 'support@notive.com';

    return (
        <LegalPaperShell
            title="Privacy Policy"
            intro={`Notive is developed and operated by ${LEGAL_ENTITY_NAME}. This page explains what we collect, why we use it, and the choices you have. Last updated: April 3, 2026.`}
            actions={[
                { href: '/register', label: 'Back to Sign Up', tone: 'primary' },
                { href: '/terms', label: 'View Terms' },
                { href: ACCOUNT_DELETION_PATH, label: 'Account Deletion' },
            ]}
            footer={LEGAL_COPYRIGHT_NOTICE}
        >
            <div className="rounded-xl border p-4 mb-4 text-sm leading-7" style={{ borderColor: 'rgba(var(--paper-border), 0.5)', background: 'rgba(var(--paper-warm), 0.3)' }}>
                <p className="font-semibold mb-1">In plain terms</p>
                <p>Your notes and profile are stored in a secure database. They are encrypted in transit and at rest. We never sell your data or share it with advertisers. When you delete your account, everything is permanently removed within 30 days.</p>
                <p className="mt-2">Manage or export what we store: <strong>Profile &rarr; Privacy &amp; Data</strong></p>
            </div>

            <h2 className="text-base font-semibold text-[rgb(var(--paper-ink))] mt-6 mb-2">Age Requirements</h2>
            <p>Notive is designed for users aged 13 and older. We do not knowingly collect personal information from children under 13. If we learn that we have collected data from a child under 13, we will delete their account and associated data promptly. If you believe a child under 13 has created an account, please contact us at <a href={`mailto:${contactEmail}`} className="text-primary underline">{contactEmail}</a>.</p>

            <h2 className="text-base font-semibold text-[rgb(var(--paper-ink))] mt-6 mb-2">Information We Collect</h2>
            <p><strong>Account information:</strong> email address, name (optional), date of birth, and encrypted password.</p>
            <p><strong>Content you create:</strong> journal entries, mood tags, voice transcriptions, chapters, and any files you upload.</p>
            <p><strong>Usage data:</strong> feature interactions, entry frequency, and app performance metrics to improve the service.</p>
            <p><strong>Device information:</strong> device type, operating system, and push notification tokens (if you enable notifications).</p>
            <p><strong>Location data:</strong> only when you explicitly choose to tag an entry with your location. We never track location in the background.</p>

            <h2 className="text-base font-semibold text-[rgb(var(--paper-ink))] mt-6 mb-2">How We Use Your Information</h2>
            <p>We use your data to operate Notive&apos;s core features: entry capture, AI-powered insights and pattern recognition, personalized prompts, analytics, and output generation (e.g. resume stories, portfolio content).</p>
            <p>We do not use your data for advertising. We do not sell, rent, or trade your personal information.</p>

            <h2 className="text-base font-semibold text-[rgb(var(--paper-ink))] mt-6 mb-2">Third-Party Services</h2>
            <p>Notive uses the following third-party services to operate. Your data is shared with these services only as needed to provide functionality:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>OpenAI</strong> &mdash; processes entry text to generate insights, pattern analysis, and personalized prompts. Entry content is sent to OpenAI&apos;s API for processing but is not used by OpenAI to train their models (per their API data usage policy).</li>
                <li><strong>Firebase Cloud Messaging (Google)</strong> &mdash; delivers push notifications to your device. We send only notification content and device tokens; journal entries are not shared with Firebase.</li>
                <li><strong>Google OAuth</strong> &mdash; if you choose to sign in with Google, we receive your email and profile name from Google. We do not access your Google contacts, Drive, or other services.</li>
                <li><strong>Sentry</strong> &mdash; captures error reports and crash data to help us fix bugs. Error reports may include device type, OS version, and stack traces but do not include journal content.</li>
            </ul>

            <h2 className="text-base font-semibold text-[rgb(var(--paper-ink))] mt-6 mb-2">Data Retention</h2>
            <p><strong>Active accounts:</strong> your data is retained for as long as your account is active.</p>
            <p><strong>Deleted accounts:</strong> when you request account deletion, all personal data and content is permanently removed from our systems within 30 days. Backup copies are purged on the same schedule.</p>
            <p><strong>Voice audio:</strong> voice recordings are processed for transcription and then deleted. We do not retain raw audio files.</p>

            <h2 className="text-base font-semibold text-[rgb(var(--paper-ink))] mt-6 mb-2">Your Rights &amp; Choices</h2>
            <p>You can exercise the following at any time from <strong>Profile &rarr; Privacy &amp; Data</strong>:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>Export your data</strong> &mdash; download a complete JSON copy of your account and entries.</li>
                <li><strong>Delete your account</strong> &mdash; permanently remove all data, available in-app or via the <a href={ACCOUNT_DELETION_PATH} className="text-primary underline">public deletion page</a>.</li>
                <li><strong>Manage notifications</strong> &mdash; enable or disable push notifications and reminders.</li>
            </ul>
            <p className="mt-2">If you are located in the EU/EEA, you have additional rights under GDPR including the right to access, rectification, and data portability. Contact us at <a href={`mailto:${contactEmail}`} className="text-primary underline">{contactEmail}</a> to exercise these rights.</p>

            <h2 className="text-base font-semibold text-[rgb(var(--paper-ink))] mt-6 mb-2">Security</h2>
            <p>We protect your data with HTTPS encryption in transit, bcrypt password hashing, HTTP-only secure cookies, rate limiting, and input validation. While no system is perfectly risk-free, we follow industry best practices to safeguard your information.</p>

            <h2 className="text-base font-semibold text-[rgb(var(--paper-ink))] mt-6 mb-2">Changes to This Policy</h2>
            <p>We may update this privacy policy from time to time. Significant changes will be communicated via in-app notification or email. Continued use of Notive after changes constitutes acceptance of the updated policy.</p>

            <h2 className="text-base font-semibold text-[rgb(var(--paper-ink))] mt-6 mb-2">Contact</h2>
            <p>Questions or concerns about your privacy? Contact us at <a href={`mailto:${contactEmail}`} className="text-primary underline">{contactEmail}</a>.</p>
        </LegalPaperShell>
    );
}
