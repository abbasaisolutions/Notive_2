// Health Cron Jobs - Scheduled tasks for health data sync
// File: backend/src/services/health-cron.service.ts

import { healthSyncService } from './health-sync.service';
import { healthInsightsService } from './health-insights.service';

// Simple cron implementation using setInterval
// For production, consider using node-cron or bull queue

interface CronJob {
    name: string;
    interval: number; // milliseconds
    handler: () => Promise<void>;
    timer?: NodeJS.Timeout;
}

class HealthCronService {
    private jobs: CronJob[] = [];
    private isRunning = false;

    constructor() {
        // Define scheduled jobs
        this.jobs = [
            {
                name: 'daily-health-sync',
                interval: 6 * 60 * 60 * 1000, // Every 6 hours
                handler: this.dailyHealthSync.bind(this),
            },
            {
                name: 'weekly-insights-generation',
                interval: 24 * 60 * 60 * 1000, // Every 24 hours
                handler: this.generateWeeklyInsights.bind(this),
            },
        ];
    }

    /**
     * Start all cron jobs
     */
    start(): void {
        if (this.isRunning) {
            console.log('Health cron jobs already running');
            return;
        }

        console.log('Starting health cron jobs...');
        
        for (const job of this.jobs) {
            // Run immediately on start, then at interval
            this.runJob(job);
            job.timer = setInterval(() => this.runJob(job), job.interval);
            console.log(`Scheduled job: ${job.name} (every ${job.interval / 1000 / 60} minutes)`);
        }

        this.isRunning = true;
    }

    /**
     * Stop all cron jobs
     */
    stop(): void {
        console.log('Stopping health cron jobs...');
        
        for (const job of this.jobs) {
            if (job.timer) {
                clearInterval(job.timer);
                job.timer = undefined;
            }
        }

        this.isRunning = false;
    }

    /**
     * Run a specific job with error handling
     */
    private async runJob(job: CronJob): Promise<void> {
        console.log(`Running cron job: ${job.name}`);
        
        try {
            await job.handler();
            console.log(`Completed cron job: ${job.name}`);
        } catch (error) {
            console.error(`Error in cron job ${job.name}:`, error);
        }
    }

    /**
     * Daily health sync - Fetch yesterday's data for all connected users
     */
    private async dailyHealthSync(): Promise<void> {
        const result = await healthSyncService.syncAllUsers();
        console.log(`Daily health sync: ${result.success} synced, ${result.failed} failed`);
    }

    /**
     * Generate weekly insights for users with health data
     */
    private async generateWeeklyInsights(): Promise<void> {
        try {
            // Only run on Sundays (or whenever this is called after a week)
            const today = new Date();
            if (today.getDay() === 0) { // Sunday
                await healthInsightsService.generateWeeklyInsightsForAllUsers();
                console.log('Weekly insights generation completed');
            }
        } catch (error) {
            console.error('Failed to generate weekly insights:', error);
        }
    }

    /**
     * Manual trigger for health sync (for testing or manual refresh)
     */
    async triggerSync(userId?: string): Promise<{ success: number; failed: number }> {
        if (userId) {
            const result = await healthSyncService.syncUserHealth(userId);
            return { success: result ? 1 : 0, failed: result ? 0 : 1 };
        }
        return healthSyncService.syncAllUsers();
    }
}

export const healthCronService = new HealthCronService();
export default healthCronService;
