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

## HUT-01 Resolution

- `CP-PHASE1-FLOOR-CASCADE-FIX-001` で、floor-penetrating supporterを診断上Z=0へ正規化した時だけ完全支持となる上段について、派生 `support-not-full` とpair隙間理由を抑制した。
- 実座標で支持が成立していない間は `structure-stability-unverified` を追加しない。無関係な未支持荷、Z不一致、支持不可、XY 1 mm不足、複数支持の1 mm穴は従来どおり不適合を保持する。
- 人間評価fixtureそのものをdomainと実Worker browser回帰へ追加した。修正後は床突き抜け1件を先頭表示し、A/Bの搬入経路未確認2件を保持し、派生支持不足と構造・安定性未確認を表示しない。
- 独立レビューでblocking所見0件を確認した。最終差分で全単体848件、全ブラウザ64件、型、lint、build、データ契約、対象単体76件、対象ブラウザ4件が個別に成功した。buildは既知の1 MB級chunk警告を保持するが、本修正の失敗ではない。
- 人間による同じfixtureの再試用は未実施である。したがって実装・自動回帰上は解決済みだが、人間観察結果そのものを書き換えない。

## Explicit Zoom and Recovery Resolution

- `CP-PHASE1-SCENE-CAMERA-001` で、3D表示内に `＋` / `－` と「荷室全体を表示」を追加し、既存ホイール操作を維持した。
- 初期表示と復元は荷室境界だけを基準にし、遠方の修正途中積荷を全体fitへ含めない。cameraのfarと最大移動距離は全投影範囲から導出し、遠方積荷を描画・移動可能範囲から除外しない。
- camera操作はProject、履歴、JSONへ保存せず、極端座標の純粋境界試験、荷室表示のブラウザ画像回帰、案件・履歴非変更、305 / 320 / 375 px表示で検証した。最終差分で全単体849件・全ブラウザ65件、型、lint、buildが個別に成功し、独立レビューでblocking所見0件を確認した。
- 実Chromeでの人間による操作感と、極端座標の積荷へ縮小・平行移動で再到達する手動操作は未確認である。

## Contextual Floor Rotation Resolution

- `CP-PHASE1-SCENE-ROTATION-001` で、3D上の配置積荷を選択すると、そのmesh近傍に「床面で90°回転」を表示するようにした。主要操作では `LWH` / `WLH` 等のコード解釈を要求しない。
- 回転は `LWH` ↔ `WLH`、`LHW` ↔ `HLW`、`WHL` ↔ `HWL` の相手だけを使い、積荷の許可集合に相手がない場合は理由付きで無効にする。成功時は既存の配置commandを通し、最小X/Y/Z角を保持した一回の履歴操作としてUndo/Redoできる。
- 操作はcamera・resize・drag previewへ追従し、画面外では隠れ、camera操作と重ならず、305 pxでも横overflowしない。キーボード確定後のfocus保持、drag中lock、単一許可向きもブラウザ回帰で確認した。最終差分で全単体855件・全ブラウザ67件、型、lint、buildが個別に成功し、独立レビューでblocking所見0件を確認した。
- 実Chromeでの人間による位置・文言・連続操作の使いやすさ、touch/coarse pointer、screen readerは未確認である。

## Persistence Drawer and Snackbar Resolution

- `CP-PHASE1-PERSISTENCE-UX-001` で、端末保存・読込・確認削除とJSON書出し・読込を「案件データ」から開く右側Navigation Drawerへ集約した。保存形式、固定JSON名、IndexedDB、Worker事前判定、履歴barrier、競合境界は変更していない。
- Drawerは全幅でモーダル契約を使い、背景pointer、Tab移動、案件Undo/Redo shortcutを遮断する。開時は閉じる操作、閉じる操作とEscape後は入口へfocusを移し、処理開始でfile inputがdisabledになった場合もfocusをDrawer内へ保持する。処理中に閉じても処理自体は継続する。
- 処理中・成功・取消・失敗は通知ID付きSnackbarへ表示する。同じ文の連続操作も新しい通知とし、成功・取消は6秒、失敗は明示closeまで保持する。Drawer内の直近結果は二重読み上げしない非live表示とした。
- 保存13件、scene16件、自動提案11件の対象ブラウザ回帰と独立レビュー3巡で、狭幅、削除確認、非同期処理、背景操作、camera測定fixtureも確認した。最終差分で全単体855件・全ブラウザ70件、型、lint、buildが個別に成功し、blocking / nonblocking所見0件を確認した。
- 実Chromeでの人間によるDrawer位置・通知寿命・文言の使いやすさ、実screen reader、touch端末、Chromium以外は未確認である。

