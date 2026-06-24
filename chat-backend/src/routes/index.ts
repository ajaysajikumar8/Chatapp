// routes/index.ts
// This file aggregates all route modules and exports a single router for the app.

import { Router } from 'express';
import authRoutes from './auth.routes.js';
import messageRoutes from './message.routes.js';
import conversationRoutes from "./conversation.routes.js"
import userRoutes from "./user.routes.js"
import pushRoutes from "./push.routes.js"

const router = Router();

router.use('/auth', authRoutes);
router.use('/messages', messageRoutes);
router.use('/conversations', conversationRoutes);
router.use('/users', userRoutes);
router.use('/push', pushRoutes);

// Health check endpoint for frontend cold-start detection
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

export default router;