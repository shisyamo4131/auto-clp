# 0010 コンテナ局所座標と配置アンカー

- Date: 2026-08-27
- Status: Accepted
- Related specification: Placement and Validation; Data and State
- Supersedes: None
- Refines: 0002, 0005, 0006, 0007, 0009

## Context

案件Schema `0.1.0` は配置の整数 `positionMm` を持つが、コンテナ局所原点、軸の正方向、位置が積荷の中心か角かを定めていなかった。同じJSONを描画、手動配置、境界、重なり、支持で一貫して扱うには、最初の座標値生成UIまたはapplication commandを実装する前に意味を固定する必要がある。

積荷中心を整数mmで保存すると、奇数mm寸法の面が半mm位置になり、床接触、支持面一致、等値境界に不要な丸めが生じる。Three.jsの既定Y-upやmesh中心を、そのまま正規データへ採用してはならない。

## Decision

- 各配置は `containerId` が参照するコンテナの局所右手座標系を使う。
- コンテナ内部を `[0, L] × [0, W] × [0, H]` とする。原点は負X側開口面、最小Y側壁、床が交わる内隅とする。
- +Xは開口から奥、+Yは幅方向で入口から奥を見た左側、+Zは上方とする。最小Y側壁は入口から見た右側である。開口面は `x = 0`、床は `z = 0` とする。
- ADR 0007でいう世界X、Y、Zは、本ADRの採択以後このコンテナ局所X、Y、Zを意味し、Three.js固有のworld軸を意味しない。
- `positionMm` は、`orientation` 適用後の軸整列積荷直方体の最小X・Y・Z角とする。占有範囲は `[x, x + dx] × [y, y + dy] × [z, z + dz]` とする。
- 向き変更時は既定で最小角を保持し、暗黙に平行移動または丸めない。
- 正規データと判定は整数mmを維持する。描画用のmesh中心、縮尺、camera、選択状態は派生値とし、案件JSONへ保存しない。
- Three.js表示は `1 mm = 0.001 scene unit` を共通縮尺とし、Z-upのdomain座標を明示的なadapterで変換する。meshの中心・transformなど表示用浮動小数値を正規案件として逆変換しない。canvas dragは例外的な逆投影ではなく、drag開始時の正規最小角へpointerのscene差分だけをX/Y軸対応で加え、最近接1 mmへ正負対称に量子化したUI入力としてapplication commandへ渡す。Zと向きは保持する。
- 幅中央の開口境界は内幅との差が奇数mmでも丸めない。将来の厳密比較は2倍整数など決定的な方法を使う。
- 負座標や外側配置は修正途中として保存できるが、将来の境界判定では不適合とする。sceneへ描画できたことを積載可能または安全と表示しない。

## Rationale

最小角アンカーなら、奇数・偶数寸法のどちらでも保存値を整数mmに保ち、床 `z = 0`、支持面 `upper.zMin = support.zMax`、境界の等値と±1mm、軸整列重なりを加減算だけで決定的に扱える。

開口から奥へ+X、上方へ+Zとすると、負X側開口の既存仕様と利用者の奥行き感覚が一致する。右手系を維持し、Three.js固有のup軸やmesh中心は外側のadapterへ閉じ込める。

## Impact

- Users: 床置きはZ座標0で、Xは入口から奥への距離として扱える。
- Data: JSONの形は変えず、`positionMm` の意味を初めて固定する。
- Implementation: domainの占有範囲、scene投影、手動移動・回転、境界・重なり・支持は同じ座標契約を使う。
- Rendering: mesh中心は最小角と向き適用後寸法から導出し、Z-upと共通縮尺をadapterで扱う。
- Tests: 6向き、奇数・偶数寸法、床・境界等値と±1mm、開口中央、scene変換、drag差分の軸符号・1 mm量子化・取消・非変異を検証する。具体例として、内幅1,000mm・開口幅999mmの開口Y範囲は0.5〜999.5mm（2倍整数では1〜1,999）、積荷101×203×305mmは全6向きで負の最小角を含め `max = min + orientedDimension`、床 `z = 0`、各境界の等値と±1mmを確認する。

## Compatibility and Migration

本ADR採択時点では検証済みserializerは存在したが、座標値を生成する配置UIまたはapplication command、利用者向けJSON入出力UI、端末保存、リリース済み保存データは存在しなかった。このため、未定義だったSchema `0.1.0` の意味を最初の座標値生成機能の実装前に確定し、Schema版は据え置いた。現在は同じSchemaと座標契約に基づくフォーム配置command/UIとcanvas drag入力を実装済みだが、利用者向けJSON入出力UIと端末保存は未実装である。

既存外部生成データが後から判明した場合、その座標意味を推測して読み込まない。新しいSchema版と、元アンカーが明示された移行経路を設計する。中心から最小角への変換で半mmが生じる場合は、暗黙に丸めず拒否または明示方針を必要とする。

## Rollback

座標値生成UIまたはapplication commandと利用者向け保存UIの公開前は、本ADR、仕様、データ契約、scene adapterを一括して戻せる。公開後は同じ数値を別アンカーとして再解釈せず、新Schema版と明示的な移行を伴う後継ADRで本ADRをSupersededにする。

## Reconsider When

現場で別の原点、車両固有の左右表現、非軸整列姿勢、任意角度、複数開口、またはmm未満精度が必要になった場合。
