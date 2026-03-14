import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Fraunces } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import { SmartProvider } from "@/context/smart-context";
import { GamificationProvider } from "@/context/gamification-context";
import { ThemeProvider } from "@/context/theme-context";
import AppChrome from "@/components/layout/AppChrome";
import RouteHeader from "@/components/layout/RouteHeader";
import OnboardingGuard from "@/components/onboarding/OnboardingGuard";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: '--font-sans' });
const fraunces = Fraunces({ subsets: ["latin"], variable: '--font-serif' });

export const metadata: Metadata = {
    title: "Notive | Your AI-Powered Journaling Companion",
    description: "Capture your thoughts, track your mood, and discover insights about yourself with a beautiful, secure, and intelligent journaling experience.",
    keywords: ["journaling", "AI", "mood tracking", "self-improvement", "privacy", "notes"],
    authors: [{ name: "Notive Team" }],
    manifest: '/manifest.json',
    metadataBase: new URL('https://notive.app'),
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
    },
    openGraph: {
        title: "Notive | Your AI-Powered Journaling Companion",
        description: "Capture your thoughts, track your mood, and discover insights about yourself.",
        url: "https://notive.app",
        siteName: "Notive",
        images: [
            {
                url: "https://notive.app/og-image.png",
                width: 1200,
                height: 630,
            },
        ],
        locale: "en_US",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Notive | Your AI-Powered Journaling Companion",
        description: "Capture your thoughts, track your mood, and discover insights about yourself.",
        images: ["https://notive.app/og-image.png"],
    },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
};

const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Notive",
    "operatingSystem": "Web",
    "applicationCategory": "LifestyleApplication",
    "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
    },
    "description": "A stunning, modern note-taking experience with AI insights and mood tracking."
};

import { GoogleOAuthProvider } from '@react-oauth/google';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const isValidGoogleClientId = (value?: string) =>
    !!value &&
    value !== 'your-google-client-id' &&
    /\.apps\.googleusercontent\.com$/i.test(value);

function GoogleProviderWrapper({ children }: { children: React.ReactNode }) {
    if (!isValidGoogleClientId(GOOGLE_CLIENT_ID)) {
        return <>{children}</>;
    }

    return (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID!}>
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
