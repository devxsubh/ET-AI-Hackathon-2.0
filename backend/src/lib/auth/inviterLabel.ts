import { findUserById } from "../../models";

export async function resolveInviterLabel(
  userId: string,
  userEmail: string,
): Promise<string> {
  const user = await findUserById(userId);
  const displayName = user?.displayName?.trim();
  if (displayName) return displayName;
  return userEmail;
}
