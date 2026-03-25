'use client';

import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { getCredentialSsoAvailability } from '@/utils/sso';

type GoogleSsoPanelMode = 'login' | 'register' | 'reauth';

type GoogleSsoPanelProps = {
    mode: GoogleSsoPanelMode;
    isLoading?: boolean;
    isBlocked?: boolean;
    blockedMessage?: string;
    align?: 'start' | 'center';
    onSuccess: (credentialResponse: { credential?: string }) => void | Promise<void>;
    onError: () => void;
};

const PANEL_COPY: Record<GoogleSsoPanelMode, {
    eyebrow: string;
    title: string;
    description: string;
    supportText: string;
    buttonText: 'signin_with' | 'signup_with' | 'continue_with';
}> = {
    login: {
        eyebrow: 'Google',
        title: 'Continue with Google',
        description: 'Skip the password and reopen the same Notive workspace tied to your Google email.',
        supportText: 'Use the same Google email as your Notive account to keep your notes, patterns, and story history together.',
        buttonText: 'continue_with',
    },
    register: {
        eyebrow: 'Google',
        title: 'Start with Google',
        description: 'Create your account faster and keep your sign-in simple from the start.',
        supportText: 'If you already have a Notive account with that email, Google will open it instead of creating a duplicate.',
        buttonText: 'signup_with',
    },
    reauth: {
        eyebrow: 'Google',
        title: 'Re-verify with Google',
        description: 'Use your Google account to unlock sensitive security changes for a short time.',
        supportText: 'This does not change your Google account. It only proves it is still you before high-impact account changes.',
        buttonText: 'continue_with',
    },
};

const ALIGNMENT = {
    start: 'items-start text-left',
    center: 'items-center text-center',
} as const;

export function GoogleSsoPanel({
    mode,
    isLoading = false,
    isBlocked = false,
    blockedMessage,
    align = 'center',
    onSuccess,
    onError,
}: GoogleSsoPanelProps) {
    const availability = getCredentialSsoAvailability('google');
    const copy = PANEL_COPY[mode];
    const showButton = availability.enabled;
    const isInteractionDisabled = isLoading || isBlocked;

    let unavailableMessage = 'Google sign-in is being configured for this environment.';
    if (availability.reason === 'native_webview') {
        unavailableMessage = 'Google sign-in is not enabled inside the mobile app yet. Use email and password here, or sign in on the web at notive.abbasaisolutions.com.';
    }

    return (
        <div className={`rounded-2xl border border-white/10 bg-white/[0.03] p-4 ${ALIGNMENT[align]}`}>
            <div className={`flex w-full flex-col gap-4 ${ALIGNMENT[align]}`}>
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
                        {copy.eyebrow}
                    </p>
                    <div className="space-y-1">
                        <p className="text-base font-semibold text-white">{copy.title}</p>
                        <p className="text-sm text-ink-secondary">{copy.description}</p>
                    </div>
                </div>

                {showButton ? (
                    <div className={`flex w-full flex-col gap-3 ${ALIGNMENT[align]}`}>
                        <div className={`max-w-full ${isInteractionDisabled ? 'pointer-events-none opacity-60' : ''}`}>
                            <GoogleLogin
                                onSuccess={onSuccess}
                                onError={onError}
                                theme="outline"
                                size="large"
                                shape="pill"
                                text={copy.buttonText}
                                width="320"
                            />
                        </div>
                        {isBlocked && blockedMessage ? (
                            <p className="text-xs text-ink-muted">{blockedMessage}</p>
                        ) : (
                            <p className="text-xs text-ink-muted">{copy.supportText}</p>
                        )}
                    </div>
                ) : (
                    <div className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-ink-secondary">
                        {unavailableMessage}
                    </div>
                )}
            </div>
        </div>
    );
}
