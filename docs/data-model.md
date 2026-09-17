# Auto CLP Data Contract and Module Boundaries

- Status: Active design contract
- Project schema version: `0.1.0`
- Related specification: [Auto CLP Specification](specification.md)
- Machine-readable schema: [project-0.1.0.schema.json](../schemas/project-0.1.0.schema.json)
- Decisions: [ADR 0009](decisions/0009-versioned-project-data-contract.md)、[ADR 0010](decisions/0010-container-coordinate-and-placement-anchor.md)、[ADR 0011](decisions/0011-axis-clearance-semantics.md)、[ADR 0012](decisions/0012-independent-physical-validation-diagnostics.md)、[ADR 0013](decisions/0013-manual-local-persistence-and-json-files.md)、[ADR 0014](decisions/0014-dedicated-floor-penetration-diagnostic.md)、[ADR 0017](decisions/0017-scene-workbench-rotation-and-compact-controls.md)、[ADR 0018](decisions/0018-scene-drag-classification-and-dialog-editors.md)、[ADR 0019](decisions/0019-support-surface-snap-and-conditional-support.md)、[ADR 0020](decisions/0020-actionable-opening-diagnostics-and-drag-focus.md)、[ADR 0021](decisions/0021-fixed-rotation-toolbar-and-axis-icons.md)、[ADR 0022](decisions/0022-upright-only-orientation-policy.md)、[ADR 0032](decisions/0032-cargo-center-of-gravity-visualization.md)、[ADR 0033](decisions/0033-equal-borderless-center-markers.md)、[ADR 0034](decisions/0034-cargo-csv-template-and-replacement-import.md)、[ADR 0035](decisions/0035-recursive-single-support-group-movement.md)、[ADR 0036](decisions/0036-cargo-csv-destructive-confirmation-copy.md)、[ADR 0037](decisions/0037-cargo-constraint-list-and-prohibition-wording.md)

## Contract Scope

この文書は、Phase 1で端末内保存とJSON入出力に使うCLPデータ、およびデータを消費する計算モジュールの境界を定義する。完全なCLP型、純粋な向き・配置範囲計算、JSON Schema・意味検証、検証済み書出し、派生計算後だけ状態を置換する読込境界、対象コンテナの物理制約を独立理由付きで集約する純粋判定、その判定をローカルWorkerで実行して理由をページ表示するUI、CLP・隙間・積荷・コンテナの入力編集UI、コンテナ選択とProjectから3D sceneへの一方向投影、フォームによる配置編集、canvas上の積荷選択・床面方向drag・視点操作、CLP操作のundo/redo、単一手動枠の端末保存、JSONファイル入出力、全コンテナの置換前Worker判定、仕様1.5.1の積荷合成重心の純粋計算、コンテナ幾何中心との赤・黄ドット表示、凡例、仕様1.6.0のCSVテンプレート、30件新規作成上限、既定値統一、積荷・配置の一括置換、仕様1.7.0の単一支持グループ連動移動と支持不可専用理由、および仕様1.8.0の積荷制約一覧編集は実装済みである。Projectを変更しない自動提案探索、preview panel、再検証付き一括適用と一履歴操作のUndo/Redoは保持済みの将来技術資産で、Phase 1の通常画面には接続しない。操作履歴、UI状態、Three.jsオブジェクト、物理判定、自動提案、幾何中心・合成重心とその表示結果は本契約へ保存しない。

仕様版 `1.14.0` とCLPスキーマ版 `0.1.0` は別に管理する。利用者向け用語、コンテナ専用の製品範囲、Application Shellのviewport高配分、Drawer入口・版表示・操作配置、使用上の重要事項、自動提案UIの公開状態、WebGL必須運用、session-onlyのコンテナtab・共有camera・Z=0へ正規化する荷室外anchor・表示annotation・操作方法dialog・未配置積荷の寄せ・既定ONの側面／内壁スナップ切替、コンテナ未登録時の案内とCSVインポート利用条件、保存しない重心・積載概要・積込順・帳票の派生表示、wheel zoom・Ctrl平行移動、派生する単一支持グループ移動・50 mm取得／75 mm保持の最大2面fit・カーソル配置面選択・視点基準矢印preview、積荷制約の一覧編集、GitHub Pagesによる静的配信、およびSchema上限内の一時CSV入力と新規作成上限の変更だけではCLPスキーマ版を上げず、保存データの意味または形が変わる場合にだけスキーマ版を更新する。

## Persisted Root

CLP JSONは次のトップレベル要素だけを持つ。

| Field | Meaning |
| --- | --- |
| `schemaVersion` | 読込互換性を判定するCLPスキーマ版。初期値は `0.1.0` |
| `projectId` | CLP内で安定したID |
| `name` | 利用者向けCLP名。個人情報、顧客名、機密情報を保存しないよう表示する |
| `clearancesMm` | CLP共通のX・Y・Z軸固定隙間 |
| `cargoes` | 積荷定義。最大1,000件 |
| `containers` | コンテナ。最大100件。Phase 1の利用者向け登録対象に車両を含めない |
| `placements` | 配置済み積荷。最大1,000件 |

