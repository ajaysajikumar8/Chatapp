import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { subscribe, unsubscribe } from '../controllers/push.controller.js';

const router = Router();

router.post('/subscribe', authMiddleware, subscribe);
router.post('/unsubscribe', authMiddleware, unsubscribe);

export default router;
