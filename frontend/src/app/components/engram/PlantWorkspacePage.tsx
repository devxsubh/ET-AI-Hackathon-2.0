"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Loader2,
  Pencil,
  Sparkles,
} from "lucide-react";
import { useScreenerChat } from "@/app/hooks/useScreenerChat";
import { StartupChatPanel } from "@/app/components/startups/StartupChatPanel";
import { StartupAnalysisDock } from "@/app/components/startups/StartupAnalysisDock";
import { getStartup, renameStartup, type StartupRecord } from "@/lib/startupsApi";
import { useSidebar } from "@/app/contexts/SidebarContext";
import { ResizeDivider } from "@/app/components/shared/ResizeDivider";
import { useIsMobile } from "@/app/hooks/useIsMobile";
import { ENGRAM_SAMPLE_PROMPTS } from "@/lib/assistantSamplePrompts";

const CHAT_PANEL_MIN = 340;
const CHAT_PANEL_DEFAULT = 400;

interface Props {
  startupId: string;
}

export function PlantWorkspacePage({ startupId }: Props) {
  const router = useRouter();
  const { setSidebarOpen } = useSidebar();
  const isMobile = useIsMobile();
  const splitRef = useRef<HTMLDivElement>(null);
  const tryMenuRef = useRef<HTMLDivElement>(null);

  const [plant, setPlant] = useState<StartupRecord | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [chatPanelWidth, setChatPanelWidth] = useState(CHAT_PANEL_DEFAULT);
  const [mobilePane, setMobilePane] = useState<"chat" | "analysis">("chat");
  const [warRoomAssetId, setWarRoomAssetId] = useState<string | null>(null);
  const [tryOpen, setTryOpen] = useState(false);

  const {
    messages,
    isResponseLoading,
    handleChat,
    cancel,
    knowledgeGraph,
    setKnowledgeGraph,
    riskReport,
    setRiskReport,
    isScreeningActive,
    seedDemo,
    traversalPath,
    setTraversalPath,
  } = useScreenerChat({ startupId });

  useEffect(() => {
    setSidebarOpen(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPageLoading(true);
    setPageError(null);
    getStartup(startupId)
      .then((s) => {
        setPlant(s);
        setNameInput(s.name as string);
      })
      .catch(() => setPageError("Failed to load plant."))
      .finally(() => setPageLoading(false));
  }, [startupId]);

  useEffect(() => {
    if (!tryOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!tryMenuRef.current?.contains(e.target as Node)) setTryOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [tryOpen]);

  const onChatPanelDividerDrag = useCallback((delta: number) => {
    setChatPanelWidth((w) => {
      const next = w + delta;
      const max = (splitRef.current?.clientWidth ?? 1200) - 420;
      return Math.min(max, Math.max(CHAT_PANEL_MIN, next));
    });
  }, []);

  async function saveName() {
    const next = nameInput.trim();
    if (!next || !plant) return;
    setSavingName(true);
    try {
      const updated = await renameStartup(startupId, next);
      setPlant(updated);
      setEditingName(false);
    } catch {
      /* ignore */
    } finally {
      setSavingName(false);
    }
  }

  async function handleLoadDemo() {
    setSeeding(true);
    setSeedError(null);
    try {
      const result = await seedDemo();
      if (result) {
        setPlant((p) =>
          p
            ? {
                ...p,
                name: "Bharat Engineering Works — Unit 3",
                knowledgeGraph: result.knowledgeGraph,
                riskReport: result.riskReport,
              }
            : p,
        );
        setNameInput("Bharat Engineering Works — Unit 3");
        if (isMobile) setMobilePane("analysis");
      }
    } catch (err) {
      setSeedError(err instanceof Error ? err.message : "Failed to load demo");
    } finally {
      setSeeding(false);
    }
  }

  function sendPrompt(text: string) {
    setTryOpen(false);
    void handleChat({ role: "user", content: text });
    if (isMobile) setMobilePane("chat");
  }

  if (pageLoading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (pageError || !plant) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-600">
        <p>{pageError ?? "Plant not found"}</p>
        <button
          type="button"
          onClick={() => router.push("/startups")}
          className="text-sm text-slate-900 underline"
        >
          Back to plants
        </button>
      </div>
    );
  }

  const hasGraph = !!(knowledgeGraph?.nodes?.length);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#fafafa]">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white px-4">
        <button
          type="button"
          onClick={() => router.push("/startups")}
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Plants</span>
        </button>

        <div className="h-4 w-px bg-slate-200" />

        {editingName ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveName();
                if (e.key === "Escape") setEditingName(false);
              }}
              className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm font-medium"
              autoFocus
            />
            <button
              type="button"
              disabled={savingName}
              onClick={() => void saveName()}
              className="rounded-md bg-slate-900 p-1.5 text-white"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingName(true)}
            className="group flex min-w-0 flex-1 items-center gap-1.5 text-left"
          >
            <h1 className="truncate text-sm font-medium text-slate-900">
              {plant.name}
            </h1>
            <Pencil className="h-3 w-3 shrink-0 text-slate-300 opacity-0 group-hover:opacity-100" />
          </button>
        )}

        <div className="flex items-center gap-1.5">
          {warRoomAssetId && (
            <button
              type="button"
              onClick={() => setWarRoomAssetId(null)}
              className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
            >
              Clear focus
            </button>
          )}

          {hasGraph && (
            <div ref={tryMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setTryOpen((v) => !v)}
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Try
                <ChevronDown className="h-3 w-3" />
              </button>
              {tryOpen && (
                <div className="absolute right-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                  {ENGRAM_SAMPLE_PROMPTS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => sendPrompt(p.prompt)}
                      className="block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!hasGraph && (
            <button
              type="button"
              onClick={() => void handleLoadDemo()}
              disabled={seeding}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {seeding ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Load demo
            </button>
          )}
        </div>
      </header>

      {seedError && (
        <p className="border-b border-red-100 bg-red-50 px-4 py-1.5 text-xs text-red-600">
          {seedError}
        </p>
      )}

      {isMobile && (
        <div className="flex shrink-0 border-b border-slate-200 bg-white md:hidden">
          {(["chat", "analysis"] as const).map((pane) => (
            <button
              key={pane}
              type="button"
              onClick={() => setMobilePane(pane)}
              className={`flex-1 py-2.5 text-sm font-medium ${
                mobilePane === pane
                  ? "border-b-2 border-slate-900 text-slate-900"
                  : "text-slate-400"
              }`}
            >
              {pane === "chat" ? "Ask" : "Explore"}
            </button>
          ))}
        </div>
      )}

      <div ref={splitRef} className="flex min-h-0 flex-1 flex-col md:flex-row">
        <section
          style={isMobile ? undefined : { width: chatPanelWidth }}
          className={`flex min-h-0 w-full shrink-0 flex-col border-r border-slate-200/80 bg-white md:w-auto md:flex-none ${
            isMobile && mobilePane !== "chat" ? "hidden" : ""
          }`}
        >
          <StartupChatPanel
            messages={messages}
            isResponseLoading={isResponseLoading}
            handleChat={handleChat}
            cancel={cancel}
            startupName={plant.name}
            startupId={startupId}
          />
        </section>

        <div className="hidden md:contents">
          <ResizeDivider onDrag={onChatPanelDividerDrag} />
        </div>

        <section
          className={`flex min-h-0 min-w-0 flex-1 flex-col bg-[#f7f7f5] ${
            isMobile && mobilePane !== "analysis" ? "hidden" : ""
          }`}
        >
          <StartupAnalysisDock
            knowledgeGraph={knowledgeGraph}
            riskReport={riskReport}
            loading={isScreeningActive || seeding}
            plantName={plant.name}
            startupId={startupId}
            highlightPath={traversalPath}
            warRoomAssetId={warRoomAssetId}
            onPathChange={setTraversalPath}
            onWarRoomAsset={(id) => setWarRoomAssetId(id)}
            onGraphChange={(g, r) => {
              setKnowledgeGraph(g);
              if (r) setRiskReport(r);
            }}
          />
        </section>
      </div>
    </div>
  );
}