ファイルサイズ上限は5 MiB（5,242,880 bytes）とし、サイズ超過はJSON解析前に拒否する。空の積荷・候補・配置配列は、入力途中のCLP保存を可能にするため許可する。

Schema `0.1.0`の積荷・配置上限1,000件は既存JSON・端末保存の互換性境界である。手動追加とCSV一括作成は共通の新規作成上限30件を使う。既存31〜1,000件は有効なProjectとして読込、編集、削除、書出しでき、現在件数30以上では追加だけを拒否する。配置上限は1,000件のままとする。

## Identifiers and References

- IDは1〜64文字のASCII英数字、`.`、`_`、`-`とし、先頭は英数字にする。
- 積荷IDは `cargoes` 内、候補IDは `containers` 内でそれぞれ一意でなければならない。
- 各配置の `cargoId` と `containerId` は存在する定義を参照しなければならない。
- 一つの積荷は同時に最大一つの配置だけを持つ。
- 配置の向きは、参照する積荷の `allowedOrientations` に含まれなければならない。
- 開口幅は内部幅以下、開口高さは内部高さ以下でなければならない。

JSON Schemaが単独で表現できない一意性、参照整合性、許可向き、開口と内部寸法の関係は、読込時の意味検証で拒否する。

## Orientation Codes

向きコードは、元の `Length`、`Width`、`Height` を参照先コンテナの局所X、Y、Z軸へ割り当てる順序を表す。ADR 0007でいう世界X、Y、Zは、ADR 0010の採択以後このコンテナ局所軸を意味し、Three.js固有のworld軸を意味しない。

| Code | Container X | Container Y | Container Z | Schema `0.1.0` default metadata |
| --- | --- | --- | --- | --- |
| `LWH` | Length | Width | Height | Yes |
| `WLH` | Width | Length | Height | Yes |
| `LHW` | Length | Height | Width | No |
| `HLW` | Height | Length | Width | No |
| `WHL` | Width | Height | Length | No |
| `HWL` | Height | Width | Length | No |

表のDefault列は既存互換のため変更しないSchema annotationであり、アプリの新規作成既定ではない。手動追加とCSV作成の新規積荷は全6向きを明示的に保存する。積荷編集UIで利用者が指定する向き方針は天地無用だけである。天地無用ONは `LWH` / `WLH`、OFFは全6向きを `allowedOrientations` へ保存し、任意の部分集合を作るUIは提供しない。旧Schema `0.1.0` の有効な部分集合は、読込preflight合格後に、立置き2向きだけの部分集合ならONの2向き、それ以外ならOFFの全6向きへ非変異で正規化する。Z軸床面回転は常に許可し、天地無用はX軸回転だけを禁止する。

## Placement Coordinate Contract

- 配置は `containerId` が参照するコンテナの局所右手座標系を使う。
- コンテナ内部は `[0, L] × [0, W] × [0, H]` とする。原点は負X側開口面、最小Y側壁、床が交わる内隅で、+Xは開口から奥、+Yは幅方向で入口から奥を見た左側、+Zは上方とする。最小Y側壁は入口から見た右側である。
- 開口面は `x = 0`、床は `z = 0`。開口のY範囲は `[(W - openingWidth) / 2, (W + openingWidth) / 2]`、Z範囲は `[0, openingHeight]` とし、差が奇数mmでも描画または比較のために丸めない。
- `positionMm` は、`orientation` 適用後の軸整列積荷直方体の最小X・Y・Z角である。向き適用後の寸法を `(dx, dy, dz)` とすると、占有範囲は `[x, x + dx] × [y, y + dy] × [z, z + dz]` になる。

## Derived Outside-workbench State

