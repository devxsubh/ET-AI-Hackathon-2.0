import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    ownerId: { type: String, required: true, index: true },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Startup",
      default: null,
      index: true,
    },
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileType: { type: String, default: null },
    storageKey: { type: String, required: true },
    sizeBytes: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["ready", "processing", "error"],
      default: "ready",
    },
  },
  { timestamps: true },
);

schema.index({ ownerId: 1, projectId: 1, createdAt: -1 });

export const StoredDocument =
  mongoose.models["StoredDocument"] ??
  mongoose.model("StoredDocument", schema);
