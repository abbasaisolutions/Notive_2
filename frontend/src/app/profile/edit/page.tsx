'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export default function ProfileEditPage() {
    const router = useRouter();
    const { user, accessToken, isLoading: authLoading, refreshUser } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [bio, setBio] = useState('');
    const [location, setLocation] = useState('');
    const [occupation, setOccupation] = useState('');
    const [website, setWebsite] = useState('');
    const [lifeGoals, setLifeGoals] = useState<string>(''); // Comma separated for input    
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        if (user) {
            setName(user.name || '');
            setEmail(user.email || '');
            if (user.profile) {
                setBio(user.profile.bio || '');
                setLocation(user.profile.location || '');
                setOccupation(user.profile.occupation || '');
                setWebsite(user.profile.website || '');
                setLifeGoals(user.profile.lifeGoals ? user.profile.lifeGoals.join(', ') : '');
            }
        }
    }, [user]);

    const handleSaveProfile = async () => {
        setIsSaving(true);
        setMessage(null);

        try {
            const response = await fetch(`${API_URL}/user/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    name,
                    email,
                    bio,
                    location,
                    occupation,
                    website,
                    lifeGoals: lifeGoals.split(',').map(s => s.trim()).filter(Boolean)
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to update profile');
            }

            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            if (refreshUser) await refreshUser();
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'Passwords do not match' });
            return;
        }

        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
            return;
        }

        setIsChangingPassword(true);
        setMessage(null);

        try {
            const response = await fetch(`${API_URL}/user/password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ currentPassword, newPassword }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to change password');
            }

            setMessage({ type: 'success', text: 'Password changed successfully!' });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setIsChangingPassword(false);
        }
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
        <div className="min-h-screen p-4 md:p-8 pb-24 md:pb-8">
            <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[150px] pointer-events-none" />

            <div className="max-w-2xl mx-auto relative z-10">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/profile" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
                        </svg>
                    </Link>
                    <h1 className="text-3xl font-bold text-white">Edit Profile</h1>
                </div>

                {/* Message */}
                {message && (
                    <div className={`mb-6 p-4 rounded-xl ${message.type === 'success' ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
                        {message.text}
                    </div>
                )}

                {/* Profile Form */}
                <div className="glass-card p-6 rounded-2xl mb-6">
                    <h3 className="text-lg font-bold text-white mb-4">Profile Information</h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Occupation</label>
                            <input
                                type="text"
                                value={occupation}
                                onChange={(e) => setOccupation(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="Student, Engineer, Artist..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Location</label>
                            <input
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="City, Country"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Bio</label>
                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[100px]"
                                placeholder="Tell us a bit about yourself..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Life Goals (comma separated)</label>
                            <input
                                type="text"
                                value={lifeGoals}
                                onChange={(e) => setLifeGoals(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="Learn French, Run a Marathon, Read 50 books..."
                            />
                        </div>
                        <button
                            onClick={handleSaveProfile}
                            disabled={isSaving}
                            className="w-full px-4 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSaving ? (
                                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                            ) : (
                                'Save Changes'
                            )}
                        </button>
                    </div>
                </div>

                {/* Password Form */}
                <div className="glass-card p-6 rounded-2xl">
                    <h3 className="text-lg font-bold text-white mb-4">Change Password</h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Current Password</label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="Leave empty if using Google"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-2">New Password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Confirm New Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                        <button
                            onClick={handleChangePassword}
                            disabled={isChangingPassword}
                            className="w-full px-4 py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isChangingPassword ? (
                                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                            ) : (
                                'Change Password'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
