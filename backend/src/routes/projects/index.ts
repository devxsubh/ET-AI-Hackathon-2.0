import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { connectDb } from "../../lib/infra/db";
import {
  findAccessibleStartup,
  isSampleRecord,
  visibleStartupFilter,
} from "../../lib/sample/sampleAssets";
import { Startup } from "../../models";
import { StoredDocument } from "../../models/documents/storedDocument";
import { toRtpDocument } from "../documents/serializers";

export const projectsRouter = Router();

projectsRouter.use(requireAuth);
projectsRouter.use(async (_req, _res, next) => {
  try {
    await connectDb();
    next();
  } catch (err) {
    next(err);
  }
});

function toProject(
  startup: Record<string, unknown>,
  documents: unknown[],
  viewerUserId?: string,
) {
  return {
    id: String(startup._id),
    name: startup.name,
    created_at: startup.createdAt,
    documents,
    is_sample: isSampleRecord(startup),
    read_only:
      isSampleRecord(startup) &&
      viewerUserId != null &&
      startup.ownerId !== viewerUserId,
  };
}

projectsRouter.get("/", async (req, res) => {
  const userId = res.locals.userId as string;
  const list = await Startup.find(await visibleStartupFilter(userId))
    .sort({ createdAt: -1 })
    .lean();
  res.json(
    list.map((s) =>
      toProject(s as Record<string, unknown>, [], userId),
    ),
  );
});

projectsRouter.get("/:id", async (req, res) => {
  const userId = res.locals.userId as string;
  const startup = await findAccessibleStartup(req.params.id, userId);
  if (!startup) {
    res.status(404).json({ detail: "Project not found" });
    return;
  }
  const docs = await StoredDocument.find({ projectId: req.params.id })
    .sort({ createdAt: -1 })
    .lean();
  res.json(
    toProject(
      startup as Record<string, unknown>,
      docs.map((d) => toRtpDocument(d as Record<string, unknown>)),
      userId,
    ),
  );
});
