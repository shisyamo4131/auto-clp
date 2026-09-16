# Operations

## Current Availability

- Implemented scene workspace 1.10.2: Application Bar右端menu、3D欄外上部の一行scroll tab、cargo-global side-relative荷室外anchor、コンテナ間共有camera、`整数 mm` だけをcompactな外向き矢印で示す選択積荷の3軸寸法annotation、重量付きselectorと4状態dot、selector直下の固定context action rowと `現在の座標` copy、icon-only判定lampとdialog、Drawerから開く独立 `操作方法` dialog、版付き「使用上の重要事項」を実装した。コンテナ0件ではviewport中央の案内から既存のコンテナ追加dialogを開き、テンプレートインポートだけを理由付きで無効にする。操作方法dialogはCLP・履歴・保存・camera・判定を変更せず、左drag回転、Shift付き左drag・右drag・Ctrl付き左drag平行移動、wheel zoom、荷室外積荷の寄せを案内する。下段固定UIは実測safe areaでcanvas/pointer領域と分離する。単独支持共通の積荷別未確認理由は生成せず、複数支持・隙間・張り出し等の配置固有未確認を維持する。

- Implemented viewer-first shell: Application Barにmenu、現在CLP名、小さな3D能力Chipを置き、CLP作成・設定、積荷追加・制約一括編集・一括登録、コンテナ管理、保存、読込、ヘルプを単一Navigation Drawerへ集約する。積荷cardとコンテナcardは通常画面に置かず、既存editor、履歴、busy/dirty gate、件数上限、非cascade削除を再利用する。Drawer外の背景相当領域、全幅close button、EscapeはDrawerだけを閉じ、背面操作を発火させずpage scrollを維持してmenuへfocusを戻す。CLP設定はdialog、コンテナtablistは3D viewport欄外上部、全CLP積荷の名前/ID検索・状態付きselectorはviewport下部overlayとし、3Dの寸法と位置を動かさない。未保存変更付きの新規CLPは破棄確認後、UUID付きの新 `projectId` と空履歴を作るbarrierとし、CLP設定dialogを開く。

- Implemented: Gitリポジトリ、ガバナンス、仕様、ロードマップ、ADR、CLP JSON Schema `0.1.0`、完全なreadonly CLP型、構造・意味検証、検証済みJSON書出し、派生計算成功後だけ置換する取引的読込基盤、IndexedDB単一手動枠の端末保存・読込・確認削除、固定名JSONファイル入出力、保存Navigation Drawerと操作単位のSnackbar、全候補の置換前Worker判定、CLP・隙間・積荷・候補の取引的な入力編集UI、配置追加・整数mm移動・許可向き変更・取り外しの原子的フォーム、viewport内のcompactな単一CLP履歴、重量付き全積荷picker・4状態dot・固定context action row、成功したCLP変更を最大100件保持する非永続undo/redo、コンテナ包含・XY正面積重なり・正体積AABB重なり・隙間込み境界・非支持ペア軸別隙間・矩形開口寸法と許可向き抽出・支持面XY矩形和集合100%被覆・床と完全一致Z接触と段積み可の支持合成の純粋geometry基盤、safe integer総質量・耐荷重評価、対象コンテナの境界・重なり・隙間・開口・支持・耐荷重を独立理由付きで集約する純粋判定、ローカルWorkerによる非同期評価と25件理由ページ、利用者向け物理状態・対象・関連積荷・理由・判定不能表示、ローカルWebアプリ骨格、WebGL 2能力確認、候補tab、ProjectからThree非依存scene値への一方向投影、コンテナ内部・中央開口・登録済み配置と荷室外作業スペースのThree.js描画、canvas積荷選択、fine pointerによる未配置積荷の自由な荷室外移動・初回配置と配置済み床面方向drag・完全drag-out削除、許可済みX/Z軸90°回転、天地無用入力補助、未配置積荷の近接grid再整列、viewport wheel zoom、Ctrl付き左drag pan、共有camera、touch/coarse pointerでの選択と縦scroll・フォームfallback、型・lint・単体・ブラウザ・ビルド検証。
- Implemented support refinement: fine pointer dragの床・支持可能上面へのZ snap、単一支持面内のX/Y clamp、条件未確認・不適合preview、操作対象以外のほぼ透明な中立面と灰色点線、緑・黄点線による支持候補強調、単独支持・複数支持・隙間・張り出し・支持可否混在・接触不成立の派生判定。旧XY和集合100% helperは回帰用に保持するが、現行の支持区分には使用しない。
- Implemented rotation-toolbar refinement: X/Z回転は寄せ・Undo/Redo・全体表示と同じviewport固定toolbarへ常設する。一本の軸線へ矢印が回り込む同一SVGをXだけ90度回して区別し、未選択・天地無用のX軸・busyではfocus可能な理由付き `aria-disabled` とする。Z軸床面回転は常に許可し、使用可は他の利用可能buttonと同じ青緑の強調枠、使用不可は低彩度の枠・iconで区別する。紫色の塗り分けは使わず、回転前後でbutton位置は変えない。
- Implemented weight-balance visualization: 仕様1.10.0・ADR 0039に従い、選択中コンテナの内寸中央を赤、同コンテナの配置済み積荷の重量付き合成重心を黄の10 CSS px・白い外枠なし・非操作ドットとして3D viewportへ表示し、同径・白い外枠なしの凡例を併設する。黄色を赤より前面にし、二点の画面投影中心が一致する時は座標をずらさず黄色が赤を完全に覆うことを許容し、近接時も各投影中心を保って重複部分では黄色を前面にする。重心が画面外ならclampまたはcamera自動変更をせず `現在重心は画面外` と示す。凡例下部には選択中コンテナの総重量／耐荷重と、全CLPの積込済数／全積荷数を表示する。`no-container`、`empty`、`available`、`unavailable` の状態ごとに両点と非数値statusを再導出して古い表示を残さない。コンテナ自重、数値差、許容範囲、合否、物理判定理由は扱わず、保存済みProjectから確定後に再計算し、JSON・端末保存・履歴へ保存しない。使用上の重要事項は内容版1.2.0のままである。人間による差分視認性確認は未実施である。
- Current CSV cargo replacement: 仕様1.8.0・ADR 0034・0036・0037のExcel向け固定CSVテンプレート、手動・CSV共通の新規作成上限30件、上乗せ禁止OFF・天地無用OFFの新規既定、全recordの一時検証、破棄・保持範囲を示す確認、積荷全置換・配置全解除、一回のUndo/Redo、legacy 31〜1,000件互換は実装済みである。Schema `0.1.0`、既存JSON・端末保存、配置上限1,000件は変更しない。Windows版Excel往復は未実施の人間確認である。
- Implemented cargo constraint batch editor: Drawerから全積荷の「天地無用」と「上乗せ禁止」だけを一覧編集し、一回の `cargo.constraints-update` 履歴として適用する。個別editorも「上乗せ禁止」へ統一し、ONを既存 `canSupportCargo=false` へ反転する。現在配置は自動変更せず、物理判定を再計算する。Schema `0.1.0` とCSV 5列は変更しない。
- Retained future technical assets: ADR 0004に基づく決定的DFS、Worker transport、session/view、React hook/panel、preview・適用境界、単体試験、AP-01〜08と `automatic-proposal-v2` の性能証拠を保持する。Phase 1の通常画面ではpanel、開始、取消、適用入口を提供せず、通常起動で自動提案Workerを開始しない。これらは現行利用可能機能、一般端末SLA、最低GPU、実務受入または安全保証ではない。
- Unavailable: 自動配置提案の通常UI、端末保存の自動保存・起動時自動読込・複数枠・自動期限、canvas上の自由な連続Z移動・取り外し、touch drag、積荷画像、デプロイ、クラウド保存、外部API、実運用サポート。

