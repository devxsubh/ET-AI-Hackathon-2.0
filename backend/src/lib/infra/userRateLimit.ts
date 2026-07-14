import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request, Response } from "express";

function minutes(value: number): number {
  return value * 60 * 1000;
}

type UserRateLimiterOptions = {
  bucket: string;
  max: number;
  windowMinutes?: number;
  message?: string;
};

export function createUserRateLimiter(
  maxOrOptions: number | UserRateLimiterOptions,
  legacyWindowMinutes = 15,
) {
  const options: UserRateLimiterOptions =
    typeof maxOrOptions === "number"
      ? {
          bucket: "chat",
          max: maxOrOptions,
          windowMinutes: legacyWindowMinutes,
        }
      : maxOrOptions;

  const windowMinutes = options.windowMinutes ?? 15;

  return rateLimit({
    windowMs: minutes(windowMinutes),
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request, res: Response) => {
      const userId = res.locals.userId;
      if (typeof userId === "string" && userId) {
        return `${options.bucket}:${userId}`;
      }
      return `${options.bucket}:ip:${ipKeyGenerator(req.ip ?? "unknown")}`;
    },
    message: {
      detail:
        options.message ??
        "Too many chat requests. Please try again later.",
    },
  });
}
