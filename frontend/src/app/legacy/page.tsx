'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import InsightCard from '@/components/insights/InsightCard';
import { FileText } from 'lucide-react';

export default function LegacyPage() {
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
            <div className="flex items-center gap-4 mb-3">
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] uppercase tracking-[0.2em] font-bold border border-primary/20">
                    Life Manifesto
                </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-serif mb-4 leading-tight">Your profound essence.</h1>
            <p className="zen-text text-lg max-w-lg">Crystallized from your living chronicles, synthesized by intelligence.</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Skills Section */}
                <div>
                    <h2 className="text-xl font-serif mb-6 flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">⚡</span>
                        Crystallized Strengths
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
                    <h2 className="text-xl font-serif mb-6 flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-sm">
                            <FileText className="w-4 h-4" />
                        </span>
                        Synthesized Mission
                    </h2>

                    <div className="bento-box p-10 border border-indigo-500/20 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 blur-[80px] rounded-full pointer-events-none group-hover:bg-indigo-600/20 transition-all duration-700" />

                        {statement ? (
                            <div className="relative z-10">
                                <p className="text-2xl md:text-3xl text-slate-100 leading-relaxed font-serif italic text-center px-4">
                                    "{statement}"
                                </p>
                                <div className="mt-8 flex justify-center gap-4">
                                    <button
                                        onClick={() => navigator.clipboard.writeText(statement)}
                                        className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-indigo-400 flex items-center gap-2 transition-all border border-indigo-500/10"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
                                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                                        </svg>
                                        Copy Manifesto
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-slate-500 py-10 relative z-10">
                                <p>The oracle is silent. Continue your chronicles to synthesize your mission.</p>
                            </div>
                        )}
                    </div>

                    {/* Future Vault Placeholder */}
                    <div className="bento-box p-8 border border-white/5 bg-gradient-to-br from-white/5 to-transparent">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-serif text-white flex items-center gap-3">
                                <span className="text-primary tracking-widest text-[10px] uppercase font-bold px-2 py-1 rounded bg-primary/10">Vault</span>
                                Perspectives in Time
                            </h3>
                            <span className="px-2 py-1 rounded-md bg-white/5 text-[9px] text-slate-500 uppercase tracking-widest font-bold">Safeguarded</span>
                        </div>
                        <p className="zen-text text-sm mb-6">Messages sent across time to your future self, locked until specific life milestones.</p>
                        <button className="w-full py-4 rounded-2xl border border-dashed border-white/10 text-slate-500 hover:text-white hover:border-white/30 transition-all text-xs font-bold uppercase tracking-widest">
                            + Secure a New Perspective
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
