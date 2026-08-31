# Phase 1 Synthetic Acceptance Contract

- Status: Active
- Last updated: 2026-08-30
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
- 全積荷を検索・選択でき、他候補配置は所有候補へ切り替えてから扱う。積荷定義と配置は別dialog・別履歴で、配置取り外しと積荷削除をcascadeしない。
- Application Barにmenu、現在CLP名、3D能力Chipがあり、保存・読込・JSON・新規CLP・CLP設定はNavigation Drawerに集約される。3D viewport欄外上部の候補tablistとviewport下部の積荷検索・selectorはcanvasの位置を動かさず、toolbarやdragと重ならない。
- 未保存変更がある新規CLP作成は破棄確認を要求し、作成後は新しい `projectId` と空CLP設定dialogを提供する。新規作成はUndo対象ではなく、旧履歴を破棄するbarrierとする。
- dialogはfocus trap、dirty破棄確認、背景操作遮断、preventScroll復帰、305 / 320 / 375 px内部scrollを維持する。X/Z回転は固定toolbar上の同一glyphを90度差とaccessible nameで区別でき、積荷editorの向き設定は天地無用だけとする。Z軸床面回転は常に利用でき、天地無用はXだけを無効にする。

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
4. WebGL 2非対応状態では、CLP編集、配置、物理判定、自動提案、履歴、端末保存・読込・削除、JSON読込を利用できず、通常作業面とcanvasを表示しない。「現在の作業データ」は障害直前まで画面が保持する内容、「端末に保存済みのデータ」は最後に「端末へ保存」した時点でその後の未保存作業を含まない内容として区別する。各固定出力名と復旧後のJSON読込を操作前に表示し、クリック後はダウンロード開始、対象ファイル名、ダウンロード一覧またはフォルダーの確認を持続表示する。読み取り専用ダウンロードはCLP・履歴・保存内容を変更しない。
5. 初期Three.js描画失敗と描画後のWebGLコンテキスト喪失でも同じ全面停止へ移行し、現在CLPを保持する。WebGL 2が回復した状態で再読込した場合だけ通常操作へ戻る。

## AC-05 Tabbed Scene, Selection Annotation, and Validation Dialog

1. 候補3件以上を持つCLPで、Application BarのmenuがDOM・視覚とも右端となり、3D viewportの欄外上部にある一行tablistで候補を直接切替できる。tablistはcanvasと重ならず、狭幅または長名で左右buttonと横scrollが現れ、scrollだけでは候補を変更しない。左右矢印・Home・End・Enter・Spaceとfocusが仕様どおり動く。
2. 寸法差のある候補A/B間をA→B→Aと切り替えても、共有cameraの視線方向・上下角度・fit距離倍率と、未配置積荷のside・gap・接線方向関係・Z・向きが維持される。tab、camera、anchorはProject、dirty、履歴、端末保存、JSONへ入らない。
3. scene積荷を選択した時だけ、現在向き適用後の3軸寸法線、両端から外向きの矢印、`整数 mm` だけの可視labelを表示し、選択解除・削除・候補切替・WebGL障害で消す。軸と奥行・横幅・高さの同値は下段の非視覚説明に一度だけ持ち、annotationはdrag・選択のpointer hitを奪わない。
4. selector直下の固定action rowは、未選択でも高さを維持し、未配置・現在候補配置・他候補配置の各状態に対応する正しい操作だけを示す。積荷削除と荷室から外すは別確認・別履歴であり、drag中とdialog中は理由付きで無効となる。
5. Undo/Redo横の判定lampは、灰・青・黄・赤と異なる可視iconだけを常設し、accessible nameとtitleで状態名・不適合件数・未確認件数を示す。dialogを閉じても判定を継続し、再度開くと最新結果を表示する。青は「実装済み確認項目内で問題なし」であり、安全保証とは表示しない。
6. 初回または内容版更新後は操作開始前に「使用上の重要事項」を確認し、Drawerと物理判定dialogから再表示できる。確認状態はCLP、JSON、端末保存、履歴へ入らず、法的な利用規約同意とは表示しない。
7. 305 / 320 / 375 px、候補0 / 1 / 100件、積荷0 / 1 / 1,000件、keyboard、touch、WebGL context lossでoverlay重複、page横overflow、focus消失、stale判定、他候補配置の重複表示がない。

