/**
 * RAG登録に失敗した議事録を再登録するAPI呼び出し。
 *
 * DBへの議事録保存は繰り返さず、保存済みの議事録IDだけを送る。
 * サーバー側で認証・チーム所属を検証してから再登録する。
 *
 * 本文・チームIDは送らず、APIがDBから確定済みの議事録を取得する。
 */

const RETRY_API_PATH = "/api/minutes/rag-retry";

export async function retryMinuteRag(minuteId: string): Promise<void> {
  if (!minuteId.trim()) {
    throw new Error("議事録IDがありません");
  }

  const response = await fetch(RETRY_API_PATH, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ minuteId }),
  });

  if (!response.ok) {
    const errors: Record<number, string> = {
      401: "ログインし直してから、もう一度お試しください。",
      403: "利用権限がありません。",
      404: "再登録できる議事録が見つかりません。",
      409: "確定保存されていない議事録は再登録できません。",
    };
    throw new Error(errors[response.status] ?? "AI検索への再登録に失敗しました。もう一度お試しください。");
  }
}
