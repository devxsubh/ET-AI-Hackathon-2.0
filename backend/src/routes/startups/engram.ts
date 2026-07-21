import { Router } from "express";
import type { Request, Response } from "express";
import multer from "multer";
import { Startup } from "../../models/startup";
import { parseDocumentToText } from "../../lib/rag/parseDocument";
import { ingestDocumentText } from "../../lib/engram/ingest";
import { fetchRemoteDocument } from "../../lib/engram/fetchRemoteDocument";
import {
  buildDemoKnowledgeGraph,
  buildDemoRiskReport,
  DEMO_PLANT_NAME,
} from "../../lib/engram/demoData";
import { computeRiskReport } from "../../lib/engram/riskAgent";
import {
  buildPlantIntelligence,
  confirmEdge,
  ingestVoiceTranscript,
} from "../../lib/engram/intelligence";
import type { KnowledgeGraph } from "../../lib/engram/types";
import { findAccessibleStartup } from "../../lib/sample/sampleAssets";
import { toStartup } from "./serializers";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

export const engramPlantRouter = Router({ mergeParams: true });

async function resolvePlant(
  req: Request,
  res: Response,
): Promise<Record<string, unknown> | null> {
  const fromLocals = (res.locals.accessibleStartup ??
    res.locals.startup) as Record<string, unknown> | undefined;
  if (fromLocals?._id) return fromLocals;

  const id = String(req.params.id ?? "");
  const userId = res.locals.userId as string | undefined;
  if (!id || !userId) {
    res.status(401).json({ detail: "Unauthorized" });
    return null;
  }

  const startup = await findAccessibleStartup(id, userId);
  if (!startup) {
    res.status(404).json({ detail: "Plant not found" });
    return null;
  }
  res.locals.accessibleStartup = startup;
  return startup as Record<string, unknown>;
}

/** GET /api/startups/:id/graph */
engramPlantRouter.get("/:id/graph", async (req, res) => {
  try {
    const doc = await resolvePlant(req, res);
    if (!doc) return;

    const kg = (doc.knowledgeGraph as KnowledgeGraph | null) ?? null;
    res.json({
      knowledgeGraph: kg,
      plant: { id: String(doc._id), name: doc.name },
    });
  } catch (err) {
    console.error("[engram/graph]", err);
    res.status(500).json({
      detail: err instanceof Error ? err.message : "Failed to load graph",
    });
  }
});

/** GET /api/startups/:id/risk */
engramPlantRouter.get("/:id/risk", async (req, res) => {
  try {
    const doc = await resolvePlant(req, res);
    if (!doc) return;

    let riskReport = doc.riskReport as ReturnType<
      typeof computeRiskReport
    > | null;
    const kg = doc.knowledgeGraph as KnowledgeGraph | null;
    if (
      (!riskReport ||
        !(riskReport as { atRiskAssets?: unknown[] }).atRiskAssets?.length) &&
      kg
    ) {
      riskReport = computeRiskReport(kg);
    }
    res.json({
      riskReport: riskReport ?? null,
      plant: { id: String(doc._id), name: doc.name },
    });
  } catch (err) {
    console.error("[engram/risk]", err);
    res.status(500).json({
      detail: err instanceof Error ? err.message : "Failed to load risk",
    });
  }
});

/** POST /api/startups/:id/demo — seed Bharat Engineering Works Unit 3 */
engramPlantRouter.post("/:id/demo", async (req, res) => {
  try {
    const doc = await resolvePlant(req, res);
    if (!doc) return;

    const id = String(doc._id);
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
  } catch (err) {
    console.error("[engram/demo]", err);
    res.status(500).json({
      detail: err instanceof Error ? err.message : "Failed to load demo",
    });
  }
});

/** PATCH /api/startups/:id/graph — replace/merge graph from client */
engramPlantRouter.patch("/:id/graph", async (req, res) => {
  try {
    const doc = await resolvePlant(req, res);
    if (!doc) return;

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
      String(doc._id),
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
  } catch (err) {
    console.error("[engram/patch-graph]", err);
    res.status(500).json({
      detail: err instanceof Error ? err.message : "Failed to save graph",
    });
  }
});

