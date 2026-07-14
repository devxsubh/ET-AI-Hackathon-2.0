"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { PlantIntelligence } from "@/lib/engramTypes";

type Props = {
  intelligence: PlantIntelligence;
  onHighlightPath?: (path: string[]) => void;
  onFocusAsset?: (assetId: string, assetName: string) => void;
};

function Block({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-slate-100 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
        )}
        <span className="text-xs font-medium text-slate-800">{title}</span>
      </button>
      {open && <div className="space-y-2 px-4 pb-3 text-sm text-slate-600">{children}</div>}
    </section>
  );
}

export function IntelligencePanel({
  intelligence,
  onHighlightPath,
  onFocusAsset,
}: Props) {
  const {
    health,
    succession,
    quietKnowledge,
    coverageGaps,
    failureTwins,
    timeline,
    mentorship,
    shiftBrief,
    staleness,
    partsCascade,
    crossUnit,
  } = intelligence;

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="border-b border-slate-100 px-4 py-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums text-slate-900">
            {health.score}
          </span>
          <span className="text-sm text-slate-400">/ 100 knowledge health</span>
          <span className="ml-auto rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {health.grade}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {health.coveragePct}% asset coverage · {health.criticalKnowledgeAssets}{" "}
          sole-expert risks
        </p>
      </div>

      {succession && (
        <Block title="Succession plan" defaultOpen>
          <p className="text-xs">{succession.summary}</p>
          <ol className="mt-2 space-y-1.5">
            {succession.checklist.slice(0, 4).map((c) => (
              <li key={`${c.day}-${c.assetId}`}>
                <button
                  type="button"
                  className="w-full rounded-lg bg-slate-50 px-2.5 py-1.5 text-left text-xs hover:bg-slate-100"
                  onClick={() => {
                    onFocusAsset?.(c.assetId, c.assetName);
                    onHighlightPath?.([
                      `${succession.personName} -[handoff]-> ${c.assetName}`,
                    ]);
                  }}
                >
                  <span className="font-medium text-slate-800">Day {c.day}</span>
                  <span className="mt-0.5 block text-slate-500">{c.action}</span>
                </button>
              </li>
            ))}
          </ol>
        </Block>
      )}

      <Block title="Quiet knowledge" defaultOpen>
        {quietKnowledge.slice(0, 3).map((q) => (
          <button
            key={q.assetId}
            type="button"
            className="block w-full rounded-lg bg-amber-50/70 px-2.5 py-2 text-left"
            onClick={() => {
              onFocusAsset?.(q.assetId, q.assetName);
              onHighlightPath?.([
                `Email/notes -[informal_tip]-> ${q.assetName}`,
              ]);
            }}
          >
            <div className="text-xs font-medium text-slate-800">{q.assetName}</div>
            <p className="mt-0.5 text-[11px] text-slate-600">{q.narrative}</p>
          </button>
        ))}
        {quietKnowledge.length === 0 && (
          <p className="text-xs text-slate-400">None detected.</p>
        )}
      </Block>

      <Block title="Shift brief">
        <p className="text-xs">{shiftBrief.summary}</p>
        <ul className="mt-1 space-y-1 text-[11px] text-slate-500">
          {shiftBrief.askBeforeLeaving.map((a) => (
            <li key={a}>• {a}</li>
          ))}
        </ul>
      </Block>

      {timeline && (
        <Block title={`Timeline · ${timeline.asset.name}`}>
          {timeline.events.map((e) => (
            <button
              key={e.id}
              type="button"
              className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-slate-50"
              onClick={() => onHighlightPath?.(e.path)}
            >
              <div className="text-xs font-medium text-slate-800">
                {e.date} — {e.title}
              </div>
              <p className="text-[11px] text-slate-500">{e.description}</p>
            </button>
          ))}
        </Block>
      )}

      <Block title="Failure twins">
        {failureTwins.length === 0 && (
          <p className="text-xs text-slate-400">No matches.</p>
        )}
        {failureTwins.map((t) => (
          <button
            key={t.assetId}
            type="button"
            className="block w-full text-left text-xs"
            onClick={() => {
              onFocusAsset?.(t.assetId, t.assetName);
              onHighlightPath?.([`Pump P-101 -[similar_failure]-> ${t.assetName}`]);
            }}
          >
            <span className="font-medium">{t.assetName}</span>
            <span className="text-slate-400"> · score {t.score}</span>
          </button>
        ))}
      </Block>

      <Block title="Coverage gaps">
        {coverageGaps.slice(0, 6).map((g) => (
          <p key={g.assetId} className="text-xs">
            {g.narrative}
          </p>
        ))}
        {coverageGaps.length === 0 && (
          <p className="text-xs text-slate-400">All clear.</p>
        )}
      </Block>

      {partsCascade && (
        <Block title="Parts cascade">
          <p className="text-xs">{partsCascade.narrative}</p>
        </Block>
      )}

      <Block title="Mentorship">
        {mentorship.map((m) => (
          <p key={m.assetId} className="text-xs">
            {m.mentorName} → {m.menteeName} on {m.assetName}
          </p>
        ))}
      </Block>

      <Block title="Cross-unit & debt">
        {crossUnit.map((t) => (
          <p key={t.topic} className="text-xs">
            {t.fromUnit} → {t.toUnit}: {t.topic}
          </p>
        ))}
        {staleness.slice(0, 4).map((s) => (
          <p key={s.nodeId} className="text-[11px] text-slate-400">
            {s.narrative}
          </p>
        ))}
      </Block>
    </div>
  );
}
