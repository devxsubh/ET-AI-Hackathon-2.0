"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  FileUp,
  Loader2,
  Mic,
  Network,
  Plus,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { KnowledgeGraphView } from "@/app/components/engram/KnowledgeGraphView";
import { RiskRadarPanel } from "@/app/components/engram/RiskRadarPanel";
import { IntelligencePanel } from "@/app/components/engram/IntelligencePanel";
import {
  confirmPlantEdge,
  fetchPlantIntelligence,
  ingestPlantFileStreaming,
  ingestPlantTextStreaming,
  ingestVoiceNote,
} from "@/app/lib/screenerApi";
import type {
  EngramEdge,
  EngramNode,
  KnowledgeGraph,
  PlantIntelligence,
  RiskReport,
} from "@/lib/engramTypes";

type DockTab = "graph" | "risk" | "intel";

interface Props {
  knowledgeGraph?: KnowledgeGraph | null;
  riskReport?: RiskReport | null;
  loading?: boolean;
  plantName?: string;
  startupId?: string;
  highlightPath?: string[];
  warRoomAssetId?: string | null;
  onGraphChange?: (graph: KnowledgeGraph, risk: RiskReport | null) => void;
  onPathChange?: (path: string[]) => void;
  onWarRoomAsset?: (assetId: string | null, name?: string) => void;
}

const DEMO_SNIPPET = `Field observation — Pump P-101
Date: 2024-11-03
P-101 seal weep after monsoon restart. Cleared suction strainer (40% blocked); vibration dropped. Capture as formal SOP step.`;

