# システム設計図(きまログ)


## 全体のしくみ

```mermaid
flowchart LR
  U[メンバー<br>ブラウザ] --> FE[Next.js 16<br>画面+Route Handler]
  FE -->|Google ログイン| AUTH[Firebase<br>Authentication]
  FE -->|session Cookie を転送| API[FastAPI<br>8001]
  FE -->|抽出・チャット・RAG 登録| M[Mastra<br>4111]
  API --> DB[(PostgreSQL 5435<br>+ pgvector)]
  M -->|会話メモリ| DB
  M -->|本棚 team_minutes| DB
  M --> LLM[OpenRouter<br>gpt-5-nano<br>text-embedding-3-small]
  API -->|session Cookie の確認| AUTH
```

- **案B**:AI は Next.js のサーバーから Mastra を呼ぶ/業務データ(議事録・決定事項・ToDo)の保存と一覧は Next.js → FastAPI
- チームID・ユーザーID は、画面から受け取らず、サーバー側で `/api/auth/me` から決める

## 使う技術
| 層 | 技術 |
|---|---|
| 画面 | Next.js 16(App Router・Tailwind CSS v4) |
| API | FastAPI(SQLAlchemy・Alembic) |
| AI | Mastra(Agent・Workflow・Tool・メモリ・RAG) |
| DB | PostgreSQL 18 + pgvector(Docker・sec8-db) |
| 認証 | Firebase Authentication(Google ログイン)+ session Cookie |
| LLM | OpenRouter 経由:チャット・抽出 `openai/gpt-5-nano`/埋め込み `openai/text-embedding-3-small` |

## 機能ごとの流れ

### 機能① 議事録 → 決まったこと3行・ToDo(/minutes)
```mermaid
sequenceDiagram
  participant 画面 as 画面 /minutes
  participant N as Next.js
  participant M as Mastra
  participant F as FastAPI
  画面->>N: POST /api/minutes/extract {content}
  N->>F: /api/auth/me(ログイン・所属の確認)
  N->>M: Workflow minutes-extraction-workflow
  Note over M: ① 入力の確認 → ② 抽出 Agent → ③ 形のチェック
  M-->>画面: {summary3, decisions, undecided, todos}
  Note over 画面: 人が確認・直す
  画面->>N: POST /api/minutes/save
  N->>F: POST /api/minutes(本文)
  N->>F: POST /api/minutes/{id}/confirm(3行・決定・未決・ToDo・以前と履歴)
  N->>M: POST /minutes-rag/ingest(合言葉つき)
  N-->>画面: {minuteId, ragStatus}
```
- RAG 登録だけ失敗したときは「再試行」ボタン(`POST /api/minutes/rag-retry` → FastAPI `GET /api/minutes/{id}` → Mastra)

### 機能② 根拠つき AI チャット(/)
```mermaid
sequenceDiagram
  participant 画面 as 画面 /
  participant N as Next.js
  participant M as Mastra
  画面->>N: POST /api/chat {question}
  N->>N: /api/auth/me でチームID・ユーザーID を決める
  N->>M: chat-agent(requestContext に teamId・memory に resource/thread)
  Note over M: 最初のステップでかならず search-minutes Tool(team_minutes をチームで絞って検索)
  M-->>N: 答え+検索結果
  N-->>画面: 答え+関連する議事録(出典は検索結果からコードで作る)
```

### 決定事項の一覧(/dashboard)
- Next.js(サーバー)→ FastAPI `GET /api/decisions?status=all` → 「最新の決定」(current)と「以前の決定」(previous)

## メモリ・DB・RAG のちがい
| | 中身 | 置き場所 |
|---|---|---|
| メモリ | 会話の履歴。回答時に直近20メッセージを参照する（保存件数の上限ではない）。チームID+ユーザーID で分ける | PostgreSQL(Mastra の PostgresStore) |
| DB | 議事録・決定事項(現在/以前)・変更履歴・未決事項・ToDo・チーム・ユーザー | PostgreSQL(FastAPI・7つの表 → database.md) |
| RAG | 議事録の本文を数字(ベクトル)にした本棚 `team_minutes`。チームID・議事録名・日付つき | PostgreSQL + pgvector(Mastra) |

## 守っていること(セキュリティ)
- チームID は画面から受け取らない(サーバーで決める)→ ほかのチームのデータは見えない
- RAG 登録の API は合言葉(`RAG_INGEST_SECRET`)がないと使えない
- 出典は AI に作らせず、検索結果からコードで表示する
- `.env`・Firebase の鍵・API キーはコミットしない

## ポート
| サービス | ポート |
|---|---|
| Next.js | 3000 |
| Mastra | 4111 |
| FastAPI | 8001 |
| PostgreSQL | 5435 |
