import { getAuthHeaders } from "@/lib/apiAuth";
import type { KnowledgeGraph, RiskReport } from "@/lib/engramTypes";
import type {
  ScreeningProgressEvent,
  ScreeningResult,
} from "@/lib/screenerTypes";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ToolActivity = {
  name: string;
  status: "running" | "done";
  summary?: string;
};

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001"
).replace(/\/$/, "");

export type ToolDocument = {
  id: string;
  startupId: string;
  kind: "ic_memo";
  title: string;
};

export type EngramMeta = {
  confidence?: string;
  citations?: string[];
  traversalPath?: string[];
};

export async function streamChatMessage(params: {
  messages: ChatMessage[];
  screeningResult?: ScreeningResult | null;
  knowledgeGraph?: KnowledgeGraph | null;
  riskReport?: RiskReport | null;
  csvContent?: string | null;
  startupId?: string | null;
  signal?: AbortSignal;
  onToken: (text: string) => void;
  onToolCall?: (name: string) => void;
  onScreeningProgress?: (event: ScreeningProgressEvent) => void;
  onScreeningResult?: (result: ScreeningResult) => void;
  onKnowledgeGraph?: (graph: KnowledgeGraph) => void;
  onRiskReport?: (report: RiskReport) => void;
  onEngramMeta?: (meta: EngramMeta) => void;
  onDocumentCreated?: (document: ToolDocument) => void;
  onToolActivity?: (activity: ToolActivity[]) => void;
}): Promise<void> {
  const authHeaders = await getAuthHeaders();
  const resp = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: params.messages,
      screeningResult: params.screeningResult ?? null,
      knowledgeGraph: params.knowledgeGraph ?? null,
      riskReport: params.riskReport ?? null,
      csvContent: params.csvContent ?? null,
      startupId: params.startupId ?? null,
    }),
    signal: params.signal,
  });

  if (!resp.ok) {
    const err = (await resp.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail ?? `Chat failed (${resp.status})`);
  }

  const reader = resp.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw) continue;

      let event: Record<string, unknown>;
      try {
        event = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        continue;
      }

      const type = event.type as string;

      if (type === "content_delta" && typeof event.text === "string") {
        params.onToken(event.text);
      } else if (type === "tool_call_start" && typeof event.name === "string") {
        params.onToolCall?.(event.name);
      } else if (type === "knowledge_graph" && event.knowledgeGraph) {
        params.onKnowledgeGraph?.(event.knowledgeGraph as KnowledgeGraph);
      } else if (type === "risk_report" && event.riskReport) {
        params.onRiskReport?.(event.riskReport as RiskReport);
      } else if (type === "engram_meta") {
        params.onEngramMeta?.({
          confidence: event.confidence as string | undefined,
          citations: event.citations as string[] | undefined,
          traversalPath: event.traversalPath as string[] | undefined,
        });
      } else if (type === "screening_progress") {
        params.onScreeningProgress?.({
          stage: event.stage as ScreeningProgressEvent["stage"],
          status: event.status as ScreeningProgressEvent["status"],
          detail: event.detail as string | undefined,
          current: event.current as number | undefined,
          total: event.total as number | undefined,
        });
      } else if (type === "screening_result" && event.screeningResult) {
        params.onScreeningResult?.(event.screeningResult as ScreeningResult);
      } else if (type === "final_result") {
        if (event.knowledgeGraph) {
          params.onKnowledgeGraph?.(event.knowledgeGraph as KnowledgeGraph);
        }
        if (event.riskReport) {
          params.onRiskReport?.(event.riskReport as RiskReport);
        }
        if (event.screeningResult) {
          params.onScreeningResult?.(event.screeningResult as ScreeningResult);
        }
      } else if (type === "document_created" && event.document) {
        params.onDocumentCreated?.(event.document as ToolDocument);
      } else if (type === "tool_activity" && Array.isArray(event.toolActivity)) {
        params.onToolActivity?.(event.toolActivity as ToolActivity[]);
      } else if (type === "error" && typeof event.detail === "string") {
        throw new Error(event.detail);
      }
    }
  }
}

