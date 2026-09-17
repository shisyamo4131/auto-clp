# Auto CLP Project Rules

- Status: Active
- Owner: Project
- Common governance: `governance/common-governance.md`
- Rule: このファイルはプロジェクト固有の要件を追加できますが、共通ガバナンス契約を弱めたり上書きしたりできません。

## Project and Current Scope

Auto CLP は精密機器運送業者向けの3D積載シミュレーターです。現在フェーズは、ローカルWebアプリとしての3D手動配置試作です。確定範囲は `docs/specification.md`、進捗と将来作業は `docs/roadmaps/auto-clp.md` を正とします。

現在の範囲には、積荷・コンテナ入力、3D表示、手動移動・回転、境界・重なり・開口部・段積み可否・重量上限・軸別隙間の検証、端末内保存とJSON入出力、および現在配置から導く限定モデルの積込順提案とPDF帳票を含みます。自動配置提案は後続マイルストーンです。搬出順・目的地順、搬送機器、作業空間、旋回または完全な経路を考慮した積み込み順、クラウド保存、アカウント、外部API、公開デプロイ、収益化は現在の範囲外です。

## Required Reading and Sources of Truth

1. すべての作業で `AGENTS.md` と本ファイルを読む。
2. 要件、データ、制約、受入条件は `docs/specification.md` を読む。
3. 作業順序と進捗は `docs/roadmaps/README.md` と `docs/roadmaps/auto-clp.md` を読む。
4. 技術・製品判断は `docs/decisions/README.md` から関連ADRを読む。
5. 検証選択は `governance/verification-policy.json` と `docs/operations.md`、復旧は `docs/operations.md`、Git統合、長期タスク、容量確認、ユーザー依頼のtask交代は `docs/runbooks/project-coordination.md` を読む。現在の製品状態と次作業は仕様・ロードマップ・運用を正とし、`docs/handoffs/README.md` は履歴参照に限る。
6. 文書を追加・移動・改名・廃止する場合は `docs/README.md` と関連索引を同じ変更で更新する。

## Product and Domain Boundaries

- 初期版はサーバー不要で、対応ブラウザ内だけで動作する。
- 案件データは端末外へ送信しない。外部通信機能は別承認がない限り実装しない。
- 積荷は直方体としてモデル化する。凹凸形状の組み合わせは利用者が一つの直方体として登録する。
- 実在顧客・積荷・搬送情報はプロジェクト資料やテストへ持ち込まず、匿名の合成データを使う。
- 既存Excel/VBAは作者から再利用許可済みの参考実装だが、現行仕様より優先しない。

## Project-specific Roles and Workstreams

- 主タスクはコーディネーター兼プロジェクト管理者とし、別のコーディネーターエージェントを作らない。
- `developer` は境界が明確なアプリケーションコード変更を担当する。
- `tester` は明示的に委任された場合だけテストファイルを編集し、アプリコードは編集しない。
- `code_explorer`、`docs_researcher`、`reviewer`、`ui_tester` は読み取り専用とする。
- 同時実行上限は4。独立した読み取り作業だけを並列化し、重複する書き込みを割り当てない。
- モデルは固定せず、ユーザー指定または測定済みの必要性がある場合だけ設定する。

## Project-specific Approval and Safety Boundaries

- 外部通信、デプロイ、外部サービスへの書き込み、実データの利用、破壊的操作、Git履歴書き換え、公開には事前の明示承認が必要。
- 重要な仕様変更は、現行規則、提案、理由、影響、互換性、移行、ロールバック、必要テストを提示して承認を得る。
- 秘密情報、認証情報、セッション情報、個人情報、実在の顧客・貨物・搬送記録を保存しない。
- 物理的安全性や積載可否を保証する製品として表示しない。未検証または近似である判定は明示する。

## Project-specific Implementation and Verification

