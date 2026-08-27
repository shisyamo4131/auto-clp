# Auto CLP Data Contract and Module Boundaries

- Status: Active design contract
- Project schema version: `0.1.0`
- Related specification: [Auto CLP Specification](specification.md)
- Machine-readable schema: [project-0.1.0.schema.json](../schemas/project-0.1.0.schema.json)
- Decision: [ADR 0009](decisions/0009-versioned-project-data-contract.md)

## Contract Scope

この文書は、Phase 1で端末内保存とJSON入出力に使う案件データ、およびデータを消費する計算モジュールの境界を定義する。完全な案件型、純粋な向き適用、JSON Schema・意味検証、検証済み書出し、派生計算後だけ状態を置換する読込境界、案件・隙間・積荷・候補の入力編集UIは実装済みである。端末保存と利用者向けJSON入出力UIは未実装であり、UI状態、Three.jsオブジェクト、計算結果のキャッシュは本契約へ保存しない。

仕様版 `0.3.0` と案件スキーマ版 `0.1.0` は別に管理する。仕様の文言変更だけでは案件スキーマ版を上げず、保存データの意味または形が変わる場合にだけスキーマ版を更新する。

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

向きコードは、元の `Length`、`Width`、`Height` を世界X、Y、Z軸へ割り当てる順序を表す。

| Code | World X | World Y | World Z | Default |
| --- | --- | --- | --- | --- |
| `LWH` | Length | Width | Height | Yes |
| `WLH` | Width | Length | Height | Yes |
| `LHW` | Length | Height | Width | No |
| `HLW` | Height | Length | Width | No |
| `WHL` | Width | Height | Length | No |
| `HWL` | Height | Width | Length | No |

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
| `domain/geometry` | 実装済み: 向き適用。計画: 直方体、交差、矩形和集合 | UI、描画、永続化 |
| `domain/validation` | 実装済み: ID・参照・許可向き・開口関係・安全整数合計。計画: 境界、隙間、開口通過、支持、耐荷重 | React、Three.js、I/O |
| `application/project-import`、`application/project-command` | 実装済み: 検証と派生計算が成功した場合だけ新状態を返す読込境界、入力draftから検証済み候補だけを原子的に反映する不変コマンド。計画: undo/redo、選択 | DOM、Three.jsオブジェクトの所有 |
| `persistence/project-json` | 実装済み: サイズ、構文、版、スキーマ、意味検証、明示射影書出し。計画: File・端末保存アダプター | 3D描画、直接UI更新 |
| `scene` | 実装済み: 能力確認用のThree.js描画。計画: domainの派生結果を表示へ変換 | 判定規則の再実装、永続データ型の変更 |
| `ui` | 実装済み: raw draft、gからkgへの表示変換、案件・隙間・積荷・候補フォーム、一覧、警告、アクセシブルな編集・削除確認。計画: 配置、保存、JSON入出力 | 幾何・制約計算と正規入力変換の再実装 |
| `workers` | 後続の重い探索処理 | DOM、React状態の直接操作 |

実装済みの依存は、UIからapplicationとdomainの型へ、applicationからdomainとpersistenceの検証境界へ、persistenceからdomainへ向かう。sceneはdomain由来の表示値だけを受け取る計画とし、domainから外側へは向けない。読込ユースケースではapplicationがpersistence境界を呼び、入力編集ではapplication commandがraw draftを正規mm・gへ変換してSchema・意味検証を呼ぶ。domain関数は入力から新しい値または理由を返す純粋関数とし、引数を変更しない。

## Pure Contracts

- `orientedDimensions(cargo, orientation)` — 実装済み。世界軸の寸法を返し、入力を変更しない。整数・値域が検証済みであることまでは型だけで保証しない。
- `validateProjectReferences(project)` — 実装済み。ID、参照、単一配置、許可向き、開口と内部寸法、安全な質量合計を検証する。
- `safeIntegerSum(values)` — 実装済み。各値と加算結果が安全な整数であることを確認する。
- `validateBounds(container, cargo, placement, clearances)` — 積載空間境界を判定する。
- `validateOverlap(placements, cargoes, clearances)` — 接触と軸別隙間を含む重なりを判定する。
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

[データ契約チェック](../scripts/check-data-contract.ps1)と文書・ガバナンス検証に加え、型検査、lint、単体テスト、ブラウザテスト、ビルドをそれぞれ独立して実行する。単体テストは構造・意味境界、5 MiB上限、失敗時状態保持、検証済み書出し、往復、mm・kg境界、入力コマンドの原子性を含む。ブラウザテストは入力・編集・削除確認、キーボードとフォーカス、WebGL非対応時の入力、狭幅表示を含む。物理制約、3D案件接続、端末保存に対する検証は引き続き必要である。
