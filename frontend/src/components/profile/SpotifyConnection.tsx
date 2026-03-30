'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/auth-context';
import { resolveApiUrl } from '@/constants/config';
import {
    FiAlertCircle,
    FiCheckCircle,
    FiLink,
    FiMusic,
    FiRefreshCw,
    FiShield,
    FiSlash,
} from 'react-icons/fi';

interface SpotifyStatus {
    connected: boolean;
    displayName?: string;
    connectedAt?: string;
    lastSyncAt?: string;
    available?: boolean;
    message?: string;
}

export default function SpotifyConnection() {
    const { accessToken } = useAuth();
    const [status, setStatus] = useState<SpotifyStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const API_URL = resolveApiUrl();

    const fetchStatus = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/device/spotify/status`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (response.ok) {
                setStatus(await response.json());
            }
        } catch (err) {
            console.error('Failed to fetch Spotify status:', err);
        } finally {
            setIsLoading(false);
        }
    }, [accessToken, API_URL]);

    useEffect(() => {
        if (accessToken) fetchStatus();

        const params = new URLSearchParams(window.location.search);
        const spotifyResult = params.get('spotify');
        if (spotifyResult === 'success') {
            setSuccessMessage('Spotify connected successfully!');
            window.history.replaceState({}, '', window.location.pathname);
            fetchStatus();
        } else if (spotifyResult === 'error') {
            setError(`Failed to connect Spotify: ${params.get('reason') || 'Unknown error'}`);
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [accessToken, fetchStatus]);

    const handleConnect = async () => {
        if (status?.available === false) {
            setError(status.message || 'Spotify integration is not configured yet.');
            return;
        }

        setIsConnecting(true);
        setError(null);

        try {
            const response = await fetch(`${API_URL}/device/spotify/connect`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (response.ok) {
                const { authUrl } = await response.json();
                window.location.href = authUrl;
            } else {
                const data = await response.json().catch(() => null);
                throw new Error(data?.message || 'Failed to get authorization URL');
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to initiate connection');
            setIsConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm('Disconnect Spotify? Your listening history will be preserved.')) return;

        setIsDisconnecting(true);
        setError(null);

        try {
            const response = await fetch(`${API_URL}/device/spotify/disconnect`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (response.ok) {
                setStatus({ connected: false });
                setSuccessMessage('Spotify disconnected');
            } else {
                throw new Error('Failed to disconnect');
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to disconnect');
        } finally {
            setIsDisconnecting(false);
        }
    };

    const handleSync = async () => {
        setIsSyncing(true);
        setError(null);

        try {
            const response = await fetch(`${API_URL}/device/spotify/sync`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (response.ok) {
                setSuccessMessage('Music data synced');
                fetchStatus();
            } else {
                const data = await response.json().catch(() => null);
                throw new Error(data?.message || 'Failed to sync');
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to sync music data');
        } finally {
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        if (successMessage) {
            const timer = setTimeout(() => setSuccessMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [successMessage]);

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 8000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    if (isLoading) {
        return (
            <div className="workspace-panel h-full animate-pulse p-6">
                <div className="mb-4 h-6 w-1/3 rounded bg-[rgba(var(--text-muted),0.18)]" />
                <div className="h-4 w-2/3 rounded bg-[rgba(var(--text-muted),0.14)]" />
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="workspace-panel relative flex h-full flex-col overflow-hidden p-6"
        >
            <div className="flex items-center justify-between mb-5 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="health-icon-well flex h-10 w-10 items-center justify-center rounded-xl">
                        <FiMusic className="w-5 h-5 text-ink-secondary" />
                    </div>
                    <div>
                        <h3 className="workspace-heading text-lg font-semibold">Spotify</h3>
                        <p className="health-kicker">
                            {status?.connected
                                ? status.displayName || 'Connected'
                                : 'Music mood tracking'}
                        </p>
                    </div>
                </div>

                {status?.connected && (
                    <motion.button
                        whileHover={{ scale: 1.1, rotate: 180 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="workspace-button-outline rounded-lg p-2 transition-colors disabled:opacity-50"
                        title="Sync now"
                    >
                        <FiRefreshCw className={`w-4 h-4 text-ink-secondary ${isSyncing ? 'animate-spin' : ''}`} />
                    </motion.button>
                )}
            </div>

            <AnimatePresence mode="wait">
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2"
                    >
                        <FiAlertCircle className="w-4 h-4 text-danger flex-shrink-0" />
                        <span className="text-xs text-danger">{error}</span>
                    </motion.div>
                )}
                {successMessage && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2"
                    >
                        <FiCheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span className="text-xs text-emerald-300">{successMessage}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex-1 flex flex-col">
                {status?.connected ? (
                    <div className="space-y-4 flex-1 flex flex-col">
                        <div className="health-quiet flex-1 space-y-0.5 text-xs">
                            {status.connectedAt && (
                                <p>Connected: {new Date(status.connectedAt).toLocaleDateString()}</p>
                            )}
                            {status.lastSyncAt && (
                                <p>Last sync: {new Date(status.lastSyncAt).toLocaleString()}</p>
                            )}
                        </div>

                        <p className="text-xs text-ink-secondary">
                            Notive captures your listening mood (valence, energy) and genres to enrich your journal insights.
                        </p>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleDisconnect}
                            disabled={isDisconnecting}
                            className="health-disconnect-button mt-auto flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm transition-all disabled:opacity-50"
                        >
                            <FiSlash className="w-4 h-4" />
                            {isDisconnecting ? 'Disconnecting...' : 'Disconnect Spotify'}
                        </motion.button>
                    </div>
                ) : (
                    <div className="space-y-4 flex-1 flex flex-col">
                        <div className="space-y-2">
                            <div className="health-note-card flex items-center gap-3 rounded-lg p-2.5">
                                <FiMusic className="h-4 w-4 flex-shrink-0 text-ink-secondary" />
                                <span className="text-xs text-ink-secondary">Music mood & energy tracking</span>
                            </div>
                            <div className="health-note-card flex items-center gap-3 rounded-lg p-2.5">
                                <FiMusic className="h-4 w-4 flex-shrink-0 text-ink-secondary" />
                                <span className="text-xs text-ink-secondary">Genre & listening pattern insights</span>
                            </div>
                        </div>

                        <div className="health-quiet flex items-center gap-2 px-1 text-xs">
                            <FiShield className="w-3 h-3" />
                            <span>Read-only access · Never shared · Disconnect anytime</span>
                        </div>

                        {status?.message && (
                            <div className="workspace-muted-panel px-3 py-2 text-xs text-ink-secondary">
                                {status.message}
                            </div>
                        )}

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleConnect}
                            disabled={isConnecting || status?.available === false}
                            className="health-muted-button mt-auto flex w-full items-center justify-center gap-2 rounded-xl py-3 font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <FiLink className="w-4 h-4" />
                            {status?.available === false ? 'Not Configured' : isConnecting ? 'Connecting...' : 'Connect Spotify'}
                        </motion.button>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
