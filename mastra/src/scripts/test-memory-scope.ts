
/**
 * 【会話メモリの識別テスト】
 *
 * 同じユーザーなら同じIDになり、
 * 別ユーザー・別チームなら異なるIDになることを確認する。
 *
 * DBやAPIを使用しないため、APIキーは不要。
 */

import assert from "node:assert/strict";
import { createMemoryResourceId } from "../mastra/memory-scope.ts";

// ① 同じチーム・同じユーザー
const userA1 = createMemoryResourceId({
  teamId: "team-a",
  userId: "user-1",
});

const userA1Again = createMemoryResourceId({
  teamId: "team-a",
  userId: "user-1",
});

// ② 同じチーム・別ユーザー
const userA2 = createMemoryResourceId({
  teamId: "team-a",
  userId: "user-2",
});

// ③ 別チーム・同じユーザーID
const userB1 = createMemoryResourceId({
  teamId: "team-b",
  userId: "user-1",
});

// 同一人物の識別IDは変わらない
assert.equal(userA1, userA1Again);

// 別ユーザーの識別IDは混ざらない
assert.notEqual(userA1, userA2);

// 別チームの識別IDも混ざらない
assert.notEqual(userA1, userB1);

// IDが不足している場合は処理を止める
assert.throws(() =>
  createMemoryResourceId({
    teamId: "",
    userId: "user-1",
  }),
);

console.log("✅ 同じユーザーの識別：成功");
console.log("✅ 別ユーザーの識別：成功");
console.log("✅ 別チームの識別：成功");
console.log("✅ ID不足時のエラー：成功");
console.log("🎉 会話メモリの識別テスト成功！");
