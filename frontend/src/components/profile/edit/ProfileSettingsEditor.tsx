'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FadeIn, SlideUp } from '@/components/ui/animated-wrappers';
import useApi from '@/hooks/use-api';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import { useAuth } from '@/context/auth-context';
import { buildProfileContextSummary } from '@/services/profile-context.service';
import { hasCompletedOnboardingRequirements } from '@/utils/onboarding';
import { FiArrowLeft, FiClock } from 'react-icons/fi';
import { NoticeBanner } from './fields';
import { PreferencesSection } from './PreferencesSection';
import { PrivacySection } from './PrivacySection';
import { ProfileSection } from './ProfileSection';
import { SecuritySection } from './SecuritySection';
import {
    addTag,
    asPromptFrequency,
    buildPreferencesDraft,
    buildPrivacyDraft,
    buildProfileDraft,
    buildSignalAnswerList,
    compactSignals,
    createSignalsDraft,
    EDITABLE_TABS,
    EMPTY_PREFERENCES_DRAFT,
    EMPTY_PRIVACY_DRAFT,
    EMPTY_PROFILE_DRAFT,
    ensureSignalsDraft,
    PASSWORD_COMPLEXITY_REGEX,
    PASSWORD_MIN_LENGTH,
    resolveEditTab,
    serializeDraft,
    TAB_ITEMS,
    toDateLabel,
    type ChecklistItem,
    type ConflictState,
    type EditTab,
    type EditableTab,
    type Notice,
    type PreferencesDraft,
    type PrivacyDraft,
    type ProfileDraft,
    type SignalEntry,
    type SnapshotUser,
} from './types';

