"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, FileUp, Link2, Loader2, Mic, Sparkles } from "lucide-react";
import {
  ingestPlantFileStreaming,
  ingestPlantTextStreaming,
  ingestPlantUrlStreaming,
  ingestVoiceNote,
} from "@/app/lib/screenerApi";
import { GoogleDriveIcon } from "@/app/components/icons/GoogleDriveIcon";
import {
  isGoogleDrivePickerConfigured,
  pickGoogleDriveFiles,
} from "@/lib/googleDrivePicker";
import type { KnowledgeGraph, RiskReport } from "@/lib/engramTypes";

type Props = {
  plantId: string;
  onGraphUpdate: (graph: KnowledgeGraph, risk: RiskReport | null) => void;
  onEmphasisNodes: (ids: string[]) => void;
  onProgress?: (detail: string) => void;
};

type LinkMode = "url" | "drive" | null;

const DEMO_SNIPPET = `Field observation — Pump P-101
Technician: Shift B
Date: 2024-11-03

P-101 seal weep observed after monsoon restart. Checked suction strainer per Ramesh email guidance — strainer 40% blocked. Cleared strainer, vibration dropped. Recommend capturing this as formal SOP step before bearing teardown.`;

const btn =
  "inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60";

export function IngestTheatre({
  plantId,
  onGraphUpdate,
  onEmphasisNodes,
  onProgress,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [linkMode, setLinkMode] = useState<LinkMode>(null);
  const [urlValue, setUrlValue] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceText, setVoiceText] = useState(
    "P-101 mein seal dubara fail ho raha hai, suction strainer check kiya — pehle bhi yahi pattern tha.",
  );

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

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
        setStatus(`+${newIds.length} nodes appeared on the graph`);
        setTimeout(() => onEmphasisNodes([]), 4000);
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "Ingest failed");
      } finally {
        setBusy(false);
      }
    },
    [onEmphasisNodes, onGraphUpdate],
  );

  async function onFiles(files: File[]) {
    if (!files.length) return;

    if (files.length === 1) {
      await runWithDiff(new Set(), () =>
        ingestPlantFileStreaming(plantId, files[0]!, (ev) => {
          const detail = (ev as { detail?: string }).detail;
          if (detail) {
            setStatus(detail);
            onProgress?.(detail);
          }
        }),
      );
      return;
    }

    setBusy(true);
    try {
      let graph: KnowledgeGraph | null = null;
      let risk: RiskReport | null = null;
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        setStatus(`Importing ${i + 1}/${files.length}: ${file.name}`);
        onProgress?.(`Importing ${file.name}`);
        const result = await ingestPlantFileStreaming(plantId, file, (ev) => {
          const detail = (ev as { detail?: string }).detail;
          if (detail) {
            setStatus(detail);
            onProgress?.(detail);
          }
        });
        graph = result.knowledgeGraph;
        risk = result.riskReport;
      }
      if (graph && risk) {
        onGraphUpdate(graph, risk);
        setStatus(`Imported ${files.length} files`);
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Ingest failed");
    } finally {
      setBusy(false);
    }
  }

  function openLinkPanel(mode: "url" | "drive") {
    setMenuOpen(false);
    setLinkMode(mode);
    setVoiceOpen(false);
    setUrlValue("");
  }

  async function onDriveMenu() {
    setMenuOpen(false);
    setVoiceOpen(false);
    if (!isGoogleDrivePickerConfigured()) {
      openLinkPanel("drive");
      setStatus("Paste a Drive share link, or set Google Picker env vars");
      return;
    }
    setBusy(true);
    setStatus("Opening Google Drive…");
    try {
      const files = await pickGoogleDriveFiles();
      if (!files.length) {
        setStatus(null);
        return;
      }
      setBusy(false);
      await onFiles(files);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Drive import failed");
      setLinkMode("drive");
    } finally {
      setBusy(false);
    }
  }

  function ingestLink() {
    const url = urlValue.trim();
    if (!url) return;
    void runWithDiff(new Set(), () =>
      ingestPlantUrlStreaming(plantId, url, undefined, (ev) => {
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
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            disabled={busy}
            onClick={() => setMenuOpen((v) => !v)}
            className={btn}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileUp className="h-3.5 w-3.5" />
            )}
            Ingest
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </button>
          {menuOpen && (
            <div className="absolute left-0 top-full z-20 mt-1 min-w-[180px] border border-slate-200 bg-white py-1 text-xs">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setMenuOpen(false);
                  inputRef.current?.click();
                }}
              >
                Computer
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50"
                onClick={() => void onDriveMenu()}
              >
                <GoogleDriveIcon className="h-3.5 w-3.5" />
                Google Drive
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50"
                onClick={() => openLinkPanel("url")}
              >
                <Link2 className="h-3 w-3 text-slate-400" />
                From URL
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void runWithDiff(new Set(), () =>
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
          className={btn}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Live demo note
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setVoiceOpen((v) => !v);
            setLinkMode(null);
          }}
          className={btn}
        >
          <Mic className="h-3.5 w-3.5" />
          Voice → graph
        </button>
        {status && (
          <span className="max-w-[280px] truncate text-[11px] text-slate-500">
            {status}
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple
        accept=".pdf,.docx,.doc,.xlsx,.xls,.txt,.csv,.png,.jpg,.jpeg,.eml"
        onChange={(e) => {
          const list = e.target.files;
          e.target.value = "";
          if (!list?.length) return;
          void onFiles(Array.from(list));
        }}
      />

      {linkMode && (
        <div className="mt-2 flex flex-col gap-2 border border-slate-200 bg-slate-50 p-2">
          <input
            type="url"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            placeholder={
              linkMode === "drive"
                ? "Paste Drive share link (Anyone with the link)"
                : "https://… PDF, DOCX, TXT"
            }
            className="w-full rounded-sm border border-slate-200 bg-white px-2 py-1.5 text-xs"
          />
          {linkMode === "drive" && (
            <p className="text-[11px] text-slate-500">
              Share the file as Viewer → Anyone with the link. No Google login
              required.
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !urlValue.trim()}
              onClick={ingestLink}
              className="rounded-sm bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            >
              {linkMode === "drive" ? "Ingest Drive link" : "Ingest URL"}
            </button>
            <button
              type="button"
              className="px-2 text-xs text-slate-500 hover:text-slate-800"
              onClick={() => setLinkMode(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {voiceOpen && (
        <div className="mt-2 flex flex-col gap-2 border border-slate-200 bg-slate-50 p-2">
          <textarea
            value={voiceText}
            onChange={(e) => setVoiceText(e.target.value)}
            rows={3}
            className="w-full rounded-sm border border-slate-200 bg-white px-2 py-1.5 text-xs"
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
            className="self-start rounded-sm bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
          >
            Add field note to graph
          </button>
        </div>
      )}
    </div>
  );
}
