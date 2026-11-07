
import { Agent } from "@mastra/core/agent";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  minutesExtractionSchema,
  type MinutesExtraction,
} from "./schemas/minutes-extraction.ts";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const minutesExtractionAgent = new Agent({
  id: "minutes-extraction-agent",
  name: "議事録抽出Agent",
  instructions: `
あなたは議事録から情報を抽出するアシスタントです。

次のルールを必ず守ってください。
- 議事録に明記された情報だけを抽出する。推測で補わない。
- 日本語で簡潔に出力する。
- summary3は要点を最大3件、各60文字以内で出力する。
- 決定事項がない場合、summary3は
  ["決まったことはありません"] とする。
- 決定事項が4件以上ある場合も、decisionsにはすべて含める。
  summary3には重要なものを最大3件だけ含める。
- decisionsのcontentには決定内容を入れる。
- reasonは理由が明記されていなければnullにする。
- replacesは既存の決定を置き換えることが明記されていなければnullにする。
- undecidedには未決定事項だけを入れる。
- todosには具体的なタスクだけを入れる。
- assigneeは担当者が明記されていなければnullにする。
- dueは期限が年月日まで特定できる場合、YYYY-MM-DD形式で出力する。
- 年月日を特定できない場合はnullにする。推測で補わない。
- 該当する決定事項、未決定事項、ToDoがなければ空配列にする。
`,
  model: openrouter("openai/gpt-5-nano"),
});

export async function extractMinutes(
  content: string,
): Promise<MinutesExtraction> {
  if (!content.trim()) {
    throw new Error("議事録本文が空です");
  }

  const result = await minutesExtractionAgent.generate(
    [
      {
        role: "user",
        content: `次の議事録から情報を抽出してください。

--- 議事録 ---
${content}
--- 議事録ここまで ---`,
      },
    ],
    {
      structuredOutput: {
        schema: minutesExtractionSchema,
      },
    },
  );

  return result.object;
}