未実装機能を利用可能として案内してはならない。

包含・重なり・隙間込み境界・非支持ペア軸別隙間・単独支持・支持条件未確認・支持接触不成立の低レベルgeometry基盤と、同一コンテナの対象抽出、参照解決、支持隙間例外、対象ID、理由コード、集約状態を返す純粋判定は実装済みである。床を下へ越える配置は専用 `floor-penetration` を先頭理由とし、他面だけの境界外 `outside-container` と区別する。判定はローカルmodule Workerでメインスレッド外に実行し、集約状態と件数を先に、理由を不適合・未確認ごとに25件ずつ表示する。コンテナやCLPが変わった場合は旧Workerを終了して旧結果を表示せず、Worker障害時は物理的不適合と混同せず判定不能と再試行を表示する。

矩形開口のY・Z断面判定、許可向き抽出、どの許可向きでも寸法上通らない場合の不適合理由・対象ID・集約とUI表示は実装済みである。寸法上通る場合は積荷ごとの理由を生成せず、完全な搬入経路を保証しない範囲を恒常的な注意で示す。

総質量・耐荷重の数学評価と、対象コンテナの配置・積荷参照を解決して超過理由・対象IDを付ける高位判定とUI表示は実装済みである。積荷合成重心の参考可視化も実装済みであり、物理合否とは独立して表示する。積荷別上載荷重、荷重分布、コンテナ自重、実貨物の偏心、支持反力、軸重、床強度は評価しない。

ADR 0011で、軸別隙間を隣接表面間の実距離として扱い、配置後は開口面・奥壁・Y両側壁・天井へ各設定値、床・支持面へ0 mmを要求する意味を確定した。積荷間では設定値を2倍にせず、非支持ペアはいずれか一つの分離軸で必要距離を満たせばよい。低レベル判定に加えて支持関係の識別・例外、対象ID、理由コード、集約、UI表示も実装済みである。

Phase 1は、完全な搬入経路、積荷別上載荷重、実貨物の偏心、コンテナ自重、支持反力、軸重、床荷重、荷崩れ、固縛、動荷重を評価・保証しない。承認済みの合成重心は、入力重量と直方体中央の仮定による赤・黄点の参考可視化だけとし、数値、許容範囲、合否または実積載の安全性を示さない。完全な搬入経路は具体的な要望と入力契約が確定するまで積荷ごとの未確認理由にせず、恒常的な範囲説明だけを維持する。その他は実装済みの支持判定で必要な場合だけ未確認理由として区別する。

配置座標はADR 0010のコンテナ局所右手座標を使い、`positionMm` は向き適用後の積荷直方体の最小角とする。正規値は整数mmを維持し、描画用中心、scene縮尺、camera、候補・積荷選択、荷室外の作業位置をCLPへ保存しない。Project→scene投影、フォーム配置、canvas選択、fine pointerのX/Y dragと床・支持可能上面への決定的Z snap、許可済みX/Z軸90°回転、視点回転・平行移動、wheel zoom、荷室基準の「荷室全体を表示」、向きを保持してcamera位置・注視点・視点方向・縮尺を変えない未配置積荷の近接grid再整列を実装済みである。移動開始時に支持可の単一積荷へ完全支持される子孫は、3D dragと座標dialogの平行移動で再帰的に同じ差分だけ連動し、一回の履歴でUndo/Redoする。回転、複数支持、張り出し、支持不可接触は連動せず、子孫がある下段の荷室外移動・配置解除は先に上段を外すよう拒否する。viewport上のwheelはcamera zoomへ使い、Ctrl付き左dragは積荷上でもcamera panを優先する。寄せ、camera、荷室外poseはsession限定でUndo/Redo・保存対象外である。

CLP全体で未配置の積荷だけを初回は先頭許可向き・Z=0の決定的な暖色gridへ派生し、他候補へ配置済みなら重複表示しない。grid間隔は各積荷の許可向き全体から得る最大X/Y footprintで固定し、一つを回転しても他の未配置積荷を動かさない。利用者が積荷全体を荷室外へdropした後はcargo IDごとの位置と向きをUI sessionだけに保持する。外側移動と回転はProject、物理判定、CLP履歴、保存へ含めない。fine-pointer dragは量子化後のno-opを先に除き、X/Y footprintを完全包含・正面積partial・面積0 outsideへ分類する。完全包含またはpartialでは、支持可能面がなければ床、あれば最も高い支持可能上面へZをsnapし、単一面が底面を収容できる場合だけX/Yをその面内へ制限する。未配置と配置済みの双方でsnap後位置を一回の配置追加・更新として保存し、partial・条件未確認・不適合も修正途中として再判定する。outsideは未配置ならsession poseだけ、配置済みなら一回の `placement.delete` とsession poseにする。Undoは元配置、Redoは同じ外側poseを表示する。

