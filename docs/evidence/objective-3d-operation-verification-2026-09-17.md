# 3D操作の客観検証記録

- Status: Verified
- Date: 2026-09-17
- Scope: 単一支持グループ移動、荷室外drag、側面・内壁fit、床／上面選択、矢印調整
- Classification: 自動化できる機能契約の技術検証。操作感、理解度、実務上の使いやすさまたは安全性の人間評価ではない。

## 結論

残っていた3D操作項目のうち、座標、境界値、履歴、衝突、選択面および実pointer経路として客観判定できるものは、単体試験、実Chromium pointer試験および公開Chrome観察で確認した。積層fixtureの最下段を実pointerで短距離dragする試験を追加し、移動前グループを支持・衝突候補として誤認せず、3段が同じX/Y差分だけ移動し、Zを維持し、一回のUndoで全段が復元することを確認した。最下段を完全に荷室外へdragした場合は、上段2件があるため全段の元配置を保持して拒否する。

## 項目別の証拠

| 客観項目 | 結果 | 主な証拠 |
| --- | --- | --- |
| 単一支持グループの短距離dragで旧位置を支持・衝突候補にしない | Pass | `src/scene/project-scene.test.ts` の移動グループ除外、`tests/browser/scene.spec.ts` の3段実pointer移動・同量差分・Z維持・Undo |
| 完全drag-out | Pass | 単独積荷は配置を削除して荷室外へ移しUndo/Redo可能、荷室外位置はZ=0。子孫を持つ最下段は実pointer経路で拒否し元配置を保持 |
| コンテナ角の2面fit | Pass | X/Y内壁を同時取得し、1つの検証済み位置へ解決する単体境界試験 |
| 異なる2積荷への2面fit | Pass | X面・Y面の異なる積荷を同時取得する単体試験。合成位置だけ衝突する場合の単軸fallbackも確認 |
| 取得50 mm、保持75 mm、76 mmで解除 | Pass | 50 / 51 mm取得境界、75 / 76 mm保持境界の単体試験 |
| カーソルによる床／積荷上面選択 | Pass | 床指定時の浅い重なり、上面取得・保持・完全離脱の単体試験と、実pointerによる支持上面drop試験 |
| スナップ既定ON、OFF時はX/Yだけ無効でZ snap維持 | Pass | 内壁fitのON/OFF単体試験、既定ON・切替・非履歴のbrowser試験。公開ChromeでもON状態のbuttonを観察 |
| 視点基準1 mm矢印調整 | Pass | 投影軸からX/Y符号を決める単体試験、1 mm更新・Escape取消・Undo/Redoのbrowser試験。公開Chromeで `X 300 / Y 0 / Z 50` から `X 300 / Y -1 / Z 50` への1 mm更新とUndo復元を観察 |
| 固定積荷との衝突停止 | Pass | 面接触は許容し、正体積重複は停止する単体試験 |
| 長押し／repeatを一回のUndoへ集約 | Pass | ArrowRight 3回（2回はrepeat）を3 mm移動として一回の履歴へ集約し、一回のUndo/Redoで往復するbrowser試験 |

## 実行結果

- `corepack pnpm run typecheck`: Pass、終了コード0
- `corepack pnpm run lint`: Pass、終了コード0
- `corepack pnpm run test:unit`: Pass、37ファイル・1,067件、終了コード0
- `corepack pnpm run test:browser`: Pass、124件、終了コード0
- `corepack pnpm run build`: Pass、終了コード0

公開Chrome観察では、GitHub Pages上の匿名合成データだけを使用した。選択中の上段荷で矢印を1回押すと視点基準でYが1 mm変化し、履歴が「矢印キーでの配置調整」1件となり、Undoで元座標へ復元した。観察後の未保存Projectは元座標へ戻している。

## 人間に残す評価

次は技術的な真偽ではなく、人が実際に触れて判断する。

- 50 mm取得・75 mm保持が強すぎる／弱すぎると感じないか。
- コンテナ角、異なる2積荷、床と上面の切替が意図どおりに見えるか。
- 視点変更後の矢印方向が直感に合うか。
- 操作ガイドなしでも、スナップ切替、積層連動、Undoを発見・理解できるか。

これらの主観評価は、正式fixtureと評価者区分を定めた実務利用者試用へ含める。自動試験の合格を、人間の使いやすさまたは実積載の安全性の保証へ読み替えない。