## Evidence and Completion

- 自動証拠: domainと表示の単体試験、Worker経由のブラウザ試験、履歴、IndexedDB、JSON往復、WebGL必須能力ゲートと読み取り専用救出回帰を個別の終了コードで記録する。
- 仕様1.2.0自動証拠: typecheck、lint、単体28ファイル952件、ブラウザ81件、buildに合格。AC-05の候補0/1/100、keyboard・overflow、4辺anchor・候補寸法差A→B→A、共有camera、3軸annotation、固定action行列、lamp/dialog、使用事項の保存成功・session-only失敗、下段safe areaとconsole error 0を回帰した。これは人間または実務利用者受入の証拠ではない。
- 仕様1.2.1自動証拠: typecheck、lint、単体28ファイル952件、ブラウザ89件、buildに合格。tablistが3D viewport外の直前にありcanvasと非重複であること、狭幅・多数候補のscrollでcanvas文書位置と寸法を変えないこと、`整数 mm`だけの可視寸法と外向きmarker契約、icon-only lampの状態別icon・accessible name・件数・最新dialogを回帰した。camera平行移動はsource contractと実画面確認に分け、headless browserの自動証拠とは扱わない。これは人間または実務利用者受入の証拠ではない。
- 開発チーム内試用: 4ケースの完了可否、console、狭幅、キーボード、focus、誤認し得る表示を記録する。
- 実務利用者試用: 評価担当、日程、事前説明、観察結果、合否、改善点を匿名で記録する。未実施中は「実務受入済み」としない。
- canvas追加操作の判断: AC-01で、利用者がZ・向き・取り外しを補助なしで完了できなかった観察証拠がある場合だけ、既存commandを使う最小のコンテキスト操作を設計する。自由なZ dragは正確な支持高さを保証できないため既定案にしない。
- 現在のUI-assisted観察: Codex UIテスターによる[部分観察](evidence/phase1-development-ui-trial-8c8ece2.md)では、AC-01〜03、通常経路のJSON再読込、WebGL非対応fallbackでのZ編集・物理判定・履歴・端末保存、305 / 320 / 375 px、主要focus、console 0件を画面操作で確認し、向き・削除・JSON・自動提案controlは有効状態だけを確認した。Z・向き・取り外しはフォームで発見できたためcanvas側追加操作の根拠にはしないが、exact floor dragは3回の誤座標commitを要し、狭幅時の向き補足文とともに改善候補となった。WebGL非対応時の向き変更・取り外し・JSON往復、自然なTab順と確認後focus、人間による安全表示理解は未観察で、人間試用または実務受入の証拠ではない。
- 現在の人間観察: 人間のプロジェクト評価者による[案内付き部分評価と再試用](evidence/phase1-human-ui-trial-4e6c680.md)では、匿名派生ケースの3D床面移動、正確な座標修正、向き、配置削除・Undo、完全支持・1 mm支持不足、床突き抜け、端末保存・読込、JSON往復に加え、仕様0.12.0版のwheel page scroll、camera button、完全drag-out、Undo/Redo、不適合表示をChromeで確認した。改善後の再試用では、仕様0.18.1の固定X/Z回転button、天地無用だけの向き設定、使用可否の枠表示、端末再読込、F回転時のHを含む他積荷の位置維持を期待どおりと判定した。さらに `HUT-01` のA/B派生fixtureで、床貫通1件だけの表示、Z=0修正後の単独支持と構造・安定性未確認、Undo/Redo往復をすべて期待どおりと確認した。狭幅・Tab・focusは期待どおりと確認した。WebGL fallback試用は、評価者が3Dなしの操作を不適切と判断して中止し、仕様1.0.0の必須ゲートへ置換した。必須ゲートの初回試用では阻止動作とdownload自体は概ね想定どおりだったが、「JSON救出」という語と変化の乏しい画面から対象・結果・次行動を理解できないと評価された。仕様1.0.1の説明・結果表示を実装したが、人間による再確認、正式fixture、評価者区分は未確認のため、実務利用者受入ではない。

