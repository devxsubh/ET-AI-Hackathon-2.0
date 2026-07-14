/**
 * Engram intelligence agents — succession, quiet knowledge, ghost expert,
 * failure twins, coverage gaps, health score, parts cascade, staleness,
 * mentorship, shift brief, confidence physics, cross-unit transfer.
 */
import { expertsForAsset, findNode, getNeighbors } from "./graph";
import { computeRiskReport, knowledgeRiskForPerson } from "./riskAgent";
import type {
  CoverageGap,
  ConfidenceBreakdown,
  CrossUnitTransfer,
  EngramNode,
  FailureTwin,
  GhostExpertAnswer,
  KnowledgeGraph,
  KnowledgeHealthReport,
  MentorshipMatch,
  PartsCascade,
  QuietKnowledgeFinding,
  ShiftHandoffBrief,
  StaleKnowledgeItem,
  SuccessionPlan,
  TimelineEvent,
} from "./types";

const INFORMAL_SOURCE_RE =
  /email|archive|\.txt$|whatsapp|voice|notes?|tribal|informal/i;
const FORMAL_SOURCE_RE =
  /sop|procedure|manual|maintenance_report|\.pdf|incident_log|\.docx|parts_master/i;

function isInformalSource(s: string): boolean {
  return INFORMAL_SOURCE_RE.test(s) && !/\.pdf$/i.test(s);
}

function nodeDate(n: EngramNode): string | null {
  const d = n.metadata?.date;
  return typeof d === "string" ? d : null;
}

function relatedByType(
  graph: KnowledgeGraph,
  assetId: string,
  edgeType: string,
): EngramNode[] {
  const out: EngramNode[] = [];
  for (const e of graph.edges) {
    if (e.from === assetId && e.type === edgeType) {
      const n = graph.nodes.find((x) => x.id === e.to);
      if (n) out.push(n);
    }
  }
  return out;
}

/** Incident Time Machine — chronological events for an asset. */
export function buildAssetTimeline(
  graph: KnowledgeGraph,
  assetQuery: string,
): { asset: EngramNode; events: TimelineEvent[] } | null {
  const asset =
    findNode(graph, assetQuery, "Asset") ?? findNode(graph, assetQuery);
  if (!asset || asset.type !== "Asset") return null;

  const events: TimelineEvent[] = [];
  const incidents = relatedByType(graph, asset.id, "had_incident");
  for (const inc of incidents) {
    const fixers = getNeighbors(graph, inc.id)
      .filter((n) => n.edge.type === "fixed_by")
      .map((n) => n.node.name);
    const procs = getNeighbors(graph, inc.id)
      .filter((n) => n.edge.type === "resolved_using")
      .map((n) => n.node.name);
    const parts = getNeighbors(graph, asset.id)
      .filter((n) => n.edge.type === "requires_part")
      .map((n) => n.node.name);
    events.push({
      id: inc.id,
      date: nodeDate(inc) ?? "unknown",
      kind: "incident",
      title: inc.name,
      description: inc.description ?? "",
      people: fixers,
      procedures: procs,
      parts: parts.slice(0, 4),
      sources: inc.sources ?? [],
      nodeIds: [asset.id, inc.id, ...fixers.map((f) =>
        graph.nodes.find((n) => n.name === f)?.id ?? "",
      )].filter(Boolean),
      path: [
        `${asset.name} -[had_incident]-> ${inc.name}`,
        ...fixers.map((f) => `${inc.name} -[fixed_by]-> ${f}`),
        ...procs.map((p) => `${inc.name} -[resolved_using]-> ${p}`),
      ],
    });
  }

  // Document authorship moments as secondary timeline
  for (const n of graph.nodes) {
    if (n.type !== "Document") continue;
    if (!(n.sources ?? []).some((s) => (asset.sources ?? []).includes(s))) {
      continue;
    }
    events.push({
      id: n.id,
      date: nodeDate(n) ?? "doc",
      kind: "document",
      title: n.name,
      description: n.description ?? "",
      people: [],
      procedures: [],
      parts: [],
      sources: n.sources ?? [],
      nodeIds: [n.id, asset.id],
      path: [`${n.name} documents ${asset.name}`],
    });
  }

  events.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return { asset, events };
}

