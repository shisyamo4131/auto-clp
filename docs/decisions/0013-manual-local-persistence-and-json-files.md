# 0013 手動の端末内保存とJSONファイル入出力

- Date: 2026-08-28
- Status: Accepted
- Related specification: Persistence; Operation History; Error Handling
- Supersedes: None
- Refines: 0001, 0009

## Context

案件JSON `0.1.0` の構造・意味検証、検証済み書出し、失敗時に現在案件を保持する取引的読込は実装済みだが、利用者が再起動後に案件を復元する端末保存とJSONファイルUIは未接続だった。保存の自動化、複数案件管理、ブラウザ固有ファイルAPIへ依存すると、意図しない保持、互換性低下、履歴・一時状態の混入、非同期競合による入力喪失を招く。

## Decision

- 端末内保存はIndexedDBの固定キー `current-project` を使う単一の手動保存枠とする。自動保存と起動時自動読込は行わない。
- 保存コピーは利用者が確認付きで削除するまで保持を試みる。自動失効は設けないが、ブラウザのサイトデータ削除、容量管理、private mode等で失われ得るためバックアップとは扱わない。
- 端末保存はIndexedDB transaction完了後だけ成功とする。未対応、open、read、write、delete、abort、blocked、quota相当の失敗を固定codeで扱い、案件値をエラーやログへ反射しない。
- JSON読込は標準のfile inputと `File.size` / `File.text()`、書出しは `Blob`、object URL、download属性を使う。File System Access APIへ依存せず、出力名は案件名を含まない `auto-clp-project-0.1.0.json` に固定する。
- 端末読込とJSON読込は既存のサイズ、構文、版、Schema、意味検証に加え、全候補コンテナの物理判定をone-shot module Workerで置換前に再計算する。不適合と未確認は有効な計算結果として読込を許可し、判定不能、Worker失敗、不正応答では現在案件を保持して拒否する。
- 読込成功は案件全体の履歴barrierとし、undo/redo、未保存入力、削除確認、候補・積荷選択、camera、drag preview、旧Worker結果・理由ページを破棄する。これらは端末保存にもJSONにも含めない。
- 永続化処理の開始時に未保存入力、削除確認、dragまたは別処理があれば開始しない。処理中の案件commitと履歴移動を拒否する。読込中にProject/sceneの入力状態が一度でも変わった場合は、終了時に入力が閉じていても置換せず、現在案件、履歴、入力を保持する。

## Rationale

単一の明示保存枠は現在の単一Project所有モデルに一致し、利用者が端末保持を意識して選べる。IndexedDBは非同期transactionを持ち、最大5 MiBの正規JSONをlocalStorageの文字表現・quotaへ依存せず扱える。標準file inputとdownloadは静的ローカルWebアプリの範囲で広く使え、ブラウザ固有権限を増やさない。置換前Worker判定とinteraction generationは、大規模案件でメインスレッドを塞がず、遅延中の入力喪失を防ぐ。

## Impact

- Users: 手動で1件を端末へ保存・読込・削除し、固定名JSONをバックアップ・移送に使える。自動保存はないため明示操作が必要である。
- Data: 保存形式とSchemaは `0.1.0` のまま変わらず、履歴・UI・物理判定は保存しない。
- Implementation: IndexedDB、標準File/Blob adapter、全候補preflight Worker、履歴barrier、固定codeのUIを追加する。外部通信と依存追加はない。
- Security: ファイル名とエラーへ案件名・入力値を反射せず、全データは利用者端末内だけで処理する。
- Tests: transaction、失敗段階、競合、履歴barrier、focus、狭幅、実download/reimport、reload、最大規模Worker応答性を検証する。

## Compatibility and Migration

案件Schema `0.1.0` を変更しないためJSON移行はない。IndexedDBには検証済みJSON文字列だけを保存する。将来複数枠や別Schemaを導入する場合は、新しいDB版・移行と旧データ保護を後継ADRで定める。

## Rollback

UI、adapter、Worker、App接続を同じ変更として戻せる。rollback時にIndexedDBの保存コピーを自動削除しない。利用可能な版で先にJSONを書き出し、削除は利用者の明示操作だけで行う。

## Reconsider When

複数案件一覧、自動保存、世代管理、明示的な保持期限、OSファイルハンドル、クラウド同期、または正式な対応ブラウザ保証が承認された場合。
