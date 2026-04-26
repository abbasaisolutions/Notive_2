'use client';

import { useCallback } from 'react';
import { usePathname } from 'next/navigation';
import useApi from '@/hooks/use-api';
import { API_URL } from '@/constants/config';
import { captureDeviceSnapshotLite } from '@/services/device-context.service';

type TrackTelemetryInput = {
    eventType: string;
    field?: string;
    value?: string;
    pathname?: string;
    metadata?: Record<string, unknown>;
};

export function useTelemetry() {
    const pathname = usePathname();
    const { apiFetch } = useApi();

    const trackEvent = useCallback(async (input: TrackTelemetryInput) => {
        try {
            const deviceInfo = captureDeviceSnapshotLite();
            await apiFetch(`/analytics/events`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    eventType: input.eventType,
                    field: input.field,
                    value: input.value,
                    pathname: input.pathname || pathname || null,
                    metadata: {
                        ...deviceInfo,
                        ...input.metadata,
                    },
                    occurredAt: new Date().toISOString(),
                }),
            });
        } catch (error) {
            console.error('Telemetry capture failed:', error);
        }
    }, [apiFetch, pathname]);

    return { trackEvent };
}

export default useTelemetry;
