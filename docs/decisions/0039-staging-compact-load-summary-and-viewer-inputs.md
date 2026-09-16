# ADR 0039: 荷室外積荷の寄せ・積載概要・viewer入力

- Status: Accepted
- Date: 2026-09-16
- Related specification: `../specification.md` 1.10.1
- Refines: 0015、0017、0026、0028、0032

## Context

CSV一括登録などで未配置積荷が多い場合、荷室外の手動位置をsession内で保持するため、積み込みの進行後も残りの積荷がコンテナから遠い位置に残り得る。積荷selectorは配置状態を文字列で含む一方、選択中の重量、現在コンテナの総重量／耐荷重、全CLPの積込済数を主作業面で確認できなかった。viewer-first化後も、旧仕様によりwheelはページscroll、camera zoomは `＋` / `－` buttonだけで、Ctrl付き左dragのpanは操作とcursorが一致していなかった。

## Decision

- Undoの左にaccessibleなMaterial Design Iconsの `arrow-collapse-all` 相当icon buttonを置く。実行時は全未配置積荷の現在向きを維持し、選択中コンテナの負X側へ100 mm間隔の決定的gridで再整列する。手動の荷室外位置は破棄するが、camera位置、注視点、視点方向、縮尺は変更しない。
- 寄せはscene session状態だけを変更し、Project、JSON、端末保存、Undo/Redo履歴へ含めない。未配置積荷なし、コンテナなし、busy、読取専用sceneでは無効にする。
- native積荷selectorの選択文字列は `積荷名 — 長さ×幅×高さ mm／重量 kg` とし、検索結果件数を撤去する。selector右側に、現在コンテナへ配置済みは青、未配置は黄、別コンテナへ配置済みは緑、未選択は灰のdotを置き、読み上げ名とtitleで状態を伝える。
- 重心凡例の下に、選択中コンテナの `総重量: 積込重量 kg/耐荷重 kg` と、全CLPの `積込済: 配置済数個/全積荷数個` を置く。正規gから最大小数第3位、末尾0なしで表示する。
- viewer上のwheelはcamera zoomへ戻し、同じwheelによるpage scrollを止める。旧 `＋` / `－` buttonは撤去し、viewer外のpage scrollと荷室全体表示buttonは維持する。
- Ctrl押下中はviewer cursorを十字矢印相当へ変え、積荷上から始まる左dragでも積荷操作を捕捉せずOrbitControlsのpanを優先する。Ctrl解除またはwindow blurで通常cursorへ戻す。

## Consequences

- 多数積荷の作業途中に遠い未配置積荷を再び近接配置できるが、寄せ前の手動荷室外位置をUndoで復元することはできない。操作statusと操作方法で非保存・非履歴を明示する。
- 配置状態はnative option内の色表現に依存せず、選択後の独立dotと既存context actionで確認する。別コンテナの名前と切替入口は既存action rowに残る。
- 総重量は選択中コンテナ単位、積込済数は全CLP単位となる。表示は既存の耐荷重判定を置き換えず、安全性または許容を追加判定しない。
- 仕様1.10.1へ更新し、Schema `0.1.0`、CSV、JSON、IndexedDB、既存Projectの意味は変更しない。データ移行は不要である。

## Verification

- 純粋scene試験で、遠方overrideを近接gridへ戻し、向き、非重複、決定性、Project非変異を確認する。
- browser試験で、4状態dotと色以外の名称、重量書式、総重量／耐荷重、複数コンテナ横断の積込済数、件数撤去、`arrow-collapse-all` icon、寄せ前後のcamera投影保持と非履歴、wheel zoomとpage位置、`＋` / `－` 撤去、Ctrl cursorと積荷上pan優先、狭幅、操作方法を確認する。
- 型、lint、全単体、全browser、build、データ契約、文書検査を最終worktreeで独立実行する。

## Rollback

仕様1.9.0相当のwheel page scroll、`＋` / `－`、文字列内配置状態、件数表示へ戻し、寄せ、積載概要、Ctrl優先panを撤去できる。正規Projectを変更しないため、データrollbackまたは移行は不要である。
