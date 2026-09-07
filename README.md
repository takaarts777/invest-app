# 投資アナリティクス Web アプリ

米国株・暗号資産・レバレッジETFのウォッチリストを管理し、テクニカル／ファンダメンタル／
ニュースセンチメント／アノマリーの4軸で分析、それらを重み付け合成した買い時・売り時の
目安（強い買い〜強い売り）とAIによる根拠説明を表示する個人用アプリ。

技術構成やディレクトリ構成、実装フェーズの進捗は [CLAUDE.md](./CLAUDE.md) を参照してください。

## セットアップ（ローカル開発）

### 1. 必要な環境変数を用意する

```bash
cp .env.example .env
```

`.env` を開いて以下を設定してください（`DATABASE_URL` はSQLiteなのでそのままでOK）:

| 変数 | 内容 | 取得方法 |
| --- | --- | --- |
| `APP_PASSWORD` | ログインパスワード | 任意の文字列に変更 |
| `SESSION_SECRET` | セッションCookie署名用の秘密鍵 | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `FINNHUB_API_KEY` | 米国株/ETFのファンダメンタルズ分析（PER/ROE等）用 | https://finnhub.io/register で無料登録 |
| `ANTHROPIC_API_KEY` | ニュースセンチメント判定・買い時/売り時の根拠説明生成用 | https://console.anthropic.com/ |
| `CRON_SECRET` | Vercel Cronからの定期再分析リクエストを認証する秘密鍵 | 任意の文字列（ローカルではそのままでOK） |

※ ウォッチリストへの銘柄追加・価格チャート表示・暗号資産のファンダメンタルズ分析は
`FINNHUB_API_KEY`/`ANTHROPIC_API_KEY`なしでも動きます（Yahoo Finance非公式APIとCoinGeckoは
キー不要）。この2つのキーが未設定の場合、対応する分析パネルには「未設定」の案内が表示され、
総合判定は残りの軸だけで算出されます（アプリは壊れません）。

### 2. インストール & DB初期化

```bash
npm install
npx prisma migrate dev
```

### 3. 起動

```bash
npm run dev
```

http://localhost:3000 を開き、`.env` の `APP_PASSWORD` でログインしてください。

## 本番デプロイ（Vercel、スマホからも外出先アクセス）

1. **DBをPostgresに切り替える**（Vercelのファイルシステムは永続化されないためSQLiteは使えません）
   - [Neon](https://neon.tech)（無料枠あり）などでPostgresデータベースを作成し、接続URLを控える
   - `prisma/schema.prisma` の `datasource db` を以下に変更:
     ```prisma
     datasource db {
       provider = "postgresql"
       url      = env("DATABASE_URL")
     }
     ```
   - `DATABASE_URL` をPostgresの接続URLに差し替えて `npx prisma migrate dev` を再実行（新しいマイグレーション履歴が作られます）
2. GitHubにpushし、[Vercel](https://vercel.com) でプロジェクトをインポート
3. Vercelの環境変数に `.env` と同じキー（`DATABASE_URL`, `APP_PASSWORD`, `SESSION_SECRET`, `FINNHUB_API_KEY`, `ANTHROPIC_API_KEY`, `CRON_SECRET`）を設定
4. デプロイ後に発行されるURLへスマホ・PCどちらからでもアクセス可能

### 定期更新（Vercel Cron）

`vercel.json` に `/api/cron/refresh` を毎日13:00 UTC（日本時間22:00、米国市場引け後）に
叩く設定を入れてあります。Vercelがこのリクエストに自動で `Authorization: Bearer
$CRON_SECRET` ヘッダーを付与するので、`CRON_SECRET` 環境変数を設定しておけば追加設定なしで
動作します。頻度を変えたい場合は `vercel.json` の `schedule`（cron式）を編集してください
（Hobbyプランはcronの実行頻度に制限があるため、頻繁に変えたい場合はProプランが必要です）。

## 開発メモ

- Next.js 16 を使用しており、`middleware.ts` は `src/proxy.ts` に名称変更されているなど従来と異なる点があります。詳細は [CLAUDE.md](./CLAUDE.md) を参照してください。
- Prisma は **6.19.3 に固定**しています。`npm install prisma@latest` は実行しないでください（7系以降はCLI・設定方法が大きく変わり不安定なため）。
