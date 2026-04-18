'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { FiBookOpen, FiChevronRight } from 'react-icons/fi';

const STORAGE_KEY = 'notive_review_banner_dismissed_month';
const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const getDismissKey = (): string => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth()}`;
};

const shouldShow = (totalEntries: number): boolean => {
    if (typeof window === 'undefined') return false;
    const now = new Date();
    const day = now.getDate();
    if (day > 7) return false;
    if (totalEntries < 5) return false;
    try {
        const dismissed = window.localStorage.getItem(STORAGE_KEY);
        if (dismissed === getDismissKey()) return false;
    } catch {
        // ignore storage errors
    }
    return true;
};

export default function ReviewBanner({ totalEntries }: { totalEntries: number }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        setVisible(shouldShow(totalEntries));
    }, [totalEntries]);

    const handleDismiss = () => {
        setVisible(false);
        try {
            window.localStorage.setItem(STORAGE_KEY, getDismissKey());
        } catch {
            // ignore storage errors
        }
    };

    if (!visible) return null;

    const lastMonthIndex = (new Date().getMonth() + 11) % 12;
    const lastMonthName = MONTH_NAMES[lastMonthIndex];

    return (
        <div className="notebook-card-soft relative rounded-2xl p-4">
            <button
                type="button"
                onClick={handleDismiss}
                className="notebook-muted absolute right-3 top-3 rounded-full px-2 py-1 text-[0.7rem] transition-opacity hover:opacity-70"
                style={{ color: 'rgb(155 143 120)' }}
                aria-label="Dismiss this month in review banner"
            >
                Hide
            </button>
            <div className="flex items-start gap-3 pr-12">
                <div className="mt-1 shrink-0" style={{ color: 'rgb(var(--brand-strong))' }}>
                    <FiBookOpen size={18} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                    <p
                        className="section-label"
                        style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)' }}
                    >
                        Your {lastMonthName} is ready
                    </p>
                    <p className="notebook-copy mt-1 text-sm leading-relaxed" style={{ color: 'rgb(var(--paper-ink))' }}>
                        A gentle recap of what you wrote, felt, and came back to.
                    </p>
                    <Link
                        href="/review"
                        className="mt-3 inline-flex items-center gap-1 text-sm font-semibold transition-opacity hover:opacity-80"
                        style={{ color: 'rgb(var(--brand-strong))' }}
                    >
                        <span>Open review</span>
                        <FiChevronRight size={14} aria-hidden="true" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
