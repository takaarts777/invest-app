@AGENTS.md

# 投資アナリティクス Web アプリ

個人用の投資分析Webアプリ。米国株・暗号資産・レバレッジETFのウォッチリストを管理し、
テクニカル／ファンダメンタル／ニュースセンチメント／アノマリーの4軸で分析、
ルールベース判定 + Claude(LLM)による根拠説明付きの買い時・売り時シグナルを表示する。

詳細な設計・実装フェーズは元計画を参照: `C:\Users\artis\.claude\plans\happy-snacking-cloud.md`

## スタック

- Next.js 16 (App Router, TypeScript) — フロント + API Routes (Route Handlers)
- Tailwind CSS v4
- Prisma **6.19.3** ORM（**7.x以降のRC/新CLIは使わないこと** — `datasource.url` 廃止やdriver adapter必須化など破壊的変更があり不安定。`package.json`でバージョン固定済み）
- SQLite（ローカル開発用。本番/Vercelデプロイ時は `prisma/schema.prisma` の datasource を `postgresql` に切り替え、Neon等のURLを`DATABASE_URL`に設定する）
- lightweight-charts v5（価格チャート。`chart.addSeries(CandlestickSeries, options)` のv5 API）
- jose（セッションCookieのJWT署名/検証）
- 外部データ: Yahoo Finance非公式チャートAPI（米国株/ETFの現在値・日足ヒストリカル・銘柄名、無料・キー不要。`query1.finance.yahoo.com/v8/finance/chart/`。Stooqは現在ボット判定JSチャレンジを返すため不採用）、CoinGecko（暗号資産の価格・ヒストリカル、無料・キー不要）、Finnhub（今後のファンダメンタルズ/ニュース取得用に導入予定、現状未使用）
- Anthropic SDK（Claude — センチメント判定・シグナル根拠説明。フェーズ5以降で使用）

## Next.js 16 の注意点（従来バージョンと異なる点）

- `middleware.ts` は廃止され `proxy.ts`（`src/proxy.ts`）に名称変更。関数名も `middleware` → `proxy`。
- ルートハンドラの `context.params` は `RouteContext<'/path/[id]'>` ヘルパー型で受け取れる（`ctx.params` はPromise）。
- ページ/レイアウトの props は `PageProps<'/path'>` / `LayoutProps<'/path'>` グローバルヘルパー型で受け取れる（`next dev`/`build`時に自動生成）。ルートグループ `(dashboard)` 配下でもURLは変わらないため、キーはURLパスをそのまま使う。
- 詳細は `node_modules/next/dist/docs/` 配下の同梱ドキュメントを参照（バージョン固有の一次情報）。

## 認証

本人専用のため、アカウント機能はなく単一パスワードのCookie認証のみ（`src/lib/session.ts`, `src/proxy.ts`）。
`.env` の `APP_PASSWORD` と一致すれば `SESSION_SECRET` で署名したJWTをhttpOnly Cookieにセットする。
API Routes は `proxy.ts` の対象外（matcherで `/api` を除外）なので、各Route Handlerが個別に `isAuthenticated()` を呼んで認可すること。

## ディレクトリ構成

```
src/
  app/
    login/            # ログインページ + Server Action
    (dashboard)/       # 認証必須エリア（共通ヘッダー付きレイアウト）
      page.tsx          # ダッシュボード（ウォッチリスト）
      ticker/[id]/       # 銘柄詳細（チャート + 分析パネル）
    api/
      watchlist/         # 銘柄の一覧取得・追加・削除
      prices/[id]/        # 価格ヒストリー + 現在値
  lib/
    db.ts               # Prisma Client シングルトン
    session.ts           # セッション作成/検証（jose）
    actions.ts            # 共通Server Actions（ログアウト等）
    market.ts              # ウォッチリストCRUD + 価格取得の統合ロジック
    providers/               # 外部API個別クライアント（finnhub/stooq/coingecko）
    analysis/                 # テクニカル/ファンダメンタル/センチメント/アノマリー/シグナル統合（フェーズ4以降）
  components/            # UIコンポーネント
prisma/
  schema.prisma          # WatchlistItem, AnalysisSnapshot
```

## セットアップ

1. `.env.example` を `.env` にコピーし、値を設定（`FINNHUB_API_KEY`, `ANTHROPIC_API_KEY` は無料登録して取得）
2. `npm install`
3. `npx prisma migrate dev` — ローカルSQLite DBを作成
4. `npm run dev` — http://localhost:3000 （ログインパスワードは `.env` の `APP_PASSWORD`）

## 実装状況

- [x] フェーズ1: プロジェクト初期化
- [x] フェーズ2: 認証・共通レイアウト
- [x] フェーズ3: ウォッチリストCRUD + 価格チャート
- [ ] フェーズ4: テクニカル・ファンダメンタル分析
- [ ] フェーズ5: センチメント・アノマリー分析
- [ ] フェーズ6: シグナル統合（買い時/売り時 + LLM根拠説明）
- [ ] フェーズ7: 定期更新（Vercel Cron）・デプロイ
