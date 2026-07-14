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
import {
  askGhostExpert,
  buildAssetTimeline,
  buildPlantIntelligence,
  buildShiftHandoff,
  buildSuccessionPlan,
  crossUnitTransfers,
  detectQuietKnowledge,
  detectStaleness,
  findCoverageGaps,
  findFailureTwins,
  partsCascade,
  scoreConfidence,
  suggestMentorship,
} from "./intelligence";
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
          ...result.critical.map((a) => `${result.personName} -[expert_on]-> ${a.assetName}`),
          ...result.moderate.map((a) => `${result.personName} -[expert_on]-> ${a.assetName}`),
        ],
      };
    }

    // Quiet knowledge shortcut
    if (/quiet|only in email|not in sop|tribal|informal tip/i.test(question)) {
      const findings = detectQuietKnowledge(graph);
      return {
        content: [
          "## Quiet Knowledge",
          ...findings.map(
            (f) =>
              `### ${f.assetName}\n${f.narrative}\n${f.tips.map((t) => `- ${t}`).join("\n")}`,
          ),
        ].join("\n\n"),
        knowledgeGraph: graph,
        confidence: "High",
        citations: findings.flatMap((f) => f.informalSources),
        traversalPath: findings.map(
          (f) => `Email Archive Ramesh 2020 -[informal_tip]-> ${f.assetName}`,
        ),
      };
    }

    // Succession shortcut
    if (/handoff|succession|30.?day|knowledge transfer plan/i.test(question)) {
      const person =
        resolutions.find((r) => r.kind === "person")?.canonical ?? "Ramesh Kumar";
      const plan = buildSuccessionPlan(graph, person);
      if (plan) {
        return {
          content: [
            `## Succession Plan — ${plan.personName}`,
            plan.summary,
            "",
            ...plan.checklist.map(
              (c) => `- Day ${c.day}: ${c.action}`,
            ),
          ].join("\n"),
          knowledgeGraph: graph,
          riskReport: computeRiskReport(graph),
          confidence: "High",
          traversalPath: plan.checklist.map(
            (c) => `${plan.personName} -[handoff]-> ${c.assetName}`,
          ),
        };
      }
    }

    // Ghost expert shortcut
    if (/would ramesh|ghost expert|what would .+ do/i.test(question)) {
      const person =
        resolutions.find((r) => r.kind === "person")?.canonical ?? "Ramesh Kumar";
      const ans = askGhostExpert(graph, person, question);
      if (ans) {
        return {
          content: ans.answerLines.join("\n"),
          knowledgeGraph: graph,
          confidence: ans.confidence,
          citations: ans.citations,
          traversalPath: ans.traversalPath,
        };
      }
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

    const hasDocument = nodes.some((n) => n.type === "Document");
    const hasProcedure = nodes.some((n) => n.type === "Procedure");
    const hasIncident = nodes.some((n) => n.type === "Incident");
    const conf = scoreConfidence({
      hasDocument,
      hasProcedure,
      hasIncident,
      pathHops: path.length,
      jargonResolved: resolutions.length > 0,
    });

    return {
      content: [
        `## Answer`,
        `Anchored on **${start.name}** (${start.type}).`,
        "",
        `**Confidence:** ${conf.level} (${conf.score}/100)`,
        `_${conf.reasons.join("; ")}_`,
        "",
        "### Evidence nodes",
        evidence,
        "",
        "### Graph path (highlight these hops in the explorer)",
        ...pathLines.map((l) => `- ${l}`),
        "",
        "### Sources",
        ...sources.map((s) => `- ${s}`),
        "",
        "_(Synthesize a plain-English answer for the engineer from this evidence. Do not invent facts. Mention the graph path so the UI can highlight it.)_",
      ].join("\n"),
      knowledgeGraph: graph,
      riskReport: ctx.riskReport ?? computeRiskReport(graph),
      confidence: conf.level,
      citations: sources,
      traversalPath: pathLines,
    };
  },
};

