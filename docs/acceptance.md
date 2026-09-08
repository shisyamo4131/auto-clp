# Phase 1 Synthetic Acceptance Contract

- Status: Active
- Last updated: 2026-09-08
- Scope: Phase 1 — ローカル3D手動配置試作
- Data classification: 匿名の合成データのみ

## Purpose and Limits

この文書は、Phase 1の主要操作と安全側の表示を同じ再現可能なCLPで確認するための技術受入契約である。実在顧客、実貨物、搬送記録を使わず、以下の値をそのまま使う。

合成ケースの自動試験または開発チーム内試用に合格しても、精密機器運送の実務担当者による受入、実積載の安全性、完全な搬入経路、構造強度、安定性、法令適合性を証明しない。実務利用者の試用結果は別の観察記録として残す。

## Common Pass Criteria

- 入力、3D確認、物理判定、履歴、保存・再読込を、秘密情報や外部通信なしで完了できる。
- 不適合、未確認、判定不能を区別し、不適合があっても独立した開口・耐荷重理由を失わない。
- 「適合」または「未確認」を、実積載の安全保証として表示しない。
- 成功したCLP変更だけを1件の履歴操作とし、失敗とno-opは履歴を増やさない。
- WebGL 2能力確認と初回描画に成功した場合だけCLP操作を利用できる。非対応・初期描画失敗・context lossでは通常作業面を表示せず、現在の作業データと端末保存済みデータを変更しない読み取り専用ダウンロードだけを利用できる。各対象、含む内容、含まない未保存作業、固定出力名、復旧後のJSON読込、ダウンロード開始結果、次行動を画面上で理解できる。
- キーボード操作と305、320、375 px幅で、主要操作、理由、確認、focusを失わない。
- fine-pointer床面dragはno-opを先行し、両軸に正の共通長があるpartialを修正途中配置として保存し、面・辺・点接触を含むoutsideだけを荷室外作業状態にする。status出現でviewport位置を変えない。
- 全積荷を検索・選択でき、別のコンテナへの配置は所有コンテナへ切り替えてから扱う。積荷定義と配置は別dialog・別履歴で、配置取り外しと積荷削除をcascadeしない。
- Application Barにmenu、現在CLP名、3D能力Chipがあり、保存・読込・JSON・新規CLP・CLP設定・積荷追加・コンテナの追加・編集・削除・ヘルプはNavigation Drawerに集約される。Drawer最下部でAuto CLPアプリ版とCLPデータ形式版を確認できる。積荷cardとコンテナcardは通常画面に置かない。Drawer外clickはDrawerだけを閉じ、背面操作を発火させずmenu focusとpage scrollを復元する。通常のデスクトップ高ではApplication Shellがbrowser viewport高に一致し、上下padding、Application Barと余白、コンテナtabを除いた残りを3D viewportが占める。通常時の操作案内帯は表示せず、必要な操作statusだけをviewport内へ浮動表示してcanvasの寸法・位置を変えない。
- 未保存変更がある新規CLP作成は破棄確認を要求し、作成後は新しい `projectId` と空CLP設定dialogを提供する。新規作成はUndo対象ではなく、旧履歴を破棄するbarrierとする。
- dialogはfocus trap、dirty破棄確認、背景操作遮断、preventScroll復帰、305 / 320 / 375 px内部scrollを維持する。X/Z回転は固定toolbar上の同一glyphを90度差とaccessible nameで区別でき、積荷editorの向き設定は天地無用だけとする。Z軸床面回転は常に利用でき、天地無用はXだけを無効にする。
- 重心可視化はコンテナ幾何中心の赤点、配置積荷の合成重心の黄点、色以外の凡例だけを使い、数値、許容範囲、合否、安全性を表示しない。二つの点は操作対象にならず、物理判定lampの赤・黄状態と意味を混同させない。

## AC-01 Floor Layout and Manual Editing

### Data

- CLP隙間: X 100 mm、Y 100 mm、Z 100 mm。
- 候補「合成コンテナA」: 内部 4,000 × 2,400 × 2,400 mm、開口 2,200 × 2,200 mm、耐荷重 3,000 kg。
- 積荷「合成積荷A」: 1,200 × 800 × 600 mm、500 kg、段積み可、許可向き `LWH` / `WLH`。初期配置 `(100, 100, 0)` / `LWH`。
- 積荷「合成積荷B」: 800 × 600 × 500 mm、400 kg、段積み不可、許可向き `LWH` / `WLH`。初期配置 `(1,500, 100, 0)` / `LWH`。

### Steps and Expected Results

1. 3Dで積荷Aを選択し、fine pointerで床面方向へdragして、保存後の最小角を `(200, 100, 0)` にする。Xだけが100 mm増え、Y、Z、向きは変わらない。
2. 取り消しで初期値 `(100, 100, 0)`、やり直しで指定値 `(200, 100, 0)` が正確に復元される。
3. 配置フォームで積荷Bを `WLH` に変更する。不許可向きは選択できない。
4. 積荷Bを確認付きで取り外し、取り消しで復元する。
5. 不適合理由と積荷ごとの搬入経路未確認理由は0件で、完全な搬入経路と安全を保証しない恒常的な注意が表示される。

### Acceptance Observation

