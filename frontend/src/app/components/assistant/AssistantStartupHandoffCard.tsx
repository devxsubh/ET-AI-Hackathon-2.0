"use client";

import { Building2, ChevronRight } from "lucide-react";

interface Props {
  filename: string;
  onContinue: () => void;
  disabled?: boolean;
  variant?: "card" | "inline";
}

export function AssistantStartupHandoffCard({
  filename,
  onContinue,
  disabled = false,
  variant = "card",
}: Props) {
  const cardBody = (
    <>
      <p className="text-sm font-medium text-gray-900">
        Run a thorough review in Startup workspace
      </p>
      <p className="mt-1 text-xs text-gray-500 leading-relaxed">
        Flags were found in{" "}
        <span className="font-medium text-gray-700">{filename}</span>. Save it
        to a startup for the ownership graph, entity grid, tabular review, and
        IC memo workflow.
      </p>
      <button
        type="button"
        onClick={onContinue}
        disabled={disabled}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
      >
        Set up startup &amp; continue review
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </>
  );

  if (variant === "inline") {
    return (
      <div className="mt-4 border-t border-gray-100 pt-4">
        <div className="rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/40 to-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-white">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">{cardBody}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-white">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">{cardBody}</div>
      </div>
    </div>
  );
}
