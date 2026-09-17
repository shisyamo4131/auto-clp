# 0042 荷室外床面化・内壁スナップ切替・判定アイコン

- Date: 2026-09-16
- Status: Accepted

## Context

ADR 0018・0019では荷室外の作業位置でZを維持していたため、積荷上面から外へ出した積荷が空中に残り、その高さのdrag平面から荷室へ戻す操作が難しかった。ADR 0041の20 mm積荷側面fitには内壁候補と切替がなく、利用者はより広い補助範囲と明示的なON/OFFを求めた。物理判定lampの状態別文字記号も、固定した情報アイコンへ変更する。

## Decision

- fine-pointer dragで積荷footprintが完全に荷室外となった時点から、荷室外作業位置のZを0 mmへ正規化する。配置済み上段積荷を外へ出す場合も同じpreview位置を一回の `placement.delete` とsession anchorへ使い、Undoは元配置、Redoは荷室外の床面位置を復元する。
- 床または支持上面のZを決めた後、同じ最小Zにある固定積荷側面に加えてコンテナ内壁4面をX/Y fit候補とする。距離が50 mm以内なら隙間0 mmへfitし、51 mm以上ではfitしない。
- 候補は移動量、X軸、コンテナ内壁、積荷ID・面方向の順で決定する。移動グループ外の積荷と正体積重複する候補は採用しない。
- Material Design Iconsの `adjust` 相当icon-only buttonをviewport toolbarへ置く。既定ONとし、積荷側面・内壁のX/Y fitだけを切り替える。床・支持上面へのZ snapと単一支持面内clampは常時有効とする。
- 切替は現在のブラウザ実行中だけのUI session状態とし、Project、Schema、JSON、端末保存、Undo/Redo履歴へ含めない。
- 物理判定buttonは状態別の色、accessible name、title、件数、dialogを維持する。可視glyphは当初Material Design Iconsの `information-box-outline` 相当iconへ統一し、仕様1.13.1で `information-variant` 相当iconへ変更した。

## Impact

- Users: 荷室外で積荷が空中に残らず、床から荷室へ戻せる。50 mm以内の積荷側面・内壁fitを既定で利用し、必要時だけOFFにできる。
- Data: Project、JSON、Schema `0.1.0`は変更しない。荷室外anchorのZ、fit候補、切替、iconは非永続のscene/UI状態である。
- Compatibility: 既存JSON・端末保存のmigrationはない。再読込後のスナップ切替は既定ONへ戻る。
- Tests: 荷室外Z=0、Undo/Redo用pose、内壁4面、50 / 51 mm境界、積荷・内壁候補順、OFF時の非fit、Z snap維持、buttonの既定・切替・非履歴、判定iconと状態色を検証する。

## Rollback

ADR 0041の20 mm積荷側面fitと荷室外Z維持へ戻し、toolbarの切替buttonを撤去する。物理判定の状態別文字glyphを復元できる。保存形式を変更しないためmigrationは不要である。

## Reconsider When

スナップ距離の利用者設定、軸別距離、複数面同時fit、荷室外での段積み、切替の端末設定保存が必要になった時。
