'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { FiFeather, FiZap } from 'react-icons/fi';

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
                    ? 'bg-zinc-500/10 border-zinc-500/20 hover:bg-zinc-500/20'
                    : 'bg-white/[0.03] border-white/15 hover:bg-white/[0.07]'
                }
            `}
        >
            {/* Icon Background */}
            <div className={`
                absolute -right-4 -bottom-4 w-20 h-20 rounded-full opacity-10
                ${isLesson ? 'bg-zinc-500' : 'bg-primary'}
            `} />

            <div className="flex items-start gap-3 relative z-10">
                <div className={`
                    w-8 h-8 rounded-lg flex items-center justify-center text-lg shadow-lg
                    ${isLesson ? 'bg-zinc-500/20 text-zinc-300' : 'bg-white/[0.07] text-ink-secondary'}
                `}>
                    {isLesson ? <FiFeather size={16} aria-hidden="true" /> : <FiZap size={16} aria-hidden="true" />}
                </div>
                <div>
                    <h4 className={`text-xs font-bold uppercase tracking-wider mb-1 ${isLesson ? 'text-zinc-300' : 'text-ink-secondary'}`}>
                        {isLesson ? 'Lesson Learned' : 'Skill Acquired'}
                    </h4>
                    <p className="text-sm text-white font-medium leading-relaxed">
                        {text}
                    </p>
                </div>
            </div>

            {/* Shine effect */}
            <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12" />
        </motion.div>
    );
}
