'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface Chapter {
    id: string;
    name: string;
    description: string | null;
    color: string;
    icon: string;
    _count: { entries: number };
    createdAt: string;
}

const ICONS = ['📖', '📚', '✨', '💡', '🎯', '💪', '❤️', '🌟', '🔥', '🌈', '🎨', '✍️', '🧠', '🌙', '☀️', '🏔️'];
const COLORS = ['#6366f1', '#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

export default function ChaptersPage() {
    const router = useRouter();
    const { user, accessToken, isLoading: authLoading } = useAuth();
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
    const [formData, setFormData] = useState({ name: '', description: '', color: '#6366f1', icon: '📖' });

    useEffect(() => {
        fetchChapters();
    }, [accessToken]);

    const fetchChapters = async () => {
        if (!accessToken) return;

        try {
            const response = await fetch(`${API_URL}/chapters`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (response.ok) {
                const data = await response.json();
                setChapters(data.chapters);
            }
        } catch (error) {
            console.error('Failed to fetch chapters:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return;

        try {
            const url = editingChapter ? `${API_URL}/chapters/${editingChapter.id}` : `${API_URL}/chapters`;
            const method = editingChapter ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                fetchChapters();
                setShowModal(false);
                setEditingChapter(null);
                setFormData({ name: '', description: '', color: '#6366f1', icon: '📖' });
            }
        } catch (error) {
            console.error('Failed to save chapter:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this chapter? Entries will be unassigned, not deleted.')) return;

        try {
            const response = await fetch(`${API_URL}/chapters/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (response.ok) {
                fetchChapters();
            }
        } catch (error) {
            console.error('Failed to delete chapter:', error);
        }
    };

    const openEditModal = (chapter: Chapter) => {
        setEditingChapter(chapter);
        setFormData({
            name: chapter.name,
            description: chapter.description || '',
            color: chapter.color,
            icon: chapter.icon,
        });
        setShowModal(true);
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!user) {
        router.push('/login');
        return null;
    }

    return (
        <div className="min-h-screen p-4 md:p-8">
            {/* Background Glow */}
            <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[150px] pointer-events-none" />

            <div className="max-w-6xl mx-auto relative z-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
                            </svg>
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold text-white">Living Volumes</h1>
                            <p className="text-slate-400">Chapters of your life, archived as digital volumes</p>
                        </div>
                    </div>
                    <button
                        onClick={() => { setShowModal(true); setEditingChapter(null); setFormData({ name: '', description: '', color: '#6366f1', icon: '📖' }); }}
                        className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl font-medium transition-all shadow-lg shadow-primary/25 flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" x2="12" y1="5" y2="19" /><line x1="5" x2="19" y1="12" y2="12" />
                        </svg>
                        New Chapter
                    </button>
                </div>

                {/* Chapters Grid */}
                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                    </div>
                ) : chapters.length === 0 ? (
                    <div className="glass-card p-12 rounded-2xl text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/20 flex items-center justify-center text-4xl">📚</div>
                        <h3 className="text-xl font-semibold text-white mb-2">No Chapters Yet</h3>
                        <p className="text-slate-400 mb-6">Create chapters to organize your journal entries into meaningful collections.</p>
                        <button
                            onClick={() => setShowModal(true)}
                            className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-medium transition-all"
                        >
                            Create Your First Chapter
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {chapters.map((chapter) => (
                            <div key={chapter.id} className="glass-card rounded-2xl overflow-hidden group hover:scale-[1.02] transition-transform duration-500">
                                <div className="h-32 relative overflow-hidden bg-slate-900">
                                    <div className="absolute inset-0 opacity-20" style={{ backgroundColor: chapter.color }} />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-6xl group-hover:scale-125 transition-transform duration-700">{chapter.icon}</span>
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: chapter.color }} />
                                </div>
                                <div className="p-6 relative">
                                    <div className="absolute -top-4 right-6 px-3 py-1 rounded-full bg-slate-900 border border-white/10 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        Vol. {chapter._count.entries.toString().padStart(2, '0')}
                                    </div>
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h3 className="text-xl font-bold text-white mb-1">{chapter.name}</h3>
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <span>{chapter._count.entries} entries</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-700" />
                                                <span>Started {new Date(chapter.createdAt).getFullYear()}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => openEditModal(chapter)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                    {chapter.description && <p className="text-slate-400 text-sm mb-6 line-clamp-2 italic">"{chapter.description}"</p>}
                                    <Link href={`/chapters/view?id=${chapter.id}`} className="flex items-center justify-center w-full py-2.5 rounded-xl border border-white/5 bg-white/5 hover:bg-primary hover:text-white transition-all text-sm font-medium gap-2">
                                        Open Volume
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                                        </svg>
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="glass-card rounded-2xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold text-white mb-6">{editingChapter ? 'Edit Chapter' : 'New Chapter'}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="My Chapter"
                                    className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="What's this chapter about?"
                                    rows={2}
                                    className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Icon</label>
                                <div className="flex flex-wrap gap-2">
                                    {ICONS.map((icon) => (
                                        <button
                                            key={icon}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, icon })}
                                            className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${formData.icon === icon ? 'bg-primary' : 'bg-white/5 hover:bg-white/10'}`}
                                        >
                                            {icon}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Color</label>
                                <div className="flex flex-wrap gap-2">
                                    {COLORS.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, color })}
                                            className={`w-8 h-8 rounded-full transition-all ${formData.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : ''}`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 rounded-xl bg-white/5 text-white hover:bg-white/10 transition-all">
                                    Cancel
                                </button>
                                <button type="submit" className="flex-1 px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary/90 transition-all">
                                    {editingChapter ? 'Save Changes' : 'Create Chapter'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