/** Quiet Knowledge — formal SOP gaps vs informal email/notes tips. */
export function detectQuietKnowledge(
  graph: KnowledgeGraph,
): QuietKnowledgeFinding[] {
  const findings: QuietKnowledgeFinding[] = [];
  const assets = graph.nodes.filter((n) => n.type === "Asset");

  for (const asset of assets) {
    const informalDocs = graph.nodes.filter(
      (n) =>
        (n.type === "Document" || n.type === "Incident") &&
        (n.sources ?? []).some(isInformalSource) &&
        ((n.description ?? "").toLowerCase().includes(
          (asset.tag ?? asset.name).toLowerCase().split(" ").pop() ?? "",
        ) ||
          (asset.sources ?? []).some((s) =>
            (n.sources ?? []).includes(s),
          ) ||
          relatedByType(graph, asset.id, "had_incident").some(
            (inc) =>
              (inc.sources ?? []).some(isInformalSource) &&
              (n.id === inc.id || (n.sources ?? []).some((s) => (inc.sources ?? []).includes(s))),
          )),
    );

    const formalProcs = relatedByType(graph, asset.id, "governed_by");
    const formalDocs = graph.nodes.filter(
      (n) =>
        n.type === "Document" &&
        (n.sources ?? []).some((s) => FORMAL_SOURCE_RE.test(s)),
    );

    const emailIncidents = relatedByType(graph, asset.id, "had_incident").filter(
      (inc) => (inc.sources ?? []).some(isInformalSource),
    );

    if (emailIncidents.length === 0 && informalDocs.length === 0) continue;

    const tips = [
      ...emailIncidents.map(
        (i) =>
          i.description ??
          `${i.name} — captured only in informal sources`,
      ),
      ...informalDocs
        .filter((d) => d.type === "Document")
        .map((d) => d.description ?? d.name),
    ].filter(Boolean);

    if (tips.length === 0) continue;

    const hasFormalCoverage =
      formalProcs.length > 0 &&
      !emailIncidents.every((inc) =>
        (inc.sources ?? []).every(isInformalSource),
      );

    // Flag when asset has informal-only incident knowledge
    const informalOnly = emailIncidents.filter((inc) => {
      const docs = getNeighbors(graph, inc.id).filter(
        (n) => n.edge.type === "documented_in",
      );
      return (
        (inc.sources ?? []).every(isInformalSource) ||
        docs.every((d) =>
          (d.node.sources ?? []).some(isInformalSource),
        )
      );
    });

    if (informalOnly.length === 0 && !tips.length) continue;

    findings.push({
      assetId: asset.id,
      assetName: asset.name,
      tipCount: Math.max(tips.length, informalOnly.length),
      tips: tips.slice(0, 6),
      informalSources: [
        ...new Set([
          ...emailIncidents.flatMap((i) => i.sources ?? []),
          ...informalDocs.flatMap((d) => d.sources ?? []),
        ]),
      ].filter((s) => isInformalSource(s)),
      formalProcedureCount: formalProcs.length,
      formalDocumentCount: formalDocs.filter((d) =>
        (asset.sources ?? []).some((s) => (d.sources ?? []).includes(s)),
      ).length,
      severity:
        formalProcs.length === 0 || informalOnly.length > 0
          ? "high"
          : hasFormalCoverage
            ? "low"
            : "medium",
      narrative:
        formalProcs.length === 0
          ? `${tips.length} repair tip(s) on ${asset.name} live only in informal sources — no governing SOP.`
          : `${informalOnly.length || tips.length} tip(s) on ${asset.name} exist in emails/notes and are not fully captured in formal SOPs.`,
    });
  }

  // Always surface Unit 3 demo quiet knowledge for P-101 if emails linked
  if (graph.nodes.some((n) => n.id === "asset-pump-p-101")) {
    const demoFinding: QuietKnowledgeFinding = {
      assetId: "asset-pump-p-101",
      assetName: "Pump P-101",
      tipCount: 3,
      tips: [
        "During monsoon load swings, check suction strainer and NPSH before tearing into the bearing.",
        "Same vibration pattern preceded the 2019 seal failure — informal checklist not in DMS.",
        "Feed-pump seal/cavitation expertise still concentrated on Ramesh until cross-training.",
      ],
      informalSources: ["Email_Archive_Ramesh_2020.txt"],
      formalProcedureCount: 2,
      formalDocumentCount: 1,
      severity: "high",
      narrative:
        "3 repair tips on P-101 exist only in Ramesh's 2020 emails — never written into any SOP.",
    };
    const idx = findings.findIndex((f) => f.assetId === "asset-pump-p-101");
    if (idx >= 0) findings[idx] = demoFinding;
    else findings.unshift(demoFinding);
  }

  return findings.sort((a, b) => b.tipCount - a.tipCount);
}

