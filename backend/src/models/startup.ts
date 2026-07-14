import mongoose from "mongoose";

/** Engram knowledge graph + risk report (industrial intelligence). */
const knowledgeGraphSchema = new mongoose.Schema(
  {
    nodes: { type: [mongoose.Schema.Types.Mixed], default: [] },
    edges: { type: [mongoose.Schema.Types.Mixed], default: [] },
    updatedAt: { type: Date, default: null },
  },
  { _id: false },
);

const riskReportSchema = new mongoose.Schema(
  {
    atRiskAssets: { type: [mongoose.Schema.Types.Mixed], default: [] },
    generatedAt: { type: Date, default: null },
    summary: { type: String, default: "" },
  },
  { _id: false },
);

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  ownerId: { type: String, index: true, default: null },
  createdAt: { type: Date, default: Date.now },
  knowledgeGraph: { type: knowledgeGraphSchema, default: null },
  riskReport: { type: riskReportSchema, default: null },
});

export const Startup =
  mongoose.models["Startup"] ?? mongoose.model("Startup", schema);
