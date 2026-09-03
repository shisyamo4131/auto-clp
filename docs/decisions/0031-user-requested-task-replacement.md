# ADR 0031: ユーザー依頼のtask交代と通常再開

- Status: Accepted
- Date: 2026-09-03
- Supersedes: [ADR 0016](0016-project-coordination-and-session-capacity-routing.md)

## Context

共通ガバナンス3.0.0の採用と文書整理が承認された。従来の強制交代、旧ownerとの確認応答、最初の実file commit、handoff記録への起動依存は、旧taskを利用できない場合の通常再開を妨げる。容量測定・プライバシー・委任の安全条件は引き続き必要である。

## Decision

- task交代はユーザー依頼時だけ行う。既存の正本文書に現在情報と次作業を反映し、関連変更を意味のある単位でcommitしてprimaryをcleanにした後、同じ基本名と次の連番の非fork新規taskを作る。編集ごとの細切れcommitや交代だけの空commitは作らない。
- すべてのtaskはAGENTS.md、governance/project-rules.md、docs/README.mdから選ぶ正本を読む。手動作成・旧task利用不能からの復旧も同じ手順であり、旧task ID・旧ownerの協力・activation callback・最初の実file commitを要求しない。
- ガバナンス変更は強制交代を起こさない。交代専用台帳・状態履歴・cache・世代・handshake・validator・profileは作らない。旧handoff本文はHistoricalとして保存し、現在状態の正本にしない。
- 通常委任のcheckpoint、no-change callback、結果通知、コーディネーターのレビューとGit統合、安全・承認境界は維持する。旧taskはCodexがarchive/deleteしない。
- 通常作業はinstalled scaffold skillを読み込まない。明示的なガバナンス作成・採用・移行・更新時だけ使用する。

## Preserved Capacity and Privacy Contract

- 容量チェック、タスク容量確認、セッション容量確認、session size / handoff threshold確認は[調整runbook](../runbooks/project-coordination.md)へ経路指定する。
- 信頼できる現在task IDをscripts/check-codex-session-size.ps1へ明示し、一致sessionがちょうど1件の場合だけ測定する。最新sessionを推測しない。
- 個別300 MiBは交代提案基準であり、使用率とhandoff_requiredを報告する。Codex全体10 GiBは別の参考警告であり、個別判断へ流用しない。
- scan完全性、error数、計測時刻・source、独立した終了コードを報告する。全体scanには既定24時間のrepository-ignored tmp/cacheを使える。これは測定cacheであり交代状態cacheではない。
- session本文、prompt、資格情報、業務データを読まず出力しない。Codex所有SQLite/WALは照会・変更しない。
- task ID不明、0件、複数件、script失敗では推測せず停止する。全体scan不完全時は全体容量による判断を停止する。
- 実行policyは変更しない。PowerShell 7を必須環境とし、観測したRestrictedのWindows PowerShell 5.1は未検証とする。Bypassや実行拒否の回避を行わない。

## Consequences and Alternatives

旧ownerが応答できなくてもrepositoryから再開できる。代案の強制交代・専用台帳維持は採用しない。製品仕様1.4.2、Schema 0.1.0、アプリ、既存製品テスト、依存関係、受入残条件、進捗98%、権限・agent設定は変更しない。新たな動作保証は追加しない。

## Migration and Verification

管理対象は承認済みsyncで更新する。検証policyの7分類・runtime宣言・運用matrixを整合させ、元hashを持つ[文書対応表](../migrations/document-plan.json)で標準正本と補足文書の意味をレビューする。総合9ゲート、包含されるproject検査の負例回帰、文書ValidatePlan/ValidateResult、同期Check、独立レビューを用いる。成果物の存在やtopologyだけで意味保持を断定しない。

## Rollback and Reconsideration

移行基準commitと既存1行修正を保全し、承認された所有範囲を一体として復旧する。同期自身のrollbackは管理対象だけであり、project-owned準備変更を自動復旧済みと扱わない。無関係な変更や履歴を巻き戻さない。旧taskへ所有権を推測で戻さず通常のrepository読込で再開する。新たな法的・安全上の必須条件や再現可能な復旧不具合が判明した場合だけ、後継ADRで再検討する。