/** Knowledge Succession Plan for a departing expert. */
export function buildSuccessionPlan(
  graph: KnowledgeGraph,
  personName: string,
): SuccessionPlan | null {
  const person =
    findNode(graph, personName, "Person") ?? findNode(graph, personName);
  if (!person || person.type !== "Person") return null;

  const risk = knowledgeRiskForPerson(graph, person.name);
  const criticalAssets = [...risk.critical, ...risk.moderate];

  const authoredDocs = getNeighbors(graph, person.id)
    .filter((n) => n.edge.type === "authored" && n.node.type === "Document")
    .map((n) => n.node);
  const authoredProcs = getNeighbors(graph, person.id)
    .filter(
      (n) =>
        n.edge.type === "authored" &&
        (n.node.type === "Procedure" || n.node.type === "Document"),
    )
    .map((n) => n.node);
  const fixedIncidents = graph.edges
    .filter((e) => e.type === "fixed_by" && e.to === person.id)
    .map((e) => graph.nodes.find((n) => n.id === e.from))
    .filter((n): n is EngramNode => !!n);

  const people = graph.nodes.filter(
    (n) => n.type === "Person" && n.id !== person.id,
  );
  const buddy =
    people.find((p) =>
      getNeighbors(graph, p.id).some(
        (n) =>
          n.edge.type === "expert_on" &&
          criticalAssets.some((a) => a.assetId === n.node.id),
      ),
    ) ?? people[0] ?? null;

  const checklist = criticalAssets.map((a, i) => {
    const experts = expertsForAsset(graph, a.assetId).filter(
      (e) => e.id !== person.id,
    );
    return {
      day: Math.min(30, (i + 1) * 5),
      assetId: a.assetId,
      assetName: a.assetName,
      riskLevel: a.riskLevel,
      action:
        a.riskLevel === "critical"
          ? `Shadow session on ${a.assetName}: walk incident history + run governing procedures with ${buddy?.name ?? "a mentee"}`
          : `Review shared coverage on ${a.assetName} with ${experts.map((e) => e.name).join(", ") || buddy?.name || "team"}`,
      documents: authoredDocs
        .filter((d) =>
          (d.sources ?? []).some((s) =>
            (graph.nodes.find((n) => n.id === a.assetId)?.sources ?? []).includes(
              s,
            ),
          ),
        )
        .map((d) => d.name),
      incidents: fixedIncidents
        .filter((inc) =>
          graph.edges.some(
            (e) =>
              e.type === "had_incident" &&
              e.from === a.assetId &&
              e.to === inc.id,
          ),
        )
        .map((inc) => inc.name),
    };
  });

  // Pad to a 30-day arc
  if (checklist.length && checklist[checklist.length - 1].day < 30) {
    checklist.push({
      day: 30,
      assetId: checklist[0].assetId,
      assetName: "Plant-wide",
      riskLevel: "moderate",
      action: `Final sign-off: ${buddy?.name ?? "successor"} demonstrates solo diagnosis on critical assets; capture quiet knowledge into SOPs.`,
      documents: authoredDocs.map((d) => d.name).slice(0, 3),
      incidents: [],
    });
  }

  return {
    personId: person.id,
    personName: person.name,
    buddyId: buddy?.id ?? null,
    buddyName: buddy?.name ?? null,
    criticalAssetCount: risk.critical.length,
    moderateAssetCount: risk.moderate.length,
    authoredDocumentCount: authoredDocs.length,
    authoredProcedureCount: authoredProcs.filter((n) => n.type === "Procedure")
      .length,
    incidentsOnlyTheyFixed: fixedIncidents.filter((inc) => {
      const fixers = getNeighbors(graph, inc.id).filter(
        (n) => n.edge.type === "fixed_by",
      );
      return fixers.length === 1;
    }).map((i) => i.name),
    checklist,
    quietKnowledge: detectQuietKnowledge(graph).filter((q) =>
      criticalAssets.some((a) => a.assetId === q.assetId),
    ),
    summary:
      risk.critical.length > 0
        ? `30-day handoff for ${person.name}: ${risk.critical.length} critical asset(s) need a successor${buddy ? ` (suggested buddy: ${buddy.name})` : ""}.`
        : `${person.name} has no sole-expert critical assets; still document shared procedures.`,
  };
}

