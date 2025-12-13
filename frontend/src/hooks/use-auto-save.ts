import { useState, useEffect, useCallback } from 'react';

interface AutoSaveOptions<T> {
    data: T;
    onSave: (data: T) => Promise<void>;
    interval?: number;
    enabled?: boolean;
}

export function useAutoSave<T>({ data, onSave, interval = 2000, enabled = true }: AutoSaveOptions<T>) {
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Track if initial load is done to avoid saving empty/initial state immediately
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        setIsInitialized(true);
    }, []);

    useEffect(() => {
        if (!isInitialized) return;
        setHasUnsavedChanges(true);
    }, [data, isInitialized]);

    useEffect(() => {
        if (!enabled || !hasUnsavedChanges || isSaving) return;

        const timer = setTimeout(async () => {
            setIsSaving(true);
            setError(null);
            try {
                await onSave(data);
                setLastSaved(new Date());
                setHasUnsavedChanges(false);
            } catch (err: any) {
                setError(err.message || 'Failed to auto-save');
            } finally {
                setIsSaving(false);
            }
        }, interval);

        return () => clearTimeout(timer);
    }, [data, enabled, hasUnsavedChanges, isSaving, interval, onSave]);

    return { lastSaved, isSaving, error, hasUnsavedChanges };
}
