import { timingSafeEqual } from "node:crypto";
import { registerApiRoute } from "@mastra/core/server";
import { ingestMinute, type MinuteForRag } from "./minutes-rag.ts";

export const minutesRagRoute = registerApiRoute("/minutes-rag/ingest", {
  method: "POST",
  requiresAuth: false,

  handler: async (c) => {
    // Next.jsサーバーからの呼び出しだけ許可する
    const secret = process.env.RAG_INGEST_SECRET;
    const provided = c.req.header("x-rag-ingest-secret") ?? "";

    if (!secret || !provided) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const expectedBytes = Buffer.from(secret);
    const providedBytes = Buffer.from(provided);

    if (
      expectedBytes.length !== providedBytes.length ||
      !timingSafeEqual(expectedBytes, providedBytes)
    ) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    let body: unknown;

    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return c.json({ error: "Invalid request" }, 400);
    }

    const data = body as Record<string, unknown>;
    const fields = ["minuteId", "teamId", "title", "meetingAt", "content"];

    if (
      fields.some(
        (key) => typeof data[key] !== "string" ||
          !(data[key] as string).trim()
      )
    ) {
      return c.json({ error: "議事録の必須項目が不足しています" }, 400);
    }

    const minute = data as MinuteForRag;

    try {
      const result = await ingestMinute(minute);
      return c.json(result, 200);
    } catch (error) {
      console.error("RAG ingestion failed:", error);

      if (
        error instanceof Error &&
        error.message.startsWith("RAG_VALIDATION_ERROR")
      ) {
        return c.json({ error: "議事録の入力内容が不正です" }, 400);
      }

      return c.json({ error: "RAG登録に失敗しました" }, 500);
    }
  },
});
