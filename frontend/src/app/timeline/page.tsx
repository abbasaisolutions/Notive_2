'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import TimelineView from '@/components/timeline/TimelineView';

export default function TimelinePage() {
    const { user, accessToken } = useAuth();
    const [entries, setEntries] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchEntries = async () => {
            if (!accessToken) return;
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/entries`, {
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

        if (user) fetchEntries();
    }, [user, accessToken]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 min-h-screen">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Your Journey</h1>
                <p className="text-slate-400">A visual timeline of your memories and growth.</p>
            </header>

            <TimelineView entries={entries} />
        </div>
    );
}
