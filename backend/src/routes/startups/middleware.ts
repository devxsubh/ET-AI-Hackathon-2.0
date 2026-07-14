import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { connectDb } from "../../lib/infra/db";
import {
  findAccessibleStartup,
  isSampleRecord,
  isWritableStartup,
  visibleStartupFilter,
} from "../../lib/sample/sampleAssets";
import { requireAuth } from "../../middleware/requireAuth";

/** @deprecated Use visibleStartupFilter — kept for owned-only writes. */
export function ownerFilter(userId: string) {
  return { ownerId: userId };
}

export async function findOwnedStartup(id: string, userId: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const s = await findAccessibleStartup(id, userId);
  if (!s || !isWritableStartup(s, userId)) return null;
  return s;
}

export function rejectSampleWrite(
  res: Response,
  startup: Record<string, unknown> | undefined,
): boolean {
  if (startup && isSampleRecord(startup)) {
    res.status(403).json({
      detail: "This is a shared sample workspace — it is read-only. Hide it from your list if you do not need it.",
    });
    return true;
  }
  return false;
}

export async function connectDbMiddleware(
  _req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await connectDb();
    next();
  } catch (err) {
    next(err);
  }
}

export function requireStartupOwner(
  req: Request,
  res: Response,
  next: NextFunction,
  id: string,
): void {
  void (async () => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404).json({ detail: "Startup not found" });
      return;
    }
    const userId = res.locals.userId as string;
    const startup = await findAccessibleStartup(id, userId);
    if (!startup) {
      res.status(404).json({ detail: "Startup not found" });
      return;
    }
    res.locals.accessibleStartup = startup;
    next();
  })().catch(next);
}

export const startupsBaseMiddleware = [requireAuth, connectDbMiddleware] as const;

export { visibleStartupFilter };
