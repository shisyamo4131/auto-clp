# 0028 操作方法dialogとcompact寸法矢印

- Date: 2026-08-31
- Status: Accepted
- Related specification: Application Shell and Primary Workflow; Placement and Validation; Operation History
- Refines: 0025, 0027

## Context

仕様1.2.1の人間試用で、荷室tabの欄外配置、簡略寸法、icon-only判定lampと、Shift付き左drag・右dragによるcamera平行移動は期待どおりと確認された。一方、平行移動を含む3D操作は画面だけから発見しにくい。寸法矢印は数値labelに対して大きく、下段固定操作欄の `現在の候補`は、後続のX/Y/Z値が座標であることを直接示していない。

## Decision

- Navigation Drawerに `操作方法` buttonを置き、Drawerを閉じてから共通modal shellの独立dialogを開く。dialogは背景操作を遮断し、focus trap、Escape、backdrop close、`preventScroll`付きfocus復帰、305 / 320 / 375 pxの内部scrollを維持する。閉じたDrawer内のbuttonではなくApplication Barのmenu buttonへfocusを戻す。
- `操作方法` は、積荷選択、空いた3D領域の左dragによる視点回転、Shift付き左dragまたは右dragによる平行移動、wheelのpage scroll、button zoom・荷室全体表示、fine pointerの積荷drag、X/Z回転、Undo/Redo、物理判定dialog、下段固定欄の座標・積荷操作を簡潔に説明する。積荷上の左dragは積荷移動を優先するため、camera操作は `空いた3D領域` と明記する。touchは積荷選択とpage scrollを主とし、正確な座標・情報編集は下段button/dialogを案内する。
- 操作方法dialogはCLP、履歴、保存、session camera、判定状態を変更しない。版確認を保存する `使用上の重要事項` dialogとは統合しない。
- 寸法線の外向きmarkerを `8 × 8` から `4 × 4`へ縮小する。両端の外向き、線・witness・label・clamp・pointer非干渉は変えない。
- 現在候補に配置済みの積荷に表示する `現在の候補 — X ... / Y ... / Z ... mm` を `現在の座標 — X ... / Y ... / Z ... mm` へ改める。他候補への所有を示す候補名と、荷室の意味で使う `現在の候補` は変えない。

## Rationale

主作業面をbuttonと説明で再び占有せず、低頻度の案内を既存Drawerに集約すると、発見性とviewer-first構成を両立できる。一般的なマウス操作とAuto CLP固有の優先規則を一箇所に示すことで、積荷dragとcamera回転の混同を減らせる。矢印と座標copyの改善は、寸法値と位置情報を主役にする。

## Impact

- Users: Drawerから3D操作の案内を開ける。寸法矢印が小さくなり、選択積荷の配置情報を座標と識別できる。
- Accessibility: dialogのsemantic heading、list、focus trap、focus復帰を持ち、寸法の非視覚説明は維持する。
- Data and domain: Schema `0.1.0`、Project、JSON、端末保存、履歴、配置座標のcanonicalな意味を変更しない。migrationは不要。
- Progress: 完了済み機能内のUI・案内改善であり、差分の人間確認が残るため98%を維持する。

## Compatibility and Migration

既存CLP、端末保存、JSONをそのまま利用できる。追加するのは派生UIと説明copyだけで、保存データのmigrationはない。

## Rollback

Drawer triggerと操作方法dialogを除去し、markerを `8 × 8`、座標copyを従来表現へ戻せる。データrollbackは不要である。

## Required Tests

- Drawerの `操作方法` からDrawerを閉じてdialogを開き、操作copy、背景inert、Tab trap、Escape・close、menu buttonへのfocusとpage scroll復帰を確認する。
- 305 / 320 / 375 pxでdialogがviewport内に収まり、内部縦scrollと水平overflowなしを確認する。dialog中はCLP、履歴、sceneを変更しない。
- markerの `4 × 4`、同形path、両端外向きと既存寸法・label・pointer契約を回帰する。実画面で大きさを人間が確認する。
- 現在候補配置だけが `現在の座標` と表示され、他候補名と荷室文脈のcopyは維持される。

## Reconsider When

操作ガイドのオンボーディング、動画・イラスト、touch drag、キーボードだけの3D操作、または操作設定の利用者カスタマイズを導入する場合。
