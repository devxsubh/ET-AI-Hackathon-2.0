const MAX_MESSAGES = 50;
const MAX_MESSAGE_BYTES = 16 * 1024;
const MAX_CSV_BYTES = 500 * 1024;

export type ParsedMessage = { role: "user" | "assistant"; content: string };

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

export function validateChatMessages(
  value: unknown,
): { ok: true; messages: ParsedMessage[] } | { ok: false; detail: string } {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, detail: "'messages' must be a non-empty array" };
  }
  if (value.length > MAX_MESSAGES) {
    return {
      ok: false,
      detail: `Too many messages (max ${MAX_MESSAGES})`,
    };
  }

  const out: ParsedMessage[] = [];
  for (const m of value) {
    if (typeof m !== "object" || m === null) continue;
    const row = m as Record<string, unknown>;
    const role = row.role;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof row.content !== "string" || !row.content.trim()) continue;
    const content = row.content.trim();
    if (byteLength(content) > MAX_MESSAGE_BYTES) {
      return {
        ok: false,
        detail: `Message exceeds ${MAX_MESSAGE_BYTES / 1024} KB limit`,
      };
    }
    out.push({ role, content });
  }

  if (out.length === 0) {
    return { ok: false, detail: "'messages' must contain at least one valid entry" };
  }
  return { ok: true, messages: out };
}

export function validateCsvContent(
  value: unknown,
): { ok: true; content: string | null } | { ok: false; detail: string } {
  if (value === undefined || value === null || value === "") {
    return { ok: true, content: null };
  }
  if (typeof value !== "string") {
    return { ok: false, detail: "csvContent must be a string" };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true, content: null };
  }
  if (byteLength(trimmed) > MAX_CSV_BYTES) {
    return {
      ok: false,
      detail: `csvContent exceeds ${MAX_CSV_BYTES / 1024} KB limit`,
    };
  }
  return { ok: true, content: trimmed };
}
