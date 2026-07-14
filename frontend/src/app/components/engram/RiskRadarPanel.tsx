"use client";

import { AlertTriangle, ShieldAlert, Users } from "lucide-react";
import type { AtRiskAsset, RiskReport } from "@/lib/engramTypes";

type Props = {
  riskReport: RiskReport;
  onSelectAsset?: (asset: AtRiskAsset) => void;
};

const LEVEL_STYLES = {
  critical: {
    chip: "bg-red-100 text-red-800 border-red-200",
    bar: "bg-red-500",
    icon: ShieldAlert,
  },
  moderate: {
    chip: "bg-amber-100 text-amber-800 border-amber-200",
    bar: "bg-amber-500",
    icon: AlertTriangle,
  },
  shared: {
    chip: "bg-emerald-100 text-emerald-800 border-emerald-200",
    bar: "bg-emerald-500",
    icon: Users,
  },
} as const;

export function RiskRadarPanel({ riskReport, onSelectAsset }: Props) {
  const critical = riskReport.atRiskAssets.filter((a) => a.riskLevel === "critical");
  const moderate = riskReport.atRiskAssets.filter((a) => a.riskLevel === "moderate");
  const shared = riskReport.atRiskAssets.filter((a) => a.riskLevel === "shared");

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">
          Knowledge Risk Radar
        </h3>
        <p className="mt-1 text-xs text-slate-600 leading-relaxed">
          {riskReport.summary}
        </p>
        <div className="mt-3 flex gap-3 text-[11px]">
          <span className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-red-700">
            {critical.length} critical
          </span>
          <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
            {moderate.length} moderate
          </span>
          <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700">
            {shared.length} shared
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 p-3">
        {riskReport.atRiskAssets.map((asset) => {
          const style = LEVEL_STYLES[asset.riskLevel];
          const Icon = style.icon;
          return (
            <button
              key={asset.assetId}
              type="button"
              onClick={() => onSelectAsset?.(asset)}
              className="text-left rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start gap-2">
                <span
                  className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-lg ${style.chip}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 truncate">
                      {asset.assetName}
                    </span>
                    <span
                      className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${style.chip}`}
                    >
                      {asset.riskLevel}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    {asset.narrative}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                    <span>Expert: {asset.expertPersonName || "—"}</span>
                    <span>{asset.relatedIncidentCount} incidents</span>
                    <span>{asset.relatedProcedureCount} procedures</span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
        {riskReport.atRiskAssets.length === 0 && (
          <p className="text-center text-sm text-slate-500 py-8">
            No risk analysis yet. Load the Unit 3 demo or ingest documents.
          </p>
        )}
      </div>
    </div>
  );
}