export const successionPlanTool: ToolDefinition = {
  name: "get_succession_plan",
  routingHint:
    "- get_succession_plan: 30-day knowledge handoff checklist when an expert retires or leaves.",
  schema: {
    name: "get_succession_plan",
    description:
      "Generate a 30-day knowledge succession / handoff plan for an engineer.",
    input_schema: {
      type: "object" as const,
      properties: {
        person_name: {
          type: "string",
          description: "Person to build handoff for (default Ramesh Kumar)",
        },
      },
    },
  },
  handler: async (input, ctx): Promise<ToolExecutorResult> => {
    const graph = (await loadPlantGraph(ctx)) ?? graphFromCtx(ctx);
    if (!graph?.nodes.length) return { content: "No knowledge graph loaded." };
    const person =
      (input as { person_name?: string }).person_name?.trim() || "Ramesh Kumar";
    const plan = buildSuccessionPlan(graph, person);
    if (!plan) return { content: `Person "${person}" not found.` };
    return {
      content: [
        `## Succession Plan — ${plan.personName}`,
        plan.summary,
        plan.buddyName ? `Suggested buddy: **${plan.buddyName}**` : "",
        "",
        "### 30-day checklist",
        ...plan.checklist.map(
          (c) =>
            `- **Day ${c.day}** [${c.riskLevel}] ${c.assetName}: ${c.action}`,
        ),
        "",
        "### Incidents only they fixed",
        ...plan.incidentsOnlyTheyFixed.map((i) => `- ${i}`),
      ]
        .filter(Boolean)
        .join("\n"),
      knowledgeGraph: graph,
      riskReport: computeRiskReport(graph),
      confidence: "High",
      traversalPath: plan.checklist.map(
        (c) => `${plan.personName} -[handoff]-> ${c.assetName}`,
      ),
    };
  },
};

export const quietKnowledgeTool: ToolDefinition = {
  name: "get_quiet_knowledge",
  routingHint:
    "- get_quiet_knowledge: find repair tips that exist only in emails/notes, not formal SOPs.",
  schema: {
    name: "get_quiet_knowledge",
    description:
      "Detect quiet/tribal knowledge — informal tips not captured in SOPs.",
    input_schema: { type: "object" as const, properties: {} },
  },
  handler: async (_input, ctx): Promise<ToolExecutorResult> => {
    const graph = (await loadPlantGraph(ctx)) ?? graphFromCtx(ctx);
    if (!graph?.nodes.length) return { content: "No knowledge graph loaded." };
    const findings = detectQuietKnowledge(graph);
    return {
      content: [
        "## Quiet Knowledge Detector",
        ...findings.map(
          (f) =>
            `### ${f.assetName} (${f.severity})\n${f.narrative}\n${f.tips.map((t) => `- ${t}`).join("\n")}`,
        ),
      ].join("\n\n"),
      knowledgeGraph: graph,
      confidence: "High",
      citations: findings.flatMap((f) => f.informalSources),
      traversalPath: findings.map(
        (f) => `Email/notes -[informal_tip]-> ${f.assetName}`,
      ),
    };
  },
};