- `placements` のどこからも参照されない積荷だけを、選択コンテナ外の非永続作業スペースへ表示する。他の候補へ配置済みの積荷は含めない。
- 初回位置は積荷の先頭許可向き、Z=0 mm、CLPの積荷順、100 mm間隔、各積荷の許可向き全体から得る最大X/Y footprintから負X側の決定的な非重複gridとして派生する。現在向きではなく許可向き全体をセル寸法に使うため、一つの積荷のsession回転でoverrideを持たない他の未配置積荷も再配置されない。
- 利用者が積荷全体を荷室外へdropした後は、SceneWorkspaceがcargo IDごとの `positionMm` とorientation overrideを現在のUI sessionだけに保持し、Project→scene adapterへ一方向に渡す。不許可になったoverride向きは積荷の先頭許可向きへfallbackする。向きまたは寸法編集後のAABBが荷室床面と正面積で重なるoverride位置は採用せず、新しい向き適用後寸法で完全に荷室外となる決定的初期gridへfallbackする。
- 作業位置、作業向き、scene用中心、選択、drag preview、件数はProjectフィールドではなく、JSON、IndexedDB、CLP履歴、物理判定へ保存しない。読込のscene barrierで破棄する。
- 荷室外からのfine-pointer dropは、向き適用後AABBが対象コンテナの生の床面と正面積で重なる場合、床・支持面snap後の整数mm位置を既存の配置追加commandへ渡す。完全包含でないpartialも修正途中の境界不適合配置として保存する。床面との共通面積が0ならProjectを変更せずsession位置だけを更新し、取消・競合は直前のProjectとsession位置を保持する。
- 配置済み積荷の完全drag-outは、drop位置と向きをsession overrideへ記録してから既存の配置削除commandへ渡す。Undo中はoverrideを保持したまま配置を表示し、Redoで同じ外側位置を再利用する。荷室外のX/Z回転は、回転後AABBが荷室床面と正面積で重ならない場合だけsession overrideへ反映し、重なる場合はProject・履歴・物理結果・直前poseを変えず拒否する。
- 向き変更時は既定で最小角を保持し、暗黙の平行移動や丸めを行わない。床置きは `z = 0` である。
- 正規データと判定は整数mmを維持する。Three.js表示では派生値だけを `1 mm = 0.001 scene unit` で変換し、mesh中心を最小角と向き適用後寸法から計算する。0.5mmの表示中心を正規CLPへ逆流させない。
- canvas dragは正規最小角を開始値として保持し、scene上のpointer差分をdomain X/Y差分へ写像して最近接1 mmへ正負対称に量子化する。mesh中心やtransformを保存値として読まず、向きを保持し、床・支持面snapで整数mmのZを決め、既存application commandが成功した場合だけProjectを置換する。
- 配置済みdragの量子化後X/Y占有範囲は、生の荷室床面 `[0, L] × [0, W]` との正面積重なりで配置保持を決める。X/Yのどちらも厳密に正の共通長を持つ場合だけ保持し、一部はみ出しもsnap後位置の不適合な配置として保存する。面・辺だけの接触を含む0面積ではdrop poseを非永続作業状態へ保持して既存配置を削除する。Zはこの保持・削除境界の分類には使わない。
- 負座標や外側配置は修正途中の状態として保存できる。将来の境界判定では不適合となるが、scene投影は適合性を判定または保証しない。

検証済みserializer、座標値を生成する配置UI・application command、利用者向けJSON入出力UI、手動端末保存は実装済みである。座標契約の採択時点ではSchema `0.1.0` の初回意味確定としてJSONの形と版を変更せず、その後の配置・保存実装も同じ契約を維持している。既存外部データが後から判明した場合は意味を推測して再解釈せず、新Schema版と明示的な移行を設計する。

## Axis Clearance Contract

- `clearancesMm` は積荷ごとのhaloではなく、隣接する表面間に必要な実距離を軸別に表す。積荷間で設定値を2倍にせず、等値を合格とする。
- 配置後の境界条件は `xMin >= cX`、`xMax <= L - cX`、`yMin >= cY`、`yMax <= W - cY`、`zMin >= 0`、`zMax <= H - cZ` とする。負X側開口面もX隙間の対象で、床だけはZ隙間を要求しない。
- 支持関係ではない積荷ペアは、少なくとも一つの分離軸で表面間距離が対応する隙間以上なら合格とする。正体積重なりは常に不適合である。
- 単独支持または支持条件未確認を構成する正面積のZ接触ではZ隙間を要求せず、接触するX・Y投影へ積荷間隙間を適用しない。単独支持は一つの支持可能上面によるX/Y完全包含、条件未確認は支持可能面を含む複数・隙間・張り出し・支持可否混在として別途判定する。
- 開口断面は従来どおり `cargoY + 2 × cY <= openingWidth`、`cargoZ + cZ <= openingHeight` とし、X隙間を使わない。配置後境界と搬入断面を混同しない。

この意味はADR 0011で初めて確定し、単独支持・条件未確認の区分と支持接触の隙間例外をADR 0019で改定した。物理判定と理由表示UI、手動端末保存、利用者向けJSON入出力UIは実装済みである。床下配置の `floor-penetration` を含む判定理由は保存値からローカルWorker内で毎回再計算する派生結果であり、JSONの形や意味を変えないためSchema `0.1.0` を据え置き、判定結果や隙間包絡をJSONへ保存しない。

## Stored and Derived State

保存するのは利用者入力と配置だけである。次は常に再計算し、JSONへ保存しない。

- 向き適用後の寸法。
- 境界、重なり、開口部、支持、段積み可否、総耐荷重の判定。
- `valid`、`invalid`、`unverified` の集約状態と理由コード。
- Three.jsのメッシュ、材質、カメラ、選択ハイライト。
- UIフォームの一時値、エラー表示、undo/redo履歴。
- 選択中コンテナの幾何中心、配置済み積荷の合成重心、赤・黄ドット、凡例、重心計算状態。

