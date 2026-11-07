import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:8001";
const MASTRA_URL = process.env.MASTRA_URL ?? process.env.MASTRA_API_URL ?? "http://localhost:4111";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ERROR = "AI検索への再登録に失敗しました。もう一度お試しください。";

export async function POST(request: Request) {
  try {
    const session = (await cookies()).get("session")?.value;
    if (!session) return NextResponse.json({ error: "ログインしてください。" }, { status: 401 });

    const body = await request.json().catch(() => null);
    const minuteId = typeof body?.minuteId === "string" ? body.minuteId.trim() : "";
    if (!UUID.test(minuteId)) {
      return NextResponse.json({ error: "議事録IDが不正です。" }, { status: 400 });
    }

    // FastAPIがセッション・所属・確定済み状態を確認する。
    // チームIDや本文はブラウザから受け取らない。
    const response = await fetch(`${API_URL}/api/minutes/${encodeURIComponent(minuteId)}`, {
      headers: { Cookie: `session=${session}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const messages: Record<number, string> = {
        401: "ログインしてください。",
        403: "利用権限がありません。",
        404: "再登録できる議事録が見つかりません。",
        409: "確定保存されていない議事録は再登録できません。",
      };
      const message = messages[response.status];
      return NextResponse.json({ error: message ?? ERROR }, { status: message ? response.status : 502 });
    }

    const minute = await response.json();
    if (
      typeof minute.id !== "string" || minute.id.toLowerCase() !== minuteId.toLowerCase() ||
      typeof minute.team_id !== "string" || !UUID.test(minute.team_id) ||
      typeof minute.title !== "string" || !minute.title.trim() ||
      typeof minute.content !== "string" || !minute.content.trim() ||
      typeof minute.meeting_at !== "string" ||
      !/([+-]\d{2}:\d{2}|Z)$/.test(minute.meeting_at) ||
      Number.isNaN(Date.parse(minute.meeting_at))
    ) {
      return NextResponse.json({ error: ERROR }, { status: 502 });
    }

    const secret = process.env.RAG_INGEST_SECRET;
    if (!secret) return NextResponse.json({ error: ERROR }, { status: 503 });

    // DBはUTCで返すため、日本時間の会議日に戻す（午前の会議の日付ずれを防ぐ）。
    const date = new Date(Date.parse(minute.meeting_at) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const rag = await fetch(`${MASTRA_URL}/minutes-rag/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-rag-ingest-secret": secret },
      body: JSON.stringify({
        minuteId: minute.id,
        teamId: minute.team_id,
        title: minute.title,
        meetingAt: date,
        content: minute.content,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(60000),
    });
    if (!rag.ok) return NextResponse.json({ error: ERROR }, { status: 502 });
    const result = await rag.json();
    if (result?.success !== true || result.minuteId !== minute.id) {
      return NextResponse.json({ error: ERROR }, { status: 502 });
    }
    return NextResponse.json({ minuteId: minute.id, ragStatus: "success" });
  } catch {
    // セッションや秘密鍵、本文をログ・レスポンスに出さない。
    return NextResponse.json({ error: ERROR }, { status: 502 });
  }
}
