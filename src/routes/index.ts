// routes/index.ts
// This file aggregates all route modules and exports a single router for the app.

import { Router } from 'express';
import authRoutes from './auth.routes.js';
import messageRoutes from './message.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/messages', messageRoutes);

export default router;