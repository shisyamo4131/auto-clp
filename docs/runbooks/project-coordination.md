# Project Coordination Runbook

- Status: Active
- Owner: Project
- Common governance: 1.5.0

## Session Capacity Routing

次の指示はすべて同じタスク容量確認として、このrunbookへ経路指定する。

- `容量チェック`
- `タスク容量確認`
- `セッション容量確認`
- `session size / handoff threshold確認`

これらは現在のCodexタスクについて永続化されたsession JSONLの容量を求める指示であり、モデルのtoken使用量やcontext-window容量ではない。

## Required Measurement

現在のCodex task IDを信頼できるタスクmetadataから取得する。並行タスクがあり得るため、最新または最終更新のsessionを推測してはならない。

Windowsでは、現在のtask IDを明示してプロジェクト内scriptを実行する。

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-codex-session-size.ps1 -SessionId <current-task-id>
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
2. タスク作成、交代、アプリ再起動後は実作業前にno-change callbackを一度検証する。
3. 共通baseline、担当・禁止範囲、正本、承認境界、必要検証、完了契約を含むレビュー可能なcheckpointを一件だけ割り当てる。
4. 完了、失敗、仕様質問、承認境界のいずれか一度のcallbackを待つ。通知後の委任taskは次の指示を待つ。
5. コーディネーターが差分と個別の検証終了コードを確認し、受入対象だけをstage・commitする。終了条件未達の場合だけ次を割り当てる。

callback失敗時は繰り返し送信せず、完全な結果を送信側taskへ残して復旧を待つ。スケジュール監視はcallbackが利用できない場合またはユーザーが明示選択した場合だけ使う。

通常のtask間通信はユーザー向け進捗へ逐次表示せず、終了または停止時に統合報告する。承認、安全境界、失敗、仕様衝突、進捗低下、task/worktree/callback不整合は直ちにユーザーへ報告する。

個別sessionが300 MiBへ到達した場合は、新規割当と自動reviewを停止する。baseline commit、進捗、active/waiting checkpoint、未統合作業、検証、承認待ち、安全境界、次の指示を最新handoff recordへ保存し、owner承認済みの交代手順だけを進める。

## Git, Worktree, and Turnover

- 全Auto CLP taskは主作業ディレクトリ `C:\Users\seven\projects\auto-clp` を直接使う。別Worktreeまたは別repository copyは、理由、path、branch、担当、統合方法、存続期間、cleanupをユーザーが事前承認しない限り作成・利用しない。
- コーディネーターが受入ファイルだけをstage・commitする。無関係な変更をstage、破棄、上書きしない。
- 共通契約、生成 `AGENTS.md`、全体権限・承認方針、調整責任、委任・Git統合、callback・引き継ぎ、安全境界の変更後は、全アクティブtaskを安全なcheckpointで完全な新規taskへ交代する。forkしない。
- 交代taskは同じ基本名と次の連番を使い、repositoryからの再開、正確なcwd、branch/HEAD、cleanな単一Worktree、ガバナンス版、権限・自動review、no-change callbackを実作業前に確認する。
- 現行の期待値は、managed restricted `workspace-write`、restricted network、`approvals_reviewer=auto_review`、外部書込みと権限昇格をreview対象にするproject approval policyである。これらはrepository設定だけから推測せず、交代taskのruntime metadataでobservableな値としてcallbackへ記録する。値を観測できない、または不一致の場合は最初のstage/commitと所有権移転を停止する。
- 交代コーディネーターは最初の実file限定stage/commitを自身で完了・検証する。失敗時は旧taskをactiveのまま保ち、所有権を二重化しない。
- routeを新taskへ更新した後も旧taskはCodexがarchive/deleteせず、ユーザーへ手動削除可能なIDを案内する。

## Current-state Records

一時的なtask ID、host、baseline、pending checkpoint、検証結果、引き継ぎ状態は[handoff index](../handoffs/README.md)配下の最新記録へ置く。製品仕様や本runbookへ一時IDを固定しない。
