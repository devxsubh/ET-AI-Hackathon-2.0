/**
 * Anthropic model — Haiku only (dev + production).
 * Do not switch to Sonnet/Opus here; cost is prohibitive at screening volume.
 * Model id is server-side only; never expose selection to the frontend.
 */

export const ANTHROPIC_MODEL_ID = "claude-haiku-4-5";

export function getAnthropicModel(): string {
  const override = process.env.ANTHROPIC_MODEL?.trim();
  if (override && override !== ANTHROPIC_MODEL_ID) {
    console.warn(
      `[llm] Ignoring ANTHROPIC_MODEL=${override} — this app uses Haiku only (${ANTHROPIC_MODEL_ID})`,
    );
  }
  return ANTHROPIC_MODEL_ID;
}
