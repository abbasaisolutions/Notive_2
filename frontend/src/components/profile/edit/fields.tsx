'use client';

import React from 'react';
import { FiAlertTriangle, FiCheck } from 'react-icons/fi';
import type { Notice, TagInputProps } from './types';

export function TagInput({
    label,
    values,
    draft,
    placeholder,
    helper,
    onDraftChange,
    onAdd,
    onRemove,
}: TagInputProps) {
    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            onAdd();
        }
    };

    return (
        <div className="space-y-2">
            <label className="workspace-field-label ml-1">{label}</label>
            <div className="workspace-soft-panel w-full rounded-[1.2rem] px-3 py-3 space-y-3">
                {values.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {values.map((item) => (
                            <span
                                key={item}
                                className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-primary"
                            >
                                {item}
                                <button
                                    type="button"
                                    onClick={() => onRemove(item)}
                                    className="text-primary/80 hover:text-primary transition-colors"
                                    aria-label={`Remove ${item}`}
                                >
                                    x
                                </button>
                            </span>
                        ))}
                    </div>
                )}
                <input
                    type="text"
                    value={draft}
                    onChange={(event) => onDraftChange(event.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={onAdd}
                    className="workspace-input-plain w-full px-2 py-1 focus:outline-none"
                    placeholder={placeholder}
                />
            </div>
            {helper && <p className="workspace-field-helper ml-1">{helper}</p>}
        </div>
    );
}

export function TextField({
    label,
    value,
    onChange,
    placeholder,
    type = 'text',
    helper,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: 'text' | 'email' | 'url' | 'password' | 'tel' | 'date';
    helper?: string;
}) {
    return (
        <div className="space-y-2">
            <label className="workspace-field-label ml-1">{label}</label>
            <input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="workspace-input w-full rounded-[1.2rem] px-5 py-4 focus:outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10 transition-all"
                placeholder={placeholder}
            />
            {helper && <p className="workspace-field-helper ml-1">{helper}</p>}
        </div>
    );
}

export function TextAreaField({
    label,
    value,
    onChange,
    placeholder,
    helper,
    minHeight = 120,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    helper?: string;
    minHeight?: number;
}) {
    return (
        <div className="space-y-2">
            <label className="workspace-field-label ml-1">{label}</label>
            <textarea
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="workspace-input w-full resize-none rounded-[1.2rem] px-5 py-4 focus:outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10 transition-all"
                placeholder={placeholder}
                style={{ minHeight }}
            />
            {helper && <p className="workspace-field-helper ml-1">{helper}</p>}
        </div>
    );
}

export function SelectField({
    label,
    value,
    onChange,
    options,
    emptyLabel = 'Not set',
    helper,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
    emptyLabel?: string;
    helper?: string;
}) {
    return (
        <div className="space-y-2">
            <label className="workspace-field-label ml-1">{label}</label>
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="workspace-input w-full rounded-[1.2rem] px-4 py-4 focus:outline-none focus:border-primary/40"
            >
                <option value="">{emptyLabel}</option>
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            {helper && <p className="workspace-field-helper ml-1">{helper}</p>}
        </div>
    );
}

export function NoticeBanner({ notice }: { notice: Notice }) {
    return (
        <div
            className={`rounded-[1.4rem] border px-5 py-4 ${
                notice.type === 'success'
                    ? 'border-primary/25 bg-primary/10 text-[rgb(var(--text-primary))]'
                    : 'workspace-soft-panel text-[rgb(var(--text-primary))]'
            }`}
        >
            <div className="flex items-start gap-3">
                <span className="mt-0.5 text-lg">
                    {notice.type === 'success' ? <FiCheck size={18} aria-hidden="true" /> : <FiAlertTriangle size={18} aria-hidden="true" />}
                </span>
                <p className="text-sm font-medium">{notice.text}</p>
            </div>
        </div>
    );
}