/** Seed Bharat Engineering Works Unit 3 demo into a plant. */
export async function loadPlantDemo(plantId: string): Promise<{
  knowledgeGraph: KnowledgeGraph;
  riskReport: RiskReport;
  message: string;
}> {
  const authHeaders = await getAuthHeaders();
  const resp = await fetch(`${API_BASE}/api/startups/${plantId}/demo`, {
    method: "POST",
    headers: authHeaders,
  });
  if (!resp.ok) {
    const err = (await resp.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail ?? `Demo load failed (${resp.status})`);
  }
  return resp.json() as Promise<{
    knowledgeGraph: KnowledgeGraph;
    riskReport: RiskReport;
    message: string;
  }>;
}

export async function fetchPlantGraph(plantId: string): Promise<{
  knowledgeGraph: KnowledgeGraph | null;
}> {
  const authHeaders = await getAuthHeaders();
  const resp = await fetch(`${API_BASE}/api/startups/${plantId}/graph`, {
    headers: authHeaders,
  });
  if (!resp.ok) throw new Error(`Failed to load graph (${resp.status})`);
  return resp.json() as Promise<{ knowledgeGraph: KnowledgeGraph | null }>;
}

export async function fetchPlantRisk(plantId: string): Promise<{
  riskReport: RiskReport | null;
}> {
  const authHeaders = await getAuthHeaders();
  const resp = await fetch(`${API_BASE}/api/startups/${plantId}/risk`, {
    headers: authHeaders,
  });
  if (!resp.ok) throw new Error(`Failed to load risk (${resp.status})`);
  return resp.json() as Promise<{ riskReport: RiskReport | null }>;
}

export async function ingestPlantText(
  plantId: string,
  text: string,
  filename: string,
): Promise<{
  knowledgeGraph: KnowledgeGraph;
  riskReport: RiskReport;
}> {
  const authHeaders = await getAuthHeaders();
  const resp = await fetch(`${API_BASE}/api/startups/${plantId}/ingest`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ text, filename }),
  });
  if (!resp.ok) {
    const err = (await resp.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail ?? `Ingest failed (${resp.status})`);
  }
  return resp.json() as Promise<{
    knowledgeGraph: KnowledgeGraph;
    riskReport: RiskReport;
  }>;
}

async function readIngestSse(
  resp: Response,
  onProgress?: (event: Record<string, unknown>) => void,
): Promise<{ knowledgeGraph: KnowledgeGraph; riskReport: RiskReport }> {
  const reader = resp.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let buffer = "";
  let finalGraph: KnowledgeGraph | null = null;
  let finalRisk: RiskReport | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6)) as Record<string, unknown>;
        if (event.type === "ingest_progress") onProgress?.(event);
        if (event.type === "final_result") {
          finalGraph = event.knowledgeGraph as KnowledgeGraph;
          finalRisk = event.riskReport as RiskReport;
        }
        if (event.type === "error") {
          throw new Error(String(event.detail ?? "Ingest failed"));
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
  if (!finalGraph) throw new Error("Ingest finished without graph");
  return {
    knowledgeGraph: finalGraph,
    riskReport: finalRisk ?? {
      atRiskAssets: [],
      generatedAt: null,
      summary: "",
    },
  };
}

export async function ingestPlantTextStreaming(
  plantId: string,
  text: string,
  filename: string,
  onProgress?: (event: Record<string, unknown>) => void,
): Promise<{ knowledgeGraph: KnowledgeGraph; riskReport: RiskReport }> {
  const authHeaders = await getAuthHeaders();
  const resp = await fetch(
    `${API_BASE}/api/startups/${plantId}/ingest?stream=1`,
    {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ text, filename }),
    },
  );
  if (!resp.ok) {
    const err = (await resp.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail ?? `Ingest failed (${resp.status})`);
  }
  return readIngestSse(resp, onProgress);
}

