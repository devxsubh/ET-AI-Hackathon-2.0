import { Router } from "express";
import { StartupDocument } from "../../models";
import { findOwnedStartup } from "../startups/middleware";
import { requireAuth } from "../../middleware/requireAuth";
import { connectDbMiddleware } from "../startups/middleware";

export const startupDocumentDownloadRouter = Router();

startupDocumentDownloadRouter.use(requireAuth, connectDbMiddleware);

async function loadOwnedDocument(
  docId: string,
  userId: string,
): Promise<Record<string, unknown> | null> {
  const doc = (await StartupDocument.findById(docId).lean()) as
    | Record<string, unknown>
    | null;

  if (!doc || typeof doc.content !== "string") return null;

  const startupId = String(doc.startupId);
  const owned = await findOwnedStartup(startupId, userId);
  if (!owned) return null;

  return doc;
}

startupDocumentDownloadRouter.get("/:docId/view", async (req, res) => {
  const userId = res.locals.userId as string;
  const doc = await loadOwnedDocument(req.params.docId, userId);
  if (!doc) {
    res.status(404).json({ detail: "Document not found" });
    return;
  }

  res.json({
    id: String(doc._id),
    startupId: String(doc.startupId),
    title: doc.title ?? "Document",
    kind: doc.kind ?? "custom",
    content: doc.content,
  });
});

startupDocumentDownloadRouter.get("/:docId/download", async (req, res) => {
  const userId = res.locals.userId as string;
  const doc = await loadOwnedDocument(req.params.docId, userId);
  if (!doc) {
    res.status(404).json({ detail: "Document not found" });
    return;
  }

  const title = String(doc.title ?? "document");
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${title.replace(/[^a-zA-Z0-9._-]+/g, "_")}.md"`,
  );
  res.send(String(doc.content));
});
