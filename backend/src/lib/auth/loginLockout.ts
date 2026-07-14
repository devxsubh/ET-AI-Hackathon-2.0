import type { UserDocument } from "../../models";

export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export function isAccountLocked(user: UserDocument): boolean {
  return Boolean(user.lockUntil && user.lockUntil.getTime() > Date.now());
}

export function lockoutMessage(user: UserDocument): string {
  if (!user.lockUntil) {
    return "Account temporarily locked. Try again later.";
  }
  const minutesLeft = Math.max(
    1,
    Math.ceil((user.lockUntil.getTime() - Date.now()) / 60_000),
  );
  return `Account temporarily locked. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`;
}

export async function recordFailedLogin(user: UserDocument): Promise<void> {
  const attempts = (user.failedLoginAttempts ?? 0) + 1;
  user.failedLoginAttempts = attempts;
  if (attempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
    user.lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    user.failedLoginAttempts = 0;
  }
  await user.save();
}

export async function clearLoginLockout(user: UserDocument): Promise<void> {
  if (!user.failedLoginAttempts && !user.lockUntil) return;
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  await user.save();
}
