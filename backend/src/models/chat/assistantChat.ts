import mongoose from "mongoose";

/** Global assistant chat (sidebar history). */
const schema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  projectId: { type: String, default: null, index: true },
  title: { type: String, default: null },
  messages: { type: [mongoose.Schema.Types.Mixed], default: [] },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
});

export const AssistantChat =
  mongoose.models["AssistantChat"] ??
  mongoose.model("AssistantChat", schema);
