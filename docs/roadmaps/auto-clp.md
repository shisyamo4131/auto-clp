# Auto CLP Roadmap

- Goal: 初期利用者が代表的な精密機器輸送ケースを3Dで検討し、適合するコンテナと配置案を得られるローカルWebアプリを完成させる。
- Current progress: 94%
- Last reviewed: 2026-08-28
- Approval boundary: 重要仕様変更、外部通信、デプロイ、実データ利用、破壊的操作、Git履歴書き換えは明示承認を要する。

## Milestones

| Milestone | Weight | Earned | Status | Completion evidence and remaining work |
| --- | ---: | ---: | --- | --- |
| 基盤・データ契約 | 10 | 10 | Complete | ガバナンス、仕様、主要制約ADR、版付きJSON Schema、完全なreadonly案件型、構造・意味検証、検証済み書出し、取引的読込基盤、最小アプリ骨格、WebGL 2能力ゲート、向き適用関数と検証を作成 |
| 積荷・コンテナ入力モデル | 15 | 15 | Complete | 案件・隙間・積荷・候補の入力、一覧、編集、明示削除、mm・kg変換、許可向き、原子的検証、アクセシビリティ、狭幅表示を実装し検証 |
| 3D表示と手動配置 | 25 | 22 | In progress | 座標契約、候補・積荷選択、Project→scene投影・描画、投影範囲適応camera、フォーム配置編集、canvas床面方向drag、視点操作、最大100件の案件undo/redoを実装。canvas上のZ移動・向き変更・取り外しは必要性を未検証 |
| 物理制約の判定 | 20 | 20 | Complete | 低レベルgeometry・耐荷重評価、高位集約、境界違反のカスケード抑制、100%支持時だけの隙間例外、独立理由、計算不能、ローカルWorker評価、理由ページ、WebGL非依存UI、許可上限1,000配置の応答性を実装・検証 |
| 保存・再読込・操作性 | 10 | 10 | Complete | IndexedDB単一手動枠の保存・読込・確認削除、固定名JSON入出力、全候補Worker事前判定、履歴barrier、失敗・競合復旧、focus・狭幅を実装・検証 |
| コンテナ・配置の自動提案 | 15 | 15 | Complete | 決定的探索、Worker、session/view、React panel、Appのbusy・generation gate、取消・retry、非永続preview、再検証付き一括適用、一回のUndo/Redoを実装・検証。AP-08代表規模の実Worker性能・決定性・main timer/rAF・native取消を記録環境で検証 |
| 実務利用者による受入 | 5 | 2 | In progress | 4本の匿名合成ケース、合格基準、観察様式、自動証拠の対応付けと実行を完了。開発チーム内試用、実務利用者試用は未完了 |
| **Total** | **100** | **94** |  |  |

部分点は、上表または下表で独立した完了サブゲートと証拠が示された場合だけ認める。

## Next Work

1. 匿名合成受入ケースを開発チーム内で実機試用し、操作補助なしの完了可否と誤認し得る表示を観察記録へ残す。
2. 開発チーム内試用と後続の実務試用で、canvas上のZ移動・向き変更・取り外しが必要か観察し、必要な範囲だけ追加する。
3. 実務利用者試用の評価担当、日程、合否記録を決め、匿名の観察記録として実施する。

## Deliverables and Verification Evidence

| Milestone | Design or decision | Implementation | Tests, review, deployment, or acceptance evidence |
| --- | --- | --- | --- |
| 基盤・データ契約 | [仕様](../specification.md)、[ADR索引](../decisions/README.md)、[データ契約](../data-model.md)、[JSON Schema](../../schemas/project-0.1.0.schema.json) | JSON Schema `0.1.0`、完全な案件型、構造・意味検証、検証済み書出し、取引的読込、TypeScript/React/Three.js/Vite骨格、WebGL 2能力ゲート、向き適用関数 | データ契約・型・lint・単体88件・ブラウザ4件・ビルド・ガバナンス検証 |
| 積荷・コンテナ入力モデル | [仕様](../specification.md)、[ADR 0005](../decisions/0005-canonical-units-and-ranges.md)、[ADR 0007](../decisions/0007-cargo-orientation-policy.md) | 検証済みProject command、案件・隙間・積荷・候補の入力編集UI | 型・lint・単体147件・ブラウザ11件・実UIレビュー（305/320/375pxを含む） |
| 3D表示と手動配置 | [仕様](../specification.md)、[ADR 0001](../decisions/0001-local-first-web-architecture.md)、[ADR 0002](../decisions/0002-cuboid-model.md)、[ADR 0010](../decisions/0010-container-coordinate-and-placement-anchor.md) | 座標契約、純粋な配置範囲・scene/drag adapter、非永続の候補・積荷選択、コンテナ内部・中央開口・登録済み配置の描画、全投影範囲camera、原子的なフォーム配置編集、canvas床面方向drag、視点操作、最大100件のProject参照履歴と案件undo/redo UI | 型・lint・全単体567件・全ブラウザ37件・ビルド・305/320/375px Chromium実UI試験・独立コードレビュー |
| 物理制約の判定 | [ADR 0003](../decisions/0003-loading-constraints.md)、[ADR 0006](../decisions/0006-rectangular-opening-model.md)、[ADR 0008](../decisions/0008-stacking-support-and-load.md)、[ADR 0010](../decisions/0010-container-coordinate-and-placement-anchor.md)、[ADR 0011](../decisions/0011-axis-clearance-semantics.md)、[ADR 0012](../decisions/0012-independent-physical-validation-diagnostics.md) | 低レベルgeometry・耐荷重評価、高位独立診断、ローカルmodule Worker、状態・対象・関連積荷・理由・判定不能のアクセシブルなUI、25件理由ページ、遅延結果破棄と再試行 | 全単体551件・全ブラウザ31件。1,000同一bounds配置で499,500不適合理由と1,000未確認理由を打切りなく保持し、summaryは件数だけ、先頭・中間・末尾を各25件取得しながらmain timer/rAFが進むことを実Workerで検証。305/320/375px実UIと独立レビュー合格 |
| 保存・再読込・操作性 | [仕様](../specification.md)、[ADR 0009](../decisions/0009-versioned-project-data-contract.md)、[ADR 0013](../decisions/0013-manual-local-persistence-and-json-files.md) | IndexedDB単一手動枠、transaction完了後save、読込・確認削除、固定名JSON file adapter、全候補one-shot preflight Worker、履歴barrier、固定code UI | 全単体623件・全ブラウザ48件。実IndexedDB reload/delete、download/reimport、JSON全失敗段階、blocked/abort/破損、遅延競合、focus、WebGL非依存、305/320/375px、1,000配置・100候補の実Worker応答性、独立レビュー合格 |
| コンテナ・配置の自動提案 | [ADR 0004](../decisions/0004-optimization-objective.md)、[合成受入AP-01〜08](../acceptance.md#automatic-proposal-synthetic-cases) | 純粋探索・Worker・session/view、React hook/panel、Project/generationとbusy gate、実Worker開始・取消・retry、非永続preview、適用直前再検証、確認付き一括適用、同一案no-op、一回のUndo/Redo、25件pageを実装 | domain31件、Worker80件、apply21件を含む全単体839件・全ブラウザ63件。実Worker AP-02/AP-03、Project/history非変更、stale、正常JSON置換、適用・no-op・Undo/Redo、警告保持、WebGL非依存、ARIA、305/320/375px、独立レビュー合格。AP-08は[記録環境の技術証拠](../evidence/automatic-proposal-ap08-1226b082.md)でcold 59.7 ms、warm 48.7〜50.9 ms、各210 attempts・同一hash、native取消0 ms・UI 0.5 ms、console 0件を確認。一般端末SLAではない |
| 実務利用者による受入 | [仕様の完了条件](../specification.md#current-phase-completion-criteria)、[Phase 1合成受入契約](../acceptance.md) | 4本の匿名合成ケース、共通合格基準、観察様式、床突き抜け専用診断を確定 | 全単体628件・全ブラウザ51件、型・lint・build、文書・データ・ガバナンス検証、独立レビュー合格。開発チーム内試用と実務利用者試用は未実施 |

## Unresolved Problems and Decisions

- 実務利用者試用の評価担当、日程、合否記録が未決定。
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
| 2026-08-27 | 25% | +15 | 案件・隙間・積荷・候補の入力、検証、編集、一覧、削除確認、確定単位・値域、許可向き、狭幅・キーボード操作を実装し、単体147件・ブラウザ11件・独立レビューで検証 |
| 2026-08-27 | 26% | +1 | ADR 0010でコンテナ局所右手座標、負X側開口面の原点、向き適用後AABB最小角の `positionMm` を確定し、3D・配置・物理判定の共通前提を作成 |
| 2026-08-27 | 31% | +5 | 候補選択、Project→scene一方向投影、コンテナ内部・中央開口・登録済み配置の描画、外側配置を含む投影範囲cameraを実装し、単体162件・ブラウザ15件・実UI・独立レビューで検証 |
| 2026-08-27 | 37% | +6 | 保存前draftを正規案件から分離した配置追加・整数mm移動・許可向き変更・取り外しフォームを実装し、負・候補外座標、候補lock、stale復旧、WebGL非対応、狭幅を単体201件・ブラウザ19件・独立レビューで検証 |
| 2026-08-27 | 45% | +8 | canvas上の積荷選択、Project非変更preview、最近接1 mmの床面方向drag、取消・描画障害rollback、視点操作、タッチ・フォームfallbackを実装し、単体212件・ブラウザ23件・実UI・独立レビューで検証 |
| 2026-08-27 | 47% | +2 | コンテナ包含と正体積AABB重なりの純粋geometry基盤を実装し、全軸の等値・±1 mm、正負側接触、対称性、退化・反転、非変異を含む全単体272件と独立レビューで検証 |
| 2026-08-27 | 48% | +1 | 軸別隙間を表面間の実距離とし、配置後の適用面、床・支持例外、非支持ペアの分離軸規則を仕様0.5.0とADR 0011で確定 |
| 2026-08-27 | 50% | +2 | 隙間込み5面境界と床例外、非支持ペアの共有表面間距離・複数分離軸を純粋関数として実装し、geometry145件・全単体343件と独立レビューで検証 |
| 2026-08-27 | 52% | +2 | 矩形開口の2Y・1Z寸法式と許可向き抽出を純粋関数として実装し、全6向き・等値・±1 mm・X非依存をgeometry170件・全単体368件と独立レビューで検証 |
| 2026-08-27 | 53% | +1 | 非負safe integerの積荷質量をoverflowなく合計し、耐荷重の等値・1 g超過・計算不能を区別する純粋評価をvalidation31件・全単体391件と独立レビューで検証 |
| 2026-08-27 | 54% | +1 | 同一高さ支持の後段判定に使うXY矩形和集合100%被覆を純粋関数として実装し、1 mm欠け・複数支持・重複・外側clip・無効入力をgeometry205件・全単体426件と独立レビューで検証 |
| 2026-08-27 | 55% | +1 | 床支持と、段積み許可された候補上面の完全一致Z接触・XY 100%被覆を純粋関数で合成し、geometry233件・全単体454件と独立レビューで検証 |
| 2026-08-27 | 59% | +4 | 境界違反を独立・優先表示しながら無関係な理由を保持する仕様0.6.0とADR 0012を確定し、対象コンテナの境界・重なり・隙間・開口・支持・耐荷重を集約する純粋判定をvalidation65件・全単体488件と独立レビューで検証 |
| 2026-08-27 | 65% | +6 | 物理判定をローカルmodule Workerへ接続し、適合・不適合・未確認・判定不能、対象・関連積荷、独立理由をアクセシブルにページ表示。全単体551件・ブラウザ31件、許可上限1,000配置の499,500不適合理由を含む実Worker試験、305/320/375px実UI、独立レビューで物理制約マイルストーンを完了 |
| 2026-08-28 | 67% | +2 | 案件設定・積荷・候補・配置・1回の3D床面dragを最大100件取り消し・やり直しできる非永続履歴を実装。stale/no-op/分岐、入力中lock、native入力履歴保護、WebGL非依存、全単体567件・全ブラウザ37件、305/320/375px実UI、独立レビューで検証 |
| 2026-08-28 | 77% | +10 | IndexedDB単一手動枠、固定名JSON入出力、全候補Worker事前判定、履歴barrier、固定code失敗表示を実装。全単体623件・全ブラウザ48件で実reload/delete/download/reimport、失敗段階、競合、focus、狭幅、1,000配置・100候補応答性を検証し、保存・再読込・操作性マイルストーンを完了 |
| 2026-08-28 | 78% | +1 | 4本の匿名合成受入ケース、合格基準、観察様式を確定し、実務利用者試用と区別した技術受入の正本を追加 |
| 2026-08-28 | 79% | +1 | 床突き抜け専用診断とWorker伝送を実装し、合成ケースを全単体628件・全ブラウザ51件へ対応付けて自動証拠サブゲートを完了。人間による試用は未実施 |
| 2026-08-28 | 81% | +2 | ADR 0004をAcceptedとし、一候補完全案、内部容積優先、DFS列挙、決定的attempt上限と境界、cutoff/no-complete-plan、非永続preview、確認付き一括適用、安全copy、数値入りAP-01〜08を確定。実装は未着手 |
| 2026-08-28 | 85% | +4 | 検証済みProject用の純粋な決定的DFSと31件の専用試験を追加。目的順位、向き重複排除、最大2,048候補点、backtrack、10,000/1,000,000境界、cutoff集約、未確認理由、入力非変異を全単体659件・全ブラウザ51件・独立レビューで検証。Worker・UIは未実装 |
| 2026-08-28 | 87% | +2 | 正本Schema・意味検証からのprivate brand、one-shot自動提案Worker、厳格な応答guard、固定code client、即時terminate取消と遅延応答maskを実装。専用80件・全単体739件、型・lint・build、独立レビューで検証。App接続・実Worker試験は未実施 |
| 2026-08-28 | 88% | +1 | React非依存の自動提案session/viewを追加。Project参照・generation stale、取消・retry race、source ID相関、固定安全copy、25件pageを専用64件・全単体803件・独立レビューで検証。App接続は未実施 |
| 2026-08-28 | 91% | +3 | 自動提案をReact hook/panelとAppへ接続し、実Worker開始・取消・retry、Project/interaction generation stale、非永続preview、25件pageを全単体803件・全ブラウザ58件、305/320/375px、独立レビューで検証。適用、Undo、AP-08代表規模の実時間性能は未実施 |
| 2026-08-28 | 93% | +2 | 自動提案の適用直前再検証、常時確認、配置だけの一括置換、同一案no-op、一履歴操作のUndo/Redoを実装。全単体839件・全ブラウザ62件でAP-02/AP-03、警告保持、stale・busy・二重適用、狭幅・WebGL非依存を検証。AP-08実時間性能は未実施 |
| 2026-08-28 | 94% | +1 | AP-08の匿名20積荷fixtureをproduction module Workerで測定。記録環境でcold 59.7 ms、warm 48.7〜50.9 ms、全4回210 attempts・同一hash、main timer/rAF進行、native取消0 ms・UI 0.5 ms、console 0件を検証し、自動提案マイルストーンを完了。一般端末SLA、最低GPU、実務受入ではない |
