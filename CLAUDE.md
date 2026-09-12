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
- 外部データ:
  - Yahoo Finance非公式API（無料・キー不要）: `/v8/finance/chart/` で米国株/ETFの現在値・日足ヒストリカル・銘柄名、`/v1/finance/search` でニュース見出し（株/ETF/暗号資産共通。暗号資産はティッカーでなく`displayName`で検索する方が精度が良い）。`/v10/finance/quoteSummary`は401で使用不可（crumb認証が必要になったため不採用）。Stooqはボット判定JSチャレンジを返すため不採用。
  - CoinGecko（無料・キー不要）: 暗号資産の価格・日足ヒストリカル（`/coins/{id}/ohlc`）・ファンダメンタルズ相当データ（`/coins/{id}` — 時価総額ランク・ATHからの乖離・供給量等）
  - Finnhub（`FINNHUB_API_KEY`必須）: 株/ETFのファンダメンタルズ（`/stock/metric?metric=all` — PER/PBR/ROE/売上成長率等）。企業ニュース取得用の`fetchCompanyNews`も実装済みだが現状はYahoo検索で代替しており未使用。
  - Anthropic Claude（`ANTHROPIC_API_KEY`必須、`claude-sonnet-5`）: ニュース見出しからのセンチメントスコア算出、4軸分析結果を根拠にした買い時/売り時の説明文生成。どちらもキー未設定時は例外を投げず「未設定」を示すエラー/メッセージにフォールバックする。
- Anthropic SDK（Claude — センチメント判定・シグナル根拠説明。フェーズ5以降で使用）

## Next.js 16 の注意点（従来バージョンと異なる点）

- `middleware.ts` は廃止され `proxy.ts`（`src/proxy.ts`）に名称変更。関数名も `middleware` → `proxy`。
- ルートハンドラの `context.params` は `RouteContext<'/path/[id]'>` ヘルパー型で受け取れる（`ctx.params` はPromise）。
- ページ/レイアウトの props は `PageProps<'/path'>` / `LayoutProps<'/path'>` グローバルヘルパー型で受け取れる（`next dev`/`build`時に自動生成）。ルートグループ `(dashboard)` 配下でもURLは変わらないため、キーはURLパスをそのまま使う。
- 詳細は `node_modules/next/dist/docs/` 配下の同梱ドキュメントを参照（バージョン固有の一次情報）。

## 認証

マルチユーザー対応（`User`モデル、`src/lib/users.ts`, `src/lib/session.ts`, `src/proxy.ts`）。
各ユーザーは完全に別データ（`WatchlistItem.userId`で分離）を持つ。`.env`の`APP_PASSWORD`は**廃止済み**——
パスワードはユーザーごとに`bcryptjs`でハッシュ化してDB(`User.passwordHash`)に保存する。

- 初回のみ `/setup`（ユーザー0件の時だけ有効。`userCount()>0`なら`/login`へリダイレクト）で最初のアカウントを作成
- 2人目以降は認証済みの `/users` ページ（`UserManagement.tsx`、`/api/users`）から追加・削除
- ログイン成功時、セッションJWTのペイロードは`{ userId, expiresAt }`（旧`{ authenticated: true }`から変更）
- **API Routesは`proxy.ts`の対象外**（matcherで`/api`を除外）。各Route Handlerが個別に`getSessionUserId()`を呼び、
  返ってきた`userId`で`lib/market.ts`等のデータアクセス関数を必ずスコープすること。`isAuthenticated()`（真偽値のみ）も残っているが、
  データを扱うルートでは使わず`getSessionUserId()`を使う——でないとユーザー間のデータ漏洩になる
- `lib/market.ts`の`getWatchlistItem(id, userId)`等は`{id, userId}`両方でフィルタし、他人のIDを指定されても
  存在しないのと同じ404を返す（`findFirst`/`deleteMany`/`updateMany`で件数0なら`NotFoundError`）。新しいデータアクセス関数を
  追加する際は必ずこのパターンを踏襲すること
- `listAllWatchlistItemsForCron()`だけは全ユーザー分を返す例外（Vercel Cronの一括再分析専用、`CRON_SECRET`で保護）。
  リクエストスコープのハンドラから絶対に呼ばないこと

## ディレクトリ構成

