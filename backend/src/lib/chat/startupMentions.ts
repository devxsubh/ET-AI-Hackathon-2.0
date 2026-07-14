import mongoose from "mongoose";
import { connectDb } from "../infra/db";
import { visibleStartupFilter } from "../sample/sampleAssets";
import { Startup } from "../../models/startup";

export type MentionedStartup = {
  id: string;
  name: string;
  hasKnowledgeGraph: boolean;
  nodeCount: number;
};

/** Extract @mentions: @"Quoted Name", @objectId, or @TokenName */
export function extractStartupMentions(text: string): string[] {
  const pattern =
    /@(?:"([^"]+)"|([a-f0-9]{24})|([A-Za-z0-9][A-Za-z0-9_.-]*))/g;
  const found: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const token = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (token) found.push(token);
  }
  return [...new Set(found)];
}

export function extractMentionsFromMessages(
  messages: Array<{ role: string; content: string }>,
): string[] {
  const tokens: string[] = [];
  for (const m of messages) {
    if (m.role !== "user") continue;
    tokens.push(...extractStartupMentions(m.content));
  }
  return [...new Set(tokens)];
}

export async function resolveStartupMentions(
  tokens: string[],
  userId?: string,
): Promise<MentionedStartup[]> {
  if (tokens.length === 0) return [];
  await connectDb();

  const startups = userId
    ? await Startup.find(await visibleStartupFilter(userId)).lean()
    : await Startup.find({}).lean();
  const byId = new Map<string, Record<string, unknown>>();
  const byName = new Map<string, Record<string, unknown>>();
  for (const s of startups as Array<Record<string, unknown>>) {
    byId.set(String(s._id), s);
    const name = String(s.name ?? "").trim().toLowerCase();
    if (name) byName.set(name, s);
  }

  const resolved: MentionedStartup[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    let doc: Record<string, unknown> | undefined;
    if (mongoose.Types.ObjectId.isValid(token) && token.length === 24) {
      doc = byId.get(token);
    } else {
      doc = byName.get(token.toLowerCase());
    }
    if (!doc) continue;

    const id = String(doc._id);
    if (seen.has(id)) continue;
    seen.add(id);

    const kg = doc.knowledgeGraph as { nodes?: unknown[] } | null | undefined;
    const nodeCount = kg?.nodes?.length ?? 0;
    resolved.push({
      id,
      name: String(doc.name),
      hasKnowledgeGraph: nodeCount > 0,
      nodeCount,
    });
  }

  return resolved;
}

export function formatMentionedStartupsContext(
  mentions: MentionedStartup[],
): string {
  if (mentions.length === 0) return "";
  const lines = mentions.map(
    (m) =>
      `- ${m.name} (id: ${m.id}) — knowledge graph: ${
        m.hasKnowledgeGraph ? `${m.nodeCount} nodes` : "empty"
      }`,
  );
  return `Mentioned plants:\n${lines.join("\n")}`;
}
