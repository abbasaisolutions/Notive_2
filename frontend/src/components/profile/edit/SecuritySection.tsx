'use client';

import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { FiLock, FiMail, FiShield, FiTrash2 } from 'react-icons/fi';
import { TextField } from './fields';

type SecuritySectionProps = {
    currentEmail: string;
    hasPassword: boolean;
    isGoogleEnabled: boolean;
    reauthPassword: string;
    signInEmail: string;
    confirmSignInEmail: string;
    newPassword: string;
    confirmPassword: string;
    deleteConfirmText: string;
    isSensitiveUnlocked: boolean;
    sensitiveSessionExpiresAt: string | null;
    isUnlockingSecurity: boolean;
    isUpdatingEmail: boolean;
    isChangingPassword: boolean;
    isDeletingAccount: boolean;
    onReauthPasswordChange: (value: string) => void;
    onSignInEmailChange: (value: string) => void;
    onConfirmSignInEmailChange: (value: string) => void;
    onNewPasswordChange: (value: string) => void;
    onConfirmPasswordChange: (value: string) => void;
    onDeleteConfirmTextChange: (value: string) => void;
    onUnlockWithPassword: () => void;
    onUnlockWithGoogle: (credentialResponse: { credential?: string }) => void | Promise<void>;
    onUnlockWithGoogleError: () => void;
    onUpdateEmail: () => void;
    onChangePassword: () => void;
    onDeleteAccount: () => void;
};

