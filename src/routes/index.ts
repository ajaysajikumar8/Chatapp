// routes/index.ts
import { Router } from 'express';
import authRoutes from './auth.routes.js';
import messageRoutes from './message.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/messages', messageRoutes);

export default router;