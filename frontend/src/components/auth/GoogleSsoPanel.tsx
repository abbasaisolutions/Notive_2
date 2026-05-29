'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useGoogleOAuth } from '@react-oauth/google';
import { getCredentialSsoAvailability } from '@/utils/sso';
import { ensureNativeGoogleSsoInitialized, signInWithNativeGoogleCredential } from '@/utils/native-google-auth';
import { resolveFriendlyMessage } from '@/utils/friendly-errors';
import { FiLoader } from 'react-icons/fi';
import useHasMounted from '@/hooks/use-has-mounted';
import logger from '@/utils/logger';

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
    troubleText: string;
    nativeButtonLabel: string;
    loadingText: string;
    successText: string;
    buttonText: 'signin_with' | 'signup_with' | 'continue_with';
}> = {
    login: {
        eyebrow: 'Google',
        title: 'Continue with Google',
        description: 'Skip the password and reopen the same Notive workspace tied to your Google email.',
        supportText: 'Use the same Google email as your Notive account to keep your notes, patterns, and story history together.',
        troubleText: 'Having trouble? Confirm a Google account is active on this device, then try again.',
        nativeButtonLabel: 'Continue with Google',
        loadingText: 'Opening your notebook...',
        successText: 'Google verified. Opening Notive...',
        buttonText: 'continue_with',
    },
    register: {
        eyebrow: 'Google',
        title: 'Start with Google',
        description: 'Create your account faster and keep your sign-in simple from the start.',
        supportText: 'After Google verifies you, we will ask for your birthday and finish setup.',
        troubleText: 'Having trouble? Add or confirm a Google account in Android Settings, then return to Notive.',
        nativeButtonLabel: 'Create account with Google',
        loadingText: 'Creating your Notive account...',
        successText: 'Account created. Finishing setup...',
        buttonText: 'signup_with',
    },
    reauth: {
        eyebrow: 'Google',
        title: 'Re-verify with Google',
        description: 'Use your Google account to unlock sensitive security changes for a short time.',
        supportText: 'This does not change your Google account. It only proves it is still you before high-impact account changes.',
        troubleText: 'Having trouble? Confirm the Google account for this Notive profile is active on this device.',
        nativeButtonLabel: 'Re-verify with Google',
        loadingText: 'Re-verifying with Google...',
        successText: 'Verified. You can continue...',
        buttonText: 'continue_with',
    },
};

const ALIGNMENT = {
    start: 'items-start text-left',
    center: 'items-center text-center',
} as const;

const getErrorMessage = (error: unknown, fallback: string) => resolveFriendlyMessage(error, fallback);

const classifyGoogleSsoError = (message: string) => {
    if (/did not finish|cancel|dismiss|interrupted/i.test(message)) return 'cancelled';
    if (/no google account|no credential|no credentials/i.test(message)) return 'no_device_account';
    if (/connection needs to be refreshed|oauth client|invalid_client|deleted_client/i.test(message)) return 'configuration';
    if (/network|failed to fetch|timeout/i.test(message)) return 'network';
    return 'unknown';
};

type GoogleCredentialResponse = {
    credential?: string;
    select_by?: string;
};

type GoogleIdentityRuntime = {
    initializedClientId: string | null;
    onSuccess: ((response: GoogleCredentialResponse) => void) | null;
    onError: (() => void) | null;
};

type GoogleIdentityWindow = Window & {
    google?: {
        accounts?: {
            id?: {
                initialize: (config: {
                    client_id: string;
                    callback: (response: GoogleCredentialResponse) => void;
                }) => void;
                renderButton: (
                    parent: HTMLElement,
                    options: {
                        theme: 'outline';
                        size: 'large';
                        shape: 'pill';
                        text: 'signin_with' | 'signup_with' | 'continue_with';
                        width: string;
                    },
                ) => void;
            };
        };
    };
    __notiveGoogleIdentityRuntime?: GoogleIdentityRuntime;
};

const getGoogleIdentityRuntime = (): GoogleIdentityRuntime => {
    const runtimeWindow = window as GoogleIdentityWindow;
    if (!runtimeWindow.__notiveGoogleIdentityRuntime) {
        runtimeWindow.__notiveGoogleIdentityRuntime = {
            initializedClientId: null,
            onSuccess: null,
            onError: null,
        };
    }

    return runtimeWindow.__notiveGoogleIdentityRuntime;
};

