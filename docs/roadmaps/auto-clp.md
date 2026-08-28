# Auto CLP Roadmap

- Goal: 初期利用者が代表的な精密機器輸送ケースを3Dで検討し、適合するコンテナと配置案を得られるローカルWebアプリを完成させる。
- Current progress: 98%
- Last reviewed: 2026-08-28
- Approval boundary: 重要仕様変更、外部通信、デプロイ、実データ利用、破壊的操作、Git履歴書き換えは明示承認を要する。

## Milestones

| Milestone | Weight | Earned | Status | Completion evidence and remaining work |
| --- | ---: | ---: | --- | --- |
| 基盤・データ契約 | 10 | 10 | Complete | ガバナンス、仕様、主要制約ADR、版付きJSON Schema、完全なreadonly案件型、構造・意味検証、検証済み書出し、取引的読込基盤、最小アプリ骨格、WebGL 2能力ゲート、向き適用関数と検証を作成 |
| 積荷・コンテナ入力モデル | 15 | 15 | Complete | 案件・隙間・積荷・候補の入力、一覧、編集、明示削除、mm・kg変換、許可向き、原子的検証、アクセシビリティ、狭幅表示を実装し検証 |
| 3D表示と手動配置 | 25 | 25 | Complete | 座標契約、候補・積荷選択、Project→scene投影・描画、荷室外の非永続仮置きとdrag初回配置、フォーム配置編集、canvas床面方向drag、正面積境界での完全drag-out仮置き復帰、選択積荷近傍の許可向き90度回転、viewport wheelのpage scrollと明示ボタンzoom、荷室基準の視点復元、3D直前の単一履歴操作、選択積荷の結果指向寸法・位置と座標フォーム導線を実装。正確なZ移動はフォームfallbackで提供 |
| 物理制約の判定 | 20 | 20 | Complete | 低レベルgeometry・耐荷重評価、高位集約、100%支持時だけの隙間例外、独立理由、計算不能、ローカルWorker評価、理由ページ、WebGL非依存UI、許可上限1,000配置の応答性を実装・検証。人間の派生床突き抜け観察で発見した境界違反由来の上段支持不足カスケード `HUT-01` は、診断上の床Z=0正規化、負例、複数支持、実Worker表示を追加して修正・回帰済み |
| 保存・再読込・操作性 | 10 | 10 | Complete | IndexedDB単一手動枠の保存・読込・確認削除、固定名JSON入出力、全候補Worker事前判定、履歴barrier、失敗・競合復旧、保存Navigation Drawer、操作単位Snackbar、modal focus・狭幅を実装・検証 |
| コンテナ・配置の自動提案 | 15 | 15 | Complete | 決定的探索、Worker、session/view、React panel、Appのbusy・generation gate、取消・retry、非永続preview、再検証付き一括適用、一回のUndo/Redoを実装・検証。AP-08代表規模の実Worker性能・決定性・main timer/rAF・native取消を記録環境で検証 |
| 実務利用者による受入 | 5 | 3 | In progress | 4本の匿名合成ケース、合格基準、自動証拠に加え、案内付き人間評価で移動・向き・削除・履歴・物理理由・保存・JSON往復と改善点を観察し、床突き抜け由来の支持不足カスケード不具合を発見。正式fixture、評価者区分、狭幅・Tab・fallback、実務利用者試用は未完了 |
| **Total** | **100** | **98** |  |  |

部分点は、上表または下表で独立した完了サブゲートと証拠が示された場合だけ認める。

## Next Work

