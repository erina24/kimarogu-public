# Windows：一つずつ進める環境構築・起動手順

対象：Windows / PowerShellを使う人。更新日：2026-10-28。公開用コピーの手順です。このページだけで準備から終了まで進められます。

AIエージェントと進める場合は、[環境構築の案内](README.md)を最初に渡してください。AIはこのページの番号を使って、次の1操作だけを案内し、結果を確認してから進みます。

## 最初に読むこと

- 初回は「A→B→C→D→E→F」の順に進めます。次の日からは「G」だけで起動できます。
- コマンドは灰色の枠の中だけをコピーして、ターミナルに貼り付け、Enterを押します。説明文や「```」はコピーしません。
- 1つ実行して、成功の目安を確認してから次へ進みます。赤いエラーや違う表示が出たら、その番号で止まって相談します。
- `.env`・Firebaseの鍵・UID・Cookieは、チャットやスクリーンショットに載せません。
- すでに起動できる人は設定を作り直しません。既存DBや作業中のコードは残したまま、不足する項目だけ確認します。
- このページの作成時点では、新手順の全工程を各PCで実施済みではありません。Windowsも実機確認待ちです。

## A. VS Codeとターミナルを開く

### A1. 使うアプリを確認する


**操作する場所：デスクトップ**


スタートメニューで **Visual Studio Code** と **Docker Desktop** を検索して、あるか確認します。

この手順はNode.js/npm・uvがインストール済みのPC向けです。A4で確認します。アプリやコマンドがない場合は、その名前を担当者に伝えて、インストールから一緒に確認してください。


**成功の目安：** VS CodeとDocker Desktopを開けること。見つからない場合は、先に進まず相談します。


### A2. プロジェクトを開く


**操作する場所：VS Code**


VS Codeを開き、上のメニュー **「ファイル」→「フォルダーを開く…」** を選びます。配布された公開用コピーの **`kimarogu-public`** フォルダを選んで開きます。

この公開用コピーを展開したフォルダを使用します。元チームのリポジトリの取得やGitHubへのログインは不要です。


**成功の目安：** 左のエクスプローラーに `backend`・`frontend`・`mastra`・`docker-compose.yml` が見えること。違う場合は開いたフォルダを確認します。


### A3. 準備用ターミナルを開く


**操作する場所：VS Codeの上のメニュー**


**「ターミナル」→「新しいターミナル」** を選びます。画面下に文字を入力できる欄が開きます。

右上の「＋」横の矢印から **PowerShell** を選びます。このページではWSLやGit Bashを使いません。

次を実行します。

```powershell
pwd
```


**成功の目安：** 表示された場所の末尾が `kimarogu-public` になっていること。この場所を以降「ルート」と呼びます。違う場合は、ターミナルを閉じ、A2で正しいフォルダを開いてから新しいターミナルを作ります。


以下はそれぞれ1つずつ実行します。インストール済みかを確かめるだけで、設定は変わりません。

**A4：Dockerの確認（場所：ルート）**

```powershell
docker --version
```

成功の目安：`Docker version ...`が出ます。`command not found` /「認識されません」なら止まって相談します。

**A4：Node.jsの確認（場所：ルート）**

```powershell
node --version
```

成功の目安：`v...`が出ます。`command not found` /「認識されません」なら止まって相談します。

**A4：npmの確認（場所：ルート）**

```powershell
npm.cmd --version
```

成功の目安：数字のバージョンが出ます。`command not found` /「認識されません」なら止まって相談します。

**A4：uvの確認（場所：ルート）**

```powershell
uv --version
```

成功の目安：`uv ...`が出ます。`command not found` /「認識されません」なら止まって相談します。

Nodeのバージョンをローカルのメモに記録してください。Node.js 26系を目安とし、実際の依存パッケージの engines 条件も確認してください。Pythonはuvで3.12系を指定します。

### A5. 公開用フォルダを確認する

このコピーには `.git` がありません。`git status` や `git log` は不要です。
ルートに `backend`・`frontend`・`mastra`・`docker-compose.yml` があることを確認します。

## B. 設定ファイルを用意する

### B1. Docker Desktopを起動する


**操作する場所：Docker Desktop**


Docker Desktopを開き、起動が完了するまで待ちます。初回のインストールや起動に関する案内が出る場合は、内容を確認します。

WSLの更新・再起動を求められたら、作業を保存して担当者と確認してください。このページのターミナルは引き続きWindows側PowerShellです。


**成功の目安：** Docker Engineが起動済みになること。まだDBコンテナを削除する操作はしません。


### B2. 設定ファイルを作る


**操作する場所：準備用ターミナル・ルート**


最初に `pwd` で末尾が `kimarogu-public` であることを確認します。次のコマンドは、ファイルがない場合だけ作ります。既存ファイルは上書きしません。


**成功の目安：** 次のコマンド実行後、VS Codeの左側にルートの `.env`、backendの `.env`、frontendの `.env.local`、mastraの `.env` があること。見えない場合は左の更新ボタンを押します。


```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

