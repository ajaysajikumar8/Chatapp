import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const subscribe = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const subscription = req.body;
        
        if (!subscription || !subscription.endpoint || !subscription.keys) {
            sendError(res, "Invalid subscription object", 400);
            return;
        }

        // Upsert subscription
        await prisma.pushSubscription.upsert({
            where: { endpoint: subscription.endpoint },
            update: {
                userId,
                auth: subscription.keys.auth,
                p256dh: subscription.keys.p256dh,
            },
            create: {
                userId,
                endpoint: subscription.endpoint,
                auth: subscription.keys.auth,
                p256dh: subscription.keys.p256dh,
            },
        });

        sendSuccess(res, "Subscribed successfully", null, 201);
    } catch (error: any) {
        console.error("Error in subscribe:", error);
        sendError(res, error.message || 'Failed to subscribe', 500);
    }
};

export const unsubscribe = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.id;
        const { endpoint } = req.body;

        if (!endpoint) {
            sendError(res, "Endpoint is required", 400);
            return;
        }

        await prisma.pushSubscription.deleteMany({
            where: {
                userId,
                endpoint
            }
        });

        sendSuccess(res, "Unsubscribed successfully", null);
    } catch (error: any) {
        console.error("Error in unsubscribe:", error);
        sendError(res, error.message || 'Failed to unsubscribe', 500);
    }
};
