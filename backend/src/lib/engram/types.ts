/** Engram knowledge-graph domain types (industrial knowledge intelligence). */

export const NODE_TYPES = [
  "Asset",
  "Person",
  "Incident",
  "Document",
  "Procedure",
  "Part",
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export const EDGE_TYPES = [
  "had_incident",
  "requires_part",
  "governed_by",
  "fixed_by",
  "resolved_using",
  "documented_in",
  "authored",
  "expert_on",
  "references_part",
  "describes",
] as const;

export type EdgeType = (typeof EDGE_TYPES)[number];

export type KnowledgeRiskLevel = "critical" | "moderate" | "shared";

export type EngramNode = {
  id: string;
  name: string;
  type: NodeType;
  /** Optional display subtitle / tag (e.g. asset tag P-101). */
  tag?: string | null;
  description?: string | null;
  /** Source document filename(s) that contributed this node. */
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

export type EntityCandidate = {
  name: string;
  type: NodeType;
  confidence: number;
  context: string;
  tag?: string | null;
  /** Source position hint (page / section) if available. */
  sourcePosition?: string | null;
};

export type RelationCandidate = {
  fromName: string;
  fromType: NodeType;
  toName: string;
  toType: NodeType;
  edgeType: EdgeType;
  context?: string;
};

export type IngestResult = {
  graph: KnowledgeGraph;
  riskReport: RiskReport;
  addedNodes: number;
  addedEdges: number;
  filename: string;
};

export function emptyKnowledgeGraph(): KnowledgeGraph {
  return { nodes: [], edges: [], updatedAt: null };
}

export function emptyRiskReport(): RiskReport {
  return {
    atRiskAssets: [],
    generatedAt: null,
    summary: "No knowledge risk analysis yet.",
  };
}
