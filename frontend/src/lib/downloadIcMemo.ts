import type { StartupDocument } from "@/lib/startupsApi";
import { escapeHtml } from "@/lib/escapeHtml";

/** Rough markdown → HTML for Word-compatible .doc export. */
function markdownToSimpleHtml(md: string): string {
  const lines = md.split("\n");
  const parts: string[] = [];
  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inTable) {
        parts.push("</table>");
        inTable = false;
      }
      parts.push("<br/>");
      continue;
    }
    if (trimmed.startsWith("# ")) {
      parts.push(`<h1>${escapeHtml(trimmed.slice(2))}</h1>`);
      continue;
    }
    if (trimmed.startsWith("## ")) {
      parts.push(`<h2>${escapeHtml(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith("### ")) {
      parts.push(`<h3>${escapeHtml(trimmed.slice(4))}</h3>`);
      continue;
    }
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      if (cells.every((c) => /^-+$/.test(c))) continue;
      if (!inTable) {
        parts.push(
          '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;">',
        );
        inTable = true;
      }
      parts.push(
        `<tr>${cells.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`,
      );
      continue;
    }
    if (inTable) {
      parts.push("</table>");
      inTable = false;
    }
    if (trimmed.startsWith("- ")) {
      parts.push(`<li>${escapeHtml(trimmed.slice(2))}</li>`);
      continue;
    }
    parts.push(`<p>${escapeHtml(trimmed)}</p>`);
  }
  if (inTable) parts.push("</table>");
  return parts.join("\n");
}

export function downloadIcMemoAsDoc(doc: StartupDocument): void {
  const body = markdownToSimpleHtml(doc.content);
  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>${escapeHtml(doc.title)}</title></head>
<body style="font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.4;">
${body}
</body></html>`;

  const blob = new Blob([html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.title.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-")}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}
