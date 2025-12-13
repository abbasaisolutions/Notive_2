import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import { SmartProvider } from "@/context/smart-context";
import { GamificationProvider } from "@/context/gamification-context";
import { ThemeProvider } from "@/context/theme-context";
import ContextPrompt from "@/components/smart/ContextPrompt";
import MobileNav from "@/components/layout/MobileNav";
import CelebrationModal from "@/components/gamification/CelebrationModal";
import FloatingVoiceButton from "@/components/voice/FloatingVoiceButton";
import SmartPromptNotification from "@/components/voice/SmartPromptNotification";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Notive",
    description: "A stunning, modern note-taking experience.",
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
            <body className={inter.className}>
                <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                    <ThemeProvider>
                        <AuthProvider>
                            <GamificationProvider>
                                <SmartProvider>
                                    {children}
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
