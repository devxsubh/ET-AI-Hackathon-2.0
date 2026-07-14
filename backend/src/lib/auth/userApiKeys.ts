import crypto from "crypto";
import mongoose from "mongoose";

export type ApiKeyProvider = "claude" | "gemini" | "openai";
export type UserApiKeys = Record<ApiKeyProvider, string | null>;
export type ApiKeySource = "user" | "env" | null;
export type ApiKeyStatus = Record<ApiKeyProvider, boolean> & {
  sources: Record<ApiKeyProvider, ApiKeySource>;
};

const PROVIDERS: ApiKeyProvider[] = ["claude", "gemini", "openai"];

const apiKeySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    provider: {
      type: String,
      enum: PROVIDERS,
      required: true,
    },
    encryptedKey: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
  },
  { timestamps: true },
);

apiKeySchema.index({ userId: 1, provider: 1 }, { unique: true });

const UserApiKeyModel =
  mongoose.models["UserApiKey"] ??
  mongoose.model("UserApiKey", apiKeySchema);

type EncryptedKeyRow = {
  provider: ApiKeyProvider;
  encryptedKey: string;
  iv: string;
  authTag: string;
};

function envApiKey(provider: ApiKeyProvider): string | null {
  if (provider === "claude") {
    return (
      process.env.ANTHROPIC_API_KEY?.trim() ||
      process.env.CLAUDE_API_KEY?.trim() ||
      null
    );
  }
  if (provider === "openai") {
    return process.env.OPENAI_API_KEY?.trim() || null;
  }
  return process.env.GEMINI_API_KEY?.trim() || null;
}

export function hasEnvApiKey(provider: ApiKeyProvider): boolean {
  return !!envApiKey(provider);
}

function encryptionKey(): Buffer {
  const secret = process.env.USER_API_KEYS_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error("USER_API_KEYS_ENCRYPTION_SECRET is not configured");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function encrypt(value: string): Omit<EncryptedKeyRow, "provider"> {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return {
    encryptedKey: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

function decrypt(row: EncryptedKeyRow): string | null {
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(row.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(row.authTag, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(row.encryptedKey, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch (err) {
    console.error("[user-api-keys] failed to decrypt stored key", {
      provider: row.provider,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

function isProvider(value: string): value is ApiKeyProvider {
  return (PROVIDERS as string[]).includes(value);
}

export function normalizeApiKeyProvider(
  value: string,
): ApiKeyProvider | null {
  return isProvider(value) ? value : null;
}

export async function getUserApiKeyStatus(
  userId: string,
): Promise<ApiKeyStatus> {
  const status: ApiKeyStatus = {
    claude: false,
    gemini: false,
    openai: false,
    sources: {
      claude: null,
      gemini: null,
      openai: null,
    },
  };

  for (const provider of PROVIDERS) {
    if (hasEnvApiKey(provider)) {
      status[provider] = true;
      status.sources[provider] = "env";
    }
  }

  const rows = await UserApiKeyModel.find({ userId }).select("provider").lean();
  for (const row of rows) {
    const provider = normalizeApiKeyProvider(String(row.provider));
    if (provider && !status[provider]) {
      status[provider] = true;
      status.sources[provider] = "user";
    }
  }

  return status;
}

export async function getUserApiKeys(userId: string): Promise<UserApiKeys> {
  const apiKeys: UserApiKeys = {
    claude: envApiKey("claude"),
    gemini: envApiKey("gemini"),
    openai: envApiKey("openai"),
  };

  const rows = await UserApiKeyModel.find({ userId }).lean();
  for (const row of rows) {
    const provider = normalizeApiKeyProvider(String(row.provider));
    if (!provider) continue;
    if (apiKeys[provider]?.trim()) continue;
    apiKeys[provider] = decrypt({
      provider,
      encryptedKey: row.encryptedKey,
      iv: row.iv,
      authTag: row.authTag,
    });
  }

  return apiKeys;
}

export async function saveUserApiKey(
  userId: string,
  provider: ApiKeyProvider,
  value: string | null,
): Promise<void> {
  const normalized = value?.trim() || null;
  if (!normalized) {
    await UserApiKeyModel.deleteOne({ userId, provider });
    return;
  }

  const encrypted = encrypt(normalized);
  await UserApiKeyModel.findOneAndUpdate(
    { userId, provider },
    {
      userId,
      provider,
      ...encrypted,
    },
    { upsert: true, new: true },
  );
}
