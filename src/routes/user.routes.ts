import { Router } from "express";
import { searchUsers } from "../controllers/user.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

// Protect all user routes
router.use(authMiddleware);

router.get("/", searchUsers);

export default router;
