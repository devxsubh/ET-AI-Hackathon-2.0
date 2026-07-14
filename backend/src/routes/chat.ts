import express from "express";
import type Anthropic from "@anthropic-ai/sdk";
import { runAgentStream } from "../lib/llm/streamAgent";
import { getAnthropicModel } from "../lib/llm/models";
import { screenerRegistry } from "../lib/tools";
import {
  validateChatMessages,
  validateCsvContent,
} from "../lib/chat/validateChatPayload";
import { friendlyLlmError } from "../lib/llm/friendlyError";
import { connectDb } from "../lib/infra/db";
import {
  extractMentionsFromMessages,
  resolveStartupMentions,
} from "../lib/chat/startupMentions";
import type { ToolContext } from "../lib/tools/types";
import { buildSystemPrompt } from "../lib/chat/buildSystemPrompt";
import type { KnowledgeGraph, RiskReport } from "../lib/engram/types";

export const chatRouter = express.Router();

const BASE_SYSTEM =
  `You are Engram — the Expert Copilot for Indian heavy industry. ` +
  `You help maintenance engineers and plant managers query an auto-generated knowledge graph of assets, people, incidents, procedures, parts, and documents.\n\n` +
  `## General rules\n` +
  `- Format responses with Markdown: ## headings, bullet lists, GFM pipe tables when useful.\n` +
  `- Every substantive answer MUST include: Confidence (High/Medium/Low), source citations, and the graph path when you used traverse_graph / ask_knowledge / get_knowledge_risk.\n` +
  `- Never invent entity names, incidents, or experts — always call a tool.\n` +
  `- For "if X retires" / knowledge concentration questions, call get_knowledge_risk (or ask_knowledge).\n` +
  `- Resolve tags like P-101 via resolve_jargon when unsure.\n` +
  `- For OEM manuals / regulatory references outside the plant graph, call web_search and cite URLs.\n` +
  `- Be concise — field technicians may be on a phone next to failing equipment.\n` +
  `- Use numbered markdown lists ONLY when the user must pick between 2–5 paths. Prefer a short direct reply.\n`;

function toAnthropicMessages(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Anthropic.MessageParam[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

function parseKnowledgeGraph(value: unknown): KnowledgeGraph | null {
  if (!value || typeof value !== "object") return null;
  const g = value as KnowledgeGraph;
  if (!Array.isArray(g.nodes) || !Array.isArray(g.edges)) return null;
  return g;
}

function parseRiskReport(value: unknown): RiskReport | null {
  if (!value || typeof value !== "object") return null;
  const r = value as RiskReport;
  if (!Array.isArray(r.atRiskAssets)) return null;
  return r;
}

chatRouter.post("/", async (req, res) => {
  const {
    messages,
    screeningResult: _legacyScreening,
    csvContent,
    startupId,
    knowledgeGraph,
    riskReport,
  } = req.body as {
    messages?: unknown;
    screeningResult?: unknown;
    csvContent?: unknown;
    startupId?: unknown;
    knowledgeGraph?: unknown;
    riskReport?: unknown;
  };

  const parsedMessages = validateChatMessages(messages);
  if (!parsedMessages.ok) {
    res.status(400).json({ detail: parsedMessages.detail });
    return;
  }

  const parsedCsv = validateCsvContent(csvContent);
  if (!parsedCsv.ok) {
    res.status(400).json({ detail: parsedCsv.detail });
    return;
  }

  const validMessages = parsedMessages.messages;

  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string;

  await connectDb();
  const mentionTokens = extractMentionsFromMessages(validMessages);
  const mentionedStartups = await resolveStartupMentions(mentionTokens, userId);

  const write = (line: string) => {
    res.write(line);
  };

  const ctx: ToolContext = {
    csvContent: parsedCsv.content,
    screeningResult: null,
    knowledgeGraph: parseKnowledgeGraph(knowledgeGraph),
    riskReport: parseRiskReport(riskReport),
    startupId:
      typeof startupId === "string" && startupId.trim()
        ? startupId.trim()
        : mentionedStartups.length === 1
          ? mentionedStartups[0].id
          : null,
    userId,
    userEmail,
    mentionedStartups,
  };

  const wrappedExecute = async (name: string, input: unknown) => {
    const result = await screenerRegistry.execute(name, input, ctx);
    if (result.knowledgeGraph) {
      ctx.knowledgeGraph = result.knowledgeGraph;
      write(
        `data: ${JSON.stringify({
          type: "knowledge_graph",
          knowledgeGraph: result.knowledgeGraph,
        })}\n\n`,
      );
    }
    if (result.riskReport) {
      ctx.riskReport = result.riskReport;
      write(
        `data: ${JSON.stringify({
          type: "risk_report",
          riskReport: result.riskReport,
        })}\n\n`,
      );
    }
    if (result.citations || result.traversalPath || result.confidence) {
      write(
        `data: ${JSON.stringify({
          type: "engram_meta",
          confidence: result.confidence,
          citations: result.citations,
          traversalPath: result.traversalPath,
        })}\n\n`,
      );
    }
    return { content: result.content, document: result.document };
  };

  const system = buildSystemPrompt(BASE_SYSTEM, ctx, screenerRegistry);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const { toolActivity } = await runAgentStream({
      model: getAnthropicModel(),
      systemPrompt: system,
      messages: toAnthropicMessages(validMessages),
      tools: screenerRegistry.getTools(),
      executeTool: wrappedExecute,
      write,
      maxTokens: 8192,
    });

    if (ctx.knowledgeGraph) {
      write(
        `data: ${JSON.stringify({
          type: "final_result",
          knowledgeGraph: ctx.knowledgeGraph,
          riskReport: ctx.riskReport,
        })}\n\n`,
      );
    }

    write(
      `data: ${JSON.stringify({ type: "tool_activity", toolActivity })}\n\n`,
    );
  } catch (err) {
    write(
      `data: ${JSON.stringify({ type: "error", detail: friendlyLlmError(err) })}\n\n`,
    );
  }

  res.end();
});
