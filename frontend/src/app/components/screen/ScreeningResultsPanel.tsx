"use client";

/** Stub — VC sanctions results UI retired. Engram uses plant Graph / Risk Radar. */
export const SCREENING_TAB_ID = "screening-results";

export function ScreeningResultsContent(_props: {
  data?: unknown;
  className?: string;
  embedded?: boolean;
  allowEntityDetails?: boolean;
  handoffFilename?: string | null;
  onContinueInStartup?: () => void;
  [key: string]: unknown;
}) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-500">
      Cap-table screening results are no longer shown here. Open a plant workspace
      for the knowledge graph and risk radar.
    </div>
  );
}

export function ScreeningResultsPanel(props: {
  data?: unknown;
  className?: string;
}) {
  return <ScreeningResultsContent {...props} />;
}

export function screeningTabLabel(_data?: unknown): string {
  return "Screening (retired)";
}

export function screeningNeedsStartupHandoff(_data?: unknown): boolean {
  return false;
}
