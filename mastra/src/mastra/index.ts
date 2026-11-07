import { Mastra } from "@mastra/core";
import { chatAgent } from "./chat-agent.ts";
import { minutesExtractionAgent } from "./minutes-extraction.ts";
import { minutesExtractionWorkflow } from "./workflows/minutes-extraction-workflow.ts";
import { minutesRagRoute } from "./minutes-rag-route.ts";

export const mastra = new Mastra({
  server: {
    apiRoutes: [minutesRagRoute],
  },
  agents: {
    chatAgent,
    minutesExtractionAgent,
  },
  workflows: {
    minutesExtractionWorkflow,
  },
});
