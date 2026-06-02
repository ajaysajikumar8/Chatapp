import { Router } from 'express';
import { getMessages, sendMessage, sendDirectMessage, updateMessage, deleteMessage, generateUploadUrl, getDownloadUrl } from '../controllers/message.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.post('/presigned-url', generateUploadUrl);
router.post('/direct/:userId', sendDirectMessage);
router.get('/:id/download-url', getDownloadUrl);
router.get('/:conversationId', getMessages);
router.post('/:conversationId', sendMessage);
router.put('/:id', updateMessage);
router.delete('/:id', deleteMessage);

export default router;