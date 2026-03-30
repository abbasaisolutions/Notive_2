'use client';

import React, { useState } from 'react';
import { GoogleSsoPanel } from '@/components/auth/GoogleSsoPanel';
import { FiLock, FiMail, FiShield, FiTrash2 } from 'react-icons/fi';
import { ConfirmDialog } from '@/components/ui';
import { TextField } from './fields';

type SecuritySectionProps = {
    currentEmail: string;
    hasPassword: boolean;
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
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    return (
        <div className="space-y-6">
            <section className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
                <div className="workspace-panel rounded-[2rem] p-8 space-y-6">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-ink-muted font-bold">Security</p>
                        <h2 className="workspace-heading mt-2 text-2xl font-serif">Check your account before big changes</h2>
                        <p className="mt-2 text-sm text-ink-secondary">
                            Sign-in email, password changes, and delete account tools are locked until you verify again.
                        </p>
                    </div>

                    <div className="workspace-soft-panel rounded-[1.6rem] p-5 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="workspace-heading text-sm font-semibold">Locked actions</p>
                                <p className="mt-1 text-xs text-ink-secondary">
                                    {isSensitiveUnlocked
                                        ? `Unlocked until ${formatExpiry(sensitiveSessionExpiresAt)}`
                                        : 'Unlock this section before changing sign-in details or deleting the account.'}
                                </p>
                            </div>
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                                isSensitiveUnlocked
                                    ? 'border-primary/35 bg-primary/15 text-primary'
                                    : 'workspace-pill text-ink-secondary'
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
                                    className="workspace-button-outline inline-flex items-center justify-center gap-3 rounded-[1.3rem] px-6 py-4 text-sm font-semibold transition-all disabled:opacity-50"
                                >
                                    {isUnlockingSecurity ? (
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    ) : (
                                        <FiLock size={16} aria-hidden="true" />
                                    )}
                                    <span>Unlock this section</span>
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="workspace-soft-panel rounded-2xl p-4 text-sm text-ink-secondary">
                                    This account signs in through Google. Re-verify with Google before changing the sign-in email, setting a password, or deleting the account.
                                </div>
                                <GoogleSsoPanel
                                    mode="reauth"
                                    align="start"
                                    isLoading={isUnlockingSecurity}
                                    onSuccess={onUnlockWithGoogle}
                                    onError={onUnlockWithGoogleError}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <section className="workspace-panel rounded-[2rem] p-6 space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="mt-1 rounded-xl bg-primary/10 p-2 text-primary">
                            <FiShield size={16} aria-hidden="true" />
                        </div>
                        <div>
                            <h3 className="workspace-heading text-xl font-serif">Why this matters</h3>
                            <p className="mt-2 text-sm text-ink-secondary">
                                Basic profile details can stay fast. Sign-in email, passwords, and deletion now require a second verification step.
                            </p>
                        </div>
                    </div>
                    <div className="space-y-3 text-sm text-ink-secondary">
                        <div className="workspace-soft-panel rounded-2xl p-4">
                            Sign-in email changes preserve the current session when possible and clear the others.
                        </div>
                        <div className="workspace-soft-panel rounded-2xl p-4">
                            Password changes revoke saved sessions on other devices and may also prompt this device to sign in again once the current session rolls over.
                        </div>
                        <div className="workspace-soft-panel rounded-2xl p-4">
                            Permanent deletion requires a verified session and your sign-in email typed as confirmation.
                        </div>
                    </div>
                </section>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1fr,1fr]">
                <div className="workspace-panel rounded-[2rem] p-8 space-y-6">
                    <div className="flex items-start gap-3">
                        <div className="mt-1 rounded-xl bg-primary/10 p-2 text-primary">
                            <FiMail size={16} aria-hidden="true" />
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-ink-muted font-bold">Sign-In Email</p>
                            <h3 className="workspace-heading mt-2 text-xl font-serif">Change your sign-in email</h3>
                            <p className="mt-2 text-sm text-ink-secondary">
                                This is separate from your public profile details. It changes the email used for account access.
                            </p>
                        </div>
                    </div>

                    <div className="workspace-soft-panel rounded-2xl p-4">
                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Current sign-in email</p>
                        <p className="workspace-heading mt-2 break-all">{currentEmail || 'Not available'}</p>
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
                        className="workspace-button-primary inline-flex items-center justify-center gap-3 rounded-[1.3rem] px-6 py-4 text-sm font-semibold transition-all disabled:opacity-50"
                    >
                        {isUpdatingEmail ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                            <FiMail size={16} aria-hidden="true" />
                        )}
                        <span>Update Sign-In Email</span>
                    </button>
                </div>

                <div className="workspace-panel rounded-[2rem] p-8 space-y-6">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-ink-muted font-bold">Password</p>
                        <h3 className="workspace-heading mt-2 text-xl font-serif">
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
                        className="workspace-button-primary inline-flex items-center justify-center gap-3 rounded-[1.3rem] px-6 py-4 text-sm font-semibold transition-all disabled:opacity-50"
                    >
                        {isChangingPassword ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                            <FiLock size={16} aria-hidden="true" />
                        )}
                        <span>{hasPassword ? 'Update Password' : 'Set Password'}</span>
                    </button>
                </div>
            </section>

            <section
                id="delete-account"
                className="rounded-[2rem] border p-8 space-y-6"
                style={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.82), rgba(246,236,226,0.92))',
                    borderColor: 'rgba(214, 185, 149, 0.5)',
                    boxShadow: '0 18px 42px rgba(133, 104, 71, 0.1)',
                }}
            >
                <div className="flex items-start gap-3">
                    <div className="mt-1 rounded-xl border border-[rgba(214,185,149,0.42)] bg-[rgba(214,185,149,0.14)] p-2 text-[rgb(var(--paper-ink))]">
                        <FiTrash2 size={16} aria-hidden="true" />
                    </div>
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-ink-muted font-bold">Delete Account</p>
                        <h3 className="workspace-heading mt-2 text-xl font-serif">Delete your account</h3>
                        <p className="mt-2 text-sm text-ink-secondary">
                            This removes your account, notes, groups, imports, and linked data. Type your sign-in email to confirm.
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
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={!isSensitiveUnlocked || isDeletingAccount || deleteConfirmText !== currentEmail}
                    className="inline-flex items-center justify-center gap-3 rounded-[1.3rem] border border-[rgba(214,185,149,0.44)] bg-[rgba(214,185,149,0.12)] px-6 py-4 text-sm font-semibold text-[rgb(var(--text-primary))] transition-all hover:bg-[rgba(214,185,149,0.18)] disabled:opacity-50"
                >
                    {isDeletingAccount ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                        <FiTrash2 size={16} aria-hidden="true" />
                    )}
                    <span>Delete account</span>
                </button>

                {showDeleteConfirm && (
                    <ConfirmDialog
                        open={showDeleteConfirm}
                        title="Permanently delete your account?"
                        description="All your notes, groups, imports, and linked data will be permanently removed. This cannot be undone."
                        actionLabel="Delete Everything"
                        isDangerous={true}
                        isLoading={isDeletingAccount}
                        onConfirm={onDeleteAccount}
                        onCancel={() => setShowDeleteConfirm(false)}
                    />
                )}
            </section>
        </div>
    );
}