Z軸回転は高さ軸を保つ相手を使い、積荷選択中かつbusyでなければ常に有効とする。X軸回転はY/Z割当を交換し、天地無用OFFだけ有効とする。積荷editorは天地無用だけを表示し、ONを `LWH` / `WLH`、OFFを全6向きへ写像する。旧保存の部分集合は読込preflight後に同じ2状態へ正規化する。面の表裏は識別しない。配置済み回転は最小X/Y/Z角を保持した一回の配置更新、荷室外回転は回転後も荷室床面との正面積重なりが0の場合だけsession変更とする。重なる回転は直前poseを保持して拒否し、積荷編集で既存poseが重なる場合は新寸法の決定的外側gridへ戻す。cameraのfarと最大移動距離は全投影範囲への到達余地を保ち、同一候補のProject更新では現在cameraと注視点を復元する。touch/coarse pointerは積荷選択だけを行い、正確な配置・移動・向きにはキーボード操作可能なフォームを使う。canvas上のZ移動は未実装である。

CLP全体のUndo/Redoはviewport内で `＋` / `－` と同じ外観の単一操作UIとし、buttonと既存shortcutを同じ履歴handlerへ接続する。実行前後のpage scroll位置を復元する。WebGL 2非対応または描画障害時は履歴を含むCLP操作を停止する。選択積荷はscene上の`整数 mm`だけの3軸寸法annotationとselector直下の固定context action rowで示し、軸の非視覚同値を下段に維持する。積荷selectは全Project積荷を検索し、現在候補、未配置、他候補を示す。他候補の配置を扱う前に所有候補へ明示切替する。積荷定義と配置は別modal editorで編集し、focus trap、背景inert、dirty破棄確認、内部scroll、狭幅、preventScroll focus復帰を維持する。dialog中は履歴、3D操作、候補切替、永続化をbusyとして拒否する。配置取り外しと積荷削除は別確認・別履歴でcascadeしない。物理理由はicon-only lampから開くdialogへ表示し、状態名と件数はaccessible nameとtitleに保持する。

CLP履歴は、CLP設定、積荷、候補、配置の成功した追加・更新・削除と、1回のcanvas dragを一つの操作として最大100件保持する。「元に戻す」「やり直す」ボタンに加え、Windows/Linuxでは `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y`、macOSでは `Command+Z` / `Command+Shift+Z` を利用できる。未保存入力、削除確認、drag中は履歴操作を無効にし、入力欄、選択欄、編集可能領域、独自入力コンポーネントのローカル履歴を優先する。失敗とno-opは履歴を変えず、undo後の新しい確定操作はredoを破棄する。履歴はメモリ内だけで、再読込、JSON書出し、端末保存には含めない。

新規CLP、端末読込、JSON読込はUndo対象ではなく、成功時に旧の過去・未来履歴、draft、選択、camera、drag preview、Worker結果を破棄するbarrierである。新規CLPは最後の端末保存またはJSON書出し以後の変更がある場合に破棄確認し、作成直後の空CLPを新しい保存基準とする。Drawerから設定dialogへ移った後は、Application BarのCLP名またはmenuへfocusを戻す。

## Preparation

Phase 1の技術受入には `acceptance.md` の匿名合成データだけを使う。自動試験と開発チーム内試用は実務利用者受入と区別し、実務試用が未実施の間は受入済みと報告しない。

自動提案の純粋domain探索、Worker transport、session/view、React panel、busy・generation配線、preview DOM、確認付き一括適用と一回のUndo/Redoは将来再開用の検証済み技術資産として保持する。Phase 1の通常UIからは接続を外し、通常起動でWorkerを開始しない。再公開する場合は、探索開始だけでProjectを変更せず、preview、取消、cutoff、完全案なし、失敗、stale、積荷なし、候補なしでは現在CLPと履歴を保持する既存契約を現行仕様へ再統合し、全回帰と人間試用をやり直す。探索上限到達と完全案なしを実積載不能または安全性の証明として案内してはならない。

将来技術資産であるAP-08のbrowser試験は `automatic-proposal-performance.future.ts` に非実行snapshotとして保持する。現行の通常Playwright suiteは `.future.ts` を収集せず、固定の非公開gate下ではpanelもmountしないため、現時点でこのsnapshotを再実行できるとは扱わない。再公開checkpointでpanelとWorker lifecycleを専用harnessまたは現行shellへ再接続し、収集可能な専用設定、通常suiteからの分離、匿名の固定20積荷fixture、cold 1回・warm 3回、決定的result hash、browser clock、main timer/rAF、native取消、console、実行環境を再検証してから新しい証拠を記録する。過去の5秒・250 ms値は記録環境の履歴的技術証拠であり、現行UIの受入または一般端末の保証値へ転用しない。

Node.js `22.13.0`以上`23`未満とCorepackを使用する。パッケージマネージャーはpnpm `11.19.0`で、依存バージョンは `package.json` と `pnpm-lock.yaml` に固定する。CLP構造検証はAjv `8.20.0`のDraft 2020-12実装を使う。対象ブラウザと最低GPU性能は未決定であるため、実行時のWebGL 2能力確認と初回Three.js描画成功を必須利用ゲートとし、正式な対応保証とはしない。

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

### GitHub Pages Technical Preview

公開先は `https://shisyamo4131.github.io/auto-clp/` とする。`.github/workflows/deploy-pages.yml` は `main`へのpushまたは手動実行でNode.js 22、Corepack、lockfile固定のpnpmを使い、`AUTO_CLP_BASE_PATH=/<repository>/` を指定して `dist/` を生成・配信する。Actions sourceはGitHub repositoryのSettings > PagesでGitHub Actionsを選ぶ。

