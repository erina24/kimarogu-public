/**
 * 【続けて質問しても出典が出るかのテスト】
 *
 * 実行方法（mastra フォルダで）
 *   node --env-file=.env src/scripts/test-followup-sources.ts
 *
  * 前提：テスト用の議事録（test-team-001）が、
 *       自分の DB の team_minutes に登録されていること
 *
 * 確かめること
 * 同じ会話の中で続けて質問しても、毎回 議事録を検索して、出典がつくこと
 * （会話の記憶だけで答えて、出典が消えないこと）
 */

import { randomUUID } from "node:crypto";
import { RequestContext } from "@mastra/core/request-context";

import { chatAgent } from "../mastra/chat-agent.ts";
import { createMemoryResourceId } from "../mastra/memory-scope.ts";

const TEAM_ID = "test-team-001";
const USER_ID = "test-user-followup";

// 同じ会話（スレッド）で続けて聞く質問
const QUESTIONS = [
  "開発環境に使うデータベースは何？",
  "それはいつ決まった？",
  "次の会議では何をする？",
  "それはどの会議で決まった？",
];

const requestContext = new RequestContext();
requestContext.set("teamId", TEAM_ID);

const memoryOption = {
  resource: createMemoryResourceId({ teamId: TEAM_ID, userId: USER_ID }),
  thread: randomUUID(), // 毎回 新しい会話にする
};

let failed = 0;

for (const [i, question] of QUESTIONS.entries()) {
  const result = await chatAgent.generate(question, {
    requestContext,
    memory: memoryOption,
  });

  // 画面（/api/chat）と同じように、検索結果に minuteId があれば「出典あり」
  const hasSources = JSON.stringify([result.toolResults, result.steps]).includes(
    "minuteId",
  );

  console.log(
    `${hasSources ? "✅" : "❌"} 質問${i + 1}「${question}」出典${hasSources ? "あり" : "なし"}`,
  );
  console.log(`   答え：${result.text.replace(/\s+/g, " ").slice(0, 100)}`);

  if (!hasSources) failed++;
}

console.log(
  failed === 0 ? "\nすべて OK です" : `\n${failed} 件 出典が出ませんでした`,
);
process.exit(failed === 0 ? 0 : 1);