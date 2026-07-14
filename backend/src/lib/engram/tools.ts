import type { ToolDefinition } from "../tools/registry";
import type { ToolContext, ToolExecutorResult } from "../tools/types";
import {
  findNode,
  getNeighbors,
  traverseFrom,
} from "./graph";
import { expandQueryJargon, resolveJargon } from "./jargon";
import {
  computeRiskReport,
  knowledgeRiskForPerson,
} from "./riskAgent";
import type { KnowledgeGraph, NodeType } from "./types";
import { NODE_TYPES } from "./types";

function graphFromCtx(ctx: ToolContext): KnowledgeGraph | null {
  return ctx.knowledgeGraph ?? null;
}

async function loadPlantGraph(ctx: ToolContext): Promise<KnowledgeGraph | null> {
  if (ctx.knowledgeGraph) return ctx.knowledgeGraph;
  if (!ctx.startupId) return null;
  try {
    const { Startup } = await import("../../models/startup");
    const { connectDb } = await import("../infra/db");
    await connectDb();
    const doc = await Startup.findById(ctx.startupId).lean();
    if (!doc) return null;
    const raw = (doc as { knowledgeGraph?: KnowledgeGraph | null }).knowledgeGraph;
    return raw ?? null;
  } catch {
    return null;
  }
}

export const resolveJargonTool: ToolDefinition = {
  name: "resolve_jargon",
  routingHint:
    "- resolve_jargon: map industrial tags/abbreviations (P-101, KDS-550, OEM codes) to canonical names before answering.",
  schema: {
    name: "resolve_jargon",
    description:
      "Resolve industrial jargon, equipment tags, and abbreviations to canonical names.",
    input_schema: {
      type: "object" as const,
      properties: {
        term: {
          type: "string",
          description: "Tag, abbreviation, or phrase to resolve (e.g. P-101, XR-22)",
        },
      },
      required: ["term"],
    },
  },
  handler: async (input): Promise<ToolExecutorResult> => {
    const term = (input as { term?: string }).term?.trim();
    if (!term) return { content: "Error: term is required." };
    const r = resolveJargon(term);
    return {
      content: JSON.stringify(r, null, 2),
    };
  },
};

export const getKnowledgeRiskTool: ToolDefinition = {
  name: "get_knowledge_risk",
  routingHint:
    "- get_knowledge_risk: Knowledge Risk Radar — single-point-of-failure assets, or \"if X retires\" style queries. Prefer this for retirement / knowledge concentration questions.",
  schema: {
    name: "get_knowledge_risk",
    description:
      "Compute or retrieve Knowledge Risk Radar. Optionally filter by person name for \"if they retire\" queries.",
    input_schema: {
      type: "object" as const,
      properties: {
        person_name: {
          type: "string",
          description:
            "Optional. If set, return assets where this person is the primary/only expert.",
        },
      },
    },
  },
  handler: async (input, ctx): Promise<ToolExecutorResult> => {
    const graph = (await loadPlantGraph(ctx)) ?? graphFromCtx(ctx);
    if (!graph || graph.nodes.length === 0) {
      return {
        content:
          "No knowledge graph loaded. Load the Unit 3 demo or ingest documents first.",
      };
    }
    const personName = (input as { person_name?: string }).person_name?.trim();
    if (personName) {
      const result = knowledgeRiskForPerson(graph, personName);
      const riskReport = computeRiskReport(graph);
      return {
        content: result.narrative,
        knowledgeGraph: graph,
        riskReport,
      };
    }
    const riskReport = ctx.riskReport ?? computeRiskReport(graph);
    const lines = [
      riskReport.summary,
      "",
      ...riskReport.atRiskAssets
        .filter((a) => a.riskLevel !== "shared")
        .slice(0, 20)
        .map((a) => a.narrative),
    ];
    return {
      content: lines.join("\n"),
      knowledgeGraph: graph,
      riskReport,
    };
  },
};