公開前は総合9ゲートを対象commitで完了し、追加でPages用base pathを指定したbuildの `index.html` が `/<repository>/assets/` を参照することを確認する。公開後はActionsの成功と対象commitを確認し、実HTTPS URLで初期表示、WebGL 2、Drawer、積荷・コンテナ操作、CSV template download/import、JSON download/import、端末保存・再読込を匿名合成データだけで試用する。localhostの端末保存は公開originへ移らないため、必要ならlocalhostでJSONへ保存し、公開版で明示的にJSONから読み込む。

公開停止はGitHub Pagesをunpublishし、workflowを無効化または削除する。repositoryやCLPデータを削除する必要はない。公開済み内容が第三者cacheまたはcopyへ残らないことまでは保証しない。GitHub、Googleその他のpassword、2FA、recovery code、個人access tokenを文書、repository、Actions secretへ保存しない。

この公開はアカウント、課金、クラウド保存を持たない技術試用である。第三者利用者の募集、実在CLP、課金または本番運用の前に、利用規約、privacy、運用責任、認証、backend、決済webhookと権限管理を別checkpointで承認する。Firebaseはその時点の要件と公式料金で再評価し、現行Pages採用だけを理由に採用または除外しない。

CLP名、軸別隙間、積荷、コンテナは入力・編集できる。車両はPhase 1の対象外である。入力途中の文字列は明示的な保存操作まで正規CLPへ反映せず、不正入力時は直前の正規CLPを保持する。入力成功は積載可能性や物理的安全性の確認を意味しない。

「端末へ保存」は現在の検証済みCLPをIndexedDBの単一枠へ手動保存し、transaction完了後だけ成功を表示する。「端末から読込」は全候補のWorker事前判定後にCLPを一括置換し、旧履歴・draft・選択・camera・判定結果をリセットする。「端末保存を削除」は確認後に保存コピーだけを削除し、画面のCLPとJSONファイルは削除しない。自動保存・自動読込はない。保存中のCLPcommit・履歴操作、読込中に入力状態が変化したCLP置換は拒否する。

CLP作成・設定、積荷追加・制約一括編集・一括登録、コンテナの追加・編集・削除、保存、読込、ヘルプは右側Navigation Drawerへまとめる。CLP欄は `新規`・`設定` を横並びにし、その下へ `積荷追加`、`制約一括編集` を一段ずつ置く。積荷一括登録欄は `テンプレートダウンロード` と `テンプレートインポート` を縦並び、コンテナ欄は `追加`・`編集`・`削除` を横並び、保存欄は `端末へ保存`・`JSONへ保存`、読込欄は `端末から読込`・`JSONから読込` を横並びにする。端末保存削除、直近結果、単一端末保存の注意は保存欄内に置く。可視のDrawerタイトル、積荷件数、自動保存説明、旧 `このブラウザ内`・`JSONファイル` 区分は表示しない。Drawer最下部ではpackageのAuto CLPアプリ版と、現在対応するCLPデータ形式版を確認できる。Drawerはモーダルとして背景のpointer、Tab移動、CLPUndo/Redo shortcutを遮断し、全幅close button、Escape、Drawer外の背景相当領域clickでDrawerだけを閉じて入口へfocusを戻す。同じclickで背面controlを作動させず、page scrollを変えない。積荷追加とコンテナ管理はDrawerを閉じて既存のmodal editorを開く。編集・削除は3Dで選択中のコンテナを対象とし、配置参照中の削除は先に積荷を外すよう理由付きで拒否する。処理中にDrawerを閉じても永続化処理は継続する。処理中と完了はDrawerを閉じた画面でもSnackbarへ操作単位で表示し、成功と取消は6秒後に消去、失敗は明示的に閉じるまで保持する。Drawer内の直近結果はlive regionにせず、同じ文の連続操作でも新しい通知として扱う。

Drawerから固定名 `auto-clp-cargo-template.csv` を取得し、Excelで名前・長さmm・幅mm・高さmm・重量kgだけを編集できる。一括登録は全record検証後に、新規件数、既存積荷・配置の破棄、CLP名・隙間・コンテナの保持、端末保存の非自動更新を確認し、確定時だけ積荷と配置を一回の履歴操作で置換する。取消または失敗では現在CLPを変更しない。CSVはCLP全体のbackupではなく、コンテナ、隙間、配置またはCLP名を持ち運ばない。template download、CSV読込、確認、Undo/Redoは利用可能であるが、Windows版Excelでの往復確認は未実施である。

通常のデスクトップ高では、Application Shellをbrowser viewport高に合わせ、上下padding、Application Barと余白、コンテナtabを除いた残りを3D viewportへ割り当てる。短い画面では操作overlayを失わない最低高を優先してpage scrollを許す。通常時の一般案内帯は表示せず、drag、回転不可、失敗などの操作statusだけをviewport内へ浮動表示し、canvasの寸法とpage位置を変更しない。

「JSONへ保存」は検証済み `auto-clp-project-0.1.0.json` をdownloadし、「JSONから読込」は標準file inputから同じ取引的読込を行う。端末保存はブラウザのサイトデータ削除・容量管理で失われ得るためバックアップではない。必要な時はJSONも書き出す。操作履歴、未保存入力、選択、camera、判定結果はどちらにも保存しない。

## Verification Matrix

機械可読な正本は [`governance/verification-policy.json`](../governance/verification-policy.json) である。変更前に該当するclassをすべて選び、mixed changeではstageごとのgate IDの和集合を取る。影響範囲を限定できない場合は `unknownImpactGateIds` のcomprehensive fallbackを使う。既知の全コマンドを無条件に毎回実行しない。

