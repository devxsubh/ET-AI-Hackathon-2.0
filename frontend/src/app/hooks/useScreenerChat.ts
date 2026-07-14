"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchPlantGraph,
  fetchPlantRisk,
  loadPlantDemo,
  streamChatMessage,
} from "@/app/lib/screenerApi";
import { getStartupChat, saveStartupChat } from "@/lib/startupsApi";
import type { KnowledgeGraph, RiskReport } from "@/lib/engramTypes";
import type { ScreeningResult } from "@/lib/screenerTypes";
import type { AssistantEvent, ScreenerMessage } from "@/app/components/screen/chatTypes";

interface UseScreenerChatOptions {
  startupId?: string;
  onDocumentCreated?: (document: {
    id: string;
    startupId: string;
    kind: "ic_memo";
    title: string;
  }) => void;
}

export function useScreenerChat({
  startupId,
  onDocumentCreated,
}: UseScreenerChatOptions = {}) {
  const [messages, setMessages] = useState<ScreenerMessage[]>([]);
  const [isResponseLoading, setIsResponseLoading] = useState(false);
  const [chatHydrated, setChatHydrated] = useState(!startupId);
  const [knowledgeGraph, setKnowledgeGraph] = useState<KnowledgeGraph | null>(
    null,
  );
  const [riskReport, setRiskReport] = useState<RiskReport | null>(null);
  const [isScreeningActive, setIsScreeningActive] = useState(false);
  const [traversalPath, setTraversalPath] = useState<string[]>([]);
  const [lastConfidence, setLastConfidence] = useState<string | null>(null);
  const [lastCitations, setLastCitations] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const knowledgeGraphRef = useRef<KnowledgeGraph | null>(null);
  const riskReportRef = useRef<RiskReport | null>(null);
  const messagesRef = useRef<ScreenerMessage[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    knowledgeGraphRef.current = knowledgeGraph;
  }, [knowledgeGraph]);

  useEffect(() => {
    riskReportRef.current = riskReport;
  }, [riskReport]);

  useEffect(() => {
    if (!startupId) {
      setChatHydrated(true);
      return;
    }
    setChatHydrated(false);
    getStartupChat(startupId)
      .then(({ messages: stored }) => {
        if (stored.length > 0) {
          setMessages(stored as ScreenerMessage[]);
        }
      })
      .catch(() => {})
      .finally(() => setChatHydrated(true));

    // Hydrate persisted Engram graph + risk
    Promise.all([fetchPlantGraph(startupId), fetchPlantRisk(startupId)])
      .then(([g, r]) => {
        if (g.knowledgeGraph?.nodes?.length) {
          setKnowledgeGraph(g.knowledgeGraph);
        }
        if (r.riskReport?.atRiskAssets) {
          setRiskReport(r.riskReport);
        }
      })
      .catch(() => {});
  }, [startupId]);

  const persistMessages = useCallback(
    (next: ScreenerMessage[]) => {
      if (!startupId) return;
      saveStartupChat(startupId, next).catch(() => {});
    },
    [startupId],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsResponseLoading(false);
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.role !== "assistant") return prev;
      const events = (last.events ?? []).map((e) =>
        "isStreaming" in e ? { ...e, isStreaming: false } : e,
      );
      return [...prev.slice(0, -1), { ...last, events }];
    });
  }, []);

  const seedDemo = useCallback(async () => {
    if (!startupId) return null;
    setIsScreeningActive(true);
    try {
      const result = await loadPlantDemo(startupId);
      setKnowledgeGraph(result.knowledgeGraph);
      setRiskReport(result.riskReport);
      return result;
    } finally {
      setIsScreeningActive(false);
    }
  }, [startupId]);

  const handleChat = useCallback(
    async (message: ScreenerMessage, _csvContent?: string | null) => {
      const userMsg: ScreenerMessage = {
        role: "user",
        content: message.content,
        files: message.files,
      };

      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          role: "assistant",
          content: "",
          events: [{ type: "thinking", isStreaming: true }],
        },
      ]);
      setIsResponseLoading(true);
      setIsScreeningActive(false);

      const apiMessages = [...messagesRef.current, userMsg].map((m) => ({
        role: m.role as "user" | "assistant",
        content:
          m.role === "user" && m.files?.length
            ? `${m.content}\n\n[Attached: ${m.files.map((f) => f.filename).join(", ")}]`
            : m.content,
      }));

      const controller = new AbortController();
      abortRef.current = controller;

      const toolCallEvents: AssistantEvent[] = [];
      let accumulatedText = "";

      const pushAssistantEvents = (streaming: boolean) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role !== "assistant") return prev;
          const events: AssistantEvent[] = [
            ...toolCallEvents,
            { type: "thinking", isStreaming: streaming },
          ];
          updated[updated.length - 1] = { ...last, events };
          return updated;
        });
      };

      try {
        await streamChatMessage({
          messages: apiMessages,
          knowledgeGraph: knowledgeGraphRef.current,
          riskReport: riskReportRef.current,
          startupId: startupId ?? null,
          signal: controller.signal,

          onDocumentCreated: (document) => {
            toolCallEvents.push({ type: "document_created", document });
            onDocumentCreated?.(document);
            pushAssistantEvents(true);
          },

          onToolCall: (name: string) => {
            toolCallEvents.push({
              type: "tool_call_start",
              name,
              isStreaming: false,
            });
            if (
              name === "load_demo_plant" ||
              name === "ask_knowledge" ||
              name === "get_knowledge_risk"
            ) {
              setIsScreeningActive(true);
            }
            pushAssistantEvents(true);
          },

          onToken: (text: string) => {
            accumulatedText += text;
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last.role !== "assistant") return prev;
              updated[updated.length - 1] = {
                ...last,
                content: accumulatedText,
                events: [
                  ...toolCallEvents,
                  {
                    type: "content",
                    text: accumulatedText,
                    isStreaming: true,
                  },
                ],
              };
              return updated;
            });
          },

          onKnowledgeGraph: (graph) => {
            setKnowledgeGraph(graph);
            knowledgeGraphRef.current = graph;
            setIsScreeningActive(false);
          },

          onRiskReport: (report) => {
            setRiskReport(report);
            riskReportRef.current = report;
          },

          onEngramMeta: (meta) => {
            if (meta.traversalPath?.length) {
              setTraversalPath(meta.traversalPath);
            }
            if (meta.confidence) setLastConfidence(meta.confidence);
            if (meta.citations?.length) setLastCitations(meta.citations);
          },
        });

        const finalEvents: AssistantEvent[] = [
          ...toolCallEvents,
          {
            type: "content",
            text: accumulatedText,
            isStreaming: false,
          },
        ];

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: accumulatedText,
            events: finalEvents,
          };
          persistMessages(updated);
          return updated;
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") return null;
        const msg = err instanceof Error ? err.message : "Request failed";
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: "",
            error: msg,
            events: [{ type: "content", text: msg }],
          };
          persistMessages(updated);
          return updated;
        });
      } finally {
        setIsResponseLoading(false);
        setIsScreeningActive(false);
        abortRef.current = null;
      }

      return null;
    },
    [startupId, persistMessages, onDocumentCreated],
  );

  const resetChat = useCallback(() => {
    cancel();
    setMessages([]);
    if (startupId) {
      saveStartupChat(startupId, []).catch(() => {});
    }
  }, [cancel, startupId]);

  return {
    messages,
    isResponseLoading,
    chatHydrated,
    handleChat,
    cancel,
    /** Legacy VC field — always null in Engram mode. */
    screeningResult: null as ScreeningResult | null,
    setScreeningResult: ((_r: ScreeningResult | null) => {}) as (
      r: ScreeningResult | null,
    ) => void,
    knowledgeGraph,
    setKnowledgeGraph,
    riskReport,
    setRiskReport,
    isScreeningActive,
    resetChat,
    seedDemo,
    traversalPath,
    setTraversalPath,
    lastConfidence,
    lastCitations,
  };
}
