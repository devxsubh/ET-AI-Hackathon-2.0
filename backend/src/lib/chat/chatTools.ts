// Backward-compatibility shim — all logic now lives in lib/tools/.
// Callers outside routes/ that import from here continue to work unchanged.
export type {
  ToolActivity,
  ToolDocumentResult,
  ToolExecutorResult,
  ToolContext,
} from "../tools/types";

export { appToolRegistry } from "../tools";

import { appToolRegistry } from "../tools";
import type { ToolContext } from "../tools/types";

export const SCREENER_TOOLS = appToolRegistry.getTools();
export const WORKFLOW_TOOLS = appToolRegistry.getTools(); // superset — routes use getTools() now
export const ASSISTANT_TOOLS = appToolRegistry.getTools();

export function createToolExecutor(ctx: ToolContext) {
  return appToolRegistry.createExecutor(ctx);
}
