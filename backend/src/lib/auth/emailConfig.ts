export const EMAIL_TOKEN_TYPES = {
  VERIFY_EMAIL: "verify_email",
  PASSWORD_RESET: "password_reset",
} as const;

export type EmailTokenType =
  (typeof EMAIL_TOKEN_TYPES)[keyof typeof EMAIL_TOKEN_TYPES];

export const VERIFY_EMAIL_EXPIRY_HOURS = 24;
export const PASSWORD_RESET_EXPIRY_HOURS = 1;

const DEFAULT_APP_NAME = "RTP Global VC Screener";
const DEFAULT_LOGO_URL =
  "https://rtp.vc/wp-content/uploads/2023/03/rtp_logo_blackRGB-01.svg";

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function getAppName(): string {
  return process.env.EMAIL_APP_NAME?.trim() || DEFAULT_APP_NAME;
}

export function getResendFromEmail(): string {
  const raw = process.env.RESEND_FROM_EMAIL?.trim();
  if (!raw) {
    return `${DEFAULT_APP_NAME} <onboarding@resend.dev>`;
  }
  if (raw.includes("<") && raw.includes(">")) {
    return raw;
  }
  return `${getAppName()} <${raw}>`;
}

export function getFrontendUrl(): string {
  return (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export function getEmailLogoUrl(): string {
  return process.env.EMAIL_LOGO_URL?.trim() || DEFAULT_LOGO_URL;
}

export function logEmailStartupWarnings(): void {
  if (emailConfigured()) {
    console.log(`[email] Resend configured — from ${getResendFromEmail()}`);
    return;
  }
  const isProduction = process.env.NODE_ENV === "production";
  const msg =
    "[email] RESEND_API_KEY is not set — verification and password-reset emails are disabled";
  if (isProduction) {
    console.warn(`${msg}; new signups require manual confirmation`);
  } else {
    console.warn(`${msg} (dev: accounts auto-confirmed, links logged to console)`);
  }
}
