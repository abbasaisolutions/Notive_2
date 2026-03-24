import { User } from '@prisma/client';
import { getConfiguredClientUrl } from '../config/public-env';

/**
 * Service to handle email sending
 * Currently mocks email sending by logging to console in development
 */
export class EmailService {
    /**
     * Send a password reset email
     */
    async sendPasswordResetEmail(user: User, token: string): Promise<void> {
        // In a real app, this would use a template and an email provider like SendGrid or AWS SES
        const clientUrl = getConfiguredClientUrl();
        if (!clientUrl) {
            throw new Error('CLIENT_URL or FRONTEND_URL is required to send password reset emails.');
        }

        const resetLink = `${clientUrl}/reset-password?token=${token}`;

        console.log('---------------------------------------------------------');
        console.log(`[Email Mock] Sending Password Reset Email to ${user.email}`);
        console.log(`Subject: Reset your Notive password`);
        console.log(`Body:`);
        console.log(`Hello ${user.name || 'Traveler'},`);
        console.log(`You requested a password reset. Please click the link below to reset your password:`);
        console.log(resetLink);
        console.log(`This link will expire in 1 hour.`);
        console.log(`If you didn't request this, please ignore this email.`);
        console.log('---------------------------------------------------------');

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    /**
     * Send a welcome email
     */
    async sendWelcomeEmail(user: User): Promise<void> {
        console.log('---------------------------------------------------------');
        console.log(`[Email Mock] Sending Welcome Email to ${user.email}`);
        console.log(`Subject: Welcome to Notive!`);
        console.log(`Body:`);
        console.log(`Hello ${user.name || 'Traveler'},`);
        console.log(`Welcome to Notive. Your journey of self-reflection begins now.`);
        console.log('---------------------------------------------------------');
    }

    async sendEmailChangeAlert(input: {
        previousEmail: string;
        nextEmail: string;
        name?: string | null;
    }): Promise<void> {
        console.log('---------------------------------------------------------');
        console.log(`[Email Mock] Sending Email Change Alert`);
        console.log(`Previous email: ${input.previousEmail}`);
        console.log(`Next email: ${input.nextEmail}`);
        console.log(`Body:`);
        console.log(`Hello ${input.name || 'Traveler'},`);
        console.log(`Your Notive sign-in email was changed from ${input.previousEmail} to ${input.nextEmail}.`);
        console.log(`If you did not make this change, secure your account immediately.`);
        console.log('---------------------------------------------------------');

        await new Promise(resolve => setTimeout(resolve, 300));
    }
}

export const emailService = new EmailService();
    