| Change class | Trigger | Iteration | Targeted regression | Completion | Release-only | Completionで省略できるgate |
| --- | --- | --- | --- | --- | --- | --- |
| `documentation-only` | 製品・データ・ガバナンス・コマンドの意味を変えないproject-owned文書、索引、link、記録 | `diff-check` | `project-check` | `diff-check`, `project-check` | なし | type/lint/unit/browser/build/data/renderer/governance |
| `ui-css-layout` | CSS、layout、accessibility、利用者copy、非domain JSX、browser UI test | `diff-check`, `typecheck`, `lint` | unit, browser, data-contract | diff, type, lint, unit, browser, build, data-contract | なし | renderer, governance, project |
| `application-logic` | Schema・migrationを変えないdomain/application/persistence/worker/runtime logic | diff, type, lint, unit | unit, browser, data-contract | diff, type, lint, unit, browser, build, data-contract | なし | renderer, governance, project |
| `data-contract-schema-migration` | Schema、serializer、import/export、data-model意味、version、migration、compatibility | diff, type, unit, data-contract | lint, unit, browser, data-contract, governance, project | comprehensive | なし | なし |
| `project-guidance-metadata` | 権限・安全・承認・製品・データ・lifecycleの意味を変えない案内経路・command所在・環境metadata | diff, project | governance, project | diff, governance, project | なし | type, lint, unit, browser, build, data-contract |
| `governance-permissions-agents` | common/project governance、policy/matrix、AGENTS、managed scripts、権限、agent、approval、task lifecycle | diff, governance, project | governance, project | comprehensive | なし | なし |
| `build-release-deploy` | package/lock、Vite/Playwright/build設定、release evidence、publish/deploy手順 | type, lint | type, lint, unit, browser, build | comprehensive | 現在なし | なし |

製品仕様またはデータ意味を変える文書は `documentation-only` だけに分類せず、該当classとの和集合を使う。UI/applicationのcompletionは、現行仕様が要求するtypecheck、lint、unit、browser、buildを維持する。data、governance、build/release/deployおよびunknown impactのcompletionはcomprehensiveとする。GitHub Pages公開は総合gate、Pages用build、Actions成功、実URL確認をrelease evidenceとし、release-only gateが空であることだけを公開可否の根拠にしない。

省略したgateは、completion reportへgate IDと影響がない理由を記録する。release判断が将来承認された場合は、release evidenceへ追加gateと結果を記録する。

