# Project Coordination Runbook

- Status: Active
- Owner: Project
- Common governance: 3.0.0

## Session Capacity Routing

次の指示はすべて同じタスク容量確認として、このrunbookへ経路指定する。

- `容量チェック`
- `タスク容量確認`
- `セッション容量確認`
- `session size / handoff threshold確認`

これらは現在のCodexタスクについて永続化されたsession JSONLの容量を求める指示であり、モデルのtoken使用量やcontext-window容量ではない。

## Required Measurement

現在のCodex task IDを信頼できるタスクmetadataから取得する。並行タスクがあり得るため、最新または最終更新のsessionを推測してはならない。

Windowsの必須PowerShell 7環境で、現在のtask IDを明示してプロジェクト内scriptを実行する。実行policyを変更せず、拒否時はBypassせず停止する。Windows PowerShell 5.1はRestrictedのため未検証であり、必須環境ではない。

```powershell
& .\scripts\check-codex-session-size.ps1 -SessionId <current-task-id>
```

コマンド結果と独立して観測した終了コードを記録する。scriptは指定IDに一致するsessionをちょうど1件だけ解決しなければならない。通常は24時間以内のCodex全体scan cacheを使用できる。全体容量の再計測が必要な場合だけ `-ForceTotalScan` を使う。

## Standard Report

session本文を読まず、表示せず、次をすべて報告する。

- 対象task ID。
- 解決したsession file。
- session容量（MiB）。
- 引き継ぎ閾値（既定300 MiB）。
- 使用率。
- `handoff_required`。
- Codex全体の参考容量と10 GiBの警告閾値。
- 全体scanの完了状態とerror件数。
- session計測時刻、Codex全体計測時刻とsource。
- コマンド結果と独立して観測した終了コード。

`handoff_required` が `true`、すなわち対象sessionが承認済みの既定300 MiBまたは別途承認された閾値へ到達した場合だけ交代を提案する。`false` の場合、経過時間、token/context推測、最新session推測を根拠に交代を提案しない。Codex全体10 GiBは別の参考警告であり、個別タスク交代の判定に使わない。

## Stop and Error Contract

- 現在のtask IDを確定できなければ停止してIDを求め、推測しない。
- IDが0件または複数sessionへ解決された場合は件数と非ゼロ終了コードを報告して停止する。
- script失敗時は簡潔なerrorと非ゼロ終了コードを報告し、引き継ぎ要否を結論しない。
- `codex_scan_complete` が `false` の場合は `codex_scan_error_count` を報告する。対象session容量は報告できるが、Codex全体容量を完全と主張せず、cleanupまたは閾値判断に使わない。
- session本文、prompt、認証情報、秘密情報、業務データを出力しない。この確認でCodex所有のSQLiteまたはWALを照会・変更しない。

## Event-driven Checkpoint Loop

1. コーディネーターtask/host、委任task/host、正確な主作業ディレクトリ、現在checkpoint、callback先、ユーザー定義の終了条件を確認する。
2. 通常の委任task作成・アプリ再起動後は実作業前にno-change callbackを一度検証する。交代・手動作成されたコーディネーターは通常のrepository読込から開始し、activation callbackを要求しない。
3. 共通baseline、担当・禁止範囲、正本、承認境界、必要検証、完了契約を含むレビュー可能なcheckpointを一件だけ割り当てる。
4. 完了、失敗、仕様質問、承認境界のいずれか一度のcallbackを待つ。通知後の委任taskは次の指示を待つ。
5. コーディネーターが差分と個別の検証終了コードを確認し、受入対象だけをstage・commitする。終了条件未達の場合だけ次を割り当てる。

callback失敗時は繰り返し送信せず、完全な結果を送信側taskへ残して復旧を待つ。スケジュール監視はcallbackが利用できない場合またはユーザーが明示選択した場合だけ使う。

通常のtask間通信はユーザー向け進捗へ逐次表示せず、終了または停止時に統合報告する。承認、安全境界、失敗、仕様衝突、進捗低下、task/worktree/callback不整合は直ちにユーザーへ報告する。

個別sessionが300 MiBへ到達した場合は、新規割当と自動reviewを停止する。現在の製品情報と残作業を既存の仕様・ロードマップ・運用へ反映し、未統合作業・検証・承認待ちを報告する。交代専用記録を作らず、ユーザーが依頼した交代手順だけを進める。

## Git, Worktree, and User-requested Replacement

- 全Auto CLP taskは主作業ディレクトリ C:\Users\seven\projects\auto-clp を直接使う。別Worktreeまたは別repository copyは、理由、path、branch、担当、統合方法、存続期間、cleanupをユーザーが事前承認しない限り作成・利用しない。
- コーディネーターが受入ファイルだけをstage・commitする。無関係な変更をstage、破棄、上書きしない。
- ガバナンス変更は強制交代を起こさない。ユーザーが交代を依頼した場合、既存正本の現在情報と次作業を更新し、関連変更を意味のある単位でcommitしてprimaryをcleanにする。その後、同じ基本名と次の連番で非forkの新規taskを作る。編集ごとの細切れcommitや交代だけの空commitは作らない。
- すべてのtaskはAGENTS.md、governance/project-rules.md、docs/README.mdから選ぶ作業別正本を読む。新規・手動作成・旧task利用不能からの復旧も同じ開始経路を使う。旧task ID、旧ownerの協力、ACK、activation callback、最初の実file commit、所有権移転台帳を開始条件にしない。
- 現行の安全境界はmanaged restricted `workspace-write`、restricted network、`approvals_reviewer=auto_review` である。runtimeで観測できない値を推測せず、権限変更・外部書込みは通常の承認境界に従う。交代用profileや専用validatorは作らない。
- 通常委任callbackと結果レビューは継続する。交代専用の状態・履歴・cache・世代・handshakeは不要である。通常のプロジェクト作業はinstalled scaffold skillを読み込まない。
- 旧taskはCodexがarchive/deleteせず、ユーザーに手動削除可能と案内する。

## Current Project Authorities

現在の要件は[仕様](../specification.md)、進捗・残作業は[ロードマップ](../roadmaps/auto-clp.md)、実行・復旧は[運用](../operations.md)を正とする。[旧handoff索引](../handoffs/README.md)と配下の本文はHistoricalであり、現在owner・承認の証明や起動前提には使わない。通常の委任にはそのcheckpointの宛先・所有範囲・終了条件を明示するが、交代専用台帳へ恒久化しない。
