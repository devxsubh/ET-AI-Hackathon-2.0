import mongoose from "mongoose";

export type SampleAssetType = "startup" | "tabular_review";

const schema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  assetType: {
    type: String,
    enum: ["startup", "tabular_review"],
    required: true,
  },
  assetId: { type: String, required: true },
  hiddenAt: { type: Date, default: Date.now },
});

schema.index({ userId: 1, assetType: 1, assetId: 1 }, { unique: true });

export const HiddenSampleAsset =
  mongoose.models["HiddenSampleAsset"] ??
  mongoose.model("HiddenSampleAsset", schema);
