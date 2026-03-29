// src/routes/message.routes.ts
// This file defines the routes for message-related operations, such as fetching messages for a conversation.

import { Router } from 'express';
import { getMessages } from '../controllers/message.controller.js';

const router = Router();

// GET messages for a conversation
router.get('/:conversationId', getMessages);

export default router;