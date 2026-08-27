# Auto CLP

Auto CLP は、精密機器運送業者が積荷とコンテナまたは車両の寸法・重量・制約を入力し、3D空間で積載可能性を検討するためのローカルファーストWebアプリです。初期利用先での実務評価を優先し、将来は一般公開できる構成を目指します。

## Status

計画・ガバナンス段階です。アプリケーション実装はまだありません。現在の開発対象は、ローカルで動作する3D手動配置試作と、その後の自動配置提案です。

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

アプリケーションのセットアップ、ビルド、テストコマンドは未実装です。現在検証済みのコマンドは `docs/operations.md` に記載したガバナンス検証だけです。

## Security

実在顧客の名称、連絡先、貨物明細、価格、搬送経路、資格情報などの機密情報を、リポジトリ、テストデータ、ログ、プロンプトへ保存しないでください。初期版はネットワーク送信を行わず、端末内のデータだけを扱います。
