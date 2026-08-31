# Auto CLP

Auto CLP は、精密機器運送業者が積荷とコンテナまたは車両の寸法・重量・制約を入力し、3D空間で積載可能性を検討するためのローカルファーストWebアプリです。初期利用先での実務評価を優先し、将来は一般公開できる構成を目指します。

## Status

CLP・積荷・コンテナ候補の入力、3D表示と手動配置、物理判定、最大100件のUndo/Redo、IndexedDBへの手動保存、JSON入出力を実装済みです。Phase 1の通常画面では自動配置提案を提供しません。保持済みのローカル探索、Worker、preview・適用試作、試験、AP-08性能記録は将来再開用の技術資産であり、現行利用可能機能、一般端末SLA、実務受入または安全保証ではありません。

Auto CLPの操作にはWebGL 2と初回3D描画の成功が必須です。非対応または描画障害時は通常操作を停止し、現在の作業データと端末保存済みデータの違い・出力名・結果・復旧手順が分かる読み取り専用ダウンロードだけを提供します。

## Documentation

- `AGENTS.md`: 生成された共通ガバナンス入口。直接編集禁止
- `governance/project-rules.md`: プロジェクト固有の指示と承認境界
- `governance/common-governance.md`: 管理された共通契約
- `governance/governance.lock.toml`: 管理対象のバージョンと整合性ハッシュ
- `docs/README.md`: 作業種別ごとの文書案内
- `docs/specification.md`: 現行の確定仕様
- `docs/roadmaps/`: 検証済み進捗と残作業
- `docs/decisions/`: 重要な判断と根拠
- `docs/operations.md`: 運用、検証、復旧手順
- `CHANGELOG.md`: 利用者・仕様・運用に見える変更
- `INITIAL_PROMPT.md`: 将来のCodexタスク用開始メッセージ
- `.codex/config.toml`: プロジェクトのマルチエージェント設定
- `.codex/agents/`: プロジェクト固有の専門エージェント

作業開始時は `AGENTS.md` を読み、その後 `docs/README.md` から必要最小限の文書を選んでください。

## Development

Node.js 22とCorepackを使用します。依存関係は `pnpm-lock.yaml` に固定されています。

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm run dev
```

開発サーバーは `http://127.0.0.1:5173` だけで待ち受けます。型検査、lint、単体テスト、ブラウザテスト、ビルドを含む全検証コマンドは `docs/operations.md` に記載しています。

## Security

実在顧客の名称、連絡先、貨物明細、価格、搬送経路、資格情報などの機密情報を、リポジトリ、テストデータ、ログ、プロンプトへ保存しないでください。初期版はネットワーク送信を行わず、端末内のデータだけを扱います。
