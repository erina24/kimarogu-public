
/**
 * 【会話メモリの分離テスト】
 *
 * PostgreSQLに架空の3人分の会話を保存し、
 * それぞれの会話が正しく読み出せるか確認する。
 *
 * テスト対象
 * ① 同じチームの別ユーザー
 * ② 別チームのユーザー
 * ③ 他人の会話を指定したときのアクセス制御
 *
 * 注意：
 * このテストでは架空データだけを使用する。
 * 保存したテストデータはPostgreSQLに残る。
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PostgresStore } from "@mastra/pg";
import { createMemoryResourceId } from "../mastra/memory-scope.ts";

// ① PostgreSQLへの接続情報を取得
const connectionString = process.env.POSTGRES_CONNECTION_STRING;

if (!connectionString) {
  throw new Error("POSTGRES_CONNECTION_STRING が未設定です");
}

// ② 今回だけのテスト用IDを作成
// 毎回ランダムにすることで、過去のテストと混ざらない
const testId = randomUUID();

const users = [
  {
    name: "チームA・ユーザー1",
    teamId: `team-a-${testId}`,
    userId: "user-1",
    message: "チームAのユーザー1の秘密のメモ",
  },
  {
    name: "チームA・ユーザー2",
    teamId: `team-a-${testId}`,
    userId: "user-2",
    message: "チームAのユーザー2の秘密のメモ",
  },
  {
    name: "チームB・ユーザー1",
    teamId: `team-b-${testId}`,
    userId: "user-1",
    message: "チームBのユーザー1の秘密のメモ",
  },
].map((user) => ({
  ...user,
  threadId: randomUUID(),
  resourceId: createMemoryResourceId(user),
}));

async function main() {
  // ③ Mastraが使用するメモリ保存先に接続
  const store = new PostgresStore({
    id: "sec8-memory-isolation-test",
    connectionString,
    schemaName: "mastra_memory",
  });

  await store.init();

  const memoryStore = await store.getStore("memory");

  if (!memoryStore) {
    throw new Error("メモリの保存先が見つかりません");
  }

  // ④ 3人分の会話をPostgreSQLへ保存
  for (const user of users) {
    const now = new Date();

    await memoryStore.saveThread({
      thread: {
        id: user.threadId,
        resourceId: user.resourceId,
        title: `${user.name}のテスト会話`,
        createdAt: now,
        updatedAt: now,
      },
    });

    await memoryStore.saveMessages({
      messages: [
        {
          id: randomUUID(),
          threadId: user.threadId,
          resourceId: user.resourceId,
          role: "user",
          createdAt: new Date(),
          content: {
            format: 2,
            parts: [{ type: "text", text: user.message }],
          },
        },
      ],
    });
  }

  console.log("✅ 3人分のテスト会話を保存しました");

  // ⑤ 各ユーザーの会話を読み出して内容を比較
  for (const user of users) {
    const result = await memoryStore.listMessages({
      threadId: user.threadId,
      resourceId: user.resourceId,
    });

    const texts = result.messages.flatMap((message) =>
      message.content.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text),
    );

    // 自分の会話が存在すること
    assert.ok(texts.includes(user.message), `${user.name}の履歴がありません`);

    // 他人の会話が混ざっていないこと
    for (const other of users) {
      if (other.resourceId !== user.resourceId) {
        assert.ok(
          !texts.includes(other.message),
          `${user.name}の履歴に別ユーザーの会話が混ざっています`,
        );
      }
    }

    console.log(`✅ ${user.name}：自分の会話だけを取得`);
  }

  // ⑥ 他人のthreadIdを指定した場合の動作を確認
  // これはDB保存層の検証であり、実際のログイン認証の代わりにはならない
  const otherUserThread = await memoryStore.getThreadById({
    threadId: users[0].threadId,
    resourceId: users[1].resourceId,
  });

  if (otherUserThread) {
    console.log(
      "⚠️ 保存層では他人のthreadIdを指定して取得できました。サーバー側の所有者確認が必須です。",
    );
  } else {
    console.log("✅ 別ユーザーのIDでは会話スレッドを取得できません");
  }

  console.log("🎉 会話の保存・読み出し分離テスト完了！");
  console.log("※ 本番のアクセス制御はAgent接続後に別途テストします");
}

main().catch((error) => {
  console.error("❌ 会話メモリ分離テスト失敗:", error);
  process.exitCode = 1;
});
