# Documentation Map

- Status: Active
- Last verified: 2026-09-08
- Authority: この文書は案内専用です。確定要件は `specification.md`、検証済み進捗は `roadmaps/` を正とします。

## How to Start Work

1. ルートの `AGENTS.md` を読む。
2. `../governance/project-rules.md` を読む。
3. 下表から作業種別を選ぶ。
4. 関連ロードマップとADRを読む。
5. 変更前に関連コード、テスト、証拠を確認する。

## Work Routing

| Work type | Required documents | Additional implementation or evidence |
| --- | --- | --- |
| 要件・仕様 | [仕様](specification.md)、[ロードマップ](roadmaps/auto-clp.md)、関連[ADR](decisions/README.md)、[利用者向けCLP用語](decisions/0024-user-facing-clp-terminology.md)、[viewer-first Application Shell](decisions/0025-viewer-first-application-shell.md)、[tabbed scene・寸法annotation・判定dialog](decisions/0026-tabbed-scene-annotations-and-validation-dialog.md)、[欄外tab・簡略寸法・icon-only lamp](decisions/0027-external-tabs-compact-dimensions-and-icon-lamp.md)、[操作方法・compact寸法矢印](decisions/0028-operation-guide-and-compact-dimension-arrows.md)、[Drawer追加入口・自動提案公開延期](decisions/0029-phase1-drawer-entry-and-automatic-proposal-deferral.md)、[コンテナ専用化・Drawer管理](decisions/0030-container-only-drawer-management.md)、[積荷合成重心の参考可視化](decisions/0032-cargo-center-of-gravity-visualization.md)、[同径・外枠なしの重心ドット](decisions/0033-equal-borderless-center-markers.md)、[CSVテンプレートによる積荷一括置換](decisions/0034-cargo-csv-template-and-replacement-import.md)、[単一支持グループ移動](decisions/0035-recursive-single-support-group-movement.md)、[CSV破棄範囲確認文](decisions/0036-cargo-csv-destructive-confirmation-copy.md) | 影響する実装、テスト、運用、変更履歴 |
| 3D操作案内・表示微調整 | [仕様](specification.md)、[ADR 0025](decisions/0025-viewer-first-application-shell.md)、[ADR 0027](decisions/0027-external-tabs-compact-dimensions-and-icon-lamp.md)、[ADR 0028](decisions/0028-operation-guide-and-compact-dimension-arrows.md)、[ADR 0029](decisions/0029-phase1-drawer-entry-and-automatic-proposal-deferral.md)、[ADR 0030](decisions/0030-container-only-drawer-management.md) | Drawer/dialog/focus、コンテナ管理入口、操作copy、寸法marker、座標copy、狭幅・ブラウザ証拠 |
| データ・保存 | [仕様](specification.md)、[データ契約](data-model.md)、[ADR 0009](decisions/0009-versioned-project-data-contract.md)、[ADR 0010](decisions/0010-container-coordinate-and-placement-anchor.md) | JSON Schema、意味検証、座標意味、往復・失敗時保持テスト |
| 3D表示・操作 | [仕様](specification.md)、[データ契約](data-model.md)、[ADR 0001](decisions/0001-local-first-web-architecture.md)、[ADR 0002](decisions/0002-cuboid-model.md)、[ADR 0010](decisions/0010-container-coordinate-and-placement-anchor.md)、[ADR 0015](decisions/0015-scene-wheel-drag-out-and-size-copy.md)、[ADR 0017](decisions/0017-scene-workbench-rotation-and-compact-controls.md)、[ADR 0018](decisions/0018-scene-drag-classification-and-dialog-editors.md)、[ADR 0019](decisions/0019-support-surface-snap-and-conditional-support.md)、[ADR 0020](decisions/0020-actionable-opening-diagnostics-and-drag-focus.md)、[ADR 0021](decisions/0021-fixed-rotation-toolbar-and-axis-icons.md)、[ADR 0022](decisions/0022-upright-only-orientation-policy.md)、[ADR 0023](decisions/0023-webgl-required-operation-and-read-only-rescue.md)、[ADR 0025](decisions/0025-viewer-first-application-shell.md)、[ADR 0026](decisions/0026-tabbed-scene-annotations-and-validation-dialog.md)、[ADR 0027](decisions/0027-external-tabs-compact-dimensions-and-icon-lamp.md)、[将来scene設計提案](designs/future-scene-workspace.md) | 実装後の3Dコード、能力ゲート、救出境界、座標adapter、単体テスト、ブラウザ証拠。scene提案の複数候補部分はADR 0026・0027で採用・修正済み、積荷画像部分だけを未承認として扱う |
| 積載制約 | [仕様](specification.md)、[データ契約](data-model.md)、[ADR 0002](decisions/0002-cuboid-model.md)、[ADR 0003](decisions/0003-loading-constraints.md)、[ADR 0006](decisions/0006-rectangular-opening-model.md)、[ADR 0008](decisions/0008-stacking-support-and-load.md)、[ADR 0010](decisions/0010-container-coordinate-and-placement-anchor.md)、[ADR 0011](decisions/0011-axis-clearance-semantics.md)、[ADR 0012](decisions/0012-independent-physical-validation-diagnostics.md)、[ADR 0019](decisions/0019-support-surface-snap-and-conditional-support.md)、[ADR 0020](decisions/0020-actionable-opening-diagnostics-and-drag-focus.md) | 実装後の計算コード、境界・失敗系テスト |
| 重量バランス可視化 | [仕様](specification.md)、[データ契約](data-model.md)、[ADR 0032](decisions/0032-cargo-center-of-gravity-visualization.md)、[ADR 0033](decisions/0033-equal-borderless-center-markers.md)、[Phase 1合成受入契約](acceptance.md)、[ロードマップ](roadmaps/auto-clp.md) | 正確な重量moment、4状態、同径・外枠なしの赤・黄ドット、完全一致時の黄前面表示、画面外status、凡例、非操作、狭幅・DPR・camera・履歴・保存回帰、非保証表示 |
| CSV積荷一括作成・置換 | [仕様](specification.md)、[データ契約](data-model.md)、[ADR 0034](decisions/0034-cargo-csv-template-and-replacement-import.md)、[ADR 0036](decisions/0036-cargo-csv-destructive-confirmation-copy.md)、[AC-07](acceptance.md#ac-07-cargo-csv-template-and-atomic-replacement)、[ロードマップ](roadmaps/auto-clp.md) | Excel向け固定CSV、30件新規作成上限、全行検証、破棄・保持範囲の確認、一回のUndo/Redo、既存31〜1,000件互換、Excel往復 |
| 積荷制約一覧編集 | [仕様](specification.md)、[データ契約](data-model.md)、[ADR 0037](decisions/0037-cargo-constraint-list-and-prohibition-wording.md)、[AC-09](acceptance.md#ac-09-cargo-constraint-batch-editing)、[ロードマップ](roadmaps/auto-clp.md) | 天地無用・上乗せ禁止だけの一覧、一回のUndo/Redo、既存配置保持、支持不可理由、狭幅・focus |
| 単一支持グループ移動 | [仕様](specification.md)、[データ契約](data-model.md)、[ADR 0035](decisions/0035-recursive-single-support-group-movement.md)、[AC-08](acceptance.md#ac-08-recursive-exact-support-group-movement)、[ロードマップ](roadmaps/auto-clp.md) | 完全な単一支持子孫の連動平行移動、一回のUndo/Redo、配置解除拒否、支持不可専用理由 |
| 将来自動提案の技術資産 | [仕様](specification.md)、[ADR 0004](decisions/0004-optimization-objective.md)、[ADR 0029](decisions/0029-phase1-drawer-entry-and-automatic-proposal-deferral.md)、[ロードマップ](roadmaps/auto-clp.md) | 現在UIで未提供。再開時の決定性、性能、最適性評価に使う[証拠索引](evidence/README.md) |
| テスト・レビュー | [検証選択policy](../governance/verification-policy.json)、[仕様](specification.md)、[運用](operations.md)、[ロードマップ](roadmaps/auto-clp.md) | 変更class、stage別gate ID、包含、失効、独立した終了コード、UI証拠 |
| 合成受入・実務試用 | [仕様](specification.md)、[Phase 1合成受入契約](acceptance.md)、[運用](operations.md)、[ロードマップ](roadmaps/auto-clp.md) | 匿名データ、自動証拠、観察記録、実務試用との区別 |
| `容量チェック` / `タスク容量確認` / `セッション容量確認` / `session size / handoff threshold確認` | [プロジェクト調整runbook](runbooks/project-coordination.md)、[ADR 0031](decisions/0031-user-requested-task-replacement.md) | 現在task ID、`../scripts/check-codex-session-size.ps1`、独立した終了コード。最新sessionを推測しない |
| ガバナンス・Git・引き継ぎ | [プロジェクト規則](../governance/project-rules.md)、[検証選択policy](../governance/verification-policy.json)、[運用](operations.md)、[プロジェクト調整runbook](runbooks/project-coordination.md)、[ADR 0031](decisions/0031-user-requested-task-replacement.md)、[採用契約](../references/README.md)、[文書移行対応表](migrations/document-plan.json) | 管理ハッシュ、7分類とruntime、comprehensive fallback、Git差分、既存正本による再開。旧handoffは履歴参照のみ |

## Document Authority

| Document | Authoritative content |
| --- | --- |
| `../governance/common-governance.md` | 管理されたプロジェクト横断ガバナンス。直接編集禁止 |
| `../governance/project-rules.md` | プロジェクト固有の指示、所有権、安全、承認境界 |
| `../governance/verification-policy.json` | 変更class、stage別gate、包含、失効、省略、comprehensive fallbackの機械可読な正本 |
| `specification.md` | 現在の確定要件と明確に分離した未決定事項 |
| `data-model.md` | CLP JSONの意味契約、参照整合性、予定モジュール境界 |
| `roadmaps/` | 目標、残作業、完了条件、検証済み進捗 |
| `decisions/` | 重要判断の状態と根拠 |
| `designs/` | 未承認の実装前設計提案。確定要件またはAccepted ADRとして扱わない |
| `operations.md` | 実装済み、計画済み、利用不可の運用 |
| `runbooks/project-coordination.md` | checkpoint、callback、Git統合、task交代、session容量確認の実行手順 |
| [handoffs/](handoffs/README.md) | Historical。旧task ID・baseline・ownershipの履歴。現在owner・承認状態や起動条件の正本ではない |
| `../references/` | 採用した共通契約の参照snapshotと所在。現行project指示はAGENTSとproject-rules |
| `migrations/document-plan.json` | 文書移行の元hash・正本対応・承認された意味変更のinventory。交代台帳ではない |
| `acceptance.md` | Phase 1の匿名合成受入ケース、合格基準、観察記録 |
| `evidence/` | 再現可能な技術検証記録。一般端末SLA、実務受入、安全保証とは区別 |
| `../CHANGELOG.md` | 仕様・利用者・安全・運用に見える変更 |

## Documentation Completion Criteria

- 重要文書が本マップまたは関連索引から到達可能である。
- ロードマップの進捗値と索引が一致し、各マイルストーンが主要証拠へリンクする。
- 確定、提案、証拠、履歴が区別されている。
- ADR索引の状態と本文が一致する。
- 相対リンク、索引網羅性、ロードマップ計算、エージェントTOMLが `../scripts/check-project.ps1` に合格する。
- 変更を検証policyのclassへ分類し、mixed changeはstage別gateの和集合、unknown impactはcomprehensive fallbackを使う。包含gateを重複実行せず、省略理由と後続変更によるevidence失効を記録する。
- 必須検証は個別のコマンド、結果、終了コードを残す。まとめる場合は失敗を非ゼロで返す検証済みランナーだけを使い、診断バッチや状態を隠すコマンド連結を完了証拠にしない。
