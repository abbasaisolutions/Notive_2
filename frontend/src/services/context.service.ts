/**
 * Context Detection Service
 * Analyzes user context (time, location, activity) to generate smart prompts
 */

import type { PromptBehaviorProfile, PromptLens } from '@/services/prompt-learning.service';

export type TimeContext = 'morning' | 'midday' | 'afternoon' | 'evening' | 'night' | 'late_night';
export type ActivityContext = 'stationary' | 'walking' | 'running' | 'driving' | 'unknown';
export type LocationContext = 'home' | 'work' | 'traveling' | 'new_location' | 'unknown';

interface ContextData {
    time: TimeContext;
    activity: ActivityContext;
    location: LocationContext;
    locationName?: string;
    isNewLocation: boolean;
}

export interface PromptData {
    text: string;
    category: string;
    priority: number;
    source: 'context';
    lens?: PromptLens;
    metric?: string | null;
    signalKind?: string | null;
}

interface ContextPromptProfile {
    primaryGoal?: string | null;
    focusArea?: string | null;
    writingPreference?: string | null;
    outputGoals?: string[] | null;
    starterPrompt?: string | null;
}

interface ContextPromptOptions {
    healthContext?: null;
    profile?: ContextPromptProfile | null;
    behavior?: PromptBehaviorProfile | null;
}

const hasText = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;

const normalizeGoals = (value: string[] | null | undefined): string[] =>
    Array.isArray(value)
        ? value
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean)
        : [];

class ContextDetectionService {
    private lastKnownLocation: GeolocationCoordinates | null = null;
    private locationHistory: GeolocationCoordinates[] = [];
    private activityDetectionActive = false;

    getTimeContext(): TimeContext {
        const hour = new Date().getHours();

        if (hour >= 5 && hour < 9) return 'morning';
        if (hour >= 9 && hour < 12) return 'midday';
        if (hour >= 12 && hour < 17) return 'afternoon';
        if (hour >= 17 && hour < 21) return 'evening';
        if (hour >= 21 && hour < 24) return 'night';
        return 'late_night';
    }

    async getLocationContext(): Promise<LocationContext> {
        try {
            const canUseLocation = await this.hasLocationPermission();
            if (!canUseLocation) {
                return 'unknown';
            }
            const position = await this.getCurrentPosition();

            if (this.isNewLocation(position.coords)) {
                this.locationHistory.push(position.coords);
                return 'new_location';
            }

            const timeContext = this.getTimeContext();

            if (timeContext === 'morning' || timeContext === 'evening' || timeContext === 'night') {
                return 'home';
            }

            if (timeContext === 'midday' || timeContext === 'afternoon') {
                return 'work';
            }

            return 'unknown';
        } catch (error) {
            return 'unknown';
        }
    }

    private async hasLocationPermission(): Promise<boolean> {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            return false;
        }

        const permissionsApi = (navigator as Navigator & {
            permissions?: { query: (descriptor: PermissionDescriptor) => Promise<PermissionStatus> };
        }).permissions;

        if (!permissionsApi || typeof permissionsApi.query !== 'function') {
            return false;
        }