実装済みの重心計算は、選択中コンテナの内寸中央 `(L/2, W/2, H/2)` を比較基準とし、コンテナ自重を含めない。各配置済み積荷の中心は、向き適用後のAABB最小角と寸法から得る `(x + dx/2, y + dy/2, z + dz/2)`、合成重心は `massGrams` による加重平均とする。未配置、別コンテナ、drag previewは含めず、意味・参照が有効な対象コンテナの保存済み配置は物理的不適合・未確認でも現在状態として含める。配置0件は合成重心なし、対象解決または安全な計算に失敗した場合は計算不能とし、0位置または物理的不適合へ変換しない。

奇数mm中心、負座標、最大1,000配置と許可値上限でも精度を失わないよう、軸ごとに倍座標 `2 × position + orientedDimension` と重量の積を順序非依存な整数で集計し、最後に総重量の2倍で除した有理数として扱う。実装は中間積がJavaScriptのsafe integerを超え得ることを前提にし、丸めた画面座標、mesh transformまたは浮動小数の逐次積和を正本計算に使わない。

派生結果は `no-container`、`empty`、`available`、`unavailable` の判別可能な状態として返す。`no-container` は両中心なし、`empty` は幾何中心あり・積荷合成重心なし、`available` は両中心あり、`unavailable` は有効なコンテナを解決できる場合だけ幾何中心あり・積荷合成重心なしとする。scene投影が有限でもcameraの表示範囲外なら `available` のまま正規3D位置を保持し、画面端へclampしない。UIは状態変更ごとに同じ結果から同径・外枠なしの赤・黄両点、完全一致・近接時の黄前面表示、凡例、画面外または計算不能statusを再導出し、これらを保存しない。

不適合な配置も、座標値と参照整合性が有効なら保存できる。これにより、利用者が途中状態を失わず修正できる。読込時に不適合を成功扱いせず、再計算した理由を表示する。

undo/redoは検証済み `Project` 参照を最大100件、実行中メモリだけに保持する。履歴対象はCLP設定、積荷、候補、配置の成功した追加・更新・削除、積荷制約一覧の一括更新と、1回の3D dragにつき1件である。制約一覧は「天地無用」と「上乗せ禁止」だけを一時編集し、ONの「上乗せ禁止」を保存値 `canSupportCargo=false` へ反転して一回の履歴にする。失敗、no-op、raw draft、削除確認、drag preview、候補・積荷選択、camera、Worker結果と理由ページは履歴へ入れない。undo後に別のCLP変更を確定した場合はredo側を破棄し、JSON書出し・読込へ履歴を含めない。

## Import Transaction

JSON読込は次の順序で行い、すべて成功するまで現在CLPを変更しない。

1. ファイルが5 MiB以下か確認する。
2. テキストをJSONとして一時値へ解析する。実行可能コードとして評価しない。
3. `schemaVersion` が対応版か確認する。
4. JSON Schemaで型、必須項目、追加項目、個数、値域を確認する。
5. ID一意性、参照、許可向き、開口寸法、安全な整数合計を意味検証する。
6. one-shot module Workerで全候補コンテナの配置判定を新しい一時状態に対して再計算する。不適合・未確認は計算成功、判定不能・Worker失敗・不正応答は失敗とする。
7. 全検証と再計算が成功した一時Projectの積荷向き方針を、天地無用ONの2向きまたはOFFの全6向きへ正規化する。
8. 読込開始後に現在Project参照とProject/scene入力generationが変わっていない場合だけ、新しいCLP状態へ一括置換する。

どの段階で失敗しても現在CLP、履歴、未保存入力を保持し、ファイル名、秘密情報、入力全体をログへ出さず、利用者が修正できる固定理由を示す。読込成功時は旧CLPの履歴、draft、選択、camera、drag preview、Worker結果を再利用しない。

## Transient Cargo CSV Contract

CSVはProjectの永続形式またはbackupではなく、新しい積荷配列を作る一時入力である。固定名テンプレート `auto-clp-cargo-template.csv` はUTF-8 BOM、CRLF、見出し `name,length_mm,width_mm,height_mm,weight_kg` だけを持つ。読込はUTF-8のBOM有無、CRLF / LF、quoted fieldと二重引用符escapeを受け、見出し順・大小文字・列数を厳密に検証する。すべて空白のrecordだけを無視し、有効recordを1〜30件とする。

各recordは論理順で `cargo-1`〜`cargo-N` を得る。重複名を許可し、既存の名前、寸法mm、重量kg→g変換を使い、上乗せ禁止OFFに対応する `canSupportCargo=true`、`allowedOrientations`は天地無用OFFの全6向きとする。raw CSV、filename、cell値、parser状態はProject、JSON、IndexedDB、履歴へ保存しない。

全recordと置換候補を一時検証した後、確認時だけ現在Projectの `schemaVersion`、`projectId`、`name`、`clearancesMm`、`containers`を保持し、`cargoes`を新しい配列へ置換して`placements=[]`とする。この一回のProject変更だけを履歴へ保存し、Undoは旧積荷・配置を完全復元する。取消、失敗、stale、busy、no-opではProjectと履歴を変更しない。

