// routes/auth.routes.ts

// this file defines the authentication routes for the application, including registration and login endpoints. 

import { Router } from 'express';
import { register, login } from '../controllers/auth.controller.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);

export default router;