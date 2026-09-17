# Auto CLP Roadmap

- Goal: 初期利用者が代表的な精密機器輸送ケースを3Dで検討し、適合するコンテナと手動配置を確認し、限定モデルの積込順とPDF帳票を得られるローカルファーストWebアプリを完成させ、技術試用版をWebから利用可能にする。
- Current progress: 96%
- Last reviewed: 2026-09-17
- Approval boundary: 重要仕様変更、外部通信、デプロイ、実データ利用、破壊的操作、Git履歴書き換えは明示承認を要する。

## Milestones

| Milestone | Weight | Earned | Status | Completion evidence and remaining work |
| --- | ---: | ---: | --- | --- |
| 基盤・データ契約 | 9 | 9 | Complete | ガバナンス、仕様、主要制約ADR、版付きJSON Schema、完全なreadonly CLP型、構造・意味検証、検証済み書出し、取引的読込基盤、最小アプリ骨格、WebGL 2能力ゲート、向き適用関数と検証を作成 |
| 積荷・コンテナ入力モデル | 9 | 9 | Complete | CLP・隙間・積荷・コンテナの入力、編集、明示削除、Drawer内コンテナ管理、mm・kg変換、許可向き、原子的検証、アクセシビリティ、狭幅表示を実装し検証 |
| 3D表示と手動配置 | 23 | 23 | Complete | 座標契約、重量付き全積荷検索selectと4状態dot、Project→scene投影・描画、荷室外の非永続床面作業位置と向きを維持する寄せ、未配置・配置済み共通のdrag三状態分類、カーソルで選ぶ床・支持可能上面、50 mm取得・75 mm保持の最大2面積荷側面／コンテナ内壁fit、既定ONのsession-only `adjust` 切替、移動グループを除外する支持・衝突判定、単一支持子孫の再帰的連動移動、視点基準1 mm矢印調整、条件未確認preview、dialog配置編集、完全drag-out位置保持、許可済みX/Z軸90°回転と天地無用、wheel zoom、Ctrl pan、同一候補camera保持、viewport内Undo/Redo、compactな選択積荷カードとCRUD入口を実装 |
| 物理制約の判定 | 20 | 20 | Complete | 低レベルgeometry・耐荷重評価、高位集約、単独支持・支持条件未確認・支持接触不成立・支持不可専用理由、接触時の隙間例外、独立理由、計算不能、ローカルWorker評価、理由ページ、WebGL 2利用可能時のUI、許可上限1,000配置の応答性を実装・検証。人間の派生床突き抜け観察で発見した境界違反由来の上段支持不足カスケード `HUT-01` は、診断上の床Z=0正規化、負例、複数支持、実Worker表示を追加して修正・回帰済み |
| 保存・再読込・操作性 | 11 | 11 | Complete | IndexedDB単一手動枠の保存・読込・確認削除、固定名JSON入出力、全候補Worker事前判定、履歴barrier、失敗・競合復旧、保存Navigation Drawer、操作単位Snackbar、modal focus・狭幅を実装・検証 |
| 重量バランス可視化 | 5 | 4 | In progress | 正確なBigInt・有理数による純粋計算、scene/UIの同径10 CSS px・白い外枠なしの赤・黄非操作ドット、完全一致・近接時の黄前面表示、非clampの画面外status、4状態、内容版1.2.0の使用事項、単体・browser・保存回帰を実装し独立レビュー済み。人間による中心一致・近接・偏り・画面外・物理lampとの非混同・凡例理解の差分確認を残す |
| CSV積荷一括置換 | 5 | 4 | In progress | Excel向け固定CSV、手動・CSV共通の30件新規作成上限と既定値、全行検証、破棄・保持範囲を示す確認、積荷・配置の原子的置換、一回のUndo/Redo、legacy互換を実装し、自動回帰と独立レビューに合格。20件取込とUndoは利用者確認済みで、Windows版Excel往復1点を残す |
| 積荷制約の一覧編集 | 2 | 2 | Complete | CSV 5列を維持し、全積荷の天地無用・上乗せ禁止だけを一覧編集する原子的command、個別editorとの表記統一、一回のUndo/Redo、配置保持と支持不可理由、狭幅・dirty確認を実装・回帰 |
| 積込順提案・PDF帳票 | 12 | 11 | In progress | [機能ロードマップ](loading-sequence-pdf-report.md) Phase 0〜4として仕様1.14.0、ADR 0044、AC-14、`loading-sequence-v1`、非永続snapshot、提案確認dialog、番号付き5視点画像、抽出可能な日本語、積荷一覧、物理判定、限定モデル注記、ページ番号を含む複数ページPDFのブラウザ内生成と固定名downloadを実装。1・20・30件等の統合回帰とローカル受入を残す |
| 実務利用者による受入 | 4 | 3 | In progress | 4本の匿名合成ケース、合格基準、自動証拠に加え、案内付き人間評価で移動・向き・削除・履歴・物理理由・保存・JSON往復、305 / 320 / 375 px、Tab・dialog focusを観察し、床突き抜け由来の支持不足カスケード不具合を発見。WebGL 2非対応・初期描画失敗時の阻止・退避画面は人間確認済み。作業中context loss遷移は自動回帰で確認し、人間試用では未再現。正式fixture、評価者区分、実務利用者試用は未完了 |
| **Total** | **100** | **96** |  |  |

部分点は、上表または下表で独立した完了サブゲートと証拠が示された場合だけ認める。

## Future Backlog

