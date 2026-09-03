# ADR 0016: プロジェクト調整とセッション容量経路

- Status: Superseded
- Superseded by: [ADR 0031](0031-user-requested-task-replacement.md)。容量・プライバシー・失敗条件は後継で維持し、交代・再開方式を更新する。
- Date: 2026-08-28

## Context

Auto CLPは長期のコーディネーターtaskとイベント通知型の委任を使う。従来の運用文書には個別sessionの300 MiB基準はあったが、容量に関する自然言語の依頼がモデルtoken/context容量と誤解される余地があり、Codex全体容量、scan完全性、exact task IDの失敗境界も不足していた。共通ガバナンス1.4.0は標準の容量経路と報告項目を追加した。

本ADRの採択時点では、ADR 0015は承認済みだが未実装のscene interaction改善がADR 0010を精緻化するために予約されていた。その後ADR 0015はAcceptedとなり実装されたが、本判断はその製品判断と独立なので0016を維持する。

## Decision

- `容量チェック`、`タスク容量確認`、`セッション容量確認`、`session size / handoff threshold確認` は、[プロジェクト調整runbook](../runbooks/project-coordination.md)へ経路指定する。
- 信頼できる現在task IDを `scripts/check-codex-session-size.ps1` へ明示し、一致sessionがちょうど1件である場合だけ測定する。最新sessionを推測しない。
- 個別sessionの引き継ぎ提案基準は300 MiBとし、使用率と `handoff_required` を報告する。
- Codex全体10 GiBは別の参考警告とし、個別sessionの引き継ぎ判断へ流用しない。scanの完全性、error数、計測時刻・sourceを報告する。
- session本文、prompt、資格情報、業務データを読まず、出力しない。Codex所有SQLite/WALを照会・変更しない。
- task ID不明、0件、複数件、script失敗では推測せず停止する。全体scanが不完全なら全体容量による判断を停止する。
- 一時task IDと所有権状態はhandoff recordへ置き、恒久runbookまたは製品仕様へ固定しない。

## Consequences

- 容量確認の意味、measurement source、終了コード、停止条件が再現可能になる。
- 全体scanは時間がかかることがあるため、既定24時間のrepository-ignored cacheを `tmp/` に使える。
- 共通契約、生成 `AGENTS.md`、callback/turnover経路が変わるため、全アクティブAuto CLP taskを完全な新規taskへ交代し、no-change callbackと最初のfile限定commitを検証する必要がある。
- 製品仕様、Schema、アプリ動作、進捗には変更がない。

## Rollback

owner承認のもとで共通ガバナンス同期を前版へ戻し、本ADR、runbook、容量script、文書経路を同じcommitで戻す。交代済みtaskの所有権を推測で旧taskへ戻さず、新しいno-change handoffで経路を再検証する。

## Verification

- 管理済みガバナンスrenderer/checkerとプロジェクトvalidator。
- 容量alias、runbook、script必須field、latest-session推測禁止を確認するproject validation。
- 実際の現在task IDによるscript成功と、missing ID / unknown IDの非ゼロ失敗。
- `git diff --check` と `git diff --cached --check`。
