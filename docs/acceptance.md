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

### Current Automated Mapping

- AC-01: `tests/browser/acceptance.spec.ts` が正確な合成データでフォームによる向き変更、確認付き取り外し、undo、未確認理由、WebGL非対応subsetを実行する。WebGL有効時の選択・床面dragは `tests/browser/scene.spec.ts` の独立回帰で覆う。
- AC-02: `tests/browser/acceptance.spec.ts` が正確な合成データで完全支持、Xを1 mmずらした支持不足、undo復元を実行する。
- AC-03: domain、表示、Worker protocolの単体試験と `tests/browser/acceptance.spec.ts` が、床突き抜け、開口、耐荷重の順序とカスケード抑制を実行する。
- AC-04: `tests/browser/history.spec.ts`、`tests/browser/persistence.spec.ts`、`tests/browser/placement.spec.ts`、`tests/browser/scene.spec.ts` が履歴、IndexedDB、固定JSON往復、WebGL非対応fallbackを分担して実行する。
- 2026-08-28時点の統合証拠は全単体628件、全ブラウザ51件、型、lint、build、データ契約、文書、ガバナンス検証の成功である。開発チーム内試用と実務利用者試用の証拠ではない。

## Observation Record Template

- Case ID / evaluator category / date / build commit:
- Completed without assistance: yes/no
- Incorrect coordinate or orientation commits:
- Could find Z/orientation/removal controls: yes/no
- Needed canvas-side control, and why:
- Safety status understood as non-guarantee: yes/no
- Keyboard/touch/narrow-width observations:
- Defect IDs and final pass/fail:
