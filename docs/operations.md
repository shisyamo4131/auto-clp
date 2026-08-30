# Operations

## Current Availability

- Implemented: Gitリポジトリ、ガバナンス、仕様、ロードマップ、ADR、案件JSON Schema `0.1.0`、完全なreadonly案件型、構造・意味検証、検証済みJSON書出し、派生計算成功後だけ置換する取引的読込基盤、IndexedDB単一手動枠の端末保存・読込・確認削除、固定名JSONファイル入出力、保存Navigation Drawerと操作単位のSnackbar、全候補の置換前Worker判定、案件・隙間・積荷・候補の取引的な入力編集UI、配置追加・整数mm移動・許可向き変更・取り外しの原子的フォーム、viewport内のcompactな単一案件履歴、積荷picker、選択積荷のcompactな寸法・座標card、成功した案件変更を最大100件保持する非永続undo/redo、コンテナ包含・XY正面積重なり・正体積AABB重なり・隙間込み境界・非支持ペア軸別隙間・矩形開口寸法と許可向き抽出・支持面XY矩形和集合100%被覆・床と完全一致Z接触と段積み可の支持合成の純粋geometry基盤、safe integer総質量・耐荷重評価、対象コンテナの境界・重なり・隙間・開口・支持・耐荷重を独立理由付きで集約する純粋判定、ローカルWorkerによる非同期評価と25件理由ページ、利用者向け物理状態・対象・関連積荷・理由・判定不能表示、ローカルWebアプリ骨格、WebGL 2能力確認、候補選択、ProjectからThree非依存scene値への一方向投影、コンテナ内部・中央開口・登録済み配置と荷室外作業スペースのThree.js描画、canvas積荷選択、fine pointerによる未配置積荷の自由な荷室外移動・初回配置と配置済み床面方向drag・完全drag-out削除、許可済みX/Z軸90°回転、天地無用入力補助、viewport wheelのpage scroll、明示的な `＋` / `－` による拡大縮小、同一候補更新時のcamera保持、touch/coarse pointerでの選択と縦scroll・フォームfallback、型・lint・単体・ブラウザ・ビルド検証。
- Implemented support refinement: fine pointer dragの床・支持可能上面へのZ snap、単一支持面内のX/Y clamp、条件未確認・不適合preview、操作対象以外のほぼ透明な中立面と灰色点線、緑・黄点線による支持候補強調、単独支持・複数支持・隙間・張り出し・支持可否混在・接触不成立の派生判定。旧XY和集合100% helperは回帰用に保持するが、現行の支持区分には使用しない。
- Implemented rotation-toolbar refinement: X/Z回転はUndo/Redo・拡大縮小と同じviewport固定toolbarへ常設する。一本の軸線へ矢印が回り込む同一SVGをXだけ90度回して区別し、未選択・天地無用のX軸・busyではfocus可能な理由付き `aria-disabled` とする。Z軸床面回転は常に許可し、使用可は拡大・縮小と同じ青緑の強調枠、使用不可は低彩度の枠・iconで区別する。紫色の塗り分けは使わず、回転前後でbutton位置は変えない。
- Implemented foundation: ADR 0004に基づく、一候補へ全積荷を配置する純粋な決定的DFS、目的関数順位、候補点・attempt上限、cutoff/no-complete-plan、未確認理由保持。
- Implemented transport: 正本Schema・意味検証後だけ探索するone-shot module Worker、固定code、厳格な応答検証、同期fallbackなしのclient、即時terminate取消と遅延・二重応答mask、Appからの実Worker接続。
- Implemented orchestration, preview, and apply: React非依存の探索session、Project参照・interaction generationのstale判定、取消・retry・遅延結果mask、React hook/panel、Appのbusy・generation開始gate、source相関付き固定copy、25件pageの非永続preview DOM、Schema・意味・物理再検証付きの確認、一括適用、一回のUndo/Redo。WebGL非対応時も利用できる。
- Verified technical evidence: AP-08代表規模は、Windows/headless Chromiumの記録環境で実Workerのcold 1回・warm 3回、決定性、main timer/rAF進行、native取消を初期性能gate内で検証した。記録は `evidence/automatic-proposal-ap08-1226b082.md`。一般端末SLA、最低GPU、実務受入、安全保証ではない。
- Unavailable: 端末保存の自動保存・起動時自動読込・複数枠・自動期限、canvas上の自由な連続Z移動・取り外し、touch drag、複数候補のtab切替とside-relative作業面、積荷画像、デプロイ、クラウド保存、外部API、実運用サポート。