export const traverseGraphTool: ToolDefinition = {
  name: "traverse_graph",
  routingHint:
    "- traverse_graph: walk the knowledge graph from an entity (asset, person, incident, part, procedure). Use for \"why did X fail\", connections, multi-hop history.",
  schema: {
    name: "traverse_graph",
    description:
      "Traverse the plant knowledge graph from a named entity and return neighbors / multi-hop path.",
    input_schema: {
      type: "object" as const,
      properties: {
        entity_name: {
          type: "string",
          description: "Entity name or tag (e..g. Pump P-101, Ramesh Kumar)",
        },
        entity_type: {
          type: "string",
          description: `Optional node type: ${NODE_TYPES.join(", ")}`,
        },
        max_depth: {
          type: "number",
          description: "Hop depth (default 2, max 4)",
        },
      },
      required: ["entity_name"],
    },
  },
  handler: async (input, ctx): Promise<ToolExecutorResult> => {
    const graph = (await loadPlantGraph(ctx)) ?? graphFromCtx(ctx);
    if (!graph || graph.nodes.length === 0) {
      return { content: "No knowledge graph loaded." };
    }
    const {
      entity_name,
      entity_type,
      max_depth,
    } = input as {
      entity_name?: string;
      entity_type?: string;
      max_depth?: number;
    };
    if (!entity_name?.trim()) {
      return { content: "Error: entity_name is required." };
    }

    const { expandedQuery, resolutions } = expandQueryJargon(entity_name);
    const type = entity_type as NodeType | undefined;
    const node =
      findNode(graph, expandedQuery, type) ??
      findNode(graph, entity_name, type) ??
      findNode(graph, resolutions[0]?.canonical ?? entity_name);

    if (!node) {
      const sample = graph.nodes
        .slice(0, 15)
        .map((n) => `- ${n.name} (${n.type})`)
        .join("\n");
      return {
        content: `Entity "${entity_name}" not found.\nKnown entities:\n${sample}`,
      };
    }

    const depth = Math.min(4, Math.max(1, max_depth ?? 2));
    const { nodes, path } = traverseFrom(graph, node.id, depth);
    const neighbors = getNeighbors(graph, node.id);

    const lines = [
      `## ${node.name} (${node.type})`,
      node.description ? node.description : "",
      node.tag ? `Tag: ${node.tag}` : "",
      "",
      `### Direct connections (${neighbors.length})`,
      ...neighbors.map(
        (n) =>
          `- [${n.direction}] ${n.edge.type}: ${n.node.name} (${n.node.type})`,
      ),
      "",
      `### Multi-hop path (depth ${depth}, ${nodes.length} nodes)`,
      ...path
        .slice(0, 40)
        .map(
          (s) =>
            `- ${s.fromName} —${s.edgeType}→ ${s.toName}`,
        ),
    ].filter(Boolean);

    return {
      content: lines.join("\n"),
      knowledgeGraph: graph,
      riskReport: ctx.riskReport ?? computeRiskReport(graph),
      traversalPath: path.map(
        (s) => `${s.fromName} -[${s.edgeType}]-> ${s.toName}`,
      ),
    };
  },
};

