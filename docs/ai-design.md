# AI 設計(出力の型・Agent・Workflow)

> 状態:**実装ずみ**(10/28 更新)。型は `mastra/src/mastra/schemas/minutes-extraction.ts`、Workflow は `mastra/src/mastra/workflows/minutes-extraction-workflow.ts`、チャットは `mastra/src/mastra/chat-agent.ts`

## 0. 出力の型とは
AI が返す答えの「項目の決まり」です。毎回同じ形で返ってくるので、画面や API はその形を前提に作れます。
Mastra では、Agent を呼ぶときに `structuredOutput` に zod(型を決める道具)のスキーマを渡すと、決めた形で答えが返ってきます(結果は `response.object`)。

## 1. 共通のルール
| ルール | 理由 |
|---|---|
| 議事録に書いていないことは、推測で埋めない(`null` や空の配列 `[]` にする) | まちがった決定や担当を作らないため |
| 日付は AI に作らせない。議事録の日付をシステムが入れる | AI が日付をまちがえないようにするため |
| チャットの出典は、RAG の検索結果からつける(AI に書かせない) | 存在しない出典を出さないため |
| 文章はやさしい日本語・短く | 画面で読みやすくするため |

## 2-0. 「決まったこと3行」になるまでの流れ
人が3行を考える必要はありません。ふつうの議事録(箇条書きのメモでOK)を貼ると、AI が3行にしぼります。

| 順 | だれ | やること |
|---|---|---|
| ① | 人 | いつもどおり議事録を書いて貼る(長くてもOK) |
| ② | AI | 議事録を読んで、決まったこと(decisions)を全部ぬき出す |
| ③ | AI | その中から大事な順に3つまで選び、1行ずつ短くする(summary3) |
| ④ | 人 | 確認して、ちがうところを直して保存 |

- 3行は「決定事項の要約」。チームでやっている「MTG の最後に決まったこと3行を投稿」を、AI が代わりにやるイメージ
- **かならず3行にはしない**:決まったことが1つなら1行。むりに3行にすると、決まっていないことを AI が作ってしまうため
- 決まったことが0個のときは「決まったことはありません」の1行

### なぜ3行?
- Sec7 のふりかえり(議事録が翌日に出るので、決まったことをすぐ確かめにくかった)から、「MTG の最後に決まったこと3行を投稿する」をチームのルールにしたため
- 忙しいメンバーでもパッと読めて、全員の認識をすぐそろえられる長さ

### 3行に収まらないときは?
- 3行(summary3)は「見出し」。**決まったことは全部 decisions に残る**ので、なにも消えない
- 例:決まったことが5つ → 3行には大事な3つ、decisions には5つ全部。決定事項の一覧にも5つ出る

| 項目 | 数 | 役わり |
|---|---|---|
| summary3 | 1〜3つ | パッと読む用の見出し(非公開の連絡手段 に貼る) |
| decisions | いくつでも | 決まったことを全部。決定事項の一覧に出る |
| undecided・todos | いくつでも | まだ決まっていないこと・ToDo |

## 2. 機能① 議事録の抽出結果

### 項目
| 項目 | 型 | 中身 | 必須 |
|---|---|---|---|
| summary3 | 文字列 × 1〜3 | 決まったことの要約(**1〜3行**・1行60文字まで)。決まったことが少なければ少ないまま。0個なら「決まったことはありません」の1行 | ○ |
| decisions | 配列 | 決定事項 | ○(なければ `[]`) |
| decisions[].content | 文字列 | 決まったこと | ○ |
| decisions[].reason | 文字列 or null | 理由(書いていなければ null) | |
| decisions[].replaces | 文字列 or null | 前の決定を変えた場合、その前の決定の内容 | |
| undecided | 文字列の配列 | まだ決まっていないこと | ○(なければ `[]`) |
| todos | 配列 | ToDo | ○(なければ `[]`) |
| todos[].task | 文字列 | やること | ○ |
| todos[].assignee | 文字列 or null | 担当(書いていなければ null) | |
| todos[].due | 文字列 or null | 期限(YYYY-MM-DD。書いていなければ null) | |

### 例
```json
{
  "summary3": [
    "ログインは Google ログインに変更する",
    "ログイン画面は 開発チームが 10/25 までに作る",
    "画面のデザインは次回の MTG で決める"
  ],
  "decisions": [
    { "content": "ログインは Firebase の Google ログインを使う", "reason": "メンバー全員が Google アカウントを持っているため", "replaces": "ログインは Firebase のメールとパスワードを使う" },
    { "content": "ログイン画面は 開発チームが作る", "reason": null, "replaces": null }
  ],
  "undecided": ["画面のデザイン"],
  "todos": [
    { "task": "ログイン画面を作る", "assignee": "開発チーム", "due": "2026-10-25" }
  ]
}
```
※ 中身はすべて架空のサンプルです。