1. [完了した `CP-PHASE1-SCENE-FEEDBACK-001`](../evidence/phase1-human-ui-trial-4e6c680.md#approved-follow-up-resolution) を、同じChrome操作で仮置きdrag、drag-out未配置化とUndo/Redo、近傍回転、カメラボタン、canvas上page scroll、座標導線、案件履歴、保存Drawer、Snackbar、結果指向表示として人間が再試用する。
2. `HUT-01` 修正後の派生床突き抜けfixtureを人間が再試用し、正式fixture、評価者区分、狭幅補足文、自然なTab順、確認後focus、WebGL非対応fallbackも観察する。
3. 実務利用者試用の評価担当、日程、合否記録を決める。JSON名の案件名利用は現仕様・ADRと衝突するため別承認まで変更しない。

## Deliverables and Verification Evidence

| Milestone | Design or decision | Implementation | Tests, review, deployment, or acceptance evidence |
| --- | --- | --- | --- |
| 基盤・データ契約 | [仕様](../specification.md)、[ADR索引](../decisions/README.md)、[データ契約](../data-model.md)、[JSON Schema](../../schemas/project-0.1.0.schema.json) | JSON Schema `0.1.0`、完全な案件型、構造・意味検証、検証済み書出し、取引的読込、TypeScript/React/Three.js/Vite骨格、WebGL 2能力ゲート、向き適用関数 | データ契約・型・lint・単体88件・ブラウザ4件・ビルド・ガバナンス検証 |
| 積荷・コンテナ入力モデル | [仕様](../specification.md)、[ADR 0005](../decisions/0005-canonical-units-and-ranges.md)、[ADR 0007](../decisions/0007-cargo-orientation-policy.md) | 検証済みProject command、案件・隙間・積荷・候補の入力編集UI | 型・lint・単体147件・ブラウザ11件・実UIレビュー（305/320/375pxを含む） |
| 3D表示と手動配置 | [仕様](../specification.md)、[ADR 0001](../decisions/0001-local-first-web-architecture.md)、[ADR 0002](../decisions/0002-cuboid-model.md)、[ADR 0010](../decisions/0010-container-coordinate-and-placement-anchor.md)、[ADR 0015](../decisions/0015-scene-wheel-drag-out-and-size-copy.md) | 座標契約、純粋な配置範囲・正面積overlap・scene/drag adapter、非永続の候補・積荷選択・仮置きgrid、コンテナ内部・中央開口・登録済み配置・仮置き積荷の描画、全投影範囲camera、原子的なフォーム配置編集、仮置きからの初回配置、canvas床面方向dragと完全drag-out削除、近傍回転、button zoomとwheel page scroll、結果指向の選択カード、既存座標フォーム導線、3D直前の単一案件履歴 | 型・lint・全単体907件・全ブラウザ76件・ビルド・305/320/375px Chromium回帰・1,000件純粋投影・全6向き表示・独立コードレビュー |
| 物理制約の判定 | [ADR 0003](../decisions/0003-loading-constraints.md)、[ADR 0006](../decisions/0006-rectangular-opening-model.md)、[ADR 0008](../decisions/0008-stacking-support-and-load.md)、[ADR 0010](../decisions/0010-container-coordinate-and-placement-anchor.md)、[ADR 0011](../decisions/0011-axis-clearance-semantics.md)、[ADR 0012](../decisions/0012-independent-physical-validation-diagnostics.md) | 低レベルgeometry・耐荷重評価、高位独立診断、ローカルmodule Worker、状態・対象・関連積荷・理由・判定不能のアクセシブルなUI、25件理由ページ、遅延結果破棄と再試行 | 全単体848件・全ブラウザ64件、型・lint・build。1,000同一bounds配置の大規模理由保持とmain timer/rAFを維持し、`HUT-01` の人間fixture、無関係な未支持、Z不一致、支持不可、XY 1 mm不足、複数支持、実Worker表示を追加して独立レビュー合格 |
| 保存・再読込・操作性 | [仕様](../specification.md)、[ADR 0009](../decisions/0009-versioned-project-data-contract.md)、[ADR 0013](../decisions/0013-manual-local-persistence-and-json-files.md) | IndexedDB単一手動枠、transaction完了後save、読込・確認削除、固定名JSON file adapter、全候補one-shot preflight Worker、履歴barrier、固定code UI | 全単体623件・全ブラウザ48件。実IndexedDB reload/delete、download/reimport、JSON全失敗段階、blocked/abort/破損、遅延競合、focus、WebGL非依存、305/320/375px、1,000配置・100候補の実Worker応答性、独立レビュー合格 |
| コンテナ・配置の自動提案 | [ADR 0004](../decisions/0004-optimization-objective.md)、[合成受入AP-01〜08](../acceptance.md#automatic-proposal-synthetic-cases) | 純粋探索・Worker・session/view、React hook/panel、Project/generationとbusy gate、実Worker開始・取消・retry、非永続preview、適用直前再検証、確認付き一括適用、同一案no-op、一回のUndo/Redo、25件pageを実装 | domain31件、Worker80件、apply21件を含む全単体839件・全ブラウザ63件。実Worker AP-02/AP-03、Project/history非変更、stale、正常JSON置換、適用・no-op・Undo/Redo、警告保持、WebGL非依存、ARIA、305/320/375px、独立レビュー合格。AP-08は[記録環境の技術証拠](../evidence/automatic-proposal-ap08-1226b082.md)でcold 59.7 ms、warm 48.7〜50.9 ms、各210 attempts・同一hash、native取消0 ms・UI 0.5 ms、console 0件を確認。一般端末SLAではない |
| 実務利用者による受入 | [仕様の完了条件](../specification.md#current-phase-completion-criteria)、[Phase 1合成受入契約](../acceptance.md) | 4本の匿名合成ケース、共通合格基準、観察様式、床突き抜け専用診断を確定 | 全単体628件・全ブラウザ51件、型・lint・build、文書・データ・ガバナンス検証、独立レビュー合格。[Codex UI-assisted部分観察](../evidence/phase1-development-ui-trial-8c8ece2.md)に加え、[案内付き人間評価](../evidence/phase1-human-ui-trial-4e6c680.md)で派生ケースの移動・向き・削除・履歴・理由理解・端末保存・JSON往復を完了し、`HUT-01` とUI改善根拠を記録。正式fixture、評価者区分、狭幅・Tab・fallback、実務利用者試用は未完了 |

## Unresolved Problems and Decisions

- 実務利用者試用の評価担当、日程、合否記録が未決定。
- 対応ブラウザと最低GPU性能が未決定。
- JSON出力名を案件名または利用者指定へ変える要望は、固定名・案件名非反射を定める現仕様とADR 0013に衝突し、別承認が未決定。

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
| 2026-08-28 | 94% | +0 | Codex UI-assisted試用でAC-01〜03とAC-04端末再読込までを実画面観察。exact floor dragで3回の誤座標commitを記録した。JSON file-inputのbrowser tool応答不能により残項目と人間試用は未完了のため加点なし |
| 2026-08-28 | 94% | +0 | PC再起動後にCodex UI-assisted試用を再開し、通常JSON再読込、WebGL非対応時のZ編集・判定・Undo・端末保存、305 / 320 / 375 px、主要focus、console 0件を観察。向き・削除・JSON等はcontrolの有効状態だけを確認し、人間試用とAC-04全操作は未完了のため加点なし |
| 2026-08-28 | 95% | +1 | 人間のプロジェクト評価者がChromeで匿名派生ケースの移動・向き・削除・Undo、完全支持・1 mm支持不足・床突き抜け、端末保存・読込、JSON往復を完了。独立した人間観察証跡を作成し、基本操作の直感性、向き誤設定、sceneから離れた座標・履歴、通知、JSON名の改善点と、床突き抜け由来の支持不足カスケード不具合 `HUT-01` を記録。正式fixture、評価者区分、狭幅・Tab・fallbackは未確認 |
| 2026-08-28 | 94% | -1 | 人間観察で判明した `HUT-01` は現仕様に反する既知の物理診断不具合であるため、物理制約マイルストーンを20/20 Completeから19/20 In progressへ訂正。修正と回帰完了まで1点を保留 |
| 2026-08-28 | 95% | +1 | `HUT-01` を、floor-penetrating supporterの診断上Z=0正規化で派生支持不足だけ抑制する実装へ修正。人間fixture、負例、複数支持、実Worker表示を追加し、全単体848件・全ブラウザ64件、型・lint・build、独立レビューに合格したため物理制約20/20 Completeへ復帰 |
| 2026-08-28 | 95% | +0 | 人間評価で必要性が確認された明示 `＋` / `－` と荷室基準の視点復元を実装。遠方積荷を初期fitから除外しつつ全投影へのcamera到達余地を保持し、全単体849件・全ブラウザ65件、型・lint・build、独立レビューに合格。3Dマイルストーンの既存22点内の操作性改善であり進捗は据え置き |
| 2026-08-28 | 96% | +1 | 選択積荷近傍に追従する床面90度回転を実装。全6向きの相手対応、許可集合、最小角保持、1回のUndo/Redo、回転不可理由、drag lock、camera追従、狭幅・focusを全単体855件・全ブラウザ67件で回帰し、型・lint・build・独立レビューに合格したため3D表示と手動配置を23/25へ更新 |
| 2026-08-28 | 96% | +0 | 端末保存・JSON入出力をモーダルNavigation Drawerへ集約し、処理中・成功・取消・失敗を操作ごとに識別できるSnackbarを実装。処理中focus、背景操作遮断、通知寿命、競合、WebGL非依存、305〜375 pxを全単体855件・全ブラウザ70件で回帰し、型・lint・build・独立レビューに合格。保存・再読込・操作性は既に10/10 Completeのため進捗据え置き |
| 2026-08-28 | 97% | +1 | 案件全体で未配置の積荷を荷室外の非永続仮置きgridへ派生し、fine pointerの荷室内dropだけを一回の配置追加として確定する主操作を実装。他候補の配置除外、全6向き、1,000件、outside/stale/cancel、Undo/Redo、touch/form fallback、狭幅を全単体862件・全ブラウザ74件で回帰し、型・lint・build・独立レビューに合格したため3D表示と手動配置を24/25へ更新 |
| 2026-08-28 | 98% | +1 | 単一の案件Undo/Redoを3D直前へ移し、選択積荷の奥行・横幅・高さ、入口・右壁・床からの位置、既存座標フォームへの導線、全6向きの結果指向表示を実装。busy、focus、scroll、WebGL非対応、長名、狭幅を全単体875件・全ブラウザ75件で回帰し、型・lint・build・独立レビューに合格したため3D表示と手動配置25/25を完了 |
| 2026-08-28 | 98% | +0 | 共通ガバナンス1.4.0、調整runbook、session容量経路、handoff recordを導入。製品仕様0.11.0、Schema 0.1.0、実装済み機能、weighted milestoneの完了証拠は変更しないため進捗は据え置き |
| 2026-08-28 | 98% | +0 | 仕様0.12.0とADR 0015で、viewport wheelのpage scroll、配置済みdragのX/Y正面積境界による仮置き復帰、共通 `大きさ` labelを確定・実装。全単体907件・全browser76件と独立レビューに合格したが、既に完了済みの3Dマイルストーン内の操作性改善であり進捗は据え置き |
