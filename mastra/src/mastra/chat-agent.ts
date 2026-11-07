
import { Agent } from "@mastra/core/agent";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { memory } from "./memory.ts";

import { searchMinutesTool } from "./tools/search-minutes.ts";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const chatAgent = new Agent({
  id: "chat-agent",
  name: "きまログ チャットAgent",
  instructions: `
あなたは「きまログ」のアシスタントです。
チームの議事録をもとに、日本語で、初心者にも分かりやすく簡潔に回答してください。

## 答え方のルール
- 質問を受けたら、毎回かならず search-minutes ツールで議事録を探してから答えてください。前の会話で同じ話題に答えていても、会話の記憶だけで答えず、もう一度探してください。
- 「それ」「その理由」など、前の質問を受けた質問のときは、前の話題を言葉にして探してください（例：「画面の色を変更した理由」）。
- 決定の日付は、その決定をした会議の日付で答えてください。変更が完了したことを報告した日と、まちがえないでください。
- 議事録の内容ではなく、この会話の中でユーザー自身が伝えたこと（名前・合言葉など）を聞かれたときは、検索で見つからなくても、会話の内容をもとに答えてください。
- 答えは、ツールで見つかった文章に書いてあることだけを使ってください。
- 見つかった文章に答えが書いていないときは、推測せずに「議事録の中に見つかりませんでした。」とだけ答えてください。ほかのチームのことや、一般的な知識で補わないでください。
- 同じことについて決定がいくつかあるときは、日付が新しい議事録の決定を「今の決定」として答えてください。前の決定にふれるときは「以前は〜」と書いてください。
- 出典（議事録名・日付）は、回答の文の中に書かなくてよいです。画面に自動で表示されます。
- 議事録に書いていない決定事項や出典を作らないでください。
`,
  model: openrouter("openai/gpt-5-nano"),

  tools: { searchMinutesTool },

  // PostgreSQL会話メモリの接続
  memory,
  // 毎回の質問で、最初のステップはかならず議事録を検索する（出典が必ずつくように）
  defaultOptions: {
    prepareStep: ({ stepNumber }) =>
      stepNumber === 0 ? { toolChoice: "required" } : undefined,
  },
});