### Current Automated Mapping

- AC-01: `tests/browser/acceptance.spec.ts` が正確な合成データでフォームによる向き変更、確認付き取り外し、undo、未確認理由を実行する。WebGL有効時の選択・床面dragは `tests/browser/scene.spec.ts` の独立回帰で覆う。
- AC-02: `tests/browser/acceptance.spec.ts` が正確な合成データで単独支持、Xを1 mmずらした条件未確認の張り出し、undo復元を実行する。`tests/browser/scene.spec.ts` が支持面への実drag snapと一回のUndo/Redoを実行する。
- AC-03: domain、表示、Worker protocolの単体試験と `tests/browser/acceptance.spec.ts` が、床突き抜け、開口、耐荷重の順序とカスケード抑制を実行する。
- AC-04: `tests/browser/history.spec.ts`、`tests/browser/persistence.spec.ts`、`tests/browser/placement.spec.ts`、`tests/browser/scene.spec.ts` がWebGL利用可能時の履歴、IndexedDB、固定JSON往復を実行し、`tests/browser/capability.spec.ts` が非対応・初期描画失敗・context lossの全面停止と2種類の読み取り専用救出を実行する。
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

## Automatic Proposal Synthetic Cases

自動提案は、以下を実務利用者受入とは分けた技術受入として段階的に検証する。純粋探索、未適用preview、確認付き一括適用と一回のUndo/Redoを実装済みで、AP-08代表規模の実時間測定も記録環境で完了した。

- AP-01 Candidate objective: 共通して隙間0、積荷1個 `50×50×50 mm`、1,000 g、`LWH` のみを使う。容積比較は `small=200×100×100` が `large=300×100×100` に勝つ。同容積比較は `floor-small=100×100×200` が `floor-large=200×100×100` に勝つ。同容積・床面積比較は `length-small=100×200×100` が `length-large=200×100×100` に勝つ。同寸法比較は入力配列と表示名を入れ替えても `container-a` が `container-b` に勝つ。各候補の開口と耐荷重は積荷を許容する値とする。
- AP-02 Complete plan only: 隙間0、候補 `200×100×100 mm`、開口 `100×100 mm`、耐荷重2,000 g、積荷 `cargo-a` と `cargo-b` を各 `100×100×100 mm`、1,000 g、`LWH` のみとする。期待案は `(0,0,0)` と `(100,0,0)` に各積荷を一度ずつ置く。同じ出力から一方欠落、重複、未知ID、候補混在を作り、適用境界ですべて拒否する。候補長さを199 mmにした派生fixtureでは部分案を適用不可とする。
- AP-03 Exact single support accepted: 隙間0、候補 `100×100×200 mm`、開口 `100×200 mm`、耐荷重2,001 gとする。`support` は `100×100×100 mm`、1,001 g、支持可、`upper` は同寸法、1,000 g、支持不可とする。期待案はsupportを `(0,0,0)`、upperを `(0,0,100)` に置き、不適合0、積荷別未確認0とする。寸法適合した両積荷の搬入経路理由と、単独支持だけを根拠にした構造・安定性理由は生成しない。非保証範囲は版付きの「使用上の重要事項」で確認できる。
- AP-04 Cutoff semantics: 純粋なattempt予算fixtureで候補1〜10,000回目を評価し10,001回目を拒否、要求1〜1,000,000回目を評価し1,000,001回目を拒否する。9,999回で自然終了、10,000回目で自然終了、10,000回後に未探索あり、上限ちょうどで成功を別々に固定する。より優先される候補が完全案なしcutoff、次候補が完全案の集約fixtureでは `complete-with-cutoff`、次候補選択、目的上最良未確認の専用警告、適用可とする。順位を逆転した時は劣後候補を探索せず通常成功とする。
- AP-05 No complete plan: 隙間0、積荷 `101×100×100 mm`、1,000 g、`LWH` のみと、各 `100×100×100 mm`、開口 `100×100 mm`、耐荷重1,000 gの不可能候補2個を使う。向き事前filterでattempt 0、全候補探索済み、`no-complete-plan`、cutoffなし、適用不可、実積載不能の非証明copyを期待する。
- AP-06 Preview and apply: 探索、preview、取消、失敗、staleでは現在Projectと履歴を同一参照で保持し、確認付き適用だけが配置を一括置換する。Undo/Redoで探索前後を正確に往復する。
- AP-07 Determinism: 同じ正規CLP、アルゴリズム版、探索上限から、候補・積荷配列順や表示名に依存しない同じ案と理由順を返す。
- AP-08 Worker and performance: 隙間0、`200×200×200 mm`、1,000 g、`LWH` の積荷20個と、候補 `1,000×800×1,000 mm`、開口 `800×1,000 mm`、十分な耐荷重を代表fixtureとする。記録環境でWebGL 2利用可能状態のcold 1回とwarm 3回を各5秒以内、取消要求からWorker終了・idle観測まで250 ms以内とする。main timer/rAF、キーボード、305/320/375 pxを別行で検証する。別の純粋候補点fixtureでは1,000配置相当から各軸を重複排除・昇順化し、Z→X→Yの期待順で2,048点以下だけを生成して停止し、直積全体を中間配列へ展開しないことを検証する。

