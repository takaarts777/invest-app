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

`.env` を開いて以下を設定してください:

| 変数 | 内容 | 取得方法 |
| --- | --- | --- |
| `DATABASE_URL` | Postgresの接続URL（プールあり） | [Neon](https://neon.tech)（無料枠）等でプロジェクト作成後、ダッシュボードの接続文字列（`-pooler`付き）をコピー |
| `DIRECT_URL` | Postgresの接続URL（プールなし、`prisma migrate`専用） | 同じダッシュボードの接続文字列から`-pooler`を外したもの |
| `SESSION_SECRET` | セッションCookie署名用の秘密鍵 | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `ENCRYPTION_KEY` | 各ユーザーのAnthropic APIキーをDBに暗号化保存するための鍵 | `SESSION_SECRET`と同じコマンドで生成 |
| `FINNHUB_API_KEY` | 米国株/ETFのファンダメンタルズ分析（PER/ROE等）用 | https://finnhub.io/register で無料登録 |
| `CRON_SECRET` | Vercel Cronからの定期再分析リクエストを認証する秘密鍵 | 任意の文字列（ローカルではそのままでOK） |

※ Vercelのファイルシステムは永続化されないため、ローカル開発も含めて最初からPostgresを使う
構成にしています（SQLiteは使いません）。ローカル用とVercel用で同じNeon DBを共有しても、
別々に用意してもどちらでも構いません（プロトタイプ運用なら同じもので十分です）。

※ ウォッチリストへの銘柄追加・価格チャート表示・暗号資産のファンダメンタルズ分析は
`FINNHUB_API_KEY`なしでも動きます（Yahoo Finance非公式APIとCoinGeckoはキー不要）。
未設定の場合、ファンダメンタルズ分析パネルには「未設定」の案内が表示され、
総合判定は残りの軸だけで算出されます（アプリは壊れません）。

**AnthropicのAPIキーはアプリ全体で共有せず、ユーザーごとに個別設定**します（ログイン後の
「設定」ページから、各ユーザーが自分のAnthropicアカウントで取得したキーを登録）。こうすること
で、ニュースセンチメント要約・買い時/売り時の根拠説明を生成するたびの利用料が、アプリを動かして
いる人ではなく実際に分析を実行したユーザー自身に請求されます。キー未設定のユーザーもアプリ自体
は問題なく使え、AI生成部分だけ「未設定」の案内に置き換わります。

### 2. インストール & DB初期化

```bash
npm install
npx prisma migrate dev
```

### 3. 起動

```bash
npm run dev
```

http://localhost:3000 を開いてください。**初回はユーザーが0件のため自動的に`/setup`へ案内され、
最初のアカウント(ユーザー名・パスワード)を作成**できます。2人目以降のユーザーは、ログイン後の
「ユーザー管理」ページから追加できます。各ユーザーのウォッチリスト・ポートフォリオは完全に独立しています。

## 本番デプロイ（Vercel、スマホからも外出先アクセス）

上のセットアップですでにPostgres（Neon）を使っているので、DBの切り替え作業は不要です。

1. GitHubにpushし、[Vercel](https://vercel.com) でプロジェクトをインポート
2. Vercelの環境変数に `.env` と同じキー（`DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `ENCRYPTION_KEY`, `FINNHUB_API_KEY`, `CRON_SECRET`）を設定
   （`ANTHROPIC_API_KEY`は不要——各ユーザーがログイン後の「設定」ページで自分のキーを登録します）
3. デプロイ後に発行されるURLへスマホ・PCどちらからでもアクセス可能

### 定期更新（Vercel Cron）

`vercel.json` に `/api/cron/refresh` を毎日13:00 UTC（日本時間22:00、米国市場引け後）に
叩く設定を入れてあります。Vercelがこのリクエストに自動で `Authorization: Bearer
$CRON_SECRET` ヘッダーを付与するので、`CRON_SECRET` 環境変数を設定しておけば追加設定なしで
動作します。頻度を変えたい場合は `vercel.json` の `schedule`（cron式）を編集してください
（Hobbyプランはcronの実行頻度に制限があるため、頻繁に変えたい場合はProプランが必要です）。

### アプリのアップデート方法（開発 → 本番反映の流れ）

VercelはGitHubリポジトリと連携しているので、**`main`ブランチにpushするだけで自動的に
再ビルド・再デプロイ**されます。手動でVercelを操作する必要はありません。

1. ローカルでコードを変更する
2. `npm run dev` で `http://localhost:3000` を開いて動作確認する
   （このとき使われるのは`.env`の`DATABASE_URL`＝本番と同じNeonのDBなので、確認用に自分の
   アカウントで軽く操作する程度にし、本番の友人データを壊すような大きな変更は避ける）
3. 問題なければコミットしてpush:
   ```bash
   git add -A
   git commit -m "変更内容の説明"
   git push
   ```
4. Vercelが自動でビルドを開始します（Vercelダッシュボードの「Deployments」タブで進捗確認可能）。
   数十秒〜数分で本番URLに反映されます

**データベースの構造を変更した場合**（`prisma/schema.prisma`を編集した場合）は、pushする前に
ローカルで以下を実行してマイグレーションファイルを作成してください:

```bash
npx prisma migrate dev --name 変更内容が分かる名前
```

これによって`prisma/migrations/`配下に新しいSQLファイルが作られます。これを他のコード変更と
一緒にコミット・pushすれば、Vercel側のビルド時に自動で本番DBへ適用されます
（`package.json`の`vercel-build`スクリプトが`prisma migrate deploy`を実行してからビルドする
設定になっているため、Vercelの画面上で手動操作する必要はありません）。

もしVercel上のビルドが失敗した場合は、ダッシュボードの「Deployments」→失敗したデプロイ→
「Build Logs」でエラー内容を確認できます。

## 自分のVPSへのデプロイ（プロトタイプ・友人とのテスト運用向け）

**注意**: ロリポップ・ConoHa WINGなどのPHP系共有ホスティングは、Node.jsの常駐プロセス
（SSH経由でのポート待受・バックグラウンドプロセス実行）を許可していないため、このアプリは
デプロイできません。代わりに月数百円〜のLinux VPSを1台契約してください。既に独自ドメインを
お持ちなら、そのドメインのサブドメイン（例: `invest.example.com`）をVPSに向けるだけでよく、
新規のドメイン取得は不要です。

候補（Ubuntu 22.04/24.04 LTSが選べるもの。価格は目安・変動あり）:
- ConoHa VPS（時間課金あり、最小構成 月額700円前後〜）
- さくらのVPS（月額850円前後〜）
- AWS Lightsail（月$3.5前後〜）

### 0. サーバーの初期設定

契約後に発行されたIPアドレスへSSH接続し、rootを直接使わず作業用ユーザーを作成:

```bash
ssh root@<サーバーのIPアドレス>
adduser deploy
usermod -aG sudo deploy
su - deploy
```

ファイアウォールでSSH・HTTP・HTTPSのみ許可:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw enable
```

### 1. Node.js・git・Nginxをインストール

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx
node -v   # v20.x であることを確認
```

### 2. アプリをサーバーに配置

このプロジェクトをGitHub等のプライベートリポジトリにpushしておき、VPS上でcloneするのが
一番簡単です:

```bash
cd ~
git clone https://github.com/<あなたのアカウント>/<リポジトリ名>.git investapp
cd investapp
```

（GitHubを使わない場合は、ローカルPCから `scp -r`（`node_modules`は除く）でフォルダごと
転送しても構いません。）

### 3. 本番用の環境変数を設定

```bash
cp .env.example .env
nano .env
```

`SESSION_SECRET`・`ENCRYPTION_KEY`はローカルの値を使い回さず、本番用に新しく生成してください
（下のコマンドを2回実行し、それぞれ別の値を使う）:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

| 変数 | 値 |
| --- | --- |
| `DATABASE_URL` | ローカル/Vercelと同じNeonの接続URL（プールあり）を流用可 |
| `DIRECT_URL` | 同上（プールなし） |
| `SESSION_SECRET` | 上記コマンドで新規生成した値 |
| `ENCRYPTION_KEY` | 上記コマンドで新規生成した値（`SESSION_SECRET`とは別の値） |
| `FINNHUB_API_KEY` | ローカルと同じ無料キーを流用可 |
| `CRON_SECRET` | 任意のランダム文字列 |

### 4. インストール・DB作成・ビルド

```bash
npm install
npx prisma migrate deploy
npm run build
```

（`migrate deploy`はローカル開発用の`migrate dev`と違い、既存のマイグレーションファイルを
そのまま適用するだけの本番向けコマンドで、対話プロンプトを出しません。）

### 5. PM2で常駐プロセス化

```bash
sudo npm install -g pm2
pm2 start npm --name investapp -- start
pm2 save
pm2 startup   # 表示されるコマンドをコピーして実行（サーバー再起動時の自動起動設定）
```

### 6. ドメインのDNS設定

ドメインの管理画面で、サブドメイン（例: `invest.example.com`）のAレコードをVPSのIP
アドレスに向けます。反映まで数分〜数十分かかることがあります。

### 7. Nginxをリバースプロキシとして設定

```bash
sudo nano /etc/nginx/sites-available/investapp
```

```nginx
server {
    listen 80;
    server_name invest.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/investapp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 8. HTTPS化（Let's Encrypt、無料）

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d invest.example.com
```

証明書は自動更新されます（`sudo certbot renew --dry-run` で確認可）。

### 9. 動作確認

`https://invest.example.com` を開くと自動的に`/setup`へ案内されるので、最初のアカウント
（あなた自身）を作成してください。ログイン後、「ユーザー管理」ページから友人用のアカウントを
作成し、ユーザー名・初期パスワードを伝えてください。

### 10. 定期更新（任意、Vercel Cronの代わり）

```bash
sudo timedatectl set-timezone Asia/Tokyo
crontab -e
```

```cron
0 22 * * * curl -s -H "Authorization: Bearer <CRON_SECRETの値>" https://invest.example.com/api/cron/refresh
```

### 今後の更新方法

コードを更新したら、サーバー上で:

```bash
cd ~/investapp
git pull
npm install
npx prisma migrate deploy
npm run build
pm2 restart investapp
```

### 運用上の注意（プロトタイプ運用）

- データはVPSのディスクではなくNeon（Postgres）側に保存されるので、VPSを作り直してもデータは
  消えません。Neonの無料枠にも一応バックアップ機能はありますが、本格運用する場合は有料プランの
  Point-in-time restore等も検討してください。
- 友人が数人使う程度ならFinnhub無料枠（1分60リクエスト）で十分ですが、人数が増えると制限に
  当たる可能性があります。
- Anthropic APIキーは各ユーザーが自分の「設定」ページで登録する方式なので、友人の分析コストを
  あなたが負担することはありません（未設定でも他の分析機能は使えます）。

## 開発メモ

- Next.js 16 を使用しており、`middleware.ts` は `src/proxy.ts` に名称変更されているなど従来と異なる点があります。詳細は [CLAUDE.md](./CLAUDE.md) を参照してください。
- Prisma は **6.19.3 に固定**しています。`npm install prisma@latest` は実行しないでください（7系以降はCLI・設定方法が大きく変わり不安定なため）。
