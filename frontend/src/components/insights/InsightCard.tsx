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
            className="workspace-soft-panel relative p-4 rounded-xl overflow-hidden group hover:scale-[1.02] transition-transform"
        >
            {/* Icon Background */}
            <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full opacity-10 bg-primary" />

            <div className="flex items-start gap-3 relative z-10">
                <div className="workspace-pill w-8 h-8 rounded-lg flex items-center justify-center text-lg shadow-sm text-ink-secondary">
                    {isLesson ? <FiFeather size={16} aria-hidden="true" /> : <FiZap size={16} aria-hidden="true" />}
                </div>
                <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider mb-1 text-ink-secondary">
                        {isLesson ? 'Lesson Learned' : 'Skill Acquired'}
                    </h4>
                    <p className="text-sm workspace-heading font-medium leading-relaxed">
                        {text}
                    </p>
                </div>
            </div>

            {/* Shine effect */}
            <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12" />
        </motion.div>
    );
}
