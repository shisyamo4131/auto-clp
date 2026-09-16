# 0036 CSV一括登録の破棄範囲を示す確認文

- Date: 2026-09-16
- Status: Accepted
- Related specification: Cargo; Application Shell and Primary Workflow; Operation History
- Refines: ADR 0034

## Context

ADR 0034の件数列挙だけでは、一括登録によって何が破棄され、何が保持されるかを利用者が読み取りにくい。特に既存積荷と配置の破棄、CLP名・隙間・コンテナの保持、端末保存の非自動更新を適用前に明示する必要がある。

## Decision

- 確認文は「新規積荷N件を一括登録します。既存の積荷と配置情報は破棄されます。」と表示する。
- 続けて「CLP名、隙間、コンテナは保持します。端末保存は自動更新しません。」と表示する。
- 既存積荷件数と解除配置件数は確認文へ列挙しない。実際の置換範囲、Undo/Redo、取消・失敗時の非変更はADR 0034どおり維持する。

## Impact

- Users: 適用前に破棄・保持・端末保存の境界を直接確認できる。
- Data: Project、JSON、Schema `0.1.0`、置換処理、履歴処理を変更しない。
- Tests: 新規積荷件数を含む二つの固定文、取消、確定、Undo/Redoをbrowser試験で確認する。

## Rollback

表示文だけを旧件数列挙へ戻せる。保存データやmigrationのrollbackは不要である。
