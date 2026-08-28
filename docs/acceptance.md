# Phase 1 Synthetic Acceptance Contract

- Status: Active
- Last updated: 2026-08-28
- Scope: Phase 1 — ローカル3D手動配置試作
- Data classification: 匿名の合成データのみ

## Purpose and Limits

この文書は、Phase 1の主要操作と安全側の表示を同じ再現可能な案件で確認するための技術受入契約である。実在顧客、実貨物、搬送記録を使わず、以下の値をそのまま使う。

合成ケースの自動試験または開発チーム内試用に合格しても、精密機器運送の実務担当者による受入、実積載の安全性、完全な搬入経路、構造強度、安定性、法令適合性を証明しない。実務利用者の試用結果は別の観察記録として残す。

## Common Pass Criteria

- 入力、3D確認、物理判定、履歴、保存・再読込を、秘密情報や外部通信なしで完了できる。
- 不適合、未確認、判定不能を区別し、不適合があっても独立した開口・耐荷重理由を失わない。
- 「適合」または「未確認」を、実積載の安全保証として表示しない。
- 成功した案件変更だけを1件の履歴操作とし、失敗とno-opは履歴を増やさない。
- WebGL 2を利用できない場合も、フォーム、物理判定、履歴、保存・再読込を利用できる。
- キーボード操作と305、320、375 px幅で、主要操作、理由、確認、focusを失わない。

## AC-01 Floor Layout and Manual Editing

### Data

- 案件隙間: X 100 mm、Y 100 mm、Z 100 mm。
- 候補「合成コンテナA」: 内部 4,000 × 2,400 × 2,400 mm、開口 2,200 × 2,200 mm、耐荷重 3,000 kg。
- 積荷「合成積荷A」: 1,200 × 800 × 600 mm、500 kg、段積み可、許可向き `LWH` / `WLH`。初期配置 `(100, 100, 0)` / `LWH`。
- 積荷「合成積荷B」: 800 × 600 × 500 mm、400 kg、段積み不可、許可向き `LWH` / `WLH`。初期配置 `(1,500, 100, 0)` / `LWH`。

### Steps and Expected Results

1. 3Dで積荷Aを選択し、fine pointerで床面方向へdragして、保存後の最小角を `(200, 100, 0)` にする。Xだけが100 mm増え、Y、Z、向きは変わらない。
2. 取り消しで初期値 `(100, 100, 0)`、やり直しで指定値 `(200, 100, 0)` が正確に復元される。
3. 配置フォームで積荷Bを `WLH` に変更する。不許可向きは選択できない。
4. 積荷Bを確認付きで取り外し、取り消しで復元する。
5. 不適合理由は0件で、各積荷の `opening-path-unverified` は保持され、安全保証ではない注意が表示される。

### Acceptance Observation

3D選択後にフォームでZ、向き、取り外しを完了できたかを記録する。操作を発見できない、一覧への移動で作業を中断する、または座標誤りが繰り返される場合だけ、canvas近傍の追加操作を検討する。

## AC-02 Exact Stack and 1 mm Support Failure

### Data

- 案件隙間: X/Y/Zすべて0 mm。
- 候補「合成コンテナB」: 内部 3,000 × 2,000 × 2,000 mm、開口 2,000 × 2,000 mm、耐荷重 2,000 kg。
- 下段「合成支持台」: 1,000 × 800 × 500 mm、500 kg、段積み可、`LWH`、配置 `(500, 500, 0)`。
- 上段「合成上段荷」: 1,000 × 800 × 400 mm、300 kg、段積み不可、`LWH`、配置 `(500, 500, 500)`。

### Steps and Expected Results

1. 完全一致配置では不適合理由が0件となる。両積荷の `opening-path-unverified` と、上段の `structure-stability-unverified` は残る。
2. 上段Xを501 mmへ変更する。底面が1 mmだけ支持面から外れ、`support-not-full` が1件表示される。隙間0 mmのためpair隙間理由は追加しない。
3. 取り消しでX=500 mmへ戻し、完全支持と構造・安定性未確認の表示を復元する。

## AC-03 Independent Floor Penetration Diagnostics

### Data

- 案件隙間: X/Y/Zすべて0 mm。
- 候補「合成コンテナC」: 内部 3,000 × 2,400 × 2,400 mm、開口 1,700 × 2,100 mm、耐荷重 100 kg。
- 積荷「合成不適合荷」: 1,000 × 1,800 × 2,300 mm、100.001 kg、段積み不可、許可向き `LWH` のみ、配置 `(100, 100, -1)`。

### Steps and Expected Results

1. `floor-penetration` を対象積荷の先頭の不適合理由として表示し、Zを0以上へ直すよう案内する。
2. 同じ座標原因から積荷自身の隙間・支持不足、pair重なり・隙間不足を連鎖表示しない。
3. 座標と独立する `opening-no-fitting-orientation` と `payload-capacity-exceeded` を同時に保持する。
4. 搬入経路未確認は、開口寸法自体が不適合のため表示しない。
5. 床以外の壁・天井境界違反は従来どおり `outside-container` として区別する。