実装は申告サイズと読取後のUTF-8実サイズをともに確認し、構造エラーを入力値や未知プロパティ名を反射しない安定したcode/pathへ正規化する。構造エラーは決定的な順序で重複を除き、最大50件を返す。書出しも明示的な保存対象だけへ射影した後、同じ構造・意味検証に合格した場合だけJSONを生成する。

CSV issueの正規形は次のとおりとする。

| Stage | Code | Path |
| --- | --- | --- |
| template出力能力・失敗 | `cargo-csv.download-unavailable` / `cargo-csv.download-failed` | `/template` |
| file入力能力不足 | `cargo-csv.import-unavailable` | `/file` |
| サイズ・読取・UTF-8・構文 | `cargo-csv.file-size` / `cargo-csv.read` / `cargo-csv.utf8` / `cargo-csv.syntax` | `/file` |
| 固定見出し | `cargo-csv.header` | `/header` |
| 有効record件数 | `cargo-csv.record-count` | `/rows` |
| record列数 | `cargo-csv.column-count` | `/rows/{n}` |
| 名前 | `cargo-csv.name-required` / `cargo-csv.name-length` / `cargo-csv.name-control` | `/rows/{n}/name` |
| 寸法 | `input.mm-length` / `input.mm-format` / `input.mm-range` | `/rows/{n}/length_mm`、`/rows/{n}/width_mm`、`/rows/{n}/height_mm` |
| 重量 | `input.kg-length` / `input.kg-format` / `input.kg-range` | `/rows/{n}/weight_kg` |
| 置換後Projectの防御的検証 | `cargo-csv.candidate-invalid` | `/` |

`{n}` は見出しを除き、decoded fieldがすべて空白のrecordを数えない1始まりの論理データrecord順である。quoted field内の改行を含む物理行番号はpathに使わない。issueはpath、codeのcode-unit順に並べ、同一code/pathを除いて最大50件とする。どのcode/pathにもfilename、見出し実値、cell値またはCSV本文を含めない。

## Module Boundaries

以下は実装済み部分と計画部分を含む依存方向である。CLP契約、取引的読込、端末保存、JSON入出力、入力編集UI、対象コンテナの物理制約集約と理由表示UIは実装済みである。

