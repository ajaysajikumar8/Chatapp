// controllers/auth.controller.ts

import type { Request, Response } from "express";
import { registerUser, loginUser } from "../services/auth.service.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const register = async (req: Request, res: Response) => {
    try {
        const { email, password, displayName, username } = req.body;

        // 🔹 Basic validation
        if (!email || !password || !displayName || !username) {
            return sendError(res, "All fields are required", 400);
        }

        const result = await registerUser({ email, password, displayName, username });
        return sendSuccess(res, "User registered successfully", result, 201);
    } catch (error: any) {
        console.error("Error in register:", error);
        return sendError(res, error.message, 400);
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        // 🔹 Validation
        if (!email || !password) {
            return sendError(res, "Email and password required", 400);
        }

        const result = await loginUser({ email, password });

        return sendSuccess(res, "Login successful", result);
    } catch (error: any) {
        console.error("Error in login:", error);
        return sendError(res, error.message, 400);
    }
};

export const logout = async (_req: Request, res: Response) => {
    try {
        return sendSuccess(res, "Logout successful", null);
    } catch (error) {
        console.error("Error in logout:", error);
        return sendError(res, "Logout failed");
    }
};