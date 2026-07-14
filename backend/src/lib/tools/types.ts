import type { KnowledgeGraph, RiskReport } from "../engram/types";
import type { MentionedStartup } from "../chat/startupMentions";

export type ToolActivity = {
  name: string;
  status: "running" | "done";
  summary?: string;
};

export type ToolDocumentResult = {
  id: string;
  startupId: string;
  kind: "ic_memo" | "screening_analysis" | "custom";
  title: string;
  downloadUrl: string;
};

export type ToolExecutorResult = {
  content: string;
  knowledgeGraph?: KnowledgeGraph;
  riskReport?: RiskReport;
  confidence?: "High" | "Medium" | "Low" | string;
  citations?: string[];
  traversalPath?: string[];
  document?: ToolDocumentResult;
};

export type ToolContext = {
  csvContent: string | null;
  /** @deprecated Engram no longer uses screening results. */
  screeningResult?: unknown | null;
  knowledgeGraph?: KnowledgeGraph | null;
  riskReport?: RiskReport | null;
  startupId?: string | null;
  userId?: string;
  userEmail?: string;
  mentionedStartups?: MentionedStartup[];
  attachedDocuments?: Array<{ filename: string; document_id: string }>;
  displayedDocument?: { filename: string; document_id: string };
};