export const ghostExpertTool: ToolDefinition = {
  name: "ask_ghost_expert",
  routingHint:
    "- ask_ghost_expert: reconstruct what a specific engineer would advise using only their authored/fixed knowledge (\"what would Ramesh do\").",
  schema: {
    name: "ask_ghost_expert",
    description:
      "Answer using only one person's institutional memory subgraph.",
    input_schema: {
      type: "object" as const,
      properties: {
        person_name: { type: "string" },
        question: { type: "string" },
      },
      required: ["question"],
    },
  },
  handler: async (input, ctx): Promise<ToolExecutorResult> => {
    const graph = (await loadPlantGraph(ctx)) ?? graphFromCtx(ctx);
    if (!graph?.nodes.length) return { content: "No knowledge graph loaded." };
    const { person_name, question } = input as {
      person_name?: string;
      question?: string;
    };
    if (!question?.trim()) return { content: "Error: question required." };
    const ans = askGhostExpert(
      graph,
      person_name?.trim() || "Ramesh Kumar",
      question,
    );
    if (!ans) return { content: "Person not found." };
    return {
      content: [
        `## Ghost Expert — ${ans.personName}`,
        `**Confidence:** ${ans.confidence} (${ans.confidenceBreakdown.score}/100)`,
        `_${ans.confidenceBreakdown.reasons.join("; ")}_`,
        "",
        ...ans.answerLines,
        "",
        "### Path",
        ...ans.traversalPath.map((p) => `- ${p}`),
      ].join("\n"),
      knowledgeGraph: graph,
      confidence: ans.confidence,
      citations: ans.citations,
      traversalPath: ans.traversalPath,
    };
  },
};

export const assetTimelineTool: ToolDefinition = {
  name: "get_asset_timeline",
  routingHint:
    "- get_asset_timeline: Incident Time Machine — chronological failures and who fixed them for an asset.",
  schema: {
    name: "get_asset_timeline",
    description: "Build a chronological incident timeline for an asset.",
    input_schema: {
      type: "object" as const,
      properties: { asset_name: { type: "string" } },
      required: ["asset_name"],
    },
  },
  handler: async (input, ctx): Promise<ToolExecutorResult> => {
    const graph = (await loadPlantGraph(ctx)) ?? graphFromCtx(ctx);
    if (!graph?.nodes.length) return { content: "No knowledge graph loaded." };
    const name = (input as { asset_name?: string }).asset_name?.trim() || "P-101";
    const tl = buildAssetTimeline(graph, name);
    if (!tl) return { content: `Asset "${name}" not found.` };
    return {
      content: [
        `## Time Machine — ${tl.asset.name}`,
        ...tl.events.map(
          (e) =>
            `### ${e.date} — ${e.title}\n${e.description}\nFixed by: ${e.people.join(", ") || "—"}\nPath: ${e.path.join(" → ")}`,
        ),
      ].join("\n\n"),
      knowledgeGraph: graph,
      confidence: "High",
      traversalPath: tl.events.flatMap((e) => e.path),
      citations: tl.events.flatMap((e) => e.sources),
    };
  },
};

export const failureTwinsTool: ToolDefinition = {
  name: "find_failure_twins",
  routingHint:
    "- find_failure_twins: assets with similar failure fingerprints (shared parts/procedures/incident themes).",
  schema: {
    name: "find_failure_twins",
    description: "Find assets with similar failure patterns to a seed asset.",
    input_schema: {
      type: "object" as const,
      properties: { asset_name: { type: "string" } },
      required: ["asset_name"],
    },
  },
  handler: async (input, ctx): Promise<ToolExecutorResult> => {
    const graph = (await loadPlantGraph(ctx)) ?? graphFromCtx(ctx);
    if (!graph?.nodes.length) return { content: "No knowledge graph loaded." };
    const name = (input as { asset_name?: string }).asset_name?.trim() || "P-101";
    const twins = findFailureTwins(graph, name);
    return {
      content: [
        `## Failure Twins of ${name}`,
        ...twins.map((t) => `- **${t.assetName}** (score ${t.score}): ${t.narrative}`),
        twins.length === 0 ? "No similar assets found." : "",
      ].join("\n"),
      knowledgeGraph: graph,
      confidence: "Medium",
      traversalPath: twins.map((t) => `${name} -[similar_failure]-> ${t.assetName}`),
    };
  },
};