空入力fixtureは、積荷0・候補ありと両方0を `no-cargo`、積荷あり・候補0を `no-candidates` とし、attempt 0、previewなし、適用不可、履歴変更なしを期待する。

### Automatic Proposal Automated Mapping

- AP-01、AP-02、AP-03、AP-04、AP-05、AP-07: domain、Worker protocol/client、session/viewの単体試験が目的順位、完全案、単独支持時の未確認0件、cutoff、完全案なし、決定性と入力順非依存を検証する。
- AP-06: `src/application/automatic-proposal-apply.test.ts` と `tests/browser/automatic-proposal.spec.ts` が、実Workerの完全案、未適用表示、Project・履歴の非変更、適用直前の再検証、常時確認、配置だけの一括置換、同一案no-op、一回のUndo/Redo、通常編集・未保存入力・保存・JSON置換によるstale、遅延結果破棄を検証する。
- AP-08: `tests/browser/automatic-proposal-performance.spec.ts` が、WebGL 2利用可能状態でproduction module Workerを使う20積荷fixtureのcold 1回・warm 3回、各210 attempts、同一result hash、main timer/rAF進行、別fresh UI pageでのnative `terminate()` と取消表示、250 ms late-response mask、consoleを検証する。`automatic-proposal-v2` の記録は [AP-08技術証拠](evidence/automatic-proposal-ap08-733b250.md) に保存する。既存browser試験のcontrolled Worker取消、keyboard、305/320/375 px回帰は独立して維持する。
- 空入力: 同browser試験が実Workerの `no-cargo` と `no-candidates`、attempt 0相当の固定表示、Project・履歴の非変更を検証する。

AP-04の上限試験は、`1..N` の順序付きattempt記述子を生成して指定ordinalだけを成功させられる純粋なtest infrastructureを使う。これはProjectの設定や利用者入力へ公開しない。AP-08の記録にはcommit SHA、algorithm・Schema版、browser/Playwright/OS、CPU、logical processor数、RAM、電源状態、cold/warmと反復番号、viewport、WebGL状態、積荷・候補数、選択候補、候補別・要求attempt数、結果・cutoff源、配置・不適合・未確認件数、結果hash、開始・完了・経過、取消・Worker終了・取消遅延、timer/rAF回数と最大遅延、console warning/error、合否、備考を含める。記録環境以外の性能、headed実行、最低GPU、実務受入は未検証である。
