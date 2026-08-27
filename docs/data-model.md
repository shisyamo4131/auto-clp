# Auto CLP Data Contract and Module Boundaries

- Status: Active design contract
- Project schema version: `0.1.0`
- Related specification: [Auto CLP Specification](specification.md)
- Machine-readable schema: [project-0.1.0.schema.json](../schemas/project-0.1.0.schema.json)
- Decisions: [ADR 0009](decisions/0009-versioned-project-data-contract.md)、[ADR 0010](decisions/0010-container-coordinate-and-placement-anchor.md)、[ADR 0011](decisions/0011-axis-clearance-semantics.md)

## Contract Scope

この文書は、Phase 1で端末内保存とJSON入出力に使う案件データ、およびデータを消費する計算モジュールの境界を定義する。完全な案件型、純粋な向き・配置範囲計算、JSON Schema・意味検証、検証済み書出し、派生計算後だけ状態を置換する読込境界、案件・隙間・積荷・候補の入力編集UI、候補選択とProjectから3D sceneへの一方向投影、フォームによる配置編集、canvas上の積荷選択・床面方向drag・視点操作は実装済みである。端末保存と利用者向けJSON入出力UI、undo/redoは未実装であり、UI状態、Three.jsオブジェクト、計算結果のキャッシュは本契約へ保存しない。

仕様版 `0.5.0` と案件スキーマ版 `0.1.0` は別に管理する。仕様の文言変更だけでは案件スキーマ版を上げず、保存データの意味または形が変わる場合にだけスキーマ版を更新する。

## Persisted Root

案件JSONは次のトップレベル要素だけを持つ。

| Field | Meaning |
| --- | --- |
| `schemaVersion` | 読込互換性を判定する案件スキーマ版。初期値は `0.1.0` |
| `projectId` | 案件内で安定したID |
| `name` | 利用者向け案件名。個人情報、顧客名、機密情報を保存しないよう表示する |
| `clearancesMm` | 案件共通のX・Y・Z軸固定隙間 |
| `cargoes` | 積荷定義。最大1,000件 |
| `containers` | コンテナまたは車両候補。最大100件 |
| `placements` | 配置済み積荷。最大1,000件 |

ファイルサイズ上限は5 MiB（5,242,880 bytes）とし、サイズ超過はJSON解析前に拒否する。空の積荷・候補・配置配列は、入力途中の案件保存を可能にするため許可する。

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

| Code | Container X | Container Y | Container Z | Default |
| --- | --- | --- | --- | --- |
| `LWH` | Length | Width | Height | Yes |
| `WLH` | Width | Length | Height | Yes |
| `LHW` | Length | Height | Width | No |
| `HLW` | Height | Length | Width | No |
| `WHL` | Width | Height | Length | No |
| `HWL` | Height | Width | Length | No |

## Placement Coordinate Contract

- 配置は `containerId` が参照するコンテナの局所右手座標系を使う。
- コンテナ内部は `[0, L] × [0, W] × [0, H]` とする。原点は負X側開口面、最小Y側壁、床が交わる内隅で、+Xは開口から奥、+Yは幅方向で入口から奥を見た左側、+Zは上方とする。最小Y側壁は入口から見た右側である。
- 開口面は `x = 0`、床は `z = 0`。開口のY範囲は `[(W - openingWidth) / 2, (W + openingWidth) / 2]`、Z範囲は `[0, openingHeight]` とし、差が奇数mmでも描画または比較のために丸めない。
- `positionMm` は、`orientation` 適用後の軸整列積荷直方体の最小X・Y・Z角である。向き適用後の寸法を `(dx, dy, dz)` とすると、占有範囲は `[x, x + dx] × [y, y + dy] × [z, z + dz]` になる。
- 向き変更時は既定で最小角を保持し、暗黙の平行移動や丸めを行わない。床置きは `z = 0` である。
- 正規データと判定は整数mmを維持する。Three.js表示では派生値だけを `1 mm = 0.001 scene unit` で変換し、mesh中心を最小角と向き適用後寸法から計算する。0.5mmの表示中心を正規案件へ逆流させない。
- canvas dragは正規最小角を開始値として保持し、scene上のpointer差分をdomain X/Y差分へ写像して最近接1 mmへ正負対称に量子化する。mesh中心やtransformを保存値として読まず、Z・向きを保持し、既存application commandが成功した場合だけProjectを置換する。
- 負座標や外側配置は修正途中の状態として保存できる。将来の境界判定では不適合となるが、scene投影は適合性を判定または保証しない。

