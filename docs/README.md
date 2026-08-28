# Documentation Map

- Status: Active
- Last verified: 2026-08-28
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
| 要件・仕様 | [仕様](specification.md)、[ロードマップ](roadmaps/auto-clp.md)、関連[ADR](decisions/README.md) | 影響する実装、テスト、運用、変更履歴 |
| データ・保存 | [仕様](specification.md)、[データ契約](data-model.md)、[ADR 0009](decisions/0009-versioned-project-data-contract.md)、[ADR 0010](decisions/0010-container-coordinate-and-placement-anchor.md) | JSON Schema、意味検証、座標意味、往復・失敗時保持テスト |
| 3D表示・操作 | [仕様](specification.md)、[データ契約](data-model.md)、[ADR 0001](decisions/0001-local-first-web-architecture.md)、[ADR 0002](decisions/0002-cuboid-model.md)、[ADR 0010](decisions/0010-container-coordinate-and-placement-anchor.md) | 実装後の3Dコード、座標adapter、単体テスト、ブラウザ証拠 |
| 積載制約 | [仕様](specification.md)、[データ契約](data-model.md)、[ADR 0002](decisions/0002-cuboid-model.md)、[ADR 0003](decisions/0003-loading-constraints.md)、[ADR 0006](decisions/0006-rectangular-opening-model.md)、[ADR 0008](decisions/0008-stacking-support-and-load.md)、[ADR 0010](decisions/0010-container-coordinate-and-placement-anchor.md)、[ADR 0011](decisions/0011-axis-clearance-semantics.md)、[ADR 0012](decisions/0012-independent-physical-validation-diagnostics.md) | 実装後の計算コード、境界・失敗系テスト |
| 自動提案 | [仕様](specification.md)、[ADR 0004](decisions/0004-optimization-objective.md)、[ロードマップ](roadmaps/auto-clp.md) | 決定性、性能、最適性評価の[証拠索引](evidence/README.md) |
| テスト・レビュー | [仕様](specification.md)、[運用](operations.md)、[ロードマップ](roadmaps/auto-clp.md) | 対象差分、独立した終了コード、UI証拠 |
| 合成受入・実務試用 | [仕様](specification.md)、[Phase 1合成受入契約](acceptance.md)、[運用](operations.md)、[ロードマップ](roadmaps/auto-clp.md) | 匿名データ、自動証拠、観察記録、実務試用との区別 |
| `容量チェック` / `タスク容量確認` / `セッション容量確認` / `session size / handoff threshold確認` | [プロジェクト調整runbook](runbooks/project-coordination.md)、[ADR 0016](decisions/0016-project-coordination-and-session-capacity-routing.md) | 現在task ID、`../scripts/check-codex-session-size.ps1`、独立した終了コード。最新sessionを推測しない |
| ガバナンス・Git・引き継ぎ | [プロジェクト規則](../governance/project-rules.md)、[運用](operations.md)、[プロジェクト調整runbook](runbooks/project-coordination.md)、[handoff index](handoffs/README.md) | 管理ハッシュ、Git差分、タスク状態、最新handoff record |

## Document Authority

| Document | Authoritative content |
| --- | --- |
| `../governance/common-governance.md` | 管理されたプロジェクト横断ガバナンス。直接編集禁止 |
| `../governance/project-rules.md` | プロジェクト固有の指示、所有権、安全、承認境界 |
| `specification.md` | 現在の確定要件と明確に分離した未決定事項 |
| `data-model.md` | 案件JSONの意味契約、参照整合性、予定モジュール境界 |
| `roadmaps/` | 目標、残作業、完了条件、検証済み進捗 |
| `decisions/` | 重要判断の状態と根拠 |
| `operations.md` | 実装済み、計画済み、利用不可の運用 |
| `runbooks/project-coordination.md` | checkpoint、callback、Git統合、task交代、session容量確認の実行手順 |
| `handoffs/` | 一時task ID、baseline、pending checkpoint、ownership移転の記録 |
| `acceptance.md` | Phase 1の匿名合成受入ケース、合格基準、観察記録 |
| `evidence/` | 再現可能な技術検証記録。一般端末SLA、実務受入、安全保証とは区別 |
| `../CHANGELOG.md` | 仕様・利用者・安全・運用に見える変更 |

## Documentation Completion Criteria

- 重要文書が本マップまたは関連索引から到達可能である。
- ロードマップの進捗値と索引が一致し、各マイルストーンが主要証拠へリンクする。
- 確定、提案、証拠、履歴が区別されている。
- ADR索引の状態と本文が一致する。
- 相対リンク、索引網羅性、ロードマップ計算、エージェントTOMLが `../scripts/check-project.ps1` に合格する。
- 必須検証は個別のコマンド、結果、終了コードを残す。まとめる場合は失敗を非ゼロで返す検証済みランナーだけを使い、診断バッチや状態を隠すコマンド連結を完了証拠にしない。