3D選択後にフォームでZ、向き、取り外しを完了できたかを記録する。操作を発見できない、一覧への移動で作業を中断する、または座標誤りが繰り返される場合だけ、canvas近傍の追加操作を検討する。

## AC-02 Exact Single Support and 1 mm Conditional Overhang

### Data

- CLP隙間: X/Y/Zすべて0 mm。
- 候補「合成コンテナB」: 内部 3,000 × 2,000 × 2,000 mm、開口 2,000 × 2,000 mm、耐荷重 2,000 kg。
- 下段「合成支持台」: 1,000 × 800 × 500 mm、500 kg、段積み可、`LWH`、配置 `(500, 500, 0)`。
- 上段「合成上段荷」: 1,000 × 800 × 400 mm、300 kg、段積み不可、`LWH`、配置 `(500, 500, 500)`。

### Steps and Expected Results

1. 完全一致配置では不適合理由・積荷別未確認理由がともに0件となる。単一上面のX/Y完全包含による幾何学的単独支持が成立し、構造強度・安定性など未計算の範囲は版付きの「使用上の重要事項」で一度だけ確認できる。
2. 上段Xを501 mmへ変更する。底面が1 mmだけ支持面から張り出し、不適合ではなく `support-conditions-unverified` が1件表示される。構造剛性、支持位置、重心、許容支持間隔の確認を促し、支持接触に対するpair隙間理由は追加しない。
3. 取り消しでX=500 mmへ戻し、単独支持の適合へ復元して積荷別未確認理由を0件へ戻す。

## AC-03 Independent Floor Penetration Diagnostics

### Data

- CLP隙間: X/Y/Zすべて0 mm。
- 候補「合成コンテナC」: 内部 3,000 × 2,400 × 2,400 mm、開口 1,700 × 2,100 mm、耐荷重 100 kg。
- 積荷「合成不適合荷」: 1,000 × 1,800 × 2,300 mm、100.001 kg、段積み不可、許可向き `LWH` のみ、配置 `(100, 100, -1)`。

### Steps and Expected Results

1. `floor-penetration` を対象積荷の先頭の不適合理由として表示し、Zを0以上へ直すよう案内する。
2. 同じ座標原因から積荷自身の隙間・支持不足、pair重なり・隙間不足を連鎖表示しない。
3. 座標と独立する `opening-no-fitting-orientation` と `payload-capacity-exceeded` を同時に保持する。
4. 搬入経路未確認は積荷ごとの理由として表示せず、完全な搬入経路を保証しない範囲は恒常的な注意で確認できる。
5. 床以外の壁・天井境界違反は従来どおり `outside-container` として区別する。

## AC-04 Recovery, Portability, and Required-WebGL Failure Gate

### Steps and Expected Results

1. AC-02のCLPで上段Xを501 mmへ変更し、取り消し、やり直し、取り消しを行う。最終CLPはX=500 mmとなる。
2. 「端末へ保存」後にCLPを変更し、「端末保存を読込」する。保存時の正規CLPを復元し、履歴、未保存入力、選択、camera、旧判定結果をリセットして再判定する。
3. `auto-clp-project-0.1.0.json` を書き出し、CLPを変更してから再読込する。Schema `0.1.0` の正規CLPだけを復元し、履歴、camera、判定結果をファイルへ含めない。
4. WebGL 2非対応状態では、CLP編集、配置、物理判定、履歴、端末保存・読込・削除、JSON読込を利用できず、通常作業面とcanvasを表示しない。「現在の作業データ」は障害直前まで画面が保持する内容、「端末に保存済みのデータ」は最後に「端末へ保存」した時点でその後の未保存作業を含まない内容として区別する。各固定出力名と復旧後のJSON読込を操作前に表示し、クリック後はダウンロード開始、対象ファイル名、ダウンロード一覧またはフォルダーの確認を持続表示する。読み取り専用ダウンロードはCLP・履歴・保存内容を変更しない。
5. 初期Three.js描画失敗と描画後のWebGLコンテキスト喪失でも同じ全面停止へ移行し、現在CLPを保持する。WebGL 2が回復した状態で再読込した場合だけ通常操作へ戻る。

## AC-05 Tabbed Scene, Selection Annotation, and Validation Dialog

