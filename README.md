# キャリア面談予約システム

CA（キャリアアドバイザー）10人チーム向けのスケジュール予約システムです。求職者が共通URLから面談を予約でき、Googleカレンダー連携・ラウンドロビン割当・Zoom自動生成・Gmail通知を行います。

## 機能

- **共通予約ページ** (`/book`) — 求職者が日時を選択して予約
- **Google Calendar連携** — CA10人のカレンダーから空き枠を集約表示
- **ラウンドロビン割当** — 空いているCAに順番に均等配分
- **Zoom自動生成** — 予約確定時にミーティングリンクを作成
- **メール自動送信** — 確定通知をCA・求職者双方に送信（Gmail API）
- **リマインド** — 前日・1時間前に自動リマインド（Vercel Cron）

## 技術スタック（すべて無料枠で運用可能）

| サービス | 用途 | 無料枠 |
|---------|------|--------|
| Next.js + Vercel | フロント/API/Cron | Hobby プラン |
| Supabase | DB（予約・CA・ラウンドロビン） | Free tier |
| Google Calendar API | 空き枠取得・イベント作成 | 無料 |
| Gmail API | メール送信 | 無料 |
| Zoom API | ミーティング作成 | Basic（40分制限あり） |

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Supabase プロジェクト作成

1. [supabase.com](https://supabase.com) で無料プロジェクトを作成
2. SQL Editor で `supabase/migrations/001_initial.sql` を実行
3. CA10人の `name`, `email`, `google_calendar_id` を実際の値に更新

```sql
UPDATE advisors SET name = '田中太郎', email = 'tanaka@company.com', google_calendar_id = 'tanaka@company.com' WHERE sort_order = 0;
-- ... 残り9人も同様に更新
```

### 3. Google Cloud 設定

#### Calendar API（空き枠・イベント作成）

1. [Google Cloud Console](https://console.cloud.google.com) でプロジェクト作成
2. **Calendar API** と **Gmail API** を有効化
3. **サービスアカウント**を作成し、JSONキーをダウンロード
4. 各CAのGoogleカレンダーをサービスアカウントのメールアドレスと**共有**（「予定の変更権限」以上）

#### Gmail API（メール送信）

Gmail APIで送信するには **Google Workspace** のドメイン全体の委任（Domain-Wide Delegation）が必要です。

1. サービスアカウントにドメイン全体の委任を有効化
2. Workspace管理コンソールで `https://www.googleapis.com/auth/gmail.send` スコープを委任
3. `GMAIL_SENDER_EMAIL` に送信元アドレス（例: `noreply@your-domain.com`）を設定

> **個人Gmailのみの場合**: Workspaceがない環境では Gmail API の代わりに [Resend](https://resend.com)（無料100通/日）等への差し替えを検討してください。

### 4. Zoom Server-to-Server OAuth

1. [Zoom Marketplace](https://marketplace.zoom.us) で Server-to-Server OAuth アプリを作成
2. スコopes: `meeting:write:admin`, `user:read:admin`
3. Account ID / Client ID / Client Secret を `.env` に設定

### 5. 環境変数

```bash
cp .env.example .env.local
```

`.env.local` を編集して各値を設定します。

### 6. ローカル起動

```bash
npm run dev
```

http://localhost:3000/book で予約ページを確認できます。

### 7. Vercel デプロイ

```bash
npx vercel
```

Vercel ダッシュボードで環境変数を設定してください。`vercel.json` により15分ごとにリマインドCronが実行されます。

## ディレクトリ構成

```
src/
├── app/
│   ├── book/page.tsx          # 予約ページ（求職者向け）
│   └── api/
│       ├── availability/      # 空き枠取得
│       ├── book/              # 予約確定
│       └── cron/reminders/    # リマインド送信
├── lib/
│   ├── supabase.ts            # DB クライアント
│   ├── google-calendar.ts     # Calendar API
│   ├── zoom.ts                # Zoom API
│   ├── gmail.ts               # Gmail API
│   └── round-robin.ts         # ラウンドロビン割当
└── types/
supabase/migrations/           # DBスキーマ
```

## 予約フロー

```
求職者が日時選択
    ↓
全CAのGoogleカレンダーから空き枠を集約
    ↓
求職者が名前・メール入力 → 予約確定
    ↓
ラウンドロビンでCAを割当（空いているCAを優先）
    ↓
Zoomミーティング作成 → Googleカレンダーにイベント追加
    ↓
CA・求職者に確認メール送信
    ↓
前日・1時間前にリマインドメール（Cron）
```

## 環境変数一覧

| 変数 | 説明 | デフォルト |
|------|------|-----------|
| `TIMEZONE` | タイムゾーン | `Asia/Tokyo` |
| `APPOINTMENT_DURATION_MINUTES` | 面談時間（分） | `60` |
| `BUSINESS_START_HOUR` | 営業開始時刻 | `10` |
| `BUSINESS_END_HOUR` | 営業終了時刻 | `18` |
| `MAX_BOOKING_DAYS` | 予約可能日数 | `14` |
| `CRON_SECRET` | Cron API認証 | — |

## 注意事項

- Zoom Basic プランは40分の時間制限があります。60分面談の場合は Pro 以上を検討してください（または `APPOINTMENT_DURATION_MINUTES=40` に変更）
- Gmail API のドメイン委任には Google Workspace が必要です
- 各CAのカレンダーは必ずサービスアカウントと共有してください
- 本番環境では `CRON_SECRET` を必ず設定してください
