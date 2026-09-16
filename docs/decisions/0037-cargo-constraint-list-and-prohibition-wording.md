# 0037 積荷制約の一覧編集と「上乗せ禁止」表記

- Status: Accepted
- Date: 2026-09-16
- Refines: ADR 0008、0022、0034、0035の利用者向け編集方法と表記。保存意味と支持判定は変更しない

## Context

CSVへ天地無用と支持可否の固定値を追加すると、利用者へBooleanや独自語彙の入力規則を覚えさせ、Excel上の入力誤りを増やす。既存の個別積荷editorには正方向の支持可checkboxと「段積み設定」があるが、何を禁止する設定かが分かりにくい。最大30件の新規作成範囲なら、画面上の一覧で例外だけをまとめて設定できる。

## Decision

- CSVは5列の現行形式を維持し、天地無用または支持可否の列を追加しない。CSVと手動追加の既定は天地無用OFF・上乗せ禁止OFFとする。
- 利用者向けの支持可否設定名を、個別editor、不適合理由、一覧editorで「上乗せ禁止」に統一する。「上乗せ禁止」ONは保存値 `canSupportCargo=false`、OFFは `true` に対応する。内部field名とSchema `0.1.0` は変更しない。
- Drawerから全積荷の制約一覧を開き、各行で「天地無用」と「上乗せ禁止」だけをcheckbox編集する。名前、寸法、重量、配置は一覧で編集しない。
- 「変更を適用」までProjectを変更せず、全件を原子的に検証して一回の `cargo.constraints-update` 履歴として確定する。取消、失敗、stale、busy、no-opは履歴へ追加しない。
- 制約変更で現在配置が不適合になっても自動移動・配置解除を行わず、再計算した物理理由を表示する。横倒し配置を天地無用ONにする変更は既存の向き整合性により一括で拒否する。

## Consequences

- Users: CSVに固定値を入力せず、大多数の既定状態を維持したまま例外だけを一覧で設定できる。否定形checkboxは両項目とも未チェックが一般状態になる。
- Data: JSONの形・意味とSchema `0.1.0` は変更しない。既存 `canSupportCargo` と `allowedOrientations` をそのまま読み書きするため移行はない。
- Validation: 上乗せ禁止ONで既存の支持配置が不適合になり得るが、配置は保持され、`support-permission-denied` で修正理由を示す。
- Rollback: UI、履歴action、一覧commandを戻せばよく、保存データの逆移行は不要である。
- Tests: ON/OFF反転、全件原子更新、向き不整合rollback、取消・no-op・stale・busy、一回のUndo/Redo、不適合理由、個別editorとの一致、focus、keyboard、305 / 320 / 375 pxを回帰する。

## Alternatives

- CSVにtrue / false、0 / 1、または日本語固定値を追加する案は、入力規則と誤記検証を利用者へ負わせるため採用しない。
- 名前・寸法・重量も一覧編集する案は、配置済み積荷の寸法変更が境界・重なりへ広く影響するため今回の範囲外とする。