| Item | Current state | Re-entry gate |
| --- | --- | --- |
| 自動配置提案 | Phase 1の重み付き現行範囲から除外し、通常ページのpanel・開始・適用入口を非表示とする。既存のdomain探索、Worker、session/view、React panel、適用境界、試験、ADR 0004、AP-08証拠は将来技術資産として保持する | 利用時期と目的を改めて仕様承認し、現行Application Shellへの統合、Worker lifecycle、通常回帰suite、実務利用者受入を再検証する |
| 認証・subscription・将来hosting | GitHub Pagesをアカウント・課金・クラウド保存なしの技術試用版に使う。Firebase Hosting、Authentication、Firestore、Functions / Runは将来候補として記録するが未採用 | 利用者、アクセス制御、決済、権限、データ保存、費用上限を確定し、backend webhookを含む別仕様・ADR・security reviewを承認する |

## Next Work

1. [積込順提案・PDF帳票ロードマップ](loading-sequence-pdf-report.md) Phase 5として、1件、20件、30件、積層、複数支持、循環／提案不能を統合回帰し、ローカルブラウザでPDFの文字、改ページ、画像、番号対応を人間確認する。
2. 積荷制約一覧の複数行更新、取消、Undo/Redo、配置保持と「上乗せ禁止」理由を内蔵ブラウザで差分確認する。
3. 単一支持グループの短距離dragで旧位置を支持物と誤認しないこと、完全drag-out時の荷室外Z=0、コンテナ角・異なる積荷2面へのfit、50 mm取得・75 mm保持、カーソルによる床／上面選択、既定ONの切替、視点基準の1 mm矢印調整、衝突停止、長押し一回Undoを内蔵ブラウザで差分確認する。
4. Windows版Excelでtemplate download、匿名データ編集、CSV UTF-8保存、再読込、確認、Undo/Redoと非UTF-8拒否を人間確認する。
5. [AC-06](../acceptance.md#ac-06-cargo-center-of-gravity-reference-markers)と[ADR 0033](../decisions/0033-equal-borderless-center-markers.md)の匿名合成データで重心表示を人間確認する。
6. 荷室外積荷の寄せ、重量付きselectorと4状態dot、総重量／積込済数、wheel zoom、Ctrl panを代表的な20〜30件データで人間確認する。
7. 正式fixtureと評価者区分を記録し、実務利用者試用の評価担当、日程、合否記録を決める。
8. 第三者利用者の募集、実在CLPの取扱い、課金または本番運用へ進む前に、版付き「使用上の重要事項」とは別に、表示・同意・版管理を含む法的な利用規約を法務確認付きの別checkpointで整備する。

## Deliverables and Verification Evidence

| Milestone | Design or decision | Implementation | Tests, review, deployment, or acceptance evidence |
| --- | --- | --- | --- |
| 基盤・データ契約 | [仕様](../specification.md)、[ADR索引](../decisions/README.md)、[データ契約](../data-model.md)、[JSON Schema](../../schemas/project-0.1.0.schema.json) | JSON Schema `0.1.0`、完全なCLP型、構造・意味検証、検証済み書出し、取引的読込、TypeScript/React/Three.js/Vite骨格、WebGL 2能力ゲート、向き適用関数 | データ契約・型・lint・単体88件・ブラウザ4件・ビルド・ガバナンス検証 |
| 積荷・コンテナ入力モデル | [仕様](../specification.md)、[ADR 0005](../decisions/0005-canonical-units-and-ranges.md)、[ADR 0007](../decisions/0007-cargo-orientation-policy.md)、[ADR 0030](../decisions/0030-container-only-drawer-management.md) | 検証済みProject command、CLP・隙間・積荷の3D内管理、コンテナのDrawer内入力編集UI | 型・lint・単体・ブラウザ・実UIレビュー（305/320/375pxを含む） |
| 3D表示と手動配置 | [仕様](../specification.md)、[ADR 0001](../decisions/0001-local-first-web-architecture.md)、[ADR 0002](../decisions/0002-cuboid-model.md)、[ADR 0010](../decisions/0010-container-coordinate-and-placement-anchor.md)、[ADR 0015](../decisions/0015-scene-wheel-drag-out-and-size-copy.md)、[ADR 0017](../decisions/0017-scene-workbench-rotation-and-compact-controls.md)、[ADR 0018](../decisions/0018-scene-drag-classification-and-dialog-editors.md)、[ADR 0019](../decisions/0019-support-surface-snap-and-conditional-support.md)、[ADR 0020](../decisions/0020-actionable-opening-diagnostics-and-drag-focus.md)、[ADR 0021](../decisions/0021-fixed-rotation-toolbar-and-axis-icons.md)、[ADR 0022](../decisions/0022-upright-only-orientation-policy.md)、[ADR 0026](../decisions/0026-tabbed-scene-annotations-and-validation-dialog.md)、[ADR 0027](../decisions/0027-external-tabs-compact-dimensions-and-icon-lamp.md)、[ADR 0028](../decisions/0028-operation-guide-and-compact-dimension-arrows.md)、[ADR 0035](../decisions/0035-recursive-single-support-group-movement.md)、[ADR 0041](../decisions/0041-moving-group-face-fit-and-view-relative-nudge.md)、[ADR 0042](../decisions/0042-grounded-staging-wall-snap-toggle-and-validation-icon.md) | 共通drag三状態classifier、床・支持面snap、支持面内clamp、移動グループ除外判定、50 mm積荷側面・内壁fit、既定ONのsession-only切替、荷室外Z=0、単一支持グループ連動、視点基準1 mm矢印調整、条件未確認preview、drag中の周辺透過・点線と支持候補色、cargo-global side-relative荷室外anchor、3D欄外の一行候補tab、候補間共有camera、compact矢印の3軸寸法annotation、`現在の座標` 付き固定context action row、`information-variant` 相当のicon-only物理判定lamp/dialog、Drawerの操作方法dialog、版付き使用上の重要事項、X/Z回転、天地無用だけの向き設定を実装 | 仕様1.12.0で型・lint・単体32ファイル1,030件・ブラウザ107件・build・データ契約・ガバナンス・プロジェクト検査に合格。荷室外Z=0、内壁4面、50 / 51 mm境界、同距離時の内壁優先、既定ONの切替、判定iconを回帰した。積層fixtureの実pointer差分確認は未実施 |
| 物理制約の判定 | [ADR 0003](../decisions/0003-loading-constraints.md)、[ADR 0006](../decisions/0006-rectangular-opening-model.md)、[ADR 0008](../decisions/0008-stacking-support-and-load.md)、[ADR 0010](../decisions/0010-container-coordinate-and-placement-anchor.md)、[ADR 0011](../decisions/0011-axis-clearance-semantics.md)、[ADR 0012](../decisions/0012-independent-physical-validation-diagnostics.md)、[ADR 0019](../decisions/0019-support-surface-snap-and-conditional-support.md)、[ADR 0020](../decisions/0020-actionable-opening-diagnostics-and-drag-focus.md) | 低レベルgeometry・耐荷重評価、単独支持・条件未確認・接触不成立、寸法不適合だけを通知する開口診断、ローカルmodule Worker、状態・対象・関連積荷・理由・判定不能のアクセシブルなUI、25件理由ページ、遅延結果破棄と再試行 | 全単体・全ブラウザ、型・lint・build。単独包含の等値、1 mm張り出し、複数支持、隙間、支持可否混在、辺・点、Z不一致、重複、開口寸法合否、Worker表示、自動提案除外を検証 |
| 重量バランス可視化 | [仕様1.5.1](../specification.md)、[ADR 0032](../decisions/0032-cargo-center-of-gravity-visualization.md)、[ADR 0033](../decisions/0033-equal-borderless-center-markers.md)、[データ契約](../data-model.md)、[AC-06](../acceptance.md#ac-06-cargo-center-of-gravity-reference-markers) | 実装済み: 正確な重量moment、4状態、コンテナ幾何中心、配置積荷の合成重心、同径10 CSS px・白い外枠なしの赤・黄非操作ドット、完全一致・近接時の黄前面表示、画面外status、色以外の凡例、計算不能時の読取専用回復投影 | 全単体29ファイル975件・全browser 97件、型・lint・build・文書検査に合格。不均等重量、奇数寸法、全向き、負・不適合配置、上限1,000件、上限外、空・計算不能、中心一致・近接・画面外、DPR 1/2、camera、drag、履歴、保存除外・読込再計算と失敗保持、4状態、305/320/375px、非操作・非保証を検証。独立コードレビューは指摘修正後に合格。人間視認性は未確認 |
| CSV積荷一括置換 | [仕様1.7.0](../specification.md)、[ADR 0034](../decisions/0034-cargo-csv-template-and-replacement-import.md)、[ADR 0036](../decisions/0036-cargo-csv-destructive-confirmation-copy.md)、[データ契約](../data-model.md)、[AC-07](../acceptance.md#ac-07-cargo-csv-template-and-atomic-replacement) | 実装済み: 固定CSV template、parser、30件新規作成上限、手動・CSV既定値、一時検証、破棄・保持範囲の確認、積荷・配置置換、一回の履歴、scene一時状態reset | 既存の単体32ファイル1,006件・ブラウザ102件、型・lint・buildに加え、確認文回帰を更新。利用者が20件取込とUndoを確認済み。Windows版Excel往復は未実施 |
| 積荷制約の一覧編集 | [仕様1.8.0](../specification.md)、[ADR 0037](../decisions/0037-cargo-constraint-list-and-prohibition-wording.md)、[AC-09](../acceptance.md#ac-09-cargo-constraint-batch-editing) | 実装済み: Drawer入口、天地無用・上乗せ禁止の一覧、保存値反転、原子的command、一回の履歴、個別editor・不適合理由の表記統一 | 型・lint・単体32ファイル1,016件・ブラウザ104件・build・データ契約・ガバナンス・プロジェクト検査に合格。個別editorとの一致、Undo、dirty確認、305/320/375 pxを回帰。内蔵ブラウザでの人間差分確認は未実施 |
| 積込順提案・PDF帳票 | [仕様1.14.0](../specification.md)、[ADR 0044](../decisions/0044-limited-loading-sequence-and-pdf-report.md)、[機能ロードマップ](loading-sequence-pdf-report.md)、[AC-14](../acceptance.md#ac-14-limited-loading-sequence-and-pdf-report) | Phase 0〜4完了。直線搬入帯、支持先行、決定的graph、非永続snapshot、提案確認dialog、camera非依存の番号付き5視点画像に加え、静的Noto Sans JPを必要字形だけ埋め込む複数ページPDFをbrowser内で生成する。CLP／コンテナ名、UTC生成日時、積込順、名称、ID、現在向き寸法、重量、先行条件、物理判定、注意、5画像、ページ番号を含み、固定名でdownloadする | 全単体37ファイル1,066件、browser 117件、型、lint、build、データ契約、ガバナンス、プロジェクト検査に合格。PDF signature、抽出可能な日本語、3ページ以上、5画像、フォント失敗時のdownload中止とretryを回帰。匿名4件sampleをPopplerで3ページPNGへ描画し、文字欠落・重なり・切れがないことを確認。1・20・30件等の統合回帰と利用者確認はPhase 5で行う |
| 保存・再読込・操作性 | [仕様](../specification.md)、[ADR 0009](../decisions/0009-versioned-project-data-contract.md)、[ADR 0013](../decisions/0013-manual-local-persistence-and-json-files.md)、[ADR 0023](../decisions/0023-webgl-required-operation-and-read-only-rescue.md) | IndexedDB単一手動枠、transaction完了後save、読込・確認削除、固定名JSON file adapter、全候補one-shot preflight Worker、履歴barrier、WebGL障害時の読み取り専用救出、固定code UI | 実IndexedDB reload/delete、download/reimport、JSON全失敗段階、blocked/abort/破損、遅延競合、focus、WebGL 2利用可能時の通常操作、非対応・描画障害時の全面停止と2種類の救出、305/320/375px、1,000配置・100候補の実Worker応答性を回帰 |
| 自動配置提案の将来技術資産（非加重点） | [ADR 0004](../decisions/0004-optimization-objective.md)、[ADR 0029](../decisions/0029-phase1-drawer-entry-and-automatic-proposal-deferral.md)、[将来合成ケースAP-01〜08](../acceptance.md#future-automatic-proposal-retained-technical-cases) | 純粋探索・Worker・session/view・React panel・適用境界を将来再利用候補として保持。Phase 1の通常UIには表示せずWorkerを開始しない | `automatic-proposal-v2` の単体資産、非実行browser snapshot、[AP-08技術証拠](../evidence/automatic-proposal-ap08-733b250.md)を履歴資産として保持。再公開には仕様再承認、現行shellまたは専用harnessへの再接続、収集設定、全回帰と実務受入が必要 |
| 実務利用者による受入 | [仕様の完了条件](../specification.md#current-phase-completion-criteria)、[Phase 1合成受入契約](../acceptance.md) | 4本の匿名合成ケース、共通合格基準、観察様式、床突き抜け専用診断を確定 | [Codex UI-assisted部分観察](../evidence/phase1-development-ui-trial-8c8ece2.md)に加え、[案内付き人間評価](../evidence/phase1-human-ui-trial-4e6c680.md)で派生ケースの移動・向き・削除・履歴・理由理解・端末保存・JSON往復、狭幅・Tab・focus、viewer-first shell 1.3.0までの変更差分、WebGL非対応・初期描画失敗時の阻止・退避画面を確認し、`HUT-01` とUI改善根拠を記録。context loss遷移は自動回帰で確認し、人間試用では未再現。正式fixture、評価者区分、実務利用者試用は未完了 |

## Unresolved Problems and Decisions

- 実務利用者試用の評価担当、日程、合否記録が未決定。
- 対応ブラウザと最低GPU性能が未決定。
- JSON出力名をCLP名または利用者指定へ変える要望は、固定名・CLP名非反射を定める現仕様とADR 0013に衝突し、別承認が未決定。
- 重量バランス可視化の実装・自動回帰・独立レビューは完了したが、人間による差分視認性と凡例理解の確認は未実施。
- CSV積荷一括置換は仕様・ADR・ACに従い実装・自動回帰・独立レビュー済みだが、Windows版Excel往復は未実施。
- 単一支持グループ連動移動と支持不可専用理由は実装・自動回帰済みだが、内蔵ブラウザでの3D drag差分確認は未実施。

## Definition of Done

- `../specification.md` の現行範囲とPhase 1完了条件を満たす。
- 代表ケースで利用者が入力、3D確認、適合性確認、保存・再読込を完了できる。
- 選択中コンテナの幾何中心と配置積荷の合成重心を赤・黄の非操作ドットと凡例で比較でき、数値・許容範囲・合否・安全保証と誤認しない。
- 選択中コンテナの現在配置から限定モデルの積込順を提案し、一覧と番号付き5視点画像を含む日本語PDFをローカル取得できる。提案不能と非保証を明確に区別する。
- 必須検証がすべて個別に成功し、レビューで重大な未解決事項がない。
- 仕様、ADR、ロードマップ、運用、変更履歴、利用者向け文書が実装と一致する。

## Progress History

| Date | Progress | Change | Reason and evidence |
| --- | ---: | ---: | --- |
| 2026-08-27 | 4% | Baseline | 承認済みのガバナンス、初期仕様、ADR、ロードマップを作成。アプリ実装と技術スパイクは未着手 |
| 2026-08-27 | 6% | +2 | 正規単位・値域、矩形開口、積荷別許可回転、保守的な支持・荷重ルールをADR 0005〜0008で確定。JSONスキーマとアプリ実装は未着手 |
| 2026-08-27 | 8% | +2 | CLP JSON Schema `0.1.0`、意味契約、モジュール境界、依存不要の契約チェックを作成。アプリ実装は未着手 |
| 2026-08-27 | 9% | +1 | 最小Webアプリ骨格、WebGL 2能力ゲート、Three.js技術確認描画、純粋な向き適用関数と独立したアプリ検証を追加。完全なCLP型と意味検証は未着手 |
| 2026-08-27 | 10% | +1 | 完全なreadonly CLP型、Draft 2020-12構造検証、意味検証、検証済み書出し、失敗時状態保持を含む取引的読込基盤と境界テストを追加 |
| 2026-08-27 | 25% | +15 | CLP・隙間・積荷・候補の入力、検証、編集、一覧、削除確認、確定単位・値域、許可向き、狭幅・キーボード操作を実装し、単体147件・ブラウザ11件・独立レビューで検証 |
| 2026-08-27 | 26% | +1 | ADR 0010でコンテナ局所右手座標、負X側開口面の原点、向き適用後AABB最小角の `positionMm` を確定し、3D・配置・物理判定の共通前提を作成 |
| 2026-08-27 | 31% | +5 | 候補選択、Project→scene一方向投影、コンテナ内部・中央開口・登録済み配置の描画、外側配置を含む投影範囲cameraを実装し、単体162件・ブラウザ15件・実UI・独立レビューで検証 |
| 2026-08-27 | 37% | +6 | 保存前draftを正規CLPから分離した配置追加・整数mm移動・許可向き変更・取り外しフォームを実装し、負・候補外座標、候補lock、stale復旧、WebGL非対応、狭幅を単体201件・ブラウザ19件・独立レビューで検証 |
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
| 2026-08-28 | 67% | +2 | CLP設定・積荷・候補・配置・1回の3D床面dragを最大100件取り消し・やり直しできる非永続履歴を実装。stale/no-op/分岐、入力中lock、native入力履歴保護、WebGL非依存、全単体567件・全ブラウザ37件、305/320/375px実UI、独立レビューで検証 |
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
| 2026-08-28 | 97% | +1 | CLP全体で未配置の積荷を荷室外の非永続仮置きgridへ派生し、fine pointerの荷室内dropだけを一回の配置追加として確定する主操作を実装。他候補の配置除外、全6向き、1,000件、outside/stale/cancel、Undo/Redo、touch/form fallback、狭幅を全単体862件・全ブラウザ74件で回帰し、型・lint・build・独立レビューに合格したため3D表示と手動配置を24/25へ更新 |
| 2026-08-28 | 98% | +1 | 単一のCLPUndo/Redoを3D直前へ移し、選択積荷の奥行・横幅・高さ、入口・右壁・床からの位置、既存座標フォームへの導線、全6向きの結果指向表示を実装。busy、focus、scroll、WebGL非対応、長名、狭幅を全単体875件・全ブラウザ75件で回帰し、型・lint・build・独立レビューに合格したため3D表示と手動配置25/25を完了 |
| 2026-08-28 | 98% | +0 | 共通ガバナンス1.4.0、調整runbook、session容量経路、handoff recordを導入。製品仕様0.11.0、Schema 0.1.0、実装済み機能、weighted milestoneの完了証拠は変更しないため進捗は据え置き |
| 2026-08-28 | 98% | +0 | 仕様0.12.0とADR 0015で、viewport wheelのpage scroll、配置済みdragのX/Y正面積境界による仮置き復帰、共通 `大きさ` labelを確定・実装。全単体907件・全browser76件と独立レビューに合格したが、既に完了済みの3Dマイルストーン内の操作性改善であり進捗は据え置き |
| 2026-08-29 | 98% | +0 | 仕様0.14.0とADR 0018で、未配置・配置済み共通のdrag三状態分類、partial保存、全積荷検索select、積荷・配置別dialog CRUD、distinct X/Z icon、固定高statusを確定。Schema 0.1.0と完了済み3Dマイルストーンの配点は変更しないため進捗は据え置き |
| 2026-08-30 | 98% | +0 | 仕様0.15.0とADR 0019で、床・支持可能上面へのdrag snap、単一支持面内clamp、複数支持・隙間・張り出し・支持可否混在の条件未確認、接触不成立の不適合、自動提案除外を実装。全単体938件・全browser70件、型・lint・build・文書・データ・ガバナンス検査を個別に通過。人間再試用は未完了で、既に完了済みの3D・物理マイルストーン内の改善のため進捗据え置き |
| 2026-08-30 | 98% | +0 | 人間再試用で仕様0.15.0の支持面snap 6項目が期待どおりと確認された。仕様0.16.0とADR 0020で、積荷ごとの非実装搬入経路メッセージを廃止し、恒常的な非保証注意を維持、drag中の周辺積荷を透過・点線、支持候補を緑・黄点線とした。全単体939件・全browser71件を通過。Schema 0.1.0と完了済みマイルストーン配点は変更せず、集中表示の人間確認は次回へ残すため進捗据え置き |
| 2026-08-30 | 98% | +0 | 人間再試用で仕様0.16.0のdrag集中表示は期待どおりと確認された。仕様0.17.0とADR 0021で、mesh追従回転controlをUndo/Redo・拡大縮小と同じ固定toolbarへ移し、軸付き同一SVGの90度差、未選択・天地無用・busy時の常設無効状態、連続回転時の位置不変を実装。全単体939件・全browser71件、型、lint、build、文書・データ・ガバナンス検査に合格。完了済み3Dマイルストーン内の操作改善であるため進捗は据え置き |
| 2026-08-30 | 98% | +0 | 仕様0.17.0の人間再試用で、支持面試験データ9件すべてが許可向き1種類のため全回転不可となるデータ不備と、可否の視認性不足を確認。仕様0.17.1で使用可を3Dの青緑線および積荷色と混同しない明るい紫色、不可を暗い低彩度の背景・枠・前景へ分け、操作荷Bを天地無用のZ可、操作荷Dを全6向きのX/Z可へ作業中データ設定した。Schema 0.1.0と進捗は据え置き |
| 2026-08-30 | 98% | +0 | 端末保存の再読込で旧許可向き部分集合が復元され、回転確認データと仕様の矛盾が再発した。仕様0.18.0とADR 0022で積荷editorを天地無用だけへ簡略化し、旧部分集合を2向き・6向きへ読込正規化、Z軸床面回転を常時可、回転可をzoomと同じ強調枠へ変更した。Schema 0.1.0と完了済みマイルストーン配点は変更せず、人間再確認を残すため進捗据え置き |
| 2026-08-30 | 98% | +0 | 人間再試用で操作荷FのZ軸回転時に操作荷Hの初期grid位置が動く連動不具合を確認。仕様0.18.1でgridセルを許可向き全体の最大X/Y footprintへ固定し、回転対象以外を再配置しない純粋投影回帰を追加した。全単体944件・全browser 71件、typecheck、lint、buildに合格。Schema 0.1.0と完了済みマイルストーン配点は変更せず、評価者本人の再確認を残すため進捗据え置き |
| 2026-08-30 | 98% | +0 | 同じ人間のプロジェクト評価者が仕様0.18.1を再試用し、天地無用によるX制限とZ許可、天地無用OFFのX/Z許可、固定button位置、zoom同等の有効枠、editor簡略化、端末再読込、F回転時のHを含む他積荷の位置維持をすべて期待どおりと判定。案内付き再試験の合格を証拠化したが、`HUT-01` 再試用、正式fixture、評価者区分、狭幅・Tab・fallbackは未完了のため進捗据え置き |
| 2026-08-30 | 98% | +0 | 同じ評価者が正式自動回帰と同じ `HUT-01` A/B派生fixtureを再試用し、床貫通1件だけの表示、Z=0修正後の単独支持と構造・安定性未確認、Undo/Redo往復を期待どおりと確認。診断上の正規化は描画・保存座標を動かさず、配置は独立絶対座標で自動追従しない境界も了承された。狭幅・Tab・focus・fallback・正式fixture・評価者区分は未完了のため進捗据え置き |
| 2026-08-30 | 98% | +0 | 同じ評価者が305 / 320 / 375 pxとdialogのTab・focus・scrollを期待どおりと確認。WebGL fallback試用では「3D表示なしに空間情報を操作させない」と判断して中止し、仕様1.0.0・ADR 0023でWebGL 2必須ゲート、非対応・初期描画失敗・context loss時の全面停止、現在CLP・端末保存の読み取り専用JSON救出へ置換した。Schema 0.1.0と配点は変更せず、新しい阻止・救出画面の人間確認を残すため進捗据え置き |
| 2026-08-30 | 98% | +0 | WebGL必須ゲートの人間試用でdownload自体は概ね想定どおりだったが、「JSON救出」と画面変化だけでは対象・結果・次行動を理解できないと評価された。仕様1.0.1で現在作業と端末保存の違い、固定名、download開始結果、確認先、復旧手順を常時表示する退避画面へ修正し、全単体945件・全browser73件、typecheck、lint、buildに合格した。Schema 0.1.0と完了済み配点は変更せず、評価者本人の再確認を残すため進捗据え置き |
| 2026-08-30 | 98% | +0 | 利用者向けの「案件」を「CLP」、自動提案の未適用結果を「配置案」へ統一する仕様1.0.2・ADR 0024を承認。WebGL障害時は平易な「作業データ」を維持し、内部 `Project` / `projectId`、Schema 0.1.0、固定ファイル名、進捗を変更しない |
| 2026-08-30 | 98% | +0 | 仕様1.1.0とADR 0025で、3Dを主作業面とするApplication Bar、能力Chip、CLP操作Drawer、設定dialog、viewport内候補・全積荷検索selector、未保存確認付き新規CLPとhistory barrierを実装。Schema 0.1.0と完了済みマイルストーン配点は変更せず、新レイアウトの人間確認を残すため進捗98%を維持 |
| 2026-08-30 | 98% | +0 | 仕様1.1.1で、選択だけの成功通知と重複する一般的非保証文を主作業面から除き、狭幅候補selectorのcolumn flex basisを修正、荷室全体表示をaccessibleな立方体輪郭iconへ変更した。利用規約は公開・実務運用前の将来工程として記録し、具体的な物理未確認表示、Schema 0.1.0、完了済み配点は変更しないため進捗据え置き |
| 2026-08-31 | 98% | +0 | 人間試用を待たずに進められる設計調査として、複数候補のside-relative作業面・候補別camera・非履歴境界と、積荷画像のthumbnail・selected-only sprite・永続化選択肢を未承認の提案へ整理した。仕様、Schema 0.1.0、実装、完了済み配点は変更しないため進捗据え置き |
| 2026-08-31 | 98% | +0 | 仕様1.2.0・ADR 0026で、右端menu、一行scroll tab、side-relative荷室外anchor、候補間共有camera、選択積荷の3軸寸法annotation、selector直下の固定context action row、物理判定lamp/dialog、版付き「使用上の重要事項」を承認した。単独支持共通の積荷別未確認理由は廃止し、複数支持・隙間・張り出し等の個別未確認は維持する。実装・回帰・人間確認前のためSchema 0.1.0と進捗98%は据え置き |
| 2026-08-31 | 98% | +0 | commit `733b250` で仕様1.2.0を実装。production独立レビューは重大・高重大度0件。実装中に下段固定UIが未配置積荷を遮る不具合とsafe-area ResizeObserver loopをbrowser回帰で検出・修正し、typecheck、lint、単体952件、browser81件、build、ガバナンス・データ契約に合格した。AP-08 v2も新hash・未確認0件で再記録。人間確認前のためSchema 0.1.0と進捗98%は据え置き |
| 2026-08-31 | 98% | +0 | 仕様1.2.0の人間試用で、既合格項目の過剰な再試験をやめて変更差分中心へ戻し、仕様1.2.1・ADR 0027として荷室tabを3D欄外上部へ移動、可視寸法を`整数 mm`と外向き矢印へ簡略化、判定lampをicon-only化する方針を承認した。camera平行移動は両経路をsource contractで確認し、Shift付き左dragだけを実画面で確認した。右dragとheadless回帰は未確認と記録し、新buttonは別承認へ分離し、Schema 0.1.0と進捗98%は据え置き |
| 2026-08-31 | 98% | +0 | 仕様1.2.1・ADR 0027を実装。typecheck、lint、単体28ファイル952件、browser89件、build、文書・データ契約検査に合格し、tab欄外配置、短縮寸法・外向き矢印、icon-only lampを自動回帰した。camera平行移動は実画面証拠とし、差分中心の人間確認を残すためSchema 0.1.0と進捗98%は据え置き |
| 2026-08-31 | 98% | +0 | 同じ人間の評価者が仕様1.2.1の欄外tab、簡略寸法・外向き矢印、icon-only lampと、Shift付き左drag・右dragによるcamera平行移動をすべて期待どおりと確認した。発見しにくい操作をDrawer内dialogで案内し、寸法矢印を縮小、配置copyを `現在の座標` へ改める仕様1.2.2・ADR 0028を承認した。Schema 0.1.0と進捗98%は据え置き |
| 2026-08-31 | 98% | +0 | 仕様1.2.2・ADR 0028を実装。typecheck、lint、単体28ファイル952件、browser93件、buildに合格し、Drawerの独立操作方法dialog、操作copy、busy/focus/scroll、305/320/375px、compact寸法marker、`現在の座標` copyを自動回帰した。寸法矢印の見た目と案内文の理解は差分中心の人間確認を残し、Schema 0.1.0と進捗98%は据え置き |
| 2026-08-31 | 98% | +0 | 同じ人間の評価者が仕様1.2.2の操作方法、寸法矢印、`現在の座標` を期待どおりと確認した。仕様1.3.0・ADR 0029で、積荷・候補追加入口をDrawerへ集約し、外側clickで背面操作を発火させず閉じ、自動配置提案を現行UIから将来backlogへ移した。自動提案15点を非加重点へ分離し、3D 30点・物理25点・保存15点へ再配分して獲得98/100を維持。typecheck、lint、単体28ファイル952件、現行browser83件、build、文書・データ・ガバナンス検査に合格。将来自動提案browser 10件は通常suiteから分離し、人間による今回差分確認を残すため進捗98%は据え置き |
| 2026-08-31 | 98% | +0 | 同じ人間の評価者が仕様1.3.0のDrawer背景close、Drawerだけの積荷・候補追加入口、現行UIからの自動配置提案除外を含む差分試用を受入可能と報告した。途中の意図しないreloadは最終判定へ影響しなかった。正式fixture、評価者区分、仕様1.0.1のWebGL阻止・救出画面、実務利用者試用は未完了のため進捗98%を維持 |
| 2026-09-01 | 98% | +0 | 仕様1.4.0・ADR 0030でPhase 1をコンテナ専用とし、利用者向け登録対象名をコンテナへ統一した。積荷cardとコンテナcardを撤去し、3Dで選択中のコンテナの追加・編集・非cascade削除をDrawerから開くmodalへ移した。Schema 0.1.0と内部名、完了済み配点、残る実務利用者受入は変わらないため進捗98%を維持 |
| 2026-09-01 | 98% | +0 | 同じ人間の評価者が仕様1.0.1のWebGL 2非対応・初期描画失敗画面で、操作停止、通常menuの無効化、現在作業と端末保存の違い、退避入口、復旧手順を理解できると判定した。作業中context loss遷移は人間試用で未再現だが、対象browser回帰6件・終了コード0で全面停止への遷移を再確認し、組み合わせ証拠として承認された。正式fixture、評価者区分、実務利用者試用は未完了のため進捗98%を維持 |
| 2026-09-01 | 98% | +0 | 仕様1.4.1で主ページの入力データ注意を内容版1.1.0の「使用上の重要事項」へ集約し、Drawer最下部にpackageのAuto CLPアプリ版とCLPデータ形式版を追加した。法的な利用規約は将来checkpointのまま、Schema 0.1.0、完了済み配点、残る実務利用者受入を変えないため進捗98%を維持 |
| 2026-09-01 | 98% | +0 | 仕様1.4.2・ADR 0025 refinementで通常デスクトップ高のApplication Shellをbrowser viewport高へ合わせ、残り高を3D viewportへ配分した。通常時の一般案内帯を撤去し、必要な操作statusだけをcanvas寸法・位置を変えない浮動表示として維持した。Schema 0.1.0、完了済み配点、残る実務利用者受入を変えないため進捗98%を維持 |
| 2026-09-08 | 93% | -5 | 仕様1.5.0・ADR 0032で積荷合成重心の参考可視化を現行範囲へ追加した。コンテナ幾何中心を赤、配置積荷の重量付き合成重心を黄の非操作ドットとし、数値・許容範囲・合否を設けない。新規5点を未実装0/5とし、既存完了範囲を3D 30→27、物理25→23へ再配分したため、獲得点を98/100から93/100へ補正。Schema 0.1.0は変更しない |
| 2026-09-08 | 97% | +4 | 仕様1.5.1・ADR 0033の正確な積荷合成重心、同径10 CSS px・白い外枠なしの赤・黄非操作ドット、完全一致・近接時の黄前面表示、4状態、画面外、内容版1.2.0の使用事項を実装。全単体29ファイル975件・全browser 97件、型・lint・build・文書検査と、指摘修正後の独立レビューに合格したため重量バランス可視化を4/5とした。人間による差分視認性・凡例理解の確認を残し、Schema 0.1.0は変更しない |
| 2026-09-08 | 92% | -5 | 仕様1.6.0・ADR 0034でCSV積荷一括置換を現行範囲へ追加した。入力モデルから3点、保存・再読込から2点を新規5点へ再配分し、未実装0/5のため獲得点を97/100から92/100へ補正した。手動・CSVの新規積荷は30件、段積みOK・天地無用OFFを既定とし、Schema 0.1.0の既存31〜1,000件と配置上限1,000件は維持する |
| 2026-09-16 | 96% | +4 | 仕様1.6.0・ADR 0034のCSV積荷一括置換、共通30件上限、既定値、原子的置換、一回のUndo/Redo、scene一時状態reset、legacy互換を実装し、単体32ファイル1,006件・ブラウザ102件と指摘修正後の独立レビューに合格した。Windows版Excel往復1点は未獲得 |
| 2026-09-16 | 96% | +0 | 仕様1.7.0・ADR 0035・0036で、完全な単一支持子孫の再帰的連動移動、配置解除拒否、支持不可専用理由、CSV破棄範囲確認文を実装。型・lint・単体32ファイル1,014件・ブラウザ103件・buildに合格した。既完了の3D・物理範囲内の改善であり、積層fixtureの実pointer人間確認を残すため進捗は据え置き |
| 2026-09-16 | 96% | +0 | 仕様1.8.0・ADR 0037で、CSVを変更せず積荷制約一覧、上乗せ禁止表記、原子的な一括更新と一回のUndo/Redoを追加した。入力モデル12点から2点を新機能へ再配分して同じ2点を獲得し、型・lint・単体32ファイル1,016件・ブラウザ104件・build・文書検査に合格したため進捗は据え置き。内蔵ブラウザでの人間差分確認は未実施 |
| 2026-09-17 | 96% | +0 | 仕様1.13.0・ADR 0043で、50 mm取得・75 mm保持の最大2面X/Y fitとカーソルによる床／上面選択を追加し、X/Yスナップを基礎配置・支持・衝突検証から分離した。型・lint・単体32ファイル1,036件・ブラウザ107件・build・データ契約・ガバナンス・プロジェクト検査に合格した。既完了の3D手動配置範囲内の操作改善で、ローカル人間差分確認を残すため進捗は据え置く |
| 2026-09-17 | 86% | -10 | 仕様1.14.0・ADR 0044で、限定モデルの積込順提案と番号付き5視点PDF帳票を現行目標へ追加した。既存配点を88点へ再配分し、新機能12点のうちPhase 0の仕様・設計・受入契約1点を獲得したため、獲得点を96/100から86/100へ補正した。Schema 0.1.0は変更しない |
| 2026-09-17 | 89% | +3 | 積込順提案・PDF帳票Phase 1として、`loading-sequence-v1` の直線搬入帯、接触支持先行、決定的トポロジカルソート、循環・参照・重複・支持不明の固定理由を純粋domainに実装した。直接20件、全単体33ファイル1,056件、browser 108件を含む総合9ゲートに合格し、新機能マイルストーンを1/12から4/12へ更新した。UI、画像、PDFは未実装 |
| 2026-09-17 | 91% | +2 | 積込順提案・PDF帳票Phase 2として、選択中コンテナの非永続帳票snapshot、提案順・先行理由・注意・物理判定・提案不能理由を確認するdialogとPDF出力入口を実装した。全単体34ファイル1,059件、browser 113件を含む総合9ゲートに合格し、新機能マイルストーンを4/12から6/12へ更新した。番号付き画像とPDF生成は未実装 |
| 2026-09-17 | 93% | +2 | 積込順提案・PDF帳票Phase 3として、同一snapshotから現在視点とcamera非依存の固定4面を生成し、全配置積荷へ一覧対応番号を表示する専用帳票sceneを実装した。全単体35ファイル1,062件、browser 115件を含む総合9ゲートに合格し、新機能マイルストーンを6/12から8/12へ更新した。PDF生成と画像のローカル人間確認は未実施 |
| 2026-09-17 | 96% | +3 | 積込順提案・PDF帳票Phase 4として、静的Noto Sans JPを必要字形だけ埋め込み、一覧、物理判定、注意、番号付き5画像を含む複数ページPDFのbrowser内生成と固定名downloadを実装した。全単体37ファイル1,066件、browser 117件を含む総合9ゲートに合格し、PDF.jsの抽出・画像数とPopplerの3ページ描画を確認して、新機能マイルストーンを8/12から11/12へ更新した。1・20・30件等の統合回帰と利用者確認は未実施 |
