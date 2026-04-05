'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { getCredentialSsoAvailability } from '@/utils/sso';
import { ensureNativeGoogleSsoInitialized, signInWithNativeGoogleCredential } from '@/utils/native-google-auth';
import { resolveFriendlyMessage } from '@/utils/friendly-errors';
import { FiLoader } from 'react-icons/fi';

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

const getErrorMessage = (error: unknown, fallback: string) => resolveFriendlyMessage(error, fallback);

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
    const [nativeLoading, setNativeLoading] = useState(false);
    const [nativeError, setNativeError] = useState<string | null>(null);
    const showButton = availability.enabled;
    const isNativeSso = availability.enabled && availability.surface === 'native';
    const isInteractionDisabled = isLoading || isBlocked || nativeLoading;

    useEffect(() => {
        if (!isNativeSso) return;

        let isMounted = true;
        void ensureNativeGoogleSsoInitialized().catch((error) => {
            if (!isMounted) return;
            setNativeError(getErrorMessage(error, 'Google sign-in is not ready on this device yet.'));
        });

        return () => {
            isMounted = false;
        };
    }, [isNativeSso]);

    const unavailableMessage = useMemo(() => {
        if (nativeError) {
            return nativeError;
        }

        if (availability.reason === 'missing_ios_client_id') {
            return 'Google sign-in is missing the iOS client ID for this mobile build.';
        }

        return 'Google sign-in is being configured for this environment.';
    }, [availability.reason, nativeError]);

    const handleNativeSignIn = async () => {
        try {
            setNativeError(null);
            setNativeLoading(true);
            const credential = await signInWithNativeGoogleCredential();
            await onSuccess({ credential });
        } catch (error) {
            setNativeError(getErrorMessage(error, 'Google sign-in failed. Please try again.'));
        } finally {
            setNativeLoading(false);
        }
    };

    return (
        <div className={`rounded-2xl workspace-soft-panel p-4 ${ALIGNMENT[align]}`}>
            <div className={`flex w-full flex-col gap-4 ${ALIGNMENT[align]}`}>
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
                        {copy.eyebrow}
                    </p>
                    <div className="space-y-1">
                        <p className="text-base font-semibold workspace-heading">{copy.title}</p>
                        <p className="text-sm text-ink-secondary">{copy.description}</p>
                    </div>
                </div>

                {showButton ? (
                    <div className={`flex w-full flex-col gap-3 ${ALIGNMENT[align]}`}>
                        {isNativeSso ? (
                            <button
                                type="button"
                                onClick={handleNativeSignIn}
                                disabled={isInteractionDisabled}
                                className="inline-flex w-full max-w-[320px] items-center justify-center gap-3 rounded-[1.2rem] border border-[rgba(92,92,92,0.22)] bg-[rgba(255,251,245,0.9)] px-4 py-3 text-sm font-semibold text-[rgb(58,58,58)] transition-all hover:bg-[rgba(255,251,245,0.96)] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {nativeLoading ? (
                                    <FiLoader className="h-4 w-4 animate-spin" aria-hidden="true" />
                                ) : (
                                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[rgba(92,92,92,0.18)] bg-white text-xs font-semibold">
                                        G
                                    </span>
                                )}
                                <span>{copy.title}</span>
                            </button>
                        ) : (
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
                        )}
                        {isBlocked && blockedMessage ? (
                            <p className="text-xs text-ink-muted">{blockedMessage}</p>
                        ) : nativeError ? (
                            <p className="text-xs text-[rgb(122,87,76)]">{nativeError}</p>
                        ) : (
                            <p className="text-xs text-ink-muted">{copy.supportText}</p>
                        )}
                    </div>
                ) : (
                    <div className="w-full rounded-xl workspace-muted-panel px-4 py-3 text-sm text-ink-secondary">
                        {unavailableMessage}
                    </div>
                )}
            </div>
        </div>
    );
}