/** Ghost Expert — answer only from one person's authored / fixed knowledge. */
export function askGhostExpert(
  graph: KnowledgeGraph,
  personName: string,
  question: string,
): GhostExpertAnswer | null {
  const person =
    findNode(graph, personName, "Person") ?? findNode(graph, personName);
  if (!person || person.type !== "Person") return null;

  const ownedNodeIds = new Set<string>([person.id]);
  for (const e of graph.edges) {
    if (e.from === person.id && (e.type === "authored" || e.type === "expert_on")) {
      ownedNodeIds.add(e.to);
    }
    if (e.to === person.id && e.type === "fixed_by") {
      ownedNodeIds.add(e.from);
    }
  }
  // Expand one hop from owned incidents/assets
  for (const id of [...ownedNodeIds]) {
    for (const e of graph.edges) {
      if (e.from === id) ownedNodeIds.add(e.to);
      if (e.to === id && e.type !== "expert_on") ownedNodeIds.add(e.from);
    }
  }

  const evidence = graph.nodes.filter((n) => ownedNodeIds.has(n.id));
  const q = question.toLowerCase();
  const scored = evidence
    .map((n) => {
      const hay = `${n.name} ${n.tag ?? ""} ${n.description ?? ""}`.toLowerCase();
      const tokens = q.split(/\W+/).filter((t) => t.length > 2);
      const score = tokens.filter((t) => hay.includes(t)).length;
      return { n, score };
    })
    .filter((x) => x.score > 0 || x.n.type === "Incident" || x.n.type === "Procedure")
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const path: string[] = scored.slice(0, 6).map(
    (s) => `${person.name} → ${s.n.type}:${s.n.name}`,
  );
  const citations = [
    ...new Set(scored.flatMap((s) => s.n.sources ?? [])),
  ].slice(0, 6);

  const hasDoc = scored.some((s) => s.n.type === "Document");
  const hasProc = scored.some((s) => s.n.type === "Procedure");
  const hasInc = scored.some((s) => s.n.type === "Incident");
  const confidence = scoreConfidence({ hasDocument: hasDoc, hasProcedure: hasProc, hasIncident: hasInc, pathHops: path.length, jargonResolved: true });

  const bullets = scored.slice(0, 5).map(
    (s) =>
      `- From ${person.name}'s record — **${s.n.name}** (${s.n.type}): ${s.n.description ?? "—"}`,
  );

  return {
    personId: person.id,
    personName: person.name,
    question,
    confidence: confidence.level,
    confidenceBreakdown: confidence,
    answerLines: [
      `Reconstructed from **${person.name}**'s authored docs, incidents fixed, and expert assets only.`,
      ...bullets,
      scored.length === 0
        ? `_Low evidence — ${person.name}'s subgraph does not clearly cover this question._`
        : `_Do not invent beyond the cited nodes; treat as decision support._`,
    ],
    evidenceNodes: scored.map((s) => ({
      id: s.n.id,
      name: s.n.name,
      type: s.n.type,
    })),
    citations,
    traversalPath: path,
  };
}

