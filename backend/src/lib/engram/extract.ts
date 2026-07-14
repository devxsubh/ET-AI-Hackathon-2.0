import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicModel } from "../llm/models";
import type {
  EdgeType,
  EntityCandidate,
  NodeType,
  RelationCandidate,
} from "./types";
import { EDGE_TYPES, NODE_TYPES } from "./types";

const MAX_TEXT_CHARS = 18000;

type ExtractionPayload = {
  entities: EntityCandidate[];
  relations: RelationCandidate[];
};

function isNodeType(v: unknown): v is NodeType {
  return typeof v === "string" && (NODE_TYPES as readonly string[]).includes(v);
}

function isEdgeType(v: unknown): v is EdgeType {
  return typeof v === "string" && (EDGE_TYPES as readonly string[]).includes(v);
}

/**
 * Ingestor Agent — extract industrial entities (6 node types) + relations via Claude.
 */
export async function extractIndustrialEntities(
  text: string,
  filename: string,
): Promise<ExtractionPayload> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return heuristicExtract(text, filename);
  }

  const client = new Anthropic({ apiKey });
  const truncated =
    text.length > MAX_TEXT_CHARS
      ? text.slice(0, MAX_TEXT_CHARS) + "\n…[truncated]"
      : text;

  const prompt = `You extract industrial knowledge graph entities from manufacturing/maintenance documents.

Return ONLY JSON of the form:
{
  "entities": [{"name": string, "type": NodeType, "confidence": 0-1, "context": string, "tag": string|null}],
  "relations": [{"fromName": string, "fromType": NodeType, "toName": string, "toType": NodeType, "edgeType": EdgeType, "context": string}]
}

NodeType (exactly one of): ${NODE_TYPES.join(", ")}
EdgeType (exactly one of): ${EDGE_TYPES.join(", ")}

Rules:
- Asset: equipment with tags like P-101, C-3, Boiler B-7
- Person: named engineers/operators (full name when available)
- Incident: failure / near-miss / trip events with dates if present
- Document: this file and any referenced reports/SOPs
- Procedure: named step sequences / SOPs
- Part: bearings, seals, OEM part numbers
- Always include a Document entity for the source file itself
- Prefer concrete names over generics ("the pump" → skip unless tagged)
- Maximum 40 entities, 60 relations
- confidence is your certainty 0–1

Document filename: ${filename}

<document>
${truncated}
</document>

Respond with JSON only.`;

  try {
    const message = await client.messages.create({
      model: getAnthropicModel(),
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return heuristicExtract(text, filename);
    const parsed = JSON.parse(jsonMatch[0]) as {
      entities?: unknown[];
      relations?: unknown[];
    };

    const entities = (parsed.entities ?? [])
      .map(normalizeEntity)
      .filter((e): e is EntityCandidate => e !== null)
      .slice(0, 40);

    const relations = (parsed.relations ?? [])
      .map(normalizeRelation)
      .filter((r): r is RelationCandidate => r !== null)
      .slice(0, 60);

    // Ensure document node exists
    if (!entities.some((e) => e.type === "Document" && e.name.includes(filename.replace(/\.[^.]+$/, "")))) {
      entities.unshift({
        name: filename,
        type: "Document",
        confidence: 1,
        context: "Source document",
        tag: null,
      });
    }

    return { entities, relations };
  } catch {
    return heuristicExtract(text, filename);
  }
}

function normalizeEntity(raw: unknown): EntityCandidate | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.name !== "string" || !isNodeType(e.type)) return null;
  return {
    name: e.name.trim(),
    type: e.type,
    confidence: typeof e.confidence === "number" ? e.confidence : 0.7,
    context: typeof e.context === "string" ? e.context : "",
    tag: typeof e.tag === "string" ? e.tag : null,
    sourcePosition:
      typeof e.sourcePosition === "string" ? e.sourcePosition : null,
  };
}

function normalizeRelation(raw: unknown): RelationCandidate | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.fromName !== "string" ||
    typeof r.toName !== "string" ||
    !isNodeType(r.fromType) ||
    !isNodeType(r.toType) ||
    !isEdgeType(r.edgeType)
  ) {
    return null;
  }
  return {
    fromName: r.fromName.trim(),
    fromType: r.fromType,
    toName: r.toName.trim(),
    toType: r.toType,
    edgeType: r.edgeType,
    context: typeof r.context === "string" ? r.context : undefined,
  };
}

/** Fallback when no API key / parse failure — regex tag + name harvest. */
function heuristicExtract(text: string, filename: string): ExtractionPayload {
  const entities: EntityCandidate[] = [
    {
      name: filename,
      type: "Document",
      confidence: 1,
      context: "Source document",
    },
  ];
  const relations: RelationCandidate[] = [];

  const assetRe = /\b([PCBTHV]-?\d{1,4}|Pump\s+P-?\d+|Compressor\s+C-?\d+|Boiler\s+B-?\d+)\b/gi;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = assetRe.exec(text)) !== null) {
    const name = m[1]!.replace(/\s+/g, " ").trim();
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    entities.push({
      name,
      type: "Asset",
      confidence: 0.6,
      context: "Detected equipment tag",
      tag: name,
    });
  }

  const personRe = /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/g;
  let pCount = 0;
  while ((m = personRe.exec(text)) !== null && pCount < 8) {
    const name = m[1]!;
    if (["Unit Three", "March Report", "Seal Failure"].includes(name)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    entities.push({
      name,
      type: "Person",
      confidence: 0.45,
      context: "Possible person name",
    });
    pCount++;
  }

  const partRe = /\b(SKF\s*Bearing\s*\d+|Mechanical\s+Seal\s+Type-?[A-Z]|O-ring[s]?)\b/gi;
  while ((m = partRe.exec(text)) !== null) {
    const name = m[1]!.replace(/\s+/g, " ").trim();
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    entities.push({
      name,
      type: "Part",
      confidence: 0.55,
      context: "Detected spare part",
    });
  }

  return { entities, relations };
}

/** Back-compat shim used by older RAG path. */
export async function extractEntitiesFromText(
  text: string,
  filename: string,
): Promise<Array<{ name: string; type: "person" | "company"; context: string }>> {
  const { entities } = await extractIndustrialEntities(text, filename);
  return entities
    .filter((e) => e.type === "Person" || e.type === "Asset")
    .map((e) => ({
      name: e.name,
      type: e.type === "Person" ? ("person" as const) : ("company" as const),
      context: e.context,
    }));
}
