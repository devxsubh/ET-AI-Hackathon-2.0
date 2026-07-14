import { getValidAccessToken } from "@/lib/authApi";
import { UI_PREVIEW_MODE } from "@/lib/uiPreview";

export async function getAuthHeaders(): Promise<Record<string, string>> {
  if (UI_PREVIEW_MODE) return {};

  const token = await getValidAccessToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
