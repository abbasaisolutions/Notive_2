import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';

interface HealthContextSummary {
    date: string;
    sleepHours: number | null;
    sleepQuality: string | null;
    steps: number | null;
    activityLevel: 'low' | 'moderate' | 'high' | null;
    avgHeartRate: number | null;
}

interface HealthConnectionStatus {
    connected: boolean;
    lastSyncAt?: string;
}

interface UseHealthContextReturn {
    healthContext: HealthContextSummary | null;
    isConnected: boolean;
    isLoading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

/**
 * Hook to fetch health context for journal entries
 * Returns yesterday's health data to provide context for today's writing
 */
export function useHealthContext(): UseHealthContextReturn {
    const { accessToken } = useAuth();
    const [healthContext, setHealthContext] = useState<HealthContextSummary | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchHealthContext = useCallback(async () => {
        if (!accessToken) {
            setIsLoading(false);
            return;
        }

        try {
            // First check if Google Fit is connected
            const statusResponse = await fetch(`${API_URL}/health/google-fit/status`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (!statusResponse.ok) {
                throw new Error('Failed to check connection status');
            }

            const status: HealthConnectionStatus = await statusResponse.json();
            setIsConnected(status.connected);

            if (!status.connected) {
                setHealthContext(null);
                setIsLoading(false);
                return;
            }

            // Fetch today's health context (which is actually yesterday's data)
            const contextResponse = await fetch(`${API_URL}/health/context/today`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (!contextResponse.ok) {
                throw new Error('Failed to fetch health context');
            }

            const data = await contextResponse.json();
            setHealthContext(data.context);
        } catch (err) {
            console.error('Error fetching health context:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    }, [accessToken]);

    useEffect(() => {
        fetchHealthContext();
    }, [fetchHealthContext]);

    return {
        healthContext,
        isConnected,
        isLoading,
        error,
        refetch: fetchHealthContext,
    };
}

/**
 * Hook to fetch health context for a specific date
 */
export function useHealthContextForDate(date: Date | string): UseHealthContextReturn {
    const { accessToken } = useAuth();
    const [healthContext, setHealthContext] = useState<HealthContextSummary | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];

    const fetchHealthContext = useCallback(async () => {
        if (!accessToken) {
            setIsLoading(false);
            return;
        }

        try {
            // Check connection status
            const statusResponse = await fetch(`${API_URL}/health/google-fit/status`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (!statusResponse.ok) {
                throw new Error('Failed to check connection status');
            }

            const status: HealthConnectionStatus = await statusResponse.json();
            setIsConnected(status.connected);

            if (!status.connected) {
                setHealthContext(null);
                setIsLoading(false);
                return;
            }

            // Fetch health context for the specific date
            const contextResponse = await fetch(`${API_URL}/health/context/${dateStr}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (!contextResponse.ok) {
                throw new Error('Failed to fetch health context');
            }

            const data = await contextResponse.json();
            setHealthContext(data.context);
        } catch (err) {
            console.error('Error fetching health context:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    }, [accessToken, dateStr]);

    useEffect(() => {
        fetchHealthContext();
    }, [fetchHealthContext]);

    return {
        healthContext,
        isConnected,
        isLoading,
        error,
        refetch: fetchHealthContext,
    };
}

export default useHealthContext;
