'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface InsightCardProps {
    type: 'lesson' | 'skill';
    text: string;
    delay?: number;
}

export default function InsightCard({ type, text, delay = 0 }: InsightCardProps) {
    const isLesson = type === 'lesson';

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay, duration: 0.4 }}
            className={`
                relative p-4 rounded-xl border backdrop-blur-md overflow-hidden group hover:scale-[1.02] transition-transform
                ${isLesson
                    ? 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20'
                    : 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20'
                }
            `}
        >
            {/* Icon Background */}
            <div className={`
                absolute -right-4 -bottom-4 w-20 h-20 rounded-full opacity-10
                ${isLesson ? 'bg-amber-500' : 'bg-emerald-500'}
            `} />

            <div className="flex items-start gap-3 relative z-10">
                <div className={`
                    w-8 h-8 rounded-lg flex items-center justify-center text-lg shadow-lg
                    ${isLesson ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}
                `}>
                    {isLesson ? '💡' : '⚡'}
                </div>
                <div>
                    <h4 className={`text-xs font-bold uppercase tracking-wider mb-1 ${isLesson ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {isLesson ? 'Lesson Learned' : 'Skill Acquired'}
                    </h4>
                    <p className="text-sm text-slate-200 font-medium leading-relaxed">
                        {text}
                    </p>
                </div>
            </div>

            {/* Shine effect */}
            <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12" />
        </motion.div>
    );
}
