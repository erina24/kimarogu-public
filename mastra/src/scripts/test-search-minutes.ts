/**
 * 【議事録の検索のテスト】
 *
 * 実行方法（mastra フォルダで）
 *   node --env-file=.env src/scripts/test-search-minutes.ts
 *
 * 前提：テスト用の議事録（test-team-001）が、
 *       自分の DB の team_minutes に登録されていること
 *
 * 確かめること
 * ① test-team-001 で探すと、議事録が見つかる
 * ② 別のチームID で探すと、何も見つからない（データの分離）
 * ③ チームID が無いと、検索しないで「見つからない」を返す
 * ④ Agent に質問すると「PostgreSQL」と答える
 */

import { RequestContext } from "@mastra/core/request-context";

import { searchMinutesTool } from "../mastra/tools/search-minutes.ts";
import { chatAgent } from "../mastra/chat-agent.ts";

const QUESTION = "開発環境に使うデータベースは何？";

// 検索ツールが返す答えの形
type SearchOutput = {
  found: boolean;
  results: { title: string; date: string }[];
};

function contextFor(teamId?: string) {
  const requestContext = new RequestContext();
  if (teamId) requestContext.set("teamId", teamId);
  return requestContext;
}

// 検索ツールを呼ぶ（答えの形を SearchOutput としてあつかう）
async function search(teamId?: string) {
  return (await searchMinutesTool.execute!(
    { query: QUESTION },
    { requestContext: contextFor(teamId) } as any,
  )) as SearchOutput;
}

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? `：${detail}` : ""}`);
  if (!ok) failed++;
}

// ① 自分のチームで探す
const mine = await search("test-team-001");
check(
  "① test-team-001 で議事録が見つかる",
  mine.found === true,
  mine.results.map((r) => `${r.title}(${r.date})`).join(" / "),
);

// ② 別のチームで探す
const other = await search("other-team-999");
check("② 別のチームID では何も見つからない", other.found === false);

// ③ チームID なし（検索しないで「見つからない」を返す）
const none = await search();
check(
  "③ チームID が無いと検索しない",
  none.found === false && none.results.length === 0,
);

// ④ Agent に聞く
const result = await chatAgent.generate(QUESTION, {
  requestContext: contextFor("test-team-001"),
});
check(
  "④ Agent が PostgreSQL と答える",
  result.text.includes("PostgreSQL"),
  result.text.replace(/\s+/g, " ").slice(0, 120),
);

console.log(failed === 0 ? "\nすべて OK です" : `\n${failed} 件 NG です`);
process.exit(failed === 0 ? 0 : 1);