/**
 * Context Detection Service
 * Analyzes user context (time, location, activity) to generate smart prompts
 */

import type { HealthContextSummary, HealthPromptSignal } from '@/types/health';
import type { PromptBehaviorProfile, PromptBehaviorStat, PromptLens } from '@/services/prompt-learning.service';

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
    source: 'health' | 'context';
    lens?: PromptLens;
    signalKind?: HealthPromptSignal['kind'];
    metric?: string | null;
}

interface ContextPromptProfile {
    primaryGoal?: string | null;
    focusArea?: string | null;
    writingPreference?: string | null;
    outputGoals?: string[] | null;
    starterPrompt?: string | null;
}

interface ContextPromptOptions {
    healthContext?: HealthContextSummary | null;
    profile?: ContextPromptProfile | null;
    behavior?: PromptBehaviorProfile | null;
}

const PROFESSIONAL_OUTPUT_GOALS = new Set([
    'resume-stories',
    'interview-examples',
    'portfolio',
    'college-statement',
]);
const DEFAULT_EXPLORATION_WEIGHTS = {
    signal: 0.8,
    metric: 0.45,
    lens: 0.55,
    category: 0.7,
} as const;
const DEFAULT_BEHAVIOR_WEIGHTS = {
    signal: 1,
    metric: 1,
    lens: 1,
    category: 0.45,
} as const;

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
            const canUseLocation = await this.hasLocationPermission();
            if (!canUseLocation) {
                return 'unknown';
            }
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
     * Only use location when permission is already granted.
     * This prevents intrusive prompt loops during passive prompt checks.
     */
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
    async generatePrompt(options: ContextPromptOptions = {}): Promise<PromptData> {
        const healthPrompt = this.getHealthPrompt(options.healthContext, options.profile, options.behavior);
        if (healthPrompt) {
            return healthPrompt;
        }

        const context = await this.getContext();
        const prompts = this.getPromptsForContext(context);

        return this.selectPrompt(prompts);
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

        // Location-based prompts
        if (context.isNewLocation) {
            prompts.push(
                { text: "Somewhere new? What's it like?", category: 'exploration', priority: 3, source: 'context' },
                { text: "First time here? What's your impression?", category: 'exploration', priority: 3, source: 'context' }
            );
        }

        // Activity-based prompts
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

        // Default prompt if no context-specific prompts
        if (prompts.length === 0) {
            prompts.push(
                { text: "What's on your mind?", category: 'general', priority: 1, source: 'context' }
            );
        }

        return prompts.sort((a, b) => a.priority - b.priority);
    }

    private getHealthPrompt(
        healthContext?: HealthContextSummary | null,
        profile?: ContextPromptProfile | null,
        behavior?: PromptBehaviorProfile | null
    ): PromptData | null {
        const topSignal = this.selectHealthSignal(healthContext?.signals, profile, behavior);
        if (topSignal) {
            const lens = this.getPromptLens(profile, behavior, topSignal);
            return {
                text: this.buildSignalPrompt(topSignal, lens, profile),
                category: `${topSignal.metric}_${lens}`,
                priority: 1,
                source: 'health',
                lens,
                signalKind: topSignal.kind,
                metric: topSignal.metric,
            };
        }

        return this.getMetricFallbackPrompt(healthContext, profile, behavior);
    }

    private getMetricFallbackPrompt(
        healthContext?: HealthContextSummary | null,
        profile?: ContextPromptProfile | null,
        behavior?: PromptBehaviorProfile | null
    ): PromptData | null {
        if (!healthContext) {
            return null;
        }

        const lens = this.getPromptLens(profile, behavior);

        if (healthContext.sleepHours !== null && healthContext.sleepHours < 6.5) {
            return {
                text: this.formatPromptByWritingPreference(
                    this.buildLensPrompt(
                        lens,
                        'Yesterday looked lighter on sleep.',
                        'What felt hard, and what do you need more of today?',
                        'What made focus harder, and what can you make easier first today?',
                        'What part of that lower-energy day do you want to remember?',
                        'What do you need to protect so the day goes better?'
                    ),
                    profile?.writingPreference
                ),
                category: 'sleep_signal',
                priority: 1,
                source: 'health',
                lens,
                signalKind: 'sleep_deficit',
                metric: 'sleep',
            };
        }

        if (healthContext.activeMinutes !== null && healthContext.activeMinutes >= 35) {
            return {
                text: this.formatPromptByWritingPreference(
                    this.buildLensPrompt(
                        lens,
                        'You had a strong movement day yesterday.',
                        'What gave you energy, and what do you want to keep?',
                        'Did that movement help your mind feel clearer?',
                        'What part of that good-energy day do you want to remember?',
                        'How did that energy help your work or school today?'
                    ),
                    profile?.writingPreference
                ),
                category: 'activity_signal',
                priority: 1,
                source: 'health',
                lens,
                signalKind: 'activity_boost',
                metric: 'activity',
            };
        }

        if (healthContext.steps !== null && healthContext.steps < 4000) {
            return {
                text: this.formatPromptByWritingPreference(
                    this.buildLensPrompt(
                        lens,
                        'Yesterday was lighter on movement.',
                        'What shaped your pace, and how did it affect your day?',
                        'What made the day feel heavy, and what can you clear first?',
                        'What best explains the slower day?',
                        'What got in the way, and what would help next time?'
                    ),
                    profile?.writingPreference
                ),
                category: 'activity_signal',
                priority: 1,
                source: 'health',
                lens,
                signalKind: 'activity_dip',
                metric: 'activity',
            };
        }

        if (
            healthContext.restingHeartRate !== null &&
            healthContext.avgHeartRate !== null &&
            healthContext.avgHeartRate >= healthContext.restingHeartRate + 8
        ) {
            return {
                text: this.formatPromptByWritingPreference(
                    this.buildLensPrompt(
                        lens,
                        'Your recovery markers looked a little elevated yesterday.',
                        'What felt hard in your body or mind?',
                        'What feels heaviest right now?',
                        'What part of that hard day do you want to save?',
                        'What do you need to protect so you can keep going?'
                    ),
                    profile?.writingPreference
                ),
                category: 'recovery_signal',
                priority: 1,
                source: 'health',
                lens,
                signalKind: 'recovery_strain',
                metric: 'recovery',
            };
        }

        return null;
    }

    private selectHealthSignal(
        signals: HealthPromptSignal[] | undefined,
        profile?: ContextPromptProfile | null,
        behavior?: PromptBehaviorProfile | null
    ): HealthPromptSignal | null {
        if (!signals?.length) {
            return null;
        }

        let bestSignal: HealthPromptSignal | null = null;
        let bestScore = Number.NEGATIVE_INFINITY;

        for (const signal of signals) {
            const projectedLens = this.getPromptLens(profile, behavior, signal);
            const weightedScore =
                signal.score +
                this.getProfileSignalBoost(signal, profile, projectedLens) +
                this.getBehaviorSignalBoost(signal, behavior, projectedLens);
            if (weightedScore > bestScore) {
                bestSignal = signal;
                bestScore = weightedScore;
            }
        }

        return bestSignal;
    }

    private getProfileSignalBoost(
        signal: HealthPromptSignal,
        profile?: ContextPromptProfile | null,
        lens: PromptLens = this.getPromptLens(profile)
    ): number {
        const outputGoals = normalizeGoals(profile?.outputGoals);
        const hasProfessionalOutputs = outputGoals.some((goal) => PROFESSIONAL_OUTPUT_GOALS.has(goal));
        const hasCareerFocus = profile?.focusArea === 'career' || hasProfessionalOutputs;

        let boost = 0;

        switch (lens) {
            case 'clarity':
                if (signal.kind === 'sleep_deficit' || signal.kind === 'recovery_strain' || signal.kind === 'activity_dip') {
                    boost += 2;
                }
                break;
            case 'memory':
                if (signal.kind === 'activity_boost' || signal.kind === 'consistency_streak' || signal.kind === 'sleep_recovery') {
                    boost += 2;
                }
                break;
            case 'productivity':
                if (signal.kind === 'activity_boost' || signal.kind === 'consistency_streak') {
                    boost += 2;
                }
                if (signal.kind === 'sleep_deficit' || signal.kind === 'recovery_strain' || signal.kind === 'activity_dip') {
                    boost += 1;
                }
                break;
            case 'growth':
                if (signal.kind === 'sleep_recovery' || signal.kind === 'sleep_deficit' || signal.kind === 'consistency_streak') {
                    boost += 1;
                }
                break;
        }

        if (hasCareerFocus && (signal.kind === 'activity_boost' || signal.kind === 'consistency_streak' || signal.kind === 'sleep_recovery')) {
            boost += 1;
        }

        if (hasCareerFocus && (signal.kind === 'sleep_deficit' || signal.kind === 'recovery_strain')) {
            boost += 1;
        }

        return boost;
    }

    private getBehaviorSignalBoost(
        signal: HealthPromptSignal,
        behavior?: PromptBehaviorProfile | null,
        lens?: PromptLens
    ): number {
        if (!behavior) {
            return 0;
        }

        const policy = this.getPromptPolicy(behavior);
        const categoryKey = lens ? this.getPromptCategoryKey(signal.metric, lens) : null;
        return (
            ((behavior.signalBoosts[signal.kind] || 0) * policy.behaviorWeights.signal) +
            ((behavior.metricBoosts[signal.metric] || 0) * policy.behaviorWeights.metric) +
            this.getExplorationAdjustment(behavior.signalStats[signal.kind], policy.explorationWeights.signal) +
            this.getExplorationAdjustment(behavior.metricStats[signal.metric], policy.explorationWeights.metric) +
            (categoryKey ? (behavior.categoryBoosts[categoryKey] || 0) * policy.behaviorWeights.category : 0) +
            (categoryKey ? this.getExplorationAdjustment(behavior.categoryStats[categoryKey], policy.explorationWeights.category * 0.5) : 0)
        );
    }

    private getPromptPolicy(behavior: PromptBehaviorProfile) {
        return behavior.policy || {
            explorationWeights: DEFAULT_EXPLORATION_WEIGHTS,
            behaviorWeights: DEFAULT_BEHAVIOR_WEIGHTS,
        };
    }

    private getExplorationAdjustment(
        stat: PromptBehaviorStat | undefined,
        weight: number
    ): number {
        if (!stat) {
            return 0;
        }

        return stat.explorationBonus * weight;
    }

    private getPromptCategoryKey(
        metric: HealthPromptSignal['metric'],
        lens: PromptLens
    ): string {
        return `${metric}_${lens}`;
    }

    private buildSignalPrompt(
        signal: HealthPromptSignal,
        lens: PromptLens,
        profile?: ContextPromptProfile | null
    ): string {
        const prompt = this.buildSignalPromptByLens(signal, lens);
        return this.formatPromptByWritingPreference(prompt, profile?.writingPreference);
    }

    private buildSignalPromptByLens(signal: HealthPromptSignal, lens: PromptLens): string {
        switch (signal.kind) {
            case 'sleep_deficit':
                return this.buildLensPrompt(
                    lens,
                    signal.summary,
                    'What felt hard, and what can you learn before the day moves on?',
                    'What made focus harder, and what can you make easier first today?',
                    'What moment from that lower-energy day best shows how it felt?',
                    'What do you need to protect so the day goes better?'
                );
            case 'sleep_recovery':
                return this.buildLensPrompt(
                    lens,
                    signal.summary,
                    'What may have helped you rest better, and what is worth repeating?',
                    'What felt clearer or easier because you rested better?',
                    'What moment best shows how better rest changed the day?',
                    'Where did that extra energy help in work, school, or follow-through?'
                );
            case 'activity_boost':
                return this.buildLensPrompt(
                    lens,
                    signal.summary,
                    'What gave you energy, and what is worth keeping?',
                    'Did that movement help your mind feel clearer?',
                    'What part of that stronger movement day do you want to remember?',
                    'How did that extra movement help your work, school, or follow-through?'
                );
            case 'activity_dip':
                return this.buildLensPrompt(
                    lens,
                    signal.summary,
                    'What got in the way, and what do you want to change next time?',
                    'What made the day feel heavy, and what can you clear first?',
                    'What best explains the slower day?',
                    'What blocked your pace, and what would help next time?'
                );
            case 'recovery_strain':
                return this.buildLensPrompt(
                    lens,
                    signal.summary,
                    'What felt hard, and what can you learn from it?',
                    'What feels heaviest in your body or mind right now?',
                    'What part of that hard day feels important to save?',
                    'What do you need to protect so you can keep going?'
                );
            case 'consistency_streak':
                return this.buildLensPrompt(
                    lens,
                    signal.summary,
                    'What is working, and how can you keep it going this week?',
                    'What feels easier because of this steady rhythm?',
                    'What part of this stretch will you want to remember later?',
                    'What habits are behind this steady run, and how are they helping?'
                );
            default:
                return signal.prompt;
        }
    }

    private buildLensPrompt(
        lens: PromptLens,
        intro: string,
        growthPrompt: string,
        clarityPrompt: string,
        memoryPrompt: string,
        productivityPrompt: string
    ): string {
        const promptByLens: Record<PromptLens, string> = {
            growth: growthPrompt,
            clarity: clarityPrompt,
            memory: memoryPrompt,
            productivity: productivityPrompt,
        };

        return `${intro} ${promptByLens[lens]}`;
    }

    private getPromptLens(
        profile?: ContextPromptProfile | null,
        behavior?: PromptBehaviorProfile | null,
        signal?: HealthPromptSignal | null
    ): PromptLens {
        const scores: Record<PromptLens, number> = {
            clarity: 0,
            memory: 0,
            growth: 0,
            productivity: 0,
        };

        const primaryGoal = hasText(profile?.primaryGoal) ? profile.primaryGoal.trim().toLowerCase() : null;
        if (primaryGoal === 'clarity' || primaryGoal === 'memory' || primaryGoal === 'growth' || primaryGoal === 'productivity') {
            scores[primaryGoal] += 4;
        } else {
            scores.growth += 1;
        }

        const outputGoals = normalizeGoals(profile?.outputGoals);
        if (outputGoals.includes('resume-stories') || outputGoals.includes('interview-examples') || outputGoals.includes('portfolio')) {
            scores.productivity += 2;
        }
        if (outputGoals.includes('self-growth')) {
            scores.growth += 1;
        }

        if (profile?.focusArea === 'career') {
            scores.productivity += 2;
        } else if (profile?.focusArea === 'life') {
            scores.growth += 1.5;
            scores.clarity += 0.5;
        } else if (profile?.focusArea === 'both') {
            scores.growth += 1;
            scores.productivity += 1;
        }

        const writingPreference = hasText(profile?.writingPreference)
            ? profile.writingPreference.trim().toLowerCase()
            : null;
        if (writingPreference === 'structured') {
            scores.productivity += 0.8;
            scores.clarity += 0.6;
        } else if (writingPreference === 'guided') {
            scores.clarity += 0.6;
            scores.growth += 0.4;
        } else if (writingPreference === 'freeform') {
            scores.memory += 0.8;
            scores.growth += 0.4;
        }

        if (behavior) {
            const policy = this.getPromptPolicy(behavior);
            for (const lens of Object.keys(scores) as PromptLens[]) {
                scores[lens] += (behavior.lensBoosts[lens] || 0) * policy.behaviorWeights.lens;
                if (signal) {
                    const categoryKey = this.getPromptCategoryKey(signal.metric, lens);
                    scores[lens] += (behavior.categoryBoosts[categoryKey] || 0) * policy.behaviorWeights.category;
                    scores[lens] += this.getExplorationAdjustment(behavior.categoryStats[categoryKey], policy.explorationWeights.category);
                }
                scores[lens] += this.getExplorationAdjustment(behavior.lensStats[lens], policy.explorationWeights.lens);
            }
        }

        if (signal) {
            const affinity = this.getSignalLensAffinity(signal);
            for (const lens of Object.keys(scores) as PromptLens[]) {
                scores[lens] += affinity[lens];
            }
        }

        let bestLens: PromptLens = 'growth';
        let bestScore = Number.NEGATIVE_INFINITY;

        for (const lens of Object.keys(scores) as PromptLens[]) {
            if (scores[lens] > bestScore) {
                bestLens = lens;
                bestScore = scores[lens];
            }
        }

        return bestLens;
    }

    private getSignalLensAffinity(signal: HealthPromptSignal): Record<PromptLens, number> {
        switch (signal.kind) {
            case 'sleep_deficit':
                return { clarity: 1.8, memory: 0.4, growth: 1.4, productivity: 1.1 };
            case 'sleep_recovery':
                return { clarity: 1.1, memory: 1.2, growth: 1.5, productivity: 1.5 };
            case 'activity_boost':
                return { clarity: 0.6, memory: 1.2, growth: 1.1, productivity: 1.9 };
            case 'activity_dip':
                return { clarity: 1.6, memory: 0.5, growth: 1.0, productivity: 1.5 };
            case 'recovery_strain':
                return { clarity: 1.9, memory: 0.5, growth: 1.4, productivity: 1.0 };
            case 'consistency_streak':
                return { clarity: 1.0, memory: 1.0, growth: 1.4, productivity: 2.0 };
            default:
                return { clarity: 0, memory: 0, growth: 0, productivity: 0 };
        }
    }

    private formatPromptByWritingPreference(prompt: string, writingPreference?: string | null): string {
        const normalizedPreference = hasText(writingPreference)
            ? writingPreference.trim().toLowerCase()
            : null;

        if (normalizedPreference === 'structured') {
            return `${prompt} Try: what happened, what it affected, and what comes next.`;
        }

        if (normalizedPreference === 'freeform') {
            return `${prompt} Let yourself write it out without editing first.`;
        }

        return prompt;
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
