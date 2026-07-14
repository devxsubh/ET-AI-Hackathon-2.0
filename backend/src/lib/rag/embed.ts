import OpenAI from "openai";

const OPENAI_EMBED_MODEL = "text-embedding-3-small";
const EMBED_BATCH_SIZE = parseInt(process.env.RAG_EMBED_BATCH_SIZE ?? "16", 10);
const EMBEDDING_DIM = 1536;

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  if (!client) client = new OpenAI({ apiKey: key });
  return client;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const openai = getClient();
  if (!openai) {
    console.warn("[rag] OPENAI_API_KEY not set — returning zero vectors (RAG disabled)");
    return texts.map(() => new Array(EMBEDDING_DIM).fill(0) as number[]);
  }

  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
    const response = await openai.embeddings.create({
      model: OPENAI_EMBED_MODEL,
      input: batch,
    });
    for (const item of response.data) {
      results.push(item.embedding);
    }
  }
  return results;
}

export async function embedQuery(text: string): Promise<number[]> {
  const openai = getClient();
  if (!openai) {
    return new Array(EMBEDDING_DIM).fill(0) as number[];
  }
  const response = await openai.embeddings.create({
    model: OPENAI_EMBED_MODEL,
    input: text,
  });
  return response.data[0]?.embedding ?? (new Array(EMBEDDING_DIM).fill(0) as number[]);
}

export function isEmbeddingEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export function logRagStartupWarnings(): void {
  if (isEmbeddingEnabled()) {
    const vectorOn = process.env.MONGO_VECTOR_SEARCH_ENABLED === "true";
    console.log(
      `[rag] OpenAI embeddings enabled${vectorOn ? " — Atlas vector search on" : " — keyword fallback (local MongoDB)"}`,
    );
    return;
  }
  console.warn(
    "[rag] OPENAI_API_KEY is not set — document embeddings disabled; search_startup_documents uses keyword fallback only",
  );
}
