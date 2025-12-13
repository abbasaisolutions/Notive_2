'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface Entry {
    id: string;
    title: string | null;
    mood: string | null;
    createdAt: string;
}

const MOOD_COLORS: Record<string, string> = {
    happy: '#22c55e',
    calm: '#06b6d4',
    sad: '#6366f1',
    anxious: '#f59e0b',
    frustrated: '#ef4444',
    thoughtful: '#8b5cf6',
    motivated: '#ec4899',
    tired: '#64748b',
};

export default function CalendarPage() {
    const router = useRouter();
    const { user, accessToken, isLoading: authLoading } = useAuth();
    const [entries, setEntries] = useState<Entry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => {
        const fetchEntries = async () => {
            if (!accessToken) return;

            try {
                const response = await fetch(`${API_URL}/entries?limit=100`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (response.ok) {
                    const data = await response.json();
                    setEntries(data.entries);
                }
            } catch (error) {
                console.error('Failed to fetch entries:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchEntries();
    }, [accessToken]);

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

    // Calendar logic
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthName = currentDate.toLocaleString('default', { month: 'long' });

    const days = [];
    for (let i = 0; i < firstDay; i++) {
        days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(i);
    }

    // Get entries by date
    const entriesByDate: Record<string, Entry[]> = {};
    entries.forEach((entry) => {
        const date = new Date(entry.createdAt).toDateString();
        if (!entriesByDate[date]) entriesByDate[date] = [];
        entriesByDate[date].push(entry);
    });

    const goToPrevMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1));
    };

    const goToNextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1));
    };

    // "On This Day" - entries from this day in previous years
    const today = new Date();
    const onThisDay = entries.filter((entry) => {
        const entryDate = new Date(entry.createdAt);
        return (
            entryDate.getMonth() === today.getMonth() &&
            entryDate.getDate() === today.getDate() &&
            entryDate.getFullYear() !== today.getFullYear()
        );
    });

    return (
        <div className="min-h-screen p-4 md:p-8 pb-24 md:pb-8">
            <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[150px] pointer-events-none" />

            <div className="max-w-4xl mx-auto relative z-10">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/dashboard" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
                        </svg>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-white">Calendar</h1>
                        <p className="text-slate-400">Your journaling timeline</p>
                    </div>
                </div>

                {/* On This Day */}
                {onThisDay.length > 0 && (
                    <div className="glass-card p-6 rounded-2xl mb-6 border border-primary/30">
                        <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                            <span>✨</span> On This Day
                        </h2>
                        <div className="space-y-2">
                            {onThisDay.map((entry) => (
                                <Link
                                    key={entry.id}
                                    href={`/entry/view?id=${entry.id}`}
                                    className="block p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all"
                                >
                                    <p className="text-slate-400 text-sm">
                                        {new Date(entry.createdAt).getFullYear()}
                                    </p>
                                    <p className="text-white">{entry.title || 'Untitled Entry'}</p>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Calendar */}
                <div className="glass-card p-6 rounded-2xl">
                    {/* Month Navigation */}
                    <div className="flex items-center justify-between mb-6">
                        <button onClick={goToPrevMonth} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m15 18-6-6 6-6" />
                            </svg>
                        </button>
                        <h2 className="text-xl font-bold text-white">{monthName} {year}</h2>
                        <button onClick={goToNextMonth} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m9 18 6-6-6-6" />
                            </svg>
                        </button>
                    </div>

                    {/* Day Headers */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                            <div key={day} className="text-center text-sm text-slate-500 py-2">{day}</div>
                        ))}
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {days.map((day, index) => {
                            if (day === null) {
                                return <div key={`empty-${index}`} className="aspect-square" />;
                            }

                            const date = new Date(year, month, day);
                            const dateStr = date.toDateString();
                            const dayEntries = entriesByDate[dateStr] || [];
                            const isToday = dateStr === today.toDateString();
                            const hasMood = dayEntries.some((e) => e.mood);
                            const moodColor = hasMood ? MOOD_COLORS[dayEntries[0].mood || ''] : null;

                            return (
                                <div
                                    key={day}
                                    className={`aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all cursor-pointer
                                        ${isToday ? 'bg-primary text-white' : dayEntries.length > 0 ? 'bg-white/10 hover:bg-white/20' : 'hover:bg-white/5'}
                                    `}
                                    onClick={() => dayEntries.length > 0 && router.push(`/entry/view?id=${dayEntries[0].id}`)}
                                >
                                    <span className={`text-sm ${isToday ? 'font-bold' : dayEntries.length > 0 ? 'text-white' : 'text-slate-500'}`}>{day}</span>
                                    {dayEntries.length > 0 && (
                                        <div className="flex gap-0.5 mt-1">
                                            {dayEntries.slice(0, 3).map((_, i) => (
                                                <div
                                                    key={i}
                                                    className="w-1.5 h-1.5 rounded-full"
                                                    style={{ backgroundColor: moodColor || '#6366f1' }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
