import { ToolRegistry } from "./registry";
import {
  listStartupDocumentsTool,
  searchStartupDocumentsTool,
} from "./searchTools";
import { webSearchTool } from "./webSearchTool";
import {
  askKnowledgeTool,
  assetTimelineTool,
  coverageGapsTool,
  crossUnitTool,
  failureTwinsTool,
  getKnowledgeRiskTool,
  ghostExpertTool,
  healthScoreTool,
  loadDemoPlantTool,
  mentorshipTool,
  partsCascadeTool,
  quietKnowledgeTool,
  resolveJargonTool,
  shiftBriefTool,
  stalenessTool,
  successionPlanTool,
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

function registerEngramTools(reg: ToolRegistry): ToolRegistry {
  return reg
    .register(loadDemoPlantTool)
    .register(resolveJargonTool)
    .register(traverseGraphTool)
    .register(askKnowledgeTool)
    .register(getKnowledgeRiskTool)
    .register(successionPlanTool)
    .register(quietKnowledgeTool)
    .register(ghostExpertTool)
    .register(assetTimelineTool)
    .register(failureTwinsTool)
    .register(coverageGapsTool)
    .register(healthScoreTool)
    .register(shiftBriefTool)
    .register(partsCascadeTool)
    .register(mentorshipTool)
    .register(stalenessTool)
    .register(crossUnitTool)
    .register(listStartupDocumentsTool)
    .register(searchStartupDocumentsTool)
    .register(webSearchTool);
}

export const screenerRegistry = registerEngramTools(new ToolRegistry());
export const appToolRegistry = screenerRegistry;
export const assistantRegistry = registerEngramTools(new ToolRegistry());
