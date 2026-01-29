'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/auth-context';
import { Activity, Moon, Footprints, Heart, RefreshCw, Unlink, Link2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ConnectionStatus {
    connected: boolean;
    connectedAt?: string;
    lastSyncAt?: string;
    scopes?: string[];
}

interface HealthStats {
    avgSleepHours: number | null;
    avgSteps: number | null;
    avgHeartRate: number | null;
    daysWithData: number;
    sleepTrend: 'improving' | 'declining' | 'stable';
    activityTrend: 'improving' | 'declining' | 'stable';
}

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

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

    const fetchStatus = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/health/google-fit/status`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (response.ok) {
                const data = await response.json();
                setStatus(data);

                // If connected, fetch health stats
                if (data.connected) {
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

        // Check URL params for OAuth callback result
        const params = new URLSearchParams(window.location.search);
        const googlefitResult = params.get('googlefit');
        if (googlefitResult === 'success') {
            setSuccessMessage('Google Fit connected successfully!');
            // Clean URL
            window.history.replaceState({}, '', window.location.pathname);
            fetchStatus();
        } else if (googlefitResult === 'error') {
            const reason = params.get('reason');
            setError(`Failed to connect Google Fit: ${reason || 'Unknown error'}`);
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [accessToken, fetchStatus]);

    const handleConnect = async () => {
        setIsConnecting(true);
        setError(null);

        try {
            const response = await fetch(`${API_URL}/health/google-fit/connect`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (response.ok) {
                const { authUrl } = await response.json();
                // Redirect to Google OAuth
                window.location.href = authUrl;
            } else {
                throw new Error('Failed to get authorization URL');
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
                throw new Error('Failed to sync');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to sync health data');
        } finally {
            setIsSyncing(false);
        }
    };

    // Auto-clear messages
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
            <div className="bento-box p-6 animate-pulse">
                <div className="h-6 bg-white/10 rounded w-1/3 mb-4" />
                <div className="h-4 bg-white/10 rounded w-2/3" />
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bento-box p-6 md:p-8 relative overflow-hidden"
        >
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 blur-[60px] rounded-full -translate-y-1/2 translate-x-1/2" />

            {/* Header */}
            <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">Google Fit</h3>
                        <p className="text-xs text-slate-500">
                            {status?.connected ? 'Connected' : 'Not connected'}
                        </p>
                    </div>
                </div>

                {status?.connected && (
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50"
                        title="Sync now"
                    >
                        <RefreshCw className={`w-4 h-4 text-slate-400 ${isSyncing ? 'animate-spin' : ''}`} />
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
                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                        <span className="text-sm text-red-300">{error}</span>
                    </motion.div>
                )}

                {successMessage && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2"
                    >
                        <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                        <span className="text-sm text-green-300">{successMessage}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Content based on connection state */}
            {status?.connected ? (
                <div className="space-y-6">
                    {/* Health Stats Preview */}
                    {healthStats && healthStats.daysWithData > 0 && (
                        <div className="grid grid-cols-3 gap-3">
                            <div className="p-3 rounded-xl bg-white/5 text-center">
                                <Moon className="w-4 h-4 text-indigo-400 mx-auto mb-1" />
                                <p className="text-lg font-semibold text-white">
                                    {healthStats.avgSleepHours?.toFixed(1) || '—'}
                                </p>
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Avg Sleep</p>
                            </div>
                            <div className="p-3 rounded-xl bg-white/5 text-center">
                                <Footprints className="w-4 h-4 text-green-400 mx-auto mb-1" />
                                <p className="text-lg font-semibold text-white">
                                    {healthStats.avgSteps ? Math.round(healthStats.avgSteps).toLocaleString() : '—'}
                                </p>
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Avg Steps</p>
                            </div>
                            <div className="p-3 rounded-xl bg-white/5 text-center">
                                <Heart className="w-4 h-4 text-red-400 mx-auto mb-1" />
                                <p className="text-lg font-semibold text-white">
                                    {healthStats.avgHeartRate || '—'}
                                </p>
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Avg HR</p>
                            </div>
                        </div>
                    )}

                    {/* Connection info */}
                    <div className="text-xs text-slate-500 space-y-1">
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
                        className="w-full py-3 rounded-xl bg-white/5 hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <Unlink className="w-4 h-4" />
                        {isDisconnecting ? 'Disconnecting...' : 'Disconnect Google Fit'}
                    </motion.button>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Privacy explanation */}
                    <div className="p-4 rounded-xl bg-white/5 space-y-3">
                        <p className="text-sm text-slate-300">
                            Connect Google Fit to add health context to your journal entries.
                        </p>
                        <ul className="text-xs text-slate-400 space-y-1.5">
                            <li className="flex items-start gap-2">
                                <Moon className="w-3.5 h-3.5 text-indigo-400 mt-0.5 flex-shrink-0" />
                                <span>Sleep duration & quality</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <Footprints className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                                <span>Daily steps & activity</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <Heart className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                                <span>Heart rate (optional)</span>
                            </li>
                        </ul>
                        <p className="text-[10px] text-slate-500 pt-2 border-t border-white/5">
                            🔒 Your data is never shared. Read-only access. Disconnect anytime.
                        </p>
                    </div>

                    {/* Connect button */}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleConnect}
                        disabled={isConnecting}
                        className="w-full py-4 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-green-500/20"
                    >
                        <Link2 className="w-5 h-5" />
                        {isConnecting ? 'Connecting...' : 'Connect Google Fit'}
                    </motion.button>
                </div>
            )}
        </motion.div>
    );
}
