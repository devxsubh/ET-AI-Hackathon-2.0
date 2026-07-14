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

export type TimelineEvent = {
  id: string;
  date: string;
  kind: "incident" | "document" | "procedure";
  title: string;
  description: string;
  people: string[];
  procedures: string[];
  parts: string[];
  sources: string[];
  nodeIds: string[];
  path: string[];
};

export type QuietKnowledgeFinding = {
  assetId: string;
  assetName: string;
  tipCount: number;
  tips: string[];
  informalSources: string[];
  formalProcedureCount: number;
  formalDocumentCount: number;
  severity: "high" | "medium" | "low";
  narrative: string;
};

export type SuccessionChecklistItem = {
  day: number;
  assetId: string;
  assetName: string;
  riskLevel: KnowledgeRiskLevel | "moderate";
  action: string;
  documents: string[];
  incidents: string[];
};

export type SuccessionPlan = {
  personId: string;
  personName: string;
  buddyId: string | null;
  buddyName: string | null;
  criticalAssetCount: number;
  moderateAssetCount: number;
  authoredDocumentCount: number;
  authoredProcedureCount: number;
  incidentsOnlyTheyFixed: string[];
  checklist: SuccessionChecklistItem[];
  quietKnowledge: QuietKnowledgeFinding[];
  summary: string;
};

export type ConfidenceBreakdown = {
  score: number;
  level: "High" | "Medium" | "Low";
  reasons: string[];
};

export type GhostExpertAnswer = {
  personId: string;
  personName: string;
  question: string;
  confidence: string;
  confidenceBreakdown: ConfidenceBreakdown;
  answerLines: string[];
  evidenceNodes: Array<{ id: string; name: string; type: NodeType }>;
  citations: string[];
  traversalPath: string[];
};

export type FailureTwin = {
  assetId: string;
  assetName: string;
  score: number;
  sharedParts: string[];
  sharedProcedures: string[];
  sharedIncidentThemes: string[];
  narrative: string;
};

export type CoverageGap = {
  assetId: string;
  assetName: string;
  missing: string[];
  severity: "critical" | "moderate";
  narrative: string;
};

export type KnowledgeHealthReport = {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  coveragePct: number;
  criticalKnowledgeAssets: number;
  quietKnowledgeHigh: number;
  staleItems: number;
  coverageGaps: number;
  nodeCount: number;
  edgeCount: number;
  summary: string;
  drivers: Array<{ label: string; impact: number }>;
};

export type PartsCascade = {
  partId: string;
  partName: string;
  impactedAssets: Array<{ id: string; name: string }>;
  impactedProcedures: Array<{ id: string; name: string }>;
  narrative: string;
};

export type StaleKnowledgeItem = {
  nodeId: string;
  nodeName: string;
  nodeType: NodeType;
  lastTouch: string;
  ageYears: number;
  narrative: string;
};

export type MentorshipMatch = {
  assetId: string;
  assetName: string;
  mentorId: string;
  mentorName: string;
  menteeId: string;
  menteeName: string;
  weeksSuggested: number;
  rationale: string;
};

export type ShiftHandoffBrief = {
  generatedAt: string;
  healthScore: number;
  openRisks: string[];
  overnightWatch: string[];
  askBeforeLeaving: string[];
  summary: string;
};

export type CrossUnitTransfer = {
  fromUnit: string;
  toUnit: string;
  topic: string;
  matchedAssets: string[];
  transferredProcedure: string;
  narrative: string;
  relevance: number;
};
