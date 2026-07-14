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
  riskLevel: KnowledgeRiskLevel;
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

export type PlantIntelligence = {
  health: KnowledgeHealthReport;
  succession: SuccessionPlan | null;
  quietKnowledge: QuietKnowledgeFinding[];
  coverageGaps: CoverageGap[];
  failureTwins: FailureTwin[];
  timeline: { asset: EngramNode; events: TimelineEvent[] } | null;
  mentorship: MentorshipMatch[];
  shiftBrief: ShiftHandoffBrief;
  staleness: StaleKnowledgeItem[];
  partsCascade: PartsCascade | null;
  crossUnit: CrossUnitTransfer[];
  riskReport: RiskReport;
};

export const NODE_COLORS: Record<
  NodeType,
  { bg: string; border: string; text: string }
> = {
  Asset: { bg: "#eff6ff", border: "#3b82f6", text: "#1e40af" },
  Person: { bg: "#f0fdf4", border: "#22c55e", text: "#166534" },
  Incident: { bg: "#fef2f2", border: "#ef4444", text: "#991b1b" },
  Document: { bg: "#faf5ff", border: "#a855f7", text: "#6b21a8" },
  Procedure: { bg: "#fff7ed", border: "#f97316", text: "#9a3412" },
  Part: { bg: "#f8fafc", border: "#64748b", text: "#334155" },
};

/** Parse traversal path strings like "A -[edge]-> B" into node name pairs. */
export function parseTraversalPath(path: string[]): {
  nodeNames: Set<string>;
  edgeLabels: Set<string>;
} {
  const nodeNames = new Set<string>();
  const edgeLabels = new Set<string>();
  for (const step of path) {
    const m = step.match(/^(.+?)\s*-\[([^\]]+)\]->\s*(.+)$/);
    if (m) {
      nodeNames.add(m[1].trim());
      edgeLabels.add(m[2].trim());
      nodeNames.add(m[3].trim());
    } else {
      nodeNames.add(step.replace(/^(CRITICAL|MODERATE|SHARED):\s*/i, "").trim());
    }
  }
  return { nodeNames, edgeLabels };
}