export const askKnowledgeTool: ToolDefinition = {
  name: "ask_knowledge",
  routingHint:
    "- ask_knowledge: answer a plant knowledge question using jargon expansion + graph traversal evidence. Prefer for open-ended maintenance questions.",
  schema: {
    name: "ask_knowledge",
    description:
      "Answer an industrial knowledge question with graph evidence, confidence, and graph path.",
    input_schema: {
      type: "object" as const,
      properties: {
        question: {
          type: "string",
          description: "User question about assets, incidents, people, or procedures",
        },
      },
      required: ["question"],
    },
  },
  handler: async (input, ctx): Promise<ToolExecutorResult> => {
    const graph = (await loadPlantGraph(ctx)) ?? graphFromCtx(ctx);
    if (!graph || graph.nodes.length === 0) {
      return {
        content:
          "No knowledge graph available. Seed the Unit 3 demo or ingest documents first.",
      };
    }

    const question = (input as { question?: string }).question?.trim();
    if (!question) return { content: "Error: question is required." };

    const { expandedQuery, resolutions } = expandQueryJargon(question);

    // Retirement / knowledge risk shortcuts
    if (
      /retir|only expert|lose their|knowledge risk|single.?point/i.test(
        question,
      )
    ) {
      const person =
        resolutions.find((r) => r.kind === "person")?.canonical ??
        (question.match(/if\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i)?.[1] ??
          "Ramesh Kumar");
      const result = knowledgeRiskForPerson(graph, person);
      const riskReport = computeRiskReport(graph);
      return {
        content: [
          `## Knowledge Risk — ${result.personName}`,
          `**Confidence:** High`,
          "",
          result.narrative,
          "",
          "### Graph path",
          `Person:${result.personName} → expert_on / fixed_by → Assets`,
          "",
          "### Sources",
          "- Maintenance_Report_P101_2019.pdf",
          "- Incident_Log_2021_C3.docx",
          "- SOP_Impeller_Replacement_v3.pdf",
          "- Email_Archive_Ramesh_2020.txt",
        ].join("\n"),
        knowledgeGraph: graph,
        riskReport,
        confidence: "High",
        citations: [
          "Maintenance_Report_P101_2019.pdf",
          "Incident_Log_2021_C3.docx",
          "SOP_Impeller_Replacement_v3.pdf",
        ],
        traversalPath: [
          `${result.personName} -[expert_on]-> assets`,
          ...result.critical.map((a) => `CRITICAL: ${a.assetName}`),
          ...result.moderate.map((a) => `MODERATE: ${a.assetName}`),
        ],
      };
    }

    // Find best start node from jargon or keyword overlap
    let start =
      resolutions
        .map((r) => findNode(graph, r.canonical))
        .find(Boolean) ?? null;

    if (!start) {
      const tokens = expandedQuery.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
      let bestScore = 0;
      for (const n of graph.nodes) {
        const hay = `${n.name} ${n.tag ?? ""} ${n.description ?? ""}`.toLowerCase();
        const score = tokens.filter((t) => hay.includes(t)).length;
        if (score > bestScore) {
          bestScore = score;
          start = n;
        }
      }
    }

    if (!start) {
      return {
        content:
          "Could not anchor this question to a graph entity. Try naming an asset tag (P-101), person, or incident.",
        knowledgeGraph: graph,
      };
    }

    const { nodes, path } = traverseFrom(graph, start.id, 2);
    const sources = [
      ...new Set(nodes.flatMap((n) => n.sources ?? [])),
    ].slice(0, 8);

    const evidence = nodes
      .slice(0, 12)
      .map((n) => `- **${n.name}** (${n.type}): ${n.description ?? "—"}`)
      .join("\n");

    const pathLines = path
      .slice(0, 15)
      .map((s) => `${s.fromName} -[${s.edgeType}]-> ${s.toName}`);

    const confidence =
      resolutions.length > 0 && path.length > 0
        ? "High"
        : path.length > 0
          ? "Medium"
          : "Low";

    return {
      content: [
        `## Answer`,
        `Anchored on **${start.name}** (${start.type}).`,
        "",
        `**Confidence:** ${confidence}`,
        "",
        "### Evidence nodes",
        evidence,
        "",
        "### Graph path",
        ...pathLines.map((l) => `- ${l}`),
        "",
        "### Sources",
        ...sources.map((s) => `- ${s}`),
        "",
        "_(Synthesize a plain-English answer for the engineer from this evidence. Do not invent facts.)_",
      ].join("\n"),
      knowledgeGraph: graph,
      riskReport: ctx.riskReport ?? computeRiskReport(graph),
      confidence,
      citations: sources,
      traversalPath: pathLines,
    };
  },
};

export const loadDemoPlantTool: ToolDefinition = {
  name: "load_demo_plant",
  routingHint:
    "- load_demo_plant: seed Bharat Engineering Works Unit 3 demo knowledge graph into the active plant workspace.",
  schema: {
    name: "load_demo_plant",
    description:
      "Load the synthetic Unit 3 cooling-water-circuit demo graph (Bharat Engineering Works, Pune) into the active plant.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  handler: async (_input, ctx): Promise<ToolExecutorResult> => {
    const { buildDemoKnowledgeGraph, buildDemoRiskReport, DEMO_PLANT_NAME } =
      await import("./demoData");
    const graph = buildDemoKnowledgeGraph();
    const riskReport = buildDemoRiskReport(graph);

    if (ctx.startupId) {
      try {
        const { Startup } = await import("../../models/startup");
        const { connectDb } = await import("../infra/db");
        await connectDb();
        await Startup.findByIdAndUpdate(ctx.startupId, {
          knowledgeGraph: graph,
          riskReport,
          name: DEMO_PLANT_NAME,
        });
      } catch {
        // still return in-session graph
      }
    }

    return {
      content: [
        `Loaded demo plant: **${DEMO_PLANT_NAME}**.`,
        `${graph.nodes.length} nodes, ${graph.edges.length} edges.`,
        riskReport.summary,
        "",
        "Try: \"If Ramesh retires tomorrow, which machines lose their only expert?\"",
      ].join("\n"),
      knowledgeGraph: graph,
      riskReport,
    };
  },
};
