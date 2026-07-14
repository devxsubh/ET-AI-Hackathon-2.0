import { Router } from "express";
import mongoose from "mongoose";
import { StartupChat } from "../../models";

export const startupsChatRouter = Router();

startupsChatRouter.get("/:id/chat", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(404).json({ detail: "Startup not found" });
    return;
  }
  const doc = (await StartupChat.findOne({ startupId: req.params.id }).lean()) as
    | { messages?: unknown[] }
    | null;
  res.json({ messages: doc?.messages ?? [] });
});

startupsChatRouter.put("/:id/chat", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(404).json({ detail: "Startup not found" });
    return;
  }
  const { messages } = req.body as { messages?: unknown[] };
  if (!Array.isArray(messages)) {
    res.status(400).json({ detail: "messages array is required" });
    return;
  }
  await StartupChat.findOneAndUpdate(
    { startupId: req.params.id },
    { $set: { messages, updatedAt: new Date() } },
    { upsert: true },
  );
  res.json({ ok: true });
});
