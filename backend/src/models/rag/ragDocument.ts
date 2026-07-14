import mongoose, { Schema, type Document } from "mongoose";

export type RagDocumentStatus = "processing" | "ready" | "error";

export interface IRagDocument extends Document {
  startupId: mongoose.Types.ObjectId;
  filename: string;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: Date;
  storageKey?: string;
  sizeBytes: number;
  chunkCount: number;
  status: RagDocumentStatus;
  errorMessage?: string;
}

const RagDocumentSchema = new Schema<IRagDocument>({
  startupId: { type: Schema.Types.ObjectId, ref: "Startup", required: true, index: true },
  filename: { type: String, required: true },
  mimeType: { type: String, required: true },
  uploadedBy: { type: String, required: true },
  uploadedAt: { type: Date, default: () => new Date() },
  storageKey: { type: String },
  sizeBytes: { type: Number, default: 0 },
  chunkCount: { type: Number, default: 0 },
  status: { type: String, enum: ["processing", "ready", "error"], default: "processing" },
  errorMessage: { type: String },
});

export const RagDocument = mongoose.model<IRagDocument>("RagDocument", RagDocumentSchema, "rag_documents");