```powershell
if (-not (Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
```

```powershell
if (-not (Test-Path frontend/.env.local)) { Copy-Item frontend/.env.example frontend/.env.local }
```

```powershell
if (-not (Test-Path mastra/.env)) { Copy-Item mastra/.env.example mastra/.env }
```

続いて、鍵を置くフォルダだけ作ります。

```powershell
New-Item -ItemType Directory -Force backend/secrets | Out-Null
```

**これ以降の設定を保存する方法：** ファイルを開いて編集し、**Ctrl + S** を押します。VS Codeのファイルタブにある未保存の丸印が消えたら保存済みです。コード枠の先頭と末尾の「```」はファイルに書きません。

### B3. Docker用DB設定を入力する


**操作する場所：VS Code左側 → ルートの `.env` をクリック**


既存DBがある人は値を変更しません。初回の人だけ、以下の3行の値を設定します。

```dotenv
POSTGRES_USER=sec8_user
POSTGRES_PASSWORD=ここを自分のDBパスワードに置き換える
POSTGRES_DB=sec8_db
```

初回パスワードは英数字の長い値を自分で用意し、他のサービスで使っているものを流用しません。設定値は自分の安全な場所に控えます。見本の日本語は残しません。**Ctrl + S** で保存します。


**成功の目安：** 3項目に空欄がなく、保存済みになっていること。DBを後で作成したら、`.env` のパスワードだけ変更しても既存DBのパスワードは変わらない点に注意します。


### B4. Firebaseの鍵を配置する


**操作する場所：エクスプローラー**


自分で管理する検証用Firebaseプロジェクトで、バックエンド用のサービスアカウントJSONを用意してください。Web用の公開設定とは別のファイルです。元チームの鍵は使用しません。

入手したJSONを、開いているプロジェクトの **`backend` → `secrets`** の中へ置き、ファイル名を **`firebase-service-account.json`** にします。拡張子が隠れている場合は表示して、`.json.json` にならないようにします。

鍵の中身をコピーしてチャットへ貼る必要はありません。


**成功の目安：** VS Code左側で `backend/secrets/firebase-service-account.json` が見えること。鍵の発行・取得ができない場合はここで止まって相談します。


### B5. FastAPIの接続先を入力する


**操作する場所：VS Code左側 → `backend` → `.env`**


次の2項目を確認します。`自分のDBパスワード` をB3と同じ値に置き換えます。

```dotenv
DATABASE_URL=postgresql+psycopg://sec8_user:自分のDBパスワード@localhost:5435/sec8_db
FIREBASE_CREDENTIALS_PATH=secrets/firebase-service-account.json
```

**Ctrl + S** で保存します。既存パスワードに `@`・`#`・`%` などの記号がある場合は接続URL用の変換が必要です。パスワードを貼らずに担当者へ相談してください。


**成功の目安：** DB名・ユーザー名・パスワードがB3と一致し、鍵の場所がB4と一致していること。


### B6. FirebaseのWeb用設定を確認する


**操作する場所：ブラウザのFirebaseコンソール・担当者と一緒に確認**


B4と同じ自分のFirebaseプロジェクトを開き、「プロジェクトの設定」のWebアプリ用設定から apiKey / authDomain / projectId / appId の4項目を確認します。

Googleログインが有効で、承認済みドメインに `localhost` があることも担当者に確認してもらいます。設定を勝手に変更する必要はありません。


**成功の目安：** B7の4項目に入力する値が分かること。サービスアカウントJSONの秘密鍵を入力する場所ではありません。


### B7. Next.jsの接続先を入力する


**操作する場所：VS Code左側 → `frontend` → `.env.local`**


各項目を次のように設定します。行がある場合は値を直し、ない項目は新しい行に足します。同じ項目を2回書きません。

