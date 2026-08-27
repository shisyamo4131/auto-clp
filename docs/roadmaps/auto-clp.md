# Auto CLP Roadmap

- Goal: 初期利用者が代表的な精密機器輸送ケースを3Dで検討し、適合するコンテナと配置案を得られるローカルWebアプリを完成させる。
- Current progress: 10%
- Last reviewed: 2026-08-27
- Approval boundary: 重要仕様変更、外部通信、デプロイ、実データ利用、破壊的操作、Git履歴書き換えは明示承認を要する。

## Milestones

| Milestone | Weight | Earned | Status | Completion evidence and remaining work |
| --- | ---: | ---: | --- | --- |
| 基盤・データ契約 | 10 | 10 | Complete | ガバナンス、仕様、主要制約ADR、版付きJSON Schema、完全なreadonly案件型、構造・意味検証、検証済み書出し、取引的読込基盤、最小アプリ骨格、WebGL 2能力ゲート、向き適用関数と検証を作成 |
| 積荷・コンテナ入力モデル | 15 | 0 | Not started | 入力、検証、編集、一覧、確定済み単位・値域の実装とテスト |
| 3D表示と手動配置 | 25 | 0 | Not started | 描画、選択、移動、回転、カメラ、取り消し、ブラウザ試験 |
| 物理制約の判定 | 20 | 0 | Not started | 境界、重なり、開口部、段積み、耐荷重、軸別隙間の計算と境界テスト |
| 保存・再読込・操作性 | 10 | 0 | Not started | 端末内保存、版付きJSON入出力、エラー復旧、利用者向け操作性 |
| コンテナ・配置の自動提案 | 15 | 0 | Not started | 目的関数、探索、決定性、打切り、性能、提案説明 |
| 実務利用者による受入 | 5 | 0 | Not started | 匿名化した代表ケース、試用、観察、合格記録 |
| **Total** | **100** | **10** |  |  |

部分点は、上表または下表で独立した完了サブゲートと証拠が示された場合だけ認める。

## Next Work

1. 積荷・コンテナ・隙間の入力と編集を、検証済み案件状態へ接続する。
2. 直方体表示に案件データを接続し、手動配置の最小経路を作る。
3. File・端末保存アダプターと利用者向けJSON入出力を接続する。

## Deliverables and Verification Evidence

| Milestone | Design or decision | Implementation | Tests, review, deployment, or acceptance evidence |
| --- | --- | --- | --- |
| 基盤・データ契約 | [仕様](../specification.md)、[ADR索引](../decisions/README.md)、[データ契約](../data-model.md)、[JSON Schema](../../schemas/project-0.1.0.schema.json) | JSON Schema `0.1.0`、完全な案件型、構造・意味検証、検証済み書出し、取引的読込、TypeScript/React/Three.js/Vite骨格、WebGL 2能力ゲート、向き適用関数 | データ契約・型・lint・単体88件・ブラウザ4件・ビルド・ガバナンス検証 |
| 積荷・コンテナ入力モデル | [仕様](../specification.md) | 未実装 | 未実施 |
| 3D表示と手動配置 | [ADR 0001](../decisions/0001-local-first-web-architecture.md)、[ADR 0002](../decisions/0002-cuboid-model.md) | 未実装 | 未実施 |
| 物理制約の判定 | [ADR 0003](../decisions/0003-loading-constraints.md) | 未実装 | 未実施 |
| 保存・再読込・操作性 | [仕様](../specification.md) | 未実装 | 未実施 |
| コンテナ・配置の自動提案 | [ADR 0004](../decisions/0004-optimization-objective.md) | 未実装 | 未実施 |
| 実務利用者による受入 | [仕様の完了条件](../specification.md#current-phase-completion-criteria) | 未実装 | 受入ケースと記録は未作成 |

## Unresolved Problems and Decisions

- 自動提案の目的関数と許容計算時間が未決定。
- 実務受入ケースと合格基準が未決定。
- 対応ブラウザと最低GPU性能が未決定。

## Definition of Done

- `../specification.md` の現行範囲とPhase 1完了条件を満たす。
- 自動提案が、定義済み目的関数に基づく再現可能な候補を返す。
- 代表ケースで利用者が入力、3D確認、適合性確認、保存・再読込を完了できる。
- 必須検証がすべて個別に成功し、レビューで重大な未解決事項がない。
- 仕様、ADR、ロードマップ、運用、変更履歴、利用者向け文書が実装と一致する。

## Progress History

| Date | Progress | Change | Reason and evidence |
| --- | ---: | ---: | --- |
| 2026-08-27 | 4% | Baseline | 承認済みのガバナンス、初期仕様、ADR、ロードマップを作成。アプリ実装と技術スパイクは未着手 |
| 2026-08-27 | 6% | +2 | 正規単位・値域、矩形開口、積荷別許可回転、保守的な支持・荷重ルールをADR 0005〜0008で確定。JSONスキーマとアプリ実装は未着手 |
| 2026-08-27 | 8% | +2 | 案件JSON Schema `0.1.0`、意味契約、モジュール境界、依存不要の契約チェックを作成。アプリ実装は未着手 |
| 2026-08-27 | 9% | +1 | 最小Webアプリ骨格、WebGL 2能力ゲート、Three.js技術確認描画、純粋な向き適用関数と独立したアプリ検証を追加。完全な案件型と意味検証は未着手 |
| 2026-08-27 | 10% | +1 | 完全なreadonly案件型、Draft 2020-12構造検証、意味検証、検証済み書出し、失敗時状態保持を含む取引的読込基盤と境界テストを追加 |
