"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { EngramNode, KnowledgeGraph, NodeType } from "@/lib/engramTypes";
import { NODE_COLORS } from "@/lib/engramTypes";

type Props = {
  graph: KnowledgeGraph;
  onSelectNode?: (node: EngramNode | null) => void;
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
  for (const n of nodes) {
    byType[n.type]?.push(n);
  }

  const columns: NodeType[] = [
    "Person",
    "Asset",
    "Incident",
    "Procedure",
    "Part",
    "Document",
  ];
  const result: Node[] = [];
  columns.forEach((type, col) => {
    const list = byType[type] ?? [];
    list.forEach((n, row) => {
      const colors = NODE_COLORS[n.type];
      result.push({
        id: n.id,
        position: { x: col * 220, y: row * 90 },
        data: {
          label: n.tag ? `${n.name}\n(${n.tag})` : n.name,
          nodeType: n.type,
        },
        style: {
          background: colors.bg,
          border: `2px solid ${colors.border}`,
          color: colors.text,
          borderRadius: 10,
          fontSize: 11,
          fontWeight: 600,
          padding: "8px 12px",
          width: 160,
          whiteSpace: "pre-line",
          textAlign: "center",
        },
      });
    });
  });
  return result;
}

export function KnowledgeGraphView({ graph, onSelectNode }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const nodes = useMemo(() => layoutNodes(graph.nodes), [graph.nodes]);
  const edges: Edge[] = useMemo(
    () =>
      graph.edges.map((e) => ({
        id: e.id,
        source: e.from,
        target: e.to,
        label: e.label ?? e.type,
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
        style: { stroke: "#94a3b8", strokeWidth: 1.5 },
        labelStyle: { fontSize: 9, fill: "#64748b" },
        labelBgStyle: { fill: "#f8fafc", fillOpacity: 0.9 },
      })),
    [graph.edges],
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_evt, node) => {
      setSelectedId(node.id);
      const found = graph.nodes.find((n) => n.id === node.id) ?? null;
      onSelectNode?.(found);
    },
    [graph.nodes, onSelectNode],
  );

  const selected = selectedId
    ? graph.nodes.find((n) => n.id === selectedId)
    : null;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex flex-wrap gap-2 px-3 py-2 border-b border-slate-200 bg-white text-[10px] text-slate-600">
        {(Object.keys(NODE_COLORS) as NodeType[]).map((t) => (
          <span key={t} className="inline-flex items-center gap-1">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: NODE_COLORS[t].border }}
            />
            {t}
          </span>
        ))}
        <span className="ml-auto text-slate-400">
          {graph.nodes.length} nodes · {graph.edges.length} edges
        </span>
      </div>
      <div className="flex-1 min-h-[280px]">
        <ReactFlow
          nodes={nodes.map((n) => ({
            ...n,
            style: {
              ...n.style,
              boxShadow:
                n.id === selectedId ? `0 0 0 3px ${NODE_COLORS[(n.data as { nodeType: NodeType }).nodeType].border}` : undefined,
            },
          }))}
          edges={edges}
          onNodeClick={onNodeClick}
          fitView
          proOptions={{ hideAttribution: true }}
          minZoom={0.2}
          maxZoom={1.5}
        >
          <Background gap={16} color="#e2e8f0" />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={(n) => {
              const t = (n.data as { nodeType?: NodeType })?.nodeType;
              return t ? NODE_COLORS[t].border : "#94a3b8";
            }}
            maskColor="rgba(248,250,252,0.7)"
          />
        </ReactFlow>
      </div>
      {selected && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 text-sm">
          <div className="font-semibold text-slate-900">
            {selected.name}{" "}
            <span className="text-xs font-normal text-slate-500">
              ({selected.type})
            </span>
          </div>
          {selected.description && (
            <p className="mt-1 text-slate-600 text-xs">{selected.description}</p>
          )}
          {selected.sources && selected.sources.length > 0 && (
            <p className="mt-1 text-[11px] text-slate-400">
              Sources: {selected.sources.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
