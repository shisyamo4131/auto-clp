# 0027 欄外荷室tab・簡略寸法・icon-only判定lamp

- Date: 2026-08-31
- Status: Accepted
- Related specification: Application Shell and Primary Workflow; Placement and Validation
- Refines: 0026

## Context

仕様1.2.0の人間試用で、荷室tabが3D描画枠の内部を占有し、選択積荷の寸法labelは軸名と名称を含むため主対象に対して情報量が多く、寸法線の両端矢印が同じ方向を向くことが確認された。物理判定lampの青状態文もtoolbar内で広い面積を使い、詳細はdialogで確認できるため常設文として不要と判断された。

視点の左右移動については、右dragとShift付き左dragによる平行移動が既に実装されている。両経路をsource contractで確認し、Shift付き左dragは実画面で確認した。右dragは実画面未確認で、headless browserではどちらも描画移動を再現できなかったため自動回帰済みとは扱わない。操作の発見性は低いが、明示的な上下左右buttonは今回の承認範囲に含めず、必要なら別checkpointで扱う。

## Decision

- 荷室tablistを3D viewportの直前にある通常flowの兄弟要素へ移し、canvasとviewport overlayの外側上部へ置く。既存の一行表示、左右scroll button、横scroll、keyboard、touch、active tab表示、候補切替規則は維持する。
- 選択積荷の可視寸法labelは各軸の正規整数値と `mm` だけにする。軸と奥行・横幅・高さの意味は下段の非視覚説明に一度だけ維持する。
- 寸法線の両端矢印は、参考図と同じく線分の両端から外向きに統一する。witness線、cuboidへの追従、viewport内clamp、pointer非干渉、背面・画面外での消去は維持する。
- 物理判定lampの可視内容を状態別iconと灰・青・黄・赤の色だけにする。状態ごとに異なるiconを維持し、accessible nameとtitleへ状態名、不適合件数、未確認件数、詳細を開く操作を残す。理由、件数、非保証範囲はdialogへ集約する。
- 右dragとShift付き左dragの平行移動は変更しない。新しいcamera移動buttonは追加しない。

## Rationale

荷室tabを描画枠外へ出すことで、3Dが主作業面であることを保ちながら候補切替を描画内容と明確に分離できる。可視寸法を数値と単位へ絞り、一般的な寸法図と同じ外向き矢印へ揃えることで、積荷そのものを見ながら寸法を読み取りやすくなる。判定状態は色とiconで常時把握し、詳細文を必要時のdialogへ移す方がtoolbarを小さく保てる。

## Impact

- Users: tab、寸法、判定lampの見た目と配置が変わる。候補切替、判定内容、CLP操作、camera操作は変わらない。
- Accessibility: 可視寸法の軸名を除く代わりに下段の非視覚説明を維持する。lampの状態名と件数はaccessible nameとtitleで維持する。
- Data and domain: Schema `0.1.0`、Project、JSON、端末保存、履歴、物理判定reason、anchor、cameraを変更しない。
- Progress: 完了済み機能内のUI改善であり、人間確認が残るため98%を維持する。

## Compatibility and Migration

既存CLPをそのまま読み込める。変更対象は派生UIだけで、データmigrationは不要である。

## Rollback

CandidateTabsをviewport top overlayへ戻し、可視寸法labelへ軸名・名称を復元し、従来のmarkerとlamp可視labelへ戻せる。データrollbackは不要である。

## Required Tests

- tablistがviewport外上部にありcanvasと重ならず、305 / 320 / 375 pxおよび多数候補で横scroll契約を維持する。
- 寸法の可視labelが `整数 mm` だけで、両端矢印が外向き、下段の非視覚軸説明が維持される。
- camera平行移動後も寸法labelがcanvas内に収まり、下段UIと重ならないことを実画面で確認する。
- lampは可視状態文を持たず、状態別icon・色、accessible name、件数、dialog内容を維持する。

## Reconsider When

印刷用寸法図、任意角度、camera平行移動の明示button、または判定状態を常時文章で示す要求が発生した場合。