## Non-persistent Staging Resolution

- `CP-PHASE1-STAGING-001` で、案件全体で未配置の積荷を、選択荷室の負X側開口外にある暖色の非永続仮置きgridへ派生表示した。他の候補へ配置済みの積荷は重複表示せず、Project、JSON、端末保存、履歴、物理判定へ仮置き状態を含めない。
- 仮置きは積荷順、先頭許可向き、Z=0、100 mm間隔、最大向き適用寸法から決定的に配置する。fine pointerで直方体全体が生の荷室内へ入ったdropだけを既存配置追加commandへ渡し、一回の履歴操作として確定する。外側、no-op、競合、取消は開始位置へ戻して案件を変更しない。
- 確定後も選択を保持して近傍回転を表示し、Undoで仮置きへ復帰、Redoで配置へ戻る。touch/coarse pointerは選択だけとし、WebGL非対応を含む座標フォームを初回配置と微調整のfallbackとして維持する。
- 全6向き、他候補除外、0 / 1 / 1,000件の純粋投影、非変異、camera bounds、荷室内・外drop、配置済み・仮置き双方のJSON競合、touch、305 / 320 / 375 pxを回帰した。最終差分で全単体862件・全ブラウザ74件、型、lint、buildが個別に成功し、独立レビューでblocking / nonblocking所見0件を確認した。
- 実Chromeでの自由なcamera操作後の掴みやすさ、1,000件の継続FPS、低GPU、実touch端末、Chromium以外は未確認である。

## Scene-local Actions Resolution

- `CP-PHASE1-SCENE-ACTIONS-001` で、案件全体の単一Undo/Redoを3D viewport直前へ移し、既存shortcut、action名、busy、focus、最大100件の履歴を同じhandlerのまま維持した。履歴操作は配置だけでなく案件全体へ作用すると明示した。
- 選択積荷のcanvas外カードへ、向き適用後の奥行・横幅・高さを結果指向で表示した。配置済みは入口から手前面、入口視点の右壁から右側面、床から下面までの最小面位置を表示し、仮置きは保存されない派生座標を表示しない。`LWH`等は折り畳みの保存上詳細に残した。
- 「座標を微調整」「座標を入力して配置」は既存PlacementPanelの追加・編集処理だけを開き、フォームをscrollしてX入力へfocusする。scene側へdraft、command、履歴を複製していない。配置一覧と向き選択も実寸法と上向き元軸を先に表示する。
- 検証中、選択カード展開でcanvas位置が変わるpointer不具合と、scene自己busyの再注入によるフォーム取消後focus漏れを発見し、カードをviewport後へ移し外部busyを分離して修正した。全6向き13件、履歴、scene、配置、受入、自動提案、永続化の回帰を含め、最終差分で全単体875件・全ブラウザ75件、型、lint、buildが個別に成功し、独立レビューでblocking / nonblocking所見0件を確認した。
- 実Chromeでの文言理解、長い向きoptionの読みやすさ、scroll感触、実screen reader/touch、Chromium以外は未確認である。

## Approved Follow-up Resolution

- Checkpoint: `CP-PHASE1-SCENE-FEEDBACK-001`
- Approval state: **Implemented and automated verification complete; human re-trial pending**
- Approved on: 2026-08-28
- Product baseline before the planned governance change: `322ba5a88f70c6dd92585c356937fd911e06645a`
- The approval survived the instruction-chain change and coordinator-task replacement. PM（AutoCLP）-02 verified the exact primary directory `C:\Users\seven\projects\auto-clp`, branch, HEAD, single-worktree state, permissions, and no-change restart callback before implementing this checkpoint; future project callbacks route to that replacement task and host.

The user approved the following combined behavior after direct human operation of the local app:

