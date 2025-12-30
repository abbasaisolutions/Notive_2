// Social Import UI Component
// File: frontend/src/components/import/SocialImportPanel.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { API_URL } from '@/constants/config';
import SocialSelectionModal from './SocialSelectionModal';

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

    // Check URL for import results
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
            // Refresh status to show connected
            fetchStatus();
        } else if (importStatus === 'error') {
            setImportResult({
                success: false,
                message: params.get('message') || 'Import failed',
            });
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    // Fetch import status
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

    // Connect to platform
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

                // Redirect to OAuth
                window.location.href = url;
            }
        } catch (error) {
            console.error('Failed to get auth URL:', error);
        }
    };

    // Open selection modal
    const openSelectionModal = (provider: 'instagram' | 'facebook') => {
        setModalProvider(provider);
        setModalOpen(true);
    };

    // Handle import complete
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
            <div className="bento-box p-8">
                <div className="flex items-center gap-3 mb-6">
                    <span className="text-3xl">📥</span>
                    <div>
                        <h3 className="text-xl font-bold text-white">Import Memories</h3>
                        <p className="text-sm text-slate-400">Connect and import from social accounts</p>
                    </div>
                </div>

                {/* Import Result Toast */}
                {importResult && (
                    <div className={`mb-6 p-4 rounded-xl ${importResult.success
                        ? 'bg-green-500/10 border border-green-500/20'
                        : 'bg-red-500/10 border border-red-500/20'
                        }`}>
                        {importResult.success ? (
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">✅</span>
                                <div>
                                    <p className="text-white font-semibold">
                                        {importResult.message || 'Import Successful!'}
                                    </p>
                                    {importResult.imported !== undefined && (
                                        <p className="text-sm text-slate-400">
                                            {importResult.imported} entries imported from {importResult.source}
                                            {importResult.skipped && importResult.skipped > 0 && (
                                                <span> ({importResult.skipped} duplicates skipped)</span>
                                            )}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">❌</span>
                                <div>
                                    <p className="text-white font-semibold">Import Failed</p>
                                    <p className="text-sm text-slate-400">{importResult.message}</p>
                                </div>
                            </div>
                        )}
                        <button
                            onClick={() => setImportResult(null)}
                            className="mt-2 text-xs text-slate-500 hover:text-white transition-colors"
                        >
                            Dismiss
                        </button>
                    </div>
                )}

                {/* Current Status */}
                {status && (
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="p-4 rounded-xl bg-white/5 text-center">
                            <div className="text-2xl font-bold text-white">{status.notive}</div>
                            <div className="text-xs text-slate-400">Notive</div>
                        </div>
                        <div className="p-4 rounded-xl bg-gradient-to-br from-pink-500/10 to-purple-500/10 text-center">
                            <div className="text-2xl font-bold text-white">{status.instagram}</div>
                            <div className="text-xs text-slate-400">Instagram</div>
                        </div>
                        <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 text-center">
                            <div className="text-2xl font-bold text-white">{status.facebook}</div>
                            <div className="text-xs text-slate-400">Facebook</div>
                        </div>
                    </div>
                )}

                {/* Import Buttons */}
                <div className="space-y-4">
                    {/* Instagram */}
                    <div className="p-1 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600">
                        <div className="bg-slate-900/90 rounded-[0.9rem] p-4 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white">
                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <div className="font-bold text-white text-lg">Instagram</div>
                                <div className="text-xs text-pink-300 font-medium tracking-wide">
                                    {isInstagramConnected ? '✓ Connected' : 'Connect to import'}
                                </div>
                            </div>
                            {isInstagramConnected ? (
                                <button
                                    onClick={() => openSelectionModal('instagram')}
                                    className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-sm transition-all"
                                >
                                    Select Memories
                                </button>
                            ) : (
                                <button
                                    onClick={() => startConnect('instagram')}
                                    disabled={isLoading}
                                    className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-sm transition-all disabled:opacity-50"
                                >
                                    Connect
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Facebook */}
                    <div className="p-1 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600">
                        <div className="bg-slate-900/90 rounded-[0.9rem] p-4 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white">
                                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <div className="font-bold text-white text-lg">Facebook</div>
                                <div className="text-xs text-blue-300 font-medium tracking-wide">
                                    {isFacebookConnected ? '✓ Connected' : 'Connect to import'}
                                </div>
                            </div>
                            {isFacebookConnected ? (
                                <button
                                    onClick={() => openSelectionModal('facebook')}
                                    className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-sm transition-all"
                                >
                                    Select Memories
                                </button>
                            ) : (
                                <button
                                    onClick={() => startConnect('facebook')}
                                    disabled={isLoading}
                                    className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-sm transition-all disabled:opacity-50"
                                >
                                    Connect
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Info Notice */}
                <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-start gap-3">
                        <span className="text-xl">💡</span>
                        <div className="text-sm">
                            <p className="text-slate-300 font-medium">How it works</p>
                            <p className="text-slate-500 mt-1">
                                Connect your account, then select which memories to import as journal entries.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Selection Modal */}
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
