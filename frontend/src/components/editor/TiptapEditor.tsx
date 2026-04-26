'use client';

import { useEditor, EditorContent, Editor, Extension } from '@tiptap/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { FiBold, FiHash, FiItalic, FiList, FiMessageSquare, FiMic, FiMicOff, FiUnderline } from 'react-icons/fi';
import useSpeechRecognition from '@/hooks/use-speech-recognition';

function countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
}

function createWordLimitExtension(maxWords: number) {
    return Extension.create({
        name: 'wordLimit',
        addProseMirrorPlugins() {
            return [
                new Plugin({
                    key: new PluginKey('wordLimit'),
                    filterTransaction(transaction, _state) {
                        if (!transaction.docChanged) return true;
                        const words = countWords(transaction.doc.textContent);
                        return words <= maxWords;
                    },
                }),
            ];
        },
    });
}

interface TiptapEditorProps {
    content?: string;
    initialContent?: string;
    onChange?: (content: string, html: string) => void;
    placeholder?: string;
    showToolbar?: boolean;
    autoFocus?: boolean;
    variant?: 'glass' | 'paper';
    maxWords?: number;
}

const MenuBar = ({
    editor,
    variant = 'glass',
    isVoiceSupported,
    isVoiceListening,
    onToggleVoice,
}: {
    editor: Editor | null;
    variant?: 'glass' | 'paper';
    isVoiceSupported: boolean;
    isVoiceListening: boolean;
    onToggleVoice: () => void;
}) => {
    if (!editor) return null;
    const isPaper = variant === 'paper';
    const baseButtonClass = isPaper
        ? 'text-[rgb(var(--paper-ink-muted))] hover:bg-white/70 hover:text-[rgb(var(--paper-ink))]'
        : 'text-ink-muted hover:bg-white/10 hover:text-white';
    const activeButtonClass = isPaper
        ? 'bg-[rgba(var(--paper-sage),0.46)] text-[rgb(var(--paper-ink))]'
        : 'bg-primary text-white';
    const separatorClass = isPaper ? 'bg-[rgba(var(--paper-border),0.78)]' : 'bg-white/10';
    const menuClass = isPaper
        ? 'flex flex-nowrap overflow-x-auto items-center gap-0.5 sm:gap-1 p-1 sm:p-1.5 border-b border-[rgba(var(--paper-border),0.82)] bg-[rgba(255,255,255,0.56)] scrollbar-hide'
        : 'flex flex-nowrap overflow-x-auto items-center gap-0.5 sm:gap-1 p-1 sm:p-1.5 border-b border-white/10 bg-surface-2/45 scrollbar-hide';

    return (
        <div className={menuClass}>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-2 sm:p-3 rounded-lg transition-colors ${editor.isActive('bold') ? activeButtonClass : baseButtonClass
                    }`}
                title="Bold"
            >
                <FiBold size={14} className="sm:w-4 sm:h-4" aria-hidden="true" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-2 sm:p-3 rounded-lg transition-colors ${editor.isActive('italic') ? activeButtonClass : baseButtonClass
                    }`}
                title="Italic"
            >
                <FiItalic size={14} className="sm:w-4 sm:h-4" aria-hidden="true" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`p-2 sm:p-3 rounded-lg transition-colors ${editor.isActive('underline') ? activeButtonClass : baseButtonClass
                    }`}
                title="Underline"
            >
                <FiUnderline size={14} className="sm:w-4 sm:h-4" aria-hidden="true" />
            </button>

            <div className={`w-px mx-0.5 sm:mx-1 ${separatorClass}`} />

            <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`p-2 sm:p-3 rounded-lg transition-colors ${editor.isActive('heading', { level: 1 }) ? activeButtonClass : baseButtonClass
                    }`}
                title="Heading 1"
            >
                <span className="font-bold text-xs sm:text-sm">H1</span>
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`p-2 sm:p-3 rounded-lg transition-colors ${editor.isActive('heading', { level: 2 }) ? activeButtonClass : baseButtonClass
                    }`}
                title="Heading 2"
            >
                <span className="font-bold text-xs sm:text-sm">H2</span>
            </button>

            <div className={`w-px mx-0.5 sm:mx-1 ${separatorClass}`} />

            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-2 sm:p-3 rounded-lg transition-colors ${editor.isActive('bulletList') ? activeButtonClass : baseButtonClass
                    }`}
                title="Bullet List"
            >
                <FiList size={14} className="sm:w-4 sm:h-4" aria-hidden="true" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-2 sm:p-3 rounded-lg transition-colors ${editor.isActive('orderedList') ? activeButtonClass : baseButtonClass
                    }`}
                title="Numbered List"
            >
                <FiHash size={14} className="sm:w-4 sm:h-4" aria-hidden="true" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={`p-2 sm:p-3 rounded-lg transition-colors ${editor.isActive('blockquote') ? activeButtonClass : baseButtonClass
                    }`}
                title="Quote"
            >
                <FiMessageSquare size={14} className="sm:w-4 sm:h-4" aria-hidden="true" />
            </button>

            {isVoiceSupported && (
                <>
                    <div className={`w-px mx-0.5 sm:mx-1 ml-auto shrink-0 self-stretch ${separatorClass}`} />
                    <button
                        type="button"
                        onClick={onToggleVoice}
                        aria-pressed={isVoiceListening}
                        title={isVoiceListening ? 'Stop dictation' : 'Dictate'}
                        className={`p-2 sm:p-3 rounded-lg transition-all shrink-0 ${
                            isVoiceListening
                                ? `${activeButtonClass} animate-pulse`
                                : baseButtonClass
                        }`}
                    >
                        {isVoiceListening
                            ? <FiMicOff size={14} className="sm:w-4 sm:h-4" aria-hidden="true" />
                            : <FiMic size={14} className="sm:w-4 sm:h-4" aria-hidden="true" />
                        }
                    </button>
                </>
            )}
        </div>
    );
};

