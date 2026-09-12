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
pnpm dev:local
```

PostgreSQL 17を `127.0.0.1:54329` に起動します。認証スキップ、初期化・デモデータ投入は自動で有効になります。
Dockerのデータは名前付きボリュームに保存します。`pnpm db:down` はデータを削除しません。

```sh
pnpm db:setup:local  # DB初期化のみ
pnpm db:down        # コンテナー停止・削除（ボリュームは保持）
```

通常の `pnpm dev` を使用する場合は `.env.example` を `.env.local` にコピーし、`pnpm db:up` → `pnpm db:setup` → `pnpm dev` の順で実行します。

## 環境設定

| 設定                | 値・用途                                              |
| ------------------- | ----------------------------------------------------- |
| `APP_ENV`           | `development` / `test`。省略時は安全側の `production` |
| `AUTH_MODE`         | 現在は `skip` のみ                                    |
| `DATABASE_PROVIDER` | `postgres` / `pglite`                                 |
| `DATABASE_URL`      | PostgreSQL接続文字列。PGliteでは使用しない            |
| `PGLITE_DATA_DIR`   | 既定 `.data/pglite`。`memory://` は単体テスト専用     |

`.env.example` はDocker用、`.env.agent.example` はPGlite用の設定例です。
`dev:agent` / `dev:local` は認証・DB種別を明示的に切り替えるので、既存の `.env.local` があってもDB種別が混ざりません。
`DATABASE_URL` と `PGLITE_DATA_DIR` は指定値を優先します。Docker以外のDBへ誤って接続しないよう、ローカル用の接続先を使ってください。

認証スキップは開発・テスト専用です。`APP_ENV=production` または `VERCEL_ENV=production` ではサーバー側で拒否します。
`NODE_ENV=production` はNext.jsのビルドモードなので、`APP_ENV=development` を明示したローカル検証は可能です。
Clerk・Neonの実装やキー設定はまだありません。本番認証を実装するまで本番環境の起動は拒否します。

初回は保護者として認証されます。トップページから保護者／保育士を切り替えられ、選択はHttpOnly Cookieに保存します。
ログアウトすると選択を解除してトップページへ戻り、既定の保護者に戻ります。
サーバーで画面・APIのロールと施設・園児へのアクセスを確認しています。

## 画面・API・DB

画面 → TanStack Query → `/api/notebook` → repository → PostgreSQL / PGlite の順でアクセスします。

- GETを利用者ごとに60秒キャッシュし、画面遷移で再利用します。
- 保存はPOSTで実行し、成功後にキャッシュを無効化・再取得します。
- 利用者切り替え・ログアウトでキャッシュを消去します。
- 保存に失敗した場合は入力を保持してエラー表示します。
- HTTPキャッシュは無効にし、認証付きデータはTanStack Queryのメモリ内だけでキャッシュします。

連絡帳・メッセージ・お知らせ・資料情報・行事・園児情報はDBへ保存され、再読み込み後も保持されます。
資料／写真は既存デモの情報・URLを保存する仕組みで、ファイルストレージへのアップロードは未実装です。

認証の交換境界は `lib/auth/provider.ts`、DBドライバーの交換境界は `lib/db/index.ts`、データ操作は `lib/repository.ts` に分離しています。
将来Clerkの認証プロバイダーと本番用のユーザー・施設対応付けを追加し、NeonのPostgreSQL接続に置換できます。画面側はDBドライバーに依存しません。

現在の `app_record` JSONBテーブルは開発デモ用の永続化です。本番ドメインの正規化テーブル・制約・認可設計は別途実装します。
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
レポートは `pnpm exec playwright show-report` で開きます。
ESLintはNext.jsプラグインの対応範囲に合わせ9系を使っています。
初回起動・ビルドでは既存のGoogle Fonts設定によるネットワークアクセスが必要です。

参考: [PGlite](https://pglite.dev/docs/)、[node-postgres](https://node-postgres.com/features/queries)、[TanStack Query](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation)。