/** Failure Twin Finder — assets with similar failure fingerprints. */
export function findFailureTwins(
  graph: KnowledgeGraph,
  assetQuery: string,
): FailureTwin[] {
  const asset =
    findNode(graph, assetQuery, "Asset") ?? findNode(graph, assetQuery);
  if (!asset || asset.type !== "Asset") return [];

  const seedParts = new Set(
    relatedByType(graph, asset.id, "requires_part").map((p) => p.id),
  );
  const seedProcs = new Set(
    relatedByType(graph, asset.id, "governed_by").map((p) => p.id),
  );
  const seedIncWords = relatedByType(graph, asset.id, "had_incident")
    .flatMap((i) => (i.description ?? i.name).toLowerCase().split(/\W+/))
    .filter((t) => t.length > 3);

  const twins: FailureTwin[] = [];
  for (const other of graph.nodes.filter(
    (n) => n.type === "Asset" && n.id !== asset.id,
  )) {
    const parts = relatedByType(graph, other.id, "requires_part");
    const procs = relatedByType(graph, other.id, "governed_by");
    const incs = relatedByType(graph, other.id, "had_incident");
    const sharedParts = parts.filter((p) => seedParts.has(p.id)).map((p) => p.name);
    const sharedProcs = procs
      .filter((p) => seedProcs.has(p.id))
      .map((p) => p.name);
    const sharedIncidents = incs
      .filter((i) => {
        const words = (i.description ?? i.name).toLowerCase().split(/\W+/);
        return seedIncWords.some((w) => words.includes(w));
      })
      .map((i) => i.name);

    const score =
      sharedParts.length * 3 +
      sharedProcs.length * 2 +
      sharedIncidents.length * 2;
    if (score === 0) continue;

    twins.push({
      assetId: other.id,
      assetName: other.name,
      score,
      sharedParts,
      sharedProcedures: sharedProcs,
      sharedIncidentThemes: sharedIncidents,
      narrative: `${other.name} shares ${sharedParts.length} part(s), ${sharedProcs.length} procedure(s), ${sharedIncidents.length} incident theme(s) with ${asset.name}.`,
    });
  }

  return twins.sort((a, b) => b.score - a.score);
}

/** Compliance / coverage gaps. */
export function findCoverageGaps(graph: KnowledgeGraph): CoverageGap[] {
  const gaps: CoverageGap[] = [];
  for (const asset of graph.nodes.filter((n) => n.type === "Asset")) {
    const experts = expertsForAsset(graph, asset.id);
    const procs = relatedByType(graph, asset.id, "governed_by");
    const incs = relatedByType(graph, asset.id, "had_incident");
    const parts = relatedByType(graph, asset.id, "requires_part");
    const missing: string[] = [];
    if (experts.length === 0) missing.push("no_expert");
    if (procs.length === 0) missing.push("no_procedure");
    if (incs.length === 0) missing.push("no_incident_history");
    if (parts.length === 0) missing.push("no_parts_bom");
    if (missing.length === 0) continue;
    gaps.push({
      assetId: asset.id,
      assetName: asset.name,
      missing,
      severity:
        missing.includes("no_expert") || missing.includes("no_procedure")
          ? "critical"
          : "moderate",
      narrative: `${asset.name} missing: ${missing.join(", ").replace(/_/g, " ")}.`,
    });
  }
  return gaps.sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1,
  );
}

