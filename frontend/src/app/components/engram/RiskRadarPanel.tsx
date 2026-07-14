"use client";

import { AlertTriangle, ShieldAlert, Users } from "lucide-react";
import type { AtRiskAsset, RiskReport } from "@/lib/engramTypes";

type Props = {
  riskReport: RiskReport;
  onSelectAsset?: (asset: AtRiskAsset) => void;
};

const LEVEL = {
  critical: {
    chip: "text-red-700 bg-red-50",
    icon: ShieldAlert,
  },
  moderate: {
    chip: "text-amber-700 bg-amber-50",
    icon: AlertTriangle,
  },
  shared: {
    chip: "text-emerald-700 bg-emerald-50",
    icon: Users,
  },
} as const;

export function RiskRadarPanel({ riskReport, onSelectAsset }: Props) {
  const critical = riskReport.atRiskAssets.filter((a) => a.riskLevel === "critical");

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white">
      <div className="border-b border-slate-100 px-4 py-4">
        <h3 className="text-sm font-medium text-slate-900">Knowledge risk</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          {riskReport.summary}
        </p>
        <p className="mt-2 text-xs text-slate-400">
          {critical.length} critical ·{" "}
          {riskReport.atRiskAssets.filter((a) => a.riskLevel === "moderate").length}{" "}
          moderate
        </p>
      </div>

      <div className="flex flex-col gap-1 p-2">
        {riskReport.atRiskAssets.map((asset) => {
          const style = LEVEL[asset.riskLevel];
          const Icon = style.icon;
          return (
            <button
              key={asset.assetId}
              type="button"
              onClick={() => onSelectAsset?.(asset)}
              className="rounded-xl px-3 py-2.5 text-left hover:bg-slate-50"
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-lg ${style.chip}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-slate-900">
                      {asset.assetName}
                    </span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${style.chip}`}
                    >
                      {asset.riskLevel}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                    {asset.narrative}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
        {riskReport.atRiskAssets.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">
            No risk analysis yet.
          </p>
        )}
      </div>
    </div>
  );
}
