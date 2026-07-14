/** When set, blocks sending PII to external LLM APIs (Anthropic). */
export function isExternalLlmBlocked(): boolean {
  const value = process.env.DATA_RESIDENCY?.trim().toLowerCase();
  return value === "restricted" || value === "eu" || value === "in";
}