| Planned module | Responsibility | Forbidden dependencies |
| --- | --- | --- |
| `domain/model` | 実装済み: 版、向き、寸法、隙間、積荷、候補、配置、CLPのreadonly型 | React、Three.js、ブラウザ保存API |
| `domain/geometry` | 実装済み: 向き適用、最小角からの配置範囲、コンテナ内部への包含、XY矩形の正面積重なり、正体積AABB重なり、隙間込みコンテナ境界、非支持ペアの軸別隙間、矩形開口寸法と許可向き抽出、単独支持・条件未確認・接触不成立の幾何区分。旧XY矩形和集合100%被覆helperは回帰用に保持 | UI、描画、永続化 |
| `domain/validation` | 実装済み: ID・参照・許可向き・開口関係・安全整数合計、計算可否を区別する総質量・耐荷重評価、対象コンテナへの配置抽出、境界、隙間、開口、支持、耐荷重の独立理由と集約状態、計算不能結果 | React、Three.js、I/O |
| `domain/weight-balance` | 実装済み: 選択中コンテナの幾何中心、配置済み積荷の重量付き合成重心、空・計算不能を区別するBigInt・有理数による決定的な純粋計算 | React、Three.js、I/O、物理合否、永続化、表示丸め |
| `domain/loading-sequence` | 実装済み: 選択中コンテナの現在配置から、最終Y/Zでの直線搬入帯による遮蔽と接触支持物の先行関係を合成し、決定的トポロジカルソートまたは固定提案不能理由を返す `loading-sequence-v1` | React、Three.js、I/O、搬送機器・作業空間・旋回の評価、Project・履歴・保存の変更 |
| `domain/automatic-proposal` | 実装済み: Schema・意味検証済みProjectだけを受ける、一候補完全案の決定的DFS、目的関数順位、向き重複排除、最大2,048点の遅延列挙、候補10,000・要求1,000,000 attempt境界、cutoff/no-complete-plan、未確認理由付き完全案。現在配置を入力anchorにせず変更もしない | Schema検証、Worker、取消、stale、UI、Projectへの適用、外部通信 |
| `application/project-import`、`application/project-command`、`application/automatic-proposal-apply` | 実装済み: 検証と派生計算が成功した場合だけ新状態を返す読込境界、入力draftから検証済み候補・配置だけを原子的に反映する不変コマンド、自動提案をSchema・意味・正本物理判定で再検証して配置だけを深いcopyで一括置換する適用境界 | DOM、Three.jsオブジェクトの所有、探索の再実装 |
| `domain/input`、`persistence/cargo-csv`、`persistence/cargo-csv-file`、`application/cargo-csv-import` | 実装済み: 手動・CSV共通の正規入力と30件上限、UTF-8 CSVと固定template bytes、全recordの一時解析・正規化、決定的ID・既定値、置換後Project検証、破棄・保持範囲の確認後の一回の積荷・配置置換 | JSON互換境界の変更、部分適用、式評価、DOM、Three.js、外部通信 |
| `application/project-history` | 実装済み: 検証済みProject参照の最大100件履歴、stale base拒否、no-op除外、undo/redo、分岐時のredo破棄 | DOM、Three.jsオブジェクト、I/O、Projectの再検証 |
| `application/project-persistence` | 実装済み: 永続化用の検証済み直列化、読込失敗段階の固定code化、全候補preflight後だけのCLP準備 | DOM、Three.jsオブジェクト、直接IndexedDB操作 |
| `persistence/project-json`、`persistence/project-file` | 実装済み: サイズ、構文、版、スキーマ、意味検証、明示射影書出し、標準File読込source、固定名Blob download | 3D描画、直接UI更新、CLP名のファイル名反映 |
| `persistence/project-store` | 実装済み: IndexedDB `current-project` 単一枠のtransaction完了後save、load、delete、未対応・open・read・write・delete失敗 | 自動保存、Project解釈、UI更新、外部通信 |
| `persistence/project-import-preflight-client`、`workers/project-import-preflight` | 実装済み: one-shot module Workerで全候補を置換前に判定し、応答検証後に必ずWorkerを終了 | DOM、IndexedDB、同期fallback、理由の保存 |
| `scene` | 実装済み: WebGL能力確認と初回描画の必須ゲート、選択候補の内部・中央開口・登録済み配置とsession外側poseの純粋投影、Three.js描画、全投影範囲へ適応するcamera、canvas picking、fine pointer dragのno-op先行と純粋な `xy-contained` / `partial` / `outside` 分類、床・支持面snap、単一支持面内clamp、支持候補preview、完全drag-out作業位置、向きを維持した未配置積荷の決定的な近接grid再整列、X/Z軸別90度回転、同一候補のcamera保持、domainの重心派生結果を赤・黄の固定画面サイズドットへ一方向投影する。wheelはcamera zoom、Ctrl付き左dragは積荷上からでもcamera panを優先し、touch/coarse pointerは選択のみで縦scrollを保持する。非対応・描画障害時は通常操作を全面停止し、Projectを変更しないJSON救出だけを許可 | 判定規則の再実装、永続データ型の変更 |
| `ui` | 実装済み: raw draft、gからkgへの表示変換、CLP・隙間・候補フォーム、全Project積荷の検索・選択、積荷重量付きselector、選択状態4色dot、compact選択card、積荷定義と配置の別modal editor、非cascadeの配置取り外し・積荷削除、アクセシブルなfocus trap・dirty破棄確認・busy gate、canvas直接操作と正確な移動・向きのキーボードfallback、物理判定の状態・対象・関連積荷・独立理由・判定不能・ページ表示、CLP履歴ボタン・ショートカット・状態通知、手動端末保存・読込・削除、JSON入出力、色だけに依存しない幾何中心・積荷合成重心の凡例、選択中コンテナの総重量／耐荷重、全CLP積込済数、操作・focus対象外の表示 | 幾何・制約計算と正規入力変換の再実装 |
| `ui/automatic-proposal-session`、`ui/automatic-proposal-view`、`ui/useAutomaticProposalSession`、`ui/AutomaticProposalPanel` | 将来技術資産として保持: Project参照とinteraction generationを捕捉するセッション、取消・stale・retry・遅延結果mask、source ProjectとのID再相関、React hook、固定安全copy、25件単位のpreview、identityを一度だけ取得する確認付き適用、適用済み・変更なし表示。Phase 1の通常画面ではpanelをmountしない | 探索だけでのProject/history変更、永続化、Scene選択の変更 |
| `workers` | 実装済み: 物理判定のローカルmodule Worker。将来自動提案用に、正本Schema・意味検証後だけbrand化して本番上限の純粋探索を実行するone-shot Worker、厳格な応答guard、同期fallbackなしのclient、即時terminate取消・遅延応答maskを保持する。Phase 1の通常起動では自動提案Workerを開始しない | DOM、React状態の直接操作、外部通信 |

実装済みの依存は、UIからapplicationとdomainの型へ、applicationからdomainとpersistenceの検証境界へ、persistenceからdomainへ向かう。scene adapterはdomainの整数mmからThree非依存の表示値を一方向に導出し、rendererはその表示値だけを受け取る。sceneのmesh transform、camera、候補・積荷選択をProjectへ戻さず、canvas dragは正規開始位置とpointer差分から純粋adapterで整数mm入力を作り、application commandを通す。読込ユースケースではapplicationがpersistence境界を呼び、入力編集ではapplication commandがraw draftを正規mm・gへ変換してSchema・意味検証を呼ぶ。domain関数は入力から新しい値または理由を返す純粋関数とし、引数を変更しない。

## Pure Contracts

