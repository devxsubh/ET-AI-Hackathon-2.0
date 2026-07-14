import express from "express";
import { getAnthropicModel } from "../lib/llm/models";
import { isEmbeddingEnabled } from "../lib/rag/embed";
import { isWebSearchEnabled } from "../lib/infra/webSearchConfig";

export const configRouter = express.Router();

/** Public runtime config — model selection lives on the server only. */
configRouter.get("/", (_req, res) => {
  res.json({
    llm: {
      provider: "anthropic",
      model: getAnthropicModel(),
    },
    ragEnabled: isEmbeddingEnabled(),
    webSearchEnabled: isWebSearchEnabled(),
    product: "engram",
  });
});
