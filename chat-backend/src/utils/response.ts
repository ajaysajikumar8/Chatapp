import type { Response } from "express";

export const sendSuccess = <T>(
    res: Response,
    message: string,
    data: T,
    statusCode: number = 200
): Response => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
    });
};

export const sendError = (
    res: Response,
    message: string,
    statusCode: number = 500
): Response => {
    return res.status(statusCode).json({
        success: false,
        message,
    });
};
