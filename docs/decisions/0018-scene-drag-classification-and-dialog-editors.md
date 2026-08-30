# 0018 3D drag三状態分類とdialog編集

- Status: Accepted
- Partial supersession: ADR 0021 replaces the distinct-SVG-path rotation icons with one axis-wrapped-arrow glyph shown at a 90-degree axis difference and fixes both controls in the viewport toolbar; all other decisions remain active.
- Date: 2026-08-29
- Related specification: `../specification.md` 0.14.0
- Supersedes: ADR 0017の未配置partial rollbackと投影中積荷だけのpicker範囲
- Generalizes: ADR 0015の配置済みX/Y正面積分類

## Context

仕様0.13.0の人間再試用では自由な荷室外作業面、軸別回転、天地無用、compact cardが概ね期待どおりだった。一方、drag中の通知でviewportが動くこと、未配置だけpartial dropを戻す規則が座標入力と配置済みdragの修正途中保存と一致しないこと、回転軸をicon形状で判別できないこと、座標フォームまでscrollすること、多数積荷で一覧と常設CRUDがページを伸ばすことが確認された。

## Decision

- fine-pointer床面dragだけを、量子化後のX/Y footprintで `xy-contained`、`partial`、`outside` に分類する。no-opを先行し、Zは分類しない。両軸に正の共通長があれば `partial`、面・辺・点接触を含む面積0は `outside` とする。
- 未配置・配置済みの双方で `xy-contained` と `partial` を一回の配置追加または更新として保存する。`partial` は不適合な修正途中配置として直ちに判定へ渡す。`outside` は未配置ならsession poseだけ、配置済みなら一回の配置削除とsession poseにする。失敗、取消、staleは確定状態を変えない。
- この分類を座標フォーム、JSON読込、回転、積荷・候補編集、既存Projectへ自動適用しない。
- 全Project積荷を検索・選択でき、状態と所有候補を示す。他候補の配置編集・取り外しには明示的な候補切替を要求する。
- 積荷定義と配置を別dialog、別draft、別履歴として編集する。常設の長い積荷・配置一覧を主作業面から外し、選択cardへ編集、取り外し、削除入口を集約する。物理判定一覧は残す。
- 共通modal shellはfocus trap、背景inert、clean/dirty Escape、破棄確認、内部scroll、狭幅、scrollbar shift防止、`preventScroll` focus復帰を提供する。dialog中は案件を変える別操作をbusy gateで拒否する。
- 配置取り外しと積荷削除はcascadeしない別操作とする。配置中の積荷削除と、使用中向きを外す編集は拒否し、その他の積荷編集は配置を保持して再判定する。
- X/Z回転はSVG path自体が異なる44 px以上のicon-only、focus可能な `aria-disabled` controlとし、無効理由を説明参照と操作statusで示す。天地無用はXだけを制限する。
- drag statusは固定高またはoverlayでviewportを押し下げない。

## Rationale

同じ床面gestureに同じ三状態分類を使うと、未配置か配置済みかにかかわらずpartialを修正途中として保持でき、数値入力との概念差が小さくなる。全積荷selectとdialog CRUDは積荷数に比例するページ長を避け、3Dを主作業面に保つ。

## Impact

- Users: partial dropを失わず診断でき、画面移動なしに積荷を探して編集できる。
- Data: Project Schema `0.1.0`、JSON、IndexedDB、向き、配置座標の保存形は変更しない。
- Implementation: 純粋footprint classifier、App busy gate、共有modal shell、積荷・配置別editorを追加する。
- Tests: 全6向き、1 mm overlap、面・辺・点接触、no-op/取消/stale、全積荷select、他候補切替、dialog focus/busy/狭幅、削除非cascade、distinct icon/ARIA、固定viewport位置を回帰する。

## Compatibility, Migration, and Rollback

保存データ移行はない。rollbackはdialogと全積荷selectを旧常設panelへ戻し、未配置partialを旧session poseへrollbackする。Projectデータのmigrationは不要である。

## Reconsideration Conditions

touch drag、複数候補tab、複数選択、画像texture、仮置きpose永続化、または任意角回転が必要になった場合。
