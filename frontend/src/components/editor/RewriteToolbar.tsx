'use client';

import React, { useState } from 'react';
import { rewriteService, REWRITE_OPTIONS, RewriteStyle, RewriteOption } from '@/services/rewrite.service';
import { useAuth } from '@/context/auth-context';
import { 
    Sparkles, 
    FileText, 
    Lightbulb, 
    Briefcase,
    MessageCircle,
    Heart,
    ChevronDown,
    Check,
    X,
    RotateCcw,
    ArrowDown,
    Loader2,
    Wand2
} from 'lucide-react';

interface RewriteToolbarProps {
    content: string;
    onRewrite: (newContent: string) => void;
    disabled?: boolean;
}

// Icon mapping for rewrite options
const getOptionIcon = (iconName: RewriteOption['iconName']) => {
    const iconClass = "w-4 h-4";
    switch (iconName) {
        case 'sparkles':
            return <Sparkles className={iconClass} />;
        case 'fileText':
            return <FileText className={iconClass} />;
        case 'lightbulb':
            return <Lightbulb className={iconClass} />;
        case 'briefcase':
            return <Briefcase className={iconClass} />;
        case 'messageCircle':
            return <MessageCircle className={iconClass} />;
        case 'heart':
            return <Heart className={iconClass} />;
        default:
            return <Sparkles className={iconClass} />;
    }
};

export default function RewriteToolbar({ content, onRewrite, disabled }: RewriteToolbarProps) {
    const { accessToken } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [activeStyle, setActiveStyle] = useState<RewriteStyle | null>(null);
    const [previewContent, setPreviewContent] = useState<string | null>(null);
    const [originalContent, setOriginalContent] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleRewrite = async (style: RewriteStyle) => {
        if (!content.trim() || !accessToken) {
            setError('Please write some content first');
            return;
        }

        setIsLoading(true);
        setActiveStyle(style);
        setError(null);
        setOriginalContent(content);

        try {
            const result = await rewriteService.rewriteText(content, style, accessToken);
            setPreviewContent(result.rewritten);
            setIsOpen(false);
        } catch (err: any) {
            console.error('Rewrite failed:', err);
            setError(err.message || 'Failed to rewrite text');
            setPreviewContent(null);
        } finally {
            setIsLoading(false);
        }
    };

    const acceptRewrite = () => {
        if (previewContent) {
            onRewrite(previewContent);
            setPreviewContent(null);
            setOriginalContent(null);
            setActiveStyle(null);
        }
    };

    const rejectRewrite = () => {
        setPreviewContent(null);
        setOriginalContent(null);
        setActiveStyle(null);
    };

    const revertToOriginal = () => {
        if (originalContent) {
            onRewrite(originalContent);
        }
        setPreviewContent(null);
        setOriginalContent(null);
        setActiveStyle(null);
    };

    // Don't show if no content
    if (!content.trim() || content.length < 20) {
        return null;
    }

    const activeOption = REWRITE_OPTIONS.find(o => o.id === activeStyle);

    return (
        <div className="relative">
            {/* Main Toolbar Button */}
            <div className="flex items-center gap-2">
                <div className="relative">
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        disabled={disabled || isLoading}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
                            ${isOpen 
                                ? 'bg-neutral-700 text-white' 
                                : 'bg-neutral-800/50 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 border border-neutral-700/50'
                            }
                            disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Wand2 className="w-4 h-4" />
                        )}
                        <span>Rewrite</span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {isOpen && (
                        <div className="absolute top-full left-0 mt-2 w-64 rounded-xl bg-neutral-900 border border-neutral-700/50 shadow-xl z-50 overflow-hidden">
                            <div className="p-2">
                                <p className="text-xs text-neutral-500 uppercase tracking-wider px-3 py-2 font-semibold">
                                    Transform your text
                                </p>
                                {REWRITE_OPTIONS.map((option) => (
                                    <button
                                        key={option.id}
                                        onClick={() => handleRewrite(option.id)}
                                        disabled={isLoading}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-neutral-800 transition-all group disabled:opacity-50"
                                    >
                                        <span className="text-neutral-400 group-hover:text-neutral-200">
                                            {getOptionIcon(option.iconName)}
                                        </span>
                                        <div className="flex-1">
                                            <p className="text-sm text-neutral-200 font-medium group-hover:text-white transition-colors">
                                                {option.label}
                                            </p>
                                            <p className="text-xs text-neutral-500">
                                                {option.description}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <span className="text-xs text-red-400 animate-fade-in">
                        {error}
                    </span>
                )}
            </div>

            {/* Preview Panel - Fixed Modal */}
            {previewContent && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="w-full max-w-2xl bg-neutral-900 rounded-2xl border border-neutral-700/50 shadow-2xl overflow-hidden my-auto">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-neutral-800 flex items-center justify-center">
                                    <Wand2 className="w-5 h-5 text-neutral-300" />
                                </div>
                                <div>
                                    <h3 className="text-neutral-100 font-semibold">AI Rewrite Preview</h3>
                                    <p className="text-xs text-neutral-500 flex items-center gap-1.5">
                                        Style: {activeOption?.label}
                                        <span className="text-neutral-600">
                                            {activeOption && getOptionIcon(activeOption.iconName)}
                                        </span>
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={rejectRewrite}
                                className="p-2 rounded-lg text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content Comparison */}
                        <div className="p-6 space-y-4 max-h-[50vh] overflow-y-auto bg-neutral-900/50">
                            {/* Original */}
                            <div>
                                <label className="text-xs text-neutral-500 uppercase tracking-wider font-semibold mb-2 block">
                                    Original
                                </label>
                                <div className="p-4 rounded-xl bg-neutral-800/50 border border-neutral-700/50 text-neutral-400 text-sm leading-relaxed">
                                    {originalContent}
                                </div>
                            </div>

                            {/* Arrow */}
                            <div className="flex justify-center">
                                <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center">
                                    <ArrowDown className="w-4 h-4 text-neutral-400" />
                                </div>
                            </div>

                            {/* Rewritten */}
                            <div>
                                <label className="text-xs text-neutral-500 uppercase tracking-wider font-semibold mb-2 flex items-center gap-2">
                                    Rewritten
                                    <span className="text-neutral-400">
                                        {activeOption && getOptionIcon(activeOption.iconName)}
                                    </span>
                                </label>
                                <div className="p-4 rounded-xl bg-neutral-800 border border-neutral-600/50 text-neutral-200 text-sm leading-relaxed">
                                    {previewContent}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="px-6 py-4 border-t border-neutral-800 flex items-center justify-between bg-neutral-900">
                            <button
                                onClick={revertToOriginal}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-all text-sm"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Keep Original
                            </button>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={rejectRewrite}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 transition-all text-sm border border-neutral-700/50"
                                >
                                    <X className="w-4 h-4" />
                                    Cancel
                                </button>
                                <button
                                    onClick={acceptRewrite}
                                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-neutral-200 text-neutral-900 hover:bg-white transition-all text-sm font-medium"
                                >
                                    <Check className="w-4 h-4" />
                                    Apply Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Click outside to close dropdown */}
            {isOpen && (
                <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
}
