import { Router } from "express";
import { getUserConversations,createConversation } from "../controllers/conversation.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

// GET /conversations
router.get("/", authMiddleware, getUserConversations);
router.post("/", authMiddleware, createConversation);

export default router;