検証済みserializerと、座標値を生成する配置UI・application commandは実装済みである。利用者向けJSON入出力UIと端末保存はまだ存在しない。座標契約の採択時点ではSchema `0.1.0` の初回意味確定としてJSONの形と版を変更せず、その後の配置実装も同じ契約を維持している。既存外部データが後から判明した場合は意味を推測して再解釈せず、新Schema版と明示的な移行を設計する。

## Axis Clearance Contract

- `clearancesMm` は積荷ごとのhaloではなく、隣接する表面間に必要な実距離を軸別に表す。積荷間で設定値を2倍にせず、等値を合格とする。
- 配置後の境界条件は `xMin >= cX`、`xMax <= L - cX`、`yMin >= cY`、`yMax <= W - cY`、`zMin >= 0`、`zMax <= H - cZ` とする。負X側開口面もX隙間の対象で、床だけはZ隙間を要求しない。
- 支持関係ではない積荷ペアは、少なくとも一つの分離軸で表面間距離が対応する隙間以上なら合格とする。正体積重なりは常に不適合である。
- 認定された支持面との完全一致接触ではZ隙間を要求せず、支持を構成するX・Y投影重なりへ積荷間隙間を適用しない。支持成立は100%被覆、同一高さ、段積み可否で別途判定する。
- 開口断面は従来どおり `cargoY + 2 × cY <= openingWidth`、`cargoZ + cZ <= openingHeight` とし、X隙間を使わない。配置後境界と搬入断面を混同しない。

この意味はADR 0011で初めて確定した。物理判定、端末保存、利用者向けJSON入出力はまだ公開されていないためSchema `0.1.0` を据え置く。実装後は保存値から毎回再計算し、判定結果や隙間包絡をJSONへ保存しない。

## Stored and Derived State

保存するのは利用者入力と配置だけである。次は常に再計算し、JSONへ保存しない。

- 向き適用後の寸法。
- 境界、重なり、開口部、支持、段積み可否、総耐荷重の判定。
- `valid`、`invalid`、`unverified` の集約状態と理由コード。
- Three.jsのメッシュ、材質、カメラ、選択ハイライト。
- UIフォームの一時値、エラー表示、undo/redo履歴。

不適合な配置も、座標値と参照整合性が有効なら保存できる。これにより、利用者が途中状態を失わず修正できる。読込時に不適合を成功扱いせず、再計算した理由を表示する。

## Import Transaction

JSON読込は次の順序で行い、すべて成功するまで現在案件を変更しない。

1. ファイルが5 MiB以下か確認する。
2. テキストをJSONとして一時値へ解析する。実行可能コードとして評価しない。
3. `schemaVersion` が対応版か確認する。
4. JSON Schemaで型、必須項目、追加項目、個数、値域を確認する。
5. ID一意性、参照、許可向き、開口寸法、安全な整数合計を意味検証する。
6. 配置判定を新しい一時状態に対して再計算する。
7. 全検証と再計算の成功後にだけ、新しい案件状態へ一括置換する。

どの段階で失敗しても現在案件を保持し、ファイル名、秘密情報、入力全体をログへ出さず、利用者が修正できる理由を示す。

実装は申告サイズと読取後のUTF-8実サイズをともに確認し、構造エラーを入力値や未知プロパティ名を反射しない安定したcode/pathへ正規化する。構造エラーは決定的な順序で重複を除き、最大50件を返す。書出しも明示的な保存対象だけへ射影した後、同じ構造・意味検証に合格した場合だけJSONを生成する。