1. **Wheel scroll:** wheel input over the 3D viewport scrolls the page and no longer zooms the camera. Camera zoom is provided by the explicit `＋` / `－` buttons, and `荷室全体を表示` remains available.
2. **Drag-out removal:** after a placed cargo floor drag is quantized to integer X/Y, a no-op remains a no-op. If the oriented X/Y footprint has positive-area overlap with the raw container floor `[0, L] × [0, W]`, the placement remains saved; partial overhang continues to be diagnosed as an invalid placement. If the overlap area is zero, including face- or edge-only contact, the existing placement is deleted and the cargo returns to the derived staging area as one `placement.delete` history action. Undo restores the former position and orientation; redo returns it to staging. Z is excluded from this gesture boundary so floor penetration, ceiling overrun, and other Z corrections remain saved and independently diagnosed.
3. **Size copy:** the selected-cargo card and placement list use the label `大きさ` instead of `荷室内での大きさ` or `仮置き時の大きさ`; state remains visible through the existing placed/staged copy.

This backward-compatible addition is now recorded as specification `0.12.0` and Accepted ADR 0015 refining ADR 0010. Project Schema `0.1.0`, persisted JSON meaning, serializer, persistence, physical validation rules, and automatic proposal behavior remain unchanged; no saved-data migration is required. The aligned implementation updates the specification, derived data-model boundary, ADR and index, operations, roadmap, changelog, this evidence follow-up, application code, unit/browser tests, and independent review evidence. Rollback is to restore OrbitControls zoom and the placed-drag update-only branch; the persisted format requires no rollback migration.

Automated verification covers page scrolling over the canvas without camera, Project, or history mutation; continued `＋` / `－` zoom and view reset; strict X/Y positive-area overlap boundary unit cases; partial-overhang retention through the existing placement-update path; and full-outside staging with status, physical-Worker target removal, and one-step Undo/Redo. Existing scene, persistence, stale/import, cancellation, touch-scroll, and narrow-viewport regressions remain in the full suite. Progress remains 98% because this refines an already-complete weighted milestone and does not add human acceptance evidence.

独立レビューでは実装上のblocking所見0件を確認し、最初のreviewで既存完全外配置のno-op先行、4辺の1 mm overlapと面接触0、Z除外、全6向きを直接固定する純粋分類試験の不足が中程度の所見として1件挙がった。`placedFloorDragDisposition` を純粋scene adapterとして抽出し、18件の分類試験を追加して所見を解消した。最終差分は全単体907件・全browser76件、型、lint、build、データ契約、文書、ガバナンス、diff検査を個別に通過した。buildは既知の1 MB級chunk advisoryだけを保持する。

Implementation and required automated gates are complete in the primary working directory; the exact immutable commit is the commit containing this updated record. External communication, deployment, external writes, real data, destructive actions, and unrelated specification changes remain unapproved.

## Scene Workbench Follow-up

- Checkpoint: `CP-PHASE1-SCENE-WORKBENCH-001`
- Approval state: **Implemented and automated verification complete; human re-trial pending**
- Approved on: 2026-08-28
- Baseline: `6ea83a1b08ad772a4838c897976cd0232f697221`

仕様0.12.0版の実Chrome再試用で、利用者はwheel page scroll、明示zoom、完全drag-out、Undo/Redo、不適合表示を確認した。その上で次の操作上の問題を報告し、変更を明示承認した。

1. 未配置積荷が固定位置へ戻るため、積荷Aを右、Bを左へ退避してCを扱う人間の段取りができない。荷室外全体を自由な作業スペースにする。
2. Undo/Redoでpageとcameraが動く。buttonをzoomと並べ、同じ見た目にする。
3. 回転を大きな説明付きbuttonでなくicon-onlyにし、X軸とZ軸の2種類を提供する。天地無用ではX軸回転を防ぐ。
4. 選択cardは積荷名を見出しとし、「選択中の積荷」と `大きさ:` を除き、寸法と座標をcompactに整理する。
5. 多数積荷から意図した対象を識別できる経路を提供する。
6. 将来は、未配置作業状態を保つ複数候補tabと積荷画像を検討する。いずれも今回の実装範囲には含めない。

