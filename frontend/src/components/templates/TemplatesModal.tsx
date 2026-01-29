'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Calendar, Heart, MessageSquare, Moon, PenLine, Target } from 'lucide-react';

interface Template {
    id: string;
    name: string;
    icon: LucideIcon;
    description: string;
    prompts: string[];
}

const TEMPLATES: Template[] = [
    {
        id: 'gratitude',
        name: 'Gratitude',
        icon: Heart,
        description: 'Focus on what you\'re thankful for',
        prompts: [
            '3 things I\'m grateful for today:',
            '1.',
            '2.',
            '3.',
            '',
            'Someone who made my day better:',
            '',
            'A small win I\'m celebrating:',
        ],
    },
    {
        id: 'reflection',
        name: 'Daily Reflection',
        icon: Moon,
        description: 'End-of-day thoughts and insights',
        prompts: [
            'How am I feeling right now?',
            '',
            'The best part of today was:',
            '',
            'One thing I learned:',
            '',
            'Tomorrow I want to:',
        ],
    },
    {
        id: 'goals',
        name: 'Goals & Intentions',
        icon: Target,
        description: 'Plan and track your progress',
        prompts: [
            'My main focus today:',
            '',
            'Three priorities:',
            '☐ ',
            '☐ ',
            '☐ ',
            '',
            'What success looks like:',
        ],
    },
    {
        id: 'freewrite',
        name: 'Free Write',
        icon: PenLine,
        description: 'Just let it flow',
        prompts: [],
    },
    {
        id: 'mood',
        name: 'Mood Check-In',
        icon: MessageSquare,
        description: 'Explore your emotions',
        prompts: [
            'Current mood (1-10):',
            '',
            'What\'s contributing to this feeling?',
            '',
            'One thing I can do to feel better:',
            '',
            'Someone I can talk to:',
        ],
    },
    {
        id: 'weekly',
        name: 'Weekly Review',
        icon: Calendar,
        description: 'Reflect on your week',
        prompts: [
            'Highlight of the week:',
            '',
            'Challenges I faced:',
            '',
            'What I\'m proud of:',
            '',
            'Focus for next week:',
        ],
    },
];

interface TemplatesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (content: string) => void;
}

export default function TemplatesModal({ isOpen, onClose, onSelect }: TemplatesModalProps) {
    if (!isOpen) return null;

    const handleSelect = (template: Template) => {
        const content = template.prompts.join('\n');
        onSelect(content);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="glass-card p-6 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white">Choose a Template</h2>
                    <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                        </svg>
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    {TEMPLATES.map((template) => (
                        <button
                            key={template.id}
                            onClick={() => handleSelect(template)}
                            className="p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-left group"
                        >
                            <template.icon className="w-7 h-7 mb-2 text-white" />
                            <h3 className="text-white font-medium group-hover:text-primary transition-colors">{template.name}</h3>
                            <p className="text-slate-400 text-sm">{template.description}</p>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
