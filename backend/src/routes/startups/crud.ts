import { Router } from "express";
import { Startup, StartupChat, StartupDocument } from "../../models";
import {
  findAccessibleStartup,
  hideSampleAsset,
  isSampleRecord,
} from "../../lib/sample/sampleAssets";
import {
  findOwnedStartup,
  ownerFilter,
  visibleStartupFilter,
} from "./middleware";
import { toStartup } from "./serializers";
import {
  startupListCache,
  startupDetailCache,
  TTL,
  cacheKey,
} from "../../lib/infra/cache";

export const startupsCrudListRouter = Router();
export const startupsCrudDetailRouter = Router();

startupsCrudListRouter.get("/", async (req, res) => {
  const userId = res.locals.userId as string;
  const key = cacheKey.startupList(userId);
  const cached = await startupListCache.get(key);
  if (cached !== null) {
    res.json(cached);
    return;
  }
  const list = await Startup.find(await visibleStartupFilter(userId))
    .sort({ createdAt: -1 })
    .lean();
  const result = list.map(toStartup);
  await startupListCache.set(key, result, TTL.startupList);
  res.json(result);
});

startupsCrudListRouter.post("/", async (req, res) => {
  const userId = res.locals.userId as string;
  const { name } = req.body as { name?: string };
  if (!name?.trim()) {
    res.status(400).json({ detail: "name is required" });
    return;
  }
  const s = await Startup.create({ name: name.trim(), ownerId: userId });
  await startupListCache.delete(cacheKey.startupList(userId));
  res.status(201).json(toStartup(s.toObject()));
});

startupsCrudDetailRouter.get("/:id", async (req, res) => {
  const userId = res.locals.userId as string;
  const key = cacheKey.startupDetail(req.params.id, userId);
  const cached = await startupDetailCache.get(key);
  if (cached !== null) {
    res.json(cached);
    return;
  }
  const s = await findAccessibleStartup(req.params.id, userId);
  if (!s) {
    res.status(404).json({ detail: "Startup not found" });
    return;
  }
  const result = toStartup(s);
  await startupDetailCache.set(key, result, TTL.startupDetail);
  res.json(result);
});

startupsCrudDetailRouter.patch("/:id", async (req, res) => {
  const userId = res.locals.userId as string;
  const { name } = req.body as { name?: string };
  const s = await Startup.findOneAndUpdate(
    { _id: req.params.id, ...ownerFilter(userId) },
    { ...(name?.trim() && { name: name.trim() }) },
    { new: true },
  ).lean();
  if (!s) {
    res.status(404).json({ detail: "Startup not found" });
    return;
  }
  const result = toStartup(s);
  await Promise.all([
    startupListCache.delete(cacheKey.startupList(userId)),
    startupDetailCache.delete(cacheKey.startupDetail(req.params.id, userId)),
  ]);
  res.json(result);
});

startupsCrudDetailRouter.delete("/:id", async (req, res) => {
  const userId = res.locals.userId as string;
  const s = await findAccessibleStartup(req.params.id, userId);
  if (!s) {
    res.status(404).json({ detail: "Startup not found" });
    return;
  }
  if (isSampleRecord(s)) {
    await hideSampleAsset(userId, "startup", req.params.id);
    await startupListCache.delete(cacheKey.startupList(userId));
    await startupDetailCache.delete(cacheKey.startupDetail(req.params.id, userId));
    res.status(204).send();
    return;
  }
  const now = new Date();
  await Startup.findByIdAndUpdate(req.params.id, { $set: { deletedAt: now } });
  await StartupChat.deleteOne({ startupId: req.params.id });
  await StartupDocument.deleteMany({ startupId: req.params.id });
  await Promise.all([
    startupListCache.delete(cacheKey.startupList(userId)),
    startupDetailCache.delete(cacheKey.startupDetail(req.params.id, userId)),
  ]);
  res.status(204).send();
});
