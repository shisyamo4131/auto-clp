# 0022 天地無用だけを使う積荷向き方針

- Status: Accepted
- Date: 2026-08-30
- Related specification: `../specification.md` 0.18.0
- Supersedes: ADR 0007の利用者が任意の許可向き集合を編集する規則、ADR 0017の詳細checkbox、ADR 0021の許可集合不足によるZ軸回転無効化
- Refines: ADR 0017、ADR 0021

## Context

人間再試用で、旧保存データの積荷が現在向き1種類だけを持つ場合にX/Z両回転が無効となり、床面回転まで禁止できる状態が確認された。しかし床面内の90度回転を禁止する実務上の設定要望はなく、利用者が必要としている制約は横倒しを防ぐ「天地無用」だけである。積荷編集画面に6種類の向きcodeを直接並べるUIも、天地無用との関係を理解しにくくしていた。

## Decision

- 積荷編集画面の向き設定は「天地無用」checkboxだけとし、6種類の個別許可checkboxを表示しない。
- 天地無用ONは元のHeightをZへ保つ `LWH` / `WLH` の2向き、OFFは6向きすべてへ対応する。`allowedOrientations` はSchema `0.1.0` の互換fieldとして保持するが、UIから任意の部分集合を作らない。
- Z軸の床面回転は、積荷が選択され、drag・dialog・保存等のbusyでない限り常に利用できる。天地無用はX軸回転だけを無効にする。
- 旧JSONまたは端末保存を読込む時は、Schema・意味・物理preflight合格後に向き方針を正規化する。許可集合が `LWH` / `WLH` だけの非空部分集合なら天地無用ONの2向き、それ以外の有効な非空部分集合ならOFFの全6向きとする。正規化後の次回保存で新方針を永続化する。
- 横倒し向きで配置中の積荷を天地無用ONへ変更しようとした場合は、既存の配置向き整合性により保存を拒否し、先に配置向きを立置きへ戻す。
- 回転buttonの使用可は拡大・縮小buttonと同じ青緑の強調枠と暗い背景を使い、使用不可は低彩度の枠・iconとする。紫色の塗り分けは使用しない。

## Rationale

利用者が理解・設定する業務概念を天地無用へ一本化し、Z軸回転を常に保つことで、保存データの偶発的な部分集合が基本操作を妨げない。Schema fieldを維持すれば既存JSONを拒否せず移行でき、次回保存から決定的な2種類の方針へ収束する。回転buttonを同じtoolbarの拡大・縮小と揃えることで、色面ではなく枠線を操作可能性の手掛かりにできる。

## Alternatives

- 6種類の詳細checkboxを残す案は、床面回転禁止という不要な状態を引き続き作れるため採用しない。
- `uprightOnly` booleanをSchemaへ追加する案は、既存の `allowedOrientations` と二重の正本になり、Schema移行を要するため採用しない。
- 旧部分集合をそのまま尊重してZ軸回転だけ例外許可する案は、配置・開口・自動提案と手動回転の正本が分岐するため採用しない。

## Impact

- Users: 向き設定は天地無用だけになり、床面回転は常に利用できる。天地無用を外すと横倒しを含むX軸回転が利用できる。
- Data: JSONの形とSchema `0.1.0` は変更しない。読込後の `allowedOrientations` は2向きまたは6向きへ正規化される。
- Implementation: 純粋な向き方針normalizerをapplication読込境界と両積荷editorで共有し、SceneWorkspaceはZ軸を任意部分集合で無効化しない。
- Tests: 旧1向き・横倒し部分集合の正規化、非変異、天地無用だけのeditor、Z常時可、X制限、回転buttonとzoomの枠一致、端末保存・再読込を回帰する。

## Compatibility, Migration, and Rollback

旧Schema `0.1.0` のJSONと端末保存は引き続き読込可能で、合格後に上記規則で正規化する。配置、座標、積荷寸法、重量、支持設定は変更しない。rollbackはnormalizer、editor簡略化、SceneWorkspaceのZ規則、枠線styleを戻す。新方針で保存済みの2向き・6向きは旧版でも有効なためデータrollbackは不要である。

## Reconsideration Conditions

床面回転禁止、前後方向、面の表裏、天地反転、傾斜、または積荷カテゴリ別の方向制約が実務要件として具体的に承認された場合。