## AC-04 Recovery, Portability, and No-WebGL Fallback

### Steps and Expected Results

1. AC-02の案件で上段Xを501 mmへ変更し、取り消し、やり直し、取り消しを行う。最終案件はX=500 mmとなる。
2. 「端末へ保存」後に案件を変更し、「端末保存を読込」する。保存時の正規案件を復元し、履歴、未保存入力、選択、camera、旧判定結果をリセットして再判定する。
3. `auto-clp-project-0.1.0.json` を書き出し、案件を変更してから再読込する。Schema `0.1.0` の正規案件だけを復元し、履歴、camera、判定結果をファイルへ含めない。
4. WebGL 2非対応状態でも同じ案件を読み込み、フォームによるZ・向き・取り外し、物理判定、履歴、端末保存、JSON入出力を利用できる。canvasは表示しない。

## Evidence and Completion

- 自動証拠: domainと表示の単体試験、Worker経由のブラウザ試験、履歴、IndexedDB、JSON往復、WebGL非対応回帰を個別の終了コードで記録する。
- 開発チーム内試用: 4ケースの完了可否、console、狭幅、キーボード、focus、誤認し得る表示を記録する。
- 実務利用者試用: 評価担当、日程、事前説明、観察結果、合否、改善点を匿名で記録する。未実施中は「実務受入済み」としない。
- canvas追加操作の判断: AC-01とAC-04で、利用者がZ・向き・取り外しを補助なしで完了できなかった観察証拠がある場合だけ、既存commandを使う最小のコンテキスト操作を設計する。自由なZ dragは正確な支持高さを保証できないため既定案にしない。
- 現在のUI-assisted観察: Codex UIテスターによる[部分観察](evidence/phase1-development-ui-trial-8c8ece2.md)では、AC-01〜03、通常経路のJSON再読込、WebGL非対応fallbackでのZ編集・物理判定・履歴・端末保存、305 / 320 / 375 px、主要focus、console 0件を画面操作で確認し、向き・削除・JSON・自動提案controlは有効状態だけを確認した。Z・向き・取り外しはフォームで発見できたためcanvas側追加操作の根拠にはしないが、exact floor dragは3回の誤座標commitを要し、狭幅時の向き補足文とともに改善候補となった。WebGL非対応時の向き変更・取り外し・JSON往復、自然なTab順と確認後focus、人間による安全表示理解は未観察で、人間試用または実務受入の証拠ではない。
- 現在の人間観察: 人間のプロジェクト評価者による[案内付き部分評価](evidence/phase1-human-ui-trial-4e6c680.md)では、匿名派生ケースの3D床面移動、正確な座標修正、向き、配置削除・Undo、完全支持・1 mm支持不足、床突き抜け、端末保存・読込、JSON往復をChromeで完了した。基本操作は直感的と評価された一方、確定座標とUndo/Redoが3Dから離れるレイアウト、`LWH` / `WLH` の認知負荷と実際の誤設定、遠いdrag後に荷室が小さくなり視点を復元できない問題、操作結果文の時間的関連、固定JSON名に改善要望が出た。`＋` / `－` と荷室基準の視点復元、荷室外の非永続仮置き場、選択積荷近傍の90度回転、保存Navigation Drawerが追加要望である。派生床突き抜け観察では、Z=0へ戻せば解消する上段支持不足まで連鎖表示したため現仕様不適合 `HUT-01` として不合格である。正式AC-03の数値・構成による人間再現は未実施で、正式fixture、狭幅・Tab・fallback、評価者区分も未確認のため、実務利用者受入ではない。

### Current Automated Mapping