未実装機能を利用可能として案内してはならない。

包含・重なり・隙間込み境界・非支持ペア軸別隙間・単独支持・支持条件未確認・支持接触不成立の低レベルgeometry基盤と、同一コンテナの対象抽出、参照解決、支持隙間例外、対象ID、理由コード、集約状態を返す純粋判定は実装済みである。床を下へ越える配置は専用 `floor-penetration` を先頭理由とし、他面だけの境界外 `outside-container` と区別する。判定はローカルmodule Workerでメインスレッド外に実行し、集約状態と件数を先に、理由を不適合・未確認ごとに25件ずつ表示する。候補や案件が変わった場合は旧Workerを終了して旧結果を表示せず、Worker障害時は物理的不適合と混同せず判定不能と再試行を表示する。

矩形開口のY・Z断面判定、許可向き抽出、どの許可向きでも寸法上通らない場合の不適合理由・対象ID・集約とUI表示は実装済みである。寸法上通る場合は積荷ごとの理由を生成せず、完全な搬入経路を保証しない範囲を恒常的な注意で示す。

総質量・耐荷重の数学評価と、対象コンテナの配置・積荷参照を解決して超過理由・対象IDを付ける高位判定とUI表示は実装済みである。積荷別上載荷重、荷重分布、重心、軸重、床強度は評価しない。

ADR 0011で、軸別隙間を隣接表面間の実距離として扱い、配置後は開口面・奥壁・Y両側壁・天井へ各設定値、床・支持面へ0 mmを要求する意味を確定した。積荷間では設定値を2倍にせず、非支持ペアはいずれか一つの分離軸で必要距離を満たせばよい。低レベル判定に加えて支持関係の識別・例外、対象ID、理由コード、集約、UI表示も実装済みである。

Phase 1は、完全な搬入経路、積荷別上載荷重、重心、軸重、床荷重、荷崩れ、固縛、動荷重を保証しない。完全な搬入経路は具体的な要望と入力契約が確定するまで積荷ごとの未確認理由にせず、恒常的な範囲説明だけを維持する。その他は実装済みの支持判定で必要な場合だけ未確認理由として区別する。

配置座標はADR 0010のコンテナ局所右手座標を使い、`positionMm` は向き適用後の積荷直方体の最小角とする。正規値は整数mmを維持し、描画用中心、scene縮尺、camera、候補・積荷選択、荷室外の作業位置を案件へ保存しない。Project→scene投影、フォーム配置、canvas選択、fine pointerのX/Y dragと床・支持可能上面への決定的Z snap、許可済みX/Z軸90°回転、視点回転・平行移動、明示 `＋` / `－`、荷室基準の「荷室全体を表示」を実装済みである。viewport上のwheelはcameraを変えずpage scrollへ渡す。

案件全体で未配置の積荷だけを初回は先頭許可向き・Z=0の決定的な暖色gridへ派生し、他候補へ配置済みなら重複表示しない。grid間隔は各積荷の許可向き全体から得る最大X/Y footprintで固定し、一つを回転しても他の未配置積荷を動かさない。利用者が積荷全体を荷室外へdropした後はcargo IDごとの位置と向きをUI sessionだけに保持する。外側移動と回転はProject、物理判定、案件履歴、保存へ含めない。fine-pointer dragは量子化後のno-opを先に除き、X/Y footprintを完全包含・正面積partial・面積0 outsideへ分類する。完全包含またはpartialでは、支持可能面がなければ床、あれば最も高い支持可能上面へZをsnapし、単一面が底面を収容できる場合だけX/Yをその面内へ制限する。未配置と配置済みの双方でsnap後位置を一回の配置追加・更新として保存し、partial・条件未確認・不適合も修正途中として再判定する。outsideは未配置ならsession poseだけ、配置済みなら一回の `placement.delete` とsession poseにする。Undoは元配置、Redoは同じ外側poseを表示する。

