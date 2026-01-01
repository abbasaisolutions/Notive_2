'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { FadeIn, SlideUp, StaggerContainer } from '@/components/ui/animated-wrappers';
import { motion, AnimatePresence } from 'framer-motion';

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

    const [activeTab, setActiveTab] = useState<'essence' | 'account' | 'preferences' | 'data'>('essence');

    return (
        <div className="min-h-screen p-6 md:p-12 relative z-10">
            <FadeIn className="max-w-4xl mx-auto space-y-8 mt-4">

                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
                    <div className="flex items-center gap-6">
                        <Link href="/profile" className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
                            </svg>
                        </Link>
                        <h1 className="text-4xl font-serif text-white tracking-tight">Edit Profile</h1>
                    </div>
                </header>

                {/* Status Message */}
                <AnimatePresence mode='wait'>
                    {message && (
                        <motion.div
                            initial={{ opacity: 0, y: -20, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: 'auto' }}
                            exit={{ opacity: 0, y: -20, height: 0 }}
                            className={`p-4 rounded-2xl bento-box border-none ${message.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-lg">{message.type === 'success' ? '✨' : '⚠️'}</span>
                                <p className="text-sm font-bold tracking-wide uppercase italic">{message.text}</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Tabs Navigation */}
                <SlideUp delay={0.1} className="flex flex-wrap gap-2 p-1 bg-white/5 border border-white/5 rounded-[1.5rem] backdrop-blur-xl">
                    {[
                        { id: 'essence', label: 'Profile', icon: '👤' },
                        { id: 'account', label: 'Security', icon: '🛡️' },
                        { id: 'preferences', label: 'Preferences', icon: '⚙️' },
                        { id: 'data', label: 'Data', icon: '📦' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold tracking-widest transition-all ${activeTab === tab.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                        >
                            <span>{tab.icon}</span>
                            <span className="hidden sm:inline uppercase">{tab.label}</span>
                        </button>
                    ))}
                </SlideUp>

                {/* Tab Content */}
                <div className="min-h-[600px] relative">
                    <AnimatePresence mode='wait'>
                        {activeTab === 'essence' && (
                            <motion.div
                                key="essence"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.3 }}
                                className="bento-box p-8 space-y-8 absolute inset-0 w-full"
                            >
                                <div className="space-y-6">
                                    <h3 className="text-2xl font-serif">General Info</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold ml-1">Name</label>
                                            <input
                                                type="text"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                className="w-full px-5 py-4 rounded-[1.2rem] bg-white/5 border border-white/5 text-white placeholder-slate-600 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-mono"
                                                placeholder="Your full name"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold ml-1">Email</label>
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="w-full px-5 py-4 rounded-[1.2rem] bg-white/5 border border-white/5 text-white placeholder-slate-600 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-mono"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold ml-1">Job Title</label>
                                            <input
                                                type="text"
                                                value={occupation}
                                                onChange={(e) => setOccupation(e.target.value)}
                                                className="w-full px-5 py-4 rounded-[1.2rem] bg-white/5 border border-white/5 text-white placeholder-slate-600 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold ml-1">Location</label>
                                            <input
                                                type="text"
                                                value={location}
                                                onChange={(e) => setLocation(e.target.value)}
                                                className="w-full px-5 py-4 rounded-[1.2rem] bg-white/5 border border-white/5 text-white placeholder-slate-600 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold ml-1">Life Goals</label>
                                            <input
                                                type="text"
                                                value={lifeGoals}
                                                onChange={(e) => setLifeGoals(e.target.value)}
                                                className="w-full px-5 py-4 rounded-[1.2rem] bg-white/5 border border-white/5 text-white placeholder-slate-600 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all"
                                                placeholder="Learn French, Run a Marathon..."
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold ml-1">Bio</label>
                                        <textarea
                                            value={bio}
                                            onChange={(e) => setBio(e.target.value)}
                                            className="w-full px-5 py-4 rounded-[1.2rem] bg-white/5 border border-white/5 text-white placeholder-slate-600 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all min-h-[120px] resize-none zen-text"
                                            placeholder="A short description about yourself..."
                                        />
                                    </div>
                                </div>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleSaveProfile}
                                    disabled={isSaving}
                                    className="w-full bg-primary hover:bg-primary/90 text-white py-5 rounded-[1.5rem] font-bold uppercase tracking-[0.2em] shadow-xl shadow-primary/20 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                                >
                                    {isSaving ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> : 'Save Changes'}
                                </motion.button>
                            </motion.div>
                        )}

                        {activeTab === 'account' && (
                            <motion.div
                                key="account"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.3 }}
                                className="bento-box p-8 space-y-8 absolute inset-0 w-full"
                            >
                                <h3 className="text-2xl font-serif">Password & Security</h3>
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold ml-1">Current Password</label>
                                            <input
                                                type="password"
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                className="w-full px-5 py-4 rounded-[1.2rem] bg-white/5 border border-white/5 text-white focus:outline-none focus:border-primary/50 transition-all font-mono"
                                                placeholder="Enter existing password"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold ml-1">New Password</label>
                                                <input
                                                    type="password"
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    className="w-full px-5 py-4 rounded-[1.2rem] bg-white/5 border border-white/5 text-white focus:outline-none focus:border-primary/50 transition-all font-mono"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold ml-1">Confirm Password</label>
                                                <input
                                                    type="password"
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    className="w-full px-5 py-4 rounded-[1.2rem] bg-white/5 border border-white/5 text-white focus:outline-none focus:border-primary/50 transition-all font-mono"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={handleChangePassword}
                                        disabled={isChangingPassword}
                                        className="w-full bg-white/5 hover:bg-white/10 text-white py-5 rounded-[1.5rem] font-bold uppercase tracking-[0.2em] border border-white/10 transition-all flex items-center justify-center gap-3"
                                    >
                                        {isChangingPassword ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> : 'Update Password'}
                                    </motion.button>

                                    <div className="pt-8 border-t border-white/5">
                                        <h4 className="text-red-400 font-bold text-xs uppercase tracking-widest mb-4 ml-1">Danger Zone</h4>
                                        <button className="text-red-400/60 hover:text-red-400 text-sm italic transition-all">
                                            Delete Account
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'preferences' && (
                            <motion.div
                                key="preferences"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.3 }}
                                className="bento-box p-8 space-y-8 absolute inset-0 w-full"
                            >
                                <h3 className="text-2xl font-serif">Preferences</h3>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-6 rounded-3xl bg-white/5 border border-white/5 group hover:bg-white/10 transition-all">
                                        <div className="space-y-1">
                                            <p className="text-white font-bold tracking-wide">Sync Alerts</p>
                                            <p className="text-xs text-slate-500 italic">Receive daily journal reminders.</p>
                                        </div>
                                        <div className="w-12 h-7 bg-primary rounded-full relative p-1 cursor-pointer">
                                            <div className="w-5 h-5 bg-white rounded-full ml-auto" />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between p-6 rounded-3xl bg-white/5 border border-white/5 group hover:bg-white/10 transition-all opacity-50 cursor-not-allowed">
                                        <div className="space-y-1">
                                            <p className="text-white font-bold tracking-wide">Private Mode</p>
                                            <p className="text-xs text-slate-500 italic">Hide your profile from public search.</p>
                                        </div>
                                        <div className="w-12 h-7 bg-slate-700 rounded-full relative p-1">
                                            <div className="w-5 h-5 bg-white rounded-full" />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'data' && (
                            <motion.div
                                key="data"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.3 }}
                                className="bento-box p-8 space-y-8 absolute inset-0 w-full"
                            >
                                <h3 className="text-2xl font-serif">Data & Archive</h3>
                                <p className="zen-text text-slate-300">Your chronicles belong to you. Choose how you wish to preserve your digital legacy.</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <motion.button whileHover={{ scale: 1.05 }} className="p-6 rounded-3xl bg-white/5 border border-white/5 text-left hover:bg-primary/10 hover:border-primary/20 transition-all group">
                                        <span className="block text-2xl mb-3 group-hover:scale-110 transition-transform">📄</span>
                                        <p className="text-white font-bold mb-1">Export PDF Volume</p>
                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold font-mono">Archive for printing</p>
                                    </motion.button>
                                    <motion.button whileHover={{ scale: 1.05 }} className="p-6 rounded-3xl bg-white/5 border border-white/5 text-left hover:bg-primary/10 hover:border-primary/20 transition-all group">
                                        <span className="block text-2xl mb-3 group-hover:scale-110 transition-transform">📊</span>
                                        <p className="text-white font-bold mb-1">Export JSON Matrix</p>
                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold font-mono">Developer/Backup format</p>
                                    </motion.button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </FadeIn>
        </div>
    );
}
