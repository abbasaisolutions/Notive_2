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

    /** Weekly digest email — delivers the insight-engine output to the user. */
    async sendWeeklyDigest(user: User, digest: {
        title: string;
        editorial: string;
        highlights: Array<{ category: string; insight: string }>;
    }): Promise<void> {
        const clientUrl = getConfiguredClientUrl();
        const name = user.name || 'there';

        const highlightsHtml = digest.highlights
            .map(h => `
                <div style="margin-bottom:12px; padding:12px; background:#f5f0ea; border-radius:8px;">
                    <p style="font-size:11px; text-transform:uppercase; letter-spacing:0.08em; color:#8a9a6f; margin:0 0 4px;">${h.category}</p>
                    <p style="font-size:14px; color:#26221e; margin:0;">${h.insight}</p>
                </div>
            `).join('');

        const html = `
            <div style="font-family:Georgia,'Times New Roman',serif; max-width:480px; margin:0 auto; padding:32px 24px; color:#26221e;">
                <p style="font-size:11px; text-transform:uppercase; letter-spacing:0.1em; color:#8a9a6f; margin:0 0 8px;">Weekly summary from Notive</p>
                <h2 style="font-size:22px; margin:0 0 20px; font-style:italic;">${digest.title}</h2>
                <p style="font-size:14px; color:#3d3730; margin-bottom:8px;">Hey ${name},</p>
                <p style="font-size:15px; line-height:1.7; color:#3d3730;">
                    ${digest.editorial.replace(/\n\n/g, '</p><p style="font-size:15px;line-height:1.7;color:#3d3730;margin-top:12px;">')}
                </p>
                <div style="margin:24px 0;">
                    ${highlightsHtml}
                </div>
                ${clientUrl ? `<a href="${clientUrl}/dashboard" style="display:inline-block; padding:10px 24px; background:#26221e; color:#fffbf5; border-radius:8px; font-size:13px; text-decoration:none; font-weight:600;">Open Notive</a>` : ''}
                <hr style="border:none; border-top:1px solid #e8e2da; margin:24px 0;" />
                <p style="font-size:11px; color:#9a9490;">Notive &mdash; your private notebook</p>
            </div>
        `;

        if (!resend) {
            console.log('---------------------------------------------------------');
            console.log(`[Email Dev] Weekly digest for ${user.email}: ${digest.title}`);
            console.log('---------------------------------------------------------');
            return;
        }

        await resend.emails.send({
            from: EMAIL_FROM,
            to: user.email,
            subject: `Your week: ${digest.title}`,
            html,
        });
    }

    /** Welcome email sent immediately after registration. */
    async sendWelcomeEmail(user: User): Promise<void> {
        const clientUrl = getConfiguredClientUrl();
        const name = user.name || 'there';

        const html = `
            <div style="font-family:Georgia,'Times New Roman',serif; max-width:480px; margin:0 auto; padding:32px 24px; color:#26221e;">
                <h2 style="font-size:22px; margin:0 0 16px; font-style:italic;">Welcome to Notive</h2>
                <p style="font-size:15px; line-height:1.7; color:#3d3730;">
                    Hey ${name}, glad you're here.
                </p>
                <p style="font-size:15px; line-height:1.7; color:#3d3730; margin-top:12px;">
                    Notive is your private diary &mdash; write about your day, your work, whatever's on your mind.
                    After a few entries, Notive starts extracting lessons, skills, patterns, and stories from what you write.
                    No extra steps &mdash; just keep writing.
                </p>
                <p style="font-size:15px; line-height:1.7; color:#3d3730; margin-top:12px;">
                    Notive starts working from your very first entry. The more you write, the more it finds.
                </p>
                ${clientUrl ? `
                <p style="text-align:center; margin:28px 0;">
                    <a href="${clientUrl}/entry/new?source=welcome_email" style="display:inline-block; padding:12px 28px; background:#26221e; color:#fffbf5; border-radius:8px; text-decoration:none; font-size:14px; font-weight:600;">
                        Write your first note
                    </a>
                </p>` : ''}
                <hr style="border:none; border-top:1px solid #e8e2da; margin:24px 0;" />
                <p style="font-size:11px; color:#9a9490;">Notive &mdash; your private notebook</p>
            </div>
        `;

        if (!resend) {
            console.log('---------------------------------------------------------');
            console.log(`[Email Dev] Welcome email for ${user.email}`);
            console.log('---------------------------------------------------------');
            return;
        }

        await resend.emails.send({
            from: EMAIL_FROM,
            to: user.email,
            subject: "Welcome to Notive \u2728",
            html,
        });
    }

    /** Re-engagement email for users inactive 7-21 days. */
    async sendReEngagementEmail(user: User, stats: {
        entryCount: number;
        daysSince: number;
        savedStoryCount?: number;
    }): Promise<void> {
        const clientUrl = getConfiguredClientUrl();
        const name = user.name || 'there';

        const extractionLine = stats.savedStoryCount && stats.savedStoryCount > 0
            ? `<p style="font-size:15px; line-height:1.7; color:#3d3730; margin-top:12px;">You have <strong>${stats.savedStoryCount} saved ${stats.savedStoryCount === 1 ? 'story' : 'stories'}</strong> waiting in Stories.</p>`
            : '';

        const html = `
            <div style="font-family:Georgia,'Times New Roman',serif; max-width:480px; margin:0 auto; padding:32px 24px; color:#26221e;">
                <h2 style="font-size:22px; margin:0 0 16px; font-style:italic;">Your notes are still here</h2>
                <p style="font-size:15px; line-height:1.7; color:#3d3730;">
                    Hey ${name}, it's been ${stats.daysSince} days since your last entry.
                    You've written <strong>${stats.entryCount} ${stats.entryCount === 1 ? 'note' : 'notes'}</strong> so far &mdash; everything is right where you left it.
                </p>
                ${extractionLine}
                ${clientUrl ? `
                <p style="text-align:center; margin:28px 0;">
                    <a href="${clientUrl}/entry/new?source=reengagement_email" style="display:inline-block; padding:12px 28px; background:#26221e; color:#fffbf5; border-radius:8px; text-decoration:none; font-size:14px; font-weight:600;">
                        Pick up where you left off
                    </a>
                </p>` : ''}
                <hr style="border:none; border-top:1px solid #e8e2da; margin:24px 0;" />
                <p style="font-size:11px; color:#9a9490;">Notive &mdash; your private notebook</p>
            </div>
        `;

        if (!resend) {
            console.log('---------------------------------------------------------');
            console.log(`[Email Dev] Re-engagement email for ${user.email} (${stats.daysSince} days)`);
            console.log('---------------------------------------------------------');
            return;
        }

        await resend.emails.send({
            from: EMAIL_FROM,
            to: user.email,
            subject: 'Your notes are still here',
            html,
        });
    }
}

export const emailService = new EmailService();