Z軸回転は高さ軸を保つ相手を使い、積荷選択中かつbusyでなければ常に有効とする。X軸回転はY/Z割当を交換し、天地無用OFFだけ有効とする。積荷editorは天地無用だけを表示し、ONを `LWH` / `WLH`、OFFを全6向きへ写像する。旧保存の部分集合は読込preflight後に同じ2状態へ正規化する。面の表裏は識別しない。配置済み回転は最小X/Y/Z角を保持した一回の配置更新、荷室外回転は回転後も荷室床面との正面積重なりが0の場合だけsession変更とする。重なる回転は直前poseを保持して拒否し、積荷編集で既存poseが重なる場合は新寸法の決定的外側gridへ戻す。cameraのfarと最大移動距離は全投影範囲への到達余地を保ち、同一候補のProject更新では現在cameraと注視点を復元する。touch/coarse pointerは積荷選択だけを行い、正確な配置・移動・向きにはキーボード操作可能なフォームを使う。canvas上のZ移動は未実装である。

案件全体のUndo/Redoはviewport内で `＋` / `－` と同じ外観の単一操作UIとし、buttonと既存shortcutを同じ履歴handlerへ接続する。実行前後のpage scroll位置を復元し、WebGL 2非対応時はfallback領域へ同じ一組だけを置く。選択cardは積荷名を見出しとし、寸法prefixを付けず、配置済みなら向き適用後寸法とcompactなX/Y/Zを表示する。積荷selectは全Project積荷を検索し、現在候補、未配置、他候補を示す。他候補の配置を扱う前に所有候補へ明示切替する。積荷定義と配置は別modal editorで編集し、focus trap、背景inert、dirty破棄確認、内部scroll、狭幅、preventScroll focus復帰を維持する。dialog中は履歴、3D操作、候補切替、永続化、自動提案をbusyとして拒否する。配置取り外しと積荷削除は別確認・別履歴でcascadeしない。物理panelは維持する。

案件履歴は、案件設定、積荷、候補、配置の成功した追加・更新・削除と、1回のcanvas dragを一つの操作として最大100件保持する。「元に戻す」「やり直す」ボタンに加え、Windows/Linuxでは `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y`、macOSでは `Command+Z` / `Command+Shift+Z` を利用できる。未保存入力、削除確認、drag中は履歴操作を無効にし、入力欄、選択欄、編集可能領域、独自入力コンポーネントのローカル履歴を優先する。失敗とno-opは履歴を変えず、undo後の新しい確定操作はredoを破棄する。履歴はメモリ内だけで、再読込、JSON書出し、端末保存には含めない。

## Preparation

Phase 1の技術受入には `acceptance.md` の匿名合成データだけを使う。自動試験と開発チーム内試用は実務利用者受入と区別し、実務試用が未実施の間は受入済みと報告しない。

自動提案の純粋domain探索、Worker transport、session/view、利用者向けReact panel、Appでのbusy・generation配線、実Workerの開始・取消・retry、非永続preview DOM、確認付き一括適用と一回のUndo/Redoは実装済みである。探索開始だけでProjectを変更せず、preview、取消、cutoff、完全案なし、失敗、stale、積荷なし、候補なしでは現在案件と履歴を保持する。通常編集、Undo/Redo、未保存入力、3D操作、保存・読込の開始時は旧探索または確認を終了し、遅延結果を表示しない。適用時は現在のProject参照とgenerationを再確認し、完全案をSchema・意味・正本物理判定で再検証してから配置だけを一括置換する。同じ配置集合なら履歴を増やさず、変更時だけ `自動提案の一括適用` 一件として記録する。探索上限到達と完全案なしを実積載不能または安全性の証明として案内してはならない。より優先される候補がcutoffの時は、後続候補の完全案を目的関数上の最良として案内してはならない。

AP-08の性能再現は `node scripts/run-browser-tests.mjs automatic-proposal-performance.spec.ts` を使う。匿名の固定20積荷fixture、production module Worker、cold 1回・warm 3回、決定的result hash、browser clock、main timer/rAF、別fresh UI pageのnative取消、consoleと実行環境を一つのJSONへ記録する。各探索5秒と取消250 msは記録環境の受入gateであり、一般端末の保証値へ転用しない。

Node.js `22.13.0`以上`23`未満とCorepackを使用する。パッケージマネージャーはpnpm `11.19.0`で、依存バージョンは `package.json` と `pnpm-lock.yaml` に固定する。案件構造検証はAjv `8.20.0`のDraft 2020-12実装を使う。対象ブラウザと最低GPU性能は未決定であるため、現在は実行時のWebGL 2能力確認を利用可能性のゲートとし、正式な対応保証とはしない。