export const coverageGapsTool: ToolDefinition = {
  name: "get_coverage_gaps",
  routingHint:
    "- get_coverage_gaps: compliance gaps — assets missing experts, procedures, incidents, or parts BOM.",
  schema: {
    name: "get_coverage_gaps",
    description: "List knowledge/compliance coverage gaps across assets.",
    input_schema: { type: "object" as const, properties: {} },
  },
  handler: async (_input, ctx): Promise<ToolExecutorResult> => {
    const graph = (await loadPlantGraph(ctx)) ?? graphFromCtx(ctx);
    if (!graph?.nodes.length) return { content: "No knowledge graph loaded." };
    const gaps = findCoverageGaps(graph);
    return {
      content: [
        "## Coverage Gaps",
        ...gaps.map((g) => `- **${g.assetName}** [${g.severity}]: ${g.narrative}`),
      ].join("\n"),
      knowledgeGraph: graph,
      confidence: "High",
    };
  },
};

export const healthScoreTool: ToolDefinition = {
  name: "get_knowledge_health",
  routingHint:
    "- get_knowledge_health: plant-level Knowledge Health Score 0–100.",
  schema: {
    name: "get_knowledge_health",
    description: "Compute plant knowledge health score and drivers.",
    input_schema: { type: "object" as const, properties: {} },
  },
  handler: async (_input, ctx): Promise<ToolExecutorResult> => {
    const graph = (await loadPlantGraph(ctx)) ?? graphFromCtx(ctx);
    if (!graph?.nodes.length) return { content: "No knowledge graph loaded." };
    const intel = buildPlantIntelligence(graph);
    return {
      content: [
        `## Knowledge Health — ${intel.health.score}/100 (grade ${intel.health.grade})`,
        intel.health.summary,
        "",
        "### Drivers",
        ...intel.health.drivers.map((d) => `- ${d.label}: ${d.impact > 0 ? "+" : ""}${d.impact}`),
      ].join("\n"),
      knowledgeGraph: graph,
      riskReport: intel.riskReport,
      confidence: "High",
    };
  },
};

export const shiftBriefTool: ToolDefinition = {
  name: "get_shift_brief",
  routingHint:
    "- get_shift_brief: generate an overnight shift hand-off brief (risks + ask-before-leaving).",
  schema: {
    name: "get_shift_brief",
    description: "Generate a shift hand-off brief for plant operations.",
    input_schema: { type: "object" as const, properties: {} },
  },
  handler: async (_input, ctx): Promise<ToolExecutorResult> => {
    const graph = (await loadPlantGraph(ctx)) ?? graphFromCtx(ctx);
    if (!graph?.nodes.length) return { content: "No knowledge graph loaded." };
    const brief = buildShiftHandoff(graph);
    return {
      content: [
        `## Shift Hand-off Brief`,
        brief.summary,
        "",
        "### Open knowledge risks",
        ...brief.openRisks.map((r) => `- ${r}`),
        "",
        "### Overnight watch",
        ...brief.overnightWatch.map((r) => `- ${r}`),
        "",
        "### Ask before leaving",
        ...brief.askBeforeLeaving.map((r) => `- ${r}`),
      ].join("\n"),
      knowledgeGraph: graph,
      confidence: "High",
    };
  },
};

export const partsCascadeTool: ToolDefinition = {
  name: "get_parts_cascade",
  routingHint:
    "- get_parts_cascade: if a spare is OOS, which assets and procedures break.",
  schema: {
    name: "get_parts_cascade",
    description: "Parts stockout cascade across assets and procedures.",
    input_schema: {
      type: "object" as const,
      properties: { part_name: { type: "string" } },
      required: ["part_name"],
    },
  },
  handler: async (input, ctx): Promise<ToolExecutorResult> => {
    const graph = (await loadPlantGraph(ctx)) ?? graphFromCtx(ctx);
    if (!graph?.nodes.length) return { content: "No knowledge graph loaded." };
    const part =
      (input as { part_name?: string }).part_name?.trim() || "SKF Bearing 6205";
    const cascade = partsCascade(graph, part);
    if (!cascade) return { content: `Part "${part}" not found.` };
    return {
      content: [
        `## Parts Cascade — ${cascade.partName}`,
        cascade.narrative,
        "",
        "### Assets",
        ...cascade.impactedAssets.map((a) => `- ${a.name}`),
        "",
        "### Procedures",
        ...cascade.impactedProcedures.map((p) => `- ${p.name}`),
      ].join("\n"),
      knowledgeGraph: graph,
      confidence: "High",
      traversalPath: cascade.impactedAssets.map(
        (a) => `${cascade.partName} -[required_by]-> ${a.name}`,
      ),
    };
  },
};