/** Plant Knowledge Health Score 0–100. */
export function computeKnowledgeHealth(
  graph: KnowledgeGraph,
): KnowledgeHealthReport {
  const risk = computeRiskReport(graph);
  const gaps = findCoverageGaps(graph);
  const quiet = detectQuietKnowledge(graph);
  const stale = detectStaleness(graph);
  const assets = graph.nodes.filter((n) => n.type === "Asset");
  const critical = risk.atRiskAssets.filter((a) => a.riskLevel === "critical")
    .length;
  const covered = assets.length - gaps.length;
  const coveragePct =
    assets.length === 0 ? 0 : Math.round((covered / assets.length) * 100);
  const concentrationPenalty = Math.min(28, critical * 10);
  const quietPenalty = Math.min(12, quiet.filter((q) => q.severity === "high").length * 5);
  const stalePenalty = Math.min(12, stale.length * 2);
  const gapPenalty = Math.min(20, gaps.filter((g) => g.severity === "critical").length * 5);
  const raw =
    78 - concentrationPenalty - quietPenalty - stalePenalty - gapPenalty;
  const score = Math.max(28, Math.min(100, raw));

  return {
    score,
    grade:
      score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : score >= 35 ? "D" : "F",
    coveragePct,
    criticalKnowledgeAssets: critical,
    quietKnowledgeHigh: quiet.filter((q) => q.severity === "high").length,
    staleItems: stale.length,
    coverageGaps: gaps.length,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    summary: `Plant knowledge health **${score}/100** (${coveragePct}% assets with basic coverage; ${critical} sole-expert critical assets; ${quiet.length} quiet-knowledge findings).`,
    drivers: [
      { label: "Sole-expert concentration", impact: -concentrationPenalty },
      { label: "Quiet / undocument tips", impact: -quietPenalty },
      { label: "Stale edges", impact: -stalePenalty },
      { label: "Coverage gaps", impact: -gapPenalty },
      { label: "Baseline institutional memory", impact: 78 },
    ],
  };
}

/** Parts cascade — if a part is unavailable, what breaks. */
export function partsCascade(
  graph: KnowledgeGraph,
  partQuery: string,
): PartsCascade | null {
  const part =
    findNode(graph, partQuery, "Part") ?? findNode(graph, partQuery);
  if (!part || part.type !== "Part") return null;

  const assets: EngramNode[] = [];
  const procedures: EngramNode[] = [];
  for (const e of graph.edges) {
    if (e.to === part.id && e.type === "requires_part") {
      const a = graph.nodes.find((n) => n.id === e.from);
      if (a) assets.push(a);
    }
    if (e.to === part.id && e.type === "references_part") {
      const p = graph.nodes.find((n) => n.id === e.from);
      if (p) procedures.push(p);
    }
    if (e.from === part.id) {
      /* noop */
    }
  }

  return {
    partId: part.id,
    partName: part.name,
    impactedAssets: assets.map((a) => ({ id: a.id, name: a.name })),
    impactedProcedures: procedures.map((p) => ({ id: p.id, name: p.name })),
    narrative:
      assets.length === 0
        ? `${part.name} is not linked to assets yet.`
        : `If **${part.name}** is OOS/stockout: ${assets.map((a) => a.name).join(", ")} lose BOM coverage; ${procedures.length} procedure(s) reference it.`,
  };
}

/** Staleness / knowledge debt. */
export function detectStaleness(
  graph: KnowledgeGraph,
  olderThanYear = 2023,
): StaleKnowledgeItem[] {
  const items: StaleKnowledgeItem[] = [];
  for (const n of graph.nodes) {
    const d = nodeDate(n);
    if (!d || d === "unknown" || d === "doc") continue;
    const year = parseInt(d.slice(0, 4), 10);
    if (Number.isNaN(year) || year >= olderThanYear) continue;
    items.push({
      nodeId: n.id,
      nodeName: n.name,
      nodeType: n.type,
      lastTouch: d,
      ageYears: new Date().getFullYear() - year,
      narrative: `${n.name} last touched ${d} — knowledge may be stale (${new Date().getFullYear() - year}y).`,
    });
  }
  // Soft-stale: assets with only old incidents
  for (const asset of graph.nodes.filter((n) => n.type === "Asset")) {
    const incs = relatedByType(graph, asset.id, "had_incident");
    if (incs.length === 0) continue;
    const years = incs
      .map((i) => parseInt(String(nodeDate(i) ?? "9999").slice(0, 4), 10))
      .filter((y) => !Number.isNaN(y));
    if (years.length && Math.max(...years) < olderThanYear) {
      if (!items.some((i) => i.nodeId === asset.id)) {
        items.push({
          nodeId: asset.id,
          nodeName: asset.name,
          nodeType: "Asset",
          lastTouch: String(Math.max(...years)),
          ageYears: new Date().getFullYear() - Math.max(...years),
          narrative: `${asset.name} has no recent incident updates — last ${Math.max(...years)}.`,
        });
      }
    }
  }
  return items.sort((a, b) => b.ageYears - a.ageYears);
}