実装は、初回gridを残しながら荷室外dropのcargo ID別poseをUI sessionだけに保持する。荷室内へ全体が入れば `placement.add`、一部だけ重なる曖昧なdropは直前位置、全体が外なら自由作業位置となる。配置済み完全drag-outはdrop poseを保持して一回の `placement.delete` とし、Undo/Redoで元配置と同じ外側poseを往復する。外側poseと外側回転はProject、JSON、IndexedDB、物理判定、案件履歴へ入らない。

X/Z回転は既存 `allowedOrientations` だけを使い、天地無用を `LWH` / `WLH` の入力補助として実装した。したがってSchema `0.1.0` は変更しない。orientation codeは面の表裏を持たないため、天地無用は横倒し防止に限定し、上下反転保証とは表示しない。

履歴buttonはviewport内で `＋` / `－` と同じcompact toolbarへ一組だけ統合した。同一候補のProject更新でcamera position/targetを保持し、履歴実行前のpage scrollを復元する。配置・物理panelをviewport後方へ移し、積荷picker、icon-only X/Z回転、積荷名見出し、prefixなし寸法、compact X/Y/Z cardを追加した。

純粋試験は全6向きのX/Z mapping、session override、X/Y面接触0と1 mm正面積境界、許可向き・寸法変更後fallbackを含む。browser回帰は荷室外自由移動の非履歴、picker、荷室内配置、完全drag-out、荷室外X/Z回転の成功と重なり拒否、天地無用、camera/page保持、icon/ARIA、wheel、touch、WebGL fallback、305/320/375 pxを含む。最終差分は全単体922件・全browser80件、型、lint、build、データ契約、文書、ガバナンス、diff検査を個別に通過した。独立レビューでは、回転・寸法編集後に荷室床面へ入り込むsession poseとADR routing漏れが見つかり、回転拒否、投影時fallback、境界回帰、文書mapを追加して解消した。

仕様は0.13.0、ADR 0017はAccepted、Schemaは0.1.0、進捗は98%を維持する。進捗を増やさない理由は、完了済み3D milestoneの操作改善であり、実務利用者受入の残り2点を満たす新しい人間証拠ではないためである。

## Remaining and Unverified

- `acceptance.md` の正確な全fixtureを人間が再現した証拠。
- 305 / 320 / 375 pxにおける人間の補足文理解、自然なTab順、削除・読込確認後の自然なfocus。
- 人間によるWebGL 2非対応fallbackの向き変更、配置削除、JSON往復。
- 試用中のconsole warning/error確認。
- 自由なZ drag、横倒し4向き、touch/coarse pointer、最低GPU、正式対応ブラウザ。
- 実務利用者による代表ケース、合否、日程、評価担当。
- scene-local layout、結果指向の向き表示、座標フォーム導線、案件履歴の人間による再試用。
- 非永続仮置き場の人間による見つけやすさ・掴みやすさ・荷室内dropの再試用。
- `CP-PHASE1-SCENE-FEEDBACK-001` は人間再試用でwheel scroll、camera button、完全drag-out、Undo/Redo、不適合表示を確認した。固定仮置き、履歴時のpage/camera移動、回転・cardの大きさが後続改善として観察された。
- `CP-PHASE1-SCENE-WORKBENCH-001` の荷室外自由作業位置、picker、X/Z回転、天地無用、compact toolbar/card、camera/page保持は人間再試用で期待どおりと確認された。後続の支持面snapも下記の再試用で確認済みである。

## Compact Scene UX Follow-up

- Checkpoint: `CP-PHASE1-SCENE-UX-COMPACT-001`
- Date: 2026-08-29
- Source: 同じ人間評価者による仕様0.13.0再試用と、確定前の3名による独立read-onlyレビュー

評価者は荷室外自由退避、天地無用によるX軸回転制限、Z軸回転、camera button、完全drag-out、Undo/Redo、compact cardを概ね期待どおりと評価した。一方、drag status出現によるviewport移動、未配置partialだけのrollback、同形状のX/Z icon、座標フォームへのscroll、多数積荷で常設一覧がページを伸ばす点を課題とした。partialは開始位置によらず修正途中配置として保持し、数値編集はdialogへ、全積荷の検索・状態表示とCRUD入口は選択cardへまとめる案が提示された。

