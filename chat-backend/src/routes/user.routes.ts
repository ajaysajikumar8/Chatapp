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
    getBlockedUsersHandler,
    getUserProfileHandler
} from "../controllers/user.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { searchRateLimiter, uploadRateLimiter } from "../middleware/rateLimit.middleware.js";

const router = Router();

// Protect all user routes
router.use(authMiddleware);

router.get("/", searchRateLimiter, searchUsers);

// Profile & Settings
router.get("/me", getMyProfile);
router.get("/:userId/profile", getUserProfileHandler);
router.put("/me/profile", updateMyProfile);
router.put("/me/settings", updateMySettings);
router.post("/me/avatar-upload", uploadRateLimiter, requestAvatarUpload);
router.put("/me/avatar-complete", completeAvatarUpload);

// Block/Safety
router.get("/me/blocked", getBlockedUsersHandler);
router.post("/me/block/:userId", blockUserHandler);
router.delete("/me/block/:userId", unblockUserHandler);

export default router;
