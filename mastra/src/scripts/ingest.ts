// 自己紹介 PDF を読み込んで、PostgreSQL（pgvector）の本棚に並べるスクリプト
//
// 実行方法：mastra フォルダで `npm run ingest`（Docker を起動しておく）
// PDF を差し替えたときは、もう一度実行する（毎回本棚を作り直すので、同じ内容が重ならない）

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { MDocument } from "@mastra/rag";
import { extractText, getDocumentProxy } from "unpdf";
import {
  EMBEDDING_DIMENSION,
  INDEX_NAME,
  embedder,
  pgVector,
} from "../mastra/rag-config.ts";

// PDF を置いているフォルダ（npm run は mastra フォルダで動くので、mastra/docs になる）
const DOCS_DIR = path.resolve("docs");

/** PDF から文字だけを取り出す（画像になっている部分は読めない） */
async function readPdfText(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  // mergePages: true → 全ページの文字を1つの文章にまとめる
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

async function main() {
  // ① docs フォルダの PDF を探す
  const files = (await readdir(DOCS_DIR)).filter((file) =>
    file.toLowerCase().endsWith(".pdf"),
  );
  console.log(`PDF を ${files.length} 件見つけました:`, files);

  // ② PDF ごとに、文字を取り出して、小さなカードに分ける
  const texts: string[] = []; // 数字にする文章
  const metadata: { text: string; source: string }[] = []; // 本棚に一緒に保存するメモ

  for (const file of files) {
    const text = await readPdfText(path.join(DOCS_DIR, file));
    const doc = MDocument.fromText(text, { source: file });

    // recursive：段落 → 行 → … の順に、自然な切れ目で分ける
    // maxSize：1枚のカードの最大の文字数 ／ overlap：前後のカードと少し重ねる（話が途切れないように）
    const chunks = await doc.chunk({ strategy: "recursive", maxSize: 500, overlap: 50 });

    for (const chunk of chunks) {
      texts.push(chunk.text);
      // text：エージェントが答えるときに読む本文 ／ source：どの PDF から来たか
      metadata.push({ text: chunk.text, source: file });
    }
    console.log(`- ${file}: ${text.length} 文字 → ${chunks.length} 枚のカードに分けました`);
  }

  if (texts.length === 0) {
    throw new Error("文章が見つかりません。docs フォルダの PDF（文字が選べるか）を確認してください");
  }

  // ③ カードを数字（ベクトル）にする（OpenRouter に1回だけまとめて送る）
  const { embeddings } = await embedder.doEmbed({ values: texts });
  console.log(`${embeddings.length} 枚のカードを数字（ベクトル）にしました`);

  // ④ 本棚を作り直して、保存する
  try {
    // 前の本棚を消す（同じ内容が重ならないように）
    await pgVector.deleteIndex({ indexName: INDEX_NAME });
    console.log("前の本棚を消しました");
  } catch (error) {
    // 初めて実行するときは、消す本棚がないので、ここに来る
    console.log("（前の本棚はありませんでした）", (error as Error).message);
  }

  // 本棚を作る（mastra スキーマ・pgvector 拡張・テーブルは自動で作られる）
  await pgVector.createIndex({ indexName: INDEX_NAME, dimension: EMBEDDING_DIMENSION });
  await pgVector.upsert({ indexName: INDEX_NAME, vectors: embeddings, metadata });
  console.log(`本棚「${INDEX_NAME}」に ${embeddings.length} 枚のカードを保存しました 🎉`);

  // DB との接続を閉じる（閉じないとスクリプトが終わらない）
  await pgVector.disconnect();
}

// 失敗したら、理由を表示して終わる
main().catch(async (error) => {
  console.error("保存に失敗しました:", error);
  await pgVector.disconnect();
  process.exit(1);
});