1. コンテナ3件以上を持つCLPで、Application BarのmenuがDOM・視覚とも右端となり、3D viewportの欄外上部にある一行tablistでコンテナを直接切替できる。tablistはcanvasと重ならず、狭幅または長名で左右buttonと横scrollが現れ、scrollだけではコンテナを変更しない。左右矢印・Home・End・Enter・Spaceとfocusが仕様どおり動く。
2. 寸法差のあるコンテナA/B間をA→B→Aと切り替えても、共有cameraの視線方向・上下角度・fit距離倍率と、未配置積荷のside・gap・接線方向関係・Z・向きが維持される。tab、camera、anchorはProject、dirty、履歴、端末保存、JSONへ入らない。
3. scene積荷を選択した時だけ、現在向き適用後の3軸寸法線、両端から外向きのcompactな `4 × 4` 矢印、`整数 mm` だけの可視labelを表示し、選択解除・削除・候補切替・WebGL障害で消す。軸と奥行・横幅・高さの同値は下段の非視覚説明に一度だけ持ち、annotationはdrag・選択のpointer hitを奪わない。
4. selector直下の固定action rowは、未選択でも高さを維持し、未配置・現在のコンテナ配置・別のコンテナ配置の各状態に対応する正しい操作だけを示す。積荷削除と荷室から外すは別確認・別履歴であり、drag中とdialog中は理由付きで無効となる。
5. Undo/Redo横の判定lampは、灰・青・黄・赤と異なる可視iconだけを常設し、accessible nameとtitleで状態名・不適合件数・未確認件数を示す。dialogを閉じても判定を継続し、再度開くと最新結果を表示する。青は「実装済み確認項目内で問題なし」であり、安全保証とは表示しない。
6. 初回または内容版更新後は操作開始前に「使用上の重要事項」を確認し、Drawerと物理判定dialogから再表示できる。実在する顧客名、個人情報、秘密情報、実貨物や搬送記録を入力しない注意は同dialogにあり、主ページへ重複表示しない。確認状態はCLP、JSON、端末保存、履歴へ入らず、法的な利用規約同意とは表示しない。
7. 305 / 320 / 375 px、コンテナ0 / 1 / 100件、積荷0 / 1 / 1,000件、keyboard、touch、WebGL context lossでoverlay重複、page横overflow、focus消失、stale判定、別のコンテナ配置の重複表示がない。
8. Drawerの `操作方法` は独立dialogを開き、積荷選択、視点回転・平行移動、wheel、toolbar、積荷drag・回転、Undo/Redo、判定、座標・積荷編集とtouch境界を正しく案内する。dialogはCLP・履歴・保存・sceneを変更せず、背景inert、Tab trap、Escape・close、menu buttonへのfocusとpage scroll復帰、狭幅内部scrollを維持する。現在のコンテナの配置は `現在の座標` と明記する。
9. 通常画面とDrawerには自動配置提案panel、開始、取消、適用入口がなく、通常起動で自動提案Workerを開始しない。通常画面に積荷cardとコンテナcardはなく、Drawerの `積荷を追加`、`コンテナを追加`、選択中コンテナの編集・削除はmodal editorを開き、save/cancel/dirty/busy/history/limit/focusと非cascade削除を維持する。Drawer外click、close button、Escapeは同じclose境界を使い、未実行の新規CLP・端末保存削除確認を取り消す。

## AC-06 Cargo Center-of-Gravity Reference Markers

このケースは仕様1.5.1の実装と自動回帰・独立コードレビューまで完了した。人間による差分視認性・凡例理解の確認と実務利用者試用は未実施であり、実務受入済みとは扱わない。

### Data

- CLP隙間: X/Y/Zすべて0 mm。
- コンテナ「重心確認コンテナ」: 内部 4,000 × 2,000 × 2,000 mm、開口 2,000 × 2,000 mm、耐荷重 3,000 kg。
- 積荷「重心確認荷A」: 1,000 × 1,000 × 1,000 mm、1,000 kg、`LWH`、配置 `(0, 500, 0)`。
- 積荷「重心確認荷B」: 1,000 × 1,000 × 1,000 mm、1,000 kg、`LWH`、配置 `(3,000, 500, 1,000)`。

### Steps and Expected Results

1. コンテナ幾何中心 `(2,000, 1,000, 1,000)` と積荷合成重心 `(2,000, 1,000, 1,000)` が一致する。両点は10 CSS px、白い外枠なしとし、座標をずらさず黄色を赤より前面へ置く。完全一致時は黄色が赤を完全に覆い、赤を別位置、外周、切欠きまたはglowとして露出させない。二点が近接して表示領域だけ重なる場合も各投影中心を変えず、重なった部分では黄色を前面にする。凡例swatchも同径・白い外枠なしとし、凡例と読み上げ用名称で両者の役割を識別できる。
2. 積荷BのXを2,000 mmへ確定すると、黄点だけが負X側へ移動し、赤点は変わらない。X/Y/Z差または距離の数値、許容範囲、合否、警告を表示しない。
3. drag中は確定済みProjectに基づく黄点を維持し、drop確定後に一度だけ更新する。取消とno-opでは動かさない。座標、重量、寸法、向き、取り外し、Undo/Redoで、確定状態に対応する位置へ再計算する。
4. 境界不適合または支持条件未確認として保存できる配置も現在状態として黄点へ含め、既存物理判定lampを独立して維持する。赤・黄の点は異常、不適合、警告または安全を意味しない。
5. コンテナを切り替えると、そのコンテナの内寸中央と配置済み積荷だけを使用する。未配置積荷、別コンテナ配置、荷室外session poseを含めない。
6. `no-container` は両点なし、`empty` は赤点だけと `配置積荷なし`、`available` は赤点とviewport内へ投影できる黄点、`unavailable` は有効なコンテナなら赤点だけと `現在重心を計算できません` を示す。選択中コンテナ削除、新規空CLP、tab切替、参照不整合、計算overflowまたは非有限な表示変換では、新しい現在状態から両点、凡例、statusを再導出して古い派生表示を残さず、0位置または物理的不適合へ変換しない。端末・JSON読込成功時は置換後Projectから全派生表示を再導出する。読込失敗時は現在Projectとそれに正しく対応する派生表示を保持し、読込失敗statusだけを別に示す。
7. 赤・黄点は固定画面サイズで、viewport内では積荷より前面に見え、pointer hit、raycast、focus、積荷選択、drag、camera、履歴、dirty状態、canvas寸法またはpage位置を変えない。重心がcameraの表示範囲外なら座標を画面端へclampせず、cameraを自動変更せず、凡例へ `現在重心は画面外` と示す。orbit / pan / zoom後は同じ正規位置から再投影する。完全一致・近接・離隔・画面外を複数DPRと305 / 320 / 375 pxで確認し、凡例がcanvas操作領域を失わせず水平overflowを起こさない。
8. 端末保存・JSON書出しへ幾何中心、合成重心、点、凡例、計算状態を含めず、読込成功後に正規CLPから再計算する。WebGL障害時は通常作業面とともに点を表示せず、既存の読み取り専用救出だけを提供する。
9. 使用上の重要事項は、各積荷の重心を直方体中央と仮定した参考表示であること、コンテナ自重、実貨物の偏心、支持反力、軸重、床荷重、構造・安定性、固縛、荷崩れ、動荷重、法令適合性、実積載の安全性を評価・保証しないこと、および実際の積込み・運搬は利用者が別途確認して責任を負うことを示す。

