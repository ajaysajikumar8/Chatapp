// services/auth.service.ts

import { prisma } from "../lib/prisma.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { generateToken } from "../utils/jwt.js";

export const registerUser = async ({
    email,
    password,
    displayName,
    username,
}: {
    email: string;
    password: string;
    displayName: string;
    username: string;
}) => {
    // 🔹 Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // 🔹 Check existing user by email
    const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail }
    });

    if (existingUser) {
        throw new Error("User with that email already exists");
    }

    // 🔹 Check existing user by username
    const existingProfile = await prisma.userProfile.findUnique({
        where: { username }
    });

    if (existingProfile) {
        throw new Error("User with that username already exists");
    }

    // 🔹 Hash password
    const passwordHash = await hashPassword(password);

    // 🔹 Create user with nested profile and settings
    const user = await prisma.user.create({
        data: {
            email: normalizedEmail,
            passwordHash,
            profile: {
                create: {
                    username,
                    displayName,
                }
            },
            settings: {
                create: {}
            }
        },
        include: {
            profile: true
        }
    });

    // 🔹 Generate token
    const token = generateToken(user.id);

    return {
        token,
        user: {
            id: user.id,
            email: user.email,
            username: user.profile?.username || "",
            displayName: user.profile?.displayName || "",
        },
    };
};

export const loginUser = async ({
    email,
    password,
}: {
    email: string;
    password: string;
}) => {
    // 🔹 Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // 🔹 Find user
    const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: {
            profile: true
        }
    });

    if (!user) {
        throw new Error("Invalid credentials");
    }

    // 🔹 Compare password
    const isMatch = await comparePassword(password, user.passwordHash);

    if (!isMatch) {
        throw new Error("Invalid credentials");
    }

    // 🔹 Generate token
    const token = generateToken(user.id);

    return {
        token,
        user: {
            id: user.id,
            email: user.email,
            username: user.profile?.username || "",
            displayName: user.profile?.displayName || "",
        },
    };
};