```dotenv
API_BASE_URL=http://127.0.0.1:8001
MASTRA_URL=http://localhost:4111
MASTRA_API_URL=http://localhost:4111
NEXT_PUBLIC_FIREBASE_API_KEY=apiKeyの値
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=authDomainの値
NEXT_PUBLIC_FIREBASE_PROJECT_ID=projectIdの値
NEXT_PUBLIC_FIREBASE_APP_ID=appIdの値
RAG_INGEST_SECRET=自分で用意した長いランダムな共有値
```

最後の共有値は、このPCのNext.jsとMastraが同じものを使います。DBパスワードやGoogleパスワードとは別の、十分長い英数字（例：32文字以上）を自分で用意してください。4人で同じ値にする必要はありません。B8でも使います。

**Ctrl + S** で保存します。既存の `frontend/.env` は削除しません。同じ項目が両方にあれば `.env.local` が優先です。


**成功の目安：** Firebaseの見本文字列が実際の4つの値に置き換わり、共有値にも空欄がないこと。2種類のMASTRA変数は現在のコードに合わせ、同じ接続先にします。


### B8. Mastraの接続先を入力する


**操作する場所：VS Code左側 → `mastra` → `.env`**


次の3項目を設定します。

```dotenv
OPENROUTER_API_KEY=自分の利用できるOpenRouterキー
POSTGRES_CONNECTION_STRING=postgresql://sec8_user:自分のDBパスワード@localhost:5435/sec8_db
RAG_INGEST_SECRET=B7と同じ共有値
```

DBパスワードはB3と同じ値です。`RAG_INGEST_SECRET` は見本にない場合も追加します。OpenRouterキーがまだない場合は担当者へ相談し、別の人の鍵を勝手に使いません。**Ctrl + S** で保存します。


**成功の目安：** DB情報がB3と同じ、共有値がB7と同じで、OpenRouterキーが設定されていること。


## C. DBとプログラムの準備（初回だけ）

### C1. DB設定の書式を確認する


**操作する場所：準備用ターミナル・ルート**


ルートで次を実行します。

```powershell
docker compose config --quiet
```


**成功の目安：** エラーが表示されず、入力できる状態に戻ること。パスワード未設定の警告があればB3へ戻ります。


### C2. DBを起動する


**操作する場所：準備用ターミナル・ルート**


次を実行します。

```powershell
docker compose up -d db
```

続いて状態を確認します。

```powershell
docker compose ps
```


**成功の目安：** `sec8-db` の状態に `healthy` があること。`starting` なら少し待って `docker compose ps` をもう一度実行します。ポート5435が使用中なら既存コンテナを消さず相談します。


### C3. 検索用の拡張機能を有効にする


**操作する場所：準備用ターミナル・ルート**


次を実行します。