- `orientedDimensions(cargo, orientation)` — 実装済み。コンテナ局所軸の寸法を返し、入力を変更しない。整数・値域が検証済みであることまでは型だけで保証しない。
- `placementBounds(cargo, placement)` — 実装済み。最小角の `positionMm` と向き適用後寸法から、整数mmの軸整列占有範囲を返し、入力を変更しない。
- `isPlacementWithinContainer(bounds, internalDimensionsMm)` — 実装済み。正体積AABBが閉区間のコンテナ内部に全て含まれるかを判定し、境界等値を合格とする。隙間は扱わない。
- `hasPositiveVolumeOverlap(first, second)` — 実装済み。全3軸で正の長さを共有する場合だけ重なりとし、面・辺・角だけの接触は重なりとしない。隙間と支持接触は扱わない。
- `hasPositiveAreaOverlap(first, second)` — 実装済み。二つの有効な整数mm XY矩形が両軸で正の長さを共有する場合だけtrueを返し、面・辺・点だけの接触、gap、0または反転した矩形をfalseとする。配置済みdragの生床面との保持境界に使用する。
- `classifyFloorFootprint(cargo, container, orientation, positionMm)` — 実装済み。向き適用後のX/Y footprintを生の荷室床面に対して `xy-contained`、`partial`、`outside` に純粋分類し、Zを参照しない。3D fine-pointer dragだけが利用する。
- `isPlacementWithinContainerWithClearance(bounds, internalDimensionsMm, clearancesMm)` — 実装済み。生の包含を前提に、開口面・奥壁・Y両側壁・天井へ軸別隙間を片側ずつ要求し、床Zを例外とする。
- `hasRequiredAxisClearance(first, second, clearancesMm)` — 実装済み。正体積の非支持ペアについて、少なくとも一つの分離軸の共有表面間距離が対応する隙間以上かを判定する。支持関係の識別と例外適用は `validatePlacementSet` が行う。
- `createProjectHistory(initial)`、`commitProjectHistory(state, commit)`、`undoProjectHistory(state)`、`redoProjectHistory(state)` — 実装済み。検証済み `Project` の参照を構造共有し、stale base、no-op、履歴上限、分岐を決定的に扱う。引数とProjectを変更せず、I/Oや再検証を行わない。
- `fitsRectangularOpening(orientedDimensionsMm, openingMm, clearancesMm)` — 実装済み。Y隙間を左右2面分、Z隙間を床例外後の上側1面分だけ加え、向き適用後のY・Z断面が矩形開口へ寸法上収まるかを判定する。X寸法とX隙間は使わない。
- `fittingOpeningOrientations(cargo, openingMm, clearancesMm)` — 実装済み。積荷の許可向きだけを入力順で評価し、矩形断面へ寸法上収まる向きの新しい配列を返す。経路状態と理由は扱わない。
- `validateProjectReferences(project)` — 実装済み。ID、参照、単一配置、許可向き、開口と内部寸法、安全な質量合計を検証する。
- `safeIntegerSum(values)` — 実装済み。各値と加算結果が安全な整数であることを確認する。
- `evaluatePayloadCapacity(massesGrams, payloadCapacityGrams)` — 実装済み。非負safe integerの質量だけをoverflowなく合計し、計算可能なら総質量と耐荷重以内かを返す。等値は合格、超過は不合格とし、CLP内の配置・参照選択と理由は扱わない。
- `calculateCargoCenterOfGravity(project, containerId)` — 実装済み。選択中コンテナの保存済み配置だけを参照解決し、各積荷の向き適用後中心と `massGrams` から倍座標の重量momentを正確に集計する。コンテナ幾何中心、積荷合成重心、配置0件、計算不能を区別し、入力を変更せず、物理合否または許容範囲を返さない。
- `proposeLoadingSequence(project, containerId)` — 実装済み。現在向きAABB、開口面0から最終最大Xまでの直線搬入帯、正面積の接触支持物を使い、`access`・`support` 先行関係、決定的積込順、支持条件未確認、または参照・幾何・正体積重複・支持接触不明・循環の固定理由を返す。配置操作履歴、物理適合の保証、搬送機器または完全な経路は扱わない。
- `compactSceneStagingOverrides(project, containerId, overrides)` — 実装済み。全未配置積荷の現在session向きを保持し、選択中コンテナの負X側へ重ならない決定的gridのside-relative anchorを新しく返す。Project、入力override、配置、履歴を変更しない。
- `isRectangleFullyCoveredByUnion(target, coveringRectangles)` — 実装済み。safe integerの正面積XY矩形だけを受け、対象外をclipした支持矩形の和集合が対象矩形を100%覆うかを整数端点の走査で決定的に判定する。Z接触、段積み可否、対象ID、理由、隙間例外は扱わない。
- `hasFullGeometricSupport(target, candidates)` — 旧和集合100%被覆の低レベル回帰用helperとして実装を保持するが、仕様1.0.1でも現行支持区分には使用しない。
- `assessGeometricSupport(target, candidates)` — 実装済み。床、単一支持面によるX/Y完全包含、支持可能面を含む複数・隙間・張り出し・支持可否混在の条件未確認、接触なし・Z不一致・支持不可面だけの不適合を、正面積接触と安定したID順で純粋分類する。
- `resolveSupportSnapPosition(project, containerId, cargoId, orientation, rawPositionMm)` — 実装済み。fine-pointer dragの整数mm位置を床または最も高い支持可能上面へsnapし、単一面で収容できる場合だけX/Yを完全包含範囲へ制限する。荷室外、支持条件未確認、立体重複を区別し、Projectを変更しない。
- `validatePlacementSet(project, containerId)` — 実装済み。対象コンテナの配置だけを参照解決し、境界、重なり、隙間、許可向きの開口寸法、単独支持・支持条件未確認・支持接触不成立、耐荷重を決定的な順序で評価する。境界違反を座標理由として優先し、その違反だけを原因とする支持・隙間理由は連鎖させず、寸法不適合の開口、耐荷重、単独支持時の構造・安定性未確認など独立理由は保持する。寸法適合だけでは積荷ごとの搬入経路理由を生成せず、入力や計算が安全に評価できない場合は物理的不適合と混同せず `unavailable` を返す。