確定前レビューは、no-op先行、X/Y三状態分類、Z除外、gesture以外への非適用、他候補所有権、dialogのfocus・dirty・busy、配置削除と積荷削除の非cascade、使用中向き削除拒否、狭幅、fixed status、distinct iconを明文化すれば整合すると判断した。指摘を反映した仕様をユーザーが明示承認し、仕様0.14.0とADR 0018へ確定した。Schema 0.1.0と進捗98%は維持する。

実装は純粋 `classifyFloorFootprint`、全Project積荷select、compact選択card、共有modal shell、積荷定義・配置別editor、focus可能な `aria-disabled` X/Z icon、固定高statusを使用する。最終差分では全単体928件・全browser69件、型、lint、buildを個別に通過した。データ契約、文書、ガバナンス、diff検査もcommit前後に個別実行して記録する。人間による0.14.0版の再試用は未実施であり、自動検証結果は実務利用者受入または安全保証ではない。

## Support Snap Human Re-trial and Opening-message Follow-up

- Date: 2026-08-30
- Evaluator: 同じ人間のプロジェクト評価者
- Environment: ローカルChrome、`http://127.0.0.1:4174/`、匿名合成データ

評価者は、単一支持面上へのdrag snapと面内移動、小さい支持面による支持条件未確認、複数支持・隙間・張り出しの条件未確認、接触面なし・Z不一致・支持不可面・立体重複の不適合、dropの一回履歴とUndo/Redoを含む6項目をすべて期待どおりと確認した。これにより仕様0.15.0の支持面操作に関する案内付き人間再試用は合格とする。ただし、実積載の構造強度・安定性・安全性を保証する証拠ではない。

同じ試用で、寸法上開口に収まる積荷ごとに同一の搬入経路未確認メッセージが多数表示されることと、drag中に他積荷が通常色のままで操作対象を追いにくいことが改善点となった。評価者は、現段階で完全な搬入経路の追加要件を確認できないため個別メッセージを廃止し、具体的な将来要望が生じた時に改めて設計する方針と、drag対象以外をほぼ透明な中立面・灰色点線、支持候補を緑または黄の点線とする仕様を承認した。仕様0.16.0とADR 0020へ反映し、恒常的な非保証注意は維持する。新しいdrag集中表示の人間再試用は未実施である。

自動回帰では、寸法適合時の理由0件、寸法不適合の専用理由、旧Worker理由の拒否、支持理由と自動提案の保持、drag中の描画変化と取消後復元を含め、全単体939件・全browser71件が成功した。型、lint、build、文書・データ・ガバナンス検査も別々に確認する。これは新しい集中表示の人間試用または実積載の安全証明ではない。

## Drag-focus Re-trial and Fixed Rotation Follow-up

- Date: 2026-08-30
- Evaluator: 同じ人間のプロジェクト評価者
- Environment: ローカルChrome、`http://127.0.0.1:4174/`、匿名合成データ

評価者は仕様0.16.0のdrag集中表示を期待どおりと確認した。一方、承認済みだった回転buttonの固定配置とaxis icon変更が未完了で、mesh追従位置と分かりにくいZ iconが残っていると報告した。利用者の再確認により、円形矢印ではなく一本の軸線へ矢印が回り込むiconを両軸に使い、Xだけを90度回す形を確定した。

仕様0.17.0とADR 0021は、X/Z回転をUndo/Redo・拡大縮小と同じviewport固定toolbarへ常設し、未選択・天地無用・busy・許可向きなしで位置を保ったまま理由付き無効状態にする。orientation遷移、履歴、Schema `0.1.0`、物理判定は変更しない。人間による新iconの理解と連続回転の再試用は未実施である。

自動回帰では、未選択時の常設と理由、一本の軸線へ矢印が回り込む同一SVG path、Xだけの90度差、天地無用、busy、Z軸2回連続回転後のbutton境界不変、X軸回転とUndoを含め、全単体939件・全browser71件が成功した。型、lint、build、文書・データ・ガバナンス検査も個別に成功し、buildは既知のlarge-chunk advisoryだけを保持する。

同じ実画面で評価者が全積荷の回転buttonが使用不可であることと、可否の視認性不足を報告した。read-only DOM確認では、支持面スナップ試験0.15の9積荷すべてで許可向きが現在向き1種類だけであり、X/Zとも遷移先なしとして正しく無効化されていた。したがって回転実装の故障ではなく、支持試験用データが回転試験を覆わないことが原因である。