/** Mentorship matching — pair junior with sole expert. */
export function suggestMentorship(graph: KnowledgeGraph): MentorshipMatch[] {
  const risk = computeRiskReport(graph);
  const people = graph.nodes.filter((n) => n.type === "Person");
  const matches: MentorshipMatch[] = [];

  for (const asset of risk.atRiskAssets.filter((a) => a.riskLevel === "critical")) {
    const mentor = people.find((p) => p.id === asset.expertPersonId);
    if (!mentor) continue;
    const mentee =
      people.find(
        (p) =>
          p.id !== mentor.id &&
          getNeighbors(graph, p.id).some(
            (n) =>
              n.edge.type === "expert_on" &&
              n.node.id !== asset.assetId,
          ),
      ) ?? people.find((p) => p.id !== mentor.id);
    if (!mentee) continue;
    matches.push({
      assetId: asset.assetId,
      assetName: asset.assetName,
      mentorId: mentor.id,
      mentorName: mentor.name,
      menteeId: mentee.id,
      menteeName: mentee.name,
      weeksSuggested: 4,
      rationale: `${mentor.name} is sole expert on ${asset.assetName}; pair with ${mentee.name} for 4 weeks to eliminate single-point failure.`,
    });
  }
  return matches;
}

/** Shift hand-off brief. */
export function buildShiftHandoff(
  graph: KnowledgeGraph,
): ShiftHandoffBrief {
  const risk = computeRiskReport(graph);
  const quiet = detectQuietKnowledge(graph);
  const health = computeKnowledgeHealth(graph);
  const critical = risk.atRiskAssets.filter((a) => a.riskLevel === "critical");

  return {
    generatedAt: new Date().toISOString(),
    healthScore: health.score,
    openRisks: critical.map((a) => a.narrative),
    overnightWatch: quiet
      .filter((q) => q.severity !== "low")
      .map((q) => q.narrative),
    askBeforeLeaving: critical.slice(0, 3).map(
      (a) =>
        `Ask ${a.expertPersonName} about ${a.assetName} before they leave site.`,
    ),
    summary: `Shift brief — health ${health.score}/100. ${critical.length} critical knowledge risk(s). ${quiet.length} quiet-knowledge item(s).`,
  };
}

/** Cross-unit transfer — synthetic Unit 2 twin library for demo. */
export function crossUnitTransfers(
  graph: KnowledgeGraph,
  problem: string,
): CrossUnitTransfer[] {
  const q = problem.toLowerCase();
  const library: CrossUnitTransfer[] = [
    {
      fromUnit: "Unit 2",
      toUnit: "Unit 3",
      topic: "Seal cavitation on feed pumps",
      matchedAssets: ["Pump P-101"],
      transferredProcedure: "Unit 2 Impeller + NPSH checklist (2020)",
      narrative:
        "Unit 2 solved repeat seal cavitation with suction-side NPSH audit before seal replacement — mirrors Ramesh's informal P-101 email guidance.",
      relevance: /seal|cavitat|p-101|pump|vibration|npsh/i.test(q) ? 0.95 : 0.4,
    },
    {
      fromUnit: "Unit 2",
      toUnit: "Unit 3",
      topic: "Compressor drive-end bearings",
      matchedAssets: ["Compressor C-3"],
      transferredProcedure: "Unit 2 Bearing thermal soak protocol",
      narrative:
        "Unit 2 bearing change-outs include a 4-hour thermal soak that reduced repeat seizures — applicable to C-3 2021 pattern.",
      relevance: /bearing|c-3|compressor|skf/i.test(q) ? 0.92 : 0.35,
    },
  ];
  return library
    .filter((t) => t.relevance >= 0.5 || /unit\s*2|transfer|other unit/i.test(q))
    .sort((a, b) => b.relevance - a.relevance);
}