決まったことが1つだけのときの例:
```json
{
  "summary3": ["次回までに API の形をそろえる"],
  "decisions": [{ "content": "次回までに API の形をそろえる", "reason": null, "replaces": null }],
  "undecided": [],
  "todos": []
}
```

### zod のスキーマ(設計時の案。実装は schemas/ のファイル)
```typescript
import { z } from "zod";

// 機能① 議事録の抽出結果の型
export const minutesExtractionSchema = z.object({
  // 決まったことの要約(1〜3行。むりに3行にしない)
  summary3: z.array(z.string().max(60)).min(1).max(3),
  // 決定事項(なければ空の配列)
  decisions: z.array(
    z.object({
      content: z.string(),            // 決まったこと
      reason: z.string().nullable(),  // 理由(書いていなければ null)
      replaces: z.string().nullable() // 前の決定を変えたときの、前の決定の内容
    })
  ),
  // まだ決まっていないこと
  undecided: z.array(z.string()),
  // ToDo
  todos: z.array(
    z.object({
      task: z.string(),                // やること
      assignee: z.string().nullable(), // 担当(書いていなければ null)
      due: z.string().nullable()       // 期限 YYYY-MM-DD(書いていなければ null)
    })
  )
});
```

## 3. 機能② チャットの答え

### 項目
| 項目 | 型 | 中身 | 必須 |
|---|---|---|---|
| answer | 文字列 | 質問への答え | ○ |
| found | 真偽値 | 資料の中に根拠が見つかったか | ○ |
| sources | 配列 | 出典(RAG の検索結果からつける) | ○(見つからなければ `[]`) |
| sources[].title | 文字列 | 議事録名・ファイル名 | ○ |
| sources[].date | 文字列 | 日付(YYYY-MM-DD) | ○ |

### 例
```json
{
  "answer": "現在は Firebase の Google ログインを使います。以前はメールとパスワードでしたが、10/23 の MTG で変更されました。",
  "found": true,
  "sources": [
    { "title": "10/23 定例MTG 議事録", "date": "2026-10-23" },
    { "title": "10/21 定例MTG 議事録", "date": "2026-10-21" }
  ]
}
```
見つからないとき:
```json
{ "answer": "資料の中に見つかりませんでした。次の MTG で確認してください。", "found": false, "sources": [] }
```

### zod のスキーマ(設計時の案。実装は schemas/ のファイル)
```typescript
import { z } from "zod";

// 機能② チャットの答えの型
export const chatAnswerSchema = z.object({
  answer: z.string(),  // 質問への答え
  found: z.boolean(),  // 根拠が見つかったか(見つからなければ false)
  // 出典(AI に書かせず、RAG の検索結果からつける)
  sources: z.array(
    z.object({
      title: z.string(), // 議事録名・ファイル名
      date: z.string()   // 日付 YYYY-MM-DD
    })
  )
});
```

## 4. Workflow(機能①)【実装ずみ】
`minutes-extraction-workflow`(3ステップ):
1. `validate-minutes-input`:議事録の本文があるか確かめる
2. `extract-minutes`:抽出 Agent で、決まったこと3行・決定事項・未決事項・ToDo を出力の型で返す
3. `validate-extraction-output`:形のチェック(3行は1〜3行など)

- 呼び方:Next.js の `POST /api/minutes/extract`→ Mastra の Workflow
- 人の確認は Workflow の外(画面で直す → 保存の窓口 `POST /api/minutes/save`)
- モデル:`openai/gpt-5-nano`(OpenRouter)

## 5. チャットの Agent(機能②)【実装ずみ】
- `chat-agent`:Tool `search-minutes` で、ログインした人のチーム(requestContext の teamId)の本棚 `team_minutes` だけを探す
- 最初のステップはかならず検索する(`prepareStep` で `toolChoice: "required"`・#65)→ 続けて聞いても出典がつく
- 出典(関連する議事録)は AI に書かせず、検索結果から Next.js でつくる
- 見つからないときは「議事録の中に見つかりませんでした。」

## 6. メモリ【実装ずみ】
- 会話の履歴を PostgreSQL に保存(Mastra の PostgresStore)、AI が見るのは直近20件
- だれの会話かは チームID+ユーザーID で分ける。ワーキングメモリ(役割・担当)は使っていない【今後】

## 7. 確認したこと
- [x] 機能①の項目(summary3・decisions・undecided・todos)は、画面と保存の窓口で使っている
- [x] 型の定義ファイル:`mastra/src/mastra/schemas/`
- [x] `gpt-5-nano` で出力の型どおりに返る(継続テスト・通しテストで確認)。抽出の抜け(理由・未決)はあるので、人が確認してから保存する

## 参考
- Mastra 公式:Structured Output(https://mastra.ai/docs/agents/structured-output)