各結果は対象ID、安定した理由コード、`valid`、`invalid`、`unverified` の状態を持つ。利用者向け文言はUI層で理由コードから生成する。

## Required Verification

- JSON SchemaがDraft 2020-12として解析でき、正規版、上限、向き列挙が設計値と一致する。
- 有効、構文不正、未対応版、追加項目、範囲外、重複ID、参照切れ、不許可向き、開口超過、重量合計オーバーフローを独立テストする。
- 読込失敗時に既存状態が変わらないことを確認する。
- CSVのBOM・改行・quoted field・固定見出し・UTF-8・サイズ・1/30/31件、値域、決定的ID、既定値、全体rollback、確認、Undo/Redo、旧31〜1,000件互換を単体・ブラウザ回帰で検証する。Windows版Excelとの往復は別の人間確認として残す。
- JSON書出しと再読込で正規データが一致し、派生状態を保存しないことを確認する。
- 合成重心は単一・不均等重量、奇数寸法、全6向き、負座標、最大値、入力順、空、参照不整合で決定的かつ非変異に計算し、赤・黄ドットと凡例は非操作、色以外の同値、狭幅、camera、コンテナ切替、Undo/Redo、保存・読込後の再計算を満たす。ドット、凡例、計算状態がJSONまたは端末保存へ入らないことを確認する。
- 積込順は空、参照不整合、不許可向き・safe integer不成立、正体積重複、面接触、Y/Z非交差、前後遮蔽、単一・部分・複数・支持不可接触、支持接触不明、決定的tie-break、循環、入力配列順、別コンテナ除外、30件を純粋単体試験で確認する。

[データ契約チェック](../scripts/check-data-contract.ps1)と文書・ガバナンス検証に加え、型検査、lint、単体テスト、ブラウザテスト、ビルドをそれぞれ独立して実行する。単体テストは構造・意味境界、5 MiB上限、失敗時状態保持、検証済み書出し、往復、mm・kg境界、入力・配置コマンドの原子性、6向きの配置範囲、コンテナ包含、正体積AABB重なりと接触・±1 mm境界、隙間込み5面境界・床例外、非支持ペアの正負側c±1・共有距離・複数分離軸、開口の2Y・1Z等値と±1 mm・全6向き・許可集合、単独支持の等値、1 mm張り出し、複数支持、支持台間隙、支持可否混在、辺・点、Z不一致、重複、床・支持面snap、自動提案除外、総質量の空・等値・1 g超過・safe integer・overflow、対象コンテナ抽出、境界違反のカスケード抑制、支持接触時の隙間例外、独立理由保持、安定した理由順・ID、幾何・耐荷重の計算不能、Worker集約・25件理由ページ・遅延応答破棄・手動再試行、非変異、scene軸変換、drag差分量子化、奇数mm中心、外側配置を含む投影範囲、履歴の参照同一性・非変異・stale/no-op拒否・100件上限・分岐、File size/readと固定名、preflight応答・終了、IndexedDB未対応・open・blocked・abort・error・not-found・破損・delete・往復を含む。ブラウザテストは入力・編集・削除確認、キーボードとフォーカス、候補sceneの切替・編集反映・保存前draft非反映、負・候補外座標、向き変更、stale編集復旧、canvas選択・床・支持面snap・条件未確認preview・drag・取消・視点操作、タッチ時のフォーム操作、物理理由の優先・併記・ページ表示・狭幅表示、1,000配置の実Worker応答性、CLPCRUD・3D dragのundo/redo、入力中lock、native入力履歴の保護、実IndexedDB reload/delete、download/reimport、全JSON失敗段階、履歴barrier、遅延競合、削除focus、305/320/375px、1,000配置・100候補の実preflight Worker応答性に加え、WebGL非対応・初期描画失敗・context loss時の全面停止と現在CLP・端末保存の読み取り専用JSON救出を含む。
