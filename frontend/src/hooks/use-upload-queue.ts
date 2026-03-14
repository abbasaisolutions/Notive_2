'use client';

import { useCallback, useEffect, useState } from 'react';
import useApi from '@/hooks/use-api';

const DB_NAME = 'notive_upload_queue';
const STORE_NAME = 'queue';
const DB_VERSION = 1;
const RESULTS_KEY = 'notive_upload_results';

export type UploadQueueItem = {
    id: string;
    endpoint: string;
    fieldName: string;
    file: Blob;
    fileName: string;
    fileType: string;
    createdAt: number;
};

export type UploadResult = {
    id: string;
    url: string;
    fileName: string;
    createdAt: number;
};

const openDb = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || !window.indexedDB) {
            reject(new Error('IndexedDB not available'));
            return;
        }

        const request = window.indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const withStore = async <T,>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const request = fn(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const addQueueItem = (item: UploadQueueItem) => withStore('readwrite', store => store.put(item));
const removeQueueItem = (id: string) => withStore('readwrite', store => store.delete(id));
const getQueueItems = () => withStore<UploadQueueItem[]>('readonly', store => store.getAll());
const countQueueItems = () => withStore<number>('readonly', store => store.count());

const loadResults = (): UploadResult[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(RESULTS_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as UploadResult[];
    } catch {
        return [];
    }
};

const saveResults = (results: UploadResult[]) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(RESULTS_KEY, JSON.stringify(results));
};

export const useUploadQueue = () => {
    const { apiFetch } = useApi();
    const [queueCount, setQueueCount] = useState(0);
    const [recentUploads, setRecentUploads] = useState<UploadResult[]>([]);

    const refreshQueueCount = useCallback(async () => {
        try {
            const count = await countQueueItems();
            setQueueCount(count);
        } catch {
            setQueueCount(0);
        }
    }, []);

    useEffect(() => {
        refreshQueueCount();
        setRecentUploads(loadResults());
    }, [refreshQueueCount]);

    const enqueueUpload = useCallback(async (item: Omit<UploadQueueItem, 'id' | 'createdAt'>) => {
        const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        await addQueueItem({
            ...item,
            id,
            createdAt: Date.now(),
        });
        await refreshQueueCount();
        return id;
    }, [refreshQueueCount]);

    const processQueue = useCallback(async () => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) return;

        let items: UploadQueueItem[] = [];
        try {
            items = await getQueueItems();
        } catch {
            return;
        }

        if (items.length === 0) return;

        const results = loadResults();

        for (const item of items) {
            try {
                const formData = new FormData();
                formData.append(item.fieldName, item.file, item.fileName);

                const response = await apiFetch(item.endpoint, {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    throw new Error(data.message || 'Upload failed');
                }

                const data = await response.json();
                if (data?.url) {
                    results.unshift({
                        id: item.id,
                        url: data.url,
                        fileName: item.fileName,
                        createdAt: Date.now(),
                    });
                    saveResults(results.slice(0, 10));
                    setRecentUploads(results.slice(0, 10));
                }

                await removeQueueItem(item.id);
            } catch (error) {
                console.error('Queued upload failed:', error);
                // Stop processing to avoid busy retries when offline
                break;
            }
        }

        await refreshQueueCount();
    }, [apiFetch, refreshQueueCount]);

    const clearUploadResult = useCallback((id: string) => {
        const next = recentUploads.filter(upload => upload.id !== id);
        setRecentUploads(next);
        saveResults(next);
    }, [recentUploads]);

    return {
        enqueueUpload,
        processQueue,
        queueCount,
        recentUploads,
        clearUploadResult,
    };
};

export default useUploadQueue;
