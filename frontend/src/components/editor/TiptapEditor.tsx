'use client';

import { useEditor, EditorContent, Editor } from '@tiptap/react';
import { useEffect, useRef } from 'react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { FiBold, FiHash, FiItalic, FiList, FiMessageSquare, FiUnderline } from 'react-icons/fi';

interface TiptapEditorProps {
    content?: string;
    initialContent?: string;
    onChange?: (content: string, html: string) => void;
    placeholder?: string;
    showToolbar?: boolean;
    autoFocus?: boolean;
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
        <div className="flex flex-nowrap overflow-x-auto gap-1 p-2 border-b border-white/10 bg-surface-2/45 scrollbar-hide">
            <VoiceRecorder
                onTranscript={handleVoiceTranscript}
                showInterimResults={true}
                language="en-US"
            />
            <div className="w-px bg-white/10 mx-1" />

            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-2 rounded-lg transition-colors ${editor.isActive('bold') ? 'bg-primary text-white' : 'text-ink-muted hover:bg-white/10 hover:text-white'
                    }`}
                title="Bold"
            >
                <FiBold size={16} aria-hidden="true" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-2 rounded-lg transition-colors ${editor.isActive('italic') ? 'bg-primary text-white' : 'text-ink-muted hover:bg-white/10 hover:text-white'
                    }`}
                title="Italic"
            >
                <FiItalic size={16} aria-hidden="true" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`p-2 rounded-lg transition-colors ${editor.isActive('underline') ? 'bg-primary text-white' : 'text-ink-muted hover:bg-white/10 hover:text-white'
                    }`}
                title="Underline"
            >
                <FiUnderline size={16} aria-hidden="true" />
            </button>

            <div className="w-px bg-white/10 mx-1" />

            <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`p-2 rounded-lg transition-colors ${editor.isActive('heading', { level: 1 }) ? 'bg-primary text-white' : 'text-ink-muted hover:bg-white/10 hover:text-white'
                    }`}
                title="Heading 1"
            >
                <span className="font-bold text-sm">H1</span>
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`p-2 rounded-lg transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-primary text-white' : 'text-ink-muted hover:bg-white/10 hover:text-white'
                    }`}
                title="Heading 2"
            >
                <span className="font-bold text-sm">H2</span>
            </button>

            <div className="w-px bg-white/10 mx-1" />

            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-2 rounded-lg transition-colors ${editor.isActive('bulletList') ? 'bg-primary text-white' : 'text-ink-muted hover:bg-white/10 hover:text-white'
                    }`}
                title="Bullet List"
            >
                <FiList size={16} aria-hidden="true" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-2 rounded-lg transition-colors ${editor.isActive('orderedList') ? 'bg-primary text-white' : 'text-ink-muted hover:bg-white/10 hover:text-white'
                    }`}
                title="Numbered List"
            >
                <FiHash size={16} aria-hidden="true" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={`p-2 rounded-lg transition-colors ${editor.isActive('blockquote') ? 'bg-primary text-white' : 'text-ink-muted hover:bg-white/10 hover:text-white'
                    }`}
                title="Quote"
            >
                <FiMessageSquare size={16} aria-hidden="true" />
            </button>
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
}: TiptapEditorProps) {
    const contentRef = useRef(initialContent || content);
    const isExternalUpdate = useRef(false);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder,
            }),
        ],
        content: contentRef.current,
        editorProps: {
            attributes: {
                class: 'prose prose-invert prose-sm sm:prose-base max-w-none focus:outline-none min-h-[220px] p-5 text-ink-secondary',
            },
        },
        autofocus: autoFocus ? 'end' : false,
        onUpdate: ({ editor }) => {
            if (isExternalUpdate.current) {
                isExternalUpdate.current = false;
                if (onChange) {
                    onChange(editor.getText(), editor.getHTML());
                }
                return;
            }
            if (onChange) {
                const text = editor.getText();
                const html = editor.getHTML();
                contentRef.current = text;
                onChange(text, html);
            }
        },
        immediatelyRender: false,
    });

    // Sync with external content changes (e.g., from voice input)
    useEffect(() => {
        if (editor && content && content !== contentRef.current) {
            isExternalUpdate.current = true;
            contentRef.current = content;
            editor.commands.setContent(content);
        }
    }, [editor, content]);

    useEffect(() => {
        return () => {
            contentRef.current = '';
        };
    }, []);

    return (
        <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
            {showToolbar && <MenuBar editor={editor} />}
            <EditorContent editor={editor} />
        </div>
    );
}

