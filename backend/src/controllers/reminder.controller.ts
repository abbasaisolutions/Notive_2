import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { ReminderService, ReminderInput } from '../services/reminder.service';

const service = new ReminderService(prisma);

export async function getReminder(req: Request, res: Response): Promise<void> {
    try {
        const reminder = await service.getReminder(req.userId!);
        res.json({ data: reminder });
    } catch (error) {
        console.error('[ReminderController] getReminder error:', error);
        res.status(500).json({ message: 'Failed to fetch reminder' });
    }
}

export async function upsertReminder(req: Request, res: Response): Promise<void> {
    try {
        const { time, days, timezone, enabled } = req.body as ReminderInput;

        if (!time || typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) {
            res.status(400).json({ message: 'Invalid time format. Expected HH:MM.' });
            return;
        }
        if (!Array.isArray(days) || days.some(d => typeof d !== 'number' || d < 0 || d > 6)) {
            res.status(400).json({ message: 'days must be an array of integers 0–6.' });
            return;
        }
        if (!timezone || typeof timezone !== 'string') {
            res.status(400).json({ message: 'timezone is required.' });
            return;
        }

        const reminder = await service.upsertReminder(req.userId!, {
            time,
            days,
            timezone,
            enabled: enabled !== false,
        });

        res.json({ data: reminder });
    } catch (error) {
        console.error('[ReminderController] upsertReminder error:', error);
        res.status(500).json({ message: 'Failed to save reminder' });
    }
}

export async function deleteReminder(req: Request, res: Response): Promise<void> {
    try {
        await service.deleteReminder(req.userId!);
        res.json({ success: true });
    } catch (error) {
        console.error('[ReminderController] deleteReminder error:', error);
        res.status(500).json({ message: 'Failed to delete reminder' });
    }
}