## Module Boundaries

以下は実装済み部分と計画部分を含む依存方向である。案件契約、取引的読込、入力編集UIは実装済みだが、物理制約の完全な再計算、端末保存、JSON入出力UIは計画段階である。

| Planned module | Responsibility | Forbidden dependencies |
| --- | --- | --- |
| `domain/model` | 実装済み: 版、向き、寸法、隙間、積荷、候補、配置、案件のreadonly型 | React、Three.js、ブラウザ保存API |
| `domain/geometry` | 実装済み: 向き適用、最小角からの配置範囲、コンテナ内部への包含、正体積AABB重なり、隙間込みコンテナ境界、非支持ペアの軸別隙間、矩形開口寸法と許可向き抽出。計画: 支持例外を含む高位判定、矩形和集合 | UI、描画、永続化 |
| `domain/validation` | 実装済み: ID・参照・許可向き・開口関係・安全整数合計。計画: 境界、隙間、開口通過、支持、耐荷重 | React、Three.js、I/O |
| `application/project-import`、`application/project-command` | 実装済み: 検証と派生計算が成功した場合だけ新状態を返す読込境界、入力draftから検証済み候補・配置だけを原子的に反映する不変コマンド。計画: undo/redo | DOM、Three.jsオブジェクトの所有 |
| `persistence/project-json` | 実装済み: サイズ、構文、版、スキーマ、意味検証、明示射影書出し。計画: File・端末保存アダプター | 3D描画、直接UI更新 |
| `scene` | 実装済み: WebGL能力確認、選択候補の内部・中央開口・登録済み配置への純粋投影、Three.js描画、全投影範囲へ適応するcamera、canvas picking、fine pointerによる床面方向drag・視点操作。touch/coarse pointerは選択のみで縦scrollを保持 | 判定規則の再実装、永続データ型の変更 |
| `ui` | 実装済み: raw draft、gからkgへの表示変換、案件・隙間・積荷・候補フォーム、一覧、警告、アクセシブルな編集・削除確認、非永続の3D候補・積荷選択、配置追加・整数座標・許可向き・取り外しフォーム、canvas直接操作と正確な移動・向きのキーボード対応フォームfallback。計画: undo/redo、保存、JSON入出力 | 幾何・制約計算と正規入力変換の再実装 |
| `workers` | 後続の重い探索処理 | DOM、React状態の直接操作 |

実装済みの依存は、UIからapplicationとdomainの型へ、applicationからdomainとpersistenceの検証境界へ、persistenceからdomainへ向かう。scene adapterはdomainの整数mmからThree非依存の表示値を一方向に導出し、rendererはその表示値だけを受け取る。sceneのmesh transform、camera、候補・積荷選択をProjectへ戻さず、canvas dragは正規開始位置とpointer差分から純粋adapterで整数mm入力を作り、application commandを通す。読込ユースケースではapplicationがpersistence境界を呼び、入力編集ではapplication commandがraw draftを正規mm・gへ変換してSchema・意味検証を呼ぶ。domain関数は入力から新しい値または理由を返す純粋関数とし、引数を変更しない。

## Pure Contracts

