export type WatchmanHitSource = "sdn" | "altName" | "v2";

export interface WatchmanAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface WatchmanScorePiece {
  pieceType: string;
  score: number;
  weight: number;
  matched: boolean;
  required?: boolean;
  exact?: boolean;
  fieldsCompared?: number;
}

export interface WatchmanMatch {
  sdnName: string;
  sdnType: string;
  match: number;
  programs: string[];
  remarks?: string;
  hitSource?: WatchmanHitSource;
  entityID?: string;
  matchedName?: string;
  title?: string;
  alternateID?: string;
  alternateType?: string;
  alternateName?: string;
  alternateRemarks?: string;
  callSign?: string;
  vesselType?: string;
  tonnage?: string;
  grossRegisteredTonnage?: string;
  vesselFlag?: string;
  vesselOwner?: string;
  sourceList?: string;
  sourceID?: string;
  entityType?: string;
  secondarySanctions?: boolean;
  addresses?: WatchmanAddress[];
  affiliations?: string[];
  cryptoAddresses?: string[];
  matchDetails?: WatchmanScorePiece[];
}

export interface WatchmanListInfo {
  lists: Record<string, number>;
  listHashes?: Record<string, string>;
  startedAt?: string;
  endedAt?: string;
  version?: string;
  fetchedAt: string;
}

export interface EntityScreeningQuery {
  altNames?: string[];
  birthDate?: string;
  address?: string;
  country?: string;
  registrationId?: string;
  requestId?: string;
}

export type OwnershipRuleFlag = "ofac_50" | "ubo_25";

export interface OwnershipPathStep {
  name: string;
  edgePct: number | null;
}

export interface EntityResult {
  name: string;
  type: "person" | "company";
  riskLevel: "clear" | "review" | "flagged";
  topScore: number | null;
  matches: WatchmanMatch[];
  ownershipPath: string[];
  indirectOwnershipPct?: number | null;
  ownershipPathSteps?: OwnershipPathStep[];
  ownershipRuleFlags?: OwnershipRuleFlag[];
  exposureStatement?: string;
  role?: string;
  isUltimateOwner?: boolean;
  ultimateOwner?: string;
  explanation?: string;
  screeningQuery?: EntityScreeningQuery;
}

export interface OwnershipEdge {
  from: string;
  to: string;
  pct: number;
}

export type CsvKind =
  | "ownership_cap_table"
  | "entity_roster"
  | "reference_metadata"
  | "unknown";
export type ParseSource = "strict" | "heuristic" | "ai";
export type ScreeningMode = "ownership_graph" | "entity_roster";
export type RosterPurpose =
  | "cap_table"
  | "co_investor"
  | "vendor"
  | "entity_roster";

export interface ColumnMapping {
  entity?: string;
  entity_type?: string;
  owner?: string;
  owner_type?: string;
  ownership_pct?: string;
  name?: string;
  type?: string;
}

export interface ScreeningResult {
  totalEntities: number;
  flaggedCount: number;
  reviewCount: number;
  clearCount: number;
  entities: EntityResult[];
  edges: OwnershipEdge[];
  startupName?: string;
  maxSanctionedExposurePct?: number | null;
  sanctionedExposureSummary?: string;
  screenedAt?: string;
  csvId?: string;
  screeningMode?: ScreeningMode;
  csvKind?: CsvKind;
  dataSourceAvailable?: boolean;
  screeningConfidence?: number;
  watchmanListInfo?: WatchmanListInfo;
  watchmanSearchLimit?: number;
}

export interface GraphPreview {
  entityCount: number;
  edgeCount: number;
  startupName: string | null;
  ownershipDepth: number;
  hasCircularOwnership: boolean;
  circularOwnershipCount: number;
}

export type ParseStatus = "pending" | "valid" | "invalid" | "needs_review";

export interface CsvIngestAnalysis {
  csvKind: CsvKind;
  parseSource: ParseSource;
  confidence: number;
  columnMapping: ColumnMapping | null;
  recordCount: number;
  normalizedContent: string | null;
  warnings: string[];
  errors: ParseError[];
  missingRequiredFields: string[];
  canScreen: boolean;
  userMessage: string;
  explanation?: string;
  parseStatus: ParseStatus;
  graphPreview?: GraphPreview | null;
  estimatedScreenSeconds?: number;
}

export type ScreeningStage =
  | "parse"
  | "graph"
  | "screen"
  | "explain"
  | "exposure";

export interface ScreeningProgressEvent {
  stage: ScreeningStage;
  status: "start" | "done" | "warn";
  detail?: string;
  current?: number;
  total?: number;
}
export type ReviewStatus = "pending" | "cleared" | "escalated" | "blocked";

export interface ParseError {
  row: number;
  field?: string;
  message: string;
}