<!-- BEGIN GENERATED VERIFICATION POLICY SUMMARY -->
- Root: schemaVersion=1.0; comprehensiveGateIds=[diff-check,typecheck,lint,unit-tests,browser-tests,build,data-contract-check,governance-check,project-check]; unknownImpactGateIds=[diff-check,typecheck,lint,unit-tests,browser-tests,build,data-contract-check,governance-check,project-check]
- RuntimeProfile: id=windows-pwsh7; platform=windows; edition=Core; executable=pwsh; versionRule=minimum-major=7; required=True; supportStatus=supported
- RuntimeProfile: id=windows-powershell51; platform=windows; edition=Desktop; executable=powershell; versionRule=major-minor=5.1; required=False; supportStatus=unverified
- Class: id=documentation-only; triggers=[Project-owned prose\, index\, link\, or record changes without product\, data\, governance\, command\, or release semantics\; use the union with another class when meaning changes]; iterationGateIds=[diff-check]; targetedRegressionGateIds=[project-check]; completionGateIds=[diff-check,project-check]; releaseOnlyGateIds=[]; omittableGateIds=[typecheck,lint,unit-tests,browser-tests,build,data-contract-check,renderer-check,governance-check]; omissionRecord=Completion report with each omitted gate ID and no-impact reason
- Class: id=ui-css-layout; triggers=[CSS\, layout\, accessibility\, user copy\, non-domain JSX\, or browser UI tests\; use the union with application or data classes when behavior or data meaning changes]; iterationGateIds=[diff-check,typecheck,lint]; targetedRegressionGateIds=[unit-tests,browser-tests,data-contract-check]; completionGateIds=[diff-check,typecheck,lint,unit-tests,browser-tests,build,data-contract-check]; releaseOnlyGateIds=[]; omittableGateIds=[renderer-check,governance-check,project-check]; omissionRecord=Completion report with each omitted gate ID and no-impact reason
- Class: id=application-logic; triggers=[TypeScript or TSX domain\, application\, persistence\, worker\, or runtime logic without Schema or migration semantics]; iterationGateIds=[diff-check,typecheck,lint,unit-tests]; targetedRegressionGateIds=[unit-tests,browser-tests,data-contract-check]; completionGateIds=[diff-check,typecheck,lint,unit-tests,browser-tests,build,data-contract-check]; releaseOnlyGateIds=[]; omittableGateIds=[renderer-check,governance-check,project-check]; omissionRecord=Completion report with each omitted gate ID and no-impact reason
- Class: id=data-contract-schema-migration; triggers=[Schema\, serialization\, import or export\, data-model meaning\, version\, migration\, or compatibility semantics]; iterationGateIds=[diff-check,typecheck,unit-tests,data-contract-check]; targetedRegressionGateIds=[lint,unit-tests,browser-tests,data-contract-check,governance-check,project-check]; completionGateIds=[diff-check,typecheck,lint,unit-tests,browser-tests,build,data-contract-check,governance-check,project-check]; releaseOnlyGateIds=[]; omittableGateIds=[]; omissionRecord=Completion report and data or migration evidence
- Class: id=project-guidance-metadata; triggers=[Project-owned routing\, command-location or environment guidance with no change to product\, data\, permissions\, safety\, approval or lifecycle meaning\; changed governance or verification semantics also select governance-permissions-agents]; iterationGateIds=[diff-check,project-check]; targetedRegressionGateIds=[governance-check,project-check]; completionGateIds=[diff-check,governance-check,project-check]; releaseOnlyGateIds=[]; omittableGateIds=[typecheck,lint,unit-tests,browser-tests,build,data-contract-check]; omissionRecord=Completion report with each omitted gate ID and bounded no-product-impact reason
- Class: id=governance-permissions-agents; triggers=[Common or project governance\, verification policy or matrix\, AGENTS\, managed lock or scripts\, permissions\, agents\, approvals\, or task lifecycle]; iterationGateIds=[diff-check,governance-check,project-check]; targetedRegressionGateIds=[governance-check,project-check]; completionGateIds=[diff-check,typecheck,lint,unit-tests,browser-tests,build,data-contract-check,governance-check,project-check]; releaseOnlyGateIds=[]; omittableGateIds=[]; omissionRecord=Completion report and affected operations
- Class: id=build-release-deploy; triggers=[Package or lock files\, Vite or Playwright build configuration\, release evidence\, publication\, or deploy procedure]; iterationGateIds=[typecheck,lint]; targetedRegressionGateIds=[typecheck,lint,unit-tests,browser-tests,build]; completionGateIds=[diff-check,typecheck,lint,unit-tests,browser-tests,build,data-contract-check,governance-check,project-check]; releaseOnlyGateIds=[]; omittableGateIds=[]; omissionRecord=Completion report or authorized release evidence
- Gate: id=diff-check; command=git diff --check; stages=[iteration,targeted,completion]; includes=[]; invalidatedBy=[Any later worktree edit]; evidenceDestination=Completion callback or commit evidence
- Gate: id=typecheck; command=corepack pnpm run typecheck; stages=[iteration,targeted,completion]; includes=[]; invalidatedBy=[TypeScript\, TSX\, declarations\, tsconfig\, package\, lock\, dependency\, or toolchain change]; evidenceDestination=Completion callback or commit evidence
- Gate: id=lint; command=corepack pnpm run lint; stages=[iteration,targeted,completion]; includes=[]; invalidatedBy=[Source\, test\, ESLint configuration\, package\, lock\, dependency\, or toolchain change]; evidenceDestination=Completion callback or commit evidence
- Gate: id=unit-tests; command=corepack pnpm run test:unit; stages=[iteration,targeted,completion]; includes=[]; invalidatedBy=[Domain\, application\, persistence\, worker\, test\, fixture\, configuration\, dependency\, or toolchain change]; evidenceDestination=Completion callback or commit evidence
- Gate: id=browser-tests; command=corepack pnpm run test:browser; stages=[targeted,completion]; includes=[]; invalidatedBy=[UI\, browser test\, runner\, Vite\, Playwright\, configuration\, dependency\, or fixture change]; evidenceDestination=Completion callback or commit evidence\; retained temporary diagnostics path on failure
- Gate: id=build; command=corepack pnpm run build; stages=[targeted,completion]; includes=[]; invalidatedBy=[Source\, static asset\, Vite\, TypeScript\, package\, lock\, dependency\, or toolchain change]; evidenceDestination=Completion callback or commit evidence
- Gate: id=data-contract-check; command=& .\\scripts\\check-data-contract.ps1 -ProjectPath $PWD.Path; stages=[iteration,targeted,completion]; includes=[]; invalidatedBy=[Schema\, specification\, data model\, related ADR\, source or test contract marker\, or checker change]; evidenceDestination=Completion callback or commit evidence
- Gate: id=renderer-check; command=& .\\scripts\\render-governance.ps1 -ProjectPath $PWD.Path -Check; stages=[iteration,targeted,completion]; includes=[]; invalidatedBy=[Managed common\, project rules\, lock\, renderer\, or generated AGENTS change]; evidenceDestination=Included governance result or standalone command report
- Gate: id=governance-check; command=& .\\scripts\\check-governance.ps1 -ProjectPath $PWD.Path; stages=[iteration,targeted,completion]; includes=[renderer-check]; invalidatedBy=[Managed common\, project rules\, lock\, renderer\, validator\, generated AGENTS\, verification policy\, or operations summary change]; evidenceDestination=Completion callback\, or commit evidence
- Gate: id=project-check; command=& .\\scripts\\check-project.ps1 -ProjectPath $PWD.Path; stages=[iteration,targeted,completion]; includes=[project-governance-regression]; invalidatedBy=[Documentation\, links\, indexes\, roadmap\, ADR\, TOML\, runbook\, capacity helper\, policy routing\, or checker change,Project governance helper or regression script change]; evidenceDestination=Completion callback or commit evidence
- Gate: id=project-governance-regression; command=& .\\scripts\\test-project-governance.ps1; stages=[iteration,targeted,completion]; includes=[]; invalidatedBy=[Project checker\, governance helper\, regression script\, verification policy or runtime change]; evidenceDestination=Named child result and exit status from project-check\, or standalone command report
<!-- END GENERATED VERIFICATION POLICY SUMMARY -->

### Gate Catalog and Inclusion

| Gate ID | Command | Purpose and failure meaning | Inclusion / evidence |
| --- | --- | --- | --- |
| `diff-check` | `git diff --check` | worktree差分のwhitespace errorを検出する | callbackまたはcommit evidence。exact staging後は `git diff --cached --check` もGit integration evidenceとして独立実行する |
| `typecheck` | `corepack pnpm run typecheck` | TypeScript projectと型契約の不整合を検出する | 独立exit status |
| `lint` | `corepack pnpm run lint` | source/testの静的規則違反とwarningを検出する | 独立exit status |
| `unit-tests` | `corepack pnpm run test:unit` | domain、application、persistence、Workerの決定的回帰を検出する | 独立exit status |
| `browser-tests` | `corepack pnpm run test:browser` | UI、WebGL、Worker、永続化、狭幅の統合回帰を検出する | runnerがloopback Vite serverを所有し、失敗時だけ一時diagnostics pathを保持する |
| `build` | `corepack pnpm run build` | production bundle生成失敗を検出する | `dist/` は証拠ではなくGit管理外。既知のlarge-chunk advisoryは現在の失敗gateではない |
| `data-contract-check` | `& .\scripts\check-data-contract.ps1 -ProjectPath $PWD.Path` | Schema、仕様、data-model、ADR、source/test markerのdriftを検出する | 他の製品gateを包含しない |
| `renderer-check` | `& .\scripts\render-governance.ps1 -ProjectPath $PWD.Path -Check` | 生成済み `AGENTS.md` のdriftを検出する | `governance-check` が包含する。standaloneで選ばない限り重複実行しない |
| `governance-check` | `& .\scripts\check-governance.ps1 -ProjectPath $PWD.Path` | common/lock/hash/AGENTS/policy/operations summaryのdriftを検出する | includes `renderer-check`。包含childの結果とexit statusを保持する |
| `project-check` | `& .\scripts\check-project.ps1 -ProjectPath $PWD.Path` | 必須文書、link/index、capacity routing、ADR、roadmap、TOML、policy routingのdriftを検出する | includes `project-governance-regression`。child結果とexit statusを保持する |
| `project-governance-regression` | `& .\scripts\test-project-governance.ps1` | 検証分類・必須環境・総合gate保持の正常系と負例 | project-checkが包含するため重複実行しない |

