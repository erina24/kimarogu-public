import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:8001";
const MASTRA_URL =
  process.env.MASTRA_URL ??
  process.env.MASTRA_API_URL ??
  "http://localhost:4111";

const RAG_ERROR =
  "議事録は保存されていますが、AI検索への登録に失敗しました。もう一度お試しください。";

export async function POST(request: Request) {
  try {
    const session = (await cookies()).get("session")?.value;

    if (!session) {
      return NextResponse.json(
        { error: "ログインしてください。" },
        { status: 401 }
      );
    }

    const authHeaders = { Cookie: `session=${session}` };

    // チームIDは必ず認証済みユーザーから取得する
    const authResponse = await fetch(`${API_URL}/api/auth/me`, {
      headers: authHeaders,
      cache: "no-store",
    });

    if (!authResponse.ok) {
      return NextResponse.json(
        { error: "ログイン情報を確認できませんでした。" },
        { status: 401 }
      );
    }

    const user = await authResponse.json();

    if (typeof user.team_id !== "string" || !user.team_id) {
      return NextResponse.json(
        { error: "チーム情報を取得できませんでした。" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, meeting_at, content, extraction } = body ?? {};

    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.trim().length > 100 ||
      typeof content !== "string" ||
      !content.trim() ||
      content.trim().length > 10000 ||
      typeof meeting_at !== "string" ||
      !/([+-]\d{2}:\d{2}|Z)$/.test(meeting_at) ||
      Number.isNaN(Date.parse(meeting_at)) ||
      !extraction ||
      typeof extraction !== "object" ||
      Array.isArray(extraction) ||
      !Array.isArray(extraction.summary3) ||
      !Array.isArray(extraction.decisions) ||
      !Array.isArray(extraction.undecided) ||
      !Array.isArray(extraction.todos)
    ) {
      return NextResponse.json(
        { error: "議事録の入力内容が不正です。" },
        { status: 400 }
      );
    }

    const headers = {
      ...authHeaders,
      "Content-Type": "application/json",
    };

    // ① 議事録本文の新規保存
    const createResponse = await fetch(`${API_URL}/api/minutes`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: title.trim(),
        meeting_at,
        content: content.trim(),
      }),
      cache: "no-store",
    });

    if (!createResponse.ok) {
      console.error("Minute creation failed:", createResponse.status);
      return NextResponse.json(
        { error: "議事録の保存に失敗しました。" },
        { status: 502 }
      );
    }

    const minute = await createResponse.json();
    const minuteId = minute.id;

    if (typeof minuteId !== "string" || !minuteId) {
      return NextResponse.json(
        { error: "保存された議事録のIDを取得できませんでした。" },
        { status: 502 }
      );
    }

    // ② AI抽出結果の確定保存
    let confirmResponse: Response;

    try {
      confirmResponse = await fetch(
        `${API_URL}/api/minutes/${encodeURIComponent(minuteId)}/confirm`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(extraction),
          cache: "no-store",
        }
      );
    } catch (error) {
      console.error("Minute confirmation request failed:", error);
      return NextResponse.json(
        {
          minuteId,
          ragStatus: "not_started",
          error: "議事録本文は保存されましたが、確定保存に失敗しました。",
        },
        { status: 502 }
      );
    }

    if (!confirmResponse.ok) {
      console.error("Minute confirmation failed:", confirmResponse.status);
      return NextResponse.json(
        {
          minuteId,
          ragStatus: "not_started",
          error: "議事録本文は保存されましたが、確定保存に失敗しました。",
        },
        { status: 502 }
      );
    }

    // ③ DB確定保存成功後だけRAGに登録
    const secret = process.env.RAG_INGEST_SECRET;

    if (!secret) {
      console.error("RAG_INGEST_SECRET is not configured");
      return NextResponse.json({
        minuteId,
        ragStatus: "failed",
        warning: RAG_ERROR,
      }, { status: 201 });
    }

    try {
      const ragResponse = await fetch(
        `${MASTRA_URL}/minutes-rag/ingest`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-rag-ingest-secret": secret,
          },
          body: JSON.stringify({
            minuteId,
            teamId: user.team_id,
            title: title.trim(),
            meetingAt: meeting_at,
            content: content.trim(),
          }),
          cache: "no-store",
        }
      );

      if (!ragResponse.ok) {
        console.error("RAG ingestion failed:", ragResponse.status);
        return NextResponse.json({
          minuteId,
          ragStatus: "failed",
          warning: RAG_ERROR,
        }, { status: 201 });
      }
    } catch (error) {
      console.error("RAG request failed:", error);
      return NextResponse.json({
        minuteId,
        ragStatus: "failed",
        warning: RAG_ERROR,
      }, { status: 201 });
    }

    return NextResponse.json({
      minuteId,
      ragStatus: "success",
    }, { status: 201 });

  } catch (error) {
    console.error("Minutes save route failed:", error);
    return NextResponse.json(
      { error: "議事録の保存処理でエラーが発生しました。" },
      { status: 500 }
    );
  }
}