export function ProfileSettingsEditor() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isLoading: authLoading, isAuthenticated } = useAuthRedirect();
    const { refreshUser, logout } = useAuth();
    const { apiFetch } = useApi();

    const [activeTab, setActiveTab] = useState<EditTab>(resolveEditTab(searchParams.get('tab')));
    const [hydratedUserId, setHydratedUserId] = useState<string | null>(null);
    const [profileDraft, setProfileDraft] = useState<ProfileDraft>(EMPTY_PROFILE_DRAFT);
    const [savedProfileDraft, setSavedProfileDraft] = useState<ProfileDraft>(EMPTY_PROFILE_DRAFT);
    const [preferencesDraft, setPreferencesDraft] = useState<PreferencesDraft>(EMPTY_PREFERENCES_DRAFT);
    const [savedPreferencesDraft, setSavedPreferencesDraft] = useState<PreferencesDraft>(EMPTY_PREFERENCES_DRAFT);
    const [privacyDraft, setPrivacyDraft] = useState<PrivacyDraft>(EMPTY_PRIVACY_DRAFT);
    const [savedPrivacyDraft, setSavedPrivacyDraft] = useState<PrivacyDraft>(EMPTY_PRIVACY_DRAFT);
    const [lifeGoalsDraft, setLifeGoalsDraft] = useState('');
    const [outputGoalsDraft, setOutputGoalsDraft] = useState('');
    const [serverUserUpdatedAt, setServerUserUpdatedAt] = useState<string | null>(null);
    const [serverProfileUpdatedAt, setServerProfileUpdatedAt] = useState<string | null>(null);
    const [notice, setNotice] = useState<Notice | null>(null);
    const [conflict, setConflict] = useState<ConflictState | null>(null);
    const [isSavingTab, setIsSavingTab] = useState<EditableTab | null>(null);
    const [reauthPassword, setReauthPassword] = useState('');
    const [sensitiveActionToken, setSensitiveActionToken] = useState('');
    const [sensitiveSessionExpiresAt, setSensitiveSessionExpiresAt] = useState<string | null>(null);
    const [signInEmailDraft, setSignInEmailDraft] = useState('');
    const [confirmSignInEmailDraft, setConfirmSignInEmailDraft] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [isUnlockingSecurity, setIsUnlockingSecurity] = useState(false);
    const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const isGoogleEnabled = !!googleClientId &&
        googleClientId !== 'your-google-client-id' &&
        /\.apps\.googleusercontent\.com$/i.test(googleClientId);
    const hasPassword = Boolean(user?.hasPassword);

    const resetNoticeState = () => {
        setNotice(null);
        setConflict(null);
    };

    const hydrateDraftsFromSnapshot = (source: SnapshotUser | null | undefined) => {
        const nextProfile = buildProfileDraft(source);
        const nextPreferences = buildPreferencesDraft(source);
        const nextPrivacy = buildPrivacyDraft(source);

        setProfileDraft(nextProfile);
        setSavedProfileDraft(nextProfile);
        setPreferencesDraft(nextPreferences);
        setSavedPreferencesDraft(nextPreferences);
        setPrivacyDraft(nextPrivacy);
        setSavedPrivacyDraft(nextPrivacy);
        setLifeGoalsDraft('');
        setOutputGoalsDraft('');
        setSignInEmailDraft(source?.email || '');
        setConfirmSignInEmailDraft('');
        setServerUserUpdatedAt(source?.updatedAt || null);
        setServerProfileUpdatedAt(source?.profile?.updatedAt || null);
        setConflict(null);
    };

    useEffect(() => {
        if (!user) return;
        if (hydratedUserId === user.id) return;
        hydrateDraftsFromSnapshot(user as SnapshotUser);
        setHydratedUserId(user.id);
    }, [user, hydratedUserId]);

    useEffect(() => {
        const nextTab = resolveEditTab(searchParams.get('tab'));
        if (nextTab !== activeTab) {
            setActiveTab(nextTab);
        }
    }, [searchParams, activeTab]);

    const profileDirty = serializeDraft(profileDraft) !== serializeDraft(savedProfileDraft);
    const preferencesDirty = serializeDraft(preferencesDraft) !== serializeDraft(savedPreferencesDraft);
    const privacyDirty = serializeDraft(privacyDraft) !== serializeDraft(savedPrivacyDraft);
    const hasDirtyChanges = profileDirty || preferencesDirty || privacyDirty;
    const hasUnlockedSensitiveActions = Boolean(
        sensitiveActionToken &&
        sensitiveSessionExpiresAt &&
        new Date(sensitiveSessionExpiresAt).getTime() > Date.now()
    );

    const clearSensitiveSession = () => {
        setSensitiveActionToken('');
        setSensitiveSessionExpiresAt(null);
        setReauthPassword('');
    };

    useEffect(() => {
        if (!hasDirtyChanges || typeof window === 'undefined') {
            return;
        }

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasDirtyChanges]);

    const activeEditableTab = EDITABLE_TABS.find((tab) => tab === activeTab) || null;
    const dirtyByTab: Record<EditableTab, boolean> = {
        profile: profileDirty,
        preferences: preferencesDirty,
        privacy: privacyDirty,
    };
    const activeDirty = activeEditableTab ? dirtyByTab[activeEditableTab] : false;
    const activeConflict = activeEditableTab && conflict?.tab === activeEditableTab ? conflict : null;

    const profileContext = useMemo(
        () =>
            buildProfileContextSummary({
                primaryGoal: preferencesDraft.primaryGoal || null,
                focusArea: preferencesDraft.focusArea || null,
                experienceLevel: preferencesDraft.experienceLevel || null,
                writingPreference: preferencesDraft.writingPreference || null,
                starterPrompt: preferencesDraft.starterPrompt || null,
                importPreference: preferencesDraft.importPreference || null,
                lifeGoals: profileDraft.lifeGoals,
                outputGoals: preferencesDraft.outputGoals,
                onboardingCompletedAt: preferencesDraft.onboardingCompletedAt,
            }),
        [preferencesDraft, profileDraft.lifeGoals]
    );

    const checklistItems = useMemo<ChecklistItem[]>(
        () => [
            {
                id: 'goal',
                label: 'Set a primary goal',
                done: Boolean(preferencesDraft.primaryGoal),
                hint: 'This guides coaching, insights, and portfolio emphasis.',
            },
            {
                id: 'focus',
                label: 'Choose a focus area',
                done: Boolean(preferencesDraft.focusArea),
                hint: 'This decides whether the product prioritizes life, career, or both.',
            },
            {
                id: 'experience',
                label: 'Select an experience level',
                done: Boolean(preferencesDraft.experienceLevel),
                hint: 'This tunes recommendation tone and framing.',
            },
            {
                id: 'writing',
                label: 'Pick a writing style',
                done: Boolean(preferencesDraft.writingPreference),
                hint: 'This influences capture and reflection prompts.',
            },
            {
                id: 'life-goals',
                label: 'Add at least one life goal',
                done: profileDraft.lifeGoals.length > 0,
                hint: 'This gives the app context for long-term reflection.',
            },
            {
                id: 'output-goals',
                label: 'Add at least one output goal',
                done: preferencesDraft.outputGoals.length > 0,
                hint: 'This improves portfolio and application output quality.',
            },
            {
                id: 'starter',
                label: 'Set a starter prompt preference',
                done: Boolean(preferencesDraft.starterPrompt.trim()),
                hint: 'This reduces friction when starting new entries.',
            },
        ],
        [preferencesDraft, profileDraft.lifeGoals]
    );

    const signalEntries = useMemo(
        () => buildSignalAnswerList(privacyDraft.personalizationSignals),
        [privacyDraft.personalizationSignals]
    );

    const promptFrequency = asPromptFrequency(privacyDraft.personalizationSignals?.settings?.promptFrequency);
    const promptedCount = privacyDraft.personalizationSignals?.metrics?.promptedCount || 0;
    const answeredCount = privacyDraft.personalizationSignals?.metrics?.answeredCount || signalEntries.length;
    const dismissedCount = privacyDraft.personalizationSignals?.metrics?.dismissedCount || 0;
    const lastSignalAction = privacyDraft.personalizationSignals?.metrics?.lastActionAt
        || privacyDraft.personalizationSignals?.updatedAt
        || null;
    const lastSavedAt = serverProfileUpdatedAt || serverUserUpdatedAt;

    const handleTabChange = (tab: EditTab) => {
        setActiveTab(tab);
        const params = new URLSearchParams(searchParams.toString());
        if (tab === 'profile') {
            params.delete('tab');
        } else {
            params.set('tab', tab);
        }

        const query = params.toString();
        router.replace(query ? `/profile/edit?${query}` : '/profile/edit', { scroll: false });
    };

    const handleAddLifeGoal = () => {
        setProfileDraft((current) => ({
            ...current,
            lifeGoals: addTag(current.lifeGoals, lifeGoalsDraft, 20, 120),
        }));
        setLifeGoalsDraft('');
        resetNoticeState();
    };

    const handleRemoveLifeGoal = (value: string) => {
        setProfileDraft((current) => ({
            ...current,
            lifeGoals: current.lifeGoals.filter((item) => item !== value),
        }));
        resetNoticeState();
    };

    const handleAddOutputGoal = () => {
        setPreferencesDraft((current) => ({
            ...current,
            outputGoals: addTag(current.outputGoals, outputGoalsDraft, 20, 80),
        }));
        setOutputGoalsDraft('');
        resetNoticeState();
    };

    const handleRemoveOutputGoal = (value: string) => {
        setPreferencesDraft((current) => ({
            ...current,
            outputGoals: current.outputGoals.filter((item) => item !== value),
        }));
        resetNoticeState();
    };

    const handlePromptFrequencyChange = (value: string) => {
        const frequency = asPromptFrequency(value);
        setPrivacyDraft((current) => {
            const nextSignals = ensureSignalsDraft(current.personalizationSignals, frequency);
            nextSignals.updatedAt = new Date().toISOString();
            nextSignals.settings = {
                ...(nextSignals.settings || {}),
                promptFrequency: frequency,
            };
            return {
                personalizationSignals: compactSignals(nextSignals),
            };
        });
        resetNoticeState();
    };

    const handleRemoveSignal = (entry: SignalEntry) => {
        setPrivacyDraft((current) => {
            const nextSignals = ensureSignalsDraft(current.personalizationSignals);
            const nextAnswers = { ...(nextSignals.answers || {}) };
            delete nextAnswers[entry.key];

            const nextHistory = (nextSignals.history || []).filter((item) => {
                return !(
                    item.questionId === entry.questionId &&
                    item.field === entry.field &&
                    item.value === entry.value &&
                    item.answeredAt === entry.answeredAt
                );
            });

            const remainingQuestionIds = new Set<string>();
            Object.values(nextAnswers).forEach((answer) => {
                if (answer.questionId) remainingQuestionIds.add(answer.questionId);
            });
            nextHistory.forEach((answer) => {
                if (answer.questionId) remainingQuestionIds.add(answer.questionId);
            });

            const nextSeenQuestionIds = (nextSignals.seenQuestionIds || []).filter((questionId) => remainingQuestionIds.has(questionId));
            const now = new Date().toISOString();

            return {
                personalizationSignals: compactSignals({
                    ...nextSignals,
                    updatedAt: now,
                    answers: nextAnswers,
                    history: nextHistory,
                    seenQuestionIds: nextSeenQuestionIds,
                    metrics: {
                        ...(nextSignals.metrics || {}),
                        answeredCount: Math.max(nextHistory.length, Object.keys(nextAnswers).length),
                        lastActionAt: now,
                    },
                }),
            };
        });
        resetNoticeState();
    };

    const handleResetSignalsDraft = () => {
        const nextSignals = promptFrequency === 'normal'
            ? null
            : {
                ...createSignalsDraft(promptFrequency),
                updatedAt: new Date().toISOString(),
            };

        setPrivacyDraft({
            personalizationSignals: nextSignals,
        });
        resetNoticeState();
    };

    const syncSavedSection = (tab: EditableTab, source: SnapshotUser) => {
        setServerUserUpdatedAt(source.updatedAt || null);
        setServerProfileUpdatedAt(source.profile?.updatedAt || null);

        if (tab === 'profile') {
            const nextDraft = buildProfileDraft(source);
            setProfileDraft(nextDraft);
            setSavedProfileDraft(nextDraft);
            return;
        }

        if (tab === 'preferences') {
            const nextDraft = buildPreferencesDraft(source);
            setPreferencesDraft(nextDraft);
            setSavedPreferencesDraft(nextDraft);
            return;
        }

        const nextDraft = buildPrivacyDraft(source);
        setPrivacyDraft(nextDraft);
        setSavedPrivacyDraft(nextDraft);
    };

    const saveSection = async (
        tab: EditableTab,
        overrideConflict?: { userUpdatedAt: string | null; profileUpdatedAt: string | null }
    ) => {
        setIsSavingTab(tab);
        setNotice(null);

        try {
            const timestamps = overrideConflict || {
                userUpdatedAt: serverUserUpdatedAt,
                profileUpdatedAt: serverProfileUpdatedAt,
            };

            let path = '/user/profile/basic';
            let payload: Record<string, unknown> = {};
            let successMessage = 'Profile details updated.';

            if (tab === 'profile') {
                payload = {
                    name: profileDraft.name,
                    avatarUrl: profileDraft.avatarUrl || null,
                    bio: profileDraft.bio,
                    location: profileDraft.location,
                    occupation: profileDraft.occupation,
                    website: profileDraft.website || null,
                    lifeGoals: profileDraft.lifeGoals,
                };
            } else if (tab === 'preferences') {
                path = '/user/profile/preferences';
                const completedAt = hasCompletedOnboardingRequirements({
                    primaryGoal: preferencesDraft.primaryGoal || null,
                    focusArea: preferencesDraft.focusArea || null,
                    starterPrompt: preferencesDraft.starterPrompt || null,
                    onboardingCompletedAt: preferencesDraft.onboardingCompletedAt,
                })
                    ? (preferencesDraft.onboardingCompletedAt || new Date().toISOString())
                    : null;
                payload = {
                    primaryGoal: preferencesDraft.primaryGoal || null,
                    focusArea: preferencesDraft.focusArea || null,
                    experienceLevel: preferencesDraft.experienceLevel || null,
                    writingPreference: preferencesDraft.writingPreference || null,
                    starterPrompt: preferencesDraft.starterPrompt || null,
                    outputGoals: preferencesDraft.outputGoals,
                    importPreference: preferencesDraft.importPreference || null,
                    onboardingCompletedAt: completedAt,
                };
                successMessage = 'Preferences updated.';
            } else {
                path = '/user/profile/privacy';
                payload = {
                    personalizationSignals: compactSignals(
                        privacyDraft.personalizationSignals
                            ? {
                                ...ensureSignalsDraft(privacyDraft.personalizationSignals),
                                version: 1,
                                updatedAt: new Date().toISOString(),
                            }
                            : null
                    ),
                };
                successMessage = 'Privacy and personalization settings updated.';
            }

            const response = await apiFetch(path, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...payload,
                    expectedUserUpdatedAt: timestamps.userUpdatedAt,
                    expectedProfileUpdatedAt: timestamps.profileUpdatedAt,
                }),
            });

            const data = await response.json().catch(() => null);

            if (response.status === 409 && data?.user) {
                setConflict({
                    tab,
                    latestUser: data.user as SnapshotUser,
                    userUpdatedAt: data?.conflict?.userUpdatedAt || null,
                    profileUpdatedAt: data?.conflict?.profileUpdatedAt || null,
                });
                setNotice({
                    type: 'error',
                    text: data?.message || 'This section changed elsewhere. Reload the latest version or explicitly overwrite it.',
                });
                return;
            }

            if (!response.ok) {
                throw new Error(data?.message || 'Failed to save profile settings.');
            }

            if (data?.user) {
                syncSavedSection(tab, data.user as SnapshotUser);
            }

            setConflict(null);
            setNotice({ type: 'success', text: successMessage });
            await refreshUser();
        } catch (error: any) {
            setNotice({
                type: 'error',
                text: error?.message || 'Failed to save profile settings.',
            });
        } finally {
            setIsSavingTab(null);
        }
    };

    const handleDiscardActiveChanges = () => {
        if (activeTab === 'profile') {
            setProfileDraft(savedProfileDraft);
        } else if (activeTab === 'preferences') {
            setPreferencesDraft(savedPreferencesDraft);
        } else if (activeTab === 'privacy') {
            setPrivacyDraft(savedPrivacyDraft);
        }

        setNotice(null);
        setConflict(null);
    };

    const handleReloadLatest = () => {
        if (!activeConflict) return;
        hydrateDraftsFromSnapshot(activeConflict.latestUser);
        setNotice({
            type: 'success',
            text: 'Latest profile data loaded. Review your changes and save again if needed.',
        });
    };

    const handleOverwriteAndSave = async () => {
        if (!activeConflict) return;
        await saveSection(activeConflict.tab, {
            userUpdatedAt: activeConflict.userUpdatedAt,
            profileUpdatedAt: activeConflict.profileUpdatedAt,
        });
    };

    const handleUnlockSecurity = async (payload: { currentPassword?: string; googleCredential?: string }) => {
        setIsUnlockingSecurity(true);
        setNotice(null);

        try {
            const response = await apiFetch('/user/security/re-auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            const data = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(data?.message || 'Failed to unlock sensitive account changes.');
            }

            setSensitiveActionToken(data?.sensitiveActionToken || '');
            setSensitiveSessionExpiresAt(data?.expiresAt || null);
            setReauthPassword('');
            setNotice({
                type: 'success',
                text: 'Sensitive account changes unlocked for a short time.',
            });
        } catch (error: any) {
            setNotice({
                type: 'error',
                text: error?.message || 'Failed to unlock sensitive account changes.',
            });
        } finally {
            setIsUnlockingSecurity(false);
        }
    };

    const handleUnlockSecurityWithPassword = async () => {
        if (!reauthPassword) {
            setNotice({ type: 'error', text: 'Enter your current password to unlock security changes.' });
            return;
        }

        await handleUnlockSecurity({ currentPassword: reauthPassword });
    };

    const handleUnlockSecurityWithGoogle = async (credentialResponse: { credential?: string }) => {
        if (!credentialResponse.credential) {
            setNotice({ type: 'error', text: 'Google re-verification failed. Please try again.' });
            return;
        }

        await handleUnlockSecurity({ googleCredential: credentialResponse.credential });
    };

    const handleUnlockSecurityWithGoogleError = () => {
        setNotice({ type: 'error', text: 'Google re-verification failed. Please try again.' });
    };

    const handleUpdateSignInEmail = async () => {
        const normalizedCurrentEmail = (savedProfileDraft.email || user?.email || '').trim().toLowerCase();
        const normalizedNextEmail = signInEmailDraft.trim().toLowerCase();
        const normalizedConfirmEmail = confirmSignInEmailDraft.trim().toLowerCase();

        if (!hasUnlockedSensitiveActions) {
            setNotice({ type: 'error', text: 'Unlock security changes before updating your sign-in email.' });
            return;
        }

        if (!normalizedNextEmail || !normalizedConfirmEmail) {
            setNotice({ type: 'error', text: 'Enter and confirm your new sign-in email.' });
            return;
        }

        if (normalizedNextEmail === normalizedCurrentEmail) {
            setNotice({ type: 'error', text: 'Enter a different sign-in email to make a change.' });
            return;
        }

        if (normalizedNextEmail !== normalizedConfirmEmail) {
            setNotice({ type: 'error', text: 'New sign-in email and confirmation do not match.' });
            return;
        }

        setIsUpdatingEmail(true);
        setNotice(null);

        try {
            const response = await apiFetch('/user/email', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    newEmail: normalizedNextEmail,
                    confirmEmail: normalizedConfirmEmail,
                    sensitiveActionToken,
                }),
            });
            const data = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(data?.message || 'Failed to update sign-in email.');
            }

            if (data?.user) {
                hydrateDraftsFromSnapshot(data.user as SnapshotUser);
            }
            clearSensitiveSession();
            await refreshUser();
            setNotice({
                type: 'success',
                text: 'Sign-in email updated. The current session was kept when possible and the other sessions were cleared.',
            });
        } catch (error: any) {
            setNotice({
                type: 'error',
                text: error?.message || 'Failed to update sign-in email.',
            });
        } finally {
            setIsUpdatingEmail(false);
        }
    };

    const handleChangePassword = async () => {
        if (!hasUnlockedSensitiveActions) {
            setNotice({ type: 'error', text: 'Unlock security changes before updating your password.' });
            return;
        }

        if (newPassword !== confirmPassword) {
            setNotice({ type: 'error', text: 'New password and confirmation do not match.' });
            return;
        }

        if (newPassword.length < PASSWORD_MIN_LENGTH || !PASSWORD_COMPLEXITY_REGEX.test(newPassword)) {
            setNotice({
                type: 'error',
                text: 'Password must be at least 8 characters and include uppercase, lowercase, and a number.',
            });
            return;
        }

        setIsChangingPassword(true);
        setNotice(null);

        try {
            const response = await apiFetch('/user/password', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ newPassword, sensitiveActionToken }),
            });
            const data = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(data?.message || 'Failed to change password.');
            }

            setNewPassword('');
            setConfirmPassword('');
            clearSensitiveSession();
            await refreshUser();
            setNotice({
                type: 'success',
                text: 'Password updated. Other saved sessions were revoked, and this device may ask you to sign in again when the current session expires.',
            });
        } catch (error: any) {
            setNotice({
                type: 'error',
                text: error?.message || 'Failed to change password.',
            });
        } finally {
            setIsChangingPassword(false);
        }
    };

    const handleDeleteAccount = async () => {
        const normalizedConfirmText = deleteConfirmText.trim().toLowerCase();
        const normalizedCurrentEmail = (savedProfileDraft.email || user?.email || '').trim().toLowerCase();

        if (!hasUnlockedSensitiveActions) {
            setNotice({ type: 'error', text: 'Unlock security changes before deleting your account.' });
            return;
        }

        if (!normalizedCurrentEmail || normalizedConfirmText !== normalizedCurrentEmail) {
            setNotice({ type: 'error', text: 'Type your sign-in email exactly to confirm permanent deletion.' });
            return;
        }

        setIsDeletingAccount(true);
        setNotice(null);

        try {
            const response = await apiFetch('/user/account', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sensitiveActionToken,
                    confirmText: deleteConfirmText,
                }),
            });
            const data = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(data?.message || 'Failed to delete account.');
            }

            await logout();
            router.replace('/register');
        } catch (error: any) {
            setNotice({
                type: 'error',
                text: error?.message || 'Failed to delete account.',
            });
        } finally {
            setIsDeletingAccount(false);
        }
    };

    const handleExportData = async () => {
        setIsExporting(true);
        setNotice(null);

        try {
            const response = await apiFetch('/user/export');
            if (!response.ok) {
                throw new Error('Export failed.');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `notive-data-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(link);
            setNotice({ type: 'success', text: 'Data export downloaded.' });
        } catch (error: any) {
            setNotice({
                type: 'error',
                text: error?.message || 'Failed to export data.',
            });
        } finally {
            setIsExporting(false);
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    if (!hydratedUserId) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="min-h-screen p-6 md:p-12 pb-32 relative z-10">
            <FadeIn className="max-w-5xl mx-auto space-y-8 mt-4">
                <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
                    <div className="flex items-start gap-4">
                        <Link
                            href="/profile"
                            className="mt-1 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-ink-secondary hover:text-white hover:bg-white/10 transition-all"
                        >
                            <FiArrowLeft size={18} aria-hidden="true" />
                        </Link>
                        <div className="space-y-2">
                            <p className="text-xs uppercase tracking-[0.2em] text-ink-muted font-bold">Profile Management</p>
                            <h1 className="text-4xl font-serif text-white tracking-tight">Account settings that match how people actually edit</h1>
                            <p className="max-w-3xl text-sm md:text-base text-ink-secondary">
                                Update basic identity details, product preferences, account security, and adaptive data separately so each change is easier to review and safer to save.
                            </p>
                        </div>
                    </div>
                    <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-ink-secondary">
                        <div className="flex items-center gap-2 text-white font-semibold">
                            <FiClock size={16} aria-hidden="true" />
                            Last synced
                        </div>
                        <p className="mt-1">{toDateLabel(lastSavedAt, 'Waiting for first profile sync')}</p>
                    </div>
                </header>

                {notice && <NoticeBanner notice={notice} />}

                <SlideUp className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-2">
                    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Profile settings sections">
                        {TAB_ITEMS.map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={isActive}
                                    onClick={() => handleTabChange(tab.id)}
                                    className={`flex items-center gap-2 rounded-[1.2rem] px-4 py-3 text-sm font-semibold transition-all ${
                                        isActive
                                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                            : 'text-ink-secondary hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    <tab.Icon size={15} aria-hidden="true" />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </SlideUp>

                {activeTab === 'profile' && (
                    <SlideUp>
                        <ProfileSection
                            draft={profileDraft}
                            lifeGoalsDraft={lifeGoalsDraft}
                            onChange={(updater) => {
                                setProfileDraft((current) => updater(current));
                                resetNoticeState();
                            }}
                            onLifeGoalsDraftChange={setLifeGoalsDraft}
                            onAddLifeGoal={handleAddLifeGoal}
                            onRemoveLifeGoal={handleRemoveLifeGoal}
                        />
                    </SlideUp>
                )}

                {activeTab === 'preferences' && (
                    <SlideUp>
                        <PreferencesSection
                            draft={preferencesDraft}
                            outputGoalsDraft={outputGoalsDraft}
                            checklistItems={checklistItems}
                            profileContext={profileContext}
                            onChange={(updater) => {
                                setPreferencesDraft((current) => updater(current));
                                resetNoticeState();
                            }}
                            onOutputGoalsDraftChange={setOutputGoalsDraft}
                            onAddOutputGoal={handleAddOutputGoal}
                            onRemoveOutputGoal={handleRemoveOutputGoal}
                        />
                    </SlideUp>
                )}

                {activeTab === 'security' && (
                    <SlideUp>
                        <SecuritySection
                            currentEmail={savedProfileDraft.email || user?.email || ''}
                            hasPassword={hasPassword}
                            isGoogleEnabled={isGoogleEnabled}
                            reauthPassword={reauthPassword}
                            signInEmail={signInEmailDraft}
                            confirmSignInEmail={confirmSignInEmailDraft}
                            newPassword={newPassword}
                            confirmPassword={confirmPassword}
                            deleteConfirmText={deleteConfirmText}
                            isSensitiveUnlocked={hasUnlockedSensitiveActions}
                            sensitiveSessionExpiresAt={sensitiveSessionExpiresAt}
                            isUnlockingSecurity={isUnlockingSecurity}
                            isUpdatingEmail={isUpdatingEmail}
                            isChangingPassword={isChangingPassword}
                            isDeletingAccount={isDeletingAccount}
                            onReauthPasswordChange={setReauthPassword}
                            onSignInEmailChange={setSignInEmailDraft}
                            onConfirmSignInEmailChange={setConfirmSignInEmailDraft}
                            onNewPasswordChange={setNewPassword}
                            onConfirmPasswordChange={setConfirmPassword}
                            onDeleteConfirmTextChange={setDeleteConfirmText}
                            onUnlockWithPassword={handleUnlockSecurityWithPassword}
                            onUnlockWithGoogle={handleUnlockSecurityWithGoogle}
                            onUnlockWithGoogleError={handleUnlockSecurityWithGoogleError}
                            onUpdateEmail={handleUpdateSignInEmail}
                            onChangePassword={handleChangePassword}
                            onDeleteAccount={handleDeleteAccount}
                        />
                    </SlideUp>
                )}

                {activeTab === 'privacy' && (
                    <SlideUp>
                        <PrivacySection
                            promptFrequency={promptFrequency}
                            signalEntries={signalEntries}
                            promptedCount={promptedCount}
                            answeredCount={answeredCount}
                            dismissedCount={dismissedCount}
                            lastSignalAction={lastSignalAction}
                            isExporting={isExporting}
                            onPromptFrequencyChange={handlePromptFrequencyChange}
                            onResetSignals={handleResetSignalsDraft}
                            onRemoveSignal={handleRemoveSignal}
                            onExportData={handleExportData}
                        />
                    </SlideUp>
                )}
            </FadeIn>

            {activeEditableTab && (activeDirty || activeConflict) && (
                <div className="fixed inset-x-0 bottom-4 z-40 px-4">
                    <div className="mx-auto max-w-5xl rounded-[1.6rem] border border-white/10 bg-[#0e1324]/95 px-5 py-4 shadow-2xl backdrop-blur-xl">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-semibold text-white">
                                    {activeConflict
                                        ? 'This section changed in another session.'
                                        : `Unsaved changes in ${TAB_ITEMS.find((tab) => tab.id === activeEditableTab)?.label}.`}
                                </p>
                                <p className="text-sm text-ink-secondary">
                                    {activeConflict
                                        ? 'Reload the latest data or explicitly overwrite the current server version for this section.'
                                        : `Last synced ${toDateLabel(lastSavedAt, 'never')}. Save or discard before leaving this page.`}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                {activeConflict ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={handleReloadLatest}
                                            className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-ink-secondary hover:text-white hover:border-white/30 transition-colors"
                                        >
                                            Reload Latest
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleOverwriteAndSave}
                                            disabled={isSavingTab === activeEditableTab}
                                            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                                        >
                                            {isSavingTab === activeEditableTab && (
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                            )}
                                            <span>Overwrite Section</span>
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={handleDiscardActiveChanges}
                                            className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-ink-secondary hover:text-white hover:border-white/30 transition-colors"
                                        >
                                            Discard
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => saveSection(activeEditableTab)}
                                            disabled={isSavingTab === activeEditableTab}
                                            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                                        >
                                            {isSavingTab === activeEditableTab && (
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                            )}
                                            <span>Save Section</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