comprehensive gate IDは `diff-check`、`typecheck`、`lint`、`unit-tests`、`browser-tests`、`build`、`data-contract-check`、`governance-check`、`project-check` である。包含closureを展開して同じgateを一度だけ実行する。`governance-check` 選択時は `renderer-check` を別のcompletion commandとして重複させない。

### Execution Runtime

検証policyの必須環境はWindows PowerShell 7（Core、major 7以上、`pwsh`）である。今回観測した7.6.4の実効ExecutionPolicyはRemoteSignedだった。Windows PowerShell 5.1（Desktop、`powershell`）は実効Restrictedを観測したためrequired=false、supportStatus=unverifiedとし、動作保証や必須gateを追加しない。既存のより強い要件が見つかった場合は削減せず停止する。ポリシー設定変更、Bypass、実行拒否の回避は行わない。

### Evidence Validity

- 成功はコマンド完了と終了コード0を観測した後だけ記録する。診断run、中間出力、開始時点を完了証拠にしない。
- worktree編集後は `diff-check`、関連するTS/設定変更後はtype/lint、関連する実装・test・fixture変更後はunit/browser、source・asset・build設定変更後はbuildを失効させる。
- Schema、仕様、data-model、関連ADR、source/test契約markerの変更後は `data-contract-check` を失効させる。
- common/project rules、lock、renderer、validator、AGENTS、verification policy、generated operations summaryの変更後はrenderer/governance evidenceを失効させる。
- 文書、link、index、roadmap、ADR、TOML、runbook、capacity helper、policy routingの変更後は `project-check` を失効させる。
- 内容を変えないstagingまたはcommitだけではproduct gateを失効させない。exact staging後の `git diff --cached --check`、commit後のHEAD、status、sole Worktreeは別に再確認する。
- 各必須gateは別のコマンド、結果、終了コードとして記録する。まとめる場合は、どれか一つでも失敗すれば非ゼロで終了し、child結果を保持する検証済みrunnerだけを使う。`;` など状態を隠す連結や診断batchを完了、引き継ぎ、commit、統合、releaseの証拠にしない。

## Git Integration

- 全タスクは `C:\Users\seven\projects\auto-clp` を使う。
- タスク固有Worktreeまたは別コピーは、理由、パス、ブランチ、担当、統合方法、存続期間、後片付けをユーザーが事前承認しない限り禁止する。
- 承認のない別Worktreeを発見した場合は保存し、そこでの状態変更を止め、削除せずユーザーへ確認する。
- 委任タスクは担当ファイルを編集・検証した後、正確なファイル、差分、テスト、未検証事項、承認境界、作業ツリー状態を報告して停止する。
- コーディネーターは受入対象だけを確認・ステージ・コミットし、統合する。委任タスクに既存コミットがある場合は、確認後に再利用する。
- 無関係なユーザー変更をステージ、コミット、破棄しない。
- プッシュ、公開、履歴書き換えは別の明示承認を要する。

## Project Management Task Loop

長期調整、通常委任のcheckpoint/callback、Git統合、ユーザー依頼のtask交代、容量確認は[調整runbook](runbooks/project-coordination.md)を正とする。現在の製品情報と次作業は[仕様](specification.md)・[ロードマップ](roadmaps/auto-clp.md)・本運用文書へ記録する。[旧handoff索引](handoffs/README.md)はHistoricalであり、現在owner・承認状態の正本や通常起動の前提にはしない。

## Governance Updates and Task Replacement

- Managed common-governance version: 3.0.0
- 管理対象を直接編集しない。明示承認された移行でだけinstalled scaffold skillを読み、互換性準備後に同期Plan/Apply/Checkを使う。rendererはcheck-onlyであり、生成更新はsyncが所有する。
- 3.0.0移行のinventoryは[内容を含まない文書対応表](migrations/document-plan.json)に置く。標準3正本は中央CLIが検証し、それ以外の元hashと対応理由は同表のproject-owned拡張を独立レビューする。元hashを変更後の値へ差し替えない。
- 採用契約とCLIの所在は[契約索引](../references/README.md)を読む。文書移行CLIはinstalled packageに含まれないため、今回承認された中央の scripts/manage-document-migration.ps1 と対応functionsを使う。中央ソース・installed packageは変更せず、将来利用時も実物と承認範囲を再確認する。
- 変更前にValidatePlanの未対応0と元hashを確認し、変更後にValidateResultの正本・相対link・到達可能性を確認する。既存索引が対応先へ既にlinkしている場合は通常のproject-owned索引を維持する。topology成功を意味保持・総合検証の代わりにしない。
- ユーザー依頼のtask交代は、既存正本と次作業を更新し、関連変更を意味のある単位でcommitしてprimaryをcleanにした後、同じ基本名と次の連番の非fork新規taskを作る。編集ごとの細切れcommitや交代だけの空commitは作らない。
- すべてのtaskはAGENTS.md、governance/project-rules.md、作業種別の正本を読む。手動作成や旧task利用不能時も同じ開始経路を使い、旧ID・旧ownerの応答・activation callback・最初の実file commitを要求しない。
- ガバナンス変更は強制交代を起こさない。交代専用の台帳、履歴、cache、世代、handshake、validator、profileを追加しない。通常のプロジェクト作業はinstalled scaffold skillを読み込まない。
- ガバナンス移行では既存総合9ゲートと包含される検査回帰、独立レビューを行う。後続実質変更では失効した証拠を再検証する。仕様・Schema・アプリ・依存関係・受入条件・98%は変更しない。
- 同期失敗時の自動rollbackはその呼出しが変更した管理対象に限る。構造・意味・総合検証に失敗した場合は、承認境界に従い移行所有範囲を一体として復旧する。対応表の基準commitと既存1行修正を保全し、無関係な変更を巻き戻さない。履歴書換え・広範なresetは行わない。
- 旧taskはCodexがarchive/deleteせず、ユーザーへ手動削除可能と案内する。通常委任のcallback、安全・権限・外部操作の承認境界は維持する。

