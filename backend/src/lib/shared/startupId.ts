import mongoose from "mongoose";

/** True only for 24-char hex MongoDB ObjectId strings. */
export function isValidStartupObjectId(
  id: string | null | undefined,
): id is string {
  if (!id?.trim()) return false;
  const trimmed = id.trim();
  if (!/^[a-f0-9]{24}$/i.test(trimmed)) return false;
  return mongoose.Types.ObjectId.isValid(trimmed);
}

export function coalesceStartupId(
  ...candidates: (string | null | undefined)[]
): string | null {
  for (const c of candidates) {
    if (isValidStartupObjectId(c)) return c.trim();
  }
  return null;
}
