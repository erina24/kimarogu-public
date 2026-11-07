import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { getCurrentUser } from "../../../lib/current-user";

const MASTRA_URL = process.env.MASTRA_URL ?? "http://localhost:4111";

// Agent が「見つからない」ときに答える文（chat-agent.ts の指示と同じ文）
const NOT_FOUND_TEXT = "議事録の中に見つかりませんでした";

type Source = { minuteId: string; title: string; date: string };

// Mastra の答えの中から、検索 Tool が返した議事録（出典のもと）を集める
// 出典は AI に書かせず、検索結果からコードで作る（仕様どおり）
function collectSources(node: unknown, out: Source[], depth = 0) {
  if (depth > 12 || node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectSources(item, out, depth + 1);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (Array.isArray(obj.results)) {
    for (const r of obj.results as Record<string, unknown>[]) {
      if (
        r &&
        typeof r.minuteId === "string" &&
        typeof r.title === "string" &&
        typeof r.date === "string"
      ) {
        out.push({ minuteId: r.minuteId, title: r.title, date: r.date });
      }
    }
  }
  for (const value of Object.values(obj)) collectSources(value, out, depth + 1);
}

export async function POST(request: Request) {
  try {
    const { question } = await request.json();

    if (typeof question !== "string" || !question.trim()) {
      return NextResponse.json({ error: "質問を入力してください。" }, { status: 400 });
    }
    if (question.trim().length > 500) {
      return NextResponse.json(
        { error: "質問は500文字以内で入力してください。" },
        { status: 400 }
      );
    }

    // ログインとチームのメンバーかを確かめる（画面の page.tsx と同じ部品）
    const auth = await getCurrentUser();
    if (auth.status === "not_member") {
      return NextResponse.json({ error: "利用権限がありません。" }, { status: 403 });
    }
    if (auth.status === "error") {
      // FastAPI につながらない など（再ログインしても直らないので 401 と分ける）
      return NextResponse.json({ error: "時間をおいてもう一度お試しください。" }, { status: 503 });
    }
    if (auth.status !== "ok") {
      return NextResponse.json(
        { error: "ログイン情報を確認できませんでした。再ログインしてください。" },
        { status: 401 }
      );
    }

    // 会話メモリの「だれの会話か」（createMemoryResourceId と同じ形）
    const resource = `team-user:${JSON.stringify([auth.user.team_id, auth.user.id])}`;
    const thread = `chat-${createHash("sha256").update(resource).digest("hex")}`;

    const response = await fetch(`${MASTRA_URL}/api/agents/chat-agent/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: question.trim() }],
        // 検索は、ログインしている人のチームの議事録だけ
        requestContext: { teamId: auth.user.team_id },
        memory: { resource, thread },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Mastra API error:", response.status);
      return NextResponse.json({ error: "AIへの問い合わせに失敗しました。" }, { status: 502 });
    }

    const result = await response.json();
    const answer = String(result.text ?? "").trim();

    // 出典：今回の質問で検索した結果だけから作る
    const collected: Source[] = [];
    collectSources([result.toolResults, result.steps], collected);
    const unique = [...new Map(collected.map((s) => [s.minuteId, s])).values()].sort((a, b) =>
      b.date.localeCompare(a.date)
    );

    const found = unique.length > 0 && answer !== "" && !answer.includes(NOT_FOUND_TEXT);

    if (unique.length === 0 && answer && !answer.includes(NOT_FOUND_TEXT)) {
      // 検索しないで答えたとき、または出典を取り出せなかったとき（原因調査用。画面には出さない）
      console.warn("出典なしの答えです。Mastra の答えの項目:", Object.keys(result));
    }

    return NextResponse.json({
      answer: answer || `${NOT_FOUND_TEXT}。`,
      found,
      sources: found ? unique.map(({ title, date }) => ({ title, date })) : [],
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "チャット処理中にエラーが発生しました。" }, { status: 500 });
  }
}