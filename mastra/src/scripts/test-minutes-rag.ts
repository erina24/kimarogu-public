
/**
 * 【議事録RAG登録の動作確認】
 *
 * テスト用の架空の議事録を使って、
 * PostgreSQLのRAG専用領域に登録できるか確認する。
 *
 * 実際のチームの議事録や個人情報は使用しない。
 */

import { ingestMinute } from "../mastra/minutes-rag.ts";

// ① テスト専用の架空データを用意する
const testMinute = {
  minuteId: "test-minute-001",
  teamId: "test-team-001",
  title: "RAG動作確認用の会議",
  meetingAt: "2026-10-20T20:00:00+09:00",
  content:
    "今回の会議では、開発環境にPostgreSQLを使用することを決定しました。次回の会議で画面デザインを検討します。",
};

try {
  // ② 議事録をAI検索用データとして登録する
  const first = await ingestMinute(testMinute);

  console.log("✅ 初回登録成功");
  console.log("議事録ID:", first.minuteId);
  console.log("登録チャンク数:", first.chunkCount);

  // ③ 同じ議事録をもう一度登録する
  // 重複せずに古いデータを置き換えられるか確認する
  const second = await ingestMinute(testMinute);

  console.log("✅ 再登録成功");
  console.log("議事録ID:", second.minuteId);
  console.log("登録チャンク数:", second.chunkCount);

} catch (error) {
  // ④ エラーが発生した場合は理由を表示する
  // DB保存済みの議事録を削除する処理は行わない
  console.error("❌ RAG登録テスト失敗:", error);
  process.exitCode = 1;
}
