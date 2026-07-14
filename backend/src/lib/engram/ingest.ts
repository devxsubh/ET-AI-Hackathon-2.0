import { extractIndustrialEntities } from "./extract";
import { linkEntitiesIntoGraph } from "./linker";
import type { IngestResult, KnowledgeGraph } from "./types";

export type IngestProgressFn = (event: {
  stage: string;
  status: "running" | "done" | "error";
  detail?: string;
  current?: number;
  total?: number;
}) => void;

/**
 * Full ingest pipeline: text → Ingestor → Linker → updated graph + risk report.
 */
export async function ingestDocumentText(
  text: string,
  filename: string,
  existing: KnowledgeGraph | null | undefined,
  onProgress?: IngestProgressFn,
): Promise<IngestResult> {
  onProgress?.({
    stage: "parse",
    status: "done",
    detail: `Parsed ${filename} (${text.length} chars)`,
  });

  onProgress?.({
    stage: "extract",
    status: "running",
    detail: "Extracting entities across 6 node types…",
  });

  const { entities, relations } = await extractIndustrialEntities(
    text,
    filename,
  );

  onProgress?.({
    stage: "extract",
    status: "done",
    detail: `Found ${entities.length} entities, ${relations.length} relations`,
    current: entities.length,
    total: entities.length,
  });

  onProgress?.({
    stage: "link",
    status: "running",
    detail: "Linking entities into knowledge graph…",
  });

  const result = linkEntitiesIntoGraph(
    existing,
    entities,
    relations,
    filename,
  );

  onProgress?.({
    stage: "link",
    status: "done",
    detail: `+${result.addedNodes} nodes, +${result.addedEdges} edges`,
  });

  onProgress?.({
    stage: "risk",
    status: "done",
    detail: result.riskReport.summary,
  });

  return result;
}
