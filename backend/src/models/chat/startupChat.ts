import mongoose from "mongoose";

/** Persistent screener chat scoped to one startup workspace. */
const schema = new mongoose.Schema({
  startupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Startup",
    required: true,
    unique: true,
    index: true,
  },
  messages: { type: [mongoose.Schema.Types.Mixed], default: [] },
  updatedAt: { type: Date, default: Date.now },
});

export const StartupChat =
  mongoose.models["StartupChat"] ?? mongoose.model("StartupChat", schema);
