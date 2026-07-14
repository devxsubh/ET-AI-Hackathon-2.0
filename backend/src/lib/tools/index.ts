import { ToolRegistry } from "./registry";
import {
  listStartupDocumentsTool,
  searchStartupDocumentsTool,
} from "./searchTools";
import { webSearchTool } from "./webSearchTool";
import {
  askKnowledgeTool,
  getKnowledgeRiskTool,
  loadDemoPlantTool,
  resolveJargonTool,
  traverseGraphTool,
} from "../engram/tools";

export { ToolRegistry } from "./registry";
export type { ToolDefinition } from "./registry";
export type {
  ToolContext,
  ToolExecutorResult,
  ToolDocumentResult,
  ToolActivity,
} from "./types";

export const screenerRegistry = new ToolRegistry()
  .register(loadDemoPlantTool)
  .register(resolveJargonTool)
  .register(traverseGraphTool)
  .register(askKnowledgeTool)
  .register(getKnowledgeRiskTool)
  .register(listStartupDocumentsTool)
  .register(searchStartupDocumentsTool)
  .register(webSearchTool);

export const appToolRegistry = screenerRegistry;

export const assistantRegistry = new ToolRegistry()
  .register(loadDemoPlantTool)
  .register(resolveJargonTool)
  .register(traverseGraphTool)
  .register(askKnowledgeTool)
  .register(getKnowledgeRiskTool)
  .register(listStartupDocumentsTool)
  .register(searchStartupDocumentsTool)
  .register(webSearchTool);