## Coordinator Session Lifecycle

容量確認の各aliasは[調整runbook](runbooks/project-coordination.md)へ経路指定する。モデルtoken/contextではなく現在taskの永続session JSONL容量を意味する。

- 信頼できる現在task IDをプロジェクト内helperへ明示し、ちょうど1件のsessionを測定する。最新または最終更新sessionを推測しない。
- 個別300 MiBは交代提案基準、Codex全体10 GiBは別の参考警告であり、互いに流用しない。
- 使用率、handoff_required、全体scan完全性/error数、各計測時刻/source、コマンド結果と独立終了コードを報告する。session本文・SQLite/WALは読まず変更しない。
- task ID不明、0/複数一致、script失敗では推測せず停止する。全体scan不完全時は全体容量によるcleanup・閾値判断を停止する。
- 長期作業開始時、callbackによる状態変更後、停止・完了時に計測する。状態変化がない反復測定は1時間に1回以下とする。測定を交代専用validationにはしない。

## Outputs

- 現在の成果物は本リポジトリ内の文書、設定、ローカルWebアプリ、入力編集UI、およびGitHub Pages向けActions配信設定である。
- 仕様1.5.1の積荷合成重心可視化は、正確な純粋計算、scene投影、同径・外枠なしの赤・黄ドット、完全一致・近接時の黄前面表示、凡例、4状態、camera・DPR・drag・読込・狭幅回帰まで実装済みである。人間による差分視認性と理解の確認はまだ利用できない。
- CLPデータの機械可読な設計契約は `schemas/project-0.1.0.schema.json`、意味契約は `docs/data-model.md` である。構造・意味検証、検証済み書出し、取引的読込、手動の端末保存・確認削除、JSONファイル入出力、全候補Worker事前判定、CLP・隙間・積荷・候補の入力編集UIは実装済みである。
- アプリのビルド出力は `dist/` であり、Git管理対象外とする。
- 現在のビルドはJavaScript chunkがViteの500 kB推奨値を超える警告を出す。現チェックポイントのゲートではないが、Phase 1の利用者受入または公開検討前の性能チェックポイントで分割と初期読込性能を再評価する。
- 成功は、要求された成果物、仕様・ロードマップ・ADR・変更履歴の整合、独立した必須検証の成功、残リスクの報告で確認する。

## Errors and Recovery

- 管理ハッシュまたは生成 `AGENTS.md` の不一致: 直接修正せず、承認済みスキル同期を再実行する。
- 文書検証失敗: 該当リンク、索引、進捗、ADR、TOMLを修正し、失敗したgateと、後続変更で証拠が失効したgateだけを再実行し、最終影響範囲で選択したすべてのgateの証拠が有効であることを確認する。
- JSON・端末読込失敗: サイズ、読取、構文、版、スキーマ、意味、全候補Worker判定、非同期競合のどの失敗でも現在CLP、履歴、未保存入力を保持する。固定codeから理由を表示し、ファイル名、入力値、全文をエラーやログへ出さない。
- 端末保存失敗: 未対応、open、blocked、read、write、delete、abort、容量不足相当を成功と表示しない。save/delete/exportは副作用完了後にstale失敗へ置き換えず、永続化中のProject commitを中央で拒否する。
- UI入力失敗: 入力途中の文字列と確定済みCLPを分離し、固定code/pathから修正可能な理由を表示する。失敗時は確定済みCLPを同一参照で保持し、入力値をエラーやログへ反射しない。
- 3D非対応・描画障害: WebGL 2非対応、Three.js初期化失敗、描画例外、WebGLコンテキスト喪失ではAuto CLPのCLP編集・配置・判定・履歴・保存操作を全面停止する。現在メモリ内の作業データとIndexedDB端末保存済みデータは変更せず、両者の違い、含む内容、固定出力名、復旧後のJSON読込、端末保存を上書きしないことを操作前に表示する。download後は完了ではなく開始、ファイル名、browserのdownload一覧またはfolder確認を持続表示し、復旧手順と「3D表示を再確認して再読み込み」だけを提供する。退避は読込・編集・削除・上書き保存を行わず、WebGL 2が回復した再読込後だけ通常操作を再開する。
- コールバック・タスク状態取得失敗: 同じ割当を重複送信せず、安全な復旧を1回試み、再開条件をユーザーへ報告する。

## Backup and Retention

- ソースと文書の履歴はGitで保持する。
- CLPデータは初期版では利用者のブラウザ内IndexedDB単一枠または利用者が書き出したJSONだけに保存される。自動クラウドバックアップ、自動保存、起動時自動読込はない。
- IndexedDBコピーは明示削除まで保持を試み、自動期限を設けない。ただしサイトデータ削除、容量管理、private mode等で失われ得る。削除は画面のCLPやJSONを消さない確認付き操作とする。
- 実務利用前に端末保存・再読込とJSON書出し・再読込を匿名代表データで確認する。

## Sensitive Information

秘密情報、資格情報、セッションデータ、個人情報、実在顧客の貨物・価格・搬送記録をリポジトリ、テスト、ログ、プロンプトへ保存しない。公開可能な匿名合成データだけを利用する。アプリ利用者向けの入力データ注意と重心可視化の仮定・非保証範囲は内容版1.2.0の「使用上の重要事項」で示し、主ページには重複表示しない。
