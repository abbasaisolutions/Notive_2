'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { NOTIVE_VOICE } from '@/content/notive-voice';
import useApi from '@/hooks/use-api';
import SocialSelectionModal from './SocialSelectionModal';
import { ConfirmDialog } from '@/components/ui';
import { useToast } from '@/context/toast-context';

type ImportStatus = {
    instagram: number;
    facebook: number;
    notive: number;
    total: number;
};

type ProviderKey = 'instagram' | 'facebook';

type ConnectionSummary = {
    provider?: ProviderKey;
    connected: boolean;
    connectedAt?: string | null;
    updatedAt?: string | null;
    expiresAt?: string | null;
    isExpired?: boolean;
    accountId?: string | null;
};

type ImportResult = {
    success: boolean;
    source?: string;
    imported?: number;
    skipped?: number;
    message?: string;
};

interface SocialImportPanelProps {
    returnToPath?: string;
    compact?: boolean;
}

const IMPORT_QUERY_KEYS = ['import', 'source', 'provider', 'imported', 'skipped', 'message'];

const asProviderKey = (value: string | null | undefined): ProviderKey | null =>
    value === 'instagram' || value === 'facebook' ? value : null;

const resolveProviderAuthUrl = (provider: ProviderKey, data: any): string | null => {
    if (typeof data?.url === 'string' && data.url) return data.url;
    const nested = data?.urls?.[provider];
    return typeof nested === 'string' && nested ? nested : null;
};

const resolveProviderAuthError = (provider: ProviderKey, data: any): string | null => {
    if (typeof data?.message === 'string' && data.message.trim()) return data.message;
    const readinessMessage = data?.readiness?.[provider]?.message;
    if (typeof readinessMessage === 'string' && readinessMessage.trim()) return readinessMessage;
    return null;
};

const normalizeConnectionSummary = (value: unknown, provider: ProviderKey): ConnectionSummary => {
    if (typeof value === 'boolean') {
        return { provider, connected: value };
    }
    if (value && typeof value === 'object') {
        const connection = value as Partial<ConnectionSummary>;
        return {
            provider,
            connected: Boolean(connection.connected),
            connectedAt: connection.connectedAt || null,
            updatedAt: connection.updatedAt || null,
            expiresAt: connection.expiresAt || null,
            isExpired: Boolean(connection.isExpired),
            accountId: connection.accountId || null,
        };
    }
    return { provider, connected: false };
};

