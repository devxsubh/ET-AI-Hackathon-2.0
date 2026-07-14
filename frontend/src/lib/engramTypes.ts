/** Engram knowledge-graph types (mirrors backend/src/lib/engram/types.ts). */

export const NODE_TYPES = [
  "Asset",
  "Person",
  "Incident",
  "Document",
  "Procedure",
  "Part",
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export type EdgeType =
  | "had_incident"
  | "requires_part"
  | "governed_by"
  | "fixed_by"
  | "resolved_using"
  | "documented_in"
  | "authored"
  | "expert_on"
  | "references_part"
  | "describes";

export type KnowledgeRiskLevel = "critical" | "moderate" | "shared";

export type EngramNode = {
  id: string;
  name: string;
  type: NodeType;
  tag?: string | null;
  description?: string | null;
  sources?: string[];
  metadata?: Record<string, unknown>;
};

export type EngramEdge = {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
  label?: string | null;
  sources?: string[];
  metadata?: Record<string, unknown>;
};

export type KnowledgeGraph = {
  nodes: EngramNode[];
  edges: EngramEdge[];
  updatedAt: string | null;
};

export type AtRiskAsset = {
  assetId: string;
  assetName: string;
  riskLevel: KnowledgeRiskLevel;
  expertPersonId: string;
  expertPersonName: string;
  otherExpertCount: number;
  otherExpertNames: string[];
  relatedIncidentCount: number;
  relatedProcedureCount: number;
  narrative: string;
};

export type RiskReport = {
  atRiskAssets: AtRiskAsset[];
  generatedAt: string | null;
  summary: string;
};

export const NODE_COLORS: Record<NodeType, { bg: string; border: string; text: string }> = {
  Asset: { bg: "#eff6ff", border: "#3b82f6", text: "#1e40af" },
  Person: { bg: "#f0fdf4", border: "#22c55e", text: "#166534" },
  Incident: { bg: "#fef2f2", border: "#ef4444", text: "#991b1b" },
  Document: { bg: "#faf5ff", border: "#a855f7", text: "#6b21a8" },
  Procedure: { bg: "#fff7ed", border: "#f97316", text: "#9a3412" },
  Part: { bg: "#f8fafc", border: "#64748b", text: "#334155" },
};
