'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/auth-context';
import { resolveApiUrl } from '@/constants/config';
import {
    FiActivity,
    FiAlertCircle,
    FiCheckCircle,
    FiHeart,
    FiLink,
    FiMinus,
    FiMoon,
    FiRefreshCw,
    FiShield,
    FiSlash,
    FiTrendingDown,
    FiTrendingUp,
} from 'react-icons/fi';

interface ConnectionStatus {
    connected: boolean;
    connectedAt?: string;
    lastSyncAt?: string;
    scopes?: string[];
    available?: boolean;
    connectAvailable?: boolean;
    configured?: boolean;
    schemaReady?: boolean;
    reason?: string;
    message?: string;
}

interface HealthStats {
    avgSleepHours: number | null;
    avgSteps: number | null;
    avgHeartRate: number | null;
    daysWithData: number;
    sleepTrend: 'improving' | 'declining' | 'stable';
    activityTrend: 'improving' | 'declining' | 'stable';
}

const TrendIcon = ({ trend }: { trend: 'improving' | 'declining' | 'stable' }) => {
    if (trend === 'improving') return <FiTrendingUp className="w-3 h-3 text-success" />;
    if (trend === 'declining') return <FiTrendingDown className="w-3 h-3 text-danger" />;
    return <FiMinus className="w-3 h-3 text-ink-muted" />;
};

