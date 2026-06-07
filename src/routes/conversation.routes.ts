import { Router } from "express";
import { getUserConversations, createConversation, markConversationRead, muteConversation, getConversationAttachments } from "../controllers/conversation.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

// GET /conversations
router.get("/", authMiddleware, getUserConversations);
router.post("/", authMiddleware, createConversation);
router.post("/:id/read", authMiddleware, markConversationRead);
router.post("/:id/mute", authMiddleware, muteConversation);
router.get("/:id/attachments", authMiddleware, getConversationAttachments);

export default router;