```
src/
  app/
    setup/            # 初回のみ: ユーザー0件の時だけ有効なアカウント作成ページ
    login/             # ログインページ（ユーザー名+パスワード）+ Server Action
    (dashboard)/        # 認証必須エリア（共通ヘッダー付きレイアウト）
      page.tsx           # ダッシュボード（ZBT/市場概況/金利予測/経済指標カレンダー/
                          # セクターヒートマップ + 自分のウォッチリスト）
      portfolio/          # 保有中の銘柄の評価額・含み損益・アロケーション
      simulator/           # 疑似売買シミュレーター（元手¥500,000、実際の資産は動かない）
      ticker/[id]/         # 銘柄詳細（チャート + 4軸分析パネル + 保有情報フォーム）
      users/                # ユーザー管理（追加・削除、UserManagement.tsx）
    api/
      watchlist/         # 銘柄の一覧取得・追加・削除（全てuserIdでスコープ）
      watchlist/[id]/     # 削除、PATCH（保有数量・平均取得単価の設定/解除）
      prices/[id]/        # 価格ヒストリー + 現在値
      analyze/[id]/        # 4軸分析パイプラインを実行しAnalysisSnapshotを保存
      search-ticker/        # 銘柄名/ティッカーのオートコンプリート検索
      users/                # ユーザー一覧取得・追加
      users/[id]/            # ユーザー削除（自分自身は削除不可）
      rate-predictor/         # 2年債利回り vs 短期金利
      zbt/                     # ZBT(Zweig Breadth Thrust)指標
      simulator/                # 口座サマリー取得（GET）
      simulator/trade/            # 疑似売買の実行（POST、買い/売り）
      simulator/reset/              # 口座を元手¥500,000にリセット（POST）
      cron/refresh/             # Vercel Cronからの定期一括再分析（CRON_SECRET必須、全ユーザー対象）
  lib/
    db.ts               # Prisma Client シングルトン
    session.ts           # セッション作成/検証（jose）。ペイロードは{userId, expiresAt}
    users.ts              # ユーザーCRUD・ログイン検証（bcryptjs）
    actions.ts             # 共通Server Actions（ログアウト等）
    market.ts               # ウォッチリストCRUD + 価格取得の統合ロジック（全関数userIdスコープ必須）
    portfolio.ts              # 保有銘柄の評価額・含み損益・アロケーション集計
    simulator.ts               # 疑似売買（買い/売り/リセット）、加重平均取得単価の計算（"server-only"）
    simulator-constants.ts      # STARTING_CASH_JPY（¥500,000）。simulator.tsから分離し、
                                 # クライアントコンポーネントがserver-onlyな依存を巻き込まず参照できるようにしている
    signal-badge.ts            # 総合判定ラベルの色分けマップ（複数コンポーネントで共有）
    snapshots.ts                # AnalysisSnapshotの取得ヘルパー
    market-overview.ts           # ダッシュボードの市場全体参考指標（Fear&Greed等）
    sector-heatmap.ts              # セクターETF11本の値動きヒートマップ
    rate-predictor.ts                # 2年債利回り vs 短期金利
    zbt.ts                             # ZBT指標の計算
    data/                                # 静的な参照データ（セクターETF、S&P500近似ユニバース等）
    providers/                            # 外部API個別クライアント（yahoo/coingecko/finnhub/
                                           # cnnfeargreed/feargreed/forex）
    analysis/                             # 分析ロジック本体
      technical.ts                         # テクニカル指標（SMA/EMA/RSI/MACD/BB）→ -1..1スコア
      fundamental.ts                        # PER/ROE等（株/ETF）、時価総額ランク等（暗号資産）→ スコア
      sentiment.ts                           # ニュース見出し取得 + Claudeでセンチメントスコア化
      smartmoney.ts                           # インサイダー取引（Smart Money）
      anomaly.ts                               # 出来高/価格急変・カレンダー効果・レバレッジ減価リスク・
                                                # 移動平均乖離・RSI底値の過去傾向比較・ダイバージェンス
      signal.ts                                # 5軸を重み付け合成 + Claudeで根拠説明文を生成
  components/            # UIコンポーネント（AnalysisPanelsが分析結果の表示を担当）
prisma/
  schema.prisma          # User, WatchlistItem, AnalysisSnapshot,
                          # SimulatorAccount/SimulatorPosition/SimulatorTrade
```

## セットアップ

1. `.env.example` を `.env` にコピーし、値を設定（`FINNHUB_API_KEY`, `ANTHROPIC_API_KEY` は無料登録して取得。
   `APP_PASSWORD`はマルチユーザー化に伴い廃止済みで不要）
2. `npm install`
3. `npx prisma migrate dev` — ローカルSQLite DBを作成
4. `npm run dev` — http://localhost:3000 を開くと、ユーザーが0件なら自動で`/setup`に案内される
   （初回アカウント作成後は通常のログイン画面。2人目以降は`/users`から追加）

## 実装状況

- [x] フェーズ1: プロジェクト初期化
- [x] フェーズ2: 認証・共通レイアウト
- [x] フェーズ3: ウォッチリストCRUD + 価格チャート
- [x] フェーズ4: テクニカル・ファンダメンタル分析
- [x] フェーズ5: センチメント・アノマリー分析
- [x] フェーズ6: シグナル統合（買い時/売り時 + LLM根拠説明）
- [x] フェーズ7: 定期更新（Vercel Cron設定済み、`vercel.json`）・デプロイ手順（README）

- [x] フェーズ8: マルチユーザー化（`User`モデル、`/setup`初回登録、`/users`管理画面、
  全データアクセス関数のuserIdスコープ化）— 単一パスワード方式から移行済み
- [x] フェーズ9: 投資シミュレーター（`/simulator`。ユーザーごとに元手¥500,000の疑似口座を
  1つ持ち、実際の現在値×都度取得のUSD/JPYレートで疑似売買。加重平均取得単価で確定損益/含み損益を分離)

全フェーズの土台は完成。残っているのはユーザー側の作業（Finnhub/AnthropicのAPIキー取得、
Postgresへの切り替え、Vercelへの実デプロイ）と、実運用しながらのスコアリング重み・
閾値のチューニング。
