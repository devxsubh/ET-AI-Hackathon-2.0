import express from "express";
import mongoose from "mongoose";
import { connectDb } from "../lib/infra/db";
import { AuditLog, Startup } from "../models";
import { requireAuth } from "../middleware/requireAuth";

export const auditLogsRouter = express.Router();

auditLogsRouter.use(requireAuth);
auditLogsRouter.use(async (_req, _res, next) => {
  try {
    await connectDb();
    next();
  } catch (err) {
    next(err);
  }
});

async function buildScopedQuery(
  userId: string,
  startupId?: string,
): Promise<Record<string, unknown> | "invalid_startup" | null> {
  const query: Record<string, unknown> = { performedBy: userId };
  if (!startupId) return query;

  if (!mongoose.Types.ObjectId.isValid(startupId)) {
    return "invalid_startup";
  }

  const startup = await Startup.findOne({ _id: startupId, ownerId: userId }).lean();
  if (!startup) return null;
  query.startupId = startupId;
  return query;
}

// GET /api/audit-logs?startupId=...
auditLogsRouter.get("/", async (req, res) => {
  const userId = res.locals.userId as string;
  const { startupId } = req.query as { startupId?: string };
  const query = await buildScopedQuery(userId, startupId);
  if (query === "invalid_startup") {
    res.status(400).json({ detail: "Invalid startupId" });
    return;
  }
  if (!query) {
    res.status(404).json({ detail: "Startup not found" });
    return;
  }
  const logs = await AuditLog.find(query)
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  res.json(logs.map(toLog));
});

// POST /api/audit-logs
auditLogsRouter.post("/", async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string;
  const { startupId, eventType, details } = req.body as {
    startupId?: string;
    eventType?: string;
    details?: Record<string, unknown>;
  };

  const validTypes = [
    "screening_completed",
    "csv_uploaded",
    "csv_updated",
    "entity_reviewed",
    "portfolio_reviewed",
  ];
  if (!eventType || !validTypes.includes(eventType)) {
    res.status(400).json({ detail: "valid eventType is required" });
    return;
  }

  if (startupId) {
    if (!mongoose.Types.ObjectId.isValid(startupId)) {
      res.status(400).json({ detail: "Invalid startupId" });
      return;
    }
    const startup = await Startup.findOne({ _id: startupId, ownerId: userId }).lean();
    if (!startup) {
      res.status(404).json({ detail: "Startup not found" });
      return;
    }
  }

  const log = await AuditLog.create({
    startupId: startupId ?? null,
    eventType,
    performedBy: userId,
    performedByEmail: userEmail,
    details: details ?? {},
  });
  res.status(201).json(toLog(log.toObject()));
});

auditLogsRouter.get("/export", async (req, res) => {
  const userId = res.locals.userId as string;
  const { startupId } = req.query as { startupId?: string };
  const query = await buildScopedQuery(userId, startupId);
  if (query === "invalid_startup") {
    res.status(400).json({ detail: "Invalid startupId" });
    return;
  }
  if (!query) {
    res.status(404).json({ detail: "Startup not found" });
    return;
  }
  const logs = await AuditLog.find(query).sort({ createdAt: -1 }).limit(500).lean();

  const header = "id,startupId,eventType,performedBy,performedByEmail,createdAt,details\n";
  const rows = logs.map((doc) => {
    const d = doc as Record<string, unknown>;
    const details = JSON.stringify(d.details ?? {}).replace(/"/g, '""');
    return [
      String(d._id),
      d.startupId ? String(d.startupId) : "",
      d.eventType,
      d.performedBy,
      d.performedByEmail,
      new Date(d.createdAt as Date).toISOString(),
      `"${details}"`,
    ].join(",");
  });

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="compliance-audit-log.csv"',
  );
  res.send(header + rows.join("\n"));
});

function toLog(doc: Record<string, unknown>) {
  return {
    id: String(doc._id),
    startupId: doc.startupId ?? null,
    eventType: doc.eventType,
    performedBy: doc.performedBy,
    performedByEmail: doc.performedByEmail,
    details: doc.details ?? {},
    createdAt: doc.createdAt,
  };
}
