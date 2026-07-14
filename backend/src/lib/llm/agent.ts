import Anthropic from "@anthropic-ai/sdk";
import type { ToolActivity } from "../chat/chatTools";

function client(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY?.trim() ?? "";
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey: key });
}

function truncate(s: string, max = 120): string {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length <= max ? one : `${one.slice(0, max)}…`;
}

export async function runAgentWithTools(params: {
  model: string;
  systemPrompt: string;
  messages: Anthropic.MessageParam[];
  tools: Anthropic.Tool[];
  executeTool: (
    name: string,
    input: unknown,
  ) => Promise<{ content: string }>;
  maxTokens?: number;
  maxRounds?: number;
}): Promise<{ text: string; toolActivity: ToolActivity[] }> {
  const anthropic = client();
  const toolActivity: ToolActivity[] = [];
  const messages = [...params.messages];
  const maxRounds = params.maxRounds ?? 8;

  for (let round = 0; round < maxRounds; round++) {
    const resp = await anthropic.messages.create({
      model: params.model,
      max_tokens: params.maxTokens ?? 2048,
      system: params.systemPrompt,
      tools: params.tools,
      messages,
    });

    const textBlocks = resp.content.filter(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    const text = textBlocks.map((b) => b.text).join("");

    if (resp.stop_reason === "end_turn" || resp.stop_reason === "max_tokens") {
      return { text, toolActivity };
    }

    if (resp.stop_reason !== "tool_use") {
      return { text, toolActivity };
    }

    messages.push({ role: "assistant", content: resp.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of resp.content) {
      if (block.type !== "tool_use") continue;

      toolActivity.push({ name: block.name, status: "running" });
      const { content } = await params.executeTool(block.name, block.input);
      const idx = toolActivity.length - 1;
      toolActivity[idx] = {
        name: block.name,
        status: "done",
        summary: truncate(content),
      };

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  return {
    text: "I hit the tool-call limit for this turn. Please try a simpler question.",
    toolActivity,
  };
}
