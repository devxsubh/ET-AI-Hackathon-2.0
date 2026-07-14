import Anthropic from "@anthropic-ai/sdk";
import type { ToolActivity, ToolDocumentResult } from "../chat/chatTools";

function client(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY?.trim() ?? "";
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey: key });
}

function truncate(s: string, max = 120): string {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length <= max ? one : `${one.slice(0, max)}…`;
}

export type SseWrite = (line: string) => void;

export async function runAgentStream(params: {
  model: string;
  systemPrompt: string;
  messages: Anthropic.MessageParam[];
  tools: Anthropic.Tool[];
  executeTool: (
    name: string,
    input: unknown,
  ) => Promise<{ content: string; document?: ToolDocumentResult }>;
  write: SseWrite;
  maxTokens?: number;
  maxRounds?: number;
  /** Force a specific tool on round 0 only. Subsequent rounds always use auto. */
  toolChoice?: Anthropic.ToolChoiceAuto | Anthropic.ToolChoiceAny | Anthropic.ToolChoiceTool;
}): Promise<{ fullText: string; toolActivity: ToolActivity[] }> {
  const anthropic = client();
  const toolActivity: ToolActivity[] = [];
  const messages = [...params.messages];
  const maxRounds = params.maxRounds ?? 8;
  let fullText = "";

  for (let round = 0; round < maxRounds; round++) {
    const stream = anthropic.messages.stream({
      model: params.model,
      max_tokens: params.maxTokens ?? 2048,
      system: params.systemPrompt,
      tools: params.tools,
      messages,
      ...(round === 0 && params.toolChoice ? { tool_choice: params.toolChoice } : {}),
    });

    let roundText = "";
    const announcedTools = new Set<string>();

    for await (const event of stream) {
      if (event.type === "content_block_start") {
        if (event.content_block.type === "tool_use") {
          const name = event.content_block.name;
          if (!announcedTools.has(name)) {
            announcedTools.add(name);
            params.write(
              `data: ${JSON.stringify({
                type: "tool_call_start",
                name,
              })}\n\n`,
            );
          }
        }
      }

      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        const text = event.delta.text;
        roundText += text;
        fullText += text;
        params.write(
          `data: ${JSON.stringify({ type: "content_delta", text })}\n\n`,
        );
      }
    }

    const finalMessage = await stream.finalMessage();
    const stopReason = finalMessage.stop_reason;
    const toolUses = finalMessage.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (stopReason === "end_turn" || stopReason === "max_tokens") {
      params.write(`data: ${JSON.stringify({ type: "content_done" })}\n\n`);
      return { fullText, toolActivity };
    }

    if (stopReason !== "tool_use" || toolUses.length === 0) {
      params.write(`data: ${JSON.stringify({ type: "content_done" })}\n\n`);
      return { fullText, toolActivity };
    }

    messages.push({ role: "assistant", content: finalMessage.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUses) {
      toolActivity.push({ name: block.name, status: "running" });
      const { content, document } = await params.executeTool(
        block.name,
        block.input,
      );
      const idx = toolActivity.length - 1;
      toolActivity[idx] = {
        name: block.name,
        status: "done",
        summary: truncate(content),
      };
      if (document) {
        params.write(
          `data: ${JSON.stringify({ type: "document_created", document })}\n\n`,
        );
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  const fallback =
    "I hit the tool-call limit for this turn. Please try a simpler question.";
  fullText += fallback;
  params.write(
    `data: ${JSON.stringify({ type: "content_delta", text: fallback })}\n\n`,
  );
  params.write(`data: ${JSON.stringify({ type: "content_done" })}\n\n`);
  return { fullText, toolActivity };
}