        try {
            const status = await permissionsApi.query({ name: 'geolocation' as PermissionName });
            return status.state === 'granted';
        } catch {
            return false;
        }
    }

    async getActivityContext(): Promise<ActivityContext> {
        if (!this.activityDetectionActive) {
            return 'unknown';
        }
        return 'stationary';
    }

    startActivityDetection(): void {
        if (typeof window === 'undefined') return;

        if ('DeviceMotionEvent' in window) {
            this.activityDetectionActive = true;
        }
    }

    stopActivityDetection(): void {
        this.activityDetectionActive = false;
    }

    async getContext(): Promise<ContextData> {
        const [location, activity] = await Promise.all([
            this.getLocationContext(),
            this.getActivityContext(),
        ]);

        return {
            time: this.getTimeContext(),
            activity,
            location,
            isNewLocation: location === 'new_location',
        };
    }

    async generatePrompt(options: ContextPromptOptions = {}): Promise<PromptData> {
        const context = await this.getContext();
        const prompts = this.getPromptsForContext(context);
        return this.selectPrompt(prompts);
    }

    private getPromptsForContext(context: ContextData): PromptData[] {
        const prompts: PromptData[] = [];

        switch (context.time) {
            case 'morning':
                prompts.push(
                    { text: "Good morning! How are you feeling today?", category: 'greeting', priority: 1, source: 'context' },
                    { text: "What's your intention for today?", category: 'reflection', priority: 2, source: 'context' },
                    { text: "How did you sleep last night?", category: 'wellness', priority: 2, source: 'context' }
                );
                break;
            case 'midday':
                prompts.push(
                    { text: "How's your day going so far?", category: 'check_in', priority: 1, source: 'context' },
                    { text: "What's on your mind right now?", category: 'reflection', priority: 2, source: 'context' }
                );
                break;
            case 'evening':
                prompts.push(
                    { text: "Ready to reflect on your day?", category: 'reflection', priority: 1, source: 'context' },
                    { text: "What was the highlight of your day?", category: 'gratitude', priority: 2, source: 'context' },
                    { text: "How are you feeling this evening?", category: 'check_in', priority: 2, source: 'context' }
                );
                break;
            case 'night':
                prompts.push(
                    { text: "What are you grateful for today?", category: 'gratitude', priority: 1, source: 'context' },
                    { text: "How do you feel about tomorrow?", category: 'reflection', priority: 2, source: 'context' },
                    { text: "Ready to wind down? What's on your mind?", category: 'check_in', priority: 2, source: 'context' }
                );
                break;
        }

        if (context.isNewLocation) {
            prompts.push(
                { text: "Somewhere new? What's it like?", category: 'exploration', priority: 3, source: 'context' },
                { text: "First time here? What's your impression?", category: 'exploration', priority: 3, source: 'context' }
            );
        }

        switch (context.activity) {
            case 'walking':
                prompts.push(
                    { text: "Taking a walk? What are you noticing?", category: 'mindfulness', priority: 2, source: 'context' }
                );
                break;
            case 'running':
                prompts.push(
                    { text: "How was your run? How do you feel?", category: 'wellness', priority: 2, source: 'context' }
                );
                break;
        }

        if (prompts.length === 0) {
            prompts.push(
                { text: "What's on your mind?", category: 'general', priority: 1, source: 'context' }
            );
        }

        return prompts.sort((a, b) => a.priority - b.priority);
    }

    private selectPrompt(prompts: PromptData[]): PromptData {
        const orderedPrompts = [...prompts].sort((left, right) => left.priority - right.priority);
        const bestPriority = orderedPrompts[0]?.priority ?? 1;
        const topPrompts = orderedPrompts.filter((prompt) => prompt.priority === bestPriority);

        if (topPrompts.length === 0) {
            return { text: "What's on your mind?", category: 'general', priority: 1, source: 'context' };
        }

        const timeSeed = new Date();
        const deterministicIndex = (timeSeed.getDay() + timeSeed.getHours()) % topPrompts.length;
        return topPrompts[deterministicIndex];
    }

    private getCurrentPosition(): Promise<GeolocationPosition> {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: false,
                timeout: 5000,
                maximumAge: 300000,
            });
        });
    }

    private isNewLocation(coords: GeolocationCoordinates): boolean {
        if (!this.lastKnownLocation) {
            this.lastKnownLocation = coords;
            return false;
        }

        const distance = this.calculateDistance(
            this.lastKnownLocation.latitude,
            this.lastKnownLocation.longitude,
            coords.latitude,
            coords.longitude
        );

        return distance > 1;
    }

    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371;
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) *
            Math.cos(this.toRad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private toRad(degrees: number): number {
        return degrees * (Math.PI / 180);
    }
}

export const contextService = new ContextDetectionService();

export default contextService;