依存関係を初回取得するには、ネットワーク通信を別途承認した環境で次を実行する。通常のアプリ実行は外部通信を必要としない。

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm run setup:playwright:chromium
```

`setup:playwright:chromium` は固定済み `@playwright/test` のCLIからChromiumを取得する初期設定専用scriptである。ネットワーク通信とプロジェクト外browser cacheへの書込みを伴うため、実行前にそれぞれの承認を得る。通常の検証gateでは再実行しない。

検証には匿名の合成データだけを使う。実在顧客、実貨物、搬送経路、価格、資格情報を使用しない。

### Windows / Codex Local Test Setup

- 対応するNode.jsは `package.json` の `>=22.13.0 <23`、package managerはCorepack経由のpnpm `11.19.0`である。版を推測せず、`package.json` とlockfileを正とする。
- 日常の入口は `corepack pnpm run typecheck`、`lint`、`test:unit`、`test:browser`、`build` とする。ブラウザ試験runnerは自分が所有するloopback Vite serverをOS割当の空きportで起動し、その正確なURLとrunner固有の絶対output directoryをPlaywrightへ渡して終了時に同じserverだけを閉じる。並行runner間でportまたは成果物directoryを共有しない。成功時は一時directoryを削除し、試験失敗・signal終了・server cleanup失敗時はtrace、attachment、last-run、Chrome log用pathを含む固有directoryを保持して正確なpathを表示する。
- pnpm 11でscriptへ引数を渡す時は追加の `--` を挟まない。対象を絞る例は `corepack pnpm run test:browser capability.spec.ts` とする。`corepack pnpm run dev -- --port 4174` のようにすると、`--` がViteへそのまま渡り、後続optionの解釈を変えるため使用しない。
- Codexのworkspace sandboxでは、`pnpm list` や `pnpm exec` がworkspace探索、共有store、launcher解決のためproject外pathへ触れて失敗する場合がある。一方、`pnpm run` はpackage scriptが固定したrepository-local binaryをscript用PATHから起動できる。前者だけの失敗を依存欠落と断定せず、正本package scriptで再現を確認する。
- ローカルWebアプリのCodex UI観察は、in-app Browserを第一経路とする。専用serverは `corepack pnpm run dev:ui-trial` で `http://127.0.0.1:4174/` のみに起動し、`strictPort` により既存listenerがあれば別portへ迂回せず失敗する。利用後は起動したprocessだけを停止する。
- Computer UseまたはChrome制御を代替経路にするには、対応plugin・server・skillが有効で、対象appの操作承認があり、表示中で操作可能なWindows desktop sessionが必要である。これらが不足する状態は製品不具合の証拠にしない。
- 自動Playwright試験、Codex-assisted UI観察、開発チーム内の人間試用、実務利用者受入は別の証拠区分である。前段の成功を後段の合格へ読み替えない。Browserのfile chooser応答遅延や制御経路の停止も、再現可能なアプリ側不具合と切り分けるまでは製品失敗として扱わない。

## Normal Operation

開発サーバーはループバックだけで起動する。

```powershell
corepack pnpm run dev
```

人間またはCodexによる再現可能なUI試用では、通常の開発serverと区別した固定URLを使う。

```powershell
corepack pnpm run dev:ui-trial
```

このscriptは `http://127.0.0.1:4174/` を `strictPort` で使用する。port使用中なら別serverへ接続または別portへ迂回せず、起動を失敗させる。

案件名、軸別隙間、積荷、コンテナ・車両候補は入力・編集できる。入力途中の文字列は明示的な保存操作まで正規案件へ反映せず、不正入力時は直前の正規案件を保持する。入力成功は積載可能性や物理的安全性の確認を意味しない。

「端末へ保存」は現在の検証済み案件をIndexedDBの単一枠へ手動保存し、transaction完了後だけ成功を表示する。「端末保存を読込」は全候補のWorker事前判定後に案件を一括置換し、旧履歴・draft・選択・camera・判定結果をリセットする。「端末保存を削除」は確認後に保存コピーだけを削除し、画面の案件とJSONファイルは削除しない。自動保存・自動読込はない。保存中の案件commit・履歴操作、読込中に入力状態が変化した案件置換は拒否する。

これら5操作は「案件データ」から開く右側Navigation Drawerへまとめる。Drawerはモーダルとして背景のpointer、Tab移動、案件Undo/Redo shortcutを遮断し、閉じる操作またはEscapeで入口へfocusを戻す。処理中にDrawerを閉じても永続化処理は継続する。処理中と完了はDrawerを閉じた画面でもSnackbarへ操作単位で表示し、成功と取消は6秒後に消去、失敗は明示的に閉じるまで保持する。Drawer内の直近結果はlive regionにせず、同じ文の連続操作でも新しい通知として扱う。

