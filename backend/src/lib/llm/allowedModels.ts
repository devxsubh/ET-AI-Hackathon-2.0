export const ALLOWED_TABULAR_MODELS = new Set([
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
  "gpt-5.5",
  "gpt-5.4-mini",
]);

export function isAllowedTabularModel(model: string): boolean {
  return ALLOWED_TABULAR_MODELS.has(model.trim());
}
