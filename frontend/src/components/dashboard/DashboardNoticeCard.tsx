'use client';

import React from 'react';
import { motion } from 'framer-motion';

type DashboardNoticeCardProps = {
    title: string;
    body: string;
    eyebrow?: string;
    compact?: boolean;
};

export default function DashboardNoticeCard({
    title,
    body,
    eyebrow = 'Getting ready',
    compact = false,
}: DashboardNoticeCardProps) {
    return (
        <motion.section
            className={`notebook-card-soft rounded-3xl border border-dashed ${
                compact ? 'px-4 py-3' : 'px-5 py-4'
            }`}
            style={{ borderColor: 'rgba(var(--paper-border), 0.45)' }}
        >
            <p className="notebook-muted text-[0.65rem] font-medium uppercase tracking-[0.16em]">
                {eyebrow}
            </p>
            <p
                className={`mt-1 font-semibold ${compact ? 'text-sm' : 'text-[0.98rem]'}`}
                style={{ color: 'rgb(var(--paper-ink))' }}
            >
                {title}
            </p>
            <p className="notebook-copy mt-1 text-sm" style={{ color: 'rgb(var(--paper-ink-soft))' }}>
                {body}
            </p>
        </motion.section>
    );
}
