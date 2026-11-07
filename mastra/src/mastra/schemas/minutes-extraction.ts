
import { z } from "zod";

export const minutesExtractionSchema = z.object({
  summary3: z.array(z.string().trim().min(1).max(60)).min(1).max(3),
  decisions: z.array(
    z.object({
      content: z.string(),
      reason: z.string().nullable(),
      replaces: z.string().nullable(),
    }),
  ),
  undecided: z.array(z.string()),
  todos: z.array(
    z.object({
      task: z.string(),
      assignee: z.string().nullable(),
      due: z.string().nullable(),
    }),
  ),
});

export type MinutesExtraction = z.infer<typeof minutesExtractionSchema>;
