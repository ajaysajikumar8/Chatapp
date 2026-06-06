import { Router } from "express";
import { 
    searchUsers,
    getMyProfile,
    updateMyProfile,
    updateMySettings,
    requestAvatarUpload,
    completeAvatarUpload,
    blockUserHandler,
    unblockUserHandler,
    getBlockedUsersHandler
} from "../controllers/user.controller.js";
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

// Profile & Settings
router.get("/me", getMyProfile);
router.put("/me/profile", updateMyProfile);
router.put("/me/settings", updateMySettings);
router.post("/me/avatar-upload", requestAvatarUpload);
router.put("/me/avatar-complete", completeAvatarUpload);

// Block/Safety
router.get("/me/blocked", getBlockedUsersHandler);
router.post("/me/block/:userId", blockUserHandler);
router.delete("/me/block/:userId", unblockUserHandler);

export default router;
