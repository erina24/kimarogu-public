import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { extractMinutes } from "../minutes-extraction.ts";
import { minutesExtractionSchema } from "../schemas/minutes-extraction.ts";

const minutesInputSchema = z.object({
  content: z.string(),
});

const validatedMinutesInputSchema = z.object({
  content: z.string().min(1),
});

// Step 1: 議事録本文が空でないことを確認する
const validateMinutesInputStep = createStep({
  id: "validate-minutes-input",
  inputSchema: minutesInputSchema,
  outputSchema: validatedMinutesInputSchema,
  execute: async ({ inputData }) => {
    const content = inputData.content.trim();

    if (!content) {
      throw new Error("議事録本文が空です。");
    }

    return { content };
  },
});

// Step 2: 既存の抽出処理を呼び出す
const extractMinutesStep = createStep({
  id: "extract-minutes",
  inputSchema: validatedMinutesInputSchema,
  outputSchema: minutesExtractionSchema,
  execute: async ({ inputData }) => {
    return await extractMinutes(inputData.content);
  },
});

// Step 3: 抽出結果の形式と要約ルールを検証する
const validateExtractionOutputStep = createStep({
  id: "validate-extraction-output",
  inputSchema: minutesExtractionSchema,
  outputSchema: minutesExtractionSchema,
  execute: async ({ inputData }) => {
    const result = minutesExtractionSchema.safeParse(inputData);

    if (!result.success) {
      throw new Error(
        `抽出結果の形式が不正です: ${result.error.message}`,
      );
    }

    const output = result.data;

    if (
      output.decisions.length === 0 &&
      (
        output.summary3.length !== 1 ||
        output.summary3[0] !== "決まったことはありません"
      )
    ) {
      throw new Error(
        "決定事項が0件の場合、summary3は「決まったことはありません」の1行にしてください。",
      );
    }

    return output;
  },
});

export const minutesExtractionWorkflow = createWorkflow({
  id: "minutes-extraction-workflow",
  inputSchema: minutesInputSchema,
  outputSchema: minutesExtractionSchema,
})
  .then(validateMinutesInputStep)
  .then(extractMinutesStep)
  .then(validateExtractionOutputStep)
  .commit();
