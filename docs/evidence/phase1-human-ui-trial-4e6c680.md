# Phase 1 Human UI Trial — Guided Development Observation

- Status: Partial human evidence
- Checkpoint: `CP-PHASE1-HUMAN-UI-TRIAL-001`
- Product commit: `4e6c6808d0376317ef125ef8983b1f1dabae1dc2`
- Recorded: 2026-08-28
- Browser path: User-operated Chrome at `http://127.0.0.1:4174/`
- Evaluator category: Human project evaluator; domain-practitioner status not established
- Data classification: Anonymous synthetic data only
- Related acceptance: [Phase 1 synthetic acceptance contract](../acceptance.md)
- Related roadmap: [Auto CLP roadmap](../roadmaps/auto-clp.md)

## Classification and Limits

人間の評価者が、案内を受けながら実Chrome上のAuto CLPを操作した人間評価である。Codexはローカル専用serverの起動、画面状態の読取り、試用手順の案内だけを行い、積荷・候補・配置・保存・ファイル選択は評価者自身が操作した。評価者が開発チームまたは実務担当者に該当するかは確認していない。

実務担当者であることは確認しておらず、正式な実務利用者受入ではない。また、試用データは `acceptance.md` の意図と1 mm境界を保った案内用派生fixtureで、AC-01〜04の全数値をそのまま再現したものではない。したがって、Phase 1の人間試用を部分的に前進させる証拠として扱い、正式な実務受入、安全保証、全受入ケース合格には読み替えない。

## Synthetic Trial Data

- 候補「テスト荷室」: 内部 4,000 × 2,400 × 2,400 mm、開口 2,200 × 2,200 mm、耐荷重 1,000 kg。
- 積荷A/B: 各 1,000 × 800 × 600 mm、100 kg。Aだけ段積み支持可。既定許可向きは `LWH` / `WLH`。
- 正常段積み: A `(200, 100, 0)` / `WLH`、B `(200, 100, 600)` / `WLH`。
- 1 mm支持不足: BのXだけ201 mm。
- 床突き抜け: AのZだけ-1 mm。BはZ=600 mmのままとし、床突き抜けと支持不足を同時に観察した。

## Observed Results

### Manual placement, exact coordinates, orientation, removal, and history

- 3D上の積荷選択と床面dragは、目標の案内後に評価者自身の操作で完了した。
- `(100, 100, 0)` からXだけ100 mm増やす目標に対し、最初のdrag確定値は `(2759, 94, 0)` だった。評価者は移動自体には成功したが、「配置一覧」という案内語に一致する見出しを発見できず、実際の「配置」→「選択候補の配置」にある確定座標へ直ちに到達できなかった。
- 配置フォームで `(200, 100, 0)` へ正確に修正でき、数値入力による微調整は有用と評価された。
- `LWH` / `WLH` と実際の向きを頭の中で対応させる操作は難しいと評価された。案内後もBを `LWH` のまま保存し、Aの `WLH` 底面と一致せず支持不適合になった。向きを `WLH` へ直すと不適合は解消した。
- 配置の確認付き削除とUndoは完了し、Aの `(200, 100, 0)` / `WLH` が復元された。一方、Undo/Redoが3D描画から離れていて使いにくいと評価された。
- ある視点から積荷を遠くへdragした時に荷室が非常に小さく表示され、元の見やすい大きさへ戻せなかった。ホイールだけでなく `＋` / `－` の拡大・縮小ボタンと、遠い積荷の投影範囲に左右されず荷室を基準に戻す操作が必要と評価された。
- 全体レイアウトは調整が必要という評価だったが、「やりたいことをどう操作すればよいか」は全体として直感的で高評価だった。

### Physical diagnostics

- 完全支持時は不適合0件、A/Bの搬入経路未確認2件、Bの構造・安定性未確認1件となり、3件の意味を理解できた。
- BをX方向へ1 mmずらした時、B底面がA上面へ100%載っていないことを理由文から正しく理解できた。Undoで完全支持と未確認3件へ戻った。
- AをZ=-1 mmへ変更すると、床突き抜けが先頭の不適合理由となり、評価者は修正対象を識別できた。独立した搬入経路未確認2件も保持された。
- 一方、AをZ=0へ戻せば解消するBの支持不足まで2件目の不適合として表示された。これは境界違反だけを原因とする他積荷の支持不足を連鎖表示しない現仕様、ADR 0012、ADR 0014に反する実装不具合 `HUT-01` であり、この観察をAC-03合格とは扱わない。

### Local persistence and JSON portability