export default function GoogleFitConnection() {
    const { accessToken } = useAuth();
    const [status, setStatus] = useState<ConnectionStatus | null>(null);
    const [healthStats, setHealthStats] = useState<HealthStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const API_URL = resolveApiUrl();

    const fetchStatus = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/health/google-fit/status`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (response.ok) {
                const data = await response.json();
                setStatus(data);

                if (data.connected && data.available !== false) {
                    const statsResponse = await fetch(`${API_URL}/health/stats?days=30`, {
                        headers: { Authorization: `Bearer ${accessToken}` },
                    });
                    if (statsResponse.ok) {
                        setHealthStats(await statsResponse.json());
                    }
                }
            }
        } catch (err) {
            console.error('Failed to fetch Google Fit status:', err);
        } finally {
            setIsLoading(false);
        }
    }, [accessToken, API_URL]);

    useEffect(() => {
        if (accessToken) {
            fetchStatus();
        }

        const params = new URLSearchParams(window.location.search);
        const googlefitResult = params.get('googlefit');
        if (googlefitResult === 'success') {
            setSuccessMessage('Google Fit connected successfully!');
            window.history.replaceState({}, '', window.location.pathname);
            fetchStatus();
        } else if (googlefitResult === 'error') {
            const reason = params.get('reason');
            setError(`Failed to connect Google Fit: ${reason || 'Unknown error'}`);
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [accessToken, fetchStatus]);

    const handleConnect = async () => {
        if (status?.connectAvailable === false) {
            setError(status.message || 'Google Fit is not available in this environment yet.');
            return;
        }

        setIsConnecting(true);
        setError(null);

        try {
            const response = await fetch(`${API_URL}/health/google-fit/connect`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (response.ok) {
                const { authUrl } = await response.json();
                window.location.href = authUrl;
            } else {
                const data = await response.json().catch(() => null);
                throw new Error(data?.message || 'Failed to get authorization URL');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to initiate connection');
            setIsConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm('Are you sure you want to disconnect Google Fit? Your health data will be preserved.')) {
            return;
        }

        setIsDisconnecting(true);
        setError(null);

        try {
            const response = await fetch(`${API_URL}/health/google-fit/disconnect`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (response.ok) {
                setStatus({ connected: false });
                setHealthStats(null);
                setSuccessMessage('Google Fit disconnected');
            } else {
                throw new Error('Failed to disconnect');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to disconnect');
        } finally {
            setIsDisconnecting(false);
        }
    };

    const handleSync = async () => {
        setIsSyncing(true);
        setError(null);

        try {
            const response = await fetch(`${API_URL}/health/sync`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (response.ok) {
                setSuccessMessage('Health data synced successfully');
                fetchStatus();
            } else {
                const data = await response.json().catch(() => null);
                throw new Error(data?.message || 'Failed to sync');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to sync health data');
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
            {/* Subtle neutral gradient background */}
            <div className="health-glow absolute right-0 top-0 h-32 w-32 -translate-y-1/2 translate-x-1/2 rounded-full blur-[60px]" />

            {/* Header */}
            <div className="flex items-center justify-between mb-5 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="health-icon-well flex h-10 w-10 items-center justify-center rounded-xl">
                        <FiActivity className="w-5 h-5 text-ink-secondary" />
                    </div>
                    <div>
                        <h3 className="workspace-heading text-lg font-semibold">Google Fit</h3>
                        <p className="health-kicker">
                            {status?.connected ? 'Connected' : 'Health tracking'}
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

            {/* Messages */}
            <AnimatePresence mode="wait">
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 flex items-center gap-2"
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
                        className="mb-4 p-3 rounded-lg bg-success/10 border border-success/20 flex items-center gap-2"
                    >
                        <FiCheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                        <span className="text-xs text-success">{successMessage}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Content */}
            <div className="flex-1 flex flex-col">
                {status?.connected ? (
                    <div className="space-y-4 flex-1 flex flex-col">
                        {/* Health Stats - Neutral color scheme */}
                        {healthStats && healthStats.daysWithData > 0 && (
                            <div className="grid grid-cols-3 gap-2">
                                <div className="health-stat-card rounded-xl p-3 text-center">
                                    <FiMoon className="mx-auto mb-1 h-4 w-4 text-ink-secondary" />
                                    <p className="workspace-heading text-base font-semibold">
                                        {healthStats.avgSleepHours?.toFixed(1) || '—'}
                                    </p>
                                    <p className="health-kicker">Sleep</p>
                                    <div className="mt-1 flex justify-center">
                                        <TrendIcon trend={healthStats.sleepTrend} />
                                    </div>
                                </div>
                                <div className="health-stat-card rounded-xl p-3 text-center">
                                    <FiActivity className="mx-auto mb-1 h-4 w-4 text-ink-secondary" />
                                    <p className="workspace-heading text-base font-semibold">
                                        {healthStats.avgSteps ? (healthStats.avgSteps / 1000).toFixed(1) + 'k' : '—'}
                                    </p>
                                    <p className="health-kicker">Steps</p>
                                    <div className="mt-1 flex justify-center">
                                        <TrendIcon trend={healthStats.activityTrend} />
                                    </div>
                                </div>
                                <div className="health-stat-card rounded-xl p-3 text-center">
                                    <FiHeart className="mx-auto mb-1 h-4 w-4 text-ink-secondary" />
                                    <p className="workspace-heading text-base font-semibold">
                                        {healthStats.avgHeartRate || '—'}
                                    </p>
                                    <p className="health-kicker">HR</p>
                                </div>
                            </div>
                        )}

                        {/* Connection info */}
                        <div className="health-quiet flex-1 space-y-0.5 text-xs">
                            {status.connectedAt && (
                                <p>Connected: {new Date(status.connectedAt).toLocaleDateString()}</p>
                            )}
                            {status.lastSyncAt && (
                                <p>Last sync: {new Date(status.lastSyncAt).toLocaleString()}</p>
                            )}
                        </div>

                        {/* Disconnect button */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleDisconnect}
                            disabled={isDisconnecting}
                            className="health-disconnect-button mt-auto flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm transition-all disabled:opacity-50"
                        >
                            <FiSlash className="w-4 h-4" />
                            {isDisconnecting ? 'Disconnecting...' : 'Disconnect Google Fit'}
                        </motion.button>
                    </div>
                ) : (
                    <div className="space-y-4 flex-1 flex flex-col">
                        {/* Features list - compact */}
                        <div className="space-y-2">
                            <div className="health-note-card flex items-center gap-3 rounded-lg p-2.5">
                                <FiMoon className="h-4 w-4 flex-shrink-0 text-ink-secondary" />
                                <span className="text-xs text-ink-secondary">Sleep duration & quality</span>
                            </div>
                            <div className="health-note-card flex items-center gap-3 rounded-lg p-2.5">
                                <FiActivity className="h-4 w-4 flex-shrink-0 text-ink-secondary" />
                                <span className="text-xs text-ink-secondary">Daily steps & activity</span>
                            </div>
                            <div className="health-note-card flex items-center gap-3 rounded-lg p-2.5">
                                <FiHeart className="h-4 w-4 flex-shrink-0 text-ink-secondary" />
                                <span className="text-xs text-ink-secondary">Heart rate (optional)</span>
                            </div>
                        </div>

                        {/* Privacy notice */}
                        <div className="health-quiet flex items-center gap-2 px-1 text-xs">
                            <FiShield className="w-3 h-3" />
                            <span>Read-only access • Never shared • Disconnect anytime</span>
                        </div>

                        {status?.message && (
                            <div className="workspace-muted-panel px-3 py-2 text-xs text-ink-secondary">
                                {status.message}
                            </div>
                        )}

                        {/* Connect button - neutral/muted */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleConnect}
                            disabled={isConnecting || status?.connectAvailable === false}
                            className="health-muted-button mt-auto flex w-full items-center justify-center gap-2 rounded-xl py-3 font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <FiLink className="w-4 h-4" />
                            {status?.connectAvailable === false ? 'Unavailable Here' : isConnecting ? 'Connecting...' : 'Connect Google Fit'}
                        </motion.button>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
