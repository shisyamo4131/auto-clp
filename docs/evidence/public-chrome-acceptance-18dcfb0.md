# Public Chrome Acceptance — Codex UI-assisted Observation

- Status: Partial evidence
- Checkpoint: `CP-PUBLIC-CHROME-ACCEPTANCE-001`
- Local repository HEAD at observation start: `18dcfb06a70ff17bb7a13a1bd9036dc24f7d126a`
- Recorded: 2026-09-17
- Target: `https://shisyamo4131.github.io/auto-clp/`
- Browser: 接続済みのGoogle Chrome
- Data classification: 匿名の合成データのみ
- Related acceptance: [AC-06、AC-09、AC-14](../acceptance.md)
- Related roadmaps: [Auto CLP roadmap](../roadmaps/auto-clp.md)、[積込順提案・PDF帳票 roadmap](../roadmaps/loading-sequence-pdf-report.md)

## Classification and Limit

Codexが公開中のGitHub PagesをChromeで操作した、開発補助のUI観察である。localhost、headless browserのassert、実在顧客データは使っていない。一方、評価者は人間または精密機器運送の実務利用者ではないため、人間による文字・改ページの精読、操作感、実務受入、安全保証を証明しない。

PDF出力では、画面上の成功表示と固定ファイル名を確認した。Computer Useのdownload eventは捕捉できなかったが、その後、人間のプロジェクト評価者が実際にダウンロードされたPDFを目視し、改ページ、フォント等を問題なしと判定した。この人間観察はbinaryの文字抽出、画像数の機械検証または実務利用者受入とは区別する。

## Observed Results

### AC-14 — 1件、20件、30件

- 1件: 一覧1件、番号付き5視点画像5枚、各画像のlabel数1、PDF開始成功表示と固定名 `auto-clp-loading-report.pdf` を確認した。
- 20件: 総重量210 kg、積込済20/20、一覧20件、先頭・末尾の名称、番号付き5視点画像5枚、各画像のlabel数20、PDF開始成功表示を確認した。
- 30件: 総重量465 kg、積込済30/30、一覧30件、先頭・末尾の名称、番号付き5視点画像5枚、各画像のlabel数30、PDF開始成功表示を確認した。
- 30件のselectorはplaceholderを含め31 optionを表示し、30件目を選ぶと名称、`200×200×200 mm／30 kg`、青い「現在のコンテナに配置済み」状態、座標操作を表示した。検索語 `匿名積荷29` では、現在選択中の30件目と一致する29件目だけを候補として保持した。
- 観察後、人間のプロジェクト評価者がダウンロード済みPDFを目視し、改ページ、フォント等を問題なしと判定した。

### AC-14 — 積層、複数支持、提案不能

- 2つの支持荷と1つの上段荷では、支持荷A、支持荷B、上段荷の順になり、上段荷に両支持荷の先行理由を表示した。
- 複数支持は「未確認」とし、支持位置、剛性、張り出し、許容支持間隔を確認する理由を表示した。3件すべてを番号付けした5視点画像5枚を生成し、PDF開始成功表示を確認した。
- 正体積重複の2件では「積込順を提案できません」、関係する両積荷名、重複理由を表示し、5視点画像生成とPDF出力を無効にした。不完全な順序またはPDFを成功扱いしなかった。

### AC-09 — 制約一括編集

- 支持荷Aの「上乗せ禁止」と支持荷Bの「天地無用」を同時に変更し、dirty状態からキャンセルすると破棄確認を表示した。「変更を破棄して閉じる」後の再表示で、6個のcheckbox値が変更前と一致した。
- 同じ2項目を適用すると配置3件を維持し、履歴に「積荷制約の一括更新」を1件追加した。Undoを1回実行するとUndoは無効、Redoは有効になり、配置3件を維持した。
- 単一支持fixtureでは、下段の支持荷Aだけを「上乗せ禁止」にすると、不適合1件、未確認0件となり、「支持荷Aは上乗せ禁止のため、上にある上段荷を支持できません」と対象・関連積荷を表示した。配置2件は維持した。
- 複数支持fixtureで片方の支持荷だけを上乗せ禁止にした場合は、複数支持の「未確認」のままだった。これは単一支持の専用理由と異なる境界動作であり、本観察では仕様適合または不具合と確定していない。
- 後続判断で「接触支持荷が一つでも上乗せ禁止なら不適合」を採用し、仕様1.14.1・ADR 0045の実装対象とした。この行は観察時点の公開版挙動を履歴として残す。

### AC-06 — 重心表示

- 10 kgと90 kgを離して配置した匿名fixtureで、総重量100 kg/1000 kg、積込済2/2を表示した。
- コンテナ幾何中心の赤点と積荷合成重心の黄点は3D画面上で分離して見え、凡例の色・意味と一致した。両点に白い外枠は見えなかった。
- 色覚や表示環境を含む人間の視認性・理解度は未評価である。

### Cross-cutting

- すべてのfixtureは公開URLへJSONから読み込み、3D利用可能状態で確認した。
- 観察終了時のブラウザconsole logは0件だった。
- 公開環境やリポジトリへ実在データ、認証情報、秘密情報を送信していない。

## Remaining Acceptance

- 1件、20件、30件、積層、複数支持、循環／提案不能をまとめたPhase 5の追加自動回帰。
- 実pointerによる積層移動、荷室外drag、2面fit、50 mm取得・75 mm保持、床／上面選択、視点基準矢印調整、衝突停止、長押し1回Undoの操作感確認。
- Windows版Excelでのtemplate往復と非UTF-8拒否。
- 実務利用者による正式な受入。安全性、構造強度、完全な搬入経路、法令適合性は本記録の対象外である。

## Repository and Side Effects

- 観察開始時のlocal `main` HEADはcommit `18dcfb06a70ff17bb7a13a1bd9036dc24f7d126a` だった。公開画面はdeploy commitを表示しないため、このUI観察だけでは公開artifactとのSHA対応を直接確認していない。
- ブラウザ側では匿名fixtureの読込、制約変更とUndo、PDF download開始を行った。端末保存は更新していない。
- 検証用JSONと生成scriptはリポジトリのignored `tmp/public-acceptance/` に置き、製品buildまたは保存形式へ含めなかった。観察後、Codexが生成した匿名fixture 7件と生成script 1件は削除した。

## 仕様1.14.1公開後の再確認

- local `main` のcommit `3f92f0c7baa415eac3a8ec8f68c9dd64055d2e96` を `origin/main` へpushし、GitHub Actions run `35212840606` の全stepが成功した。
- 公開URLをChromeで再読込し、匿名の複数支持fixtureをJSONから読み込んだ。物理判定lampは「不適合1件、未確認1件」を表示した。
- 不適合理由は「上乗せ禁止支持荷Aは上乗せ禁止のため、上にある上段荷を支持できない」旨を表示し、関連積荷には禁止された支持荷Aだけを含めた。
- 未確認理由は複数支持の構造・安定性確認を促し、関連積荷には支持荷Aと支持荷Bの双方を含めた。仕様1.14.1・ADR 0045の優先順位と一致した。
- 公開画面の「テンプレートダウンロード」で「積荷CSVテンプレートのダウンロードを開始しました」を確認した。現在のブラウザ操作環境はWindows版Excelを操作できないため、Excelでの編集、UTF-8 CSV保存、再読込の人間確認は未完了のままとする。
- 再確認に使用した匿名fixtureはignored `tmp/public-final/` に一時作成し、確認後に削除した。端末保存は更新していない。
