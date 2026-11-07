import { Memory } from "@mastra/memory";
import { PostgresStore } from "@mastra/pg";

const connectionString = process.env.POSTGRES_CONNECTION_STRING;

if (!connectionString) {
  throw new Error("POSTGRES_CONNECTION_STRING が未設定です");
}

export const memoryStorage = new PostgresStore({
  id: "sec8-memory-storage",
  connectionString,
  schemaName: "mastra_memory",
});

// AIが会話の流れを把握できるよう、直近20メッセージを参照する
// PostgreSQLに保存する履歴の件数を20件に制限するわけではない
export const memory = new Memory({
  storage: memoryStorage,
  options: {
    lastMessages: 20,
  },
});