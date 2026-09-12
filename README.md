# にじいろ連絡帳

Next.js / React / TypeScript で作成した保育園向け連絡帳アプリです。
Node.js 24 LTS（22.12以上）、pnpm 10.28.1を使用します。

## エージェント用環境（Docker・認証サービス不要）

```sh
pnpm install --frozen-lockfile
pnpm dev:agent
```

[http://localhost:3000/parent](http://localhost:3000/parent) を開くと保護者として操作できます。
PGliteの初期化・マイグレーション・デモデータ投入は起動時に自動実行します。
`.env.local` やAPIキーは不要です。データは `.data/pglite/` に保存され、再起動後も残ります。

```sh
pnpm db:setup:agent  # DB初期化のみ（再実行可能）
pnpm db:check:agent  # SQLで疎通・migration・seedを確認
pnpm build:agent    # 認証スキップ環境で本番形式のビルド
pnpm start:agent    # ビルド済みアプリの起動
```

`build:agent` / `start:agent` はDBを初期化しないため、先に `db:setup:agent` を実行してください。
PGliteは同じディレクトリを複数プロセスから同時利用できません。DBコマンドは開発サーバー停止中に実行し、複数の検証には `PGLITE_DATA_DIR` で別ディレクトリを指定してください。
単体テストはメモリ上のDB、E2Eは実行ごとに専用の一時ディレクトリを使います。

## ローカル環境（Docker PostgreSQL）

Dockerを起動してから実行します。

```sh
pnpm install --frozen-lockfile
pnpm db:up
pnpm dev
```

PostgreSQL 17を `127.0.0.1:54329` に起動します。認証スキップ、初期化・デモデータ投入は自動で有効になります。
Dockerのデータは名前付きボリュームに保存します。`pnpm db:down` はデータを削除しません。

```sh
pnpm db:setup:local  # DB初期化のみ
pnpm db:down        # コンテナー停止・削除（ボリュームは保持）
```

`pnpm dev` はDocker PostgreSQL、`pnpm dev:agent` はPGliteを使います。どちらも認証スキップとDB初期化を自動で実行します。

## 環境設定

| 設定                      | 値・用途                                              |
| ------------------------- | ----------------------------------------------------- |
| `APP_ENV`                 | `development` / `test`。省略時は安全側の `production` |
| `AUTH_MODE`               | 開発用 `skip` / 本番用 `clerk`                        |
| `DATABASE_PROVIDER`       | `postgres` / `pglite`                                 |
| `DATABASE_URL`            | PostgreSQL接続文字列。PGliteでは使用しない            |
| `PGLITE_DATA_DIR`         | 既定 `.data/pglite`。`memory://` は単体テスト専用     |
| `FILE_STORAGE_PROVIDER`   | 開発用 `local` / 本番用 `s3`                          |
| `FILE_STORAGE_DIR`        | `local` の保存先。既定 `.data/files`                  |
| `S3_BUCKET` / `S3_REGION` | 本番の非公開バケットとリージョン                      |
| `S3_ENDPOINT`             | S3互換サービスを使う場合だけ指定                      |

`.env.example` はDocker用、`.env.agent.example` はPGlite用の設定例です。
`dev` / `dev:agent` は認証・DB種別を明示的に切り替えるので、既存の `.env.local` があってもDB種別が混ざりません。
`DATABASE_URL` と `PGLITE_DATA_DIR` は指定値を優先します。Docker以外のDBへ誤って接続しないよう、ローカル用の接続先を使ってください。

認証スキップは開発・テスト専用です。`APP_ENV=production` または `VERCEL_ENV=production` ではサーバー側で拒否します。本番は `AUTH_MODE=clerk` とし、`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` と `CLERK_SECRET_KEY` を設定します。
`NODE_ENV=production` はNext.jsのビルドモードなので、`APP_ENV=development` を明示したローカル検証は可能です。
Clerkでメールアドレスの確認、パスワード管理、セッション管理を行います。先生画面の「運用管理」で利用者を先に登録し、同じ確認済みメールアドレスでClerkへ登録すると、初回ログイン時に園・ロールへ紐づきます。園に登録されていないメールアドレスでは園データへアクセスできません。

初回は保護者として認証されます。トップページから保護者／保育士を切り替えられ、選択はHttpOnly Cookieに保存します。
ログアウトすると選択を解除してトップページへ戻り、既定の保護者に戻ります。
サーバーで画面・APIのロールと施設・園児へのアクセスを確認しています。

## 画面・API・DB

画面 → TanStack Query → 園slug付きAPI → repository → PostgreSQL / PGlite の順でアクセスします。

画面とAPIは園ごとの公開slugを含む正規URLを使用します。デモ園の例は次のとおりです。

```text
/nurseries/nijiiro/parent/notebook
/nurseries/nijiiro/teacher/children
/api/nurseries/nijiiro/notebook
```

slugは表示上の園コンテキストであり、それ自体を認可情報として信用しません。サーバーは毎回、slugから特定した園、認証利用者の園ID、現在有効な所属、ロールが一致することを確認します。不一致は404として扱い、旧slugなし画面・APIは正規経路として使用しません。

- GETを利用者ごとに60秒キャッシュし、30秒ごとに相手の更新を確認します。
- 保存はPOSTで実行し、成功後にキャッシュを無効化・再取得します。
- 利用者切り替え・ログアウトでキャッシュを消去します。
- 保存に失敗した場合は入力を保持してエラー表示します。
- HTTPキャッシュは無効にし、認証付きデータはTanStack Queryのメモリ内だけでキャッシュします。

連絡帳・メッセージ・お知らせ・資料・写真・行事・園児情報は保存され、再読み込み後も保持されます。資料と写真は実体を非公開ストレージへ保存し、所属園・クラス・園児の権限確認後に配信します。本番環境ではローカルディスクを拒否し、暗号化したS3またはS3互換の非公開バケットを使用します。

認証の交換境界は `lib/auth/provider.ts`、DBドライバーの交換境界は `lib/db/index.ts`、データ操作は `lib/repository.ts` に分離しています。
本番認証はClerkの利用者IDと、DB上の利用者・施設所属をサーバーで対応付けます。PostgreSQLはNeonなどのマネージド接続へ置換でき、画面側はDBドライバーに依存しません。

園、利用者、所属、クラス、園児、保護者紐づけ、職員担当、連絡帳、お知らせ、予定、メッセージ、アプリ内通知、監査、ファイルは正規化テーブルで管理します。通知はアプリ内の新着・既読・通知設定に限定し、メールやプッシュ通知は送信しません。旧 `app_record` のメッセージはマイグレーション時に移行され、実行時の読み書きには使用しません。
先生画面の「運用管理」からクラス・利用者・園児の追加、進級、退園、職員担当、保護者紐づけを変更でき、変更内容は操作履歴へ残ります。
共通SQLのマイグレーションは `lib/db/migrations.ts` でバージョン管理し、トランザクション内で適用します。seedは既存データを上書きしません。

## 検証コマンド

| コマンド                             | 内容                                     |
| ------------------------------------ | ---------------------------------------- |
| `pnpm lint` / `pnpm lint:fix`        | ESLint / 自動修正                        |
| `pnpm format` / `pnpm format:check`  | Prettier整形 / チェック                  |
| `pnpm typecheck`                     | ルート型生成と `tsc --noEmit`            |
| `pnpm knip`                          | 未使用ファイル・export・依存関係検出     |
| `pnpm test` / `pnpm test:watch`      | Vitest / 監視実行                        |
| `pnpm test:coverage`                 | 日付・クラス名ユーティリティのカバレッジ |
| `pnpm test:e2e` / `pnpm test:e2e:ui` | Playwright / UIモード                    |
| `pnpm check`                         | lint・整形・型・Knip・単体テスト         |
| `pnpm check:all`                     | 上記＋PGliteのE2E＋エージェント用ビルド  |

```sh
pnpm exec playwright install chromium
pnpm check:all
```

LinuxのCIでは `pnpm exec playwright install --with-deps chromium` を使用します。
E2Eは認証キー・Dockerなしで専用サーバーを `127.0.0.1:3100` に起動します。
`/api/health` でも認証・DB接続・migrationを確認できます。
運用監視では公開の `/api/health/live` と `/api/health/ready` を使用します。バックアップ、復元、保存期間の手順は [`docs/operations.md`](docs/operations.md) を参照してください。
レポートは `pnpm exec playwright show-report` で開きます。
ESLintはNext.jsプラグインの対応範囲に合わせ9系を使っています。
初回起動・ビルドでは既存のGoogle Fonts設定によるネットワークアクセスが必要です。

参考: [PGlite](https://pglite.dev/docs/)、[node-postgres](https://node-postgres.com/features/queries)、[TanStack Query](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation)。
