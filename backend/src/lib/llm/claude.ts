import Anthropic from "@anthropic-ai/sdk";

export type ChatMessage = { role: "user" | "assistant"; content: string };

function client(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY?.trim() ?? "";
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey: key });
}

// Single-shot completion — used for the explanation narrator in explain.ts
export async function completeClaudeText(params: {
  model: string;
  systemPrompt?: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  return chatWithClaude({
    model: params.model,
    systemPrompt: params.systemPrompt,
    messages: [{ role: "user", content: params.user }],
    maxTokens: params.maxTokens,
  });
}

// Multi-turn chat — caller owns the full message history and sends it each time
export async function chatWithClaude(params: {
  model: string;
  systemPrompt?: string;
  messages: ChatMessage[];
  maxTokens?: number;
}): Promise<string> {
  const anthropic = client();
  const resp = await anthropic.messages.create({
    model: params.model,
    max_tokens: params.maxTokens ?? 1024,
    system: params.systemPrompt,
    messages: params.messages as Anthropic.MessageParam[],
  });
  return resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}
