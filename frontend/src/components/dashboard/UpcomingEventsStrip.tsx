'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { getUpcomingEvents, checkCalendarPermission, type NativeCalendarEvent } from '@/services/calendar.service';
import { hapticTap } from '@/services/haptics.service';

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatEventTime(event: NativeCalendarEvent): string {
    if (event.isAllDay) return 'All day';
    const start = new Date(event.startDate);
    const now = new Date();
    const isToday = start.toDateString() === now.toDateString();
    const isTomorrow = start.toDateString() === new Date(now.getTime() + 86400000).toDateString();

    const timeStr = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (isToday) return timeStr;
    if (isTomorrow) return `Tomorrow · ${timeStr}`;
    return `${start.toLocaleDateString([], { weekday: 'short' })} · ${timeStr}`;
}

function categoryColor(cat: NativeCalendarEvent['category']): string {
    switch (cat) {
        case 'class':   return 'rgb(var(--paper-sage))';
        case 'meeting': return 'rgb(var(--paper-ink))';
        case 'study':   return '#c08b4a';
        case 'social':  return '#9b7ec8';
        default:        return 'rgb(var(--paper-ink-soft))';
    }
}

function minsUntil(ts: number): number {
    return Math.round((ts - Date.now()) / 60000);
}

function buildEventPrompt(event: NativeCalendarEvent): string {
    const mins = minsUntil(event.startDate);
    const when = mins <= 0
        ? 'happening now'
        : mins < 60
            ? `in ${mins} min`
            : `in ${Math.round(mins / 60)}h`;
    const phrases: Record<NativeCalendarEvent['category'], string[]> = {
        class: [
            `You have "${event.title}" ${when}. What's one thing you want to actually take away from it?`,
            `Class ${when}: "${event.title}". What question do you wish you could ask?`,
        ],
        meeting: [
            `"${event.title}" is ${when}. What do you need them to understand before it starts?`,
            `Before "${event.title}" (${when}): what outcome would make it worth the time?`,
        ],
        study: [
            `Study session ${when}: "${event.title}". What part of this still feels shaky?`,
            `"${event.title}" ${when}. What would make today's session actually count?`,
        ],
        social: [
            `You've got "${event.title}" ${when}. What do you actually want from it?`,
            `"${event.title}" ${when}. Who do you want to be in that room?`,
        ],
        personal: [
            `"${event.title}" is ${when}. Anything worth noting before you go in?`,
            `Before "${event.title}": what's on your mind that you haven't said out loud yet?`,
        ],
    };
    const opts = phrases[event.category];
    return opts[Math.floor(Math.random() * opts.length)];
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
    /** Signals from parent that permission was just granted — triggers a refresh */
    refreshTrigger?: number;
}

export default function UpcomingEventsStrip({ refreshTrigger }: Props) {
    const router = useRouter();
    const [events, setEvents] = useState<NativeCalendarEvent[]>([]);
    const [ready, setReady] = useState(false);

    const load = useCallback(async () => {
        const permission = await checkCalendarPermission();
        if (permission !== 'granted') { setReady(true); return; }
        const evts = await getUpcomingEvents(48);
        setEvents(evts);
        setReady(true);
    }, []);

    useEffect(() => { load(); }, [load, refreshTrigger]);

    if (!ready || events.length === 0) return null;

    const handleTap = (event: NativeCalendarEvent) => {
        hapticTap();
        const prompt = buildEventPrompt(event);
        router.push(`/entry/new?eventPrompt=${encodeURIComponent(prompt)}`);
    };

    return (
        <section aria-label="Upcoming events">
            <p className="type-overline mb-2 px-1" style={{ color: 'rgb(var(--paper-sage))' }}>
                Coming up
            </p>
            <div className="flex flex-col gap-2">
                <AnimatePresence>
                    {events.map((event, i) => (
                        <motion.button
                            key={event.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.07, duration: 0.25 }}
                            onClick={() => handleTap(event)}
                            className="notebook-card-soft group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all active:scale-[0.98] active:opacity-80"
                            aria-label={`Journal about ${event.title}`}
                        >
                            {/* Category dot */}
                            <span
                                className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
                                style={{ background: categoryColor(event.category) }}
                                aria-hidden="true"
                            />

                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium leading-5" style={{ color: 'rgb(var(--paper-ink))' }}>
                                    {event.title}
                                </p>
                                <p className="text-xs leading-4" style={{ color: 'rgb(var(--paper-ink-soft))' }}>
                                    {formatEventTime(event)}
                                    {event.location ? ` · ${event.location}` : ''}
                                </p>
                            </div>

                            {/* Tap hint */}
                            <span
                                className="shrink-0 text-xs opacity-0 transition-opacity group-hover:opacity-100"
                                style={{ color: 'rgb(var(--paper-sage))' }}
                                aria-hidden="true"
                            >
                                Reflect →
                            </span>
                        </motion.button>
                    ))}
                </AnimatePresence>
            </div>
        </section>
    );
}
