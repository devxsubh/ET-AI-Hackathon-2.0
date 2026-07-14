import {
  UNTRUSTED_DATA_PROMPT_GUARD,
} from "../shared/promptDelimiters";
import { formatMentionedStartupsContext } from "./startupMentions";
import type { ToolContext } from "../tools/types";
import type { ToolRegistry } from "../tools/registry";

/**
 * Assembles the dynamic suffix appended to each route's base system prompt.
 */
export function buildSystemPrompt(
  basePrompt: string,
  ctx: ToolContext,
  registry: ToolRegistry,
): string {
  const parts: string[] = [basePrompt];

  const routingSection = registry.buildRoutingSection();
  if (routingSection) parts.push(routingSection);

  parts.push(UNTRUSTED_DATA_PROMPT_GUARD);

  if (ctx.startupId) {
    parts.push(
      `Active plant workspace id: ${ctx.startupId}. ` +
        `Call load_demo_plant to seed Unit 3 demo data, or use ask_knowledge / traverse_graph / get_knowledge_risk against the loaded knowledge graph.`,
    );
  }

  if (ctx.mentionedStartups && ctx.mentionedStartups.length > 0) {
    parts.push(formatMentionedStartupsContext(ctx.mentionedStartups));
  }

  if (ctx.knowledgeGraph && ctx.knowledgeGraph.nodes.length > 0) {
    const byType: Record<string, number> = {};
    for (const n of ctx.knowledgeGraph.nodes) {
      byType[n.type] = (byType[n.type] ?? 0) + 1;
    }
    parts.push(
      `Knowledge graph loaded in this session:\n${JSON.stringify({
        nodeCount: ctx.knowledgeGraph.nodes.length,
        edgeCount: ctx.knowledgeGraph.edges.length,
        byType,
        updatedAt: ctx.knowledgeGraph.updatedAt,
      })}`,
    );
  }

  if (ctx.riskReport && ctx.riskReport.atRiskAssets.length > 0) {
    parts.push(
      `Knowledge Risk Radar summary: ${ctx.riskReport.summary}\n` +
        `Critical assets: ${ctx.riskReport.atRiskAssets
          .filter((a) => a.riskLevel === "critical")
          .map((a) => a.assetName)
          .join(", ") || "none"}`,
    );
  }

  if (!ctx.knowledgeGraph || ctx.knowledgeGraph.nodes.length === 0) {
    parts.push(
      "No knowledge graph is loaded. Call load_demo_plant for the Bharat Engineering Works Unit 3 demo, " +
        "or ask the user to open a plant and ingest documents. " +
        "For OEM manuals / public standards lookups, call web_search.",
    );
  }

  if (ctx.attachedDocuments && ctx.attachedDocuments.length > 0) {
    const list = ctx.attachedDocuments
      .map((d) => `- ${d.filename} (document_id: ${d.document_id})`)
      .join("\n");
    parts.push(
      `Documents attached to the user's latest message:\n${list}\n` +
        "Use list_startup_documents / search_startup_documents when relevant.",
    );
  }

  if (ctx.displayedDocument) {
    parts.push(
      `The user currently has this document open: ${ctx.displayedDocument.filename} (document_id: ${ctx.displayedDocument.document_id}).`,
    );
  }

  // Legacy CSV path — still accepted but not primary
  if (ctx.csvContent && !ctx.knowledgeGraph) {
    parts.push(
      `A document/CSV text blob is attached (${ctx.csvContent.split("\n").length} lines). Prefer plant graph tools; this is legacy context.`,
    );
  }

  return parts.join("\n\n");
}
