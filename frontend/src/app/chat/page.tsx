'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import useApi from '@/hooks/use-api';
import { API_URL } from '@/constants/config';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import useContextNavigation from '@/hooks/use-context-navigation';
import { ActionBar, AppPanel, EmptyState, SectionHeader, TagPill } from '@/components/ui/surface';
import { FiArrowLeft, FiCpu, FiMessageSquare, FiSend } from 'react-icons/fi';


interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export default function ChatPage() {
    const { isLoading: authLoading, isAuthenticated } = useAuthRedirect();
    const { apiFetch } = useApi();
    const { backLabel, navigateBack } = useContextNavigation('/dashboard', 'dashboard');
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            const response = await apiFetch(`${API_URL}/ai/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: userMessage }),
            });

            if (!response.ok) throw new Error('Failed to get response');

            const data = await response.json();
            setMessages((prev) => [...prev, { role: 'assistant', content: data.response }]);
        } catch (error) {
            console.error('Chat error:', error);
            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    const suggestions = [
        'When was I last happy?',
        'What stressed me out recently?',
        'Summarize my week',
        'What are my recurring themes?',
    ];

    return (
        <div className="min-h-screen px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto max-w-5xl space-y-4">
                <AppPanel className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={navigateBack}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/[0.03] text-ink-secondary hover:text-white hover:bg-white/10 transition-colors"
                            aria-label={backLabel}
                            title={backLabel}
                        >
                            <FiArrowLeft size={20} aria-hidden="true" />
                        </button>
                        <SectionHeader
                            title="AI Coach"
                            description="Ask questions about your journal history."
                            kicker="Reflect"
                            className="items-center"
                        />
                    </div>
                    <TagPill tone="primary" className="gap-1">
                        <FiCpu size={12} aria-hidden="true" />
                        Context Aware
                    </TagPill>
                </AppPanel>

                <AppPanel className="min-h-[60vh]">
                    <div className="space-y-4">
                        {messages.length === 0 ? (
                            <EmptyState
                                title="Ask Your Journal Anything"
                                description="Use the suggestions below or type your own reflection question."
                                className="py-12"
                            />
                        ) : (
                            messages.map((message, index) => (
                                <div
                                    key={index}
                                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[84%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                                            message.role === 'user'
                                                ? 'rounded-br-sm border border-primary/30 bg-primary/15 text-white'
                                                : 'rounded-bl-sm border border-white/12 bg-white/[0.04] text-ink-secondary'
                                        }`}
                                    >
                                        <p className="whitespace-pre-wrap">{message.content}</p>
                                    </div>
                                </div>
                            ))
                        )}

                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="rounded-2xl rounded-bl-sm border border-white/12 bg-white/[0.04] px-4 py-3">
                                    <div className="flex gap-1">
                                        <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                </AppPanel>

                <ActionBar className="justify-between">
                    <div className="flex flex-wrap gap-2">
                        {suggestions.map((suggestion) => (
                            <button
                                key={suggestion}
                                type="button"
                                onClick={() => setInput(suggestion)}
                                className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs text-ink-secondary hover:text-white hover:bg-white/10 transition-colors"
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                </ActionBar>

                <AppPanel className="p-3">
                    <div className="flex gap-3">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask me anything about your journal..."
                            rows={1}
                            className="flex-1 rounded-xl border border-white/12 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-primary/35 resize-none"
                        />
                        <button
                            onClick={handleSend}
                            disabled={isLoading || !input.trim()}
                            className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/15 px-5 py-3 text-sm font-semibold text-white hover:bg-primary/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <FiSend size={16} aria-hidden="true" />
                            Send
                        </button>
                    </div>
                </AppPanel>
            </div>
        </div>
    );
}

