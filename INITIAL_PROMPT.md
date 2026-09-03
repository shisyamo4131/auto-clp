# Initial Codex Prompt

このリポジトリで作業を開始してください。最初に次を読みます。

1. `AGENTS.md`
2. `governance/project-rules.md`
3. `docs/README.md`
4. `docs/specification.md`
5. 長期調整、Git統合、容量確認、ユーザー依頼のtask交代では `docs/runbooks/project-coordination.md`（旧handoffは履歴参照のみ）
6. 対象のロードマップとADR
7. 関連コードとテスト

状態を変更する前に、共通ガバナンスのバージョン、読み込んだ指示源、現在フェーズ、確定範囲、未決定事項、承認境界、既存実装との衝突を確認してください。

状態変更前に `governance/verification-policy.json` と `docs/operations.md` の検証matrixを読み、該当する変更classをすべて選びます。mixed changeではstage別gate IDの和集合を使い、影響が不明または限定不能ならcomprehensive fallbackを使ってください。iteration、targeted regression、completion、release-onlyを区別し、包含gateを重複実行せず、省略gateと理由、後続変更で失効したevidence、再実行結果を記録します。成功はコマンド完了と終了コード0の後だけ記録し、既知の全コマンドを無条件に毎回実行しません。

ユーザー向けの主タスクをコーディネーターとし、すべてのタスクで `C:\Users\seven\projects\auto-clp` を使用してください。タスク固有Worktreeや別リポジトリコピーは、理由、パス、ブランチ、担当、統合方法、存続期間、後片付けについてユーザーが事前承認しない限り作成・利用しません。

依頼された範囲だけを実施し、将来フェーズを独断で実装しないでください。仕様変更が明示的に承認された場合は、仕様、ロードマップ、ADRと索引、変更履歴、実装、テスト、運用文書を同じ作業内で同期します。

長期調整を依頼された場合は、開始時にタスクID、ホスト、作業ディレクトリ、チェックポイント、コールバック先、ユーザー定義の終了条件を記録し、通常委任の変更なしコールバックを検証してから1件ずつ割り当てます。新規コーディネーターの開始に旧taskとのactivation callbackは要求しません。委任結果は正確な変更ファイル、差分、テスト、未検証事項、承認境界、作業ツリー状態を含め、コーディネーターが確認・コミットします。

`容量チェック`、`タスク容量確認`、`セッション容量確認`、`session size / handoff threshold確認` は、モデルtokenではなく現在taskの永続session容量を意味します。最新sessionを推測せず、調整runbookに従って正確なtask IDとプロジェクト内scriptを使い、個別300 MiBとCodex全体10 GiBを別の指標として報告します。

ガバナンス変更による強制交代は行いません。交代はユーザー依頼時だけ、既存正本の更新・関連変更の適切なcommit・clean primaryの後、同じ基本名と次の連番の非fork新規taskで行います。手動作成・旧task利用不能時も通常の読込順序を使い、旧IDや旧ownerの協力、専用台帳・handshake・validatorを要求しません。通常作業ではinstalled scaffold skillを読み込まず、明示的なガバナンス移行・更新依頼時だけ使用します。

日本語で簡潔に報告してください。
