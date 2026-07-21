const MAX_BYTES = 25 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30_000;

function filenameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const last = path.split("/").filter(Boolean).pop();
    if (last && last.includes(".")) return decodeURIComponent(last);
  } catch {
    /* ignore */
  }
  return "remote-document.txt";
}

function filenameFromContentDisposition(
  header: string | null,
): string | undefined {
  if (!header) return undefined;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star?.[1]) return decodeURIComponent(star[1].trim());
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim();
}

/**
 * Turn Google Drive / Docs share links into direct export/download URLs.
 * Works only when the file is shared as "Anyone with the link" (no OAuth).
 */
export function resolveGoogleDriveUrl(rawUrl: string): {
  url: string;
  filenameHint?: string;
} {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { url: rawUrl.trim() };
  }

  const host = parsed.hostname.replace(/^www\./, "");
  const path = parsed.pathname;

  const fileMatch = /\/file\/d\/([^/]+)/.exec(path);
  if (host === "drive.google.com" && fileMatch) {
    const id = fileMatch[1]!;
    return {
      url: `https://drive.google.com/uc?export=download&id=${id}`,
      filenameHint: "drive-file",
    };
  }

  const openId = parsed.searchParams.get("id");
  if (host === "drive.google.com" && openId) {
    return {
      url: `https://drive.google.com/uc?export=download&id=${openId}`,
      filenameHint: "drive-file",
    };
  }

  const docMatch = /\/document\/d\/([^/]+)/.exec(path);
  if (
    (host === "docs.google.com" || host === "drive.google.com") &&
    docMatch
  ) {
    return {
      url: `https://docs.google.com/document/d/${docMatch[1]}/export?format=docx`,
      filenameHint: "drive-doc.docx",
    };
  }

  const sheetMatch = /\/spreadsheets\/d\/([^/]+)/.exec(path);
  if (host === "docs.google.com" && sheetMatch) {
    return {
      url: `https://docs.google.com/spreadsheets/d/${sheetMatch[1]}/export?format=xlsx`,
      filenameHint: "drive-sheet.xlsx",
    };
  }

  const slidesMatch = /\/presentation\/d\/([^/]+)/.exec(path);
  if (host === "docs.google.com" && slidesMatch) {
    return {
      url: `https://docs.google.com/presentation/d/${slidesMatch[1]}/export?format=pdf`,
      filenameHint: "drive-slides.pdf",
    };
  }

  return { url: rawUrl.trim() };
}

/**
 * Fetch a remote http(s) document for ingest. Blocks non-http schemes and oversized bodies.
 * Google Drive share links are rewritten to export/download URLs (link must be public).
 */
export async function fetchRemoteDocument(rawUrl: string): Promise<{
  buffer: Buffer;
  filename: string;
  mimeType: string;
}> {
  const resolved = resolveGoogleDriveUrl(rawUrl);
  let parsed: URL;
  try {
    parsed = new URL(resolved.url);
  } catch {
    throw new Error("Invalid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http(s) URLs are supported");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: { Accept: "*/*", "User-Agent": "Engram-Ingest/1.0" },
    });
    if (!resp.ok) {
      throw new Error(
        resp.status === 401 || resp.status === 403
          ? "File is private — share it as “Anyone with the link”, then retry"
          : `URL fetch failed (${resp.status})`,
      );
    }

    const len = resp.headers.get("content-length");
    if (len && Number(len) > MAX_BYTES) {
      throw new Error(`Remote file exceeds ${MAX_BYTES / (1024 * 1024)}MB limit`);
    }

    const ab = await resp.arrayBuffer();
    if (ab.byteLength > MAX_BYTES) {
      throw new Error(`Remote file exceeds ${MAX_BYTES / (1024 * 1024)}MB limit`);
    }

    const mimeType =
      resp.headers.get("content-type")?.split(";")[0]?.trim() ||
      "application/octet-stream";

    // Drive sometimes returns an HTML interstitial instead of the file
    const looksHtml =
      mimeType.includes("text/html") ||
      (ab.byteLength > 0 &&
        Buffer.from(ab).subarray(0, 64).toString("utf8").includes("<!DOCTYPE"));
    if (looksHtml && /drive\.google|docs\.google/.test(parsed.hostname)) {
      throw new Error(
        "Could not download from Drive — share as “Anyone with the link” (Viewer)",
      );
    }

    const filename =
      filenameFromContentDisposition(resp.headers.get("content-disposition")) ||
      resolved.filenameHint ||
      filenameFromUrl(parsed.toString());

    return { buffer: Buffer.from(ab), filename, mimeType };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("URL fetch timed out");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