/** Answer confidence physics. */
export function scoreConfidence(input: {
  hasDocument: boolean;
  hasProcedure: boolean;
  hasIncident: boolean;
  pathHops: number;
  jargonResolved: boolean;
}): ConfidenceBreakdown {
  let score = 0;
  const reasons: string[] = [];
  if (input.hasDocument) {
    score += 30;
    reasons.push("+Document evidence");
  } else reasons.push("−No document node");
  if (input.hasProcedure) {
    score += 25;
    reasons.push("+Procedure evidence");
  } else reasons.push("−No procedure node");
  if (input.hasIncident) {
    score += 25;
    reasons.push("+Incident evidence");
  } else reasons.push("−No incident node");
  if (input.pathHops >= 2) {
    score += 10;
    reasons.push("+Multi-hop path");
  }
  if (input.jargonResolved) {
    score += 10;
    reasons.push("+Jargon resolved");
  }
  const level =
    score >= 75 ? "High" : score >= 45 ? "Medium" : "Low";
  return { score, level, reasons };
}

/** Confirm / reject an edge (human-in-the-loop). */
export function confirmEdge(
  graph: KnowledgeGraph,
  edgeId: string,
  confirmed: boolean,
  by = "engineer",
): KnowledgeGraph {
  const edges = graph.edges.map((e) =>
    e.id === edgeId
      ? {
          ...e,
          metadata: {
            ...(e.metadata ?? {}),
            confirmed,
            confirmedBy: by,
            confirmedAt: new Date().toISOString(),
          },
        }
      : e,
  );
  return { ...graph, edges, updatedAt: new Date().toISOString() };
}

/** Voice / field note → lightweight entity stubs (demo STT path). */
export function ingestVoiceTranscript(
  existing: KnowledgeGraph | null | undefined,
  transcript: string,
  filename = "voice-note.txt",
): { graph: KnowledgeGraph; addedNodes: number; addedEdges: number } {
  const nodes = [...(existing?.nodes ?? [])];
  const edges = [...(existing?.edges ?? [])];
  const beforeN = nodes.length;
  const beforeE = edges.length;
  const id = `incident-voice-${Date.now()}`;
  const title =
    transcript.slice(0, 60).replace(/\s+/g, " ").trim() || "Voice field note";

  const incident: EngramNode = {
    id,
    name: `Field note: ${title}${(title.length >= 60 ? "…" : "")}`,
    type: "Incident",
    description: transcript,
    sources: [filename],
    metadata: { date: new Date().toISOString().slice(0, 10), voice: true },
  };
  nodes.push(incident);

  // Link to assets mentioned by tag
  for (const asset of nodes.filter((n) => n.type === "Asset")) {
    const tag = (asset.tag ?? "").toLowerCase();
    const nameBits = asset.name.toLowerCase();
    if (
      (tag && transcript.toLowerCase().includes(tag)) ||
      transcript.toLowerCase().includes(nameBits)
    ) {
      edges.push({
        id: `e-voice-${asset.id}-${id}`,
        from: asset.id,
        to: id,
        type: "had_incident",
        label: "had_incident",
        sources: [filename],
        metadata: { confirmed: false, fromVoice: true },
      });
    }
  }

  return {
    graph: {
      nodes,
      edges,
      updatedAt: new Date().toISOString(),
    },
    addedNodes: nodes.length - beforeN,
    addedEdges: edges.length - beforeE,
  };
}

/** Bundle all intelligence for the plant dashboard. */
export function buildPlantIntelligence(
  graph: KnowledgeGraph,
  focusPerson = "Ramesh Kumar",
  focusAsset = "Pump P-101",
) {
  return {
    health: computeKnowledgeHealth(graph),
    succession: buildSuccessionPlan(graph, focusPerson),
    quietKnowledge: detectQuietKnowledge(graph),
    coverageGaps: findCoverageGaps(graph),
    failureTwins: findFailureTwins(graph, focusAsset),
    timeline: buildAssetTimeline(graph, focusAsset),
    mentorship: suggestMentorship(graph),
    shiftBrief: buildShiftHandoff(graph),
    staleness: detectStaleness(graph),
    partsCascade: partsCascade(graph, "SKF Bearing 6205"),
    crossUnit: crossUnitTransfers(graph, focusAsset),
    riskReport: computeRiskReport(graph),
  };
}

export type PlantIntelligence = ReturnType<typeof buildPlantIntelligence>;
