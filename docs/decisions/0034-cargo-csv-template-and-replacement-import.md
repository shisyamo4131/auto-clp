# 0034 CSVテンプレートによる積荷一括置換

- Date: 2026-09-08
- Status: Accepted
- Related specification: Cargo; Application Shell and Primary Workflow; Persistence; Operation History; Data and State
- Refines: 0009, 0013, 0022, 0025, 0029, 0030
- Changes current specification default: 新規積荷の既定を、従来仕様の立置き2向きから天地無用OFFの全6向きへ変更する。ADR 0022のON/OFF対応自体は維持する

## Context

Phase 1は積荷を一件ずつmodalへ入力できるが、複数件の名前、寸法、重量をExcelで準備して一括登録する経路がない。対象業務は大量自動処理ではなく、人が一つのCLPとして確認できる規模であるため、新規作成上限を30件へ絞り、将来の緩和を一つの定数で行えるようにする。

CargoにはCSVで受け取る名前、寸法、重量以外にID、段積み可否、許可向きが必須である。利用者へBoolean表現やorientation codeをCSVで要求すると、`1` / `0` やtrue / falseの意味が分かりづらくなる。大多数は段積みと回転を許可し、例外だけを後から画面で変更する前提を採用する。

Schema `0.1.0`は積荷と配置を各1,000件まで許可しており、同じ版の上限を30へ下げると既存の有効なJSON・端末保存を拒否する。CSVはCLP JSONの代替保存形式ではなく、現在CLP内の積荷を作成し直す一時入力として分離する。

## Decision

- アプリから固定名 `auto-clp-cargo-template.csv` をダウンロードできるようにする。テンプレートはUTF-8 BOM、CRLF、固定順・大小文字を区別する `name,length_mm,width_mm,height_mm,weight_kg` の見出しだけを持つ。
- 読込はUTF-8のBOM有無、CRLF / LF、カンマ区切り、引用符付きfield、二重引用符escapeを受ける。見出し不足・余分・重複・並べ替え・大小文字違い、列数不一致、不正引用、不正UTF-8を拒否する。
- decoded fieldがすべて空白のrecordは無視する。有効recordは1〜30件を要求し、0件と31件以上を全体失敗とする。重複名は許可し、論理record順に `cargo-1`〜`cargo-N` を割り当てる。
- 名前、整数mm寸法、kg小数第3位までの正確なg変換と値域は既存入力契約を共有する。桁区切り、指数表記、全角数字、単位、式、丸めは許可しない。
- CSVに段積み可否または天地無用の列を置かない。CSV由来と手動追加の新規積荷はともに `canSupportCargo=true`、天地無用OFFの全6向きとする。既存積荷は暗黙変更しない。
- CSVは申告サイズと読取後UTF-8実サイズを5 MiB以下と確認し、全recordと置換後Projectを一時検証する。失敗時は現在Projectと履歴を同一参照で保持し、値、名前、ファイル名、全文をログまたはエラーへ反射しない。
- issueは、templateを `/template`、file全体を `/file`、見出しを `/header`、件数を `/rows`、recordを `/rows/{n}`、cellを `/rows/{n}/{column}`、置換後Projectを `/` とする固定pathへ正規化する。`{n}` は全空白recordを除く1始まりの論理データrecord順とし、quoted field内の改行を含む物理行番号は使わない。codeは `cargo-csv.download-*`、`cargo-csv.import-unavailable`、`cargo-csv.file-size`、`cargo-csv.read`、`cargo-csv.utf8`、`cargo-csv.syntax`、`cargo-csv.header`、`cargo-csv.record-count`、`cargo-csv.column-count`、`cargo-csv.name-*`、既存の `input.mm-*` / `input.kg-*`、`cargo-csv.candidate-invalid` の固定集合を使う。path、codeの順に並べ、重複を除いて最大50件とする。
- 適用前に、作成件数、削除する既存積荷件数、解除する配置件数を確認する。確定時だけCLP ID・名前、隙間、コンテナを保持し、`cargoes`を一括置換して`placements=[]`とする。
- 成功を一回の `cargo.csv-replace` 履歴操作とし、Undoは旧積荷と全配置を完全復元し、Redoは同じCSV由来状態へ戻す。取消、失敗、stale、busy、no-opではProjectと履歴を変更しない。
- 成功時は旧積荷に属する選択、荷室外pose、drag previewを破棄し、物理判定と合成重心を新Projectから再導出する。コンテナとcameraは維持できる。
- 手動追加とCSV結果の新規作成上限は一つの名前付き定数30から導く。Schema `0.1.0`とJSON・端末保存の積荷・配置上限1,000件は既存互換のため維持する。既存31〜1,000件は読込、表示、編集、削除、書出し可能で、30件以上では追加だけを拒否し、29件以下になれば再び追加できる。配置上限は変更しない。

## Consequences

- Excel利用者は名前、3寸法、重量だけを入力すればよく、Booleanやorientation codeを覚える必要がない。
- 一括登録は既存積荷と全配置を削除する破壊的変更だが、適用前確認と一回のUndoで復旧できる。
- CSVはCLP全体のbackupまたは交換形式ではない。コンテナ、配置、隙間、CLP情報をCSVへ書き出さない。
- 30件上限は既存保存データを破壊しない。将来の上限緩和は新規作成定数と対応試験を変更し、Schema上限を超えない範囲なら移行不要である。
- Schema、Projectのfield形、JSON固定名、端末保存形式、外部通信、依存packageは変更しない。

## Compatibility and Rollback

既存のSchema `0.1.0` JSONと端末保存はそのまま読込・書出しできる。31件以上を含む旧Projectも一括CSV確認前は変更せず、Undoで同じ状態へ復元できる。新しい全6向き・段積み可の積荷も旧Schemaで有効である。

rollbackはCSV UI、parser、file adapter、一括command、履歴actionを外し、手動追加の既定と作成上限を旧動作へ戻す。保存データの移行や履歴書換えは不要である。

## Verification

- Parser/file: BOM有無、CRLF/LF、引用comma・引用符・quoted改行、空record、固定見出し、列数、UTF-8、申告・実サイズ、読取失敗、1/30/31件、1始まり論理record、固定code/path、決定的sort・重複排除・50件上限、安定したvalue非反射errorを検証する。
- Application: 決定的ID、重複名、既定値、全行一時検証、他Project field保持、積荷置換、配置全削除、非変異、stale/no-op、1回のUndo/Redoを検証する。
- Compatibility: 31件・最大1,000件の既存Schema/JSON/端末保存を維持し、新規追加だけが30件で停止して29件で再開することを検証する。配置1,000件と防御的な重量計算試験は維持する。
- UI/browser: template filename・bytes、file chooser、件数確認、取消・失敗・成功、選択・scene一時状態、物理判定・重心再導出、focus、keyboard、busy、305 / 320 / 375 px、WebGL障害時の全面停止を検証する。
- Human: Windows版Excelでテンプレートを開き、「CSV UTF-8（コンマ区切り）」として保存した匿名データを再読込し、値、順序、既定値、確認、Undo/Redoを確認する。非UTF-8 CSVは状態を変えず拒否されることも確認する。
