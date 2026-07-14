"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
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

const CHAT_PANEL_MIN = 320;
const CHAT_PANEL_DEFAULT = 480;

interface Props {
  startupId: string;
}

export function PlantWorkspacePage({ startupId }: Props) {
  const router = useRouter();
  const { setSidebarOpen } = useSidebar();
  const isMobile = useIsMobile();
  const splitRef = useRef<HTMLDivElement>(null);

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

  const {
    messages,
    isResponseLoading,
    handleChat,
    cancel,
    knowledgeGraph,
    riskReport,
    isScreeningActive,
    seedDemo,
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
        if (s.knowledgeGraph?.nodes?.length) {
          // Hydrated via useScreenerChat fetch as well
        }
      })
      .catch(() => setPageError("Failed to load plant."))
      .finally(() => setPageLoading(false));
  }, [startupId]);

  const onChatPanelDividerDrag = useCallback((delta: number) => {
    setChatPanelWidth((w) => {
      const next = w + delta;
      const max = (splitRef.current?.clientWidth ?? 1200) - 400;
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
    void handleChat({ role: "user", content: text });
    if (isMobile) setMobilePane("chat");
  }

  if (pageLoading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
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
    <div className="flex h-full min-h-0 flex-col bg-white">
      <header className="shrink-0 border-b border-slate-200 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/startups")}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Plants
          </button>

          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void saveName();
                  if (e.key === "Escape") setEditingName(false);
                }}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm font-semibold"
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
              className="group inline-flex items-center gap-1.5 text-left"
            >
              <h1 className="text-base font-semibold text-slate-900">
                {plant.name}
              </h1>
              <Pencil className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" />
            </button>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-2">
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
                Load Unit 3 demo
              </button>
            )}
            {hasGraph && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    sendPrompt(
                      "If Ramesh retires tomorrow, which machines lose their only expert?",
                    )
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Wow query
                </button>
                <button
                  type="button"
                  onClick={() =>
                    sendPrompt(
                      "Why did Pump P-101 keep failing in 2019 and what did we do about it?",
                    )
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  P-101 history
                </button>
              </>
            )}
          </div>
        </div>
        {seedError && (
          <p className="mt-2 text-xs text-red-600">{seedError}</p>
        )}
      </header>

      {isMobile && (
        <div className="flex shrink-0 border-b border-slate-200 bg-slate-50 md:hidden">
          {(["chat", "analysis"] as const).map((pane) => (
            <button
              key={pane}
              type="button"
              onClick={() => setMobilePane(pane)}
              className={`flex-1 py-2.5 text-sm font-medium ${
                mobilePane === pane
                  ? "border-b-2 border-slate-900 bg-white text-slate-900"
                  : "text-slate-500"
              }`}
            >
              {pane === "chat" ? "Copilot" : "Graph / Risk"}
            </button>
          ))}
        </div>
      )}

      <div ref={splitRef} className="flex min-h-0 flex-1 flex-col md:flex-row">
        <section
          style={isMobile ? undefined : { width: chatPanelWidth }}
          className={`flex min-h-0 w-full shrink-0 flex-col md:w-auto md:flex-none ${
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
          className={`flex min-h-0 min-w-0 flex-1 flex-col ${
            isMobile && mobilePane !== "analysis" ? "hidden" : ""
          }`}
        >
          <StartupAnalysisDock
            knowledgeGraph={knowledgeGraph}
            riskReport={riskReport}
            loading={isScreeningActive || seeding}
            plantName={plant.name}
            startupId={startupId}
          />
        </section>
      </div>
    </div>
  );
}