- 「端末へ保存」の成功文を確認し、AをX=300 mmへ変更した後の「端末保存を読込」で保存時のX=200 mmへ復元した。端末保存と端末保存読込の違いは理解できた。
- 固定位置へ残る操作結果文は、今行った操作への応答か以前の状態説明か分かりにくいと評価された。即時のSnackbar等と、持続する保存状態表示を分ける改善が提案された。
- JSON書出しでChromeが `auto-clp-project-0.1.0 (1)` と表示するファイルをdownloadした。AをX=300 mmへ変更後、同じJSONの手動file選択と再読込でX=200 mmへ復元した。
- JSON保存時に利用者が名前を指定し、既定値を案件名にしたいという要望が出た。ただし現仕様とADR 0013は、案件名・入力値をファイル名へ反射せず `auto-clp-project-0.1.0.json` に固定する。これは観察結果だけでは変更せず、security、互換性、標準downloadの限界、sanitization、rollback、必要試験を示した別承認を要する仕様変更候補とする。

## Improvement Classification

### Supported within the current specification

1. **Floor-cascade defect `HUT-01`:** 床突き抜けをZ=0へ修正した場合だけ成立する支持関係を診断依存として扱い、その境界違反だけから派生する上段の支持不足を抑制する。無関係な未支持荷、開口、耐荷重等の独立理由は抑制しない。
2. **Explicit zoom and recovery:** 3Dに `＋` / `－` ボタンを追加し、既存ホイール操作も維持する。「視点を初期位置へ戻す」は、遠くへ移動した積荷を含む全投影fitと区別して「荷室全体を表示」を提供し、荷室を再び作業可能な大きさへ戻す。
3. **Non-persistent staging area:** 未配置積荷を荷室外の仮置き場へscene派生表示し、荷室へdragした時に初めて配置commandを確定する案を設計する。最初から境界不適合の配置として保存せず、未配置と不適合配置を混同しない。正確な座標フォームは微調整経路として維持する。
4. **Canvas-side 90-degree rotation:** 3Dで選択した積荷のそばに、許可向きだけを循環する「床面で90°回転」操作と回転previewを追加する。ADR 0007は回転UIが許可向きだけを循環することを既に要求し、現仕様は3D空間での回転を範囲に含む。
5. **Scene-local action grouping:** 選択積荷の確定座標、正確な編集への導線、配置削除、Undo/Redoを3D作業領域の近くへまとめる。既存commandと履歴を再利用し、同じ操作を別経路で再実装しない。
6. **Human-readable orientation copy:** `LWH` / `WLH` は詳細コードとして残し、主要表示には「長さ方向が荷室の奥」「床面で90°回転」等の結果指向表現と寸法previewを併記する。
7. **Transient versus persistent status:** 操作直後の成功・失敗をaccessible Snackbarで通知し、端末保存の有無・最終保存状態など持続情報は保存panelへ残す。消える通知だけでエラーや確認要求を表さない。
8. **Persistence navigation drawer:** 端末保存・JSON入出力をNavigation Drawerへまとめ、3D作業領域を節約する。保存状態はdrawerを閉じても識別できる入口表示を保ち、キーボードfocus、狭幅、WebGL非対応、処理中lockを維持する。

### Requires a separately approved specification and ADR change

- 案件名を既定のJSONファイル名へ使うこと、または利用者がJSONファイル名を指定すること。現在の固定名・非反射security境界と衝突するため、本証跡だけで実装しない。

## Remaining and Unverified

- `acceptance.md` の正確な全fixtureを人間が再現した証拠。
- 305 / 320 / 375 pxにおける人間の補足文理解、自然なTab順、削除・読込確認後の自然なfocus。
- 人間によるWebGL 2非対応fallbackの向き変更、配置削除、JSON往復。
- 試用中のconsole warning/error確認。
- 自由なZ drag、横倒し4向き、touch/coarse pointer、最低GPU、正式対応ブラウザ。
- 実務利用者による代表ケース、合否、日程、評価担当。
- Snackbar、scene-local layout、canvas回転、可読な向き表示の設計・実装・回帰。
- `＋` / `－`、荷室基準の視点復元、非永続仮置き場、保存Navigation Drawerの設計・実装・回帰。
- `HUT-01` の修正と、今回のA/B座標、無関係な未支持荷、開口・耐荷重、理由順、Worker・ブラウザ表示の回帰。
- JSONファイル名変更候補の承認、sanitization、互換性、browser差、試験。

## Repository and Local Side Effects

- 試用開始時のbranchは `main`、product commitは `4e6c6808d0376317ef125ef8983b1f1dabae1dc2`、リポジトリ差分は0件だった。
- 実在データ、外部通信、deploy、依存導入、Git mutation、破壊的操作は行っていない。
- ローカル副作用は、ChromeのIndexedDB単一保存枠と、利用者の既定download先にある匿名合成JSONだけである。downloadは削除していない。
- UI試用server `http://127.0.0.1:4174/` は試用後に停止した。
