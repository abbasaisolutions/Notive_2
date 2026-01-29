// Social Import Selection Modal
// File: frontend/src/components/import/SocialSelectionModal.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Frown, Inbox } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { API_URL } from '@/constants/config';

interface Candidate {
    id: string;
    caption?: string;
    message?: string;
    media_url?: string;
    full_picture?: string;
    timestamp?: string;
    created_time?: string;
}

interface SocialSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    provider: 'instagram' | 'facebook';
    onImportComplete: (result: { imported: number; skipped: number }) => void;
}

export function SocialSelectionModal({ isOpen, onClose, provider, onImportComplete }: SocialSelectionModalProps) {
    const { accessToken } = useAuth();
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch candidates when modal opens
    useEffect(() => {
        if (isOpen && accessToken) {
            fetchCandidates();
        }
    }, [isOpen, accessToken, provider]);

    const fetchCandidates = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_URL}/import/candidates?provider=${provider}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to load memories');
            }

            const data = await response.json();
            setCandidates(data.candidates || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const selectAll = () => {
        setSelectedIds(new Set(candidates.map(c => c.id)));
    };

    const deselectAll = () => {
        setSelectedIds(new Set());
    };

    const handleImport = async () => {
        if (selectedIds.size === 0) return;

        setIsImporting(true);
        try {
            const response = await fetch(`${API_URL}/import/batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    provider,
                    selectedIds: Array.from(selectedIds),
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Import failed');
            }

            const result = await response.json();
            onImportComplete(result);
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsImporting(false);
        }
    };

    const getImageUrl = (c: Candidate) => c.media_url || c.full_picture;
    const getCaption = (c: Candidate) => c.caption || c.message || 'No caption';
    const getDate = (c: Candidate) => {
        const dateStr = c.timestamp || c.created_time;
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString();
    };

    const providerName = provider === 'instagram' ? 'Instagram' : 'Facebook';
    const providerColor = provider === 'instagram' ? 'from-pink-500 to-purple-600' : 'from-blue-500 to-indigo-600';

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className={`p-6 bg-gradient-to-r ${providerColor} rounded-t-3xl`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                                    {provider === 'instagram' ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white">
                                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white">
                                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                        </svg>
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-white">Select {providerName} Memories</h2>
                                    <p className="text-white/80 text-sm">Choose the moments you want to import</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Selection Controls */}
                    <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-800/50">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={selectAll}
                                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium text-white transition-all"
                            >
                                Select All
                            </button>
                            <button
                                onClick={deselectAll}
                                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium text-white transition-all"
                            >
                                Deselect All
                            </button>
                        </div>
                        <div className="text-sm text-slate-400">
                            <span className="text-white font-bold">{selectedIds.size}</span> of <span className="text-white font-bold">{candidates.length}</span> selected
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center h-64 gap-4">
                                <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
                                <p className="text-slate-400">Loading your memories...</p>
                            </div>
                        ) : error ? (
                            <div className="flex flex-col items-center justify-center h-64 gap-4">
                                <Frown className="w-8 h-8 text-white" />
                                <p className="text-red-400">{error}</p>
                                <button
                                    onClick={fetchCandidates}
                                    className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/80 text-white font-medium transition-all"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : candidates.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 gap-4">
                                <Inbox className="w-8 h-8 text-white" />
                                <p className="text-slate-400">No memories found to import.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {candidates.map((candidate) => {
                                    const isSelected = selectedIds.has(candidate.id);
                                    const imageUrl = getImageUrl(candidate);

                                    return (
                                        <motion.div
                                            key={candidate.id}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => toggleSelection(candidate.id)}
                                            className={`relative rounded-2xl overflow-hidden cursor-pointer transition-all border-2 ${isSelected
                                                    ? 'border-primary ring-2 ring-primary/50'
                                                    : 'border-transparent hover:border-white/20'
                                                }`}
                                        >
                                            {/* Image */}
                                            <div className="aspect-square bg-slate-800">
                                                {imageUrl ? (
                                                    <img
                                                        src={imageUrl}
                                                        alt=""
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <FileText className="w-8 h-8 text-white" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Overlay */}
                                            <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-3 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-80'
                                                }`}>
                                                <p className="text-white text-xs line-clamp-2 font-medium">
                                                    {getCaption(candidate)}
                                                </p>
                                                <p className="text-white/60 text-[10px] mt-1">
                                                    {getDate(candidate)}
                                                </p>
                                            </div>

                                            {/* Selection Indicator */}
                                            <div className={`absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected
                                                    ? 'bg-primary border-primary'
                                                    : 'bg-black/50 border-white/50'
                                                }`}>
                                                {isSelected && (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-white/10 bg-slate-800/50">
                        <div className="flex items-center justify-between">
                            <button
                                onClick={onClose}
                                className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={selectedIds.size === 0 || isImporting}
                                className={`px-8 py-3 rounded-xl font-bold text-white transition-all flex items-center gap-2 ${selectedIds.size === 0 || isImporting
                                        ? 'bg-slate-700 cursor-not-allowed opacity-50'
                                        : `bg-gradient-to-r ${providerColor} hover:opacity-90 shadow-lg`
                                    }`}
                            >
                                {isImporting ? (
                                    <>
                                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                        Importing...
                                    </>
                                ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <polyline points="7 10 12 15 17 10" />
                                            <line x1="12" y1="15" x2="12" y2="3" />
                                        </svg>
                                        Import {selectedIds.size} {selectedIds.size === 1 ? 'Memory' : 'Memories'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

export default SocialSelectionModal;
