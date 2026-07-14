import { expertsForAsset } from "./graph";
import type {
  AtRiskAsset,
  KnowledgeGraph,
  KnowledgeRiskLevel,
  RiskReport,
} from "./types";
import { emptyRiskReport } from "./types";

function countRelated(
  graph: KnowledgeGraph,
  assetId: string,
): { incidents: number; procedures: number } {
  let incidents = 0;
  let procedures = 0;
  for (const e of graph.edges) {
    if (e.from !== assetId) continue;
    if (e.type === "had_incident") incidents++;
    if (e.type === "governed_by") procedures++;
  }
  return { incidents, procedures };
}

function riskLevelFor(
  expertCount: number,
): KnowledgeRiskLevel {
  if (expertCount <= 1) return "critical";
  if (expertCount === 2) return "moderate";
  return "shared";
}

function narrativeFor(asset: AtRiskAsset): string {
  if (asset.riskLevel === "critical") {
    return `CRITICAL: ${asset.assetName} — only ${asset.expertPersonName} holds incident history and repair knowledge. If they leave, institutional memory on this asset is lost.`;
  }
  if (asset.riskLevel === "moderate") {
    const others = asset.otherExpertNames.join(", ") || "one other engineer";
    return `MODERATE: ${asset.assetName} — ${asset.expertPersonName} + ${others} share knowledge (${asset.otherExpertCount + 1} experts).`;
  }
  return `SHARED: ${asset.assetName} — knowledge distributed across ${asset.otherExpertCount + 1} people.`;
}

/**
 * Risk Agent — scan the graph for single-point-of-failure knowledge on assets.
 * Assets with one Person holding the majority of expertise edges are CRITICAL.
 */
export function computeRiskReport(graph: KnowledgeGraph | null | undefined): RiskReport {
  if (!graph || graph.nodes.length === 0) {
    return emptyRiskReport();
  }

  const assets = graph.nodes.filter((n) => n.type === "Asset");
  const atRiskAssets: AtRiskAsset[] = [];

  for (const asset of assets) {
    const experts = expertsForAsset(graph, asset.id);
    if (experts.length === 0) {
      atRiskAssets.push({
        assetId: asset.id,
        assetName: asset.name,
        riskLevel: "critical",
        expertPersonId: "",
        expertPersonName: "(no documented expert)",
        otherExpertCount: 0,
        otherExpertNames: [],
        relatedIncidentCount: countRelated(graph, asset.id).incidents,
        relatedProcedureCount: countRelated(graph, asset.id).procedures,
        narrative: `CRITICAL: ${asset.name} — no Person node is linked as an expert. Knowledge is undocumented.`,
      });
      continue;
    }

    // Primary expert = person with most edges touching this asset neighborhood
    const scored = experts.map((p) => {
      let score = 0;
      for (const e of graph.edges) {
        if (
          (e.from === p.id && e.to === asset.id) ||
          (e.to === p.id && e.from === asset.id)
        ) {
          score += 2;
        }
        // Incident fixes on this asset
        if (e.type === "fixed_by" && e.to === p.id) {
          const incidentId = e.from;
          const link = graph.edges.find(
            (x) =>
              x.type === "had_incident" &&
              x.from === asset.id &&
              x.to === incidentId,
          );
          if (link) score += 3;
        }
        if (e.type === "authored" && e.from === p.id) {
          const procId = e.to;
          const link = graph.edges.find(
            (x) =>
              x.type === "governed_by" &&
              x.from === asset.id &&
              x.to === procId,
          );
          if (link) score += 2;
        }
      }
      return { person: p, score };
    });
    scored.sort((a, b) => b.score - a.score);

    const primary = scored[0]!.person;
    const others = scored.slice(1).map((s) => s.person);
    const level = riskLevelFor(experts.length);
    const related = countRelated(graph, asset.id);

    const item: AtRiskAsset = {
      assetId: asset.id,
      assetName: asset.name,
      riskLevel: level,
      expertPersonId: primary.id,
      expertPersonName: primary.name,
      otherExpertCount: others.length,
      otherExpertNames: others.map((o) => o.name),
      relatedIncidentCount: related.incidents,
      relatedProcedureCount: related.procedures,
      narrative: "",
    };
    item.narrative = narrativeFor(item);
    atRiskAssets.push(item);
  }

  // Rank: critical first, then by related incident count
  const rank = { critical: 0, moderate: 1, shared: 2 };
  atRiskAssets.sort((a, b) => {
    const rd = rank[a.riskLevel] - rank[b.riskLevel];
    if (rd !== 0) return rd;
    return b.relatedIncidentCount - a.relatedIncidentCount;
  });

  const critical = atRiskAssets.filter((a) => a.riskLevel === "critical");
  const moderate = atRiskAssets.filter((a) => a.riskLevel === "moderate");

  let summary =
    "Knowledge Risk Radar: all assets have shared expertise coverage.";
  if (critical.length > 0) {
    const names = critical.map((a) => a.assetName).join(", ");
    const people = [
      ...new Set(
        critical
          .map((a) => a.expertPersonName)
          .filter((n) => n && !n.startsWith("(")),
      ),
    ].join(", ");
    const undocumented = critical.filter((a) => !a.expertPersonId).length;
    if (people && undocumented) {
      summary = `If ${people} leave, critical knowledge is at risk on documented assets; ${undocumented} asset(s) also have no linked expert.`;
    } else if (people) {
      summary = `If ${people} leave, critical knowledge is at risk on: ${names}.`;
    } else {
      summary = `${critical.length} asset(s) have no documented expert: ${names}.`;
    }
  } else if (moderate.length > 0) {
    summary = `${moderate.length} asset(s) have concentrated knowledge (only 2 experts).`;
  }

  return {
    atRiskAssets,
    generatedAt: new Date().toISOString(),
    summary,
  };
}

/**
 * Answer the wow query deterministically:
 * "If X retires tomorrow, which machines lose their only expert?"
 */
export function knowledgeRiskForPerson(
  graph: KnowledgeGraph,
  personName: string,
): {
  personName: string;
  critical: AtRiskAsset[];
  moderate: AtRiskAsset[];
  narrative: string;
} {
  const report = computeRiskReport(graph);
  const needle = personName.trim().toLowerCase();
  const forPerson = report.atRiskAssets.filter(
    (a) => a.expertPersonName.toLowerCase().includes(needle),
  );
  const critical = forPerson.filter((a) => a.riskLevel === "critical");
  const moderate = forPerson.filter((a) => a.riskLevel === "moderate");

  const lines: string[] = [];
  if (critical.length) {
    lines.push(
      `CRITICAL: ${critical.map((a) => a.assetName).join(", ")} — only ${personName} holds documented expertise.`,
    );
  }
  if (moderate.length) {
    for (const a of moderate) {
      lines.push(a.narrative);
    }
  }
  if (!lines.length) {
    lines.push(
      `No single-point-of-failure assets found where ${personName} is the primary expert.`,
    );
  }

  return {
    personName,
    critical,
    moderate,
    narrative: lines.join("\n"),
  };
}