export async function ingestPlantFileStreaming(
  plantId: string,
  file: File,
  onProgress?: (event: Record<string, unknown>) => void,
): Promise<{ knowledgeGraph: KnowledgeGraph; riskReport: RiskReport }> {
  const authHeaders = await getAuthHeaders();
  const form = new FormData();
  form.append("file", file);
  const resp = await fetch(
    `${API_BASE}/api/startups/${plantId}/ingest?stream=1`,
    {
      method: "POST",
      headers: { ...authHeaders, Accept: "text/event-stream" },
      body: form,
    },
  );
  if (!resp.ok) {
    const err = (await resp.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail ?? `Ingest failed (${resp.status})`);
  }
  return readIngestSse(resp, onProgress);
}

export async function fetchPlantIntelligence(
  plantId: string,
  person = "Ramesh Kumar",
  asset = "Pump P-101",
): Promise<{ intelligence: import("@/lib/engramTypes").PlantIntelligence | null }> {
  const authHeaders = await getAuthHeaders();
  const qs = new URLSearchParams({ person, asset });
  const resp = await fetch(
    `${API_BASE}/api/startups/${plantId}/intelligence?${qs}`,
    { headers: authHeaders },
  );
  if (!resp.ok) throw new Error(`Intelligence failed (${resp.status})`);
  return resp.json();
}

export async function confirmPlantEdge(
  plantId: string,
  edgeId: string,
  confirmed: boolean,
): Promise<{ knowledgeGraph: KnowledgeGraph; riskReport: RiskReport }> {
  const authHeaders = await getAuthHeaders();
  const resp = await fetch(
    `${API_BASE}/api/startups/${plantId}/edges/${encodeURIComponent(edgeId)}/confirm`,
    {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ confirmed }),
    },
  );
  if (!resp.ok) {
    const err = (await resp.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail ?? `Confirm failed (${resp.status})`);
  }
  return resp.json();
}

export async function ingestVoiceNote(
  plantId: string,
  transcript: string,
): Promise<{
  knowledgeGraph: KnowledgeGraph;
  riskReport: RiskReport;
  addedNodes: number;
  addedEdges: number;
}> {
  const authHeaders = await getAuthHeaders();
  const resp = await fetch(`${API_BASE}/api/startups/${plantId}/voice`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ transcript }),
  });
  if (!resp.ok) {
    const err = (await resp.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail ?? `Voice ingest failed (${resp.status})`);
  }
  return resp.json();
}

/** Legacy — kept for any remaining callers. */
export async function screenCapTable(
  _file: File,
  _onProgress?: (event: ScreeningProgressEvent) => void,
): Promise<ScreeningResult> {
  throw new Error(
    "Cap-table screening is retired. Use plant document ingest or Load Unit 3 demo.",
  );
}

export const TOOL_LABELS: Record<string, string> = {
  load_demo_plant: "Loading Unit 3 demo graph",
  resolve_jargon: "Resolving industrial jargon",
  traverse_graph: "Walking knowledge graph",
  ask_knowledge: "Querying plant knowledge",
  get_knowledge_risk: "Running Knowledge Risk Radar",
  get_succession_plan: "Building succession plan",
  get_quiet_knowledge: "Detecting quiet knowledge",
  ask_ghost_expert: "Consulting ghost expert",
  get_asset_timeline: "Opening incident time machine",
  find_failure_twins: "Finding failure twins",
  get_coverage_gaps: "Scanning coverage gaps",
  get_knowledge_health: "Scoring knowledge health",
  get_shift_brief: "Drafting shift hand-off",
  get_parts_cascade: "Tracing parts cascade",
  get_mentorship_matches: "Matching mentors",
  get_knowledge_debt: "Measuring knowledge debt",
  get_cross_unit_transfer: "Checking cross-unit transfer",
  list_startup_documents: "Listing plant documents",
  search_startup_documents: "Searching plant documents",
  web_search: "Searching the web…",
  screen_cap_table: "Screening cap table",
  get_screening_summary: "Reading screening summary",
  get_entity_details: "Looking up entity",
  list_entities: "Listing entities",
  generate_ic_memo: "Generating IC compliance memo",
  search_compliance_playbook: "Searching compliance policy",
};
