import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicModel } from "./models";

const PLACEHOLDERS = new Set([
  "",
  "your-anthropic-key",
  "sk-ant-your-key-here",
]);

export function anthropicKeyStatus(): {
  ok: boolean;
  message: string;
} {
  const key = process.env.ANTHROPIC_API_KEY?.trim() ?? "";
  if (PLACEHOLDERS.has(key)) {
    return {
      ok: false,
      message:
        "ANTHROPIC_API_KEY is missing or still the .env.example placeholder",
    };
  }
  if (!key.startsWith("sk-ant-")) {
    return {
      ok: false,
      message: "ANTHROPIC_API_KEY does not look like a valid Anthropic key",
    };
  }
  return { ok: true, message: "format OK" };
}

/** One-token ping — fails fast on boot if the key is rejected by Anthropic. */
export async function validateAnthropicKeyLive(): Promise<void> {
  const status = anthropicKeyStatus();
  if (!status.ok) {
    console.error(`[startup] ${status.message}`);
    return;
  }

  try {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!.trim(),
    });
    await client.messages.create({
      model: getAnthropicModel(),
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    });
    console.log("[startup] Anthropic API key verified");
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Anthropic authentication failed";
    console.error(
      `[startup] Anthropic API key rejected (401). Update backend/.env and restart the server — tsx watch does not reload .env changes.\n  ${msg}`,
    );
  }
}
