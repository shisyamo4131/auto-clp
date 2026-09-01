# 0026 荷室tab・選択annotation・物理判定dialog

- Date: 2026-08-31
- Status: Accepted
- Related specification: Application Shell and Primary Workflow; Placement and Validation; Planned Terms of Use; Automatic Proposal
- Supersedes: None
- Refines: 0008, 0012, 0017, 0019, 0021, 0025

## Context

仕様1.1.1の人間試用ではviewer-first shell、回転、候補切替、Drawer、狭幅、既存3D操作が期待どおりと確認された。一方、menuは操作群の右端が自然で、native候補selectは複数荷室を一つの作業bookとして捉えにくく、可視の荷室外件数と選択cardは主作業面を占有した。利用者はExcel sheet tab相当の横scroll候補切替、選択直方体への寸法、積荷selector直下の固定操作、判定lampとdialogを承認した。

単独支持のたびに同じ構造・安定性未確認reasonが積荷数分生成され、通常の幾何学的段積みが常に黄色となる問題も確認された。Auto CLPは構造安全を計算・保証しないため、この共通限界は積荷別reasonではなくアプリ全体の使用条件として扱う。一方、複数支持、隙間、張り出し、支持不可面との混在は配置固有の判断材料であり、個別未確認を維持する。

## Decision

- Application Barのmenu buttonをDOM・視覚とも右端へ置く。
- 候補を一行のsemantic tablistで表示し、左右button、横scroll、keyboard、touchで100候補まで扱う。候補tabとscrollはProject、dirty、JSON、履歴へ入れない。
- cameraは候補別に保存せず、視線方向・上下角度・fit距離倍率を一組だけ共有し、候補中心と寸法へrebaseする。
- 荷室外poseをcargo-globalな4辺side-relative anchorとしてsession保持する。候補切替で同じside、外向きgap、2倍接線中心差、Z、向きを再投影し、完全荷室外を保証する。決定式、丸め、tie、fallbackは承認済み設計提案のDeterministic encode and projection contractを採用する。
- 可視の荷室外件数を消し、非視覚statusと積荷optionの状態は維持する。
- 選択cardを廃止し、選択meshへ向き適用後のX/Y/Z寸法annotationを重ねる。操作はmeshに追従させず、積荷selector直下の固定context action rowへ置く。未配置、現在候補配置、他候補配置、未選択を分け、配置取り外しと積荷定義削除を別操作として維持する。
- 物理判定を常時mountする一つのcontrollerからlampとmodal dialogへ供給する。lampは灰・青・黄・赤にiconとtextを併用し、不適合優先でも未確認件数を失わない。dialogを閉じても判定を続け、開いている間は背後操作をbusy gateで止める。
- `structure-stability-unverified` を積荷別reason、集約count、Worker protocol、自動提案payloadから除く。単独支持は実装済み幾何制約の適合とし、`support-conditions-unverified` と全不適合reasonを維持する。青は安全・積載可ではなく「実装済み確認項目内で問題なし」を意味する。
- 版付き「使用上の重要事項」を初回と版更新後の操作開始前に確認し、Drawerと物理判定dialogから再表示できるようにする。法的同意とは呼ばず、確認状態をCLP dataから分離する。
- Refinement 2026-09-01: 実在する顧客名、個人情報、秘密情報、実貨物や搬送記録を入力しない注意を内容版1.1.0へ加え、主ページの重複表示を撤去する。Drawer最下部にはpackageのアプリ版とCLPデータ形式版を表示する。

## Rationale

tab、annotation、固定action row、lampは主作業面を広く保ちながら、候補・対象・寸法・状態・操作を同じviewportへ集約する。操作buttonをmesh追従にしないことで、画面外、遮蔽、別候補、候補0件、touch、keyboardでも入口を失わない。side-relative anchorは寸法の異なる候補でも人間が作った退避関係を維持する。

個々の単独支持へ同じ非保証reasonを繰り返すより、計算対象外を版付きの全体条件として一度明示し、配置固有の張り出し等だけを黄色で示す方が、lampの意味と利用者の修正判断が一致する。

## Alternatives

- native selectを維持する案は多数候補の横断把握と直接切替を弱めるため採用しない。
- 候補別cameraは不要と判断し、共有視点を採用する。
- absolute staging poseは候補寸法差で荷室へ重なりgrid fallbackするため採用しない。
- mesh近傍buttonは画面外・別候補で入口を失い、回転で位置が動くため採用しない。
- 単独支持reasonをUIだけfilterする案は黄色countと理由0件が矛盾するため採用しない。
- 判定hookをdialog内だけへ置く案は閉鎖中にlampを更新できないため採用しない。

## Impact

- Users: 荷室をtabで切り替え、選択積荷の寸法をscene上で確認し、固定rowから編集する。判定はlampからdialogで確認し、共通の非保証は使用上の重要事項で確認する。
- Data: Schema `0.1.0`、Project、JSON、端末保存を変更しない。tab、anchor、共有camera、選択、使用事項確認は非永続またはapp preferenceである。
- Domain: 単独支持の共通未確認reasonを除き、配置固有の支持条件未確認と不適合は維持する。自動提案の案探索と配置は変えず、reason metadataとhashを再検証する。
- Implementation: Application Bar、scene projection、camera、viewport overlay、physical Worker ownership、Drawer、dialog、使用事項gateを変更する。
- Documentation: 仕様1.2.0、受入、運用、ロードマップ、変更履歴、設計提案statusを同期する。
- Tests: tab、side anchor、shared camera、annotation、固定actions、lamp/dialog、使用事項、domain/Worker/自動提案、305 / 320 / 375 px、keyboard、touch、1,000積荷を回帰する。

## Compatibility and Migration

既存CLPとSchema `0.1.0`は無変更で読める。旧単独支持reasonは保存データではなく読込後の派生値なのでmigrationしない。旧absolute staging pose、選択、camera、理由pageはsession-onlyであり再起動時に移行しない。使用事項確認はCLPとは別keyで版管理する。

## Rollback

tabをnative select、side anchorを旧absolute session override、annotationと固定rowを選択card、lamp/dialogを常設panelへ一括して戻せる。使用事項確認gateを戻す場合も、単独支持reasonと旧集約契約を同時に復元する。Schema rollbackは不要である。

## Reconsider When

同時に複数荷室を表示する、候補別cameraが必要になる、荷室外poseをCLPへ保存する、任意角回転、寸法annotationの印刷、法的な利用規約同意、または構造・安定性計算を製品範囲へ加える場合。
