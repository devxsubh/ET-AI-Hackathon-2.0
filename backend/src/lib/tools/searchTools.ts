import mongoose from "mongoose";
import { RagDocument } from "../../models/rag/ragDocument";
import { retrieveRelevantChunks } from "../rag/retrieveChunks";
import { coalesceStartupId } from "../shared/startupId";
import type { ToolDefinition } from "./registry";

export const listStartupDocumentsTool: ToolDefinition = {
  name: "list_startup_documents",
  routingHint:
    "- list_startup_documents: list ingested documents for the active plant workspace.",
  schema: {
    name: "list_startup_documents",
    description: "List documents uploaded / ingested for a plant workspace.",
    input_schema: {
      type: "object" as const,
      properties: {
        startup_id: {
          type: "string",
          description: "Plant / startup id (optional if workspace is active)",
        },
      },
    },
  },
  handler: async (input, ctx) => {
    const args = input as { startup_id?: string };
    const startupId = coalesceStartupId(args.startup_id, ctx.startupId);
    if (!startupId || !mongoose.Types.ObjectId.isValid(startupId)) {
      return { content: "Error: startup_id / plant workspace required." };
    }
    const docs = await RagDocument.find({ startupId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    if (!docs.length) {
      return { content: "No documents found for this plant." };
    }
    return {
      content: docs
        .map(
          (d) =>
            `- ${d.filename ?? d._id} (id: ${String(d._id)})`,
        )
        .join("\n"),
    };
  },
};

export const searchStartupDocumentsTool: ToolDefinition = {
  name: "search_startup_documents",
  routingHint:
    "- search_startup_documents: semantic search over plant document chunks.",
  schema: {
    name: "search_startup_documents",
    description: "Search plant document chunks by meaning.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
        startup_id: { type: "string" },
      },
      required: ["query"],
    },
  },
  handler: async (input, ctx) => {
    const args = input as { query?: string; startup_id?: string };
    const q = args.query?.trim();
    if (!q) return { content: "Error: query is required." };
    const startupId = coalesceStartupId(args.startup_id, ctx.startupId);
    if (!startupId || !mongoose.Types.ObjectId.isValid(startupId)) {
      return { content: "Error: plant workspace required." };
    }
    try {
      const chunks = await retrieveRelevantChunks({
        startupId,
        query: q,
        topK: 6,
      });
      if (!chunks.length) {
        return { content: `No document chunks matched: "${q}".` };
      }
      return {
        content: chunks
          .map(
            (c, i) =>
              `### Hit ${i + 1}${c.filename ? ` — ${c.filename}` : ""}\n${c.chunkText}`,
          )
          .join("\n\n"),
      };
    } catch (err) {
      return {
        content:
          err instanceof Error
            ? `Search failed: ${err.message}`
            : "Search failed.",
      };
    }
  },
};
