import { Capacitor, registerPlugin } from '@capacitor/core';

type NotificationSettingsPlugin = {
    open: () => Promise<void>;
};

const NotificationSettings = registerPlugin<NotificationSettingsPlugin>('NotificationSettings');

export async function openNativeNotificationSettings(): Promise<boolean> {
    if (Capacitor.getPlatform() !== 'android') return false;

    try {
        await NotificationSettings.open();
        return true;
    } catch {
        return false;
    }
}
