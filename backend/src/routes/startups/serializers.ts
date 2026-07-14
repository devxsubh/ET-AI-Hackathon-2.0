export function toStartup(raw: unknown) {
  const s = raw as Record<string, unknown>;
  const kg = s.knowledgeGraph as
    | { nodes?: unknown[]; edges?: unknown[]; updatedAt?: unknown }
    | null
    | undefined;
  const rr = s.riskReport as
    | { atRiskAssets?: unknown[]; generatedAt?: unknown; summary?: string }
    | null
    | undefined;
  return {
    id: String(s._id),
    name: s.name,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt ?? null,
    knowledgeGraph: kg
      ? {
          nodes: kg.nodes ?? [],
          edges: kg.edges ?? [],
          updatedAt: kg.updatedAt
            ? new Date(kg.updatedAt as string).toISOString()
            : null,
        }
      : null,
    riskReport: rr
      ? {
          atRiskAssets: rr.atRiskAssets ?? [],
          generatedAt: rr.generatedAt
            ? new Date(rr.generatedAt as string).toISOString()
            : null,
          summary: rr.summary ?? "",
        }
      : null,
    isSample: s.isSample === true,
  };
}
