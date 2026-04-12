// Message controller CRUD handlers.

import type { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response.js';
// TODO: Import Prisma client here
// import { prisma } from '../lib/prisma.js';

export const getMessages = async (req: Request, res: Response): Promise<void> => {
    try {
        // TODO: Fetch all messages for a conversation from the database
        sendSuccess(res, "Messages fetched successfully", []);
    } catch (error) {
        sendError(res, 'Failed to fetch messages');
    }
};

export const getMessageById = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        // TODO: Fetch a single message by id from the database
        // TODO: Return 404 if not found
        sendSuccess(res, "Message fetched successfully", {});
    } catch (error) {
        sendError(res, 'Failed to fetch message');
    }
};

export const sendMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        // TODO: Create and save a new message using req.body
        sendSuccess(res, "Message sent successfully", {}, 201);
    } catch (error) {
        sendError(res, 'Failed to send message', 400);
    }
};

export const updateMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        // TODO: Find message by id and update it with req.body
        sendSuccess(res, "Message updated successfully", {});
    } catch (error) {
        sendError(res, 'Failed to update message', 400);
    }
};

export const deleteMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        // TODO: Delete message by id from the database
        sendSuccess(res, "Message deleted successfully", null, 204);
    } catch (error) {
        sendError(res, 'Failed to delete message');
    }
};