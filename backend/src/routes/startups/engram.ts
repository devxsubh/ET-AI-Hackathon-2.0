import { Router } from "express";
import multer from "multer";
import { Startup } from "../../models/startup";
import { parseDocumentToText } from "../../lib/rag/parseDocument";
import { ingestDocumentText } from "../../lib/engram/ingest";
import {
  buildDemoKnowledgeGraph,
  buildDemoRiskReport,
  DEMO_PLANT_NAME,
} from "../../lib/engram/demoData";
import { computeRiskReport } from "../../lib/engram/riskAgent";
import type { KnowledgeGraph } from "../../lib/engram/types";
import { toStartup } from "./serializers";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

export const engramPlantRouter = Router({ mergeParams: true });

/** GET /api/startups/:id/graph */
engramPlantRouter.get("/:id/graph", async (req, res) => {
  const doc = (res.locals.accessibleStartup ?? res.locals.startup) as Record<
    string,
    unknown
  >;
  const kg = doc.knowledgeGraph ?? null;
  res.json({
    knowledgeGraph: kg,
    plant: { id: String(doc._id), name: doc.name },
  });
});

/** GET /api/startups/:id/risk */
engramPlantRouter.get("/:id/risk", async (req, res) => {
  const doc = (res.locals.accessibleStartup ?? res.locals.startup) as Record<
    string,
    unknown
  >;
  let riskReport = doc.riskReport as ReturnType<typeof computeRiskReport> | null;
  const kg = doc.knowledgeGraph as KnowledgeGraph | null;
  if ((!riskReport || !(riskReport as { atRiskAssets?: unknown[] }).atRiskAssets?.length) && kg) {
    riskReport = computeRiskReport(kg);
  }
  res.json({
    riskReport: riskReport ?? null,
    plant: { id: String(doc._id), name: doc.name },
  });
});

/** POST /api/startups/:id/demo — seed Bharat Engineering Works Unit 3 */
engramPlantRouter.post("/:id/demo", async (req, res) => {
  const id = req.params.id;
  const graph = buildDemoKnowledgeGraph();
  const riskReport = buildDemoRiskReport(graph);
  const updated = await Startup.findByIdAndUpdate(
    id,
    {
      name: DEMO_PLANT_NAME,
      knowledgeGraph: graph,
      riskReport,
    },
    { new: true },
  ).lean();
  if (!updated) {
    res.status(404).json({ detail: "Plant not found" });
    return;
  }
  res.json({
    plant: toStartup(updated),
    knowledgeGraph: graph,
    riskReport,
    message: `Loaded ${DEMO_PLANT_NAME} demo graph (${graph.nodes.length} nodes, ${graph.edges.length} edges).`,
  });
});

/** PATCH /api/startups/:id/graph — replace/merge graph from client */
engramPlantRouter.patch("/:id/graph", async (req, res) => {
  const id = req.params.id;
  const body = req.body as {
    knowledgeGraph?: KnowledgeGraph;
    riskReport?: unknown;
  };
  if (!body.knowledgeGraph) {
    res.status(400).json({ detail: "knowledgeGraph is required" });
    return;
  }
  const riskReport =
    body.riskReport ?? computeRiskReport(body.knowledgeGraph);
  const updated = await Startup.findByIdAndUpdate(
    id,
    {
      knowledgeGraph: body.knowledgeGraph,
      riskReport,
    },
    { new: true },
  ).lean();
  if (!updated) {
    res.status(404).json({ detail: "Plant not found" });
    return;
  }
  res.json({ plant: toStartup(updated) });
});

/**
 * POST /api/startups/:id/ingest
 * Multipart file upload OR JSON { text, filename } — runs Ingestor + Linker.
 * Returns SSE progress events then final graph.
 */
engramPlantRouter.post(
  "/:id/ingest",
  upload.single("file"),
  async (req, res) => {
    const id = req.params.id;
    const doc = (res.locals.accessibleStartup ?? res.locals.startup) as Record<
      string,
      unknown
    >;
    const existing = (doc.knowledgeGraph as KnowledgeGraph | null) ?? null;

    let text = "";
    let filename = "upload.txt";

    if (req.file) {
      filename = req.file.originalname || filename;
      try {
        const pages = await parseDocumentToText(
          req.file.buffer,
          req.file.mimetype || "application/octet-stream",
          filename,
        );
        text = pages.map((p) => p.text).join("\n\n");
      } catch (err) {
        res.status(400).json({
          detail: err instanceof Error ? err.message : "Failed to parse file",
        });
        return;
      }
    } else {
      const body = req.body as { text?: string; filename?: string; content?: string };
      text = (body.text ?? body.content ?? "").trim();
      filename = body.filename?.trim() || filename;
      if (!text) {
        res.status(400).json({
          detail: "Provide a file upload or JSON { text, filename }",
        });
        return;
      }
    }

    const wantsSse =
      req.headers.accept?.includes("text/event-stream") ||
      req.query.stream === "1";

    if (wantsSse) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      const write = (obj: unknown) => {
        res.write(`data: ${JSON.stringify(obj)}\n\n`);
      };

      try {
        const result = await ingestDocumentText(
          text,
          filename,
          existing,
          (event) => write({ type: "ingest_progress", ...event }),
        );

        await Startup.findByIdAndUpdate(id, {
          knowledgeGraph: result.graph,
          riskReport: result.riskReport,
        });

        write({
          type: "final_result",
          knowledgeGraph: result.graph,
          riskReport: result.riskReport,
          addedNodes: result.addedNodes,
          addedEdges: result.addedEdges,
          filename,
        });
      } catch (err) {
        write({
          type: "error",
          detail: err instanceof Error ? err.message : "Ingest failed",
        });
      }
      res.end();
      return;
    }

    try {
      const result = await ingestDocumentText(text, filename, existing);
      const updated = await Startup.findByIdAndUpdate(
        id,
        {
          knowledgeGraph: result.graph,
          riskReport: result.riskReport,
        },
        { new: true },
      ).lean();

      res.json({
        plant: updated ? toStartup(updated) : null,
        knowledgeGraph: result.graph,
        riskReport: result.riskReport,
        addedNodes: result.addedNodes,
        addedEdges: result.addedEdges,
        filename,
      });
    } catch (err) {
      res.status(500).json({
        detail: err instanceof Error ? err.message : "Ingest failed",
      });
    }
  },
);