作業中データは、操作荷B（小）を `LWH` / `WLH` の天地無用としてX不可・Z可、操作荷D（大）を全6向きとしてX/Z可へ設定した。他の積荷は支持試験の意味を変えないため維持した。仕様0.17.1では、使用可を3Dの青緑線および積荷色と混同しない明るい紫色、使用不可を暗い低彩度の背景・枠・前景とし、opacity差だけに依存しない。実画面DOMで両状態の可否理由と計算済み色を確認したが、評価者本人による最終視認性判定は未実施である。

修正後は、回転可否・固定位置・連続回転の個別browser回帰に加え、色検出を使う部分配置・支持面スナップ・drag集中表示も個別成功した。全browser 71件、全単体939件、typecheck、lint、buildも成功し、buildは既知のlarge-chunk advisoryだけを保持する。

その後、評価者が端末保存を再読込すると旧1向き部分集合が復元され、回転不可が再発した。評価者は、床面回転禁止という設定自体が確定仕様と合わず、積荷editorには天地無用だけを残すこと、回転可の紫色塗りではなく拡大・縮小と同じ枠線強調を使うことを確認した。仕様0.18.0とADR 0022は、旧部分集合の2向き・6向き正規化、Z軸常時可、X軸の天地無用制限、editor簡略化、zoom同等枠を確定する。

同じローカルChromeで旧端末保存を新方針により読込し、操作荷D（大）だけ天地無用OFF、操作荷B（小）を含む他の旧立置き部分集合を天地無用ONへ正規化して端末の単一枠へ明示保存した。page reload後にその端末保存を再読込し、操作荷BはX不可・Z可、操作荷DはX/Z可、使用可枠が拡大・縮小と同じ `rgba(114, 234, 220, 0.75)`、使用不可枠が `rgba(88, 112, 136, 0.48)` であることをDOMとcomputed styleで確認した。評価者本人による操作・視認性の最終再試用は未実施である。

自動回帰では、旧1向き端末データの正規化、天地無用だけのeditor、X/Z可否、zoom同等枠線、永続化往復を含む全単体943件・全browser 71件、typecheck、lint、buildが成功した。buildは既知のlarge-chunk advisoryだけを保持する。

続く人間再試用で、荷室外の操作荷FをZ軸回転すると未選択の操作荷Hが動くことが確認された。原因は、初期gridが現在向きの全体最大X/Y寸法を再計算し、Fの `300×220` から `220×300 mm` への交換でoverrideを持たないHの既定位置まで再投影していたためである。仕様0.18.1ではgridセルを各積荷の許可向き全体から得る最大X/Y footprintで固定し、回転対象以外のsession位置を維持する。Project、端末保存、JSON、Schema `0.1.0`、物理判定、案件履歴は変更しない。

修正後の同じ端末保存をローカルin-app Browserへ再読込し、H選択時の画面を記録してからFをZ軸回転し、Hを再選択した画面と比較した。Hの表示位置は維持され、Fの向きだけが変わった。純粋投影試験はFのoverride前後でB・D・Hの各 `positionMm` が不変で、Hが `{ xMm: -800, yMm: 500, zMm: 0 }` を保持することを固定した。全単体944件・全browser 71件、typecheck、lint、buildが成功し、buildは既知のlarge-chunk advisoryだけを保持する。評価者本人による修正後の再試用は未実施である。
- `HUT-01` 修正後の同じA/B fixtureによる人間再試用。
- JSONファイル名変更候補の承認、sanitization、互換性、browser差、試験。

## Repository and Local Side Effects

- 試用開始時のbranchは `main`、product commitは `4e6c6808d0376317ef125ef8983b1f1dabae1dc2`、リポジトリ差分は0件だった。
- 実在データ、外部通信、deploy、依存導入、Git mutation、破壊的操作は行っていない。
- ローカル副作用は、ChromeのIndexedDB単一保存枠と、利用者の既定download先にある匿名合成JSONだけである。downloadは削除していない。
- UI試用server `http://127.0.0.1:4174/` は試用後に停止した。
