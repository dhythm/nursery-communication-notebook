# にじいろ連絡帳

Next.js / React / TypeScript で作成した保育園向け連絡帳のデモアプリです。

## セットアップ

Node.js 22.12 以上（推奨: Node.js 24 LTS）と pnpm 10.28.1 を使用します。

```sh
npm install --global pnpm@10.28.1
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm dev
```

[http://localhost:3000](http://localhost:3000) を開きます。画面に入力済みのデモアカウントでログインできます。
データはメモリ上に保持され、再読み込みすると初期状態に戻ります。

## 開発コマンド

| コマンド             | 内容                                             |
| -------------------- | ------------------------------------------------ |
| `pnpm lint`          | ESLint（Next.js の推奨ルール、警告もエラー扱い） |
| `pnpm lint:fix`      | ESLint の自動修正                                |
| `pnpm format`        | Prettier で整形                                  |
| `pnpm format:check`  | 整形のチェック                                   |
| `pnpm typecheck`     | Next.js のルート型を生成して `tsc --noEmit`      |
| `pnpm knip`          | 未使用ファイル・export・依存関係の検出           |
| `pnpm test`          | Vitest の単体テストを1回実行                     |
| `pnpm test:watch`    | 単体テストを監視実行                             |
| `pnpm test:coverage` | 日付・クラス名ユーティリティのカバレッジ測定     |
| `pnpm test:e2e`      | Playwright / Chromium のブラウザーテスト         |
| `pnpm test:e2e:ui`   | Playwright の UI モード                          |
| `pnpm check`         | lint・format・型・Knip・単体テストを順に実行     |
| `pnpm check:all`     | `check`・E2E・本番ビルドを順に実行               |
| `pnpm build`         | 本番ビルド（型チェックを含む）                   |

ESLint は Next.js のプラグイン群が対応する 9 系を使用しています。プラグインの対応更新時に 10 系への移行を検討してください。

## テスト

単体テストは `lib`・`components`・`app` 内の `*.test.ts` / `*.test.tsx` を対象に、Node 環境・日本時間で実行します。
現在は日付・月齢の境界値とクラス名の競合解決を検証しています。ブラウザー向けの UI 操作は `e2e/smoke.spec.ts` で検証します。

E2E は専用の開発サーバーを `http://127.0.0.1:3100` で自動起動・停止します。このポートを空けて実行してください。
保護者のログインと記録送信、保育士の園児管理とログアウト、未ログイン時のリダイレクトを確認します。
失敗時のスクリーンショットは `test-results/`、HTML レポートは `playwright-report/` に保存します。

```sh
pnpm exec playwright show-report
```

Linux の CI などで実行する際は、`pnpm exec playwright install --with-deps chromium` でシステム依存も導入してください。
`CI=true` では E2E の並列数を1に制限し、失敗時に2回リトライしてトレースを保存します。

初回起動と本番ビルドでは、既存の `next/font/google` 設定により Google Fonts に接続します。

## 設定の参考

- [Next.js ESLint](https://nextjs.org/docs/app/api-reference/config/eslint)
- [Knip configuration](https://knip.dev/reference/configuration)
- [Vitest configuration](https://vitest.dev/config/)
- [Playwright configuration](https://playwright.dev/docs/test-configuration)
