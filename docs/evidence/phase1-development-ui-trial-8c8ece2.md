# Phase 1 Development UI Trial — Partial Codex-assisted Observation

- Status: Partial evidence
- Checkpoints: `CP-PHASE1-DEV-UI-TRIAL-001`、`CP-PHASE1-DEV-UI-TRIAL-RECOVERY-001`、`CP-PHASE1-DEV-UI-TRIAL-CHROME-001`、`CP-PHASE1-DEV-UI-TRIAL-IAB-FINAL-001`、`CP-PHASE1-DEV-UI-TRIAL-POSTREBOOT-001`
- Product commit: `8c8ece219ab3ac40832d863e40231cd702472197`
- Recorded: 2026-08-28
- Data classification: 匿名の合成データのみ
- Related acceptance: [Phase 1 synthetic acceptance contract](../acceptance.md)
- Related roadmap: [Auto CLP roadmap](../roadmaps/auto-clp.md)

## Classification and Limit

読み取り専用のCodex UIテスターが、実ブラウザ画面で匿名合成ケースを操作した開発補助観察である。テストコードのassertだけを再利用した結果ではない。一方、テスターは人間でも精密機器運送の実務利用者でもないため、開発チーム内の人間試用、実務利用者受入、安全表示の人間理解を証明しない。再起動後のチェックポイントで通常経路のJSON再読込、WebGL非対応fallbackでのZ編集・物理判定・履歴・端末保存、305 / 320 / 375 px、主要focus、consoleまで観察したが、AC-04の全操作と人間試用は未完了で、ロードマップ進捗は94%のままとする。

## Observed Results

### AC-01 — Functional flow completed; exact drag was not completed without iterative correction

- canvas上の積荷選択、フォームの許可向き変更、確認付き配置削除、Undo、未確認理由、安全非保証copyは期待どおりだった。
- `(100,100,0)` から `(200,100,0)` へのfloor dragは、確定前に数値座標を確認できず、`(202,47,0)`、`(-19,-27,0)`、`(200,93,0)` の3回を誤って確定し、その都度Undoしてから目標へ到達した。
- `Ctrl+Z`で正確な開始位置、`Ctrl+Y`で正確な最終位置を復元した。Zと向きは維持された。
- 正確な座標、Z、向き、削除はフォームで発見・完了できたため、canvas側にZ・向き・削除を直ちに追加する根拠にはしない。
- 改善候補: drag確定前の数値previewまたはsnap、canvasから正確なフォーム操作へ戻る導線。現仕様違反や物理判定不具合とは分類しない。

### AC-02 — Completed

- 完全支持で不適合0、搬入経路未確認2件、上段の構造・安定性未確認1件を確認した。
- 上段Xを501 mmへ変更すると `support-not-full` 1件、追加のpair隙間理由なしとなった。
- UndoでX=500 mm、完全支持と未確認表示を復元した。

### AC-03 — Completed for the primary floor-penetration case

- 理由順は床突き抜け、矩形開口不適合、耐荷重超過で、対象積荷と修正案内を表示した。
- 同じ座標原因による軸別隙間不足、支持不足、一般的な `outside-container` は連鎖表示しなかった。
- 独立した開口・耐荷重理由を保持し、搬入経路未確認は表示しなかった。
- 床以外だけの壁・天井境界違反派生は未観察である。

### AC-04 — Partial

- X=501→Undo→Redo→Undoで最終X=500を確認した。
- 端末保存後にX=600へ変更し、端末保存を読み込むとX=500へ復元し、案件履歴が空へリセットされた。
- 固定名 `auto-clp-project-0.1.0.json` の書出し成功copyと、既定download先に933 bytesの合成JSONが存在することを確認した。
- 通常WebGL経路で上段Xを500→600へ変更してから同じJSONを再読込し、成功表示、支持台 `(500,500,0)`、上段 `(500,500,500)`、履歴空、未確認理由3件の再計算、alert 0件を確認した。file-inputの承認済み再試行は18.2秒で完了した。
- `?forceWebgl2=unsupported` では「3D表示を利用できません」とcanvas 0件を確認し、同じAC-02案件を端末保存から復元した。フォームで上段Zを500→501へ変更すると支持不足1件となり、UndoでZ=500と未確認理由3件へ復元し、Redoが有効なことを確認した。
- WebGL非対応時も向き、配置削除、端末保存・読込、JSON書出し・読込、自動提案のcontrolは有効だった。ただし向き変更、配置削除、JSON入出力の実行は未観察である。既存の自動ブラウザ回帰が合格していることと、人間が画面操作を完了した証拠は区別する。

## Cross-cutting Observation

- Keyboard: AC-01、AC-02、AC-04で `Ctrl+Z` / `Ctrl+Y` が正確に機能した。
- Focus: 案件名、端末保存・読込、JSON書出し・読込、自動提案、配置X / Y / Z、向き、配置保存・キャンセルは、個別のキーボードfocus時にtealのsolid 3 px outlineを表示した。配置編集開始時はX最小角入力へfocusした。JSON読込後はbodyへfocusしたが、直接file inputを設定する試験ツールの影響を排除できないため欠陥とは分類しない。自然なTab順の全巡回と削除確認後focusは未観察である。
- Narrow width: viewport 305 / 320 / 375 pxで横scroll、操作不能なclip、到達不能な主要controlはなかった。305 / 320 pxでは向きの補足文が視覚上省略されたが、`LWH`、完全なaccessible name、操作、focusは保持されたため、人間試用で読みやすさを確認する改善候補とする。
- Console: 観察フロー全体でwarning/error 0件だった。
- Safety copy: 物理理由の近くに、完全搬入経路、構造、重心、軸重、床強度、荷崩れ、固縛、動荷重、法令、実安全を保証しない表示があった。人間が正しく理解したことは未検証。

## Tool Recovery and Remaining Limits

最初のin-app Browser試用では、file chooser/setFilesを含む呼出しが535.2秒後に中断された。その後、fresh in-app Browser backendは一時利用不能、local Chrome接続も利用不能だった。backend状態が変わった後の最後のfresh in-app Browser試行でも、60秒timeoutを指定した一度だけのfile-input呼出しが返らず、435.0秒後に中断した。さらにWindows Computer Useで既存Chromeを起動する代替は、製品画面へ到達する前のapp approval timeoutで停止した。いずれも画面状態を再取得できず、Auto CLP製品不具合とは断定しない。再試行ループは停止した。

PC再起動後、最初のfile-input試行は約138.5秒後に応答したが、当初の60秒上限を超えたためツール環境遅延と分類した。ユーザーが明示承認した1回の再試行は18.2秒で完了し、アプリ側の復元結果まで確認できた。これらの遅延は製品性能不具合とは分類しない。残る観察は、WebGL非対応時の向き変更・配置削除・JSON往復、自然なTab順の全巡回、JSON読込後と削除確認後の自然なfocus、人間による安全表示と狭幅補足文の理解である。

## Repository and Side Effects

- 各試用後にbranch `main`、clean diff、primary worktree 1件を確認した。再起動後チェックポイントのbaselineは `ea23eef97275f4196a9140a9737b4acf56fbddeb` だった。
- リポジトリ変更、Git mutation、依存導入、外部通信、外部書込み、deploy、実データ、破壊的操作は行っていない。
- ブラウザのIndexedDB単一枠と、既定download先の合成 `auto-clp-project-0.1.0.json` だけが試用中のローカル副作用である。downloadは削除していない。
