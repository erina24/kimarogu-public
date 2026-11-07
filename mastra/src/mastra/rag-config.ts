// RAG（PDF を探して答える仕組み）の共通設定
// PDF を保存するとき（scripts/ingest.ts）と、質問で探すとき（エージェント）で、
// 必ず同じ設定を使うため、ここ1か所にまとめている

import { ModelRouterEmbeddingModel } from "@mastra/core/llm";
import { PgVector } from "@mastra/pg";

// ===== 本棚（ベクトルの保存場所）の名前 =====

// PostgreSQL の中の「棚」の名前（スキーマ）
// Alembic が管理している public とは分けて、お互いのテーブルがぶつからないようにする
export const VECTOR_SCHEMA = "mastra";

// 本棚の名前（テーブル名になる）
export const INDEX_NAME = "profile_docs";

// text-embedding-3-small が作る数字の個数（1つの文章 → 1536個の数字）
export const EMBEDDING_DIMENSION = 1536;

// ===== 文章を数字（ベクトル）にするモデル =====

// 講座の API キーで使える「Text Embedding 3 Small」を、OpenRouter 経由で使う
// Mastra の標準の一覧に OpenRouter の埋め込みはないため、「カスタムの接続先」として指定する
export const embedder = new ModelRouterEmbeddingModel({
  providerId: "openrouter",
  modelId: "openai/text-embedding-3-small",
  url: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
});

// ===== PostgreSQL（pgvector）への接続 =====

// 接続先は .env の POSTGRES_CONNECTION_STRING（パスワードを含むので、コードに直接書かない）
export const pgVector = new PgVector({
  id: "pg-vector",
  connectionString: process.env.POSTGRES_CONNECTION_STRING ?? "",
  schemaName: VECTOR_SCHEMA,
});