「JSONを書き出す」は検証済み `auto-clp-project-0.1.0.json` をdownloadし、「JSONを読み込む」は標準file inputから同じ取引的読込を行う。端末保存はブラウザのサイトデータ削除・容量管理で失われ得るためバックアップではない。必要な時はJSONも書き出す。操作履歴、未保存入力、選択、camera、判定結果はどちらにも保存しない。

以下は現在検証対象となる独立コマンドである。それぞれを別に実行し、結果と終了コードを記録する。

```powershell
corepack pnpm run typecheck
```

```powershell
corepack pnpm run lint
```

```powershell
corepack pnpm run test:unit
```

```powershell
corepack pnpm run test:browser
```

```powershell
corepack pnpm run build
```

```powershell
& .\scripts\check-data-contract.ps1 -ProjectPath $PWD.Path
```

案件JSON Schemaが解析でき、スキーマ版、値域、個数上限、向き列挙、データ契約、ADRが承認値と一致することを検証する。

```powershell
& .\scripts\render-governance.ps1 -ProjectPath $PWD.Path -Check
```

管理済み `AGENTS.md` が共通契約と一致することを検証する。

```powershell
& .\scripts\check-governance.ps1 -ProjectPath $PWD.Path
```

共通契約、レンダラー、検証スクリプトのハッシュ、生成済み `AGENTS.md`、サイズ、プロジェクト規則を検証する。

```powershell
& .\scripts\check-project.ps1 -ProjectPath $PWD.Path
```

必須文書、相対リンク、索引網羅性、ロードマップ計算、ADR状態、TOMLの必須構造、エージェント権限を検証する。

まとめる場合は、どれか一つでも失敗すれば非ゼロで終了する検証済みランナーだけを使う。`;` など状態を隠す連結や診断バッチを、完了、引き継ぎ、コミット、統合、リリースの証拠として使わない。

## Git Integration

- 全タスクは `C:\Users\seven\projects\auto-clp` を使う。
- タスク固有Worktreeまたは別コピーは、理由、パス、ブランチ、担当、統合方法、存続期間、後片付けをユーザーが事前承認しない限り禁止する。
- 承認のない別Worktreeを発見した場合は保存し、そこでの状態変更を止め、削除せずユーザーへ確認する。
- 委任タスクは担当ファイルを編集・検証した後、正確なファイル、差分、テスト、未検証事項、承認境界、作業ツリー状態を報告して停止する。
- コーディネーターは受入対象だけを確認・ステージ・コミットし、統合する。委任タスクに既存コミットがある場合は、確認後に再利用する。
- 無関係なユーザー変更をステージ、コミット、破棄しない。
- プッシュ、公開、履歴書き換えは別の明示承認を要する。

## Project Management Task Loop

長期調整、checkpoint、callback、Git統合、task交代の実行手順は[プロジェクト調整runbook](runbooks/project-coordination.md)を正とする。一時task ID、host、baseline、pending checkpoint、所有権状態は[handoff index](handoffs/README.md)配下の最新記録を読む。製品仕様や恒久runbookへ一時IDを固定しない。

## Governance Updates and Task Turnover

- Managed common-governance version: 1.4.0
- 管理対象はプロジェクト内で直接編集せず、承認後にスキルの `sync-project-governance.ps1 -Apply` で同期する。
- 既存プロジェクト移行時は全規則を棚卸しし、未対応項目ゼロを要求する。1.4.0移行のinventoryは最新handoff recordへ記録する。
- 共通契約、ルート `AGENTS.md`、全体権限・承認方針、調整責任、委任・Git統合、コールバック・引き継ぎ、安全境界の変更は全アクティブタスクの交代を要する。
- 役割固有設定の変更は、その役割とコーディネーターの確認を要する。
- 交代前に安全なチェックポイントを作り、担当作業を検証・コミットし、作業ツリーをクリーンにする。例外はファイル、目的、検証、理由、所有者、再開手順を記録する。
- 新しいタスクはフォークせず、同じ基本名に連番を付ける。共通版、指示源、権限、再開状態、変更なしコールバック、割当先IDを検証してから旧タスクの所有権を終了する。
- コーディネーター交代にはユーザー承認が必要。旧タスクはCodexがアーカイブ・削除せず、ユーザーへ手動削除可能と案内する。

