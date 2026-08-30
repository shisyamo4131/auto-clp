# 0021 固定回転toolbarと軸icon

- Status: Accepted
- Date: 2026-08-30
- Related specification: `../specification.md` 0.17.0
- Refines: ADR 0017
- Supersedes: ADR 0018のX/Zで異なるSVG pathを使う表示規則

## Context

人間再試用でdrag集中表示は期待どおりと確認された。一方、回転controlは選択積荷の投影位置へ追従したままで、回転ごとにbutton位置が動き得た。Z軸iconもX軸iconとの関係を直感的に読み取りにくく、180度回転のような連続操作ではpointerを動かし直す必要があった。評価者は、Undo/Redoと拡大・縮小の横へ回転を固定し、両軸に一本の軸線へ矢印が回り込む同じiconを使って一方を90度回して区別し、操作不能時も位置を維持する方針を承認した。

## Decision

- X軸、Z軸回転buttonはUndo/Redo、`＋` / `－`、「荷室全体を表示」と同じviewport固定toolbarへ置く。選択mesh、camera、resize、回転結果へ追従させず、回転前後でbutton位置は変えない。
- 両軸に一本の軸線へ矢印が回り込む同じSVG glyphを使い、X軸glyphだけをZ軸glyphに対して90度回して見せる。axisの意味は `X軸を中心に90°回転` / `Z軸を中心に90°回転` のaccessible nameとtitleでも明示する。
- 両buttonは積荷未選択時も常時表示する。未選択、drag・dialog・保存等のbusy、該当する許可向きなし、天地無用では、focus可能な `aria-disabled` controlとして理由を説明参照、title、操作statusへ返す。
- Z軸は床面内回転、X軸は横倒し方向の回転とし、orientation遷移、最小角、Project履歴、荷室外session pose、重なり拒否、天地無用がXだけを制限する規則はADR 0017から変更しない。

## Rationale

固定位置なら、180度回転や向き比較でpointerを追従させずに同じbuttonを連続操作できる。同一glyphの90度差は、別々の抽象図形を覚えるより軸の関係を比較しやすくする。常時表示は操作場所を安定させ、無効理由をアクセシブルに保つ。

## Impact

- Users: 回転、Undo/Redo、拡大・縮小を同じ作業領域で見つけられ、回転後も同じ位置から続けて操作できる。
- Data: Project、JSON、IndexedDB、Schema `0.1.0`、orientation code、履歴の意味は変更しない。
- Implementation: mesh投影位置のDOM計算を除去し、固定toolbar内へ常設のaxis回転groupを置く。X iconはCSSで90度回す。
- Tests: 未選択時の常設・無効理由、同一SVG pathと90度差、天地無用、busy、連続回転後のbutton位置、向き更新とUndo/Redo、狭幅を回帰する。

## Compatibility, Migration, and Rollback

保存データ移行のない後方互換UI変更である。rollbackは固定toolbar groupを除去して旧mesh追従controlとdistinct pathを復元する。Projectデータのrollback migrationは不要である。

## Reconsideration Conditions

toolbarが狭幅で主要canvasを恒常的に覆う、人間試用で90度差が軸を十分に伝えない、touch向け別操作面、任意角回転、または面の表裏を扱う必要が生じた場合。
