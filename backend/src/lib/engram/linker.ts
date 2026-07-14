import {
  findNode,
  mergeIntoGraph,
  nodeIdFor,
  type UpsertEdgeInput,
  type UpsertNodeInput,
} from "./graph";
import { computeRiskReport } from "./riskAgent";
import type {
  EntityCandidate,
  IngestResult,
  KnowledgeGraph,
  RelationCandidate,
} from "./types";
import { emptyKnowledgeGraph } from "./types";

/**
 * Linker Agent — match entity candidates against existing graph nodes,
 * create unknowns, and draw typed edges.
 */
export function linkEntitiesIntoGraph(
  existing: KnowledgeGraph | null | undefined,
  entities: EntityCandidate[],
  relations: RelationCandidate[],
  filename: string,
): IngestResult {
  let working = existing ?? emptyKnowledgeGraph();

  const nodes: UpsertNodeInput[] = entities.map((e) => ({
    name: e.name,
    type: e.type,
    tag: e.tag ?? null,
    description: e.context || null,
    source: filename,
    metadata: {
      confidence: e.confidence,
      sourcePosition: e.sourcePosition ?? null,
    },
  }));

  working = mergeIntoGraph(working, nodes, []).graph;

  const edges: UpsertEdgeInput[] = [];
  for (const r of relations) {
    let fromId =
      findNode(working, r.fromName, r.fromType)?.id ??
      findNode(working, r.fromName)?.id ??
      null;
    let toId =
      findNode(working, r.toName, r.toType)?.id ??
      findNode(working, r.toName)?.id ??
      null;

    const extraNodes: UpsertNodeInput[] = [];
    if (!fromId) {
      fromId = nodeIdFor(r.fromName, r.fromType);
      extraNodes.push({
        name: r.fromName,
        type: r.fromType,
        source: filename,
        description: r.context ?? null,
      });
    }
    if (!toId) {
      toId = nodeIdFor(r.toName, r.toType);
      extraNodes.push({
        name: r.toName,
        type: r.toType,
        source: filename,
        description: r.context ?? null,
      });
    }
    if (extraNodes.length) {
      working = mergeIntoGraph(working, extraNodes, []).graph;
      fromId =
        findNode(working, r.fromName, r.fromType)?.id ??
        findNode(working, r.fromName)?.id ??
        fromId;
      toId =
        findNode(working, r.toName, r.toType)?.id ??
        findNode(working, r.toName)?.id ??
        toId;
    }

    if (fromId && toId) {
      edges.push({
        fromId,
        toId,
        type: r.edgeType,
        source: filename,
        label: r.edgeType,
        metadata: r.context ? { context: r.context } : {},
      });
    }
  }

  const merged = mergeIntoGraph(working, [], edges);
  const riskReport = computeRiskReport(merged.graph);

  return {
    graph: merged.graph,
    riskReport,
    addedNodes: merged.addedNodes + nodes.length, // approximate; merge reports true adds
    addedEdges: merged.addedEdges,
    filename,
  };
}
