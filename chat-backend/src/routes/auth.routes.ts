// routes/auth.routes.ts

// this file defines the authentication routes for the application, including registration and login endpoints. 

import { Router } from 'express';
import { register, login } from '../controllers/auth.controller.js';
import { registerRateLimiter, loginRateLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

router.post('/register', registerRateLimiter, register);
router.post('/login', loginRateLimiter, login);

export default router;