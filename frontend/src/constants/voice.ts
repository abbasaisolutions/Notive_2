const readBoolean = (value: string | undefined, fallback: boolean) => {
    const normalized = (value || '').trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
    return fallback;
};

export const VOICE_BACKEND_TRANSCRIPTION_ENABLED = readBoolean(
    process.env.NEXT_PUBLIC_VOICE_BACKEND_TRANSCRIPTION_ENABLED,
    true
);

export const VOICE_ALLOW_BROWSER_FALLBACK = readBoolean(
    process.env.NEXT_PUBLIC_VOICE_ALLOW_BROWSER_FALLBACK,
    true
);

export const DEFAULT_VOICE_LANGUAGE_MODE = 'auto' as const;
export const PENDING_VOICE_CAPTURE_KEY = 'notive_pending_voice_capture_v1';
