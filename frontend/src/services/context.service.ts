/**
 * Context Detection Service
 * Analyzes user context (time, location, activity) to generate smart prompts
 */

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

interface PromptData {
    text: string;
    category: string;
    priority: number;
}

class ContextDetectionService {
    private lastKnownLocation: GeolocationCoordinates | null = null;
    private locationHistory: GeolocationCoordinates[] = [];
    private activityDetectionActive = false;

    /**
     * Get current time context
     */
    getTimeContext(): TimeContext {
        const hour = new Date().getHours();

        if (hour >= 5 && hour < 9) return 'morning';
        if (hour >= 9 && hour < 12) return 'midday';
        if (hour >= 12 && hour < 17) return 'afternoon';
        if (hour >= 17 && hour < 21) return 'evening';
        if (hour >= 21 && hour < 24) return 'night';
        return 'late_night';
    }

    /**
     * Get current location context
     */
    async getLocationContext(): Promise<LocationContext> {
        try {
            const position = await this.getCurrentPosition();

            // Check if this is a new location
            if (this.isNewLocation(position.coords)) {
                this.locationHistory.push(position.coords);
                return 'new_location';
            }

            // In a real app, you'd use reverse geocoding to determine location type
            // For now, we'll use simple logic based on time and movement
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

    /**
     * Get current activity context using Device Motion API
     */
    async getActivityContext(): Promise<ActivityContext> {
        if (!this.activityDetectionActive) {
            return 'unknown';
        }

        // This would use DeviceMotion API in a real implementation
        // For now, return stationary as default
        return 'stationary';
    }

    /**
     * Start activity detection
     */
    startActivityDetection(): void {
        if (typeof window === 'undefined') return;

        if ('DeviceMotionEvent' in window) {
            this.activityDetectionActive = true;
            // In a real implementation, you'd set up event listeners here
        }
    }

    /**
     * Stop activity detection
     */
    stopActivityDetection(): void {
        this.activityDetectionActive = false;
    }

    /**
     * Get comprehensive context data
     */
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

    /**
     * Generate a smart prompt based on context
     */
    async generatePrompt(): Promise<PromptData> {
        const context = await this.getContext();
        const prompts = this.getPromptsForContext(context);

        // Select a random prompt from the available options
        const selectedPrompt = prompts[Math.floor(Math.random() * prompts.length)];

        return selectedPrompt;
    }

    /**
     * Get prompts for specific context
     */
    private getPromptsForContext(context: ContextData): PromptData[] {
        const prompts: PromptData[] = [];

        // Time-based prompts
        switch (context.time) {
            case 'morning':
                prompts.push(
                    { text: "Good morning! How are you feeling today?", category: 'greeting', priority: 1 },
                    { text: "What's your intention for today?", category: 'reflection', priority: 2 },
                    { text: "How did you sleep last night?", category: 'wellness', priority: 2 }
                );
                break;
            case 'midday':
                prompts.push(
                    { text: "How's your day going so far?", category: 'check_in', priority: 1 },
                    { text: "What's on your mind right now?", category: 'reflection', priority: 2 }
                );
                break;
            case 'evening':
                prompts.push(
                    { text: "Ready to reflect on your day?", category: 'reflection', priority: 1 },
                    { text: "What was the highlight of your day?", category: 'gratitude', priority: 2 },
                    { text: "How are you feeling this evening?", category: 'check_in', priority: 2 }
                );
                break;
            case 'night':
                prompts.push(
                    { text: "What are you grateful for today?", category: 'gratitude', priority: 1 },
                    { text: "How do you feel about tomorrow?", category: 'reflection', priority: 2 },
                    { text: "Ready to wind down? What's on your mind?", category: 'check_in', priority: 2 }
                );
                break;
        }

        // Location-based prompts
        if (context.isNewLocation) {
            prompts.push(
                { text: "Somewhere new? What's it like?", category: 'exploration', priority: 3 },
                { text: "First time here? What's your impression?", category: 'exploration', priority: 3 }
            );
        }

        // Activity-based prompts
        switch (context.activity) {
            case 'walking':
                prompts.push(
                    { text: "Taking a walk? What are you noticing?", category: 'mindfulness', priority: 2 }
                );
                break;
            case 'running':
                prompts.push(
                    { text: "How was your run? How do you feel?", category: 'wellness', priority: 2 }
                );
                break;
        }

        // Default prompt if no context-specific prompts
        if (prompts.length === 0) {
            prompts.push(
                { text: "What's on your mind?", category: 'general', priority: 1 }
            );
        }

        return prompts.sort((a, b) => a.priority - b.priority);
    }

    /**
     * Helper: Get current position
     */
    private getCurrentPosition(): Promise<GeolocationPosition> {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: false,
                timeout: 5000,
                maximumAge: 300000, // 5 minutes
            });
        });
    }

    /**
     * Helper: Check if location is new
     */
    private isNewLocation(coords: GeolocationCoordinates): boolean {
        if (!this.lastKnownLocation) {
            this.lastKnownLocation = coords;
            return false;
        }

        // Calculate distance (simple approximation)
        const distance = this.calculateDistance(
            this.lastKnownLocation.latitude,
            this.lastKnownLocation.longitude,
            coords.latitude,
            coords.longitude
        );

        // Consider it a new location if more than 1km away
        return distance > 1;
    }

    /**
     * Helper: Calculate distance between two coordinates (in km)
     */
    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Earth's radius in km
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

    /**
     * Helper: Convert degrees to radians
     */
    private toRad(degrees: number): number {
        return degrees * (Math.PI / 180);
    }
}

// Export singleton instance
export const contextService = new ContextDetectionService();

export default contextService;
