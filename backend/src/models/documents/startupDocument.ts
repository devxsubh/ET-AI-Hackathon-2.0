import mongoose from "mongoose";

export type StartupDocumentKind = "ic_memo" | "screening_analysis" | "custom";

const schema = new mongoose.Schema({
  startupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Startup",
    required: true,
    index: true,
  },
  kind: {
    type: String,
    enum: ["ic_memo", "screening_analysis", "custom"],
    required: true,
    index: true,
  },
  title: { type: String, required: true },
  content: { type: String, required: true },
  screeningScreenedAt: { type: String, default: null },
  createdAt: { type: Date, default: Date.now, index: true },
});

export const StartupDocument =
  mongoose.models["StartupDocument"] ??
  mongoose.model("StartupDocument", schema);
