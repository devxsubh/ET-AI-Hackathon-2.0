export function friendlyLlmError(err: unknown): string {
  if (!(err instanceof Error)) return "Something went wrong. Please try again.";

  const msg = err.message.toLowerCase();

  if (msg.includes("api key") || msg.includes("authentication")) {
    return "AI service authentication failed. Check ANTHROPIC_API_KEY.";
  }
  if (msg.includes("rate limit") || msg.includes("429")) {
    return "AI rate limit reached. Wait a moment and retry.";
  }
  if (msg.includes("timeout") || msg.includes("timed out")) {
    return "The AI request timed out. Please try again.";
  }
  if (msg.includes("overloaded") || msg.includes("529")) {
    return "AI service is temporarily overloaded. Retry shortly.";
  }

  return err.message || "Something went wrong. Please try again.";
}
