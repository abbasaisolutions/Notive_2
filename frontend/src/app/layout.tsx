import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Fraunces } from "next/font/google";
import { Suspense } from "react";
import Link from "next/link";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import { SmartProvider } from "@/context/smart-context";
import { GamificationProvider } from "@/context/gamification-context";
import { ThemeProvider } from "@/context/theme-context";
import AppChrome from "@/components/layout/AppChrome";
import RouteHeader from "@/components/layout/RouteHeader";
import OnboardingGuard from "@/components/onboarding/OnboardingGuard";
import { NOTIVE_VOICE } from "@/content/notive-voice";
import { getCredentialSsoClientId } from "@/utils/sso";
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ACCOUNT_DELETION_PATH, LEGAL_COPYRIGHT_NOTICE, LEGAL_ENTITY_NAME, LEGAL_FOOTER_NOTICE } from "@/config/legal";
import { PUBLIC_APP_ORIGIN, PUBLIC_APP_URL, PUBLIC_OG_IMAGE_URL } from "@/config/site";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: '--font-sans' });
const fraunces = Fraunces({ subsets: ["latin"], variable: '--font-serif' });

export const metadata: Metadata = {
    title: `${NOTIVE_VOICE.appName} | ${NOTIVE_VOICE.signature}`,
    description: NOTIVE_VOICE.longSummary,
    keywords: ["reflective writing", "memory tracking", "personal analytics", "story building", "privacy", "self understanding"],
    authors: [{ name: LEGAL_ENTITY_NAME }],
    creator: LEGAL_ENTITY_NAME,
    publisher: LEGAL_ENTITY_NAME,
    manifest: '/manifest.webmanifest',
    metadataBase: PUBLIC_APP_ORIGIN,
    icons: {
        icon: [
            { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
        apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'Notive',
    },
    other: {
        'mobile-web-app-capable': 'yes',
        copyright: LEGAL_COPYRIGHT_NOTICE,
    },
    openGraph: {
        title: `${NOTIVE_VOICE.appName} | ${NOTIVE_VOICE.signature}`,
        description: NOTIVE_VOICE.shortSummary,
        url: PUBLIC_APP_URL,
        siteName: "Notive",
        images: [
            {
                url: PUBLIC_OG_IMAGE_URL,
                width: 1200,
                height: 630,
            },
        ],
        locale: "en_US",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: `${NOTIVE_VOICE.appName} | ${NOTIVE_VOICE.signature}`,
        description: NOTIVE_VOICE.shortSummary,
        images: [PUBLIC_OG_IMAGE_URL],
    },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
};

const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": NOTIVE_VOICE.appName,
    "operatingSystem": "Web",
    "applicationCategory": "LifestyleApplication",
    "author": {
        "@type": "Organization",
        "name": LEGAL_ENTITY_NAME
    },
    "publisher": {
        "@type": "Organization",
        "name": LEGAL_ENTITY_NAME
    },
    "copyrightHolder": {
        "@type": "Organization",
        "name": LEGAL_ENTITY_NAME
    },
    "copyrightYear": "2026",
    "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
    },
    "description": NOTIVE_VOICE.longSummary
};
function GoogleProviderWrapper({ children }: { children: React.ReactNode }) {
    const googleClientId = getCredentialSsoClientId('google');

    if (!googleClientId) {
        return <>{children}</>;
    }

    return (
        <GoogleOAuthProvider clientId={googleClientId}>
            {children}
        </GoogleOAuthProvider>
    );
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${jakarta.variable} ${fraunces.variable} font-sans tracking-[0.005em]`}>
                <GoogleProviderWrapper>
                    <ThemeProvider>
                        <AuthProvider>
                            <GamificationProvider>
                                <SmartProvider>
                                    <OnboardingGuard />
                                    <script
                                        type="application/ld+json"
                                        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                                    />
                                    <a href="#main-content" className="skip-link">
                                        Skip to main content
                                    </a>
                                    <div className="flex min-h-screen relative overflow-hidden cosmic-bg">
                                        <AppChrome />
                                        <main
                                            id="main-content"
                                            className="flex-1 w-full relative z-10 app-shell spotlight-grid"
                                            tabIndex={-1}
                                            style={{ paddingBottom: 'var(--app-bottom-clearance, 0px)' }}
                                        >
                                            <Suspense fallback={null}>
                                                <RouteHeader />
                                            </Suspense>
                                            {children}
                                            <footer className="px-6 pb-8 pt-10 text-center text-xs text-ink-muted">
                                                <p>{LEGAL_FOOTER_NOTICE}</p>
                                                <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-[0.76rem]">
                                                    <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
                                                    <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
                                                    <Link href={ACCOUNT_DELETION_PATH} className="hover:text-white transition-colors">Account deletion</Link>
                                                </div>
                                            </footer>
                                        </main>
                                    </div>
                                </SmartProvider>
                            </GamificationProvider>
                        </AuthProvider>
                    </ThemeProvider>
                </GoogleProviderWrapper>
            </body>
        </html>
    );
}