```powershell
docker compose exec db psql -U sec8_user -d sec8_db -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

続いて確認します。

```powershell
docker compose exec db psql -U sec8_user -d sec8_db -c "SELECT extname, extversion FROM pg_extension WHERE extname='vector';"
```


**成功の目安：** 1つ目に `CREATE EXTENSION`（既に存在する旨のNOTICEは問題なし）、2つ目に `vector` とバージョン番号が表示されること。既存DBのユーザー名・DB名が違う場合は勝手に作り直さず相談します。


### C4. backendフォルダへ移動する


**操作する場所：準備用ターミナル・ルート**


次を1つずつ実行します。

```powershell
Set-Location backend
```

```powershell
pwd
```


**成功の目安：** 場所の末尾が `kimarogu-public/backend`（Windowsでは区切りがバックスラッシュ）になること。


### C5. Pythonの依存プログラムを用意する


**操作する場所：準備用ターミナル・backend**


次を実行し、終了するまで待ちます。

```powershell
uv sync --frozen --python 3.12
```

続いて確認します。

```powershell
uv run python --version
```


**成功の目安：** インストールでエラーがなく、`Python 3.12...` が出ること。ダウンロード・プロキシ・Python未導入のエラーはそのまま相談します。


### C6. DBのテーブルを用意する


**操作する場所：準備用ターミナル・backend**


接続先がB5のローカルDBであることを確認してから、次を1つずつ実行します。

```powershell
uv run alembic current
```

```powershell
uv run alembic upgrade head
```

```powershell
uv run alembic current
```


**成功の目安：** 初回のcurrentは空欄でも構いません。upgrade後の最後の表示に `22d5664d47e8 (head)` が出ること。既存データを削除するコマンドではありませんが、DBへテーブルを作る処理です。失敗時はDBを削除せず相談します。


### C7. frontendの依存プログラムを用意する


**操作する場所：準備用ターミナル・backendから開始**


まずルートへ戻ります。

```powershell
Set-Location ..
```

frontendへ移動します。

```powershell
Set-Location frontend
```

インストールします。

```powershell
npm.cmd ci
```


**成功の目安：** コマンドが終了し、入力できる状態へ戻ること。`npm ERR!` があれば先へ進みません。脆弱性通知が出ても、この作業で `npm audit fix` は実行せず共有します。既に起動中ならインストール前にそのfrontendを停止します。


### C8. Mastraの依存プログラムを用意する


**操作する場所：準備用ターミナル・frontendから開始**


ルートへ戻ります。

```powershell
Set-Location ..
```

mastraへ移動します。

```powershell
Set-Location mastra
```

インストールします。

```powershell
npm.cmd ci
```


**成功の目安：** エラーなく終了すること。Macのnode_modulesをWindowsへコピーせず、各PCで用意します。


### C9. 準備用ターミナルをルートへ戻す


**操作する場所：準備用ターミナル・mastraから開始**


次を実行します。

```powershell
Set-Location ..
```

```powershell
pwd
```


**成功の目安：** 末尾が `kimarogu-public`。この準備用ターミナルは後でユーザー登録にも使います。


## D. 3つのサーバーを起動する

DBだけでは画面は動きません。FastAPI・Mastra・Next.jsの3つを、**別々のターミナル**で動かします。起動中のターミナルには別のコマンドを貼りません。入力待ちに戻らずログが出続けるのが正常です。

### D1. FastAPIを起動する


**操作する場所：VS Code →「ターミナル」→「新しいターミナル」**


新しく開いたターミナルで `pwd` を実行し、末尾が `kimarogu-public` であることを確認します。PowerShellを選びます。

違う場所なら、エクスプローラーの最上位の `kimarogu-public` を右クリック→「統合ターミナルで開く」でルートのターミナルを開き直します。

フォルダへ移動します。

```powershell
Set-Location backend
```

起動します。

```powershell
uv run uvicorn app.main:app --host 127.0.0.1 --port 8001
```


**成功の目安：** `Application startup complete` と `http://127.0.0.1:8001`が出ること。このターミナルは開いたままにします。ポートが自動で変わったり、既に使用中と出たりしたら止まって相談します。


### D2. Mastraを起動する


**操作する場所：VS Code →「ターミナル」→「新しいターミナル」**


新しく開いたターミナルで `pwd` を実行し、末尾が `kimarogu-public` であることを確認します。PowerShellを選びます。

違う場所なら、エクスプローラーの最上位の `kimarogu-public` を右クリック→「統合ターミナルで開く」でルートのターミナルを開き直します。

フォルダへ移動します。

```powershell
Set-Location mastra
```

起動します。

```powershell
npm.cmd run dev
```


**成功の目安：** `ready` と `http://localhost:4111`が出ること。このターミナルは開いたままにします。ポートが自動で変わったり、既に使用中と出たりしたら止まって相談します。


### D3. Next.jsを起動する


**操作する場所：VS Code →「ターミナル」→「新しいターミナル」**


新しく開いたターミナルで `pwd` を実行し、末尾が `kimarogu-public` であることを確認します。PowerShellを選びます。

違う場所なら、エクスプローラーの最上位の `kimarogu-public` を右クリック→「統合ターミナルで開く」でルートのターミナルを開き直します。

フォルダへ移動します。

```powershell
Set-Location frontend
```

起動します。

```powershell
npm.cmd run dev -- --port 3000
```


**成功の目安：** `Ready` と `http://localhost:3000`が出ること。このターミナルは開いたままにします。ポートが自動で変わったり、既に使用中と出たりしたら止まって相談します。


### D4. APIとDBの接続を確認する


**操作する場所：Chromeのアドレスバー**


次のURLを1つずつ開きます（ターミナルへ貼るのではなく、Chrome上部のURL欄に入力してEnter）。

1. `http://127.0.0.1:8001/api/health`
2. `http://127.0.0.1:8001/api/health/db`
3. `http://localhost:4111`


**成功の目安：** 1で `{"status":"ok"}`、2で `{"database":"ok"}`。3でMastra Studioが表示され、チャット・抽出Agentと抽出Workflowを確認できること。表示のレイアウトは環境により異なります。


## E. Googleログインと所属ユーザー登録（初回だけ）

### E1. Googleログインする