### Domain and Projection Fixtures

以下の数値はdomain・scene adapterの自動試験だけで照合し、利用者UIへ偏差、距離または合否として表示しない。

- 非立方・奇数寸法・不均等重量: 積荷Cは寸法 `1,001 × 501 × 301 mm`、3 g、`LWH`、位置 `(-1, 0, 1)` とし、倍中心を `(999, 501, 303)` とする。積荷Dは寸法 `701 × 401 × 201 mm`、5 g、`HWL`、位置 `(1,000, -2, 3)` とし、向き適用後寸法 `(201, 401, 701)`、倍中心 `(2,201, 397, 707)` とする。総重量 `M=8`、倍座標moment `S=(14,002, 3,488, 4,444)`、合成重心 `S/(2M)=(875.125, 218, 277.75) mm` を正確に返し、入力順を入れ替えても同じ有理値とする。
- 向き適用: 元寸法 `101 × 203 × 305 mm` は、`LWH=(101,203,305)`、`WLH=(203,101,305)`、`LHW=(101,305,203)`、`HLW=(305,101,203)`、`WHL=(203,305,101)`、`HWL=(305,203,101)` として各軸中心へ反映する。
- 上限とoverflow: 1,000個すべてを100,000,000 g、向き適用後寸法 `(100,000, 100,000, 100,000) mm`、位置 `(1,000,000, 1,000,000, 1,000,000) mm` とすると、各軸の倍座標momentは `210,000,000,000,000,000`、合成重心は `(1,050,000, 1,050,000, 1,050,000) mm` となる。JavaScriptのsafe integerを超える中間値を丸めず、順序変更でも結果を変えない。

## AC-07 Cargo CSV Template and Atomic Replacement

このケースは仕様1.6.0・ADR 0034で承認済み、未実装である。自動証拠、Windows版Excel往復、人間による確認はまだ利用できない。

### Initial State and CSV

- 現在CLPは、積荷2件、両積荷を参照する配置2件、コンテナ2件、非0の隙間設定を持つ。
- CSVテンプレートの固定名は `auto-clp-cargo-template.csv`、bytesはUTF-8 BOM、CRLF、固定見出し `name,length_mm,width_mm,height_mm,weight_kg` と末尾改行だけである。
- 入力CSVは3件とする。論理record 1は日本語名、record 2と3は同じ名前を持ち、一つは引用commaとescaped quoteを含む。各寸法は整数mm、重量はkg小数第3位以内とする。

### Steps and Expected Results

1. Drawerからテンプレートを取得し、固定名、BOM、CRLF、固定順・大小文字を区別する5列、データrecordなしを確認する。テンプレート自体をそのまま読み込むと0件として拒否し、現在CLPと履歴を変更しない。
2. BOM有無、CRLF / LF、quoted commaとescaped quoteを正しく解析し、全空白recordだけを無視する。重複名を保持し、有効record順に `cargo-1`、`cargo-2`、`cargo-3` を割り当てる。各積荷は `canSupportCargo=true`、天地無用OFFの全6向きを持つ。名前の制御文字は既存契約に従い拒否する。
3. 適用前に「新規積荷3件、既存積荷2件を削除、配置2件を解除」に相当する件数を表示する。取消ではProject、履歴、選択、scene一時状態、物理判定、合成重心を変更しない。
4. 確定すると、CLP ID・名前、隙間、コンテナ2件を同値で保持し、積荷をCSV由来3件へ置換し、配置を0件にする。旧積荷の選択、荷室外pose、drag previewを残さず、物理判定と合成重心を新Projectから再導出する。端末保存を自動上書きしない。
5. 一回のUndoで元の積荷2件と配置2件を完全に復元し、一回のRedoでCSV由来積荷3件・配置0件へ戻す。失敗、取消、stale、busy、同一状態no-opを履歴へ追加しない。
6. 1件と30件は受け入れ、31件、0件、空file、header-only、不正UTF-8、5 MiB超過、見出し不足・余分・重複・並べ替え・大小文字違い、列不足・余分、不正引用、部分空欄、範囲外、丸めが必要な値をファイル全体として拒否する。どの失敗でも現在Project参照と対応する派生表示を保持し、cell値、積荷名、filename、CSV全文を表示またはログへ反射しない。
7. 名前1 / 120文字、寸法1 / 100,000 mm、重量0.001 / 100,000 kgを受け入れ、名前0 / 121文字・制御文字、寸法0 / 100,001・小数、重量0 / 100,000.001・小数4桁、負数、指数、全角数字、桁区切り、単位、式を拒否する。
8. 手動追加も段積みOK・天地無用OFFを既定とする。積荷数29件では1件追加でき、30件では手動追加を拒否する。Schema `0.1.0`の既存31〜1,000件Projectは読込、表示、編集、削除、書出しできるが追加できず、29件以下へ削除すると追加できる。配置上限1,000件は変更しない。Undoで31件以上を復元した場合も同じ追加制限を再適用する。
9. 305 / 320 / 375 px、keyboard、focus trap、Escape、Drawer背景、busy、WebGL障害の全面停止を既存UI契約どおり維持する。CSV操作の出現またはstatusで3D canvasの寸法・位置を変えない。
10. 見出し後に全空白recordを置き、その後の論理record 1のquoted name内に改行を含め、さらに全空白recordを挟んだ論理record 2の `weight_kg` を不正値にする。物理行数にかかわらず `input.kg-format` と `/rows/2/weight_kg` を返す。file・header・record件数・列数・名前・寸法・重量・置換後Projectの各失敗は仕様の固定code/pathだけを返し、path→codeの順、重複なし、最大50件、入力値非反射を維持する。