export default function TiptapEditor({
    content = '',
    initialContent = '',
    onChange,
    placeholder = 'Start writing...',
    showToolbar = true,
    autoFocus = false,
    variant = 'glass',
    maxWords,
}: TiptapEditorProps) {
    const contentRef = useRef(initialContent || content);
    const isExternalUpdate = useRef(false);
    const [wordCount, setWordCount] = useState(() => countWords(initialContent || content));
    const isPaper = variant === 'paper';
    const editorClass = isPaper
        ? 'prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[280px] px-5 py-6 text-[rgb(var(--paper-ink-soft))]'
        : 'prose prose-invert prose-sm sm:prose-base max-w-none focus:outline-none min-h-[400px] p-5 text-ink-secondary';
    const shellClass = isPaper
        ? 'entry-paper entry-paper-shell entry-paper-ruled rounded-[1.75rem] overflow-hidden'
        : 'workspace-panel rounded-2xl overflow-hidden';

    const extensions = [
        StarterKit,
        Placeholder.configure({ placeholder }),
        ...(maxWords ? [createWordLimitExtension(maxWords)] : []),
    ];

    const editor = useEditor({
        extensions,
        content: contentRef.current,
        editorProps: {
            attributes: {
                class: editorClass,
            },
        },
        autofocus: autoFocus ? 'end' : false,
        onUpdate: ({ editor }) => {
            const text = editor.getText();
            setWordCount(countWords(text));
            if (isExternalUpdate.current) {
                isExternalUpdate.current = false;
                if (onChange) {
                    onChange(text, editor.getHTML());
                }
                return;
            }
            if (onChange) {
                const html = editor.getHTML();
                contentRef.current = html;
                onChange(text, html);
            }
        },
        immediatelyRender: false,
    });

    // Sync with external content changes (e.g., from voice input)
    useEffect(() => {
        if (editor && content && content !== contentRef.current) {
            const wasFocused = editor.isFocused;
            isExternalUpdate.current = true;
            contentRef.current = content;
            editor.commands.setContent(content);
            // setContent resets the ProseMirror selection; restore cursor to end
            // so the user can keep typing immediately after voice text lands.
            if (wasFocused) {
                editor.commands.focus('end');
            }
        }
    }, [editor, content]);

    useEffect(() => {
        return () => {
            contentRef.current = '';
        };
    }, []);

    const editorRef = useRef(editor);
    editorRef.current = editor;

    const handleVoiceTranscript = useCallback((text: string) => {
        editorRef.current?.chain().focus().insertContent(text + ' ').run();
    }, []);

    const { isSupported: isVoiceSupported, isListening: isVoiceListening, interimText, start: startVoice, stop: stopVoice } = useSpeechRecognition({
        continuous: true,
        interimResults: true,
        onFinal: handleVoiceTranscript,
    });

    const toggleVoice = useCallback(() => {
        if (isVoiceListening) stopVoice(); else startVoice();
    }, [isVoiceListening, startVoice, stopVoice]);

    const atLimit = maxWords !== undefined && wordCount >= maxWords;
    const nearLimit = maxWords !== undefined && wordCount >= maxWords - 50 && !atLimit;

    return (
        <div className={shellClass}>
            {showToolbar && (
                <MenuBar
                    editor={editor}
                    variant={variant}
                    isVoiceSupported={isVoiceSupported}
                    isVoiceListening={isVoiceListening}
                    onToggleVoice={toggleVoice}
                />
            )}
            {isVoiceListening && (
                <div className={`px-4 py-2 text-sm italic border-b ${
                    isPaper
                        ? 'text-[rgba(var(--paper-ink),0.45)] border-[rgba(var(--paper-border),0.5)]'
                        : 'text-ink-muted/55 border-white/10'
                }`}>
                    {interimText ? `${interimText}…` : 'Listening…'}
                </div>
            )}
            <div className="relative">
                <EditorContent editor={editor} />
                {maxWords !== undefined && (
                    <div className={`absolute bottom-3 right-4 text-[11px] font-semibold tabular-nums pointer-events-none select-none transition-colors ${
                        atLimit
                            ? 'text-red-400'
                            : nearLimit
                                ? 'text-amber-500'
                                : isPaper
                                    ? 'text-[rgba(141,123,105,0.45)]'
                                    : 'text-ink-muted/50'
                    }`}>
                        {wordCount} / {maxWords}
                    </div>
                )}
            </div>
        </div>
    );
}

