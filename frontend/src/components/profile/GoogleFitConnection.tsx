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
    if (trend === 'improving') return <FiTrendingUp className="w-3 h-3 text-emerald-400" />;
    if (trend === 'declining') return <FiTrendingDown className="w-3 h-3 text-amber-400" />;
    return <FiMinus className="w-3 h-3 text-slate-500" />;
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
            <div className="bento-box p-6 animate-pulse h-full">
                <div className="h-6 bg-white/10 rounded w-1/3 mb-4" />
                <div className="h-4 bg-white/10 rounded w-2/3" />
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bento-box p-6 relative overflow-hidden h-full flex flex-col"
        >
            {/* Subtle neutral gradient background */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-500/5 blur-[60px] rounded-full -translate-y-1/2 translate-x-1/2" />

            {/* Header */}
            <div className="flex items-center justify-between mb-5 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-500/10 flex items-center justify-center">
                        <FiActivity className="w-5 h-5 text-slate-300" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">Google Fit</h3>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">
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
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50"
                        title="Sync now"
                    >
                        <FiRefreshCw className={`w-4 h-4 text-slate-400 ${isSyncing ? 'animate-spin' : ''}`} />
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
                        className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2"
                    >
                        <FiAlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                        <span className="text-xs text-red-300">{error}</span>
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

            {/* Content */}
            <div className="flex-1 flex flex-col">
                {status?.connected ? (
                    <div className="space-y-4 flex-1 flex flex-col">
                        {/* Health Stats - Neutral color scheme */}
                        {healthStats && healthStats.daysWithData > 0 && (
                            <div className="grid grid-cols-3 gap-2">
                                <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                                    <FiMoon className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                                    <p className="text-base font-semibold text-white">
                                        {healthStats.avgSleepHours?.toFixed(1) || '—'}
                                    </p>
                                    <p className="text-[9px] text-slate-500 uppercase tracking-wider">Sleep</p>
                                    <div className="mt-1 flex justify-center">
                                        <TrendIcon trend={healthStats.sleepTrend} />
                                    </div>
                                </div>
                                <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                                    <FiActivity className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                                    <p className="text-base font-semibold text-white">
                                        {healthStats.avgSteps ? (healthStats.avgSteps / 1000).toFixed(1) + 'k' : '—'}
                                    </p>
                                    <p className="text-[9px] text-slate-500 uppercase tracking-wider">Steps</p>
                                    <div className="mt-1 flex justify-center">
                                        <TrendIcon trend={healthStats.activityTrend} />
                                    </div>
                                </div>
                                <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                                    <FiHeart className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                                    <p className="text-base font-semibold text-white">
                                        {healthStats.avgHeartRate || '—'}
                                    </p>
                                    <p className="text-[9px] text-slate-500 uppercase tracking-wider">HR</p>
                                </div>
                            </div>
                        )}

                        {/* Connection info */}
                        <div className="text-[10px] text-slate-500 space-y-0.5 flex-1">
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
                            className="w-full py-2.5 rounded-xl bg-slate-800/50 hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm border border-slate-700/50 hover:border-red-500/20 mt-auto"
                        >
                            <FiSlash className="w-4 h-4" />
                            {isDisconnecting ? 'Disconnecting...' : 'Disconnect Google Fit'}
                        </motion.button>
                    </div>
                ) : (
                    <div className="space-y-4 flex-1 flex flex-col">
                        {/* Features list - compact */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/30 border border-slate-700/30">
                                <FiMoon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                <span className="text-xs text-slate-300">Sleep duration & quality</span>
                            </div>
                            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/30 border border-slate-700/30">
                                <FiActivity className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                <span className="text-xs text-slate-300">Daily steps & activity</span>
                            </div>
                            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/30 border border-slate-700/30">
                                <FiHeart className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                <span className="text-xs text-slate-300">Heart rate (optional)</span>
                            </div>
                        </div>

                        {/* Privacy notice */}
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 px-1">
                            <FiShield className="w-3 h-3" />
                            <span>Read-only access • Never shared • Disconnect anytime</span>
                        </div>

                        {status?.message && (
                            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
                                {status.message}
                            </div>
                        )}

                        {/* Connect button - neutral/muted */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleConnect}
                            disabled={isConnecting || status?.connectAvailable === false}
                            className="w-full py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-slate-900/50 mt-auto"
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
