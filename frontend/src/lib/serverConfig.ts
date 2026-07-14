/** Runtime config from the backend — model ids live server-side only. */

export type ServerLlmConfig = {
  provider: "anthropic";
  model: string;
};

let cached: ServerLlmConfig | null = null;

export async function getServerLlmConfig(): Promise<ServerLlmConfig> {
  if (cached) return cached;
  const base = (
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001"
  ).replace(/\/$/, "");
  const resp = await fetch(`${base}/api/config`, { cache: "no-store" });
  if (!resp.ok) {
    return { provider: "anthropic", model: "" };
  }
  const data = (await resp.json()) as { llm?: ServerLlmConfig };
  cached = data.llm ?? { provider: "anthropic", model: "" };
  return cached;
}
