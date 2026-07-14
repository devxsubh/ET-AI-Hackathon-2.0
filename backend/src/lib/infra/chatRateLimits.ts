import { createUserRateLimiter } from "./userRateLimit";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Startup screener agent — POST /api/chat */
export const screenerChatLimiter = createUserRateLimiter({
  bucket: "screener-chat",
  max: envInt("RATE_LIMIT_SCREENER_CHAT_MAX", 60),
  message: "Too many screener chat requests. Please try again later.",
});

/** Compliance assistant — POST /chat */
export const assistantChatLimiter = createUserRateLimiter({
  bucket: "assistant-chat",
  max: envInt("RATE_LIMIT_ASSISTANT_CHAT_MAX", 40),
  message: "Too many assistant chat requests. Please try again later.",
});
