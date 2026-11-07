# API 仕様書・エラー一覧

> リクエスト・レスポンスの例はすべて架空です。
> Next.jsからMastraを呼び、業務データの保存・一覧はFastAPI経由で行います。

## 1. 全体の通り道(10/20 定例で決定)

### 決定:案B
- **AI**:画面(Next.js のサーバー)→ Mastra
- **データの保存・一覧**:画面(Next.js のサーバー)→ FastAPI → DB

```
ブラウザ ─▶ Next.js のサーバー(Route Handler)
              │ ① 確認の共通部品:「この人はだれ?どのチーム?」
              │      └─▶ FastAPI  GET /api/auth/me(Cookie を確かめて答える)
              │ ② 保存・一覧 ─▶ FastAPI ─▶ DB
              └ ③ AI ─────────▶ Mastra(① の ID を使って呼ぶ)
```

### ログイン・チーム所属の確認(10/20 定例で決定・10/22 に見直し)
- Next.js のサーバーに **確認の共通部品を1つ** 作る。Route Handler は、**最初に必ずこれを呼ぶ**(いまは各 Route Handler の中で /api/auth/me を呼んでいる)
- 共通部品の中では、FastAPI の `GET /api/auth/me` に「だれ?どのチーム?」を聞く(Firebase の鍵とチームの所属は FastAPI 側だけにある)
- あとで方法を変えたくなったら、**共通部品の中だけ** を変えればよい(呼ぶ側のコードは変えなくてよい)
- 参考:Next.js 公式も「確認は共通の部品(Data Access Layer)にまとめる」「別の言語のバックエンドがあるときは、その API を呼ぶ形でよい」としている

### 必ず守ること
- **Mastra を外から直接呼べないようにする**
- **チームの ID・ユーザーの ID は、ログインの情報(共通部品の答え)から取る**(画面から送られた値は使わない)
- **Route Handler ごとに毎回ログインを確かめる**(ページで確認しても、Route Handler は別の入口なので。Next.js 公式の推奨)
- **画面には、くわしいエラーを出さない**(原因はサーバーのログにだけ出す)

## 2. 一覧

### 2-1. FastAPI の API
| # | メソッド | パス | 中身 | ログイン |
| --- | --- | --- | --- | --- |
| 1 | GET | /api/health | 動いているかの確認 | 不要 |
| 1-2 | GET | /api/health/db | DB につながっているかの確認 | 不要 |
| 2 | POST | /api/auth/session | ログイン(Firebase の ID トークン → Cookie) | 不要 |
| 3 | GET | /api/auth/me | **だれ?どのチーム?**(確認の共通部品から呼ぶ)※ PR #46 | 必要 |
| 4 | POST | /api/minutes | 議事録の本文を保存【実装ずみ】 | 必要 |
| 5 | GET | /api/minutes | 議事録の一覧 | 必要 |
| 6 | GET | /api/minutes/{id} | 議事録を1件(AI の抽出の前に本文を取る/RAG の再登録で取り直す) ※ 10/22 決定 | 必要 |
| 7 | POST | /api/minutes/{id}/confirm | 人が確認した結果を保存(古い決定は「以前」に)【実装ずみ】 | 必要 |
| 8 | GET | /api/decisions | 決定事項の一覧(現在/以前)※ #52 で作成・merge ずみ | 必要 |

- 3 は PR #46 で開発チームが作りました
- 議事録の抽出・保存の窓口・チャットは、Next.js の Route Handler です。どれも FastAPI には作りません(案B・下の 2-2)

