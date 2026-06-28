import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { subscribe, unsubscribe } from '../controllers/push.controller.js';
import { pushRateLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

router.post('/subscribe', authMiddleware, pushRateLimiter, subscribe);
router.post('/unsubscribe', authMiddleware, pushRateLimiter, unsubscribe);

export default router;
