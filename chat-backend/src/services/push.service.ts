import webpush from 'web-push';
import { prisma } from '../lib/prisma.js';
import "../lib/env.js";

webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:test@example.com',
    process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || '',
    process.env.VAPID_PRIVATE_KEY || ''
);

export const sendPushNotification = async (userId: string, payload: any) => {
    try {
        const subscriptions = await prisma.pushSubscription.findMany({
            where: { userId },
        });

        if (subscriptions.length === 0) return;

        const notifications = subscriptions.map(async (sub) => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    auth: sub.auth,
                    p256dh: sub.p256dh,
                },
            };

            try {
                await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
            } catch (error: any) {
                if (error.statusCode === 404 || error.statusCode === 410) {
                    console.log(`Subscription has expired or is no longer valid: ${sub.endpoint}`);
                    await prisma.pushSubscription.delete({ where: { id: sub.id } });
                } else {
                    console.error('Error sending push notification:', error);
                }
            }
        });

        await Promise.all(notifications);
    } catch (error) {
        console.error('Failed to send push notifications:', error);
    }
};