### Human Excel Gate

Windows版Excelでテンプレートを開き、日本語、引用comma・quote、kg小数を含む匿名データを入力して「CSV UTF-8（コンマ区切り）」として保存し、再読込後の順序、値、段積みOK、全6向き、件数確認、Undo/Redoを確認する。通常の非UTF-8 CSVは状態を変えず拒否されることを確認する。この人間確認が完了するまでCSVマイルストーンの最終1点と実務受入を獲得しない。

## Evidence and Completion

- 自動証拠: domainと表示の単体試験、Worker経由のブラウザ試験、履歴、IndexedDB、JSON往復、WebGL必須能力ゲートと読み取り専用救出回帰を個別の終了コードで記録する。
- 仕様1.2.0自動証拠: typecheck、lint、単体28ファイル952件、ブラウザ81件、buildに合格。AC-05の候補0/1/100、keyboard・overflow、4辺anchor・候補寸法差A→B→A、共有camera、3軸annotation、固定action行列、lamp/dialog、使用事項の保存成功・session-only失敗、下段safe areaとconsole error 0を回帰した。これは人間または実務利用者受入の証拠ではない。
- 仕様1.2.1自動証拠: typecheck、lint、単体28ファイル952件、ブラウザ89件、buildに合格。tablistが3D viewport外の直前にありcanvasと非重複であること、狭幅・多数候補のscrollでcanvas文書位置と寸法を変えないこと、`整数 mm`だけの可視寸法と外向きmarker契約、icon-only lampの状態別icon・accessible name・件数・最新dialogを回帰した。camera平行移動はsource contractと実画面確認に分け、headless browserの自動証拠とは扱わない。これは人間または実務利用者受入の証拠ではない。
- 仕様1.2.2自動証拠: typecheck、lint、単体28ファイル952件、ブラウザ93件、buildに合格。Drawerと独立操作方法dialog、案内copy、背景inert、focus trap、Escape・closeのfocus・scroll復帰、CLP・履歴・scene非変更、305 / 320 / 375 pxの内部scroll・水平overflowなし、`4 × 4` marker契約、`現在の座標` copyを回帰した。寸法矢印の見た目と案内文の理解は差分中心の人間確認を残す。
- 仕様1.3.0自動証拠: typecheck、lint、単体28ファイル952件、現行ブラウザ83件、buildに合格。通常画面からの自動配置提案panel・入口・Worker開始の除外、Drawer内だけの積荷・候補追加、既存editor、初期・保存・取消focus、busy・dirty・上限、Drawer外clickの背面操作遮断・scroll・menu focus、305 / 320 / 375 pxを回帰した。将来技術資産の自動提案browser 10件は通常suiteから非実行snapshotとして明示分離し、再公開時にpanelとWorker lifecycleを再接続するまで実行可能または現行製品受入済みとは扱わない。
- 仕様1.4.0自動証拠: typecheck、lint、単体28ファイル952件、現行ブラウザ84件、buildに合格。積荷card・コンテナcardの撤去、Drawerからのコンテナ追加・選択中コンテナの編集・削除、参照中削除の理由付き拒否、配置取り外し後の削除、Undo/Redo、focus、305 / 320 / 375 px、登録対象のコンテナ表記を回帰した。これは人間または実務利用者受入の証拠ではない。
- 仕様1.4.1自動証拠: typecheck、lint、単体28ファイル952件、現行ブラウザ84件、buildに合格。主ページの入力データ注意撤去、内容版1.1.0の「使用上の重要事項」への集約、確認版更新、Drawer最下部のアプリ版・CLPデータ形式版表示を回帰した。これは人間または実務利用者受入の証拠ではない。
- 仕様1.4.2自動証拠: typecheck、lint、単体28ファイル952件、現行ブラウザ85件、buildに合格。通常デスクトップ高でApplication Shellとbrowser viewport高が一致し、残り高を3D viewportが使用すること、通常時の操作案内帯を表示しないこと、必要な操作statusが浮動表示されてもcanvas寸法・位置を変えないことを回帰した。これは人間または実務利用者受入の証拠ではない。
- 仕様1.5.1重心可視化自動証拠: typecheck、lint、単体29ファイル975件、ブラウザ97件、build、データ契約・ガバナンス・プロジェクト検査に合格。正確なBigInt・有理数domain計算、scene投影、4状態、同径10 CSS px・白い外枠なし、完全一致・近接時の黄前面表示、画面外、非操作、camera、drag、履歴、DPR 1/2、305 / 320 / 375 px、使用事項内容版1.2.0、JSON・端末保存への派生状態非保存と読込再計算・失敗保持を回帰し、独立コードレビューは指摘修正後に合格した。人間による差分視認性と凡例理解は未確認であり、実務利用者受入の証拠ではない。
- 開発チーム内試用: 4ケースの完了可否、console、狭幅、キーボード、focus、誤認し得る表示を記録する。
- 実務利用者試用: 評価担当、日程、事前説明、観察結果、合否、改善点を匿名で記録する。未実施中は「実務受入済み」としない。
- canvas追加操作の判断: AC-01で、利用者がZ・向き・取り外しを補助なしで完了できなかった観察証拠がある場合だけ、既存commandを使う最小のコンテキスト操作を設計する。自由なZ dragは正確な支持高さを保証できないため既定案にしない。
- 現在のUI-assisted観察: Codex UIテスターによる[部分観察](evidence/phase1-development-ui-trial-8c8ece2.md)では、AC-01〜03、通常経路のJSON再読込、WebGL非対応fallbackでのZ編集・物理判定・履歴・端末保存、305 / 320 / 375 px、主要focus、console 0件を画面操作で確認し、向き・削除・JSON・自動提案controlは有効状態だけを確認した。Z・向き・取り外しはフォームで発見できたためcanvas側追加操作の根拠にはしないが、exact floor dragは3回の誤座標commitを要し、狭幅時の向き補足文とともに改善候補となった。WebGL非対応時の向き変更・取り外し・JSON往復、自然なTab順と確認後focus、人間による安全表示理解は未観察で、人間試用または実務受入の証拠ではない。
- 現在の人間観察: 人間のプロジェクト評価者による[案内付き部分評価と再試用](evidence/phase1-human-ui-trial-4e6c680.md)では、匿名派生ケースの3D床面移動、正確な座標修正、向き、配置削除・Undo、完全支持・1 mm支持不足、床突き抜け、端末保存・読込、JSON往復に加え、仕様0.12.0版のwheel page scroll、camera button、完全drag-out、Undo/Redo、不適合表示をChromeで確認した。改善後の再試用では、仕様0.18.1の固定X/Z回転button、天地無用だけの向き設定、使用可否の枠表示、端末再読込、F回転時のHを含む他積荷の位置維持を期待どおりと判定した。さらに `HUT-01` のA/B派生fixtureで、床貫通1件だけの表示、Z=0修正後の単独支持と構造・安定性未確認、Undo/Redo往復をすべて期待どおりと確認した。狭幅・Tab・focusは期待どおりと確認した。WebGL fallback試用は、評価者が3Dなしの操作を不適切と判断して中止し、仕様1.0.0の必須ゲートへ置換した。必須ゲートの初回試用では阻止動作とdownload自体は概ね想定どおりだったが、「JSON救出」という語と変化の乏しい画面から対象・結果・次行動を理解できないと評価された。仕様1.0.1の説明・結果表示を実装したが、人間による再確認、正式fixture、評価者区分は未確認のため、実務利用者受入ではない。
- WebGL必須阻止・退避の後続人間確認: 同じ評価者は2026-09-01に、WebGL 2非対応画面で操作停止、現在の作業データと端末保存済みデータの違い、二つの退避入口、復旧手順を理解できると判定し、初期描画失敗画面でも異常と停止、通常menuの無効化、退避・復旧案内を理解できると判定した。作業中context lossの遷移は人間試用では安全な障害注入ができず未再現だが、`tests/browser/capability.spec.ts` 6件の合格・終了コード0で全面停止への遷移を再確認し、人間の画面理解と自動遷移証拠を組み合わせる扱いを評価者が承認した。この確認ではdownloadを再実行しておらず、正式fixture、評価者区分、実務利用者受入ではない。
- Viewer-first shellの人間差分確認: 同じ評価者は仕様1.2.1の欄外tab、簡略寸法・外向き矢印、icon-only判定lamp、両camera平行移動経路と、仕様1.2.2の操作方法、compact寸法矢印、`現在の座標` copyを期待どおりと確認した。仕様1.3.0ではDrawer背景close、Drawerだけの積荷・候補追加入口、現行UIからの自動配置提案除外を含む差分試用を受入可能と報告した。途中の意図しないreload/reloadは最終判定へ影響しなかった。これは正式fixtureまたは実務利用者受入ではなく、進捗98%を変更しない。

