import express from "express";
import type Anthropic from "@anthropic-ai/sdk";
import { assistantRegistry, type ToolContext } from "../lib/tools";
import { buildSystemPrompt } from "../lib/chat/buildSystemPrompt";
import { runAgentStream } from "../lib/llm/streamAgent";
import { getAnthropicModel } from "../lib/llm/models";
import { connectDb } from "../lib/infra/db";
import {
  extractMentionsFromMessages,
  resolveStartupMentions,
} from "../lib/chat/startupMentions";
import { validateCsvContent } from "../lib/chat/validateChatPayload";
import type { KnowledgeGraph, RiskReport } from "../lib/engram/types";

export const assistantChatRouter = express.Router();

const BASE_SYSTEM =
  `You are Engram — the Expert Copilot for Indian heavy industry. ` +
  `You help maintenance engineers query plant knowledge graphs of assets, people, incidents, procedures, parts, and documents.\n\n` +
  `## Rules\n` +
  `- Prefer ask_knowledge, traverse_graph, get_knowledge_risk, and resolve_jargon for plant questions.\n` +
  `- Call load_demo_plant to seed Bharat Engineering Works Unit 3 demo data when asked.\n` +
  `- Include Confidence, citations, and graph path when answering from tools.\n` +
  `- Never invent entities or experts — always call a tool.\n` +
  `- For OEM / public standards outside the graph, call web_search and cite URLs.\n` +
  `- Be concise — field technicians may be on phones.\n`;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function toAnthropicMessages(messages: ChatMessage[]): Anthropic.MessageParam[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
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

assistantChatRouter.post("/", async (req, res) => {
  const body = req.body as {
    messages?: ChatMessage[];
    csvContent?: unknown;
    startupId?: unknown;
    projectId?: unknown;
    knowledgeGraph?: unknown;
    riskReport?: unknown;
  };

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    res.status(400).json({ detail: "messages required" });
    return;
  }

  const parsedCsv = validateCsvContent(body.csvContent);
  if (!parsedCsv.ok) {
    res.status(400).json({ detail: parsedCsv.detail });
    return;
  }

  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string;

  await connectDb();
  const mentionTokens = extractMentionsFromMessages(messages);
  const mentionedStartups = await resolveStartupMentions(mentionTokens, userId);

  const plantId =
    (typeof body.startupId === "string" && body.startupId.trim()) ||
    (typeof body.projectId === "string" && body.projectId.trim()) ||
    (mentionedStartups.length === 1 ? mentionedStartups[0].id : null);

  const write = (line: string) => {
    res.write(line);
  };

  const ctx: ToolContext = {
    csvContent: parsedCsv.content,
    screeningResult: null,
    knowledgeGraph: parseKnowledgeGraph(body.knowledgeGraph),
    riskReport: parseRiskReport(body.riskReport),
    startupId: plantId,
    userId,
    userEmail,
    mentionedStartups,
  };

  const wrappedExecute = async (name: string, input: unknown) => {
    const result = await assistantRegistry.execute(name, input, ctx);
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
    return { content: result.content, document: result.document };
  };

  let system = buildSystemPrompt(BASE_SYSTEM, ctx, assistantRegistry);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const { toolActivity } = await runAgentStream({
      model: getAnthropicModel(),
      systemPrompt: system,
      messages: toAnthropicMessages(
        messages.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
      ),
      tools: assistantRegistry.getTools(),
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
    const detail = err instanceof Error ? err.message : "Chat failed";
    write(`data: ${JSON.stringify({ type: "error", detail })}\n\n`);
  }

  res.end();
});
