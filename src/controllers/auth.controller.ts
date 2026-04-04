// controllers/auth.controller.ts

import type { Request, Response } from "express";
import { registerUser, loginUser } from "../services/auth.service.js";

export const register = async (req: Request, res: Response) => {
    try {
        const { email, password, username } = req.body;

        // 🔹 Basic validation
        if (!email || !password || !username) {
            return res.status(400).json({ error: "All fields are required" });
        }

        const result = await registerUser({ email, password, username });

        return res.status(201).json({
            message: "User registered successfully",
            ...result,
        });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        // 🔹 Validation
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password required" });
        }

        const result = await loginUser({ email, password });

        return res.status(200).json({
            message: "Login successful",
            ...result,
        });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
};

export const logout = async (_req: Request, res: Response) => {
    try {
        return res.status(200).json({ message: "Logout successful" });
    } catch {
        return res.status(500).json({ error: "Logout failed" });
    }
};