### 2-2. Next.js のサーバー側(Mastra を呼ぶ)
| # | 名前 | 作り | 中身 | 呼ぶ Mastra |
| --- | --- | --- | --- | --- |
| A | 議事録の抽出 | **Route Handler** `POST /api/minutes/extract`(10/26 開発チーム決定・frontend/app/api/minutes/extract/route.ts)【実装ずみ】 | 議事録 → 出力の型(機能①)で返す。**まだ保存しない** | Workflow `minutesExtractionWorkflow`(開発チーム・feature/minutes-flow) |
| B | チャット | **Route Handler `POST /api/chat`**(frontend/app/api/chat/route.ts・#43) | 質問 → 出典つきの答え(出力の型・機能②) | `chat-agent` |
| C | 保存の窓口 | **Route Handler `POST /api/minutes/save`**(frontend/app/api/minutes/save/route.ts)【実装ずみ】 | 本文の保存(4)→ 確定保存(7)→ RAG 登録(Mastra)をまとめて行う | RAG 登録 API(下の 2-3) |

### 2-3. Mastra の API(Next.js のサーバーからだけ呼ぶ)
| # | メソッド | パス | 中身 | 呼ぶところ |
| --- | --- | --- | --- | --- |
| R | POST | /minutes-rag/ingest | 保存した議事録を本棚(team_minutes)に登録 ※ #48 で作成・merge ずみ | C 保存の窓口 |

**大事なルール**:A・B・C とも、**最初に `GET /api/auth/me` でログインとチームを確かめる**。チームの ID・ユーザーの ID は、そこで返ってきた値を使う。
- チャット(B)は、ログインした人の `team_id` で検索する。仮のチームID(`CHAT_DEV_TEAM_ID`)はもう使わない

## 3. 各 API の中身

### 3. GET /api/auth/me(だれ?どのチーム?)※ PR #46(開発チーム)
リクエスト:なし(Cookie の `session` を Next.js のサーバーから一緒に送る)
レスポンス(200)
```json
{ "id": "8a2b3c4d-1e2f-4a5b-8c6d-7e8f9a0b1c2d", "team_id": "5d6e7f80-9a1b-4c2d-8e3f-4a5b6c7d8e9f", "team_name": "チームA", "name": "開発チーム", "role": "member" }
```
| 項目 | 中身 | もと |
|---|---|---|
| id | ユーザーID(users.id)。会話メモリの「だれの会話か」にも使う | ER図・PR #46 |
| team_id | チームID(users.team_id)。チャットの検索・保存のチームはこれで決める | ER図・PR #46 |
| team_name | チーム名(teams.name)。画面に出す | 10/24 決定 |
| name | 名前 | ER図・PR #46 |
| role | 役割(member など) | ER図・PR #46 |

- ログインしていない・期限切れ → **401**
- DB の users の表にいない人(チームのメンバーではない人)→ **403**
- エラーのときは FastAPI の標準の形(4-1)。チャットの `{ "error": "..." }`(4-2)とはちがう形です
```json
{ "detail": "Not authenticated" }
```
- 一般メンバーもログインできる(10/20 決定・admin の確認はしない B 案・10/22)。チームの所属・役割は DB の users の表で管理(Firebase には持たせない)
- `firebase_uid` を返すかは、開発チームが決める(画面・会話メモリでは使わない)
- 「1人1チームか」は保留なので、今は team_id を1つ返す形(複数になったら形を変える)
- 項目名・role の種類は、開発チームの ER図(users:id・team_id・firebase_uid・name・role)にそろえる
- ※ 例の中身は、すべて架空です

### 4. POST /api/minutes(議事録を保存)
リクエスト
```json
{ "title": "10/23 定例MTG", "meeting_at": "2026-10-23T21:00:00+09:00", "content": "- ログインは Google ログインに変更\n- ..." }
```
- title:1〜100文字/meeting_at:会議の日時(タイムゾーンつき)/content:1〜10000文字(前後の空白は取りのぞく)
- 議事録にない決定は、非公開の連絡手段 などの文を議事録の画面に貼って登録する(10/21 決定)。そのときは、話した日を meeting_at に入れる【案】
- チームの ID は送らない(FastAPI がログインの情報から決める)

レスポンス(201)【実装ずみ】
```json
{ "id": "3f1c2a9e-7b4d-4c1a-9e2f-5a6b7c8d9e01", "title": "10/23 定例MTG", "content": "- ログインは Google ログインに変更\n- ...", "meeting_at": "2026-10-23T21:00:00+09:00", "team_id": "5d6e7f80-9a1b-4c2d-8e3f-4a5b6c7d8e9f", "created_by": "8a2b3c4d-1e2f-4a5b-8c6d-7e8f9a0b1c2d", "created_at": "2026-10-23T22:00:00Z" }
```
- チームのメンバーでない人 → 403/タイトル・本文が空、タイムゾーンのない日時 → 422

### 6. GET /api/minutes/{id}(議事録を1件)※ 10/22 決定(開発チーム)
レスポンス(200)
```json
{ "id": "3f1c2a9e-7b4d-4c1a-9e2f-5a6b7c8d9e01", "title": "10/23 定例MTG", "meeting_at": "2026-10-23T21:00:00+09:00", "content": "- ログインは Google ログインに変更\n- ...", "summary": null }
```
- ほかのチームの議事録 → 403/ない → 404
- summary(決まったこと3行)は、確認して保存する前は null
- 開発チームの RAG の再登録でも、議事録ID でここから取り直す(10/22 決定)

### A. Route Handler:議事録の抽出 `POST /api/minutes/extract`(Next.js → Mastra の Workflow)【実装ずみ】
受け取るもの:`{ "content": "議事録の本文" }`
流れ:`GET /api/auth/me` でログインを確かめる → Mastra の Workflow `minutesExtractionWorkflow`(id は `minutes-extraction-workflow`)に `{ content }` を渡す → 出力の型で返す
- Workflow の中の3ステップ(開発チーム・feature/minutes-flow):① 本文が空でないか確かめる → ② 抽出の Agent(`extractMinutes`)→ ③ 形をチェック(決定事項が0個なら summary3 は「決まったことはありません」の1行)
返す形:出力の型(機能①)そのまま → [ai-design.md](ai-design.md)
```json
{
  "summary3": ["ログインは Google ログインに変更する"],
  "decisions": [{ "content": "ログインは Firebase の Google ログインを使う", "reason": "メンバー全員が Google アカウントを持っているため", "replaces": "ログインは Firebase のメールとパスワードを使う" }],
  "undecided": ["画面のデザイン"],
  "todos": [{ "task": "ログイン画面を作る", "assignee": "開発チーム", "due": "2026-10-25" }]
}
```
- ここではまだ保存しない(人が画面で確認してから、C の保存の窓口で保存)
- エラーは、チャットと同じ HTTP の番号と `{ "error": "..." }`(10/25 夜。Route Handler にしたため)
- Mastra の呼び出しに失敗したら、画面には「時間をおいてもう一度お試しください」

### 7. POST /api/minutes/{id}/confirm(確認して保存)
リクエスト:A の結果を、人が直したもの(形は同じ)
レスポンス(201)
```json
{ "saved_decisions": 1, "saved_todos": 1 }
```
- 担当:開発チーム(10/25 夜に分け直し)。保存の窓口(C)から呼ぶ
- `replaces` がある決定は、**同じチームの現在の決定**で同じ文のものを「以前」(previous)にし、decision_histories に残す。見つからないときは、エラーにせず新しい決定として保存する【実装ずみ】
- 同じ議事録を2回保存しようとしたら 409/ほかのチームの議事録 → 403/議事録がない → 404
- **決まったこと3行**(summary3)は、人が確認したあと、改行でつないで `minutes.summary` に保存する(10/21 決定)
- ToDo の担当がいないとき(assignee が null)は、`todos.assignee_id` を NULL にする。画面では「担当者未定」と出す(10/21 決定)。担当の名前は同じチームのメンバーからさがし、見つからないときも NULL(担当者未定)にする【実装ずみ】
- AI の答えと DB で名前がちがうところは、保存するときに FastAPI で変換する(10/25 決定):summary3 → minutes.summary(改行でつなぐ)/undecided → pending_items(status は unresolved)/task → title/assignee(名前)→ assignee_id/due → due_date

#### 保存したあとの RAG 登録(10/21 決定・F8)
```
人が確認 → 7. で DB に保存 → 保存できたら Next.js のサーバーから Mastra の RAG 登録を呼ぶ
```
| やること | 担当 |
|---|---|
| 保存できたら RAG 登録を呼ぶ(C 保存の窓口) | 開発チーム(10/25 夜に分け直し) |
| RAG 登録の処理(Mastra → pgvector)・外から呼べないようにする・失敗したときの形 | 開発チーム |
| 検索・出典つきの答え(B) | 開発チーム |

- 渡すもの:議事録ID・チームID・タイトル・会議日時(meeting_at)・本文(content)。**チームID はログインの情報から取る**(ブラウザから送られた値は使わない)
- 出典の日付は、登録のときに日付だけ(YYYY-MM-DD)にする
- 本棚(ベクトルの入れ物)の名前は **team_minutes**。検索のときは teamId でしぼりこむ(10/22 決定)
- 登録に失敗したときに画面に出す文:「議事録は保存されていますが、AI検索への登録に失敗しました。もう一度お試しください。」(10/22 決定)。保存の窓口(C)は、そのとき `ragStatus: "failed"` と `warning` を返す
- 再試行ボタンは WANT。MVP では、だめなときは開発者が手で登録し直す(10/22 決定)
- まず新規保存だけつなぐ(更新・削除のときの入れ直しはあと)。10/24 の結合テストで、登録 → 検索がつながった(8問 OK)

### 8. GET /api/decisions(決定事項の一覧)
クエリ:`?status=current`(現在だけ)/`?status=all`(以前もふくむ。省略時は all)
レスポンス(200)
```json
[
  { "id": "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f", "content": "ログインは Firebase の Google ログインを使う", "status": "current", "minute_id": "3f1c2a9e-7b4d-4c1a-9e2f-5a6b7c8d9e01", "minute_title": "10/23 定例MTG", "meeting_at": "2026-10-23T21:00:00+09:00" },
  { "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e", "content": "ログインは Firebase のメールとパスワードを使う", "status": "previous", "minute_id": "6e7f8091-a2b3-4c4d-9e5f-6a7b8c9d0e1f", "minute_title": "10/21 定例MTG", "meeting_at": "2026-10-21T21:00:00+09:00" }
]
```
- 決定事項の表には日付がないので、もとになった議事録のタイトル・会議日時を一緒に返す
- status の値は current/previous(database.md)。並びは会議日時の新しい順
- 自分のチームの決定事項だけ(チームID はログインの情報から)/未ログイン 401・メンバーでない人 403
- WANT② ダッシュボードでも使い回す(10/25 決定)

### B. チャット:Route Handler `POST /api/chat`(Next.js → Mastra・#43)
受け取るもの
```json
{ "question": "ログインは何を使うんだっけ?" }
```
- question:1〜500文字(Sec6 のチャットと同じ上限)
- 流れ:`GET /api/auth/me` でログインを確かめる→ Mastra の `chat-agent` を呼ぶ。検索のチームはログインした人の `team_id`
- ログインしていない・チームのメンバーでない → **401**「ログイン情報を確認できませんでした。再ログインしてください。」
- **メモリ**:だれの会話かは「ユーザー ID+チーム ID」で分ける(10/20 決定)。直近 20 件をおぼえる
- **RAG**:検索は**自分のチームの議事録だけ**(取り込むときにチーム ID をつけておき、検索でしぼりこむ)。AI がしぼりこみを変えないかはテストで確かめる

返す形:出力の型(機能②)そのまま → [ai-design.md](ai-design.md)
```json
{
  "answer": "現在は Firebase の Google ログインです。以前はメールとパスワードでしたが、10/23 に変わりました。",
  "found": true,
  "sources": [{ "title": "10/23 定例MTG", "date": "2026-10-23" }]
}
```
- sources(出典:議事録名・日付)は、AI に書かせず RAG の検索結果からつける。今回の質問で検索した結果だけを使う(会話メモリで前の質問の出典がまざらないように・#49)。画面の見出しは「関連する議事録」(10/25 決定・#50)
- 「今の決定」を答えるときは、日付が新しい議事録を優先する(10/21 決定・MVP)
- 見つからないとき:`found: false`・`sources: []`。answer は「**議事録の中に見つかりませんでした。**」(#43・開発チーム)

### C. Route Handler:保存の窓口 `POST /api/minutes/save`(開発チーム)【実装ずみ】
受け取るもの(入力・確認の画面の「保存する」から)
```json
{ "title": "9/8 定例MTG", "meeting_at": "2026-09-08T21:00:00+09:00", "content": "議事録の本文", "extraction": { "summary3": ["..."], "decisions": [], "undecided": [], "todos": [] } }
```
- extraction は、A の結果を人が直したもの(出力の型と同じ形)
- meeting_at はタイムゾーンつき(+09:00 など)/title は1〜100文字/content は1〜10000文字
- 流れ:`GET /api/auth/me` → ① `POST /api/minutes`(本文)→ ② `POST /api/minutes/{id}/confirm`(確定)→ ③ Mastra `POST /minutes-rag/ingest`(RAG 登録・②が成功したときだけ)

返す形(201)
```json
{ "minuteId": "3f1c2a9e-7b4d-4c1a-9e2f-5a6b7c8d9e01", "ragStatus": "success" }
```
- RAG 登録に失敗したとき:`{ "minuteId": "...", "ragStatus": "failed", "warning": "議事録は保存されていますが、AI検索への登録に失敗しました。もう一度お試しください。" }`(保存は成功なので 201)
- ②で失敗したとき:502 と `{ "minuteId": "...", "ragStatus": "not_started", "error": "議事録本文は保存されましたが、確定保存に失敗しました。" }`。もう一度押すと本文が2つできるので、MVP では作り直しはしない(改善点)

### R. Mastra:RAG 登録 `POST /minutes-rag/ingest`(開発チーム・#48)
- 呼べるのは Next.js のサーバーだけ:ヘッダー `x-rag-ingest-secret` に、環境変数 `RAG_INGEST_SECRET` の値を入れて送る(値は貼らない・コミットしない)
- 受け取るもの:`{ "minuteId", "teamId", "title", "meetingAt", "content" }`(どれも必須。teamId はログインの情報から)
- 返す番号:200(登録できた)/400(項目が足りない・形がちがう)/401(キーがない・ちがう)/500(登録に失敗)

## 4. エラー一覧

### 4-1. FastAPI
形は FastAPI の標準:
```json
{ "detail": "議事録が見つかりません" }
```

| HTTP | いつ | detail の例 | 画面に出す文 |
|---|---|---|---|
| 401 | ログインしていない・期限切れ(※) | Not authenticated | もう一度ログインしてください |
| 403 | チームに入っていない/ほかのチームのデータ | Forbidden | 見る権限がありません |
| 404 | データが見つからない | 議事録が見つかりません | 見つかりませんでした |
| 409 | 同じものを2回保存した | すでに保存されています | すでに保存ずみです |
| 422 | 入力が足りない・長すぎる(FastAPI が自動で返す) | (FastAPI の形) | 入力を見直してください |
| 500 | そのほかのエラー | Internal Server Error | 時間をおいてもう一度お試しください |

- ※ Sec6 は「管理者のページがあることを隠す」ために、ログインしていないときも 404 を返す作り。Sec8 では **401** にしました(PR #46・開発チーム)

### 4-2. Next.js のサーバー側(A・B)
- A(抽出)・B(チャット)・C(保存の窓口):どれも Route Handler なので、エラーのときは HTTP の番号と `{ "error": "..." }` を返す(#43・10/25 夜)
```json
{ "error": "AIへの問い合わせに失敗しました。" }
```

| いつ | 画面に出す文 |
|---|---|
| ログインしていない(共通部品が 401) | もう一度ログインしてください |
| チームに入っていない(共通部品が 403) | 見る権限がありません |
| 保存の窓口(C):本文は保存できたが確定保存に失敗(502) | 議事録本文は保存されましたが、確定保存に失敗しました。 |
| 入力が空・長すぎる(B・C は 400) | 質問を入力してください。/質問は500文字以内で入力してください。 |
| Mastra(AI)の呼び出しに失敗した(B は 502) | A:時間をおいてもう一度お試しください/B:AIへの問い合わせに失敗しました。 |
| そのほか(B は 500) | チャット処理中にエラーが発生しました。 |
| AI の答えが出力の型に合わない | うまく答えを作れませんでした。もう一度お試しください |

- くわしい原因はサーバーのログ(console.error)にだけ出す

## 5. 決めること(チェックリスト)
- [x] 全体の通り道は 案B(10/20 定例)
- [x] 確認は Next.js の共通部品 → FastAPI に聞く形で開始(10/20 定例)
- [x] 確認の場所の見直し:B 案(admin の確認をはずし、役割・チームは DB の users で持つ)(10/22 講義日)
- [x] `GET /api/auth/me` の返す項目:id・team_id・team_name・name・role(PR #46・10/25)
- [x] 議事録の抽出は Route Handler(Server Action(案)から変更)(10/25 夜・開発チーム OK)
- [x] 機能①の担当の分け直し(10/25 夜)
- [ ] パスでよいか(開発チーム:3〜6、開発チーム:7・8・C、開発チーム:B)/A の URL は 10/26 に決定ずみ
- [x] 項目名を ER図にそろえる(held_on → meeting_at、body → content)(10/21 定例)
- [x] ID の形は uuid(10/21 定例)
- [x] ログインしていないときは 401(PR #46・10/25)
- [ ] 文字数の上限(議事録 10000 文字・質問 500 文字)でよいか
- [x] 議事録に書いていない決定:MVP は 非公開の連絡手段 などの文を議事録の画面に貼って登録 → 新しい API はいらない。1件ずつ打つ画面は WANT(10/21 定例)
- [x] 保存のあと RAG に取り込む:保存できたら Next.js から RAG 登録を呼ぶ(10/21 定例)。呼ぶ=開発チーム(保存の窓口 C)/登録=開発チーム(10/25 夜)
- [x] RAG 登録が失敗したときの画面の文(10/22)・返す形(`ragStatus`・`warning`)(開発チーム)/[ ] やり直しの回数(再試行ボタンは WANT #39)
- [ ] 議事録を修正・削除したときの RAG の入れ直し方

## RAG登録の再試行（PR #39）

- `GET /api/minutes/{minute_id}`（FastAPI）: セッション認証後、所属チームの確定済み議事録を `MinuteRead` の形で取得する。未認証401、未所属403、他チームまたは存在しないID404、未確定409、UUID不正422。読み取りのみ。
- `POST /api/minutes/rag-retry`（Next.js）: `{ "minuteId": "UUID" }` を受け取る。CookieをFastAPIへ渡して上記APIから本文・チームIDを取得し、既存のMastra `/minutes-rag/ingest` へサーバーの共有秘密付きで送る。ブラウザ指定の本文・チームIDは使わない。
- 成功200: `{ "minuteId": "UUID", "ragStatus": "success" }`。不正入力400、未認証401、未所属403、議事録なし404、未確定409、接続・上流異常502、共有秘密未設定503。エラーは `{ "error": "表示用メッセージ" }`。
- DBの本文・決定事項・ToDoは更新せず、同じ議事録のRAG検索データだけ再登録する。会議日は日本時間にそろえる。
- 保存成功後、RAG登録だけ失敗した場合にボタンを表示する。処理中の連打と新規入力へのリセットを防ぎ、再失敗後は再試行可能。成功後は完了表示。
- 保存直後の画面が対象。再読み込み後の復旧や、確定保存自体の失敗は対象外。再登録でEmbedding APIの利用が発生する。