export function StartupAnalysisDock({
  knowledgeGraph = null,
  riskReport = null,
  loading = false,
  plantName,
  startupId,
  highlightPath = [],
  warRoomAssetId = null,
  onGraphChange,
  onPathChange,
  onWarRoomAsset,
  screening: screeningFlag,
}: Props & { screening?: boolean }) {
  const [tab, setTab] = useState<DockTab>("graph");
  const [, setSelected] = useState<EngramNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<EngramEdge | null>(null);
  const [emphasisNodeIds, setEmphasisNodeIds] = useState<string[]>([]);
  const [intel, setIntel] = useState<PlantIntelligence | null>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceText, setVoiceText] = useState(
    "P-101 mein seal dubara fail ho raha hai — strainer check kiya.",
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const addRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isLoading = loading || screeningFlag;

  const refreshIntel = useCallback(async () => {
    if (!startupId || !knowledgeGraph?.nodes?.length) {
      setIntel(null);
      return;
    }
    setIntelLoading(true);
    try {
      const res = await fetchPlantIntelligence(startupId);
      setIntel(res.intelligence);
    } catch {
      setIntel(null);
    } finally {
      setIntelLoading(false);
    }
  }, [startupId, knowledgeGraph?.nodes?.length]);

  useEffect(() => {
    void refreshIntel();
  }, [refreshIntel, knowledgeGraph?.updatedAt, riskReport?.generatedAt]);

  useEffect(() => {
    if (!addOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!addRef.current?.contains(e.target as Node)) setAddOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [addOpen]);

  async function runIngest(
    beforeIds: Set<string>,
    run: () => Promise<{ knowledgeGraph: KnowledgeGraph; riskReport: RiskReport }>,
  ) {
    setBusy(true);
    setStatus("Working…");
    try {
      const result = await run();
      const newIds = result.knowledgeGraph.nodes
        .filter((n) => !beforeIds.has(n.id))
        .map((n) => n.id);
      setEmphasisNodeIds(newIds);
      onGraphChange?.(result.knowledgeGraph, result.riskReport);
      setStatus(newIds.length ? `Added ${newIds.length} nodes` : "Updated graph");
      setTimeout(() => {
        setEmphasisNodeIds([]);
        setStatus(null);
      }, 2800);
      void refreshIntel();
      setTab("graph");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
      setAddOpen(false);
    }
  }

  async function handleConfirm(confirmed: boolean) {
    if (!startupId || !selectedEdge) return;
    try {
      const res = await confirmPlantEdge(startupId, selectedEdge.id, confirmed);
      onGraphChange?.(res.knowledgeGraph, res.riskReport);
      setSelectedEdge(null);
      void refreshIntel();
    } catch {
      /* ignore */
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <p className="text-sm">Updating graph…</p>
      </div>
    );
  }

  const hasGraph = !!(knowledgeGraph && knowledgeGraph.nodes.length > 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-slate-200/80 bg-white/80 px-3 backdrop-blur">
        {(
          [
            ["graph", Network, "Graph"],
            ["risk", ShieldAlert, "Risk"],
            ["intel", Sparkles, "Insights"],
          ] as const
        ).map(([id, Icon, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            disabled={!hasGraph && id !== "graph"}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              tab === id
                ? "bg-slate-900 text-white"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {id === "risk" && riskReport && hasGraph && (
              <span className="text-[10px] opacity-80">
                {
                  riskReport.atRiskAssets.filter(
                    (a) => a.riskLevel === "critical",
                  ).length
                }
              </span>
            )}
            {id === "intel" && intel && (
              <span className="text-[10px] opacity-80">{intel.health.score}</span>
            )}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          {status && (
            <span className="text-[11px] text-slate-400">{status}</span>
          )}
          {startupId && (
            <div ref={addRef} className="relative">
              <button
                type="button"
                disabled={busy}
                onClick={() => setAddOpen((v) => !v)}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Add
              </button>
              {addOpen && (
                <div className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                    onClick={() => fileRef.current?.click()}
                  >
                    <FileUp className="h-3.5 w-3.5" /> Upload document
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                    onClick={() =>
                      void runIngest(new Set(), () =>
                        ingestPlantTextStreaming(
                          startupId,
                          DEMO_SNIPPET,
                          "Field_Note_P101_2024.txt",
                        ),
                      )
                    }
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Demo field note
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setAddOpen(false);
                      setVoiceOpen(true);
                    }}
                  >
                    <Mic className="h-3.5 w-3.5" /> Voice note
                  </button>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.doc,.xlsx,.xls,.txt,.csv,.png,.jpg,.jpeg"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file || !startupId) return;
                  void runIngest(new Set(), () =>
                    ingestPlantFileStreaming(startupId, file),
                  );
                }}
              />
            </div>
          )}
        </div>
      </div>

      {voiceOpen && startupId && (
        <div className="border-b border-slate-200 bg-white px-3 py-2">
          <textarea
            value={voiceText}
            onChange={(e) => setVoiceText(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
            placeholder="Field note transcript…"
          />
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              disabled={busy || !voiceText.trim()}
              onClick={() =>
                void runIngest(new Set(), async () => {
                  const r = await ingestVoiceNote(startupId, voiceText.trim());
                  return {
                    knowledgeGraph: r.knowledgeGraph,
                    riskReport: r.riskReport,
                  };
                }).then(() => setVoiceOpen(false))
              }
              className="rounded-md bg-slate-900 px-2.5 py-1 text-xs text-white disabled:opacity-50"
            >
              Add to graph
            </button>
            <button
              type="button"
              onClick={() => setVoiceOpen(false)}
              className="rounded-md px-2.5 py-1 text-xs text-slate-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {selectedEdge && (
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 text-xs">
          <span className="truncate text-slate-600">
            Confirm link: <strong>{selectedEdge.type.replace(/_/g, " ")}</strong>
          </span>
          <button
            type="button"
            onClick={() => void handleConfirm(true)}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-white"
          >
            <Check className="h-3 w-3" /> Yes
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm(false)}
            className="inline-flex items-center gap-1 rounded-md bg-slate-200 px-2 py-1 text-slate-700"
          >
            <X className="h-3 w-3" /> No
          </button>
          <button
            type="button"
            onClick={() => setSelectedEdge(null)}
            className="ml-auto text-slate-400"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1">
        {!hasGraph ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
            <p className="text-sm font-medium text-slate-700">
              {plantName ?? "Plant"} has no graph yet
            </p>
            <p className="max-w-[260px] text-sm text-slate-500">
              Load the Unit 3 demo from the header, or use Add to upload a
              document.
            </p>
          </div>
        ) : tab === "graph" ? (
          <KnowledgeGraphView
            graph={knowledgeGraph!}
            onSelectNode={setSelected}
            onSelectEdge={setSelectedEdge}
            highlightPath={highlightPath}
            onClearPath={() => onPathChange?.([])}
            emphasisNodeIds={emphasisNodeIds}
            warRoomAssetId={warRoomAssetId}
          />
        ) : tab === "risk" && riskReport ? (
          <RiskRadarPanel
            riskReport={riskReport}
            onSelectAsset={(a) => {
              onWarRoomAsset?.(a.assetId, a.assetName);
              onPathChange?.([
                `${a.expertPersonName} -[expert_on]-> ${a.assetName}`,
              ]);
              setTab("graph");
            }}
          />
        ) : tab === "intel" ? (
          intelLoading && !intel ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : intel ? (
            <IntelligencePanel
              intelligence={intel}
              onHighlightPath={(p) => {
                onPathChange?.(p);
                setTab("graph");
              }}
              onFocusAsset={(id, name) => onWarRoomAsset?.(id, name)}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              No insights yet.
            </div>
          )
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            No risk report yet.
          </div>
        )}
      </div>
    </div>
  );
}
