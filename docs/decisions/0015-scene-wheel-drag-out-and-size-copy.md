# 0015 3D viewportのscroll・drag-out・大きさ表記

- Date: 2026-08-28
- Status: Accepted
- Related specification: Placement and Validation; Operation History
- Refines: 0010
- Supersedes: None

## Context

案内付き人間評価後の再操作で、3D viewport上のwheelがpage scrollを奪うこと、配置済み積荷を荷室から外へdragしても不適合配置として残り続けること、同じ向き適用後寸法へ状態別の長いlabelが付くことが操作上の摩擦として確認された。明示的な `＋` / `－` と「荷室全体を表示」、非永続仮置き場、結果指向寸法は既に実装済みである。

ADR 0010はcanvas dragを正規最小角とscene差分から整数mmへ量子化し、外側配置をclampせず保存可能とした。一方、配置済みdragだけで利用者が明確に荷室外へ戻した場合のinteraction境界は定めていなかった。フォームによる不適合配置の保存・修正経路と、dragによる意図的な未配置化を両立させる必要がある。

## Decision

- OrbitControlsによるwheel、middle-button dolly、pinch zoomを無効にし、viewport上のwheelをpreventせずpage scrollへ渡す。camera zoomは既存の明示的な `＋` / `－` buttonだけで行い、「荷室全体を表示」を維持する。rotationとpanは維持する。
- 配置済み積荷のfine-pointer床面dragは、ADR 0010どおり正規開始位置とscene差分からX/Yを最近接整数mmへ量子化し、Zと向きを保持する。
- 量子化後X/Yが開始値と同じ場合はno-opとし、Projectと履歴を変更しない。既存配置が境界外にあってもno-opだけでは削除しない。
- 向き適用後の配置XY矩形と、生の荷室床面 `[0, L] × [0, W]` がX/Y両軸で厳密に正の共通長を持つ場合は配置を保持する。1 mmだけの重なりも保持し、一部はみ出しは既存物理判定で不適合として表示する。
- 共通面積が0の場合は、面・辺・点だけの接触を含め、既存 `deletePlacement` commandで配置を削除する。履歴actionは一回の `placement.delete` とし、積荷は案件全体から未配置となるため既存規則どおり仮置き場へ決定的に派生する。Undoは元の位置と向きを復元し、Redoは仮置きへ戻す。
- Zはこのgesture境界に使わない。床突き抜け、天井超過、その他のZ不適合は配置を保持し、物理判定で独立して診断する。
- drag取消、pointer cancel、renderer障害、stale Project、import競合、command失敗はProjectと履歴を変更せず、previewを元へ戻す。
- 選択積荷cardと配置一覧の向き適用後寸法labelは共通の `大きさ` とする。配置済み・仮置きの区別は既存の状態copyで示す。

## Rationale

正面積を境界にすると、利用者が荷室から明確に外へ出した場合だけ未配置化でき、1 mmでも床面へ残る部分は修正途中の不適合配置として保持できる。面・辺だけの接触を0面積とする規則は、既存の正体積AABB重なりと同じstrict intervalの考え方で整数mm境界を決定的に扱える。

wheelをpage scrollへ返すことで長い入力画面の移動を妨げず、camera zoomは既に存在するfocus可能なbuttonへ一本化できる。状態copyと寸法labelを分けることで、同じ値へ別名称を付けずに済む。

## Alternatives

- 荷室境界を1面でも越えたら仮置きへ戻す案は、フォームと既存dragで許可している修正途中の部分はみ出しを失うため採用しない。
- 積荷中心が床面内かで判定する案は、大きい積荷の一部重なりと利用者の見た目を正しく表さないため採用しない。
- Zを含む正体積重なりで判定する案は、床突き抜けや天井超過の修正途中配置を意図せず削除するため採用しない。
- wheel zoomと修飾key付きpage scrollを併用する案は、操作発見性とtouch/coarse fallbackを複雑にするため採用しない。

## Impact

- Users: wheelでpageを移動でき、配置済み積荷を床面から完全に外へdragすると仮置きへ戻せる。部分はみ出しは位置を失わず修正できる。
- Data: Project Schema `0.1.0`、`positionMm`、orientation、JSON、端末保存の形と意味は変わらない。仮置き状態とcameraは保存しない。
- Implementation: XY矩形の正面積overlapを純粋domain関数で判定し、SceneWorkspaceが既存update/delete commandとhistoryへ分岐する。rendererはProjectを直接変更しない。
- Tests: ±1 mm、4面のface contact、edge/corner、gap、invalid rectangle、非変異、page scrollとcamera非変更、button zoom、部分はみ出し保持、完全外drop、Worker対象除外、一回のUndo/Redo、stale/cancel、touch、狭幅を確認する。

## Compatibility and Migration

後方互換のinteraction追加であり、保存データの移行は不要である。既存の外側配置は読込・表示・フォーム編集でき、no-opまたはZだけの修正で削除されない。配置済み積荷をfine pointerで床面から完全に外へdragした時だけ新しい削除境界を適用する。仕様は0.12.0へ更新し、案件Schemaは0.1.0を維持する。

## Rollback

OrbitControlsのzoomを再び有効にし、配置済みdragを常に既存update branchへ渡し、寸法labelを旧状態別copyへ戻す。Project Schemaと保存データのrollback migrationは不要である。

## Verification

- `hasPositiveAreaOverlap` の整数mm境界・対称性・非変異単体試験。
- scene browser試験でwheel page scroll、camera・Project・履歴非変更、明示button zoom、完全外dropによる仮置き復帰、Worker対象除外、`placement.delete` のUndo/Redo、状態と `大きさ` copyを確認する。
- 既存のplaced/staged drag、partial outside、import競合、取消、WebGL障害、touch/coarse、狭幅回帰。
- 型、lint、全単体、全browser、build、データ契約、ガバナンス、project文書、diff checkを独立して実行する。

## Reconsider When

任意角度、複数床面、傾斜路、drag中のZ操作、touch drag、複数選択、または利用者が明示的な削除targetへdropするUIが必要になった場合。
