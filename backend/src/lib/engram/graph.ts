import { DirectedGraph } from "graphology";
import type {
  EdgeType,
  EngramEdge,
  EngramNode,
  KnowledgeGraph,
  NodeType,
} from "./types";
import { emptyKnowledgeGraph } from "./types";

function normalizeKey(name: string, type: NodeType): string {
  return `${type}:${name.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

function slugId(name: string, type: NodeType): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${type.toLowerCase()}-${base || "unknown"}`;
}

export function nodeIdFor(name: string, type: NodeType): string {
  return slugId(name, type);
}

export function edgeIdFor(
  fromId: string,
  toId: string,
  edgeType: EdgeType,
): string {
  return `${fromId}|${edgeType}|${toId}`;
}

/** Load a persisted KnowledgeGraph into a DirectedGraph for traversal. */
export function toDirectedGraph(kg: KnowledgeGraph): DirectedGraph {
  const g = new DirectedGraph();
  for (const n of kg.nodes) {
    if (!g.hasNode(n.id)) {
      g.addNode(n.id, { ...n });
    }
  }
  for (const e of kg.edges) {
    if (!g.hasNode(e.from) || !g.hasNode(e.to)) continue;
    if (!g.hasDirectedEdge(e.from, e.to)) {
      g.addDirectedEdge(e.from, e.to, { ...e });
    } else {
      // Parallel edges of different types: store as list on edge attr
      const existing = g.getEdgeAttributes(e.from, e.to) as EngramEdge & {
        types?: EdgeType[];
      };
      const types = new Set<EdgeType>([
        ...(existing.types ?? [existing.type]),
        e.type,
      ]);
      g.mergeEdgeAttributes(e.from, e.to, {
        ...e,
        types: [...types],
      });
    }
  }
  return g;
}

export function fromDirectedGraph(
  g: DirectedGraph,
  updatedAt: string | null = new Date().toISOString(),
): KnowledgeGraph {
  const nodes: EngramNode[] = g.mapNodes((id, attrs) => ({
    id,
    name: (attrs.name as string) ?? id,
    type: attrs.type as NodeType,
    tag: (attrs.tag as string | null | undefined) ?? null,
    description: (attrs.description as string | null | undefined) ?? null,
    sources: (attrs.sources as string[] | undefined) ?? [],
    metadata: (attrs.metadata as Record<string, unknown> | undefined) ?? {},
  }));

  const edges: EngramEdge[] = [];
  g.forEachEdge((_key, attrs, source, target) => {
    const types: EdgeType[] =
      (attrs.types as EdgeType[] | undefined) ??
      (attrs.type ? [attrs.type as EdgeType] : []);
    for (const type of types.length ? types : [(attrs.type as EdgeType)]) {
      edges.push({
        id: (attrs.id as string) || edgeIdFor(source, target, type),
        from: source,
        to: target,
        type,
        label: (attrs.label as string | null | undefined) ?? type,
        sources: (attrs.sources as string[] | undefined) ?? [],
        metadata: (attrs.metadata as Record<string, unknown> | undefined) ?? {},
      });
    }
  });

  return { nodes, edges, updatedAt };
}

export type UpsertNodeInput = {
  name: string;
  type: NodeType;
  tag?: string | null;
  description?: string | null;
  source?: string;
  metadata?: Record<string, unknown>;
};

