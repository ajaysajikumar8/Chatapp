// src/routes/message.routes.ts

import { Router } from 'express';
import { getMessages, sendMessage } from '../controllers/message.controller';

const router = Router();

// GET messages for a conversation
router.get('/:conversationId', getMessages);

// Send a message
router.post('/', sendMessage);

export default router;