/** GET /api/startups/:id/intelligence — full plant intelligence bundle */
engramPlantRouter.get("/:id/intelligence", async (req, res) => {
  try {
    const doc = await resolvePlant(req, res);
    if (!doc) return;
    const kg = doc.knowledgeGraph as KnowledgeGraph | null;
    if (!kg?.nodes?.length) {
      res.json({ intelligence: null, plant: { id: String(doc._id), name: doc.name } });
      return;
    }
    const person = String(req.query.person ?? "Ramesh Kumar");
    const asset = String(req.query.asset ?? "Pump P-101");
    const intelligence = buildPlantIntelligence(kg, person, asset);
    res.json({
      intelligence,
      plant: { id: String(doc._id), name: doc.name },
    });
  } catch (err) {
    console.error("[engram/intelligence]", err);
    res.status(500).json({
      detail: err instanceof Error ? err.message : "Failed to load intelligence",
    });
  }
});

/** POST /api/startups/:id/edges/:edgeId/confirm — human-in-the-loop edge confirm */
engramPlantRouter.post("/:id/edges/:edgeId/confirm", async (req, res) => {
  try {
    const doc = await resolvePlant(req, res);
    if (!doc) return;
    const kg = doc.knowledgeGraph as KnowledgeGraph | null;
    if (!kg) {
      res.status(400).json({ detail: "No knowledge graph" });
      return;
    }
    const edgeId = String(req.params.edgeId);
    const body = req.body as { confirmed?: boolean; by?: string };
    const confirmed = body.confirmed !== false;
    const next = confirmEdge(kg, edgeId, confirmed, body.by ?? "engineer");
    const riskReport = computeRiskReport(next);
    const updated = await Startup.findByIdAndUpdate(
      String(doc._id),
      { knowledgeGraph: next, riskReport },
      { new: true },
    ).lean();
    res.json({
      plant: updated ? toStartup(updated) : null,
      knowledgeGraph: next,
      riskReport,
      edgeId,
      confirmed,
    });
  } catch (err) {
    console.error("[engram/confirm-edge]", err);
    res.status(500).json({
      detail: err instanceof Error ? err.message : "Failed to confirm edge",
    });
  }
});

/** POST /api/startups/:id/voice — voice/field note → graph nodes */
engramPlantRouter.post("/:id/voice", async (req, res) => {
  try {
    const doc = await resolvePlant(req, res);
    if (!doc) return;
    const body = req.body as { transcript?: string; filename?: string };
    const transcript = (body.transcript ?? "").trim();
    if (!transcript) {
      res.status(400).json({ detail: "transcript is required" });
      return;
    }
    const existing = (doc.knowledgeGraph as KnowledgeGraph | null) ?? null;
    const result = ingestVoiceTranscript(
      existing,
      transcript,
      body.filename ?? "voice-note.txt",
    );
    const riskReport = computeRiskReport(result.graph);
    await Startup.findByIdAndUpdate(String(doc._id), {
      knowledgeGraph: result.graph,
      riskReport,
    });
    res.json({
      knowledgeGraph: result.graph,
      riskReport,
      addedNodes: result.addedNodes,
      addedEdges: result.addedEdges,
    });
  } catch (err) {
    console.error("[engram/voice]", err);
    res.status(500).json({
      detail: err instanceof Error ? err.message : "Voice ingest failed",
    });
  }
});

/**
 * POST /api/startups/:id/ingest
 * Multipart file upload OR JSON { text, filename } OR JSON { url } — Ingestor + Linker.
 */
engramPlantRouter.post(
  "/:id/ingest",
  upload.single("file"),
  async (req, res) => {
    try {
      const doc = await resolvePlant(req, res);
      if (!doc) return;

      const id = String(doc._id);
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
        const body = req.body as {
          text?: string;
          filename?: string;
          content?: string;
          url?: string;
        };
        const remoteUrl = body.url?.trim();
        if (remoteUrl) {
          try {
            const remote = await fetchRemoteDocument(remoteUrl);
            filename = body.filename?.trim() || remote.filename;
            const pages = await parseDocumentToText(
              remote.buffer,
              remote.mimeType,
              filename,
            );
            text = pages.map((p) => p.text).join("\n\n");
          } catch (err) {
            res.status(400).json({
              detail:
                err instanceof Error ? err.message : "Failed to fetch URL",
            });
            return;
          }
        } else {
          text = (body.text ?? body.content ?? "").trim();
          filename = body.filename?.trim() || filename;
        }
        if (!text) {
          res.status(400).json({
            detail:
              "Provide a file upload, JSON { text, filename }, or JSON { url }",
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
      console.error("[engram/ingest]", err);
      if (!res.headersSent) {
        res.status(500).json({
          detail: err instanceof Error ? err.message : "Ingest failed",
        });
      }
    }
  },
);
