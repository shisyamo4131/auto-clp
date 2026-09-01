# ADR 0030: コンテナ専用化とDrawer内コンテナ管理

- Status: Accepted
- Date: 2026-09-01

## Context

Phase 1の積載空間は画面上で「コンテナ」「車両」「候補」が混在し、同じ登録対象の意味が揺れていた。積荷cardは件数案内だけ、コンテナ・車両候補cardは一覧と編集・削除を保持していたため、3Dを主作業面とするApplication Shellの下部に管理cardが残っていた。

利用者はPhase 1をコンテナ専用にし、積荷cardとコンテナ管理cardを撤去したうえで、推奨したDrawer内管理へ移すことを承認した。

## Decision

- Phase 1で登録・選択・編集・判定する積載空間はコンテナだけとし、車両は対象外とする。
- 利用者向けの登録対象名は「コンテナ」に統一する。「候補」は候補点・探索試行・支持候補などアルゴリズム上の意味だけに使う。
- 積荷cardとコンテナcardを通常画面から撤去する。積荷の選択・編集・削除は3D内の積荷selectorと固定操作欄を正本入口とする。
- Drawerに `コンテナを追加`、`選択中のコンテナを編集`、`選択中のコンテナを削除` を置く。編集・削除対象は3Dで選択中のコンテナとし、未選択時は先頭コンテナを既定とする。
- Drawerを閉じてから既存と同じProject command・履歴・busy/dirty gateを使うmodal editorを開く。
- 配置中の積荷を参照するコンテナは削除しない。配置からのcascade削除は行わず、利用者が先に積荷を荷室から外す。
- TypeScriptの `Container` / `containerId`、JSONの `containers`、Schema `0.1.0`、既存IDと保存データは変更しない。データmigrationは不要とする。

## Consequences

- 3D下部の重複した管理面がなくなり、コンテナのCRUD入口はDrawerへ集約される。
- 車両固有の荷室、開口、用語、判定をPhase 1が保証していると誤認させない。
- コンテナを編集・削除するには、対象コンテナのtabを選んでからDrawerを開く必要がある。
- 過去ADR 0025と0029の「登録cardを維持する」部分、および過去文書の登録対象を「候補」「コンテナ・車両」とする部分を本ADRで置き換える。それ以外のviewer-first構成、自動提案公開延期、Drawer境界は維持する。

## Compatibility, Migration, and Rollback

- 既存JSONと端末保存はそのまま読込・保存できる。内部データ名とSchema版は変えない。
- 既存データに車両用途の記録が含まれていても自動変換や削除を行わない。Phase 1の画面上ではコンテナとして扱い、用途の正当性は利用者が確認する。
- rollback時は本ADR前のUIへ戻せるが、仕様1.3.0、ADR 0025・0029のcard維持と用語へ戻す明示承認が必要となる。

## Required Verification

- 305 / 320 / 375 pxで積荷cardとコンテナcardがなく、Drawerが横overflowを起こさない。
- Drawerからコンテナを追加・編集・削除でき、3Dで選択したコンテナが編集・削除対象になる。
- 配置参照中コンテナの削除が理由付きで拒否され、配置を外した後は一回の履歴として削除できる。
- dialogのfocus trap、Escape、dirty破棄確認、Drawerのfocus復帰、busy gate、Undo/Redoを維持する。
- 通常画面、Drawer、dialog、物理判定、履歴の登録対象表記が「コンテナ」で一致し、アルゴリズム上の「候補」は維持される。
