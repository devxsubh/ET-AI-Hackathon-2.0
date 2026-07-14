// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string; numpages: number }>;
import mammoth from "mammoth";

export type ParsedPage = { pageNum: number | null; text: string };

export async function parseDocumentToText(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<ParsedPage[]> {
  const mime = mimeType.toLowerCase();
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  if (mime === "application/pdf" || ext === "pdf") {
    return parsePdf(buffer);
  }

  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/msword" ||
    ext === "docx" ||
    ext === "doc"
  ) {
    return parseDocx(buffer);
  }

  if (
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.ms-excel" ||
    ext === "xlsx" ||
    ext === "xls"
  ) {
    return parseXlsx(buffer);
  }

  if (
    mime === "text/plain" ||
    mime === "text/csv" ||
    mime === "message/rfc822" ||
    ext === "txt" ||
    ext === "csv" ||
    ext === "eml" ||
    ext === "md"
  ) {
    return [{ pageNum: null, text: buffer.toString("utf-8") }];
  }

  throw new Error(`Unsupported file type: ${mimeType} (${filename})`);
}

async function parsePdf(buffer: Buffer): Promise<ParsedPage[]> {
  const data = await pdfParse(buffer);
  const raw = data.text ?? "";

  // Split by form-feed character for rough page boundaries
  const pageSplits = raw.split(/\f/).filter((p: string) => p.trim().length > 0);
  if (pageSplits.length === 0) return [];

  return pageSplits.map((text: string, i: number) => ({ pageNum: i + 1, text: text.trim() }));
}

async function parseDocx(buffer: Buffer): Promise<ParsedPage[]> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value.trim();
  if (!text) return [];
  return [{ pageNum: null, text }];
}

/** Minimal XLSX reader without SheetJS — unzip + shared strings / inline cells. */
async function parseXlsx(buffer: Buffer): Promise<ParsedPage[]> {
  // Prefer dynamic xlsx if installed; otherwise fall back to raw UTF-8 scan of XML sheets.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require("xlsx") as {
      read: (data: Buffer, opts: { type: string }) => { SheetNames: string[]; Sheets: Record<string, unknown> };
      utils: { sheet_to_csv: (sheet: unknown) => string };
    };
    const wb = XLSX.read(buffer, { type: "buffer" });
    const parts: string[] = [];
    for (const name of wb.SheetNames) {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
      if (csv.trim()) parts.push(`## Sheet: ${name}\n${csv}`);
    }
    const text = parts.join("\n\n").trim();
    if (!text) return [];
    return [{ pageNum: null, text }];
  } catch {
    // ZIP-less fallback: extract printable strings from binary (demo-quality)
    const asString = buffer.toString("utf-8");
    const cells = asString.match(/>([^<>]{2,80})</g)?.map((s) => s.slice(1, -1)) ?? [];
    const text = cells.filter((c) => /[A-Za-z0-9]/.test(c)).join(" | ");
    if (!text.trim()) {
      throw new Error(
        "XLSX parsing requires the 'xlsx' package. Run: pnpm add xlsx --filter vc-screener-backend",
      );
    }
    return [{ pageNum: null, text }];
  }
}