## Coordinator Session Lifecycle

`容量チェック`、`タスク容量確認`、`セッション容量確認`、`session size / handoff threshold確認` は[プロジェクト調整runbook](runbooks/project-coordination.md)へ経路指定する。これらはモデルtoken/context容量ではなく、現在taskの永続session JSONL容量を意味する。

- 信頼できる現在task IDを `scripts/check-codex-session-size.ps1 -SessionId <current-task-id>` へ明示し、ちょうど1件のsessionを測定する。最新または最終更新sessionを推測しない。
- 個別sessionの引き継ぎ提案基準は300 MiB。Codex全体10 GiBは別の参考警告であり、個別task交代の判断に使わない。
- 使用率、`handoff_required`、Codex全体容量、scan完全性/error数、各計測時刻/source、コマンド結果、独立した終了コードを報告する。session本文は読まず表示しない。
- task ID不明、0/複数一致、script失敗では推測せず停止する。全体scan不完全時は全体容量をcleanupまたは閾値判断に使わない。
- 長期作業開始時、callbackによる状態変更後、停止・完了時に計測する。状態変化がない反復測定は1時間に1回以下とする。

## Outputs

- 現在の成果物は本リポジトリ内の文書、設定、ローカルWebアプリ、入力編集UIである。
- 案件データの機械可読な設計契約は `schemas/project-0.1.0.schema.json`、意味契約は `docs/data-model.md` である。構造・意味検証、検証済み書出し、取引的読込、手動の端末保存・確認削除、JSONファイル入出力、全候補Worker事前判定、案件・隙間・積荷・候補の入力編集UIは実装済みである。
- アプリのビルド出力は `dist/` であり、Git管理対象外とする。
- 現在のビルドはJavaScript chunkがViteの500 kB推奨値を超える警告を出す。現チェックポイントのゲートではないが、Phase 1の利用者受入または公開検討前の性能チェックポイントで分割と初期読込性能を再評価する。
- 成功は、要求された成果物、仕様・ロードマップ・ADR・変更履歴の整合、独立した必須検証の成功、残リスクの報告で確認する。

## Errors and Recovery

- 管理ハッシュまたは生成 `AGENTS.md` の不一致: 直接修正せず、承認済みスキル同期を再実行する。
- 文書検証失敗: 該当リンク、索引、進捗、ADR、TOMLを修正し、失敗したコマンドだけでなく全必須検証を再実行する。
- JSON・端末読込失敗: サイズ、読取、構文、版、スキーマ、意味、全候補Worker判定、非同期競合のどの失敗でも現在案件、履歴、未保存入力を保持する。固定codeから理由を表示し、ファイル名、入力値、全文をエラーやログへ出さない。
- 端末保存失敗: 未対応、open、blocked、read、write、delete、abort、容量不足相当を成功と表示しない。save/delete/exportは副作用完了後にstale失敗へ置き換えず、永続化中のProject commitを中央で拒否する。
- UI入力失敗: 入力途中の文字列と確定済み案件を分離し、固定code/pathから修正可能な理由を表示する。失敗時は確定済み案件を同一参照で保持し、入力値をエラーやログへ反射しない。
- 3D非対応・描画障害: WebGL 2能力確認の非対応表示を確認する。対応判定後のThree.js初期化失敗、描画例外、WebGLコンテキスト喪失も別の失敗状態として表示し、空画面や停止画面を成功扱いしない。
- コールバック・タスク状態取得失敗: 同じ割当を重複送信せず、安全な復旧を1回試み、再開条件をユーザーへ報告する。

## Backup and Retention

- ソースと文書の履歴はGitで保持する。
- 案件データは初期版では利用者のブラウザ内IndexedDB単一枠または利用者が書き出したJSONだけに保存される。自動クラウドバックアップ、自動保存、起動時自動読込はない。
- IndexedDBコピーは明示削除まで保持を試み、自動期限を設けない。ただしサイトデータ削除、容量管理、private mode等で失われ得る。削除は画面の案件やJSONを消さない確認付き操作とする。
- 実務利用前に端末保存・再読込とJSON書出し・再読込を匿名代表データで確認する。

## Sensitive Information

秘密情報、資格情報、セッションデータ、個人情報、実在顧客の貨物・価格・搬送記録をリポジトリ、テスト、ログ、プロンプトへ保存しない。公開可能な匿名合成データだけを利用する。
