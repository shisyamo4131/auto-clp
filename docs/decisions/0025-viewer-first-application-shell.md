# 0025 3D主作業面を優先するApplication Shell

- Date: 2026-08-30
- Status: Accepted
- Related specification: Application Shell and Primary Workflow; Placement and Validation; Persistence; Operation History
- Supersedes: None
- Refines: 0013, 0017, 0018, 0023, 0024

## Context

Phase 1の人間試用で、主操作は3D viewport上の選択、移動、回転であり、その上下にCLP設定、保存、候補選択、積荷選択を大きなcardとして並べると作業面が押し下げられることが確認された。積荷・候補の登録cardは当面必要だが、利用頻度の低いCLP全体操作と永続化は別のsurfaceへまとめ、3Dを最初に認識・操作できる構成が求められた。

## Decision

- 通常画面の最上部にApplication Barを置き、Navigation Drawerを開くmenu button、製品名 `Auto CLP`、現在のCLP名、WebGL 2と初回描画の状態を示す小さな3D能力Chipを表示する。現在のCLP名からCLP設定dialogを開ける。
- 端末保存、端末読込・削除、JSON入出力、`新規CLP`、`CLP設定`を一つのNavigation Drawerへまとめる。旧「CLPデータを開く」cardと常設CLP設定cardは表示しない。
- `新規CLP` は新しい衝突しない `projectId` を持つ空のCLPを作成し、直後にCLP設定dialogを開く。現在CLPに端末保存またはJSON書出し以後の変更がある場合は破棄確認を要求する。新規作成はUndo対象にせず、過去・未来の履歴、選択、draft、camera、drag preview、Worker結果を破棄するhistory barrierとする。
- 3D候補cardの外枠と見出しを廃止し、viewerを主作業面として上方へ配置する。候補selectorはviewport上部、全CLP積荷を名前またはIDで検索する入力と状態付き積荷selectorはviewport下部へoverlayする。overlayはcanvasの寸法・位置を変えず、空白のcamera操作と積荷dragを覆わない範囲へ置く。
- Undo/Redo、X/Z回転、拡大・縮小、全体表示、候補selectorは共通のviewport上部control領域で互いに重ならない。305 / 320 / 375 pxではtoolbarと候補selectorを積み、積荷検索・selector・件数は複数行にして水平overflowを起こさない。
- 3D操作statusと非保証注意はcompactにviewer直下へ残し、物理判定をその次に置く。自動配置案は主3D作業面と物理判定の後へ置く。積荷、コンテナ・車両候補の登録cardはこの変更では維持する。
- Refinement 2026-08-30: 積荷選択だけの成功通知と一般的な非保証一文は主作業面の情報密度を下げるため表示しない。drag・失敗・操作不可status、物理判定panelと現在の制限にある具体的説明は維持し、一般的な保証境界は将来の利用規約整備へ記録する。狭幅時の候補selectorはcolumn flexのbasisを解除して内容高に留め、荷室全体表示はaccessible name付きの `cube-outline` 相当icon-only buttonとする。
- Drawerから設定dialogまたは新規CLPへ移る場合も、閉じたsurface内の要素ではなくApplication BarのCLP名またはmenu buttonへfocusを戻す。未保存確認は出現時に確定buttonへfocusし、取消時は `新規CLP` へ戻す。
- WebGL 2非対応、初回描画失敗、context lossでは通常作業面を表示しない既存の必須ゲートを維持する。Application Barの能力Chipは利用不可を示し、許可済みの読み取り専用救出だけを残す。

## Rationale

頻繁に使う3D作業面と、その文脈で必要な候補・積荷選択、履歴、camera操作を同じ視野へ集めることで、ページを往復せずに積み方を検討できる。低頻度のCLP全体操作をDrawerとdialogへ移すと、機能を失わず主画面を小さくできる。新規作成を履歴操作にするとUndoで異なるCLP identityへ戻り、保存対象と履歴の意味が曖昧になるため、明示確認付きbarrierとする。

## Alternatives

- 既存cardを折り畳む案は、初期表示の占有と複数の開閉状態が残るため採用しない。
- 保存、CLP設定、新規作成を別々のmenuへ分散する案は、CLP全体操作の発見場所が増えるため採用しない。
- 積荷検索を廃止してnative selectだけにする案は、多数積荷の識別性を失うため採用しない。
- overlayをcanvas外へ置く案はviewportを再び押し下げるため採用しない。
- 新規CLPをUndo可能にする案は、CLP identityと保存基準を履歴内で跨ぐため採用しない。

## Impact

- Users: 3Dを中心に、Application Bar、Drawer、dialog、viewport overlayからCLPを操作する。未保存のCLPを破棄する新規作成には確認が入る。
- Data: JSON Schema `0.1.0`と既存保存データの形・意味は変更しない。新規CLPの `projectId` はSchemaのASCII 1〜64文字制約内のUUID付きIDとする。
- Implementation: Application Bar、能力Chip、controlled Drawer、CLP設定dialog、viewer overlay、history barrierと保存基準追跡をAppへ接続する。
- Documentation: 現行仕様を1.1.1へ更新し、運用、受入、ロードマップ、変更履歴、文書索引を整合する。進捗は98%を維持する。
- Tests: 通常・WebGL障害、Drawer/dialog focus、未保存確認、履歴reset、固有ID、全積荷検索、wheel一回分、overlay非重複、305 / 320 / 375 / 720 pxと1,000積荷をbrowserで回帰する。

## Compatibility and Migration

既存JSONと端末保存はそのまま読み込める。旧画面状態は保存対象ではないため移行しない。現在CLPは起動時と読込時に保存基準として扱い、その後の変更だけを新規作成前の未保存確認対象とする。

## Rollback

Application Bar、Drawer内CLP操作、設定dialog、viewport overlay、関連stateとtestを一括して旧card配置へ戻せる。Schema移行や保存データrollbackは不要である。

## Reconsider When

複数CLPを同時に開く、複数保存slot、複数コンテナtab、touch drag、または積荷画像付きの視覚selectorを導入する場合。
