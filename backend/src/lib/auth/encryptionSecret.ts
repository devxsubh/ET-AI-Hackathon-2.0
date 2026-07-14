const WEAK_SECRETS = new Set([
  "change-me-in-production",
  "local-dev-encryption-secret",
  "changeme",
  "secret",
]);

const MIN_SECRET_LENGTH = 32;

export function validateUserApiKeysEncryptionSecret(): {
  ok: boolean;
  message?: string;
} {
  const secret = process.env.USER_API_KEYS_ENCRYPTION_SECRET?.trim() ?? "";
  if (!secret) {
    return {
      ok: false,
      message: "USER_API_KEYS_ENCRYPTION_SECRET is not set",
    };
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    return {
      ok: false,
      message: `USER_API_KEYS_ENCRYPTION_SECRET must be at least ${MIN_SECRET_LENGTH} characters`,
    };
  }
  if (WEAK_SECRETS.has(secret.toLowerCase())) {
    return {
      ok: false,
      message:
        "USER_API_KEYS_ENCRYPTION_SECRET is a known default — generate a unique random secret",
    };
  }
  return { ok: true };
}

export function logEncryptionSecretWarnings(): void {
  const check = validateUserApiKeysEncryptionSecret();
  if (check.ok) return;

  const isProduction = process.env.NODE_ENV === "production";
  const msg = `[security] ${check.message}`;
  if (isProduction) {
    console.error(`${msg} — refusing to start in production`);
    process.exit(1);
  }
  console.warn(`${msg} (dev only — set a strong secret before production)`);
}
