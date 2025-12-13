'use client';

import { useEditor, EditorContent, Editor } from '@tiptap/react';
import { useEffect } from 'react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';

interface TiptapEditorProps {
    content?: string;
    onChange?: (content: string, html: string) => void;
    placeholder?: string;
}

import VoiceRecorder from './VoiceRecorder';

const MenuBar = ({ editor }: { editor: Editor | null }) => {
    if (!editor) return null;

    const handleVoiceTranscript = (text: string) => {
        // Get current content to determine if we need a space
        const currentContent = editor.getText();
        const needsSpace = currentContent.length > 0 && !currentContent.endsWith(' ');

        // Insert text at current cursor position with proper spacing
        const textToInsert = needsSpace ? ` ${text}` : text;
        editor.chain().focus().insertContent(textToInsert).run();
    };

    return (
        <div className="flex flex-nowrap overflow-x-auto gap-1 p-2 border-b border-white/10 bg-slate-800/30 scrollbar-hide">
            <VoiceRecorder
                onTranscript={handleVoiceTranscript}
                showInterimResults={true}
                language="en-US"
            />
            <div className="w-px bg-white/10 mx-1" />

            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-2 rounded-lg transition-colors ${editor.isActive('bold') ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/10 hover:text-white'
                    }`}
                title="Bold"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 12a4 4 0 0 0 0-8H6v8" />
                    <path d="M15 20a4 4 0 0 0 0-8H6v8Z" />
                </svg>
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-2 rounded-lg transition-colors ${editor.isActive('italic') ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/10 hover:text-white'
                    }`}
                title="Italic"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="19" x2="10" y1="4" y2="4" />
                    <line x1="14" x2="5" y1="20" y2="20" />
                    <line x1="15" x2="9" y1="4" y2="20" />
                </svg>
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`p-2 rounded-lg transition-colors ${editor.isActive('underline') ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/10 hover:text-white'
                    }`}
                title="Underline"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 4v6a6 6 0 0 0 12 0V4" />
                    <line x1="4" x2="20" y1="20" y2="20" />
                </svg>
            </button>

            <div className="w-px bg-white/10 mx-1" />

            <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`p-2 rounded-lg transition-colors ${editor.isActive('heading', { level: 1 }) ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/10 hover:text-white'
                    }`}
                title="Heading 1"
            >
                <span className="font-bold text-sm">H1</span>
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`p-2 rounded-lg transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/10 hover:text-white'
                    }`}
                title="Heading 2"
            >
                <span className="font-bold text-sm">H2</span>
            </button>

            <div className="w-px bg-white/10 mx-1" />

            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-2 rounded-lg transition-colors ${editor.isActive('bulletList') ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/10 hover:text-white'
                    }`}
                title="Bullet List"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" x2="21" y1="6" y2="6" />
                    <line x1="8" x2="21" y1="12" y2="12" />
                    <line x1="8" x2="21" y1="18" y2="18" />
                    <line x1="3" x2="3.01" y1="6" y2="6" />
                    <line x1="3" x2="3.01" y1="12" y2="12" />
                    <line x1="3" x2="3.01" y1="18" y2="18" />
                </svg>
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-2 rounded-lg transition-colors ${editor.isActive('orderedList') ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/10 hover:text-white'
                    }`}
                title="Numbered List"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="10" x2="21" y1="6" y2="6" />
                    <line x1="10" x2="21" y1="12" y2="12" />
                    <line x1="10" x2="21" y1="18" y2="18" />
                    <path d="M4 6h1v4" />
                    <path d="M4 10h2" />
                    <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
                </svg>
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={`p-2 rounded-lg transition-colors ${editor.isActive('blockquote') ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/10 hover:text-white'
                    }`}
                title="Quote"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z" />
                    <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z" />
                </svg>
            </button>
        </div>
    );
};

export default function TiptapEditor({ content = '', onChange, placeholder = 'Start writing...' }: TiptapEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            Placeholder.configure({
                placeholder,
            }),
        ],
        content,
        editorProps: {
            attributes: {
                class: 'prose prose-invert prose-sm sm:prose-base max-w-none focus:outline-none min-h-[300px] p-4',
            },
        },
        onUpdate: ({ editor }) => {
            if (onChange) {
                onChange(editor.getText(), editor.getHTML());
            }
        },
        immediatelyRender: false,
    });

    useEffect(() => {
        if (editor) {
            (window as any).tiptapEditor = editor;
        }
        return () => {
            delete (window as any).tiptapEditor;
        };
    }, [editor]);

    return (
        <div className="glass-card rounded-2xl overflow-hidden">
            <MenuBar editor={editor} />
            <EditorContent editor={editor} />
        </div>
    );
}