**操作する場所：Chrome**


`http://localhost:3000` を開きます。「Googleでログイン」を押し、自分の検証用Googleアカウントを選びます。

Googleアカウントのパスワードや2段階認証が必要な場合は本人が操作します。認証後に「利用権限がありません」と出ても、初回はローカルDBに未登録の可能性があります。E2へ進みます。


**成功の目安：** Googleの認証を完了できること。認証自体で失敗した場合はB6・B7を確認します。既にチーム名付きチャットが開く場合はユーザー登録済みなので、E2〜E4を繰り返さずFへ進みます。


### E2. 4人分の登録情報を準備する

自分で管理するFirebase Authenticationに登録した、検証用アカウント4件のUIDを本人が確認します。
Googleログインとアプリの所属登録は別です。元チームのUIDや実データは配布していません。
現行の `backend/scripts/seed_team.py` は重複しないUID4件を要求します。
4件を用意できない場合、このスクリプトのままでは初回登録を完了できません。
下の見本UIDは説明用です。そのままDBへ登録せず、実際に自分が管理する検証用UIDへ置き換えてください。

### E3. 登録ファイルを作って保存する


**操作する場所：VS Code左側 → `backend` を右クリック**


「新しいファイル」を選び、名前を **`seed-users.json`** とします。既にある場合は新規作成せず内容を本人が確認します。

新規ファイルには次を貼り、UIDの見本文字列だけを実際の値へ置き換えます。表示名もチームで確認したものにそろえます。

```json
{
  "team_name": "検証用チーム",
  "users": [
    { "firebase_uid": "REPLACE_WITH_TEST_UID_1", "name": "検証ユーザー1", "role": "member" },
    { "firebase_uid": "REPLACE_WITH_TEST_UID_2", "name": "検証ユーザー2", "role": "member" },
    { "firebase_uid": "REPLACE_WITH_TEST_UID_3", "name": "検証ユーザー3", "role": "member" },
    { "firebase_uid": "REPLACE_WITH_TEST_UID_4", "name": "検証ユーザー4", "role": "member" }
  ]
}
```

**Ctrl + S** で保存します。下部の文字コードがUTF-8であることを確認します。違う場合は文字コードをクリック→「エンコード付きで保存」→UTF-8を選びます。全角の引用符や末尾の余分なカンマは付けません。


**成功の目安：** `backend/seed-users.json` として保存済みで、4つのUIDが実際の値になっていること。このファイルはgitignore対象です。


### E4. 入力確認後、ローカルDBへ登録する


**操作する場所：C9の準備用ターミナル・ルートから開始**


まず移動します。

```powershell
Set-Location backend
```

入力内容の確認だけを行います。

```powershell
uv run python -m scripts.seed_team --file seed-users.json
```

「入力内容の確認成功。DBは変更していません」と出たら、B5が自分のPCの5435のDBであることを再確認します。その後に、次を実行します。

```powershell
uv run python -m scripts.seed_team --file seed-users.json --apply
```


**成功の目安：** 「初期登録処理を実行しました」が出ること。同じUIDは重複登録せず、別チーム所属なら中止します。既存ユーザーの名前・roleは更新しないため、違いがある場合は削除せず相談します。


### E5. 所属の反映を確認する


**操作する場所：Chrome → localhost:3000のタブ**


ページを再読み込みします。まだログイン画面ならGoogleでログインします。


**成功の目安：** チーム名付きのチャット画面が開くこと。403のままなら、Googleアカウント・登録UID・FastAPI接続先を担当者と確認します。


## F. 架空の議事録で保存・検索まで確認する

### F1. 議事録を入力する


**操作する場所：Chromeのアドレスバー**


`http://localhost:3000/minutes` を開きます。各PCで下記を1回だけ登録します。実際の議事録や個人情報は使いません。AI呼び出しでOpenRouterの利用が発生します。

- タイトル：`環境確認用・架空の会議 10/27`
- 会議の日時：`2026/10/27 12:00`（画面の日時選択で日本時間の年月日・時刻を指定）
- 議事録欄へ貼る本文：

```text
2026年10月27日の架空の確認会議。
環境確認用の目印は「紫のテスト旗」に決定した。
理由は、動作確認のデータを実際の会議と区別しやすくするため。
動作確認用READMEを書く担当と期限は未定。
```


**成功の目安：** 3つの欄が埋まり、「AIで整理する」が押せること。画面間リンクがなくてもURLを直接開いて構いません。


