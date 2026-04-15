import { useState, useEffect, useCallback, useRef } from 'react';

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
    const lastTrackedSnapshotRef = useRef<string>('');
    const wasEnabledRef = useRef<boolean>(enabled);

    // Track if initial load is done to avoid saving empty/initial state immediately
    const [isInitialized, setIsInitialized] = useState(false);
    const toSnapshot = useCallback((value: T): string => {
        try {
            return JSON.stringify(value);
        } catch {
            // Fallback for non-serializable values; force autosave behavior in this rare case.
            return '__non_serializable__';
        }
    }, []);

    useEffect(() => {
        lastTrackedSnapshotRef.current = toSnapshot(data);
        setIsInitialized(true);
    }, [data, toSnapshot]);

    useEffect(() => {
        if (!isInitialized) return;
        const snapshot = toSnapshot(data);
        if (snapshot === lastTrackedSnapshotRef.current) {
            return;
        }
        lastTrackedSnapshotRef.current = snapshot;
        setHasUnsavedChanges(true);
    }, [data, isInitialized, toSnapshot]);

    useEffect(() => {
        if (!isInitialized) {
            wasEnabledRef.current = enabled;
            return;
        }

        if (enabled && !wasEnabledRef.current) {
            // When autosave is enabled after async data hydration, establish a clean baseline.
            lastTrackedSnapshotRef.current = toSnapshot(data);
            setHasUnsavedChanges(false);
        }

        wasEnabledRef.current = enabled;
    }, [data, enabled, isInitialized, toSnapshot]);

    useEffect(() => {
        if (!enabled || !hasUnsavedChanges || isSaving) return;

        const timer = setTimeout(async () => {
            setIsSaving(true);
            setError(null);
            try {
                await onSave(data);
                setLastSaved(new Date());
                lastTrackedSnapshotRef.current = toSnapshot(data);
                setHasUnsavedChanges(false);
            } catch (err: any) {
                setError(err.message || 'Couldn\u2019t auto-save your changes.');
            } finally {
                setIsSaving(false);
            }
        }, interval);

        return () => clearTimeout(timer);
    }, [data, enabled, hasUnsavedChanges, isSaving, interval, onSave, toSnapshot]);

    return { lastSaved, isSaving, error, hasUnsavedChanges };
}