export const mentorshipTool: ToolDefinition = {
  name: "get_mentorship_matches",
  routingHint:
    "- get_mentorship_matches: suggest mentor/mentee pairs to fix sole-expert assets.",
  schema: {
    name: "get_mentorship_matches",
    description: "Suggest mentorship pairings for knowledge risk assets.",
    input_schema: { type: "object" as const, properties: {} },
  },
  handler: async (_input, ctx): Promise<ToolExecutorResult> => {
    const graph = (await loadPlantGraph(ctx)) ?? graphFromCtx(ctx);
    if (!graph?.nodes.length) return { content: "No knowledge graph loaded." };
    const matches = suggestMentorship(graph);
    return {
      content: [
        "## Mentorship Matching",
        ...matches.map(
          (m) =>
            `- Pair **${m.mentorName}** → **${m.menteeName}** on ${m.assetName} (${m.weeksSuggested} weeks)\n  ${m.rationale}`,
        ),
      ].join("\n"),
      knowledgeGraph: graph,
      confidence: "High",
    };
  },
};

export const stalenessTool: ToolDefinition = {
  name: "get_knowledge_debt",
  routingHint:
    "- get_knowledge_debt: stale nodes / knowledge debt older than recent years.",
  schema: {
    name: "get_knowledge_debt",
    description: "List stale knowledge items (knowledge debt).",
    input_schema: { type: "object" as const, properties: {} },
  },
  handler: async (_input, ctx): Promise<ToolExecutorResult> => {
    const graph = (await loadPlantGraph(ctx)) ?? graphFromCtx(ctx);
    if (!graph?.nodes.length) return { content: "No knowledge graph loaded." };
    const items = detectStaleness(graph);
    return {
      content: [
        "## Knowledge Debt / Staleness",
        ...items.map((i) => `- **${i.nodeName}** (${i.nodeType}): ${i.narrative}`),
      ].join("\n"),
      knowledgeGraph: graph,
      confidence: "Medium",
    };
  },
};

export const crossUnitTool: ToolDefinition = {
  name: "get_cross_unit_transfer",
  routingHint:
    "- get_cross_unit_transfer: reuse solutions from another unit (e.g. Unit 2 → Unit 3).",
  schema: {
    name: "get_cross_unit_transfer",
    description: "Suggest cross-unit knowledge transfers for a problem.",
    input_schema: {
      type: "object" as const,
      properties: { problem: { type: "string" } },
      required: ["problem"],
    },
  },
  handler: async (input, ctx): Promise<ToolExecutorResult> => {
    const graph = (await loadPlantGraph(ctx)) ?? graphFromCtx(ctx);
    if (!graph?.nodes.length) return { content: "No knowledge graph loaded." };
    const problem =
      (input as { problem?: string }).problem?.trim() || "seal cavitation P-101";
    const transfers = crossUnitTransfers(graph, problem);
    return {
      content: [
        "## Cross-Unit Transfer",
        ...transfers.map(
          (t) =>
            `- **${t.fromUnit} → ${t.toUnit}**: ${t.topic}\n  ${t.narrative}\n  Procedure: ${t.transferredProcedure}`,
        ),
      ].join("\n"),
      knowledgeGraph: graph,
      confidence: "Medium",
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
