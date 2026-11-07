
// 議事録の抽出（POST /api/minutes/extract）
// 画面（#57）から { content } を受けとり、Workflow で整理して、
// { summary3, decisions, undecided, todos } をそのまま返す（まだ保存しない）
import { NextResponse } from "next/server";

import { getCurrentUser } from "../../../../lib/current-user";

const MASTRA_URL = process.env.MASTRA_URL ?? "http://localhost:4111";

// Workflow（mastra/src/mastra/index.ts の workflows に登録した名前）
const WORKFLOW = "minutesExtractionWorkflow";

// 議事録の本文の上限（api.md：1〜10000文字）
const MAX_CONTENT_LENGTH = 10000;

export async function POST(request: Request) {
  try {
    // ① ログインとチームのメンバーかを確かめる（チャットと同じ部品）
    const auth = await getCurrentUser();
    if (auth.status === "not_member") {
      return NextResponse.json({ error: "利用権限がありません。" }, { status: 403 });
    }
    if (auth.status === "error") {
      return NextResponse.json({ error: "時間をおいてもう一度お試しください。" }, { status: 503 });
    }
    if (auth.status !== "ok") {
      return NextResponse.json(
        { error: "ログイン情報を確認できませんでした。再ログインしてください。" },
        { status: 401 }
      );
    }

    // ② 入力のチェック
    const body = await request.json().catch(() => null);
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    if (!content) {
      return NextResponse.json({ error: "議事録の本文を入力してください。" }, { status: 400 });
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: `議事録は${MAX_CONTENT_LENGTH}文字以内で入力してください。` },
        { status: 400 }
      );
    }

    // ③ Workflow の実行の番号（runId）をもらう
    const runResponse = await fetch(`${MASTRA_URL}/api/workflows/${WORKFLOW}/create-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
    });
    if (!runResponse.ok) {
      console.error("Workflow create-run error:", runResponse.status);
      return NextResponse.json({ error: "時間をおいてもう一度お試しください。" }, { status: 502 });
    }
    const { runId } = await runResponse.json();

    // ④ 議事録を渡して、終わるまで待って結果を受けとる
    const startResponse = await fetch(
      `${MASTRA_URL}/api/workflows/${WORKFLOW}/start-async?runId=${encodeURIComponent(runId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputData: { content } }),
        cache: "no-store",
      }
    );
    if (!startResponse.ok) {
      console.error("Workflow start-async error:", startResponse.status);
      return NextResponse.json({ error: "時間をおいてもう一度お試しください。" }, { status: 502 });
    }

    const run = await startResponse.json();

    // ⑤ Workflow が失敗した（形のチェックで止まった など）
    const result = run?.result;
    if (
      run?.status !== "success" ||
      !Array.isArray(result?.summary3) ||
      !Array.isArray(result?.decisions) ||
      !Array.isArray(result?.undecided) ||
      !Array.isArray(result?.todos)
    ) {
      console.error("Workflow failed:", run?.status, run?.error);
      return NextResponse.json(
        { error: "うまく整理できませんでした。もう一度お試しください。" },
        { status: 502 }
      );
    }

    // ⑥ ai-design.md の形のまま返す（包まない）
    return NextResponse.json({
      summary3: result.summary3,
      decisions: result.decisions,
      undecided: result.undecided,
      todos: result.todos,
    });
  } catch (error) {
    console.error("Minutes extract error:", error);
    return NextResponse.json({ error: "議事録の整理中にエラーが発生しました。" }, { status: 500 });
  }
}