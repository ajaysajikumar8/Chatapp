import rateLimit from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";

export const isProductionSafeguardsEnabled = 
  process.env.NODE_ENV === "production";

// Helper function to create conditional rate limiters
const createConditionalLimiter = (options: {
  windowMs: number;
  max: number;
  message: string;
}) => {
  const limiter = rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        message: `${options.message} Note: This application is running as a demo on limited resources.`
      });
    }
  });

  return (req: Request, res: Response, next: NextFunction) => {
    if (!isProductionSafeguardsEnabled) {
      return next();
    }
    return limiter(req, res, next);
  };
};

// 1. General API Rate Limiter
export const apiRateLimiter = createConditionalLimiter({
  windowMs: process.env.API_LIMIT_WINDOW_MS ? parseInt(process.env.API_LIMIT_WINDOW_MS, 10) : 5 * 60 * 1000, // default 5 mins
  max: process.env.API_LIMIT_MAX ? parseInt(process.env.API_LIMIT_MAX, 10) : 100, // default 100 requests
  message: "Too many requests. Please try again later."
});

// 2. Login Rate Limiter
export const loginRateLimiter = createConditionalLimiter({
  windowMs: process.env.LOGIN_LIMIT_WINDOW_MS ? parseInt(process.env.LOGIN_LIMIT_WINDOW_MS, 10) : 15 * 60 * 1000, // default 15 mins
  max: process.env.LOGIN_LIMIT_MAX ? parseInt(process.env.LOGIN_LIMIT_MAX, 10) : 5, // default 5 attempts
  message: "Too many login attempts. Please try again in 15 minutes."
});

// 3. Register Rate Limiter
export const registerRateLimiter = createConditionalLimiter({
  windowMs: process.env.REGISTER_LIMIT_WINDOW_MS ? parseInt(process.env.REGISTER_LIMIT_WINDOW_MS, 10) : 60 * 60 * 1000, // default 1 hour
  max: process.env.REGISTER_LIMIT_MAX ? parseInt(process.env.REGISTER_LIMIT_MAX, 10) : 3, // default 3 registrations
  message: "Too many registration attempts. Please try again in an hour."
});

// 4. Message Send Rate Limiter
export const messageRateLimiter = createConditionalLimiter({
  windowMs: process.env.MESSAGE_LIMIT_WINDOW_MS ? parseInt(process.env.MESSAGE_LIMIT_WINDOW_MS, 10) : 60 * 1000, // default 1 minute
  max: process.env.MESSAGE_LIMIT_MAX ? parseInt(process.env.MESSAGE_LIMIT_MAX, 10) : 30, // default 30 messages
  message: "Too many messages sent. Please slow down."
});

// 5. Search Rate Limiter
export const searchRateLimiter = createConditionalLimiter({
  windowMs: process.env.SEARCH_LIMIT_WINDOW_MS ? parseInt(process.env.SEARCH_LIMIT_WINDOW_MS, 10) : 60 * 1000, // default 1 minute
  max: process.env.SEARCH_LIMIT_MAX ? parseInt(process.env.SEARCH_LIMIT_MAX, 10) : 20, // default 20 searches
  message: "Too many search requests. Please slow down."
});

// 6. Upload Request Rate Limiter
export const uploadRateLimiter = createConditionalLimiter({
  windowMs: process.env.UPLOAD_LIMIT_WINDOW_MS ? parseInt(process.env.UPLOAD_LIMIT_WINDOW_MS, 10) : 60 * 1000, // default 1 minute
  max: process.env.UPLOAD_LIMIT_MAX ? parseInt(process.env.UPLOAD_LIMIT_MAX, 10) : 5, // default 5 uploads
  message: "Too many upload attempts. Please try again in a minute."
});

// 7. Push Subscription Rate Limiter
export const pushRateLimiter = createConditionalLimiter({
  windowMs: process.env.PUSH_LIMIT_WINDOW_MS ? parseInt(process.env.PUSH_LIMIT_WINDOW_MS, 10) : 60 * 1000, // default 1 minute
  max: process.env.PUSH_LIMIT_MAX ? parseInt(process.env.PUSH_LIMIT_MAX, 10) : 5, // default 5 subscription changes
  message: "Too many notification settings changes. Please try again later."
});
