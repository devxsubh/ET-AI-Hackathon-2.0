"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type {
  EngramEdge,
  EngramNode,
  KnowledgeGraph,
  NodeType,
} from "@/lib/engramTypes";
import { NODE_COLORS, NODE_TYPES, parseTraversalPath } from "@/lib/engramTypes";

type Props = {
  graph: KnowledgeGraph;
  onSelectNode?: (node: EngramNode | null) => void;
  onSelectEdge?: (edge: EngramEdge | null) => void;
  highlightPath?: string[];
  onClearPath?: () => void;
  emphasisNodeIds?: string[];
  warRoomAssetId?: string | null;
};

type EngramFlowData = {
  label: string;
  sub?: string;
  nodeType: NodeType;
  name: string;
};

function EngramNodeCard({ data, selected }: NodeProps) {
  const d = data as EngramFlowData;
  const colors = NODE_COLORS[d.nodeType];
  return (
    <div
      className="rounded-xl border-2 px-3 py-2"
      style={{
        background: colors.bg,
        borderColor: selected ? "#0f172a" : colors.border,
        color: colors.text,
        minWidth: 128,
        maxWidth: 152,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-0 !bg-slate-400"
      />
      <div className="text-[9px] font-semibold uppercase tracking-wide opacity-55">
        {d.nodeType}
      </div>
      <div className="text-[11px] font-semibold leading-snug">{d.label}</div>
      {d.sub && <div className="mt-0.5 text-[10px] opacity-50">{d.sub}</div>}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-0 !bg-slate-400"
      />
    </div>
  );
}

const nodeTypes = { engram: EngramNodeCard };

/** Edge stroke by relation — replaces on-canvas text labels (no overlap). */
const EDGE_COLORS: Record<string, string> = {
  expert_on: "#22c55e",
  had_incident: "#ef4444",
  fixed_by: "#fb923c",
  governed_by: "#a855f7",
  requires_part: "#64748b",
  references_part: "#94a3b8",
  authored: "#3b82f6",
  documented_in: "#8b5cf6",
  resolved_using: "#ea580c",
  describes: "#6366f1",
};

function layoutNodes(nodes: EngramNode[]): Node[] {
  const byType: Record<NodeType, EngramNode[]> = {
    Asset: [],
    Person: [],
    Incident: [],
    Document: [],
    Procedure: [],
    Part: [],
  };
  for (const n of nodes) byType[n.type]?.push(n);

  const columns: Array<{ type: NodeType; x: number; rowH: number }> = [
    { type: "Person", x: 0, rowH: 110 },
    { type: "Asset", x: 230, rowH: 120 },
    { type: "Incident", x: 470, rowH: 110 },
    { type: "Procedure", x: 720, rowH: 110 },
    { type: "Part", x: 970, rowH: 90 },
    { type: "Document", x: 1200, rowH: 100 },
  ];

  const tallest = Math.max(
    ...columns.map((c) => (byType[c.type] ?? []).length * c.rowH),
    360,
  );

  const result: Node[] = [];
  for (const col of columns) {
    const list = byType[col.type] ?? [];
    const blockH = list.length * col.rowH;
    const startY = Math.max(20, (tallest - blockH) / 2);
    list.forEach((n, row) => {
      result.push({
        id: n.id,
        type: "engram",
        position: { x: 40 + col.x, y: startY + row * col.rowH },
        data: {
          label: n.name,
          sub: n.tag ?? undefined,
          nodeType: n.type,
          name: n.name,
        } satisfies EngramFlowData,
      });
    });
  }
  return result;
}

export function KnowledgeGraphView({
  graph,
  onSelectNode,
  onSelectEdge,
  highlightPath = [],
  onClearPath,
  emphasisNodeIds = [],
  warRoomAssetId = null,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** When on, dim unrelated nodes — off by default so full plant is visible. */
  const [focusMode, setFocusMode] = useState(false);
  const [hiddenTypes, setHiddenTypes] = useState<Set<NodeType>>(new Set());

  const { nodeNames: pathNames } = useMemo(
    () => parseTraversalPath(highlightPath),
    [highlightPath],
  );

  const pathNodeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const n of graph.nodes) {
      for (const pn of pathNames) {
        if (
          n.name === pn ||
          n.name.includes(pn) ||
          pn.includes(n.name) ||
          (n.tag && (pn.includes(n.tag) || n.tag === pn))
        ) {
          ids.add(n.id);
        }
      }
    }
    if (warRoomAssetId) ids.add(warRoomAssetId);
    return ids;
  }, [graph.nodes, pathNames, warRoomAssetId]);

  const neighborIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const ids = new Set<string>([selectedId]);
    for (const e of graph.edges) {
      if (e.from === selectedId) ids.add(e.to);
      if (e.to === selectedId) ids.add(e.from);
    }
    return ids;
  }, [graph.edges, selectedId]);

  const visibleNodeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const n of graph.nodes) {
      if (!hiddenTypes.has(n.type)) ids.add(n.id);
    }
    return ids;
  }, [graph.nodes, hiddenTypes]);

  const layouted = useMemo(() => layoutNodes(graph.nodes), [graph.nodes]);
  const hasPath = pathNodeIds.size > 0;
  // Only dim when user opts into Focus, or Copilot path reveal is active
  const dimming = hasPath || (focusMode && !!selectedId);

  const nodes: Node[] = useMemo(
    () =>
      layouted
        .filter((n) => visibleNodeIds.has(n.id))
        .map((n) => {
          const onPath = pathNodeIds.has(n.id);
          const emphasis = emphasisNodeIds.includes(n.id);
          const inNeighborhood = neighborIds.has(n.id);
          const keep =
            !dimming ||
            (hasPath ? onPath : inNeighborhood) ||
            emphasis ||
            n.id === warRoomAssetId;

          return {
            ...n,
            selected: n.id === selectedId,
            style: {
              opacity: keep ? 1 : 0.18,
              transition: "opacity 0.15s ease",
              zIndex: n.id === selectedId || onPath || emphasis ? 10 : 1,
            },
          };
        }),
    [
      layouted,
      visibleNodeIds,
      pathNodeIds,
      emphasisNodeIds,
      warRoomAssetId,
      neighborIds,
      dimming,
      hasPath,
      selectedId,
    ],
  );

  const edges: Edge[] = useMemo(() => {
    return graph.edges
      .filter((e) => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to))
      .map((e) => {
        const onPath =
          hasPath && pathNodeIds.has(e.from) && pathNodeIds.has(e.to);
        const touchesSelected =
          selectedId != null &&
          (e.from === selectedId || e.to === selectedId);
        const highlighted = onPath || touchesSelected;
        const keep = !dimming || highlighted;
        const base = EDGE_COLORS[e.type] ?? "#d4d4d8";

        return {
          id: e.id,
          source: e.from,
          target: e.to,
          type: "default",
          // Never put text on edges — it stacks and overlaps. Relation
          // names live in the selection panel below instead.
          label: undefined,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: highlighted ? 12 : 8,
            height: highlighted ? 12 : 8,
            color: highlighted ? base : "#cbd5e1",
          },
          animated: onPath,
          style: {
            stroke: highlighted ? base : "#d4d4d8",
            strokeWidth: onPath ? 2.5 : touchesSelected ? 2 : 1,
            opacity: keep ? (highlighted ? 1 : 0.4) : 0.06,
          },
        };
      });
  }, [
    graph.edges,
    visibleNodeIds,
    hasPath,
    pathNodeIds,
    selectedId,
    dimming,
  ]);

  const selectedLinks = useMemo(() => {
    if (!selectedId) return [];
    return graph.edges
      .filter((e) => e.from === selectedId || e.to === selectedId)
      .map((e) => {
        const otherId = e.from === selectedId ? e.to : e.from;
        const other = graph.nodes.find((n) => n.id === otherId);
        const outbound = e.from === selectedId;
        return {
          id: e.id,
          edge: e,
          label: e.type.replace(/_/g, " "),
          otherName: other?.name ?? otherId,
          otherType: other?.type,
          outbound,
        };
      });
  }, [graph.edges, graph.nodes, selectedId]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_evt, node) => {
      if (selectedId === node.id) {
        // Second click clears focus → back to full overview
        setSelectedId(null);
        setFocusMode(false);
        onSelectNode?.(null);
        return;
      }
      setSelectedId(node.id);
      setFocusMode(true);
      onSelectNode?.(graph.nodes.find((n) => n.id === node.id) ?? null);
    },
    [graph.nodes, onSelectNode, selectedId],
  );

  const onPaneClick = useCallback(() => {
    setSelectedId(null);
    setFocusMode(false);
    onSelectNode?.(null);
  }, [onSelectNode]);

  function toggleType(t: NodeType) {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  const selected = selectedId
    ? graph.nodes.find((n) => n.id === selectedId)
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-white px-3 py-2">
        {NODE_TYPES.map((t) => {
          const on = !hiddenTypes.has(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggleType(t)}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                on
                  ? "bg-slate-50 text-slate-600 ring-1 ring-slate-200"
                  : "text-slate-300"
              }`}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: NODE_COLORS[t].border }}
              />
              {t}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-1.5">
          {(focusMode || hasPath || selectedId) && (
            <button
              type="button"
              onClick={() => {
                setFocusMode(false);
                setSelectedId(null);
                onSelectNode?.(null);
                onClearPath?.();
              }}
              className="rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100"
            >
              Show all
            </button>
          )}
          <span className="pl-1 text-[11px] text-slate-400">
            {selected
              ? `${selected.name} · ${selectedLinks.length} links`
              : `${graph.nodes.length} nodes · ${graph.edges.length} links`}
          </span>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 bg-[#f7f7f5]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onEdgeClick={(_e, edge) => {
            onSelectEdge?.(graph.edges.find((x) => x.id === edge.id) ?? null);
          }}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          proOptions={{ hideAttribution: true }}
          minZoom={0.15}
          maxZoom={1.6}
          nodesDraggable
        >
          <Background gap={20} color="#e7e5e4" />
          <Controls
            showInteractive={false}
            className="!overflow-hidden !rounded-lg !border-slate-200 !bg-white !shadow-sm"
          />
        </ReactFlow>
      </div>

      {selected && (
        <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-2.5">
          <div className="text-sm">
            <span className="font-medium text-slate-900">{selected.name}</span>
            <span className="ml-2 text-xs text-slate-400">{selected.type}</span>
            {selected.description && (
              <span className="ml-2 text-xs text-slate-500">
                — {selected.description}
              </span>
            )}
          </div>
          {selectedLinks.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedLinks.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => onSelectEdge?.(l.edge)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700 hover:border-slate-300"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: EDGE_COLORS[l.edge.type] ?? "#94a3b8",
                    }}
                  />
                  <span className="text-slate-400">
                    {l.outbound ? "→" : "←"} {l.label}
                  </span>
                  <span className="font-medium">{l.otherName}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
