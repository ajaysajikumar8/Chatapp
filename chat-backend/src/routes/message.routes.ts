import { Router } from 'express';
import { getMessages, sendMessage, sendDirectMessage, updateMessage, deleteMessage, generateUploadUrl, getDownloadUrl } from '../controllers/message.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { messageRateLimiter, uploadRateLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

router.use(authMiddleware);

router.post('/presigned-url', uploadRateLimiter, generateUploadUrl);
router.post('/direct/:userId', messageRateLimiter, sendDirectMessage);
router.get('/:id/download-url', getDownloadUrl);
router.get('/:conversationId', getMessages);
router.post('/:conversationId', messageRateLimiter, sendMessage);
router.put('/:id', updateMessage);
router.delete('/:id', deleteMessage);

export default router;