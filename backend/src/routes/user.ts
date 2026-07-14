import { Router } from "express";
import { connectDb } from "../lib/infra/db";
import { requireAuth } from "../middleware/requireAuth";
import { userProfileCache, TTL, cacheKey } from "../lib/infra/cache";
import {
  findUserById,
  serializeProfile,
} from "../models";
import {
  getUserApiKeyStatus,
  hasEnvApiKey,
  normalizeApiKeyProvider,
  saveUserApiKey,
} from "../lib/auth/userApiKeys";
import { AuthToken } from "../models";
import { User } from "../models";
import mongoose from "mongoose";

export const userRouter = Router();

userRouter.use(requireAuth);

userRouter.use(async (_req, _res, next) => {
  try {
    await connectDb();
    next();
  } catch (err) {
    next(err);
  }
});

function validateProfilePayload(body: unknown):
  | {
      ok: true;
      update: {
        displayName?: string | null;
        organisation?: string | null;
      };
    }
  | { ok: false; detail: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, detail: "Expected a JSON object" };
  }

  const raw = body as Record<string, unknown>;
  const allowedFields = new Set(["displayName", "organisation"]);
  const invalidField = Object.keys(raw).find((key) => !allowedFields.has(key));
  if (invalidField) {
    return { ok: false, detail: `Unsupported profile field: ${invalidField}` };
  }

  const update: {
    displayName?: string | null;
    organisation?: string | null;
  } = {};

  if ("displayName" in raw) {
    if (raw.displayName !== null && typeof raw.displayName !== "string") {
      return { ok: false, detail: "displayName must be a string or null" };
    }
    update.displayName = raw.displayName?.trim() || null;
  }

  if ("organisation" in raw) {
    if (raw.organisation !== null && typeof raw.organisation !== "string") {
      return { ok: false, detail: "organisation must be a string or null" };
    }
    update.organisation = raw.organisation?.trim() || null;
  }

  return { ok: true, update };
}

userRouter.get("/profile", async (_req, res) => {
  const userId = res.locals.userId as string;
  const key = cacheKey.userProfile(userId);
  const cached = await userProfileCache.get(key);
  if (cached !== null) {
    res.json(cached);
    return;
  }
  const user = await findUserById(userId);
  if (!user) {
    res.status(404).json({ detail: "Profile not found" });
    return;
  }
  const apiKeyStatus = await getUserApiKeyStatus(userId);
  const profile = { ...serializeProfile(user), apiKeyStatus };
  await userProfileCache.set(key, profile, TTL.userProfile);
  res.json(profile);
});

userRouter.patch("/profile", async (req, res) => {
  const userId = res.locals.userId as string;
  const parsed = validateProfilePayload(req.body);
  if (!parsed.ok) {
    res.status(400).json({ detail: parsed.detail });
    return;
  }

  const user = await findUserById(userId);
  if (!user) {
    res.status(404).json({ detail: "Profile not found" });
    return;
  }

  if ("displayName" in parsed.update) {
    user.displayName = parsed.update.displayName ?? null;
  }
  if ("organisation" in parsed.update) {
    user.organisation = parsed.update.organisation ?? null;
  }
  await user.save();

  const apiKeyStatus = await getUserApiKeyStatus(userId);
  const profile = { ...serializeProfile(user), apiKeyStatus };
  await userProfileCache.set(cacheKey.userProfile(userId), profile, TTL.userProfile);
  res.json(profile);
});

userRouter.get("/api-keys", async (_req, res) => {
  const userId = res.locals.userId as string;
  const status = await getUserApiKeyStatus(userId);
  res.json(status);
});

userRouter.put("/api-keys/:provider", async (req, res) => {
  const userId = res.locals.userId as string;
  const provider = normalizeApiKeyProvider(req.params.provider);
  if (!provider) {
    res.status(400).json({ detail: "Unsupported provider" });
    return;
  }

  const apiKey =
    typeof req.body?.api_key === "string" ? req.body.api_key : null;

  try {
    if (hasEnvApiKey(provider)) {
      res.status(409).json({
        detail:
          "This provider is configured by the server environment and cannot be changed from the browser.",
      });
      return;
    }
    await saveUserApiKey(userId, provider, apiKey);
    await userProfileCache.delete(cacheKey.userProfile(userId));
    const status = await getUserApiKeyStatus(userId);
    res.json(status);
  } catch (err) {
    console.error("[user/api-keys] save failed", {
      provider,
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ detail: "Failed to save API key" });
  }
});

userRouter.delete("/account", async (_req, res) => {
  const userId = res.locals.userId as string;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await AuthToken.deleteMany({ userId }).session(session);
      await User.deleteOne({ _id: userId }).session(session);
    });
    res.status(204).send();
  } catch (err) {
    console.error("[user/account] delete failed", err);
    res.status(500).json({ detail: "Failed to delete account" });
  } finally {
    await session.endSession();
  }
});
