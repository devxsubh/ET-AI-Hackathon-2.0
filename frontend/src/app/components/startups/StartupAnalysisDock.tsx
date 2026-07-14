"use client";

import { useState } from "react";
import { BarChart3, Loader2, Network, ShieldAlert } from "lucide-react";
import { KnowledgeGraphView } from "@/app/components/engram/KnowledgeGraphView";
import { RiskRadarPanel } from "@/app/components/engram/RiskRadarPanel";
import type { EngramNode, KnowledgeGraph, RiskReport } from "@/lib/engramTypes";

type DockTab = "graph" | "risk";

interface Props {
  knowledgeGraph?: KnowledgeGraph | null;
  riskReport?: RiskReport | null;
  loading?: boolean;
  plantName?: string;
}

export function StartupAnalysisDock({
  knowledgeGraph = null,
  riskReport = null,
  loading = false,
  plantName,
  // Legacy props accepted but ignored so callers don't break mid-migration
  screeningResult: _sr,
  startupId: _id,
  screening,
  activeCsv: _csv,
  viewPurpose: _vp,
  onViewPurposeChange: _ovp,
  showCoInvestor: _sci,
  showVendor: _sv,
  onCsvSaveAndRescreen: _ocr,
}: Props & {
  screeningResult?: unknown;
  startupId?: string;
  screening?: boolean;
  activeCsv?: unknown;
  viewPurpose?: unknown;
  onViewPurposeChange?: unknown;
  showCoInvestor?: boolean;
  showVendor?: boolean;
  onCsvSaveAndRescreen?: unknown;
}) {
  const [tab, setTab] = useState<DockTab>("graph");
  const [selected, setSelected] = useState<EngramNode | null>(null);
  const isLoading = loading || screening;

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
          <p className="text-sm">Building knowledge graph…</p>
        </div>
      </div>
    );
  }

  if (!knowledgeGraph || knowledgeGraph.nodes.length === 0) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white border border-slate-200">
            <BarChart3 className="h-5 w-5 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-800">
            {plantName ?? "Plant"} knowledge graph
          </p>
          <p className="text-sm text-slate-600 max-w-[260px]">
            Load the Unit 3 demo or ingest maintenance documents to see the
            knowledge graph and risk radar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 min-h-0">
      <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-2 py-1.5">
        <button
          type="button"
          onClick={() => setTab("graph")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            tab === "graph"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Network className="h-3.5 w-3.5" />
          Graph
        </button>
        <button
          type="button"
          onClick={() => setTab("risk")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            tab === "risk"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          Risk Radar
          {riskReport && (
            <span className="ml-1 rounded-full bg-red-500/90 px-1.5 py-0 text-[10px] text-white">
              {
                riskReport.atRiskAssets.filter((a) => a.riskLevel === "critical")
                  .length
              }
            </span>
          )}
        </button>
        {selected && (
          <span className="ml-auto truncate text-[11px] text-slate-400 pr-2">
            Selected: {selected.name}
          </span>
        )}
      </div>

      <div className="flex-1 min-h-0">
        {tab === "graph" ? (
          <KnowledgeGraphView
            graph={knowledgeGraph}
            onSelectNode={setSelected}
          />
        ) : riskReport ? (
          <RiskRadarPanel riskReport={riskReport} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            No risk report yet.
          </div>
        )}
      </div>
    </div>
  );
}
