"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { UserMessage } from "@/app/components/assistant/UserMessage";
import { ChatInput } from "@/app/components/assistant/ChatInput";
import { ScreenerAssistantMessage } from "@/app/components/screen/ScreenerAssistantMessage";
import type { ScreenerMessage } from "@/app/components/screen/chatTypes";
import type { RtpMessage } from "@/app/components/shared/types";
import { shouldShowMessageOptions } from "@/lib/parseMessageOptions";
import { ENGRAM_SAMPLE_PROMPTS } from "@/lib/assistantSamplePrompts";

interface Props {
  messages: ScreenerMessage[];
  isResponseLoading: boolean;
  handleChat: (message: ScreenerMessage, csvContent?: string | null) => void;
  cancel: () => void;
  startupName?: string;
  startupId?: string;
}

export function StartupChatPanel({
  messages,
  isResponseLoading,
  handleChat,
  cancel,
  startupName,
  startupId,
}: Props) {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [showScrollButton, setShowScrollButton] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const username =
    profile?.displayName?.trim() || user?.email?.split("@")[0] || "there";

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 80);
    };
    container.addEventListener("scroll", onScroll);
    onScroll();
    return () => container.removeEventListener("scroll", onScroll);
  }, [messages]);

  const lastContent =
    messages.length > 0 ? messages[messages.length - 1].content : "";

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, lastContent, isResponseLoading, scrollToBottom]);

  const showEmpty = messages.length === 0;

  function handleSubmit(message: RtpMessage) {
    handleChat({
      role: "user",
      content: message.content,
      files: message.files?.map((f) => ({ filename: f.filename })),
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex h-11 shrink-0 items-center px-4">
        <span className="text-[13px] font-medium text-slate-800">
          Expert Copilot
        </span>
        {startupName && (
          <span className="ml-2 truncate text-[11px] text-slate-400">
            {startupName}
          </span>
        )}
      </div>

      {showEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <p className="font-serif text-2xl font-light text-slate-800">
            Hi, {username}
          </p>
          <p className="mt-2 max-w-[240px] text-center text-sm text-slate-500">
            Ask about machines, people, or past failures — answers come with
            sources from the plant graph.
          </p>
        </div>
      ) : (
        <div
          ref={messagesContainerRef}
          className="relative min-h-0 w-full flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="w-full space-y-4 px-4 py-3">
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.role === "user" ? (
                  <UserMessage content={msg.content} files={msg.files} />
                ) : (
                  <ScreenerAssistantMessage
                    content={msg.content}
                    events={msg.events}
                    isStreaming={
                      i === messages.length - 1 && isResponseLoading
                    }
                    isError={!!msg.error}
                    minHeight="0px"
                    startupId={startupId}
                    showOptionChips={shouldShowMessageOptions(
                      i,
                      messages,
                      isResponseLoading,
                    )}
                    onOptionSelect={(value) => {
                      handleChat({ role: "user", content: value });
                    }}
                  />
                )}
              </div>
            ))}
            <div ref={messagesEndRef} className="h-1" />
          </div>

          {showScrollButton && (
            <div className="sticky bottom-3 z-10 -mt-10 flex justify-center pointer-events-none">
              <button
                type="button"
                onClick={scrollToBottom}
                className="pointer-events-auto rounded-full border border-slate-200 bg-white p-1.5 shadow-sm"
              >
                <ArrowDown className="h-4 w-4 text-slate-500" />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="shrink-0 px-3 pb-4 pt-1">
        <ChatInput
          onSubmit={handleSubmit}
          onCancel={cancel}
          isLoading={isResponseLoading}
          startupId={startupId}
          projectName={startupName}
          hideAddDocButton
          samplePrompts={ENGRAM_SAMPLE_PROMPTS}
          showSamplePrompts={showEmpty}
          placeholder="Ask about an asset, person, or failure…"
        />
      </div>
    </div>
  );
}
