import { Router } from "express";
import { searchUsers } from "../controllers/user.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import rateLimit from "express-rate-limit";

const router = Router();

const searchRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // Limit each IP to 30 requests per `window` (here, per minute)
    message: "Too many search requests from this IP, please try again after a minute",
    standardHeaders: true,
    legacyHeaders: false,
});

// Protect all user routes
router.use(authMiddleware);

router.get("/", searchRateLimiter, searchUsers);

export default router;
