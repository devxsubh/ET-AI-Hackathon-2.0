/**
 * Jargon Agent — resolve industrial abbreviations / equipment tags
 * to canonical names before retrieval.
 */

export type JargonResolution = {
  input: string;
  canonical: string;
  kind: "asset_tag" | "model" | "abbreviation" | "person" | "unknown";
  description: string;
  confidence: number;
};

/** Seed dictionary for Bharat Engineering Works — Unit 3 demo + common tags. */
const JARGON_DICT: Record<
  string,
  Omit<JargonResolution, "input">
> = {
  "p-101": {
    canonical: "Pump P-101",
    kind: "asset_tag",
    description:
      "Centrifugal pump, Feed water circuit, Unit 3 (Kirloskar KDS-550)",
    confidence: 0.98,
  },
  p101: {
    canonical: "Pump P-101",
    kind: "asset_tag",
    description:
      "Centrifugal pump, Feed water circuit, Unit 3 (Kirloskar KDS-550)",
    confidence: 0.95,
  },
  "c-3": {
    canonical: "Compressor C-3",
    kind: "asset_tag",
    description: "Process air compressor, Unit 3 cooling water circuit support",
    confidence: 0.98,
  },
  c3: {
    canonical: "Compressor C-3",
    kind: "asset_tag",
    description: "Process air compressor, Unit 3 cooling water circuit support",
    confidence: 0.95,
  },
  "b-7": {
    canonical: "Boiler B-7",
    kind: "asset_tag",
    description: "Auxiliary boiler, Unit 3 — steam supply for process heating",
    confidence: 0.98,
  },
  b7: {
    canonical: "Boiler B-7",
    kind: "asset_tag",
    description: "Auxiliary boiler, Unit 3 — steam supply for process heating",
    confidence: 0.95,
  },
  "kds-550": {
    canonical: "Kirloskar pump model KDS-550",
    kind: "model",
    description: "OEM model for Unit 3 feed water centrifugal pumps including P-101",
    confidence: 0.97,
  },
  "xr-22": {
    canonical: "Kirloskar pump model KDS-550",
    kind: "model",
    description: "Internal OEM manual code XR-22 maps to Kirloskar KDS-550",
    confidence: 0.9,
  },
  skf6205: {
    canonical: "SKF Bearing 6205",
    kind: "abbreviation",
    description: "Deep groove ball bearing used on P-101 and C-3",
    confidence: 0.95,
  },
  "skf 6205": {
    canonical: "SKF Bearing 6205",
    kind: "abbreviation",
    description: "Deep groove ball bearing used on P-101 and C-3",
    confidence: 0.95,
  },
  "type-a seal": {
    canonical: "Mechanical Seal Type-A",
    kind: "abbreviation",
    description: "Mechanical seal upgrade used after P-101 2019 cavitation failure",
    confidence: 0.92,
  },
  sop: {
    canonical: "Standard Operating Procedure",
    kind: "abbreviation",
    description: "Documented procedure sequence for maintenance tasks",
    confidence: 0.85,
  },
  oem: {
    canonical: "Original Equipment Manufacturer",
    kind: "abbreviation",
    description: "Equipment manufacturer documentation and parts",
    confidence: 0.9,
  },
  ramesh: {
    canonical: "Ramesh Kumar",
    kind: "person",
    description: "Sr. Maintenance Engineer — Unit 3 cooling water circuit expert",
    confidence: 0.9,
  },
  "ramesh kumar": {
    canonical: "Ramesh Kumar",
    kind: "person",
    description: "Sr. Maintenance Engineer — Unit 3 cooling water circuit expert",
    confidence: 0.98,
  },
  priya: {
    canonical: "Priya Singh",
    kind: "person",
    description: "Maintenance Engineer — shared expertise on Boiler B-7",
    confidence: 0.85,
  },
  // Hinglish / shop-floor phrases
  "seal fail": {
    canonical: "mechanical seal failure",
    kind: "abbreviation",
    description: "Shop-floor shorthand for mechanical seal failure events",
    confidence: 0.88,
  },
  "seal phir se fail": {
    canonical: "repeat mechanical seal failure on Pump P-101",
    kind: "abbreviation",
    description: "Hinglish: seal failing again — typically P-101 cavitation pattern",
    confidence: 0.9,
  },
  "phir se fail": {
    canonical: "repeat failure",
    kind: "abbreviation",
    description: "Hinglish: failing again / repeat failure",
    confidence: 0.85,
  },
  "pump ka seal": {
    canonical: "Pump P-101 mechanical seal",
    kind: "asset_tag",
    description: "Hinglish reference to feed-pump mechanical seal",
    confidence: 0.86,
  },
  vibration: {
    canonical: "high vibration event",
    kind: "abbreviation",
    description: "Often maps to P-101 monsoon vibration pattern (2020)",
    confidence: 0.8,
  },
  bearing: {
    canonical: "SKF Bearing 6205",
    kind: "abbreviation",
    description: "Common Unit 3 bearing — used on P-101 and C-3",
    confidence: 0.75,
  },
  "kya kiya tha": {
    canonical: "what was done previously / historical resolution",
    kind: "abbreviation",
    description: "Hinglish: what did we do before — triggers incident history lookup",
    confidence: 0.9,
  },
  "pehle kya kiya": {
    canonical: "prior corrective action history",
    kind: "abbreviation",
    description: "Hinglish: what was done earlier",
    confidence: 0.9,
  },
};

/** Normalize light Hinglish before jargon expansion. */
export function normalizeHinglish(query: string): string {
  return query
    .replace(/\bmein\b/gi, "in")
    .replace(/\bka\b/gi, " ")
    .replace(/\bki\b/gi, " ")
    .replace(/\bho\s+gaya\b/gi, "occurred")
    .replace(/\brha\b|\braha\b/gi, "happening")
    .replace(/\bdubara\b/gi, "again")
    .replace(/\bphir\s+se\b/gi, "again");
}

function normalizeTerm(term: string): string {
  return term.trim().toLowerCase().replace(/\s+/g, " ");
}

export function resolveJargon(term: string): JargonResolution {
  const key = normalizeTerm(term);
  const hit = JARGON_DICT[key];
  if (hit) {
    return { input: term, ...hit };
  }

  // Fuzzy: strip punctuation
  const stripped = key.replace(/[^a-z0-9]+/g, "");
  for (const [k, v] of Object.entries(JARGON_DICT)) {
    if (k.replace(/[^a-z0-9]+/g, "") === stripped) {
      return { input: term, ...v };
    }
  }

  return {
    input: term,
    canonical: term,
    kind: "unknown",
    description: "No jargon mapping found — using input as-is.",
    confidence: 0.3,
  };
}

/** Expand jargon tokens found in a free-text query. */
export function expandQueryJargon(query: string): {
  expandedQuery: string;
  resolutions: JargonResolution[];
} {
  const resolutions: JargonResolution[] = [];
  let expanded = normalizeHinglish(query);

  // Longer keys first so "ramesh kumar" wins over "ramesh"
  const keys = Object.keys(JARGON_DICT).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const re = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    if (re.test(expanded)) {
      const r = resolveJargon(key);
      resolutions.push(r);
      expanded = expanded.replace(re, r.canonical);
    }
  }

  return { expandedQuery: expanded, resolutions };
}

export function listJargonDictionary(): Array<{ term: string } & Omit<JargonResolution, "input">> {
  return Object.entries(JARGON_DICT).map(([term, v]) => ({ term, ...v }));
}