### Current Automated Mapping

- AC-01: `tests/browser/acceptance.spec.ts` が正確な合成データでフォームによる向き変更、確認付き取り外し、undo、未確認理由を実行する。WebGL有効時の選択・床面dragは `tests/browser/scene.spec.ts` の独立回帰で覆う。
- AC-02: `tests/browser/acceptance.spec.ts` が正確な合成データで単独支持、Xを1 mmずらした条件未確認の張り出し、undo復元を実行する。`tests/browser/scene.spec.ts` が支持面への実drag snapと一回のUndo/Redoを実行する。
- AC-03: domain、表示、Worker protocolの単体試験と `tests/browser/acceptance.spec.ts` が、床突き抜け、開口、耐荷重の順序とカスケード抑制を実行する。
- AC-04: `tests/browser/history.spec.ts`、`tests/browser/persistence.spec.ts`、`tests/browser/placement.spec.ts`、`tests/browser/scene.spec.ts` がWebGL利用可能時の履歴、IndexedDB、固定JSON往復を実行し、`tests/browser/capability.spec.ts` が非対応・初期描画失敗・context lossの全面停止と2種類の読み取り専用救出を実行する。
- AC-06: `src/domain/weight-balance.test.ts` と `src/scene/project-scene.test.ts` が正確な重量moment、全向き、上限・上限外、4状態、scene変換、計算不能回復投影を検証する。`tests/browser/weight-balance.spec.ts` が赤・黄点と凡例、画面投影中心一致・近接・画面外、非操作、camera、drag、履歴、DPR 1/2、読込成功・失敗、統合 `unavailable`、305 / 320 / 375 pxを実行し、既存永続化回帰が派生状態をJSON・端末保存・履歴へ含めない。匿名合成データによる人間視認性確認は未実施。
- AC-07: 未実装。実装後にCSV parser/file、正規入力、全体置換、履歴、既存保存互換の単体試験と `tests/browser/cargo-csv.spec.ts` を追加し、全行検証、全空白recordとquoted改行を含む1始まり論理record path、全固定code/path、決定的sort・重複排除・50件上限・入力値非反射、件数確認、取消・失敗保持、成功、Undo/Redo、再導出、30件上限、legacy 31〜1,000件、狭幅・focus・WebGL停止を実行する。Windows版Excel往復は別の人間証拠とする。
- 仕様0.16.0は、仕様0.15.0の支持面snapに加え、寸法適合時の積荷別搬入経路理由を廃止し、drag対象以外の透過・点線表示と支持候補の緑・黄点線を全単体939件・全browser71件の統合回帰へ含める。自動試験は開発チーム内試用と実務利用者試用の証拠ではない。
- 仕様0.17.0は、X/Z回転を固定toolbarへ常設し、一本の軸線へ矢印が回り込む同一SVG glyphの90度差、未選択・天地無用・busy時のfocus可能な無効状態、連続回転後のbutton位置、向き更新とUndo/Redoを回帰する。自動試験は人間によるicon理解や実務利用者受入の証拠ではない。
- 仕様0.17.1の紫色による塗り分けは仕様0.18.0で置換した。
- 仕様0.18.0は、積荷editorに天地無用以外の向きcheckboxがないこと、旧1向き・横倒し部分集合を2向き・6向きへ正規化すること、天地無用でもZ軸床面回転が利用できること、天地無用OFFでX/Zとも利用できること、使用可の枠が拡大・縮小buttonと一致し使用不可の枠・iconが低彩度であることを回帰する。
- 仕様0.18.1は、荷室外でFをZ軸回転してもHを含む他の未配置積荷のsession位置が変わらず、回転対象の向きと寸法だけが変わることを純粋scene投影と実画面で回帰する。