function GoogleCredentialButton({
    text,
    onSuccess,
    onError,
}: {
    text: 'signin_with' | 'signup_with' | 'continue_with';
    onSuccess: (credentialResponse: { credential?: string }) => void | Promise<void>;
    onError: () => void;
}) {
    const { clientId, scriptLoadedSuccessfully } = useGoogleOAuth();
    const buttonRef = React.useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const runtime = getGoogleIdentityRuntime();
        runtime.onSuccess = onSuccess;
        runtime.onError = onError;

        return () => {
            if (runtime.onSuccess === onSuccess) {
                runtime.onSuccess = null;
            }
            if (runtime.onError === onError) {
                runtime.onError = null;
            }
        };
    }, [onError, onSuccess]);

    useEffect(() => {
        if (!scriptLoadedSuccessfully || !buttonRef.current) return;

        const runtimeWindow = window as GoogleIdentityWindow;
        const identity = runtimeWindow.google?.accounts?.id;
        if (!identity) return;

        const runtime = getGoogleIdentityRuntime();
        if (runtime.initializedClientId !== clientId) {
            identity.initialize({
                client_id: clientId,
                callback: (response) => {
                    if (!response?.credential) {
                        runtime.onError?.();
                        return;
                    }
                    runtime.onSuccess?.(response);
                },
            });
            runtime.initializedClientId = clientId;
        }

        buttonRef.current.innerHTML = '';
        identity.renderButton(buttonRef.current, {
            theme: 'outline',
            size: 'large',
            shape: 'pill',
            text,
            width: '320',
        });
    }, [clientId, scriptLoadedSuccessfully, text]);

    return (
        <div
            ref={buttonRef}
            className="min-h-10 w-full max-w-[320px]"
            aria-label="Google sign-in button"
        />
    );
}

function GoogleSsoPanelComponent({
    mode,
    isLoading = false,
    isBlocked = false,
    blockedMessage,
    align = 'center',
    onSuccess,
    onError,
}: GoogleSsoPanelProps) {
    const hasMounted = useHasMounted();
    const availability = useMemo(
        () => (hasMounted
            ? getCredentialSsoAvailability('google')
            : {
                enabled: false,
                clientId: null,
                reason: 'missing_client_id' as const,
                surface: 'unavailable' as const,
            }),
        [hasMounted],
    );
    const copy = PANEL_COPY[mode];
    const [nativeLoading, setNativeLoading] = useState(false);
    const [nativeError, setNativeError] = useState<string | null>(null);
    const [nativeSuccess, setNativeSuccess] = useState(false);
    const showButton = hasMounted && availability.enabled;
    const isNativeSso = availability.enabled && availability.surface === 'native';
    const isInteractionDisabled = isLoading || isBlocked || nativeLoading || nativeSuccess;

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
        if (isInteractionDisabled) return;

        try {
            setNativeError(null);
            setNativeSuccess(false);
            setNativeLoading(true);
            const nativeIntent = mode === 'register'
                ? 'signup'
                : mode === 'reauth'
                    ? 'reauth'
                    : 'signin';
            logger.info('Native Google SSO started', {
                mode,
                intent: nativeIntent,
                surface: availability.surface,
            });
            const credential = await signInWithNativeGoogleCredential(nativeIntent);
            setNativeSuccess(true);
            logger.info('Native Google SSO credential received', {
                mode,
                intent: nativeIntent,
                surface: availability.surface,
            });
            await onSuccess({ credential });
        } catch (error) {
            const message = getErrorMessage(error, mode === 'register'
                ? 'Google sign-up failed. Please try again.'
                : 'Google sign-in failed. Please try again.');
            setNativeError(message);
            logger.warn('Native Google SSO failed', {
                mode,
                category: classifyGoogleSsoError(message),
                surface: availability.surface,
            });
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

                {!hasMounted ? (
                    <div className={`flex w-full flex-col gap-3 ${ALIGNMENT[align]}`}>
                        <div
                            aria-hidden="true"
                            className="h-10 w-full max-w-[320px] rounded-[1.2rem] border border-[rgba(92,92,92,0.14)] bg-[rgba(255,251,245,0.72)]"
                        />
                        <p className="text-xs text-ink-muted">{copy.supportText}</p>
                    </div>
                ) : showButton ? (
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
                                <span>{copy.nativeButtonLabel}</span>
                            </button>
                        ) : (
                            <div className={`max-w-full ${isInteractionDisabled ? 'pointer-events-none opacity-60' : ''}`}>
                                <GoogleCredentialButton
                                    onSuccess={onSuccess}
                                    onError={onError}
                                    text={copy.buttonText}
                                />
                            </div>
                        )}
                        {isBlocked && blockedMessage ? (
                            <p className="text-xs text-ink-muted">{blockedMessage}</p>
                        ) : nativeSuccess ? (
                            <p className="text-xs text-[rgb(65,93,76)]">{copy.successText}</p>
                        ) : nativeLoading ? (
                            <p className="text-xs text-ink-muted">{copy.loadingText}</p>
                        ) : nativeError ? (
                            <div className="space-y-1">
                                <p className="text-xs text-[rgb(122,87,76)]">{nativeError}</p>
                                <p className="text-xs text-ink-muted">{copy.troubleText}</p>
                            </div>
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

export const GoogleSsoPanel = React.memo(GoogleSsoPanelComponent);
GoogleSsoPanel.displayName = 'GoogleSsoPanel';