- `orientedDimensions(cargo, orientation)` — 実装済み。コンテナ局所軸の寸法を返し、入力を変更しない。整数・値域が検証済みであることまでは型だけで保証しない。
- `placementBounds(cargo, placement)` — 実装済み。最小角の `positionMm` と向き適用後寸法から、整数mmの軸整列占有範囲を返し、入力を変更しない。
- `isPlacementWithinContainer(bounds, internalDimensionsMm)` — 実装済み。正体積AABBが閉区間のコンテナ内部に全て含まれるかを判定し、境界等値を合格とする。隙間は扱わない。
- `hasPositiveVolumeOverlap(first, second)` — 実装済み。全3軸で正の長さを共有する場合だけ重なりとし、面・辺・角だけの接触は重なりとしない。隙間と支持接触は扱わない。
- `isPlacementWithinContainerWithClearance(bounds, internalDimensionsMm, clearancesMm)` — 実装済み。生の包含を前提に、開口面・奥壁・Y両側壁・天井へ軸別隙間を片側ずつ要求し、床Zを例外とする。
- `hasRequiredAxisClearance(first, second, clearancesMm)` — 実装済み。正体積の非支持ペアについて、少なくとも一つの分離軸の共有表面間距離が対応する隙間以上かを判定する。支持関係の識別と例外適用は呼出側の計画機能である。
- `fitsRectangularOpening(orientedDimensionsMm, openingMm, clearancesMm)` — 実装済み。Y隙間を左右2面分、Z隙間を床例外後の上側1面分だけ加え、向き適用後のY・Z断面が矩形開口へ寸法上収まるかを判定する。X寸法とX隙間は使わない。
- `fittingOpeningOrientations(cargo, openingMm, clearancesMm)` — 実装済み。積荷の許可向きだけを入力順で評価し、矩形断面へ寸法上収まる向きの新しい配列を返す。経路状態と理由は扱わない。
- `validateProjectReferences(project)` — 実装済み。ID、参照、単一配置、許可向き、開口と内部寸法、安全な質量合計を検証する。
- `safeIntegerSum(values)` — 実装済み。各値と加算結果が安全な整数であることを確認する。
- `validateBounds(container, cargo, placement, clearances)` — 計画。開口面・奥壁・Y両側壁・天井へ片側ずつ軸別実距離を要求し、床Zを例外として積載空間境界を判定する。
- `validateOverlap(placements, cargoes, clearances)` — 計画。正体積重なりを拒否し、非支持ペアはいずれか一つの分離軸で設定実距離を満たすか判定する。支持接触は別の合成規則で扱う。
- `validateOpeningFit(container, cargo, clearances)` — 許可向きごとの矩形開口適合を判定する。
- `validateSupport(placements, cargoes)` — 同一高さの100%幾何支持を判定する。
- `validatePayload(container, placements, cargoes)` — 安全な整数合計と総耐荷重を判定する。
- `validatePlacementSet(project, containerId)` — 個別理由を保持した集約結果を返す。

各結果は対象ID、安定した理由コード、`valid`、`invalid`、`unverified` の状態を持つ。利用者向け文言はUI層で理由コードから生成する。

## Required Verification

- JSON SchemaがDraft 2020-12として解析でき、正規版、上限、向き列挙が設計値と一致する。
- 有効、構文不正、未対応版、追加項目、範囲外、重複ID、参照切れ、不許可向き、開口超過、重量合計オーバーフローを独立テストする。
- 読込失敗時に既存状態が変わらないことを確認する。
- JSON書出しと再読込で正規データが一致し、派生状態を保存しないことを確認する。

[データ契約チェック](../scripts/check-data-contract.ps1)と文書・ガバナンス検証に加え、型検査、lint、単体テスト、ブラウザテスト、ビルドをそれぞれ独立して実行する。単体テストは構造・意味境界、5 MiB上限、失敗時状態保持、検証済み書出し、往復、mm・kg境界、入力・配置コマンドの原子性、6向きの配置範囲、コンテナ包含、正体積AABB重なりと接触・±1 mm境界、隙間込み5面境界・床例外、非支持ペアの正負側c±1・共有距離・複数分離軸、開口の2Y・1Z等値と±1 mm・全6向き・許可集合、scene軸変換、drag差分量子化、奇数mm中心、外側配置を含む投影範囲を含む。ブラウザテストは入力・編集・削除確認、キーボードとフォーカス、候補sceneの切替・編集反映・削除時fallback、保存前の配置draft非反映、負・候補外座標、向き変更、stale編集復旧、canvas選択・drag・取消・視点操作・描画障害復旧、タッチ時のフォームfallback、WebGL非対応時の配置、狭幅表示を含む。経路未確認状態、支持例外・理由コードを含む物理制約の集約とUI、undo/redo、端末保存に対する検証は引き続き必要である。
