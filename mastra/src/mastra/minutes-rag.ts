/**
 * 【議事録をAI検索用に登録する機能】
 *
 * 通常のDBに保存された議事録を、AIが検索できる形に変換して保存する。
 *
 * 処理の流れ
 * ① 議事録の入力内容を確認する
 * ② 議事録を短い文章（チャンク）に分ける
 * ③ 文章をAI検索用の数値データ（ベクトル）に変換する
 * ④ 会議名・日付などの出典情報を付ける
 * ⑤ PostgreSQLのRAG専用領域に保存する
 *
 * 同じ議事録を再登録した場合は、古い検索データを新しい内容に置き換える。
 */

import { MDocument } from "@mastra/rag";

// チームで共通使用しているRAG設定
// AIモデルやPostgreSQLへの接続設定をここから読み込む
import {
  EMBEDDING_DIMENSION,
  embedder,
  pgVector,
} from "./rag-config.ts";

// 議事録専用の保存先
// PDFなど、他のRAGデータとは区別して管理する
export const MINUTES_INDEX_NAME = "team_minutes";

/**
 * 【登録する議事録のデータ形式】
 *
 * FastAPIで議事録の保存が成功した後、
 * Next.js側からMastraへ渡される情報。
 */
export type MinuteForRag = {
  minuteId: string;  // 議事録ID
  teamId: string;    // 所属チームID
  title: string;     // 会議タイトル
  meetingAt: string; // 会議日時
  content: string;   // 議事録本文
};

/**
 * 【議事録をRAGに登録する関数】
 *
 * 成功した場合：議事録IDと登録した文章数を返す
 * 失敗した場合：エラーを投げ、呼び出し元に知らせる
 */
export async function ingestMinute(minute: MinuteForRag) {

  // --------------------------------------------------
  // ① 必須項目が揃っているか確認する
  // --------------------------------------------------

  // ID・タイトル・日時・本文などが空なら登録しない
  // trim() は文字列の前後にある空白を取り除く処理
  if (
    !minute.minuteId?.trim() ||
    !minute.teamId?.trim() ||
    !minute.title?.trim() ||
    !minute.meetingAt?.trim() ||
    !minute.content?.trim()
  ) {
    throw new Error(
      "RAG_VALIDATION_ERROR: 議事録の必須情報が不足しています"
    );
  }

  // --------------------------------------------------
  // ② 会議日時をRAG用の日付形式に変換する
  // --------------------------------------------------

  // 通常DBでは日時を保存するが、
  // RAGでは YYYY-MM-DD（年月日）だけを使用する
  // 例：2026-10-20T20:00:00+09:00 → 2026-10-20
  const meetingDate = minute.meetingAt.slice(0, 10);

  // 日付の形式を確認する
  // 不正な値を登録しないためのチェック
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(meetingDate) ||
    !Number.isFinite(Date.parse(`${meetingDate}T00:00:00Z`))
  ) {
    throw new Error(
      "RAG_VALIDATION_ERROR: 会議日時の形式が不正です"
    );
  }

  // --------------------------------------------------
  // ③ 議事録を短い文章に分割する
  // --------------------------------------------------

  // 長い文章をそのまま検索するより、
  // 短く分割したほうが関連情報を探しやすくなる
  const doc = MDocument.fromText(minute.content);

  const chunks = await doc.chunk({
    strategy: "recursive", // 文章の区切りを考慮して分割
    maxSize: 500,          // 1つの文章の最大サイズ
    overlap: 50,           // 前後の文章を少し重複させる
  });

  // 登録対象の文章がなければエラーにする
  if (chunks.length === 0) {
    throw new Error(
      "RAG_VALIDATION_ERROR: 登録する本文がありません"
    );
  }

  // --------------------------------------------------
  // ④ 文章をAI検索用の数値データに変換する
  // --------------------------------------------------

  // この処理を「Embedding（埋め込み）」と呼ぶ
  // 文章の意味の近さを数値で比較できるようにする
  const { embeddings } = await embedder.doEmbed({
    values: chunks.map((chunk) => chunk.text),
  });

  // --------------------------------------------------
  // ⑤ 検索結果に表示する出典情報を付ける
  // --------------------------------------------------

  // AIが回答するときに、
  // 「どのチームの、いつの会議の情報か」を示すための情報
  const metadata = chunks.map((chunk, index) => ({
    minuteId: minute.minuteId,
    teamId: minute.teamId,
    title: minute.title,
    meetingAt: meetingDate,
    chunkIndex: index, // 分割した文章の順番
    text: chunk.text,  // 検索対象の文章
  }));

  // --------------------------------------------------
  // ⑥ 議事録専用の保存先を用意する
  // --------------------------------------------------

  // 保存先がすでに存在するか確認する
  const indexes = await pgVector.listIndexes();

  // 存在しない場合だけ新しく作成する
  if (!indexes.includes(MINUTES_INDEX_NAME)) {
    await pgVector.createIndex({
      indexName: MINUTES_INDEX_NAME,
      dimension: EMBEDDING_DIMENSION,
    });
  }

  // --------------------------------------------------
  // ⑦ PostgreSQLに検索データを保存する
  // --------------------------------------------------

  // upsert() は検索用データを登録する処理
  //
  // deleteFilter は、同じ議事録の古いデータを指定する条件
  // 今回のMastraでは削除と登録を1つのDB処理として実行できる
  //
  // これにより、同じ議事録を再登録しても、
  // 古い文章が重複して検索されることを防ぐ
  await pgVector.upsert({
    indexName: MINUTES_INDEX_NAME,
    vectors: embeddings,
    metadata,
    deleteFilter: {
      minuteId: minute.minuteId,
      teamId: minute.teamId,
    },
  });

  // --------------------------------------------------
  // ⑧ 登録結果を返す
  // --------------------------------------------------

  // 実際の登録が成功した場合だけ、この結果を返す
  return {
    success: true,
    minuteId: minute.minuteId,
    chunkCount: chunks.length,
  };
}
