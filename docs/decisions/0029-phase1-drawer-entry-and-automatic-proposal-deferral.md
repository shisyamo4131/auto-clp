# 0029 Phase 1のDrawer入口と自動提案の公開延期

- Date: 2026-08-31
- Status: Accepted
- Related specification: Application Shell and Primary Workflow; Future Automatic Proposal
- Refines: 0004, 0025, 0028

## Context

仕様1.2.2の人間試用で、3Dを中心にした作業面は概ね期待どおりと確認された。一方、通常画面には低頻度の積荷・候補追加入口と、自動配置提案panelが残り、主作業面の優先度を下げていた。自動配置提案は技術試作と合成証拠まで存在するが、製品機能として提供・評価する工程は手動配置試作より後である。Navigation Drawerは背景を遮断しているものの、Drawer外をクリックしても閉じなかった。

## Decision

- Phase 1の通常画面では自動配置提案panel、開始・取消・適用入口を表示せず、通常起動で自動提案Workerを開始しない。純粋探索、Worker、session/view、panel component、適用境界、単体試験、AP-01〜08と性能証拠は、将来再開用の検証済み技術資産として保持する。現行利用可能機能または実務受入済み機能とは案内しない。再公開には別の明示承認、現行仕様への再統合、全回帰と人間試用を要する。
- Navigation DrawerのCLP groupへ `積荷を追加` と `候補を追加` を各一つ置き、通常画面の積荷card・候補cardから同じ追加buttonを除く。積荷は既存modal editor、候補は既存transactional editor、Project command、履歴、busy/dirty gate、件数上限を再利用し、追加処理を複製しない。通常画面の件数、候補一覧、編集、削除は維持する。
- Drawer外の背景相当領域をクリックするとDrawerだけを閉じる。背面のcontrol、scene、履歴は同じクリックで作動させない。close buttonおよびEscapeと同じく、未実行の端末保存削除確認と新規CLP確認を取り消し、page scrollを変えずApplication Barのmenu buttonへfocusを戻す。進行中の永続化処理自体はDrawerを閉じても中断しない。

## Rationale

通常画面を3D操作、選択、判定、既存データの確認に集中させ、低頻度の作成入口を既存Drawerへ集約する。自動提案の技術資産を消さず公開だけを延期すれば、現在の利用者へ未成熟な機能を提示せず、将来の再検討材料と決定性・性能証拠を保持できる。Drawer外クリックは一般的な一時surfaceの期待に合い、click-throughを禁止することで意図しないCLP変更を防ぐ。

## Impact

- Users: 通常画面から自動配置提案と追加buttonが消え、追加操作はmenuから開始する。Drawerは外側クリックでも閉じられる。
- Accessibility: Drawer内の追加buttonはfocus trapとbusy/limit状態を維持する。Drawerを閉じた後に既存editorへfocusし、editor終了後はmenu buttonへfocusを戻す。
- Data and domain: Project、JSON、IndexedDB、Schema `0.1.0`、既存履歴action、自動提案の技術資産を変更しない。migrationは不要。
- Progress: 現在のPhase 1範囲から自動提案の製品提供を将来backlogへ分離し、現行100点を手動配置試作へ再配分する。獲得98点と進捗98%は維持し、旧自動提案の実装・証拠は履歴として残す。

## Compatibility and Migration

既存CLP、端末保存、JSON Schema `0.1.0`をそのまま利用できる。UIとsession接続だけの変更で、保存データのmigrationはない。既存の自動提案技術資産は公開APIまたは互換性保証として扱わない。

## Rollback

通常画面へ自動提案panelを再接続し、追加buttonを各cardへ戻し、Drawer backdropを閉じない以前の動作へ個別に戻せる。Projectまたは保存データのrollbackは不要である。

## Required Tests

- 通常画面とDrawerに自動提案panel、開始、適用入口がなく、通常起動で自動提案Workerを開始しない。
- Drawer外クリック、close button、EscapeでDrawerが閉じ、menu focusとpage scrollを復元し、背面の履歴・scene・buttonを作動させない。新規CLP・端末保存削除確認と永続化処理中の境界も確認する。
- `積荷を追加` と `候補を追加` は通常画面に存在せずDrawer内に各一つだけある。Drawerを閉じて既存editorを開き、save/cancel/dirty/busy/history/limit/focusを維持する。
- 305 / 320 / 375 pxでDrawer、追加入口、既存editorに水平overflowを作らない。
- 保持する自動提案domain、Worker、適用境界の単体試験と技術証拠検査を継続する。

## Reconsider When

自動配置提案を利用者へ再公開する優先度、対象シナリオ、目的関数、性能対象端末、受入担当と合否基準が承認された時に再検討する。積荷・候補の追加頻度が高くDrawer経由が作業を阻害する観察証拠が得られた場合は、3D主作業面を圧迫しない別入口を検討する。
