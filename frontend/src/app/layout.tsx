import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import { SmartProvider } from "@/context/smart-context";
import { GamificationProvider } from "@/context/gamification-context";
import { ThemeProvider } from "@/context/theme-context";
import ContextPrompt from "@/components/smart/ContextPrompt";
import MobileNav from "@/components/layout/MobileNav";
import Sidebar from "@/components/layout/Sidebar";
import CelebrationModal from "@/components/gamification/CelebrationModal";
import FloatingVoiceButton from "@/components/voice/FloatingVoiceButton";
import SmartPromptNotification from "@/components/voice/SmartPromptNotification";

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });
const playfair = Playfair_Display({ subsets: ["latin"], variable: '--font-serif' });

export const metadata: Metadata = {
    title: "Notive | Your AI-Powered Journaling Companion",
    description: "Capture your thoughts, track your mood, and discover insights about yourself with a beautiful, secure, and intelligent journaling experience.",
    keywords: ["journaling", "AI", "mood tracking", "self-improvement", "privacy", "notes"],
    authors: [{ name: "Notive Team" }],
<<<<<<< HEAD
    icons: {
        icon: "/logos/icon.png",
        shortcut: "/logos/icon.png",
        apple: "/logos/icon.png",
=======
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'Notive',
    },
    viewport: {
        width: 'device-width',
        initialScale: 1,
        maximumScale: 1,
        userScalable: false, // Prevents input zoom on mobile
>>>>>>> 9a9c056f33be4adfa1b5521a7d2268f2927d9d5e
    },
    openGraph: {
        title: "Notive | Your AI-Powered Journaling Companion",
        description: "Capture your thoughts, track your mood, and discover insights about yourself.",
        url: "https://notive.app",
        siteName: "Notive",
        images: [
            {
                url: "/logos/logo-withbg.png",
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
        images: ["/logos/logo-withbg.png"],
    },
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

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'your-google-client-id';

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${inter.variable} ${playfair.variable} font-sans`}>
                <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                    <ThemeProvider>
                        <AuthProvider>
                            <GamificationProvider>
                                <SmartProvider>
                                    <script
                                        type="application/ld+json"
                                        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                                    />
                                    <div className="flex min-h-screen relative overflow-hidden cosmic-bg">
                                        <Sidebar />
                                        <div className="flex-1 w-full relative z-10">
                                            {children}
                                        </div>
                                    </div>
                                    <ContextPrompt />
                                    <MobileNav />
                                    <CelebrationModal />
                                    <FloatingVoiceButton />
                                    <SmartPromptNotification />
                                </SmartProvider>
                            </GamificationProvider>
                        </AuthProvider>
                    </ThemeProvider>
                </GoogleOAuthProvider>
            </body>
        </html>
    );
}
