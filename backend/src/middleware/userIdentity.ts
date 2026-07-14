import type { Response } from "express";

export function authIdentityOr500(
  res: Response,
): { userId: string; userEmail: string } | null {
  const userId = res.locals.userId;
  const userEmail = res.locals.userEmail;
  if (typeof userId !== "string" || !userId.trim()) {
    res.status(500).json({ detail: "Authenticated user identity missing" });
    return null;
  }
  if (typeof userEmail !== "string" || !userEmail.trim()) {
    res.status(500).json({ detail: "Authenticated user email missing" });
    return null;
  }
  return { userId: userId.trim(), userEmail: userEmail.trim() };
}