export type UpsertEdgeInput = {
  fromId: string;
  toId: string;
  type: EdgeType;
  source?: string;
  label?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Merge entity candidates into an existing knowledge graph.
 * Dedupes by normalized (type, name).
 */
export function mergeIntoGraph(
  existing: KnowledgeGraph | null | undefined,
  nodes: UpsertNodeInput[],
  edges: UpsertEdgeInput[],
): { graph: KnowledgeGraph; addedNodes: number; addedEdges: number } {
  const base = existing ?? emptyKnowledgeGraph();
  const byKey = new Map<string, EngramNode>();
  for (const n of base.nodes) {
    byKey.set(normalizeKey(n.name, n.type), { ...n });
  }

  let addedNodes = 0;
  const idByKey = new Map<string, string>();

  for (const input of nodes) {
    const key = normalizeKey(input.name, input.type);
    const existingNode = byKey.get(key);
    if (existingNode) {
      idByKey.set(key, existingNode.id);
      const sources = new Set(existingNode.sources ?? []);
      if (input.source) sources.add(input.source);
      byKey.set(key, {
        ...existingNode,
        tag: input.tag ?? existingNode.tag,
        description: input.description ?? existingNode.description,
        sources: [...sources],
        metadata: { ...existingNode.metadata, ...input.metadata },
      });
    } else {
      const id = nodeIdFor(input.name, input.type);
      // Avoid id collisions with different names that slug the same
      let uniqueId = id;
      let i = 2;
      while ([...byKey.values()].some((n) => n.id === uniqueId)) {
        uniqueId = `${id}-${i++}`;
      }
      const node: EngramNode = {
        id: uniqueId,
        name: input.name.trim(),
        type: input.type,
        tag: input.tag ?? null,
        description: input.description ?? null,
        sources: input.source ? [input.source] : [],
        metadata: input.metadata ?? {},
      };
      byKey.set(key, node);
      idByKey.set(key, uniqueId);
      addedNodes++;
    }
  }

  // Resolve name→id for any node already in graph
  for (const n of byKey.values()) {
    idByKey.set(normalizeKey(n.name, n.type), n.id);
  }

  const edgeMap = new Map<string, EngramEdge>();
  for (const e of base.edges) {
    edgeMap.set(edgeIdFor(e.from, e.to, e.type), { ...e });
  }

  let addedEdges = 0;
  for (const input of edges) {
    if (!input.fromId || !input.toId) continue;
    const eid = edgeIdFor(input.fromId, input.toId, input.type);
    const prev = edgeMap.get(eid);
    if (prev) {
      const sources = new Set(prev.sources ?? []);
      if (input.source) sources.add(input.source);
      edgeMap.set(eid, {
        ...prev,
        sources: [...sources],
        metadata: { ...prev.metadata, ...input.metadata },
      });
    } else {
      edgeMap.set(eid, {
        id: eid,
        from: input.fromId,
        to: input.toId,
        type: input.type,
        label: input.label ?? input.type,
        sources: input.source ? [input.source] : [],
        metadata: input.metadata ?? {},
      });
      addedEdges++;
    }
  }

  return {
    graph: {
      nodes: [...byKey.values()],
      edges: [...edgeMap.values()],
      updatedAt: new Date().toISOString(),
    },
    addedNodes,
    addedEdges,
  };
}

/** Find node by name (case-insensitive) and optional type. */
export function findNode(
  graph: KnowledgeGraph,
  name: string,
  type?: NodeType,
): EngramNode | null {
  const needle = name.trim().toLowerCase();
  return (
    graph.nodes.find(
      (n) =>
        n.name.toLowerCase() === needle &&
        (type === undefined || n.type === type),
    ) ??
    graph.nodes.find(
      (n) =>
        (n.tag?.toLowerCase() === needle ||
          n.name.toLowerCase().includes(needle)) &&
        (type === undefined || n.type === type),
    ) ??
    null
  );
}

export function getNode(graph: KnowledgeGraph, id: string): EngramNode | null {
  return graph.nodes.find((n) => n.id === id) ?? null;
}

/** Neighbors in either direction with edge type. */
export function getNeighbors(
  graph: KnowledgeGraph,
  nodeId: string,
): Array<{ node: EngramNode; edge: EngramEdge; direction: "out" | "in" }> {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const result: Array<{
    node: EngramNode;
    edge: EngramEdge;
    direction: "out" | "in";
  }> = [];

  for (const e of graph.edges) {
    if (e.from === nodeId) {
      const node = byId.get(e.to);
      if (node) result.push({ node, edge: e, direction: "out" });
    } else if (e.to === nodeId) {
      const node = byId.get(e.from);
      if (node) result.push({ node, edge: e, direction: "in" });
    }
  }
  return result;
}

export type TraversalStep = {
  fromId: string;
  fromName: string;
  edgeType: EdgeType;
  toId: string;
  toName: string;
};

/**
 * BFS multi-hop from a start node up to `maxDepth`.
 * Returns visited nodes and the path edges taken.
 */
export function traverseFrom(
  graph: KnowledgeGraph,
  startId: string,
  maxDepth = 3,
): { nodes: EngramNode[]; path: TraversalStep[] } {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  if (!byId.has(startId)) return { nodes: [], path: [] };

  const visited = new Set<string>([startId]);
  const path: TraversalStep[] = [];
  let frontier = [startId];

  for (let depth = 0; depth < maxDepth; depth++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const e of graph.edges) {
        let other: string | null = null;
        let fromId = id;
        let toId = "";
        if (e.from === id && !visited.has(e.to)) {
          other = e.to;
          toId = e.to;
        } else if (e.to === id && !visited.has(e.from)) {
          other = e.from;
          fromId = e.from;
          toId = id;
          // Represent inbound as from→to with actual edge direction
          fromId = e.from;
          toId = e.to;
        }
        if (!other) continue;
        visited.add(other);
        next.push(other);
        path.push({
          fromId,
          fromName: byId.get(fromId)?.name ?? fromId,
          edgeType: e.type,
          toId,
          toName: byId.get(toId)?.name ?? toId,
        });
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }

  return {
    nodes: [...visited].map((id) => byId.get(id)!).filter(Boolean),
    path,
  };
}

/** Person nodes connected to an asset via expert_on, fixed_by (via incidents), or authored procedures. */
export function expertsForAsset(
  graph: KnowledgeGraph,
  assetId: string,
): EngramNode[] {
  const people = new Map<string, EngramNode>();
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  for (const e of graph.edges) {
    // Person → expert_on → Asset
    if (e.type === "expert_on" && e.to === assetId) {
      const p = byId.get(e.from);
      if (p?.type === "Person") people.set(p.id, p);
    }
    // Asset → had_incident → Incident ← fixed_by ← Person
    if (e.type === "had_incident" && e.from === assetId) {
      for (const fe of graph.edges) {
        if (fe.type === "fixed_by" && fe.from === e.to) {
          const p = byId.get(fe.to);
          if (p?.type === "Person") people.set(p.id, p);
        }
      }
    }
    // Asset → governed_by → Procedure ← authored ← Person
    if (e.type === "governed_by" && e.from === assetId) {
      for (const ae of graph.edges) {
        if (ae.type === "authored" && ae.to === e.to) {
          const p = byId.get(ae.from);
          if (p?.type === "Person") people.set(p.id, p);
        }
      }
    }
  }

  return [...people.values()];
}

export function resolveNodeKey(
  graph: KnowledgeGraph,
  name: string,
  type: NodeType,
): string | null {
  const n = findNode(graph, name, type);
  return n?.id ?? null;
}
