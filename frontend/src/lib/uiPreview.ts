/** Explicit opt-in only — never enable in production for a compliance deployment. */
export const UI_PREVIEW_MODE =
  process.env.NEXT_PUBLIC_ALLOW_PREVIEW_MODE === "true";

export const PREVIEW_USER = {
  id: "preview-user",
  email: "demo@engram.app",
};

export const PREVIEW_PROFILE = {
  displayName: "RTP Admin",
  organisation: "Engram",
  apiKeys: {
    claude: { configured: true, source: "user" as const },
    gemini: { configured: false, source: null },
    openai: { configured: false, source: null },
  },
};
