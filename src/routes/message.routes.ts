import { Router } from 'express';
import { getMessages, sendMessage, updateMessage, deleteMessage } from '../controllers/message.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/:conversationId', getMessages);
router.post('/:conversationId', sendMessage);
router.put('/:id', updateMessage);
router.delete('/:id', deleteMessage);

export default router;