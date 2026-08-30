# 0017 3D作業面・軸別回転・compact操作

- Status: Accepted
- Partial supersession: ADR 0018 supersedes the staged-partial rollback and projected-only picker scope. ADR 0021 replaces the mesh-projected rotation-control presentation with a fixed toolbar. ADR 0022 replaces the arbitrary allowed-orientation checkbox policy with the 天地無用-only two-state policy and always-available floor rotation; all other decisions remain active.
- Date: 2026-08-28
- Related specification: `../specification.md` 0.13.0
- Refines: ADR 0007、ADR 0010、ADR 0015

## Context

仕様0.12.0の人間再試用で、wheel page scroll、明示zoom、完全drag-out、Undo/Redoは機能した。一方、未配置積荷が固定gridへ戻るため、利用者が積荷Aを右、積荷Bを左へ退避して積荷Cを扱う実作業を表現できなかった。Undo/RedoではProject更新のたびにThree rendererとcameraを初期化して視点が動き、buttonへの移動でもpage位置が変わった。mesh近傍の回転controlと選択cardは大きく、3Dを主作業面として使う妨げになった。

同じ試用で、Z軸だけでなくX軸中心の90度回転、横倒しを防ぐ「天地無用」、多数の積荷から対象を確実に選ぶ経路、将来の複数荷室tabと積荷画像が要望された。複数荷室tabと画像は将来実装でよいと明示されている。

## Decision

- 未配置積荷の決定的gridは初期位置にだけ使う。利用者がfine pointerで積荷全体を荷室外へdropした後は、cargo IDごとの位置と向きを現在のUI sessionだけに保持し、次のdrag開始位置とする。外側移動はProjectと履歴を変更しない。
- 未配置積荷の全体が荷室内へ入ったdropだけを一回の `placement.add` とする。一部だけ荷室床面へ重なるdropは、配置済みの部分overhangと混同せず直前の外側作業位置へ戻す。
- 配置済み積荷を床面から完全に外へdragした時は、そのdrop位置と向きをsession状態へ記録してから一回の `placement.delete` とする。Undoは配置を復元し、Redoは同じ外側作業位置へ戻す。配置済みの正面積overlap規則はADR 0015のままとする。
- session上の外側位置、向き、選択、cameraはProject、JSON、IndexedDB、物理判定、案件履歴へ保存しない。読込によるscene barrierでは従来どおり破棄する。
- viewport近傍にcompactな積荷selectを置き、sceneへ投影中の配置済み・荷室外積荷をcargo IDで選択・highlightできるようにする。選択だけでcameraを自動移動しない。
- 直方体の軸割当として区別できるZ軸90度回転を `LWH↔WLH`、`LHW↔HLW`、`WHL↔HWL`、X軸90度回転を `LWH↔LHW`、`WLH↔WHL`、`HLW↔HWL` とする。許可向き集合内の遷移だけを可能にする。荷室外では回転後AABBが荷室床面と正面積で重なる遷移を拒否し、直前poseを保持する。積荷寸法・許可向き編集後に既存override位置が同じ外側条件を失った場合は、新寸法で完全に外側となる決定的初期gridへfallbackする。
- 配置済み回転は最小角を保持した一回の `placement.update`、荷室外回転はsession状態だけの変更とする。回転controlはX/Zを区別するicon-only buttonとし、可視説明文を置かず、accessible nameとtitleで意味・無効理由を提供する。
- 「天地無用」は新しい保存fieldにせず、元のHeightを荷室Zへ保つ `LWH` / `WLH` だけを許可する入力補助とする。OFFでは6向きを選択可能にし、詳細checkboxで調整できる。orientation codeは軸の符号を持たないため、面の上下反転を識別または保証せず、「横倒しを防ぐ」意味に限定する。
- Undo/Redoは `＋` / `－` と同じviewport toolbarへ一組だけ置き、同じ履歴handlerとshortcutを使う。同一候補のProject更新ではcamera positionとOrbitControls targetを保持し、履歴実行前後のpage scroll位置も保持する。WebGL 2非対応時は同じcompact履歴をfallback領域に一組だけ置く。
- 選択cardは積荷名を見出しとし、「選択中の積荷」と `大きさ:` を表示しない。向き適用後寸法とcompactなX/Y/Zをdesktopで2列、狭幅で1列にし、座標意味と保存codeは詳細へ残す。配置・物理panelはviewport後方へ移す。
- 複数候補をtabで切り替え、未配置積荷の退避関係を候補寸法に対して再投影するUIはplannedとする。現行selectの置換、side-relative anchor、履歴・自動提案との関係を実装前に確定する。
- 積荷画像はplanned researchとする。今回、画像選択、保存、texture、thumbnail、JSON変更は実装しない。

## Rationale

自由な荷室外作業面は、利用者の一時的な段取りを保存データや物理判定へ混ぜずに表現できる。既存の許可向き集合をX/Z操作と天地無用の正本にすれば、手動操作、フォーム、開口判定、自動提案の規則が分岐せず、Schema変更も不要である。履歴とcameraを同じ作業面に固定すると、主作業の文脈を保ったまま取り消せる。

## Alternatives

- 固定gridへ毎回戻す案は、多数積荷を左右へ退避する人間の作業を失うため採用しない。
- 外側位置をProjectへ保存する案は、未配置と配置を混同し、Schema・物理判定・自動提案へ不要な状態を持ち込むため採用しない。
- 「天地無用」を独立booleanとして保存する案は、許可向き集合と矛盾し得る二重の正本になるため採用しない。
- 連続任意角度回転は、正規AABB、開口、支持、衝突の契約を変更するため採用しない。
- 選択時に自動でcameraを積荷へ向ける案は、Undo/Redoと同じ視点移動問題を再発させるため採用しない。

## Impact

- Users: 荷室外で積荷を任意に退避し、一覧から確実に選択し、X/Z回転と天地無用を利用できる。Undo/Redoでpageとcameraの作業文脈を失わない。
- Data: Project Schema `0.1.0`、JSON、IndexedDB、配置座標、許可向きの意味は変更しない。sessionの外側poseは保存しない。
- Implementation: scene adapterは任意のsession overrideを一方向投影する。SceneWorkspaceがoverride、選択、command接続を所有し、ThreeViewportは描画・pointer・cameraを所有する。
- Tests: 全6向きのX/Z mapping、overrideと編集後fallback、X/Y面接触0と1 mm正面積境界、外側X/Z回転の成功・拒否と非履歴、外側移動、荷室内配置、完全drag-outとUndo/Redo、icon/ARIA、天地無用、cargo picker、page/camera保持、wheel、touch、狭幅を確認する。

## Compatibility, Migration, and Rollback

後方互換のUI・interaction変更で、保存データ移行はない。既存案件の `allowedOrientations` から天地無用表示を導出する。横倒し向きで配置済みの積荷からその向きを外す編集は、既存意味検証どおり黙って変更せず拒否する。

rollbackはsession overrideとX軸mappingを除去し、Z軸回転・決定的grid・旧card・旧履歴位置へ戻す。Projectデータのrollback migrationは不要である。

## Reconsideration Conditions

複数荷室tab、候補ごとの独立作業面、sessionを越える作業面復元、touch drag、任意角度、面の表裏、積荷画像、または画像を含むportable projectが必要になった場合。