const formatDate = (value: string | null | undefined): string | null => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export function SocialImportPanel({ returnToPath, compact = false }: SocialImportPanelProps) {
    const { apiFetch } = useApi();
    const toast = useToast();
    const [status, setStatus] = useState<ImportStatus | null>(null);
    const [connections, setConnections] = useState<Record<ProviderKey, ConnectionSummary>>({
        instagram: { provider: 'instagram', connected: false },
        facebook: { provider: 'facebook', connected: false },
    });
    const [isLoading, setIsLoading] = useState(true);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [isArchiveImporting, setIsArchiveImporting] = useState(false);
    const [archiveError, setArchiveError] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState<ProviderKey | null>(null);
    const [isDisconnecting, setIsDisconnecting] = useState<ProviderKey | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalProvider, setModalProvider] = useState<ProviderKey>('instagram');
    const [providerSetupIssues, setProviderSetupIssues] = useState<Partial<Record<ProviderKey, string>>>({});
    const [showAdvancedImportTools, setShowAdvancedImportTools] = useState(false);
    const [switchConfirmProvider, setSwitchConfirmProvider] = useState<ProviderKey | null>(null);

    const clearImportQueryParams = useCallback(() => {
        const url = new URL(window.location.href);
        IMPORT_QUERY_KEYS.forEach((key) => url.searchParams.delete(key));
        const query = url.searchParams.toString();
        window.history.replaceState({}, '', `${url.pathname}${query ? `?${query}` : ''}`);
    }, []);

    const fetchStatus = useCallback(async () => {
        try {
            const response = await apiFetch('/import/status');
            if (!response.ok) return;

            const data = await response.json();
            setStatus(data.entryCount || null);
            const incoming = data.connections || {};
            setConnections({
                instagram: normalizeConnectionSummary(incoming.instagram, 'instagram'),
                facebook: normalizeConnectionSummary(incoming.facebook, 'facebook'),
            });
        } catch (error) {
            console.error('Failed to fetch import status:', error);
        } finally {
            setIsLoading(false);
        }
    }, [apiFetch]);

    const fetchProviderReadiness = useCallback(async () => {
        try {
            const fallbackReturnTo = `${window.location.pathname}${window.location.search}`;
            const redirectPath = returnToPath || fallbackReturnTo;
            const clientOrigin = window.location.origin;
            const response = await apiFetch(`/import/auth-urls?returnTo=${encodeURIComponent(redirectPath)}&clientOrigin=${encodeURIComponent(clientOrigin)}`);
            const data = await response.json().catch(() => null);
            const nextIssues: Partial<Record<ProviderKey, string>> = {};

            const applyReadiness = (provider: ProviderKey) => {
                const ready = data?.readiness?.[provider]?.ready;
                const message = data?.readiness?.[provider]?.message;
                if (ready === false && typeof message === 'string' && message.trim()) {
                    nextIssues[provider] = message;
                }
            };

            applyReadiness('instagram');
            applyReadiness('facebook');

            if (!response.ok && Object.keys(nextIssues).length === 0) {
                const message = typeof data?.message === 'string' ? data.message : 'Social connection is currently unavailable.';
                nextIssues.instagram = message;
                nextIssues.facebook = message;
            }

            setProviderSetupIssues(nextIssues);
        } catch {
            setProviderSetupIssues({
                instagram: 'Could not validate connection setup.',
                facebook: 'Could not validate connection setup.',
            });
        }
    }, [apiFetch, returnToPath]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const importStatus = params.get('import');
        const connectedProvider = asProviderKey(params.get('provider'));

        if (importStatus === 'success') {
            setImportResult({
                success: true,
                source: params.get('source') || undefined,
                imported: parseInt(params.get('imported') || '0', 10),
                skipped: parseInt(params.get('skipped') || '0', 10),
            });
            clearImportQueryParams();
        } else if (importStatus === 'connected') {
            setImportResult({
                success: true,
                source: connectedProvider || undefined,
                message: `${connectedProvider || 'Provider'} connected. Select memories to import.`,
            });
            if (connectedProvider) {
                setModalProvider(connectedProvider);
                setModalOpen(true);
            }
            clearImportQueryParams();
            fetchStatus();
        } else if (importStatus === 'error') {
            setImportResult({
                success: false,
                message: params.get('message') || 'Import failed',
            });
            clearImportQueryParams();
        }
    }, [clearImportQueryParams, fetchStatus]);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    useEffect(() => {
        fetchProviderReadiness();
    }, [fetchProviderReadiness]);

    const startConnect = useCallback(async (
        platform: ProviderKey,
        options?: { forceReauth?: boolean }
    ) => {
        try {
            setIsConnecting(platform);
            const fallbackReturnTo = `${window.location.pathname}${window.location.search}`;
            const redirectPath = returnToPath || fallbackReturnTo;
            const clientOrigin = window.location.origin;
            const query = new URLSearchParams({
                provider: platform,
                returnTo: redirectPath,
                clientOrigin,
            });
            if (options?.forceReauth) {
                query.set('forceReauth', '1');
            }
            const response = await apiFetch(`/import/auth-urls?${query.toString()}`);
            const data = await response.json().catch(() => null);
            if (!response.ok || data?.ready === false) {
                throw new Error(resolveProviderAuthError(platform, data) || `Couldn\u2019t connect to ${platform}.`);
            }
            const url = resolveProviderAuthUrl(platform, data);
            if (!url) {
                throw new Error(resolveProviderAuthError(platform, data) || 'Missing auth URL');
            }
            setProviderSetupIssues((previous) => {
                if (!previous[platform]) return previous;
                const next = { ...previous };
                delete next[platform];
                return next;
            });
            setImportResult({
                success: true,
                source: platform,
                message: `Redirecting to ${platform} authorization...`,
            });
            window.location.assign(url);
        } catch (error: any) {
            const message = error?.message || 'Couldn\u2019t connect this account.';
            setProviderSetupIssues((previous) => ({
                ...previous,
                [platform]: message,
            }));
            setImportResult({
                success: false,
                message,
            });
        } finally {
            setIsConnecting(null);
        }
    }, [apiFetch, returnToPath]);

    const disconnectProvider = useCallback(async (
        provider: ProviderKey,
        options?: { suppressNotice?: boolean }
    ): Promise<boolean> => {
        setIsDisconnecting(provider);
        if (!options?.suppressNotice) {
            setImportResult(null);
        }
        try {
            const response = await apiFetch(`/import/connections/${provider}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.message || `Couldn\u2019t disconnect ${provider}.`);
            }
            await fetchStatus();
            if (!options?.suppressNotice) {
                setImportResult({
                    success: true,
                    source: provider,
                    message: `${provider} disconnected.`,
                });
            }
            return true;
        } catch (error: any) {
            if (!options?.suppressNotice) {
                setImportResult({
                    success: false,
                    message: error?.message || `Couldn\u2019t disconnect ${provider}.`,
                });
            }
            return false;
        } finally {
            setIsDisconnecting(null);
        }
    }, [apiFetch, fetchStatus]);

    const switchProviderAccount = useCallback(async (provider: ProviderKey) => {
        const current = connections[provider];
        if (current?.connected) {
            setSwitchConfirmProvider(provider);
            return;
        }
        await startConnect(provider, { forceReauth: true });
    }, [connections, startConnect]);

    const confirmSwitchProvider = useCallback(async () => {
        const provider = switchConfirmProvider;
        if (!provider) return;
        setSwitchConfirmProvider(null);
        const disconnected = await disconnectProvider(provider, { suppressNotice: true });
        if (!disconnected) {
            setImportResult({
                success: false,
                source: provider,
                message: `Could not fully disconnect ${provider}. Trying reconnection now...`,
            });
        }
        await startConnect(provider, { forceReauth: true });
    }, [switchConfirmProvider, disconnectProvider, startConnect]);

    const handleArchiveImport = async (provider: ProviderKey, file: File) => {
        setArchiveError(null);
        setIsArchiveImporting(true);
        try {
            const formData = new FormData();
            formData.append('provider', provider);
            formData.append('file', file);

            const response = await apiFetch('/import/archive', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.message || 'Archive import failed');
            }

            const result = await response.json();
            setImportResult({
                success: true,
                source: provider,
                imported: result.imported,
                skipped: result.skipped,
                message: `Archive import complete (${result.imported} imported)`,
            });
            fetchStatus();
        } catch (error: any) {
            setArchiveError(error?.message || 'Archive import failed');
            setImportResult({
                success: false,
                message: error?.message || 'Archive import failed',
            });
        } finally {
            setIsArchiveImporting(false);
        }
    };

    const onArchiveFileChange = (provider: ProviderKey) => (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        handleArchiveImport(provider, file);
        event.target.value = '';
    };

    const openSelectionModal = (provider: ProviderKey) => {
        setModalProvider(provider);
        setModalOpen(true);
    };

    const handleImportComplete = (result: { imported: number; skipped: number }) => {
        setImportResult({
            success: true,
            source: modalProvider,
            imported: result.imported,
            skipped: result.skipped,
            message: `Import complete (${result.imported} imported)`,
        });
        fetchStatus();
    };

    const connectedCount = useMemo(
        () => ['instagram', 'facebook'].filter((provider) => connections[provider as ProviderKey]?.connected).length,
        [connections]
    );
    const hasAnyConnected = connectedCount > 0;
    const workflowSummary = useMemo(() => {
        if (hasAnyConnected) {
            return `${connectedCount}/2 connected and ${status?.total || 0} notes currently available in your timeline.`;
        }
        return 'Start by connecting Instagram or Facebook so outside memories can move into Notive.';
    }, [connectedCount, hasAnyConnected, status?.total]);
    const advancedImportToolsLabel = showAdvancedImportTools ? 'Hide import tools' : 'More import tools';
    const timelineHref = useMemo(() => {
        const source = importResult?.source?.toLowerCase();
        if (source === 'instagram' || source === 'facebook') {
            return `/timeline?source=${source}`;
        }
        return '/timeline';
    }, [importResult?.source]);
    const panelClassName = compact ? 'workspace-panel rounded-3xl p-6' : 'workspace-panel p-8';

    const renderProviderCard = (provider: ProviderKey) => {
        const connection = connections[provider];
        const isConnected = connection.connected;
        const isExpired = Boolean(connection.isExpired);
        const isReadyForImport = isConnected && !isExpired;
        const setupIssue = providerSetupIssues[provider] || null;
        const hasBlockingSetupIssue = Boolean(setupIssue) && !isConnected;
        const label = provider === 'instagram' ? 'Instagram' : 'Facebook';
        const gradient = 'from-primary/10 to-secondary/10';

        return (
            <div key={provider} className={`workspace-soft-panel rounded-2xl bg-gradient-to-br p-4 ${gradient}`}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="workspace-heading font-semibold">{label}</p>
                    <span
                        className={`workspace-pill-muted rounded-full px-2.5 py-1 text-xs uppercase tracking-[0.08em] ${
                            isReadyForImport || isExpired ? 'text-[rgb(var(--text-primary))]' : 'text-ink-secondary'
                        }`}
                    >
                        {isReadyForImport ? 'Connected' : isExpired ? 'Expired' : 'Not connected'}
                    </span>
                </div>
                <div className="space-y-1 text-xs text-ink-secondary">
                    <p className="break-all">Account: {connection.accountId || 'Unknown'}</p>
                    <p>Updated: {formatDate(connection.updatedAt) || 'Never'}</p>
                    {isExpired ? (
                        <p className="text-ink-secondary">Connection expired. Reconnect required.</p>
                    ) : (
                        <p>Expires: {formatDate(connection.expiresAt) || 'Not provided'}</p>
                    )}
                    {hasBlockingSetupIssue && (
                        <p className="text-ink-secondary">{setupIssue}</p>
                    )}
                </div>
                <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2">
                    <button
                        onClick={() => (isReadyForImport ? openSelectionModal(provider) : startConnect(provider))}
                        disabled={isConnecting !== null || isDisconnecting !== null || isLoading}
                        className="rounded-xl border border-primary/30 bg-primary/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-primary disabled:opacity-50"
                    >
                        {hasBlockingSetupIssue
                            ? 'Retry Connect'
                            : isReadyForImport
                                ? 'Import'
                                : (isConnecting === provider ? 'Connecting...' : (isExpired ? 'Reconnect' : 'Connect'))}
                    </button>
                    {isConnected && (
                        <button
                            onClick={() => switchProviderAccount(provider)}
                            disabled={isConnecting !== null || isDisconnecting !== null}
                            className="workspace-button-outline rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] disabled:opacity-50"
                        >
                            {isConnecting === provider ? 'Switching...' : 'Switch'}
                        </button>
                    )}
                    {isConnected && (
                        <button
                            onClick={() => disconnectProvider(provider)}
                            disabled={isDisconnecting !== null || isConnecting !== null}
                            className="workspace-button-outline col-[1/-1] rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] disabled:opacity-50"
                        >
                            {isDisconnecting === provider ? 'Disconnecting...' : 'Disconnect'}
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <>
            <div className={panelClassName}>
                <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Import Workflow</p>
                        <h3 className="workspace-heading text-xl font-semibold">Connect a source</h3>
                        <p className="text-sm text-ink-secondary">Connect an account, choose memories, and bring them into your timeline.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowAdvancedImportTools((current) => !current)}
                            className="workspace-button-outline rounded-lg px-3 py-2 text-xs"
                            aria-expanded={showAdvancedImportTools}
                            aria-controls="import-advanced-tools"
                        >
                            {advancedImportToolsLabel}
                        </button>
                        <button
                            onClick={() => {
                                fetchStatus();
                                fetchProviderReadiness();
                            }}
                            className="workspace-button-outline rounded-lg px-3 py-2 text-xs"
                        >
                            Refresh
                        </button>
                    </div>
                </div>

                {importResult && (
                    <div className="workspace-soft-panel mb-5 rounded-xl px-4 py-3 text-sm text-[rgb(var(--text-primary))]">
                        <p className="workspace-heading font-semibold">{importResult.success ? 'Success' : 'Action needed'}</p>
                        <p className="mt-1 text-xs opacity-90">{importResult.message}</p>
                        {(importResult.imported ?? 0) > 0 && (
                            <p className="mt-1 text-xs opacity-90">
                                Imported {importResult.imported} | Skipped {importResult.skipped || 0}
                            </p>
                        )}
                    </div>
                )}

                <section className="workspace-soft-panel mb-5 rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Current snapshot</p>
                    <p className="mt-2 text-sm leading-7 text-[rgb(var(--text-primary))]">{workflowSummary}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs text-primary">
                            {connectedCount}/2 connected
                        </span>
                        <span className="workspace-pill-muted rounded-full px-3 py-1 text-xs text-[rgb(var(--text-primary))]">
                            {status?.total || 0} total notes
                        </span>
                        {hasAnyConnected && (
                            <Link href={timelineHref} className="workspace-button-outline rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em]">
                                Open {NOTIVE_VOICE.surfaces.memoryAtlas}
                            </Link>
                        )}
                    </div>
                </section>

                <section className="space-y-5">
                    <div>
                        <p className="mb-2 text-xs uppercase tracking-[0.12em] text-ink-muted">Step 1: Connect or switch account</p>
                        <p className="mb-3 text-xs text-ink-secondary">
                            Instagram requires a Professional (Business/Creator) account linked to a Facebook Page.
                        </p>
                        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
                            {renderProviderCard('instagram')}
                            {renderProviderCard('facebook')}
                        </div>
                    </div>

                    {showAdvancedImportTools && (
                        <div id="import-advanced-tools" className="space-y-5">
                            {status && (
                                <section>
                                    <p className="mb-2 text-xs uppercase tracking-[0.12em] text-ink-muted">Current totals</p>
                                    <div className="grid grid-cols-[repeat(auto-fit,minmax(105px,1fr))] gap-2">
                                        <div className="workspace-soft-panel rounded-xl px-3 py-2">
                                            <p className="text-xs text-ink-muted uppercase tracking-[0.06em]">Notive</p>
                                            <p className="workspace-heading text-lg font-semibold">{status.notive}</p>
                                        </div>
                                        <div className="workspace-soft-panel rounded-xl px-3 py-2">
                                            <p className="text-xs text-ink-muted uppercase tracking-[0.06em]">Instagram</p>
                                            <p className="workspace-heading text-lg font-semibold">{status.instagram}</p>
                                        </div>
                                        <div className="workspace-soft-panel rounded-xl px-3 py-2">
                                            <p className="text-xs text-ink-muted uppercase tracking-[0.06em]">Facebook</p>
                                            <p className="workspace-heading text-lg font-semibold">{status.facebook}</p>
                                        </div>
                                        <div className="workspace-soft-panel rounded-xl px-3 py-2">
                                            <p className="text-xs text-ink-muted uppercase tracking-[0.06em]">Total</p>
                                            <p className="workspace-heading text-lg font-semibold">{status.total}</p>
                                        </div>
                                    </div>
                                </section>
                            )}

                            <div className="workspace-soft-panel rounded-2xl p-4">
                                <p className="mb-2 text-xs uppercase tracking-[0.12em] text-ink-muted">How importing works</p>
                                <p className="text-xs leading-relaxed text-ink-secondary">
                                    Imported posts map to entry fields as follows:
                                    <span className="workspace-heading"> title</span> from caption or message,
                                    <span className="workspace-heading"> content</span> from post text,
                                    <span className="workspace-heading"> createdAt</span> from the post timestamp,
                                    <span className="workspace-heading"> coverImage</span> from media, and
                                    <span className="workspace-heading"> source/externalId</span> for duplicate prevention.
                                </p>
                            </div>

                            <div className="workspace-soft-panel rounded-2xl p-4">
                                <p className="mb-2 text-xs uppercase tracking-[0.12em] text-ink-muted">Review in {NOTIVE_VOICE.surfaces.memoryAtlas}</p>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs text-ink-secondary">
                                        After import, open {NOTIVE_VOICE.surfaces.memoryAtlas.toLowerCase()} and filter or search imported memories.
                                    </span>
                                    <Link href={timelineHref} className="rounded-lg border border-primary/30 bg-primary/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-primary">
                                        Open {NOTIVE_VOICE.surfaces.memoryAtlas}
                                    </Link>
                                </div>
                            </div>

                            <div className="workspace-soft-panel rounded-2xl p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Archive files</p>
                                        <p className="mt-1 text-sm text-ink-secondary">Upload a ZIP or JSON export only if direct connection is not the easiest route.</p>
                                    </div>
                                    <span className="workspace-pill-muted rounded-full px-3 py-1 text-xs text-[rgb(var(--text-primary))]">Optional path</span>
                                </div>
                                <div className="mt-4">
                                    {archiveError && <p className="mb-2 text-xs text-ink-secondary">{archiveError}</p>}
                                    <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-2">
                                        <label className="workspace-button-outline cursor-pointer rounded-xl px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.08em]">
                                            {isArchiveImporting ? 'Importing...' : 'Instagram ZIP/JSON'}
                                            <input
                                                type="file"
                                                accept=".zip,.json,application/zip,application/json"
                                                onChange={onArchiveFileChange('instagram')}
                                                disabled={isArchiveImporting}
                                                className="hidden"
                                            />
                                        </label>
                                        <label className="workspace-button-outline cursor-pointer rounded-xl px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.08em]">
                                            {isArchiveImporting ? 'Importing...' : 'Facebook ZIP/JSON'}
                                            <input
                                                type="file"
                                                accept=".zip,.json,application/zip,application/json"
                                                onChange={onArchiveFileChange('facebook')}
                                                disabled={isArchiveImporting}
                                                className="hidden"
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                <div className="workspace-muted-panel mt-4 rounded-xl px-3 py-2 text-xs text-ink-secondary">
                    Connected providers: <span className="workspace-heading font-semibold">{connectedCount}/2</span>
                    {!hasAnyConnected && <span className="ml-2 text-ink-secondary">Connect at least one account to import.</span>}
                </div>
            </div>

            <SocialSelectionModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                provider={modalProvider}
                onImportComplete={handleImportComplete}
            />

            <ConfirmDialog
                open={!!switchConfirmProvider}
                title={`Switch ${switchConfirmProvider || ''} account?`}
                description="This will disconnect the current account first."
                actionLabel="Switch"
                onConfirm={confirmSwitchProvider}
                onCancel={() => setSwitchConfirmProvider(null)}
            />
        </>
    );
}

export default SocialImportPanel;

