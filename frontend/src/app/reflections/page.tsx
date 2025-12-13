'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import InsightCard from '@/components/insights/InsightCard';

export default function ReflectionsPage() {
    const { user, accessToken } = useAuth();
    const [skills, setSkills] = useState<string[]>([]);
    const [statement, setStatement] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchInsights = async () => {
            if (!accessToken) return;
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/ai/statement`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });

                if (response.ok) {
                    const data = await response.json();
                    setSkills(data.topSkills);
                    setStatement(data.statement);
                }
            } catch (error) {
                console.error('Failed to fetch insights:', error);
            } finally {
                setIsLoading(false);
            }
        };

        if (user) fetchInsights();
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
                <h1 className="text-3xl font-bold text-white mb-2">Personal Growth</h1>
                <p className="text-slate-400">Your accumulated skills and professional narrative.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Skills Section */}
                <div>
                    <h2 className="text-xl font-bold text-emerald-400 mb-4 flex items-center gap-2">
                        <span className="p-2 rounded-lg bg-emerald-500/20">⚡</span>
                        Top Skills Verified
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {skills.length > 0 ? (
                            skills.map((skill, i) => (
                                <InsightCard
                                    key={skill}
                                    type="skill"
                                    text={skill}
                                    delay={i * 0.1}
                                />
                            ))
                        ) : (
                            <div className="col-span-2 glass-card p-6 rounded-xl text-center text-slate-500">
                                <p>No skills detected yet. Keep writing focused entries!</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Personal Statement Section */}
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-indigo-400 mb-4 flex items-center gap-2">
                        <span className="p-2 rounded-lg bg-indigo-500/20">📄</span>
                        Personal Statement Draft
                    </h2>

                    <div className="glass-card p-8 rounded-2xl border border-indigo-500/20 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 blur-[80px] rounded-full pointer-events-none" />

                        {statement ? (
                            <div className="relative z-10">
                                <p className="text-lg text-slate-200 leading-loose italic font-serif">
                                    "{statement}"
                                </p>
                                <div className="mt-6 flex justify-end">
                                    <button
                                        onClick={() => navigator.clipboard.writeText(statement)}
                                        className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-2 transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
                                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                                        </svg>
                                        Copy to Clipboard
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-slate-500 py-10 relative z-10">
                                <p>Not enough data to generate a statement yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
