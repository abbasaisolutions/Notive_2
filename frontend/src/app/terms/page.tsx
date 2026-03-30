import { ACCOUNT_DELETION_PATH, LEGAL_COPYRIGHT_NOTICE, LEGAL_ENTITY_NAME } from '@/config/legal';
import LegalPaperShell from '@/components/legal/LegalPaperShell';

export default function TermsPage() {
    return (
        <LegalPaperShell
            title="Terms of Service"
            intro={`Notive is developed and operated by ${LEGAL_ENTITY_NAME}. These terms describe how to use the service responsibly and what stays yours.`}
            actions={[
                { href: '/register', label: 'Back to Sign Up', tone: 'primary' },
                { href: '/privacy', label: 'View Privacy Policy' },
                { href: ACCOUNT_DELETION_PATH, label: 'Account Deletion' },
            ]}
            footer={LEGAL_COPYRIGHT_NOTICE}
        >
            <p>By using Notive, you agree to use the service lawfully and keep your account credentials secure.</p>
            <p>You own your content. You grant Notive permission to process it to provide capture, signal reading, synchronization, and output features.</p>
            <p>Do not upload illegal content, infringing material, or content intended to harm the service or other users.</p>
            <p>Notive may suspend accounts for abuse, policy violations, or security risk.</p>
            <p>These terms may be updated. Continued use of Notive after updates means you accept the revised terms.</p>
            <p>Notive software, branding, and related materials remain proprietary to {LEGAL_ENTITY_NAME} unless expressly licensed otherwise in writing.</p>
        </LegalPaperShell>
    );
}
