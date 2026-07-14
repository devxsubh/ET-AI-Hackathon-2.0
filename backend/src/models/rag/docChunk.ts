import mongoose, { Schema, type Document } from "mongoose";

export interface IDocChunk extends Document {
  startupId: mongoose.Types.ObjectId;
  documentId: mongoose.Types.ObjectId;
  filename: string;
  mimeType: string;
  chunkIndex: number;
  chunkText: string;
  embedding: number[];
  pageNumber: number | null;
  createdAt: Date;
}

const DocChunkSchema = new Schema<IDocChunk>({
  startupId: { type: Schema.Types.ObjectId, ref: "Startup", required: true, index: true },
  documentId: { type: Schema.Types.ObjectId, ref: "RagDocument", required: true, index: true },
  filename: { type: String, required: true },
  mimeType: { type: String, required: true },
  chunkIndex: { type: Number, required: true },
  chunkText: { type: String, required: true },
  embedding: { type: [Number], required: true },
  pageNumber: { type: Number, default: null },
  createdAt: { type: Date, default: () => new Date() },
});

// Compound index for bulk deletes and ownership queries
DocChunkSchema.index({ startupId: 1, documentId: 1 });

// Text index as keyword-search fallback when Atlas Vector Search is not enabled
DocChunkSchema.index({ chunkText: "text" });

export const DocChunk = mongoose.model<IDocChunk>("DocChunk", DocChunkSchema, "doc_chunks");
