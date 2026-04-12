import { User } from '@prisma/client';
import { Resend } from 'resend';
import { getConfiguredClientUrl } from '../config/public-env';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Notive <noreply@notive.app>';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export class EmailService {
    async sendPasswordResetEmail(user: User, token: string): Promise<void> {
        const clientUrl = getConfiguredClientUrl();
        if (!clientUrl) {
            throw new Error('CLIENT_URL or FRONTEND_URL is required to send password reset emails.');
        }

        const resetLink = `${clientUrl}/reset-password?token=${token}`;
        const name = user.name || 'Traveler';

        if (!resend) {
            console.log('---------------------------------------------------------');
            console.log(`[Email Dev] Password reset for ${user.email}: ${resetLink}`);
            console.log('---------------------------------------------------------');
            return;
        }

        await resend.emails.send({
            from: EMAIL_FROM,
            to: user.email,
            subject: 'Reset your Notive password',
            html: `
                <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #26221e;">
                    <h2 style="font-size: 20px; margin-bottom: 16px;">Password Reset</h2>
                    <p>Hello ${name},</p>
                    <p>You requested a password reset for your Notive account. Click the button below to choose a new password:</p>
                    <p style="text-align: center; margin: 28px 0;">
                        <a href="${resetLink}" style="display: inline-block; padding: 12px 28px; background: #26221e; color: #fffbf5; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">
                            Reset Password
                        </a>
                    </p>
                    <p style="font-size: 13px; color: #6b6560;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
                    <hr style="border: none; border-top: 1px solid #e8e2da; margin: 24px 0;" />
                    <p style="font-size: 12px; color: #9a9490;">Notive &mdash; your private notebook</p>
                </div>
            `,
        });
    }

    async sendEmailChangeAlert(input: {
        previousEmail: string;
        nextEmail: string;
        name?: string | null;
    }): Promise<void> {
        const name = input.name || 'Traveler';

        if (!resend) {
            console.log('---------------------------------------------------------');
            console.log(`[Email Dev] Email change alert: ${input.previousEmail} -> ${input.nextEmail}`);
            console.log('---------------------------------------------------------');
            return;
        }

        await resend.emails.send({
            from: EMAIL_FROM,
            to: input.previousEmail,
            subject: 'Your Notive sign-in email was changed',
            html: `
                <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #26221e;">
                    <h2 style="font-size: 20px; margin-bottom: 16px;">Email Address Changed</h2>
                    <p>Hello ${name},</p>
                    <p>Your Notive sign-in email was changed from <strong>${input.previousEmail}</strong> to <strong>${input.nextEmail}</strong>.</p>
                    <p>If you did not make this change, please secure your account immediately by resetting your password.</p>
                    <hr style="border: none; border-top: 1px solid #e8e2da; margin: 24px 0;" />
                    <p style="font-size: 12px; color: #9a9490;">Notive &mdash; your private notebook</p>
                </div>
            `,
        });
    }
}

export const emailService = new EmailService();
