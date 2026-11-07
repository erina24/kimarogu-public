// 【目的】
// AIとの会話をPostgreSQLに保存し、
// 接続し直しても会話の内容が残っているか確認する。

import { randomUUID } from "node:crypto";
import { PostgresStore } from "@mastra/pg";

// DBへの接続情報を.envから読み込む
const connectionString = process.env.POSTGRES_CONNECTION_STRING;

if (!connectionString) {
  throw new Error("DBの接続情報が設定されていません");
}

// テスト専用の会話IDを作る
// 毎回違うIDにすることで、以前のテストと混ざらないようにする
const threadId = randomUUID();
const resourceId = "sec8-test-user";
const testMessage = "チーム開発ナビのメモリ保存テストです";

// PostgreSQLへの接続設定を共通化する
function createStore() {
  return new PostgresStore({
    id: "sec8-memory-test",
    connectionString: connectionString!,
    schemaName: "mastra_memory",
  });
}

async function main() {
  // ① PostgreSQLに接続する
  const store1 = createStore();
  await store1.init();

  const memory1 = await store1.getStore("memory");

  if (!memory1) {
    throw new Error("メモリの保存先が見つかりません");
  }

  // ② 会話の入れ物を保存する
  const now = new Date();

  await memory1.saveThread({
    thread: {
      id: threadId,
      resourceId,
      title: "メモリ保存テスト",
      createdAt: now,
      updatedAt: now,
    },
  });

  console.log("✅ 会話スレッドの保存成功");

  // ③ 実際の会話メッセージを保存する
  await memory1.saveMessages({
    messages: [
      {
        id: randomUUID(),
        threadId,
        resourceId,
        role: "user",
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            {
              type: "text",
              text: testMessage,
            },
          ],
        },
      },
    ],
  });

  console.log("✅ 会話メッセージの保存成功");

  // ④ 別の接続を作り、保存した会話を読み出す
  const store2 = createStore();
  await store2.init();

  const memory2 = await store2.getStore("memory");

  if (!memory2) {
    throw new Error("再接続後の保存先が見つかりません");
  }

  const savedThread = await memory2.getThreadById({
    threadId,
    resourceId,
  });

  if (!savedThread) {
    throw new Error("会話スレッドを読み出せませんでした");
  }

  // ⑤ 保存したメッセージの内容が一致するか確認する
  const result = await memory2.listMessages({
    threadId,
    resourceId,
  });

  const found = result.messages.some((message) =>
    message.content.parts.some(
      (part) => part.type === "text" && part.text === testMessage,
    ),
  );

  if (!found) {
    throw new Error("保存したメッセージが見つかりません");
  }

  console.log("✅ 別の接続から会話を読み出せました");
  console.log("🎉 メモリ保存・復元テスト成功！");
}

main().catch((error) => {
  console.error("❌ テスト失敗:", error);
  process.exitCode = 1;
});