const formatExpiry = (value: string | null): string => {
    if (!value) return 'Not unlocked yet';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Not unlocked yet';
    return parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

export function SecuritySection({
    currentEmail,
    hasPassword,
    isGoogleEnabled,
    reauthPassword,
    signInEmail,
    confirmSignInEmail,
    newPassword,
    confirmPassword,
    deleteConfirmText,
    isSensitiveUnlocked,
    sensitiveSessionExpiresAt,
    isUnlockingSecurity,
    isUpdatingEmail,
    isChangingPassword,
    isDeletingAccount,
    onReauthPasswordChange,
    onSignInEmailChange,
    onConfirmSignInEmailChange,
    onNewPasswordChange,
    onConfirmPasswordChange,
    onDeleteConfirmTextChange,
    onUnlockWithPassword,
    onUnlockWithGoogle,
    onUnlockWithGoogleError,
    onUpdateEmail,
    onChangePassword,
    onDeleteAccount,
}: SecuritySectionProps) {
    return (
        <div className="space-y-6">
            <section className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
                <div className="bento-box p-8 space-y-6">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-ink-muted font-bold">Security</p>
                        <h2 className="mt-2 text-2xl font-serif text-white">Protect the account before changing it</h2>
                        <p className="mt-2 text-sm text-ink-secondary">
                            Sign-in email, password changes, and permanent deletion now live behind a short-lived verified session.
                        </p>
                    </div>

                    <div className="rounded-[1.6rem] border border-white/10 bg-black/20 p-5 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold text-white">Sensitive changes</p>
                                <p className="mt-1 text-xs text-ink-secondary">
                                    {isSensitiveUnlocked
                                        ? `Unlocked until ${formatExpiry(sensitiveSessionExpiresAt)}`
                                        : 'Unlock this section before editing sign-in or deletion settings.'}
                                </p>
                            </div>
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                                isSensitiveUnlocked
                                    ? 'border-primary/35 bg-primary/15 text-primary'
                                    : 'border-white/15 bg-white/[0.03] text-ink-secondary'
                            }`}>
                                {isSensitiveUnlocked ? 'Unlocked' : 'Locked'}
                            </span>
                        </div>

                        {hasPassword ? (
                            <div className="grid gap-4 md:grid-cols-[1fr,auto] md:items-end">
                                <TextField
                                    label="Current Password"
                                    type="password"
                                    value={reauthPassword}
                                    onChange={onReauthPasswordChange}
                                    placeholder="Enter your current password"
                                    helper="We only use this to unlock sensitive account changes for a short time."
                                />
                                <button
                                    type="button"
                                    onClick={onUnlockWithPassword}
                                    disabled={isUnlockingSecurity}
                                    className="inline-flex items-center justify-center gap-3 rounded-[1.3rem] border border-white/10 bg-white/[0.03] px-6 py-4 text-sm font-semibold text-white transition-all hover:bg-white/10 disabled:opacity-50"
                                >
                                    {isUnlockingSecurity ? (
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    ) : (
                                        <FiLock size={16} aria-hidden="true" />
                                    )}
                                    <span>Unlock Security Changes</span>
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-ink-secondary">
                                    This account signs in through Google. Re-verify with Google before changing the sign-in email, setting a password, or deleting the account.
                                </div>
                                {isGoogleEnabled ? (
                                    <div className="flex justify-start">
                                        <GoogleLogin
                                            onSuccess={onUnlockWithGoogle}
                                            onError={onUnlockWithGoogleError}
                                            theme="filled_black"
                                            width="280"
                                        />
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-ink-secondary">
                                        Google re-verification is unavailable in this environment.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <section className="bento-box p-6 space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="mt-1 rounded-xl bg-primary/10 p-2 text-primary">
                            <FiShield size={16} aria-hidden="true" />
                        </div>
                        <div>
                            <h3 className="text-xl font-serif text-white">What this protects</h3>
                            <p className="mt-2 text-sm text-ink-secondary">
                                Basic profile details can stay fast. Sign-in email, passwords, and deletion now require a second verification step.
                            </p>
                        </div>
                    </div>
                    <div className="space-y-3 text-sm text-ink-secondary">
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            Sign-in email changes preserve the current session when possible and clear the others.
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            Password changes revoke saved sessions on other devices and may also prompt this device to sign in again once the current session rolls over.
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            Permanent deletion requires a verified session and your sign-in email typed as confirmation.
                        </div>
                    </div>
                </section>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1fr,1fr]">
                <div className="bento-box p-8 space-y-6">
                    <div className="flex items-start gap-3">
                        <div className="mt-1 rounded-xl bg-primary/10 p-2 text-primary">
                            <FiMail size={16} aria-hidden="true" />
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-ink-muted font-bold">Sign-In Email</p>
                            <h3 className="mt-2 text-xl font-serif text-white">Change how you log in</h3>
                            <p className="mt-2 text-sm text-ink-secondary">
                                This is separate from your public profile details. It changes the email used for account access.
                            </p>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Current sign-in email</p>
                        <p className="mt-2 text-white break-all">{currentEmail || 'Not available'}</p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <TextField
                            label="New Sign-In Email"
                            type="email"
                            value={signInEmail}
                            onChange={onSignInEmailChange}
                            placeholder="name@example.com"
                        />
                        <TextField
                            label="Confirm New Email"
                            type="email"
                            value={confirmSignInEmail}
                            onChange={onConfirmSignInEmailChange}
                            placeholder="Repeat the new email"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={onUpdateEmail}
                        disabled={!isSensitiveUnlocked || isUpdatingEmail}
                        className="inline-flex items-center justify-center gap-3 rounded-[1.3rem] border border-white/10 bg-white/[0.03] px-6 py-4 text-sm font-semibold text-white transition-all hover:bg-white/10 disabled:opacity-50"
                    >
                        {isUpdatingEmail ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                            <FiMail size={16} aria-hidden="true" />
                        )}
                        <span>Update Sign-In Email</span>
                    </button>
                </div>

                <div className="bento-box p-8 space-y-6">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-ink-muted font-bold">Password</p>
                        <h3 className="mt-2 text-xl font-serif text-white">
                            {hasPassword ? 'Set a stronger password' : 'Create a local password'}
                        </h3>
                        <p className="mt-2 text-sm text-ink-secondary">
                            {hasPassword
                                ? 'Use the unlocked session to update your password without mixing it into ordinary profile edits.'
                                : 'If you signed up with Google, you can add a local password after re-verifying your identity.'}
                        </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <TextField
                            label="New Password"
                            type="password"
                            value={newPassword}
                            onChange={onNewPasswordChange}
                            placeholder="Enter a stronger password"
                            helper="Minimum 8 characters with uppercase, lowercase, and a number."
                        />
                        <TextField
                            label="Confirm New Password"
                            type="password"
                            value={confirmPassword}
                            onChange={onConfirmPasswordChange}
                            placeholder="Repeat new password"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={onChangePassword}
                        disabled={!isSensitiveUnlocked || isChangingPassword}
                        className="inline-flex items-center justify-center gap-3 rounded-[1.3rem] border border-white/10 bg-white/[0.03] px-6 py-4 text-sm font-semibold text-white transition-all hover:bg-white/10 disabled:opacity-50"
                    >
                        {isChangingPassword ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                            <FiLock size={16} aria-hidden="true" />
                        )}
                        <span>{hasPassword ? 'Update Password' : 'Set Password'}</span>
                    </button>
                </div>
            </section>

            <section id="delete-account" className="bento-box p-8 space-y-6 border-white/12 bg-[linear-gradient(135deg,rgba(20,27,45,0.94),rgba(13,18,34,0.92))]">
                <div className="flex items-start gap-3">
                    <div className="mt-1 rounded-xl bg-white/10 p-2 text-white">
                        <FiTrash2 size={16} aria-hidden="true" />
                    </div>
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-ink-muted font-bold">Danger Zone</p>
                        <h3 className="mt-2 text-xl font-serif text-white">Delete account permanently</h3>
                        <p className="mt-2 text-sm text-ink-secondary">
                            This removes your account, entries, collections, imports, and linked data. Type your sign-in email to confirm.
                        </p>
                    </div>
                </div>

                <TextField
                    label="Type Your Sign-In Email"
                    type="email"
                    value={deleteConfirmText}
                    onChange={onDeleteConfirmTextChange}
                    placeholder={currentEmail}
                    helper="This confirmation must match your current sign-in email exactly."
                />

                <button
                    type="button"
                    onClick={onDeleteAccount}
                    disabled={!isSensitiveUnlocked || isDeletingAccount}
                    className="inline-flex items-center justify-center gap-3 rounded-[1.3rem] border border-white/15 bg-white/[0.03] px-6 py-4 text-sm font-semibold text-white transition-all hover:bg-white/10 disabled:opacity-50"
                >
                    {isDeletingAccount ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                        <FiTrash2 size={16} aria-hidden="true" />
                    )}
                    <span>Delete Account Permanently</span>
                </button>
            </section>
        </div>
    );
}