## Observation Record Template

- Case ID / evaluator category / date / build commit:
- Completed without assistance: yes/no
- Incorrect coordinate or orientation commits:
- Could find Z/orientation/removal controls: yes/no
- Needed canvas-side control, and why:
- Safety status understood as non-guarantee: yes/no
- Keyboard/touch/narrow-width observations:
- Defect IDs and final pass/fail:

## Future Automatic Proposal Retained Technical Cases

自動提案はPhase 1の通常画面では未提供である。以下は将来再公開時の再qualificationに使う、実務利用者受入とは分けた保持済み技術資産のケースである。純粋探索、未適用preview、確認付き一括適用と一回のUndo/Redoの試作、およびAP-08代表規模の記録環境測定を保存するが、現行機能または製品受入として扱わない。

- AP-01 Candidate objective: 共通して隙間0、積荷1個 `50×50×50 mm`、1,000 g、`LWH` のみを使う。容積比較は `small=200×100×100` が `large=300×100×100` に勝つ。同容積比較は `floor-small=100×100×200` が `floor-large=200×100×100` に勝つ。同容積・床面積比較は `length-small=100×200×100` が `length-large=200×100×100` に勝つ。同寸法比較は入力配列と表示名を入れ替えても `container-a` が `container-b` に勝つ。各候補の開口と耐荷重は積荷を許容する値とする。
- AP-02 Complete plan only: 隙間0、候補 `200×100×100 mm`、開口 `100×100 mm`、耐荷重2,000 g、積荷 `cargo-a` と `cargo-b` を各 `100×100×100 mm`、1,000 g、`LWH` のみとする。期待案は `(0,0,0)` と `(100,0,0)` に各積荷を一度ずつ置く。同じ出力から一方欠落、重複、未知ID、候補混在を作り、適用境界ですべて拒否する。候補長さを199 mmにした派生fixtureでは部分案を適用不可とする。
- AP-03 Exact single support accepted: 隙間0、候補 `100×100×200 mm`、開口 `100×200 mm`、耐荷重2,001 gとする。`support` は `100×100×100 mm`、1,001 g、支持可、`upper` は同寸法、1,000 g、支持不可とする。期待案はsupportを `(0,0,0)`、upperを `(0,0,100)` に置き、不適合0、積荷別未確認0とする。寸法適合した両積荷の搬入経路理由と、単独支持だけを根拠にした構造・安定性理由は生成しない。非保証範囲は版付きの「使用上の重要事項」で確認できる。
- AP-04 Cutoff semantics: 純粋なattempt予算fixtureで候補1〜10,000回目を評価し10,001回目を拒否、要求1〜1,000,000回目を評価し1,000,001回目を拒否する。9,999回で自然終了、10,000回目で自然終了、10,000回後に未探索あり、上限ちょうどで成功を別々に固定する。より優先される候補が完全案なしcutoff、次候補が完全案の集約fixtureでは `complete-with-cutoff`、次候補選択、目的上最良未確認の専用警告、適用可とする。順位を逆転した時は劣後候補を探索せず通常成功とする。
- AP-05 No complete plan: 隙間0、積荷 `101×100×100 mm`、1,000 g、`LWH` のみと、各 `100×100×100 mm`、開口 `100×100 mm`、耐荷重1,000 gの不可能候補2個を使う。向き事前filterでattempt 0、全候補探索済み、`no-complete-plan`、cutoffなし、適用不可、実積載不能の非証明copyを期待する。
- AP-06 Preview and apply: 探索、preview、取消、失敗、staleでは現在Projectと履歴を同一参照で保持し、確認付き適用だけが配置を一括置換する。Undo/Redoで探索前後を正確に往復する。
- AP-07 Determinism: 同じ正規CLP、アルゴリズム版、探索上限から、候補・積荷配列順や表示名に依存しない同じ案と理由順を返す。
- AP-08 Worker and performance: 隙間0、`200×200×200 mm`、1,000 g、`LWH` の積荷20個と、候補 `1,000×800×1,000 mm`、開口 `800×1,000 mm`、十分な耐荷重を代表fixtureとする。記録環境でWebGL 2利用可能状態のcold 1回とwarm 3回を各5秒以内、取消要求からWorker終了・idle観測まで250 ms以内とする。main timer/rAF、キーボード、305/320/375 pxを別行で検証する。別の純粋候補点fixtureでは1,000配置相当から各軸を重複排除・昇順化し、Z→X→Yの期待順で2,048点以下だけを生成して停止し、直積全体を中間配列へ展開しないことを検証する。

