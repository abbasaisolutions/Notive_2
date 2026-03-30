import { ACCOUNT_DELETION_PATH, LEGAL_COPYRIGHT_NOTICE, LEGAL_ENTITY_NAME } from '@/config/legal';
import LegalPaperShell from '@/components/legal/LegalPaperShell';

export default function PrivacyPage() {
    return (
        <LegalPaperShell
            title="Privacy Policy"
            intro={`Notive is developed and operated by ${LEGAL_ENTITY_NAME}. This page explains what we collect, why we use it, and the choices you have.`}
            actions={[
                { href: '/register', label: 'Back to Sign Up', tone: 'primary' },
                { href: '/terms', label: 'View Terms' },
                { href: ACCOUNT_DELETION_PATH, label: 'Account Deletion' },
            ]}
            footer={LEGAL_COPYRIGHT_NOTICE}
        >
            <p>Notive collects account details and the entries or memories you provide to operate core features.</p>
            <p>We use your data to deliver capture, signal reading, synchronization, optional social import, and output generation functionality.</p>
            <p>You can export your data and request deletion from your profile settings, or through the public account deletion page if you cannot access the app.</p>
            <p>We apply security controls to protect account and content data, but no system is perfectly risk-free.</p>
            <p>By using Notive, you consent to this policy and any future updates posted on this page.</p>
        </LegalPaperShell>
    );
}
