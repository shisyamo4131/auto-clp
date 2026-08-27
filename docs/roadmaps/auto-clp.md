# Auto CLP Roadmap

- Goal: 初期利用者が代表的な精密機器輸送ケースを3Dで検討し、適合するコンテナと配置案を得られるローカルWebアプリを完成させる。
- Current progress: 6%
- Last reviewed: 2026-08-27
- Approval boundary: 重要仕様変更、外部通信、デプロイ、実データ利用、破壊的操作、Git履歴書き換えは明示承認を要する。

## Milestones

| Milestone | Weight | Earned | Status | Completion evidence and remaining work |
| --- | ---: | ---: | --- | --- |
| 基盤・データ契約 | 10 | 6 | In progress | ガバナンス、初期仕様、ロードマップ、正規単位・開口部・許可回転・支持荷重ADRを作成。JSONスキーマ、アプリ骨格、技術スパイクが残る |
| 積荷・コンテナ入力モデル | 15 | 0 | Not started | 入力、検証、編集、一覧、確定済み単位・値域の実装とテスト |
| 3D表示と手動配置 | 25 | 0 | Not started | 描画、選択、移動、回転、カメラ、取り消し、ブラウザ試験 |
| 物理制約の判定 | 20 | 0 | Not started | 境界、重なり、開口部、段積み、耐荷重、軸別隙間の計算と境界テスト |
| 保存・再読込・操作性 | 10 | 0 | Not started | 端末内保存、版付きJSON入出力、エラー復旧、利用者向け操作性 |
| コンテナ・配置の自動提案 | 15 | 0 | Not started | 目的関数、探索、決定性、打切り、性能、提案説明 |
| 実務利用者による受入 | 5 | 0 | Not started | 匿名化した代表ケース、試用、観察、合格記録 |
| **Total** | **100** | **6** |  |  |

部分点は、上表または下表で独立した完了サブゲートと証拠が示された場合だけ認める。

## Next Work

1. 版付き案件JSONスキーマと純粋な幾何・検証モジュールの境界を定義する。
2. TypeScript、React、Three.js、Viteの最小アプリ骨格とWebGL 2対応確認画面を作る。
3. 対応ブラウザと最低GPU性能の検証方法、代表受入ケースと合格基準を確定する。

## Deliverables and Verification Evidence

| Milestone | Design or decision | Implementation | Tests, review, deployment, or acceptance evidence |
| --- | --- | --- | --- |
| 基盤・データ契約 | [仕様](../specification.md)、[ADR索引](../decisions/README.md)、[単位](../decisions/0005-canonical-units-and-ranges.md)、[開口部](../decisions/0006-rectangular-opening-model.md)、[許可回転](../decisions/0007-cargo-orientation-policy.md)、[支持荷重](../decisions/0008-stacking-support-and-load.md) | アプリ未実装 | ガバナンス検証と文書検証。JSONスキーマと技術スパイクは未実施 |
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
