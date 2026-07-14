/** Tavily web search — optional; used by the web_search agent tool. */
export function isWebSearchEnabled(): boolean {
  const key = process.env.TAVILY_API_KEY?.trim() ?? "";
  return key.length > 0 && !key.includes("NEXT_PUBLIC_");
}

export function logWebSearchStartupWarnings(): void {
  const raw = process.env.TAVILY_API_KEY?.trim() ?? "";
  if (!raw) {
    console.warn(
      "[startup] TAVILY_API_KEY is not set — web_search tool will return unavailable.",
    );
    return;
  }
  if (raw.includes("NEXT_PUBLIC_") || raw.includes("=")) {
    console.warn(
      "[startup] TAVILY_API_KEY looks malformed (check .env for a missing newline). web_search may fail.",
    );
  }
}