- 座標、寸法、回転、接触、支持、重量の計算ロジックを表示層から分離し、純粋関数として単体テスト可能にする。
- 自動提案は、同じ入力と設定から再現可能な結果を返すか、乱数シードを記録する。
- 必須検証はそれぞれ独立したコマンド、結果、終了コードとして記録する。まとめる場合は、どれか一つでも失敗すれば非ゼロで終了する検証済みランナーだけを使う。
- `;` など後続成功が先行失敗を隠せる連結や、診断用バッチを完了証拠にしない。
- 状態変更前に `governance/verification-policy.json` の該当変更classをすべて選び、iteration、targeted regression、completion、release-onlyの順にgate IDを決める。mixed changeは和集合を取り、影響が不明または限定不能ならcomprehensive fallbackを使う。
- aggregate inclusionを展開して同じgateを重複実行しない。省略gateと理由、後続変更で失効したevidence、再実行結果をcompletion reportまたはhandoffへ記録する。
- 現在検証済みのコマンド、人向けmatrix、evidence失効規則は `docs/operations.md` に記載する。未実装のアプリ、release、deployコマンドを推測して記載しない。

## Project-specific Progress and Reporting

- 「現在値」「現在地」の報告では、Gitのローカル状態（作業ディレクトリ、ブランチ、HEAD、未コミット変更）とリモート状態（リモート名・接続先、追跡ブランチ、リモート側の先端コミット、未push・未取り込みのコミット数）を併記する。
- リモート状態は、報告時に承認済みの接続先へ実際に照会し、確認日時を示す。ローカルに保存されたremote-tracking refだけで同期済みと判断しない。リモート未設定、追跡先未設定、接続失敗・権限不足・未照会は区別し、確認できない値は「未確認」とする。
- `docs/roadmaps/auto-clp.md` の100点重み付きマイルストーンを使用する。
- 完了した成果物または合格したゲートだけを加点し、部分点には完了部分と残条件を示す。
- 範囲拡大または評価修正で進捗が低下した場合は、旧値、新値、理由を履歴と次回報告に残す。
- 承認待ち、外部・破壊的境界、テスト失敗、仕様衝突、進捗低下、タスク・Worktree・コールバック不整合は直ちにユーザーへ報告する。

## Project-specific Task Lifecycle

- 全タスクの主作業ディレクトリは `C:\Users\seven\projects\auto-clp` とする。
- タスク固有Worktreeまたは別コピーは禁止する。必要時は理由、パス、ブランチ、担当、統合方法、存続期間、後片付けの事前承認を得る。
- 長期調整はイベント通知方式を使い、セッション開始時にユーザーが終了条件を定義する。1件のレビュー可能なチェックポイントを完了・失敗・仕様質問・承認境界の通知まで待ってから次へ進む。
- 通常の委任task作成・アプリ再起動後は、実作業前に変更なしコールバックを1回検証する。通知失敗時は繰り返し送信せず、完全な結果を元タスクに残して復旧を待つ。新規・交代コーディネーターは通常のrepository読込から開始し、旧taskの応答やactivation callbackを要求しない。
- コーディネーターの引き継ぎ提案基準は1セッション300 MiB。交代はユーザー依頼時だけ行う。既存の正本文書に現在情報と次作業を反映し、関連変更を意味のある単位でcommitしてprimaryをcleanにした後、同じ基本名と次の連番で非forkの新規taskを作る。編集ごとの細切れcommitや交代だけの空commitは作らない。
- 退任タスクは担当変更を検証後もCodexがアーカイブ・削除せず、ユーザーに手動削除可能と案内する。
- ガバナンス変更はtaskの強制交代を起こさない。すべてのtaskは `AGENTS.md`、本規則、作業種別の正本を読む。旧taskが利用不能でも同じ開始経路を使い、交代専用台帳・履歴・cache・世代・handshake・validatorを追加しない。通常のプロジェクト作業ではインストール済みscaffold skillを読み込まない。
- `容量チェック`、`タスク容量確認`、`セッション容量確認`、`session size / handoff threshold確認` は `docs/runbooks/project-coordination.md` へ経路指定し、現在task IDと `scripts/check-codex-session-size.ps1` を使う。最新sessionを推測しない。