空入力fixtureは、積荷0・候補ありと両方0を `no-cargo`、積荷あり・候補0を `no-candidates` とし、attempt 0、previewなし、適用不可、履歴変更なしを期待する。

### Future Automatic Proposal Automated Mapping

- AP-01、AP-02、AP-03、AP-04、AP-05、AP-07: domain、Worker protocol/client、session/viewの単体試験が目的順位、完全案、単独支持時の未確認0件、cutoff、完全案なし、決定性と入力順非依存を検証する。
- AP-06: `src/application/automatic-proposal-apply.test.ts` は現行単体回帰を維持する。future-only browserファイルは非実行snapshotであり、実Workerの完全案、未適用表示、Project・履歴の非変更、適用直前の再検証、常時確認、配置だけの一括置換、同一案no-op、一回のUndo/Redo、通常編集・未保存入力・保存・JSON置換によるstale、遅延結果破棄を再公開時に再接続して検証する。
- AP-08: future-only performanceファイルは非実行snapshot、[AP-08技術証拠](evidence/automatic-proposal-ap08-733b250.md) は過去の記録である。production module Workerを使う20積荷fixtureのcold 1回・warm 3回、各210 attempts、同一result hash、main timer/rAF進行、native取消、250 ms late-response mask、consoleの契約を保持するが、再公開checkpointで専用収集設定とharnessを用意するまで再実行可能とは扱わない。記録環境以外の性能や現行UIの受入へ転用しない。
- 空入力: domain、Worker、session/viewの単体試験で `no-cargo` と `no-candidates`、attempt 0相当、Project・履歴の非変更を維持する。

AP-04の上限試験は、`1..N` の順序付きattempt記述子を生成して指定ordinalだけを成功させられる純粋なtest infrastructureを使う。これはProjectの設定や利用者入力へ公開しない。AP-08の記録にはcommit SHA、algorithm・Schema版、browser/Playwright/OS、CPU、logical processor数、RAM、電源状態、cold/warmと反復番号、viewport、WebGL状態、積荷・候補数、選択候補、候補別・要求attempt数、結果・cutoff源、配置・不適合・未確認件数、結果hash、開始・完了・経過、取消・Worker終了・取消遅延、timer/rAF回数と最大遅延、console warning/error、合否、備考を含める。記録環境以外の性能、headed実行、最低GPU、実務受入は未検証である。
