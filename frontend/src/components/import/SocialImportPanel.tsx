// Social Import UI Component
// File: frontend/src/components/import/SocialImportPanel.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, Download, Lightbulb, XCircle } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { API_URL } from '@/constants/config';
import SocialSelectionModal from './SocialSelectionModal';
import { motion } from 'framer-motion';

interface ImportStatus {
    instagram: number;
    facebook: number;
    notive: number;
    total: number;
}

interface Connections {
    instagram?: boolean;
    facebook?: boolean;
}

export function SocialImportPanel() {
    const { accessToken } = useAuth();
    const [status, setStatus] = useState<ImportStatus | null>(null);
    const [connections, setConnections] = useState<Connections>({});
    const [isLoading, setIsLoading] = useState(true);
    const [importResult, setImportResult] = useState<{
        success: boolean;
        source?: string;
        imported?: number;
        skipped?: number;
        message?: string;
    } | null>(null);

    const [modalOpen, setModalOpen] = useState(false);
    const [modalProvider, setModalProvider] = useState<'instagram' | 'facebook'>('instagram');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const importStatus = params.get('import');

        if (importStatus === 'success') {
            setImportResult({
                success: true,
                source: params.get('source') || undefined,
                imported: parseInt(params.get('imported') || '0'),
                skipped: parseInt(params.get('skipped') || '0'),
            });
            window.history.replaceState({}, '', window.location.pathname);
        } else if (importStatus === 'connected') {
            setImportResult({
                success: true,
                source: params.get('provider') || undefined,
                message: `${params.get('provider')} connected! Now select memories to import.`,
            });
            window.history.replaceState({}, '', window.location.pathname);
            fetchStatus();
        } else if (importStatus === 'error') {
            setImportResult({
                success: false,
                message: params.get('message') || 'Import failed',
            });
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    const fetchStatus = async () => {
        if (!accessToken) return;

        try {
            const response = await fetch(`${API_URL}/import/status`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (response.ok) {
                const data = await response.json();
                setStatus(data.entryCount);
                setConnections(data.connections || {});
            }
        } catch (error) {
            console.error('Failed to fetch import status:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, [accessToken, importResult]);

    const startConnect = async (platform: 'instagram' | 'facebook') => {
        if (!accessToken) return;

        try {
            const response = await fetch(`${API_URL}/import/auth-urls`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (response.ok) {
                const data = await response.json();
                const url = platform === 'instagram'
                    ? data.urls.instagram
                    : data.urls.facebook;
                window.location.href = url;
            }
        } catch (error) {
            console.error('Failed to get auth URL:', error);
        }
    };

    const openSelectionModal = (provider: 'instagram' | 'facebook') => {
        setModalProvider(provider);
        setModalOpen(true);
    };

    const handleImportComplete = (result: { imported: number; skipped: number }) => {
        setImportResult({
            success: true,
            source: modalProvider,
            imported: result.imported,
            skipped: result.skipped,
        });
        fetchStatus();
    };

    const isInstagramConnected = connections.instagram;
    const isFacebookConnected = connections.facebook;

    return (
        <>
            <div className="bento-box p-6 h-full flex flex-col">
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-slate-700/50 flex items-center justify-center">
                        <Download className="w-5 h-5 text-slate-300" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">Import Memories</h3>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">From social accounts</p>
                    </div>
                </div>

                {/* Import Result Toast */}
                {importResult && (
                    <div className={`mb-4 p-3 rounded-xl text-xs ${importResult.success
                        ? 'bg-emerald-500/10 border border-emerald-500/20'
                        : 'bg-red-500/10 border border-red-500/20'
                        }`}>
                        {importResult.success ? (
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                <div>
                                    <p className="text-white font-medium">
                                        {importResult.message || 'Import Successful!'}
                                    </p>
                                    {importResult.imported !== undefined && (
                                        <p className="text-slate-400 mt-0.5">
                                            {importResult.imported} entries from {importResult.source}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                                <span className="text-red-300">{importResult.message}</span>
                            </div>
                        )}
                        <button
                            onClick={() => setImportResult(null)}
                            className="mt-2 text-[10px] text-slate-500 hover:text-white transition-colors"
                        >
                            Dismiss
                        </button>
                    </div>
                )}

                {/* Current Status - Compact */}
                {status && (
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="p-2.5 rounded-xl bg-white/5 text-center">
                            <div className="text-lg font-bold text-white">{status.notive}</div>
                            <div className="text-[9px] text-slate-500 uppercase tracking-wider">Notive</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                            <div className="text-lg font-bold text-white">{status.instagram}</div>
                            <div className="text-[9px] text-slate-500 uppercase tracking-wider">Instagram</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                            <div className="text-lg font-bold text-white">{status.facebook}</div>
                            <div className="text-[9px] text-slate-500 uppercase tracking-wider">Facebook</div>
                        </div>
                    </div>
                )}

                {/* Import Buttons - Compact */}
                <div className="space-y-2 flex-1">
                    {/* Instagram */}
                    <motion.div 
                        whileHover={{ scale: 1.01 }}
                        className="p-[1px] rounded-xl bg-slate-600/50"
                    >
                        <div className="bg-slate-900/95 rounded-[11px] p-3 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="white">
                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-semibold text-white text-sm">Instagram</div>
                                <div className="text-[10px] text-slate-400">
                                    {isInstagramConnected ? '✓ Connected' : 'Connect to import'}
                                </div>
                            </div>
                            <button
                                onClick={() => isInstagramConnected ? openSelectionModal('instagram') : startConnect('instagram')}
                                disabled={isLoading}
                                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition-all disabled:opacity-50"
                            >
                                {isInstagramConnected ? 'Import' : 'Connect'}
                            </button>
                        </div>
                    </motion.div>

                    {/* Facebook */}
                    <motion.div 
                        whileHover={{ scale: 1.01 }}
                        className="p-[1px] rounded-xl bg-slate-600/50"
                    >
                        <div className="bg-slate-900/95 rounded-[11px] p-3 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="white">
                                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-semibold text-white text-sm">Facebook</div>
                                <div className="text-[10px] text-slate-400">
                                    {isFacebookConnected ? '✓ Connected' : 'Connect to import'}
                                </div>
                            </div>
                            <button
                                onClick={() => isFacebookConnected ? openSelectionModal('facebook') : startConnect('facebook')}
                                disabled={isLoading}
                                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition-all disabled:opacity-50"
                            >
                                {isFacebookConnected ? 'Import' : 'Connect'}
                            </button>
                        </div>
                    </motion.div>
                </div>

                {/* Info Notice - Compact */}
                <div className="mt-4 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-start gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-400/70 flex-shrink-0 mt-0.5" />
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                            Connect your account, then select which memories to import as journal entries.
                        </p>
                    </div>
                </div>
            </div>

            <SocialSelectionModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                provider={modalProvider}
                onImportComplete={handleImportComplete}
            />
        </>
    );
}

export default SocialImportPanel;
