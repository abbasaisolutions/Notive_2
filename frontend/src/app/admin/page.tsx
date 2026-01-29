'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Lock } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface User {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    role: 'USER' | 'ADMIN' | 'SUPERADMIN';
    isBanned: boolean;
    createdAt: string;
    _count: { entries: number };
}

interface Stats {
    totalUsers: number;
    totalEntries: number;
    newUsersThisWeek: number;
    activeUsersToday: number;
}

export default function AdminPage() {
    const router = useRouter();
    const { user, accessToken, isLoading: authLoading } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchUsers = async () => {
        try {
            const response = await fetch(`${API_URL}/admin/users?page=${page}&search=${search}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!response.ok) {
                if (response.status === 403) {
                    setError('Admin access required');
                    return;
                }
                throw new Error('Failed to fetch users');
            }
            const data = await response.json();
            setUsers(data.users);
            setTotalPages(data.pagination.totalPages);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await fetch(`${API_URL}/admin/stats`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (response.ok) {
                const data = await response.json();
                setStats(data);
            }
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    };

    useEffect(() => {
        if (accessToken) {
            Promise.all([fetchUsers(), fetchStats()]).finally(() => setIsLoading(false));
        }
    }, [accessToken, page]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchUsers();
    };

    const handleToggleBan = async (userId: string) => {
        try {
            const response = await fetch(`${API_URL}/admin/users/${userId}/ban`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (response.ok) {
                fetchUsers();
            }
        } catch (err) {
            console.error('Ban error:', err);
        }
    };

    const handleChangeRole = async (userId: string, role: string) => {
        try {
            const response = await fetch(`${API_URL}/admin/users/${userId}/role`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ role }),
            });
            if (response.ok) {
                fetchUsers();
            }
        } catch (err) {
            console.error('Role change error:', err);
        }
    };

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (error === 'Admin access required') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-8">
                <div className="flex justify-center mb-4">
                    <Lock className="w-12 h-12 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
                <p className="text-slate-400 mb-6">You need admin privileges to access this page.</p>
                <Link href="/dashboard" className="px-6 py-3 bg-primary text-white rounded-xl">Go to Dashboard</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-4 md:p-8 pb-24 md:pb-8">
            <div className="fixed top-0 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-[150px] pointer-events-none" />

            <div className="max-w-6xl mx-auto relative z-10">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/dashboard" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
                        </svg>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
                        <p className="text-red-400">Super Admin Controls</p>
                    </div>
                </div>

                {/* Stats */}
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <div className="glass-card p-5 rounded-2xl border border-red-500/20">
                            <p className="text-3xl font-bold text-white">{stats.totalUsers}</p>
                            <p className="text-sm text-slate-400">Total Users</p>
                        </div>
                        <div className="glass-card p-5 rounded-2xl">
                            <p className="text-3xl font-bold text-white">{stats.totalEntries}</p>
                            <p className="text-sm text-slate-400">Total Entries</p>
                        </div>
                        <div className="glass-card p-5 rounded-2xl">
                            <p className="text-3xl font-bold text-green-400">{stats.newUsersThisWeek}</p>
                            <p className="text-sm text-slate-400">New This Week</p>
                        </div>
                        <div className="glass-card p-5 rounded-2xl">
                            <p className="text-3xl font-bold text-cyan-400">{stats.activeUsersToday}</p>
                            <p className="text-sm text-slate-400">Active Today</p>
                        </div>
                    </div>
                )}

                {/* Search */}
                <form onSubmit={handleSearch} className="mb-6">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Search users by name or email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                        />
                        <button type="submit" className="px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all">
                            Search
                        </button>
                    </div>
                </form>

                {/* Users Table */}
                <div className="glass-card rounded-2xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-white/5">
                            <tr>
                                <th className="text-left p-4 text-slate-400 font-medium">User</th>
                                <th className="text-left p-4 text-slate-400 font-medium hidden md:table-cell">Entries</th>
                                <th className="text-left p-4 text-slate-400 font-medium hidden md:table-cell">Role</th>
                                <th className="text-left p-4 text-slate-400 font-medium">Status</th>
                                <th className="text-right p-4 text-slate-400 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <tr key={u.id} className="border-t border-white/5 hover:bg-white/5">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold">
                                                {u.name?.charAt(0) || u.email.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-white font-medium">{u.name || 'No name'}</p>
                                                <p className="text-slate-400 text-sm">{u.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-white hidden md:table-cell">{u._count.entries}</td>
                                    <td className="p-4 hidden md:table-cell">
                                        <select
                                            value={u.role}
                                            onChange={(e) => handleChangeRole(u.id, e.target.value)}
                                            disabled={u.id === user?.id}
                                            className="bg-white/10 text-white px-3 py-1 rounded-lg border border-white/10 disabled:opacity-50"
                                        >
                                            <option value="USER">User</option>
                                            <option value="ADMIN">Admin</option>
                                            <option value="SUPERADMIN">Super Admin</option>
                                        </select>
                                    </td>
                                    <td className="p-4">
                                        {u.isBanned ? (
                                            <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm">Banned</span>
                                        ) : (
                                            <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">Active</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        {u.id !== user?.id && (
                                            <button
                                                onClick={() => handleToggleBan(u.id)}
                                                className={`px-4 py-2 rounded-lg text-sm ${u.isBanned ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'} transition-all`}
                                            >
                                                {u.isBanned ? 'Unban' : 'Ban'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex justify-center gap-2 mt-6">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-4 py-2 rounded-lg bg-white/10 text-white disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <span className="px-4 py-2 text-slate-400">Page {page} of {totalPages}</span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-4 py-2 rounded-lg bg-white/10 text-white disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