### F2. AIの抽出結果を確認する


**操作する場所：Chrome → 議事録画面**


「AIで整理する」を1回押し、結果を待ちます。決定事項が「紫のテスト旗」になっているか、本文にない内容が増えていないか確認します。必要なら結果欄を直します。


**成功の目安：** 要約・決定事項・未決事項・ToDoの確認画面が表示されること。AIの表現は毎回少し変わる場合があります。


### F3. 保存する


**操作する場所：Chrome → 抽出結果の確認画面**


「保存する」を1回押します。処理が終わるまで待ちます。


**成功の目安：** 「保存できました」が出て、AI検索への登録失敗の警告がないこと。警告があれば、再保存を繰り返さず番号F3で相談します。RAG登録だけが失敗した場合は、原因を直してから表示中の「再試行」を押せます。議事録の保存は繰り返しません。ページを再読み込みすると再試行ボタンの状態は失われるため、先に相談してください。


### F4. 保存した議事録を検索する


**操作する場所：Chromeのアドレスバー**


`http://localhost:3000` を開き、質問欄へ **「環境確認用の目印は何に決まりましたか？」** と入力して送信します。


**成功の目安：** 「紫のテスト旗」と答え、関連する議事録に入力したタイトルと2026-10-27が表示されること。ほかのPCで保存した議事録は自分のPCには自動で入らないため、各PCでF1〜F3を実施します。


### F5. 確認結果を記録する

OS・Nodeの版・完了した手順番号・失敗内容を非公開のローカルメモへ記録します。
秘密情報や個人情報は記録しません。

## G. 次の日からの起動（初回準備を繰り返さない）

1. VS Codeで `kimarogu-public` を開きます（A2）。
2. Docker Desktopを起動します（B1）。
3. ルートの準備用ターミナルで `docker compose up -d db`、続いて `docker compose ps` を実行し、healthyを確認します。
4. D1〜D3のとおり、新しいターミナルを3つ開きFastAPI・Mastra・Next.jsを起動します。
5. Chromeで `http://localhost:3000` を開きます。必要ならGoogleでログインします。
6. 前に保存した議事録を質問して、検索できるか確認します。サンプルの再保存は不要です。

毎回のnpm ci・uv sync・マイグレーション・ユーザー初期登録は不要です。コードや依存が更新されたときだけ、担当者の案内に従います。

## H. 終了する

1. 3つのサーバーのターミナルをそれぞれクリックし、**Ctrl + C** を押します（MacもControlキーです）。入力待ちの状態に戻れば停止です。Windowsで終了確認が出た場合は内容を確認して終了します。
2. 準備用ターミナルで `pwd` を確認します。backendなどの中なら `Set-Location ..` でルートへ戻します。
3. ルートで次を実行します。

```powershell
docker compose stop db
```

**成功の目安：** DBがStoppedになり、`docker compose ps` に起動中のDBが出なくなること。保存データは残ります。`docker compose down -v` はデータを消すので実行しません。PCを閉じる前にVS Codeの編集もCtrl + Sで保存します。

## I. 詰まったとき

|症状|確認する番号・内容|
|---|---|
|コマンドが見つからない|A4。どのツールがないか伝える|
|DB認証エラー|B3・B5・B8。既存DB作成時のパスワードか|
|Firebase鍵が見つからない|B4・B5。backendから起動したか|
|Firebase invalid-api-key|B6・B7。4項目の値とNext.js再起動|
|ログイン後403|E2〜E5。本人のUIDとこのPCの所属登録|
|テーブルがない|C6。alembic currentがheadか|
|RAG登録失敗|B7・B8。共有値一致、Mastra起動、OpenRouterキー|
|検索で見つからない|F3。このPCでRAG登録まで成功したか|
|ポート使用中・4112へ変わる|既存サーバーを勝手に止めず相談|
|npm.ps1の実行が禁止|Windowsではnpm.cmdを使う。実行ポリシーは変更しない|

設定を直した場合は、そのサービスだけHのCtrl+Cで停止し、Dの対応する起動コマンドを再実行します。

相談文の例：

```text
【環境構築】
OS / Node：
コピーの版・手順番号：
止まった番号：
ターミナルの場所（pwdの末尾）：
症状・エラー名（秘密情報は伏せる）：
```

この公開用コピーの通常ポートはDB5435・FastAPI8001・Mastra4111・Next.js3000です。別の開発環境と同時に起動せず、既存サービスとDBを確認してから使用してください。
