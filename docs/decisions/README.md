# Architecture and Product Decisions

## Statuses

- Proposed
- Accepted
- Rejected
- Superseded

## Index

| ID | Decision | Status | Date |
| --- | --- | --- | --- |
| [0001](0001-local-first-web-architecture.md) | ローカルファーストWebアーキテクチャ | Accepted | 2026-08-27 |
| [0002](0002-cuboid-model.md) | 直方体を基本とする積荷モデル | Accepted | 2026-08-27 |
| [0003](0003-loading-constraints.md) | 初期積載制約の範囲 | Accepted | 2026-08-27 |
| [0004](0004-optimization-objective.md) | 自動配置の目的関数 | Accepted | 2026-08-28 |
| [0005](0005-canonical-units-and-ranges.md) | 正規単位、入力精度、値域 | Accepted | 2026-08-27 |
| [0006](0006-rectangular-opening-model.md) | 初期開口部モデルと通過判定 | Accepted | 2026-08-27 |
| [0007](0007-cargo-orientation-policy.md) | 積荷別の許可回転 | Superseded | 2026-08-27 |
| [0008](0008-stacking-support-and-load.md) | Phase 1の支持と荷重判定 | Accepted | 2026-08-27 |
| [0009](0009-versioned-project-data-contract.md) | 版付き案件JSONとモジュール境界 | Accepted | 2026-08-27 |
| [0010](0010-container-coordinate-and-placement-anchor.md) | コンテナ局所座標と配置アンカー | Accepted | 2026-08-27 |
| [0011](0011-axis-clearance-semantics.md) | 軸別固定隙間の意味と適用面 | Accepted | 2026-08-27 |
| [0012](0012-independent-physical-validation-diagnostics.md) | 物理制約の独立診断と集約 | Accepted | 2026-08-27 |
| [0013](0013-manual-local-persistence-and-json-files.md) | 手動の端末内保存とJSONファイル入出力 | Accepted | 2026-08-28 |
| [0014](0014-dedicated-floor-penetration-diagnostic.md) | 床突き抜けの専用診断 | Accepted | 2026-08-28 |
| [0015](0015-scene-wheel-drag-out-and-size-copy.md) | 3D viewportのscroll・drag-out・大きさ表記 | Accepted | 2026-08-28 |
| [0016](0016-project-coordination-and-session-capacity-routing.md) | プロジェクト調整とセッション容量経路 | Superseded | 2026-08-28 |
| [0017](0017-scene-workbench-rotation-and-compact-controls.md) | 3D作業面・軸別回転・compact操作 | Accepted | 2026-08-28 |
| [0018](0018-scene-drag-classification-and-dialog-editors.md) | 3D drag三状態分類とdialog編集 | Accepted | 2026-08-29 |
| [0019](0019-support-surface-snap-and-conditional-support.md) | 支持面snapと支持条件未確認 | Accepted | 2026-08-30 |
| [0020](0020-actionable-opening-diagnostics-and-drag-focus.md) | 実行可能な開口診断とdrag集中表示 | Accepted | 2026-08-30 |
| [0021](0021-fixed-rotation-toolbar-and-axis-icons.md) | 固定回転toolbarと軸icon | Accepted | 2026-08-30 |
| [0022](0022-upright-only-orientation-policy.md) | 天地無用だけを使う積荷向き方針 | Accepted | 2026-08-30 |
| [0023](0023-webgl-required-operation-and-read-only-rescue.md) | WebGL 2必須運用と読み取り専用JSON救出 | Accepted | 2026-08-30 |
| [0024](0024-user-facing-clp-terminology.md) | 利用者向けCLP用語 | Accepted | 2026-08-30 |
| [0025](0025-viewer-first-application-shell.md) | 3D主作業面を優先するApplication Shell | Accepted | 2026-08-30 |
| [0026](0026-tabbed-scene-annotations-and-validation-dialog.md) | 荷室tab・選択annotation・物理判定dialog | Accepted | 2026-08-31 |
| [0027](0027-external-tabs-compact-dimensions-and-icon-lamp.md) | 欄外荷室tab・簡略寸法・icon-only判定lamp | Accepted | 2026-08-31 |
| [0028](0028-operation-guide-and-compact-dimension-arrows.md) | 操作方法dialogとcompact寸法矢印 | Accepted | 2026-08-31 |
| [0029](0029-phase1-drawer-entry-and-automatic-proposal-deferral.md) | Phase 1のDrawer入口と自動提案の公開延期 | Accepted | 2026-08-31 |
| [0030](0030-container-only-drawer-management.md) | コンテナ専用化とDrawer内コンテナ管理 | Accepted | 2026-09-01 |
| [0031](0031-user-requested-task-replacement.md) | ユーザー依頼のtask交代と通常再開 | Accepted | 2026-09-03 |
| [0032](0032-cargo-center-of-gravity-visualization.md) | 積荷合成重心の参考可視化 | Accepted | 2026-09-08 |
| [0033](0033-equal-borderless-center-markers.md) | 同径・外枠なしの重心ドット | Accepted | 2026-09-08 |
| [0034](0034-cargo-csv-template-and-replacement-import.md) | CSVテンプレートによる積荷一括置換 | Accepted | 2026-09-08 |
| [0035](0035-recursive-single-support-group-movement.md) | 単一支持グループの再帰的連動移動 | Accepted | 2026-09-16 |
| [0036](0036-cargo-csv-destructive-confirmation-copy.md) | CSV一括登録の破棄範囲を示す確認文 | Accepted | 2026-09-16 |
| [0037](0037-cargo-constraint-list-and-prohibition-wording.md) | 積荷制約の一覧編集と「上乗せ禁止」表記 | Accepted | 2026-09-16 |
| [0038](0038-github-pages-technical-preview-and-future-hosting.md) | GitHub Pages技術試用版と将来の配信基盤 | Accepted | 2026-09-16 |
| [0039](0039-staging-compact-load-summary-and-viewer-inputs.md) | 荷室外積荷の寄せ・積載概要・viewer入力 | Accepted | 2026-09-16 |

Accepted ADRは削除せず、変更が必要な場合は新しいADRでSupersededにする。
