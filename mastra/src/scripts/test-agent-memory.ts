
import { randomUUID } from "node:crypto";
import { chatAgent } from "../mastra/chat-agent.ts";
import { createMemoryResourceId } from "../mastra/memory-scope.ts";
import { memoryStorage } from "../mastra/memory.ts";

async function main() {
  // 毎回新しいテストIDを作成する
  const threadId = randomUUID();

  const resourceId = createMemoryResourceId({
    teamId: "test-team-A",
    userId: "test-user-A",
  });

  const otherResourceId = createMemoryResourceId({
    teamId: "test-team-B",
    userId: "test-user-B",
  });

  // AIに記憶させる、毎回異なる確認用の合言葉
  const secret = `りんご-${randomUUID().slice(0, 8)}`;

  console.log("① AIに情報を伝えます");

  await chatAgent.generate(
    `テスト用の合言葉は「${secret}」です。覚えてください。`,
    {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    },
  );

  console.log("② 同じ会話で質問します");

  const response = await chatAgent.generate(
    "さっき伝えたテスト用の合言葉を答えてください。",
    {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    },
  );

  console.log("AIの回答:", response.text);

  if (!response.text.includes(secret)) {
    throw new Error("AIが前の会話を思い出せませんでした");
  }

  console.log("✅ AIの会話記憶テスト成功");

  // PostgreSQLから保存済みの会話を確認
  const store = await memoryStorage.getStore("memory");

  if (!store) {
    throw new Error("PostgreSQLのメモリ保存先が見つかりません");
  }

  const saved = await store.listMessages({
    threadId,
    resourceId,
  });

  const hasSecret = saved.messages.some((message) =>
    message.content.parts.some(
      (part) =>
        part.type === "text" && part.text.includes(secret),
    ),
  );

  if (!hasSecret) {
    throw new Error("PostgreSQLに会話が保存されていません");
  }

  console.log("✅ PostgreSQLへの会話保存確認成功");

  // 別ユーザーが同じthreadIdで読めないことを確認
  const otherThread = await store.getThreadById({
    threadId,
    resourceId: otherResourceId,
  });

  if (otherThread) {
    throw new Error("別ユーザーから会話が取得できてしまいました");
  }

  console.log("✅ 別ユーザーの履歴取得制限を確認");
  console.log("🎉 Agentメモリの基本テスト完了！");
}

main().catch((error) => {
  console.error("❌ テスト失敗:", error);
  process.exitCode = 1;
});
