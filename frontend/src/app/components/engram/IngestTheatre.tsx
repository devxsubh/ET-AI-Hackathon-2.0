"use client";

import { useCallback, useRef, useState } from "react";
import { FileUp, Loader2, Mic, Sparkles } from "lucide-react";
import {
  ingestPlantFileStreaming,
  ingestPlantTextStreaming,
  ingestVoiceNote,
} from "@/app/lib/screenerApi";
import type { KnowledgeGraph, RiskReport } from "@/lib/engramTypes";

type Props = {
  plantId: string;
  onGraphUpdate: (graph: KnowledgeGraph, risk: RiskReport | null) => void;
  onEmphasisNodes: (ids: string[]) => void;
  onProgress?: (detail: string) => void;
};

const DEMO_SNIPPET = `Field observation — Pump P-101
Technician: Shift B
Date: 2024-11-03

P-101 seal weep observed after monsoon restart. Checked suction strainer per Ramesh email guidance — strainer 40% blocked. Cleared strainer, vibration dropped. Recommend capturing this as formal SOP step before bearing teardown.`;

export function IngestTheatre({
  plantId,
  onGraphUpdate,
  onEmphasisNodes,
  onProgress,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceText, setVoiceText] = useState(
    "P-101 mein seal dubara fail ho raha hai, suction strainer check kiya — pehle bhi yahi pattern tha.",
  );

  const runWithDiff = useCallback(
    async (
      beforeIds: Set<string>,
      run: () => Promise<{
        knowledgeGraph: KnowledgeGraph;
        riskReport: RiskReport;
      }>,
    ) => {
      setBusy(true);
      setStatus("Ingesting…");
      try {
        const result = await run();
        const newIds = result.knowledgeGraph.nodes
          .filter((n) => !beforeIds.has(n.id))
          .map((n) => n.id);
        onEmphasisNodes(newIds);
        onGraphUpdate(result.knowledgeGraph, result.riskReport);
        setStatus(
          `+${newIds.length} nodes appeared on the graph`,
        );
        setTimeout(() => onEmphasisNodes([]), 4000);
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "Ingest failed");
      } finally {
        setBusy(false);
      }
    },
    [onEmphasisNodes, onGraphUpdate],
  );

  async function onFile(file: File, before: Set<string>) {
    await runWithDiff(before, () =>
      ingestPlantFileStreaming(plantId, file, (ev) => {
        const detail = (ev as { detail?: string }).detail;
        if (detail) {
          setStatus(detail);
          onProgress?.(detail);
        }
      }),
    );
  }

  return (
    <div className="border-b border-slate-200 bg-white px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileUp className="h-3.5 w-3.5" />
          )}
          Ingest doc
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            const before = new Set<string>();
            void runWithDiff(before, () =>
              ingestPlantTextStreaming(
                plantId,
                DEMO_SNIPPET,
                "Field_Note_P101_2024.txt",
                (ev) => {
                  const detail = (ev as { detail?: string }).detail;
                  if (detail) setStatus(detail);
                },
              ),
            );
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Live demo note
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setVoiceOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Mic className="h-3.5 w-3.5" />
          Voice → graph
        </button>
        {status && (
          <span className="text-[11px] text-slate-500 truncate max-w-[240px]">
            {status}
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.docx,.doc,.xlsx,.xls,.txt,.csv,.png,.jpg,.jpeg"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          void onFile(file, new Set());
        }}
      />

      {voiceOpen && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
          <textarea
            value={voiceText}
            onChange={(e) => setVoiceText(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs"
            placeholder="Paste field voice transcript…"
          />
          <button
            type="button"
            disabled={busy || !voiceText.trim()}
            onClick={() => {
              void runWithDiff(new Set(), async () => {
                const r = await ingestVoiceNote(plantId, voiceText.trim());
                return {
                  knowledgeGraph: r.knowledgeGraph,
                  riskReport: r.riskReport,
                };
              });
            }}
            className="self-start rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
          >
            Add field note to graph
          </button>
        </div>
      )}
    </div>
  );
}
