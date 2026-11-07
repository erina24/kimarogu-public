/**
 * 【議事録をさがす道具（Tool）】
 *
 * minutes-rag.ts で登録した本棚（team_minutes）から、
 * 質問に関係する議事録の部分を探す。
 *
 * 大事なルール
 * ・チームID は AI に決めさせない。
 *   サーバー側で入れた requestContext の "teamId" だけを使う。
 * ・チームID が無いときは、検索しないで「見つからない」を返す。
 *   （全チームの議事録を探してしまわないため）
 */

import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { embedder, pgVector } from "../rag-config.ts";
import { MINUTES_INDEX_NAME } from "../minutes-rag.ts";

export const SEARCH_TOP_K = 5;

const searchResultSchema = z.object({
  minuteId: z.string(),
  title: z.string(),
  date: z.string(),
  text: z.string(),
  score: z.number(),
});

export type MinuteSearchResult = z.infer<typeof searchResultSchema>;

export const searchMinutesTool = createTool({
  id: "search-minutes",
  description:
    "自分のチームの議事録から、質問に関係する部分を探します。" +
    "決まったこと・ToDo・理由など、議事録に書いてある内容を答えるときは必ず使ってください。",

  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .max(500)
      .describe("議事録から探したい内容（例：開発環境に使うデータベース）"),
  }),

  outputSchema: z.object({
    found: z.boolean(),
    results: z.array(searchResultSchema),
  }),

  execute: async (input, context) => {
    // ① チームID を、サーバー側で入れた値から取る
    const rawTeamId = context?.requestContext?.get("teamId");
    const teamId = typeof rawTeamId === "string" ? rawTeamId.trim() : "";

    if (!teamId) {
      // チームID が無いときは、検索しない（全チームを探してしまわないため）
      // エラーにすると、チームID を渡さないテストや Studio が止まるので、「見つからない」を返す
      console.warn("SEARCH_SCOPE: チームIDがないため検索しませんでした");
      return { found: false, results: [] };
    }

    // ② 質問を数字（ベクトル）にする
    const { embeddings } = await embedder.doEmbed({
      values: [input.query],
    });

    // ③ 自分のチームの議事録だけを探す
    const hits = await pgVector.query({
      indexName: MINUTES_INDEX_NAME,
      queryVector: embeddings[0],
      topK: SEARCH_TOP_K,
      filter: { teamId },
    });

    // ④ 念のため、もう一度チームID を確かめてから形をそろえる
    const results: MinuteSearchResult[] = hits
      .filter((hit) => hit.metadata?.teamId === teamId)
      .map((hit) => ({
        minuteId: String(hit.metadata?.minuteId ?? ""),
        title: String(hit.metadata?.title ?? ""),
        date: String(hit.metadata?.meetingAt ?? ""),
        text: String(hit.metadata?.text ?? ""),
        score: hit.score,
      }))
      // ⑤ 日付が新しい議事録を先にする
      .sort((a, b) => b.date.localeCompare(a.date));

    return {
      found: results.length > 0,
      results,
    };
  },
});