- AC-01: `tests/browser/acceptance.spec.ts` が正確な合成データでフォームによる向き変更、確認付き取り外し、undo、未確認理由、WebGL非対応subsetを実行する。WebGL有効時の選択・床面dragは `tests/browser/scene.spec.ts` の独立回帰で覆う。
- AC-02: `tests/browser/acceptance.spec.ts` が正確な合成データで完全支持、Xを1 mmずらした支持不足、undo復元を実行する。
- AC-03: domain、表示、Worker protocolの単体試験と `tests/browser/acceptance.spec.ts` が、床突き抜け、開口、耐荷重の順序とカスケード抑制を実行する。
- AC-04: `tests/browser/history.spec.ts`、`tests/browser/persistence.spec.ts`、`tests/browser/placement.spec.ts`、`tests/browser/scene.spec.ts` が履歴、IndexedDB、固定JSON往復、WebGL非対応fallbackを分担して実行する。
- 2026-08-28時点の統合証拠は全単体839件、全ブラウザ63件、型、lint、build、データ契約、文書、ガバナンス検証の成功である。開発チーム内試用と実務利用者試用の証拠ではない。

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
- AP-03 Unverified preserved: 隙間0、候補 `100×100×200 mm`、開口 `100×200 mm`、耐荷重2,001 gとする。`support` は `100×100×100 mm`、1,001 g、支持可、`upper` は同寸法、1,000 g、支持不可とする。期待案はsupportを `(0,0,0)`、upperを `(0,0,100)` に置き、不適合0、搬入経路未確認2件、upperの構造・安定性未確認1件をpreviewと適用確認に保持する。
- AP-04 Cutoff semantics: 純粋なattempt予算fixtureで候補1〜10,000回目を評価し10,001回目を拒否、要求1〜1,000,000回目を評価し1,000,001回目を拒否する。9,999回で自然終了、10,000回目で自然終了、10,000回後に未探索あり、上限ちょうどで成功を別々に固定する。より優先される候補が完全案なしcutoff、次候補が完全案の集約fixtureでは `complete-with-cutoff`、次候補選択、目的上最良未確認の専用警告、適用可とする。順位を逆転した時は劣後候補を探索せず通常成功とする。
- AP-05 No complete plan: 隙間0、積荷 `101×100×100 mm`、1,000 g、`LWH` のみと、各 `100×100×100 mm`、開口 `100×100 mm`、耐荷重1,000 gの不可能候補2個を使う。向き事前filterでattempt 0、全候補探索済み、`no-complete-plan`、cutoffなし、適用不可、実積載不能の非証明copyを期待する。
- AP-06 Preview and apply: 探索、preview、取消、失敗、staleでは現在Projectと履歴を同一参照で保持し、確認付き適用だけが配置を一括置換する。Undo/Redoで探索前後を正確に往復する。
- AP-07 Determinism: 同じ正規案件、アルゴリズム版、探索上限から、候補・積荷配列順や表示名に依存しない同じ案と理由順を返す。
- AP-08 Worker and performance: 隙間0、`200×200×200 mm`、1,000 g、`LWH` の積荷20個と、候補 `1,000×800×1,000 mm`、開口 `800×1,000 mm`、十分な耐荷重を代表fixtureとする。記録環境でcold 1回とwarm 3回を各5秒以内、取消要求からWorker終了・idle観測まで250 ms以内とする。main timer/rAF、WebGL非対応、キーボード、305/320/375 pxを別行で検証する。別の純粋候補点fixtureでは1,000配置相当から各軸を重複排除・昇順化し、Z→X→Yの期待順で2,048点以下だけを生成して停止し、直積全体を中間配列へ展開しないことを検証する。

空入力fixtureは、積荷0・候補ありと両方0を `no-cargo`、積荷あり・候補0を `no-candidates` とし、attempt 0、previewなし、適用不可、履歴変更なしを期待する。

### Automatic Proposal Automated Mapping

- AP-01、AP-02、AP-03、AP-04、AP-05、AP-07: domain、Worker protocol/client、session/viewの単体試験が目的順位、完全案、未確認理由、cutoff、完全案なし、決定性と入力順非依存を検証する。
- AP-06: `src/application/automatic-proposal-apply.test.ts` と `tests/browser/automatic-proposal.spec.ts` が、実Workerの完全案、未適用表示、Project・履歴の非変更、適用直前の再検証、常時確認、配置だけの一括置換、同一案no-op、一回のUndo/Redo、通常編集・未保存入力・保存・JSON置換によるstale、遅延結果破棄を検証する。
- AP-08: `tests/browser/automatic-proposal-performance.spec.ts` が、production module Workerを使う20積荷fixtureのcold 1回・warm 3回、各210 attempts、同一result hash、main timer/rAF進行、別fresh UI pageでのnative `terminate()` と取消表示、250 ms late-response mask、WebGL非対応、consoleを検証する。最初の成功記録は [AP-08技術証拠](evidence/automatic-proposal-ap08-1226b082.md) に保存する。既存browser試験のcontrolled Worker取消、keyboard、305/320/375 px回帰は独立して維持する。
- 空入力: 同browser試験が実Workerの `no-cargo` と `no-candidates`、attempt 0相当の固定表示、Project・履歴の非変更を検証する。

AP-04の上限試験は、`1..N` の順序付きattempt記述子を生成して指定ordinalだけを成功させられる純粋なtest infrastructureを使う。これはProjectの設定や利用者入力へ公開しない。AP-08の記録にはcommit SHA、algorithm・Schema版、browser/Playwright/OS、CPU、logical processor数、RAM、電源状態、cold/warmと反復番号、viewport、WebGL状態、積荷・候補数、選択候補、候補別・要求attempt数、結果・cutoff源、配置・不適合・未確認件数、結果hash、開始・完了・経過、取消・Worker終了・取消遅延、timer/rAF回数と最大遅延、console warning/error、合否、備考を含める。記録環境以外の性能、headed実行、最低GPU、実務受入は未検証である。
