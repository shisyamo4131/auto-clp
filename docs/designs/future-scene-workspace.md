# Future Scene Workspace Design Proposal

- Status: Proposal — 未承認・未実装
- Product: Auto CLP
- Last verified: 2026-08-31
- Related roadmap: [Auto CLP roadmap](../roadmaps/auto-clp.md)
- Related specification: [Planned Scene Extensions](../specification.md#planned-scene-extensions)
- Related decisions: [ADR 0001](../decisions/0001-local-first-web-architecture.md)、[ADR 0002](../decisions/0002-cuboid-model.md)、[ADR 0013](../decisions/0013-manual-local-persistence-and-json-files.md)、[ADR 0017](../decisions/0017-scene-workbench-rotation-and-compact-controls.md)、[ADR 0025](../decisions/0025-viewer-first-application-shell.md)
- Authority: 本文書は実装前の設計提案であり、確定要件ではない。現行仕様とAccepted ADRが優先する。

## Purpose and Boundaries

人間の試用を待たずに進められる将来設計として、次の二点を現行コードとThree.js 0.185.1に照らして調査した。

1. 複数のコンテナ・車両候補を切り替えても、荷室外に避けた未配置積荷の関係を維持する作業面。
2. 寸法が似た積荷を人が識別しやすくする、任意の写真・識別画像。

本提案はアプリ、Schema、保存データ、仕様版、進捗を変更しない。外部通信、実データ、画像URL、クラウド保存は対象外である。実装開始には、後述する未決定事項の承認、現行仕様への反映、新しいAccepted ADR、実装・テスト・運用・変更履歴の同期が必要となる。

## Confirmed Repository Facts

### Candidate switching and staging

- 選択候補は `SceneWorkspace` のUI stateであり、切替だけではProject、Undo/Redo、保存済み判定を変更しない。
- 未配置積荷の作業位置はcargo IDごとの絶対 `positionMm` と向きを一つのsession mapに保持する。候補寸法が変わって同じ絶対位置が荷室と重なる場合は、候補ごとの初期gridへfallbackするため、現在は退避関係を候補間で維持できない。
- 配置済み積荷は他候補のsceneへ重複表示せず、完全drag-out時の外側poseはUndo/Redoのためsessionに残す。
- camera stateは `ThreeViewport` に一候補分だけ保持するため、A→B→Aで候補ごとの視点を復元できない。
- 物理判定WorkerはProject tokenとcontainer IDで世代管理され、候補切替時に前の応答を破棄できる。自動提案は全候補を比較し、sceneの選択候補を入力にしない。
- 選択候補、作業位置、cameraはJSON、IndexedDB、履歴へ保存しない現行契約である。

### Cargo images

- Schema 0.1.0のCargoには画像fieldがなく、`additionalProperties: false`、CLP JSON全体は5 MiB上限である。永続画像を追加すれば新しいSchema版と移行が必要になる。
- 現行sceneは向き適用後の寸法で `BoxGeometry` を作るが、画像の物理的な正面・上辺・鏡像を保存する契約を持たない。現在のorientation codeだけから写真を貼る一つの物理面と上下を決めることはできない。
- Three.js 0.185.1のBoxGeometryは面別materialを利用でき、Spriteは常にcameraへ正対する。Texture、ImageBitmap、object URLは別々に解放責任を持つ。
- 画像は物理寸法、pick範囲、衝突、支持、開口、重量、自動提案へ影響させない表示情報でなければならない。
- 端末内だけで扱っても、写真には顧客名、ラベル、製造番号、人、位置情報、EXIFが含まれ得る。repositoryとテストでは匿名の合成画像だけを使う必要がある。

## Proposal A: Multi-candidate Workspace

### Recommended session model

未配置積荷の絶対座標を候補ごとに複製せず、cargo-globalなside-relative anchorへ置き換える。

```text
StagingAnchor = {
  orientation,
  side: x-min | x-max | y-min | y-max,
  outwardGapMm,
  tangentCenterOffset2Mm,
  zMm
}
```

- `x-min` は開口側、`x-max` は奥、`y-min` は入口から見た右、`y-max` は左とする。
- 荷室外側面から積荷外面までの距離は整数mmで保持する。
- 接線方向は中心差の2倍を整数で保持し、奇数mm寸法でも0.5 mm関係を失わず、投影時だけ既存の決定的丸めを適用する。
- cornerへdropした場合は直前のsideを維持できれば維持し、できなければ最短距離と固定tie順で一辺を選ぶ。
- 未配置になった全積荷へ初回grid poseを直ちにmaterializeし、他の積荷が配置・削除されても未操作積荷がgrid再計算で動かないようにする。
- 配置中の積荷のanchorは削除せず隠して保持し、drag-outのUndo/Redo時に同じ外側関係へ戻す。積荷自体を削除した場合だけ破棄する。

候補切替時はactive candidateの長さ・幅と現在の向き適用後寸法からanchorを絶対poseへ再投影する。任意候補で未配置積荷を動かすと一つのcargo-global anchorを更新し、他候補にも同じ側・距離・相対順として現れる。

#### Deterministic encode and projection contract

候補の内寸を `L`（X方向）・`W`（Y方向）、向き適用後の積荷寸法を `dx`・`dy`、積荷の最小隅を `(x, y)` とする。値はすべて有限のsafe integer mmで、加減算と2倍計算はoverflowを検査する。

| Side | Anchorとして有効な完全荷室外条件 | Encode | Project |
| --- | --- | --- | --- |
| `x-min` | `x + dx <= 0` | `g = -(x + dx)`、`t2 = 2y + dy - W` | `x = -dx - g`、`y = round((W - dy + t2) / 2)` |
| `x-max` | `x >= L` | `g = x - L`、`t2 = 2y + dy - W` | `x = L + g`、`y = round((W - dy + t2) / 2)` |
| `y-min` | `y + dy <= 0` | `g = -(y + dy)`、`t2 = 2x + dx - L` | `y = -dy - g`、`x = round((L - dx + t2) / 2)` |
| `y-max` | `y >= W` | `g = y - W`、`t2 = 2x + dx - L` | `y = W + g`、`x = round((L - dx + t2) / 2)` |

- `g` は非負の `outwardGapMm`、`t2` は符号付きの `tangentCenterOffset2Mm` である。`round` は正負ともhalf away from zeroとし、既存実装と異なる場合は移行テストで差を明示する。
- cornerで複数sideが有効なら、直前のanchor sideがまだ有効な場合はそれを保持する。それ以外は `g` が最小のside、同値なら開口側を先頭とする固定順 `x-min`、`x-max`、`y-min`、`y-max` で選ぶ。
- Project時も少なくとも一軸で完全荷室外条件を満たすことをpostconditionとし、丸め後に破る結果は採用しない。
- `orientation` が削除・不許可になった場合、値がsafe integerでない場合、checked arithmeticがoverflowする場合、またはpostconditionを満たせない場合はanchorを破棄し、最初の許可向きで決定的な初期grid anchorを一度だけmaterializeする。
- session anchorの `zMm` はsafe integerとして保持する。現行の未配置初期値は床面 `0` とし、利用者が明示的に動かした外側Zは候補切替で維持する。候補切替だけでZ snapや支持判定は行わない。

### Candidate navigation

- 候補は一行の横scroll可能なsemantic tablistを第一案とする。`role=tablist`、`aria-selected`、左右矢印、Home/End、active tabのscroll into viewを備える。
- 100候補を縦へwrapせず、305 / 320 / 375 pxではtoolbarと別の内容高rowを維持する。
- 長名・重複名は表示を省略できるが、accessible nameとtitleには名前とIDを含める。
- drag、dialog、永続化など既存busy gate中は切替を拒否する。候補削除時は先頭候補へfallbackし、Undoで復活しても自動再選択しない。

### Candidate-specific camera

`ThreeViewport` の単一camera refをcontainer ID別mapへ変更する。active候補のOrbit/zoomを保存し、再表示時に復元する。候補削除時は該当entryをpruneし、新規CLP・正常読込・端末読込の既存barrier remountで全cameraを消す。全体表示iconはactive候補だけをresetする。

### History, persistence and workers

- tab、camera、荷室外のsession anchor変更はProject、履歴、保存dirtyを変更しない。
- placement add/move/rotate/delete、Project編集、Undo/Redo、保存・読込の既存境界は変えない。
- 物理判定はactive container IDの変更で既存Workerを再実行し、stale応答とreason pageを破棄する。
- 自動提案は候補切替ではstaleにしない。結果が別候補を指す場合は自動切替せず、明示的な「提案先を表示」操作を候補とする。

### Alternatives not recommended

- 候補別の絶対pose mapは独立workbenchにはなるが、「一つの退避関係を候補寸法へ再投影する」目的を満たさず、状態を重複する。
- 現在のglobal絶対poseは候補寸法差で荷室へ重なりfallbackする。
- 寸法比率のnormalized poseは物理的な外側距離が変わり、丸めdriftを生む。

## Proposal B: Cargo Identification Images

### Recommended staged introduction

1. **Session-only thumbnail prototype:** local fileだけを受け取り、処理済みthumbnailを選択積荷cardへ表示する。Schema 0.1.0、JSON、IndexedDB、Undo/Redoへ含めず、session-onlyと明示する。native selectのoptionへ画像は入れない。
2. **Durable thumbnail:** 有用性と上限を確認後、新Schemaで小さな処理済みderivativeだけを保存する。元画像、ファイル名、EXIF、GPS、時刻、端末情報は保存しない。
3. **Selected-only 3D sprite:** 選択中積荷だけにcamera-facing labelとして表示し、solid cuboidと文字selectを維持する。全1,000積荷へ同時textureを作らない。
4. **One-face texture:** 写真が実物の特定面を表す業務要件が確認された場合だけ、cargo-localな面、画像上辺、鏡像、6向きの90度規則を新契約として確定して実装する。

同じ写真を全6面へ反復する方式は、識別性より視覚ノイズが増え、drag・選択・状態色と競合するため採用しない。

画像処理の所有権はcargo IDだけで判定しない。session prototypeでも `currentClpIdentity + cargoId + attachmentGeneration` を一つの所有キーとし、decode・resize・GPU uploadの完了時に三つすべてが現在値と一致する場合だけ表示へ反映する。積荷削除、画像置換・削除、新規CLP、JSON読込、端末読込はgenerationを無効化して進行中処理をabortし、遅れて完了した結果を破棄・解放する。削除後に同じcargo IDが再利用されても旧画像を結び付けない。

### Proposed ingestion and limits for a durable phase

以下は初期値の提案であり、承認値ではない。

- remote URL、SVG、HTML、実行可能・vector content、animationを受け付けず、local JPEG/PNGをsignatureとdecode結果で検証する。WebPは対応browser決定後に検討する。
- 圧縮byte、pixel寸法、総pixel数をdecode前後で制限し、containで歪ませず最長辺256 px以内へ縮小する。
- metadataとorientationをpixelへflattenし、制御した形式へ再encodeする。
- 1画像64 KiB、画像合計約3 MiBを出発点とし、最終的なUTF-8 JSON 5 MiB gateを常に優先する。
- 1,000積荷すべてへ画像を保証しない。全件画像が必須なら単純JSONではなくbundle形式を別途検討する。

GPU上のRGBA textureは圧縮ファイルbyteより大きい。mipmap込み概算は256²で約0.33 MiB、512²で約1.33 MiB、1024²で約5.33 MiB/画像となるため、選択対象だけをlazy decode・uploadする。実際の上限とframe costは対象端末で測定する。

### Durable data-model alternatives

- **推奨:** 新Schemaのroot presentation annexに `cargoImages[]` を置き、cargo ID、media type、width、height、base64 derivativeを一件ずつ保持する。物理・自動提案Workerへpresentation bytesを送らない。
- Cargo fieldへのinline埋込は物理modelと表示情報を混ぜ、copyとWorker伝送へ波及する。
- IndexedDB Blob sidecarはJSON・救出の可搬性、孤児cleanup、原子性が複雑になる。
- archive/bundleは大量画像には適するが、現在の単純JSON運用を置換し、import攻撃面と復旧手順を増やす。

永続画像を採用する場合はSchema 0.2.0などの新version、0.1.0→新versionの決定的migration、固定JSON・救出名、preflight、明示downgradeを同じ変更で設計する。rollbackで画像を黙って捨てず、新版exportを保持するか、確認付きの「画像を除いて旧版へ書き出す」を提供する。

永続annexを採用する場合はcargoとの参照整合性を原子的に検証し、積荷削除と対応画像削除を一つのProject commandとして扱う。画像の追加・置換・削除を履歴対象にするかは承認事項だが、対象にする場合は参照と不変の処理済みbyteを同じUndo/Redo単位で復元し、対象外なら操作前にその非可逆性を明示する。孤児参照や孤児byteを正常保存へ残さない。

### Failure, accessibility and privacy

- type/signature、size、pixel寸法、decode、re-encode失敗ではProjectを変更せず、旧画像とCLPを保持して固定・非反射の理由を示す。
- import中の不正画像はCLP全体を原子的に拒否する。画像だけを黙って落とさない。
- runtime decode/GPU失敗ではsolid cuboid、積荷名・ID・寸法・状態textを残し、「画像を表示できません」と示す。
- imageは唯一の識別手段にせず、replace/removeをkeyboard操作可能にし、305 / 320 / 375 pxを検証する。
- attach/export前に、ラベル、人物、顧客情報、製造番号、位置情報が含まれ得ることを案内する。filename、path、EXIF、raw image valueを保存・log・errorへ反射しない。
- object URL revoke、ImageBitmap close、Texture disposeをreplacement、unmount、context lossで独立して行う。
- cargo削除・同一ID再作成、画像置換中の削除、新規CLP・import・端末読込との競合では、旧generationの非同期完了を必ず無視して資源を解放する。

## Compatibility, Migration and Rollback

複数候補workspaceの推奨案はsession-onlyであり、Schema 0.1.0と既存JSONを変更しない。候補tab・anchor・cameraを実装単位で削除すれば現行selectと絶対staging poseへrollbackできる。

session-only画像prototypeもSchema変更なしで撤去できる。永続画像は非互換の保存契約追加となるため、仕様・ADR・Schema・data-model・serializer・IndexedDB/JSON/rescue・履歴・Worker projection・テストを一括変更し、旧アプリが新版を読めないことを明示する。

永続画像のdeployment前には、旧版へ戻すための実効的なgateを満たす。次のどちらかを検証できるまでSchema 0.2.xの保存を有効化しない。

1. rollback用buildが0.2.xをread-onlyで開き、losslessな新版JSON救出または明示確認付きの画像除外0.1.0 exportを実行できる。
2. 旧buildを有効化する前に全保存枠を新版JSONへbackupし、利用者確認後に検証済みdowngradeを完了する。

復旧順は「0.2.x原本を変更せず救出 → downgrade結果を別データとして検証 → 利用者が切替確認 → 旧build有効化」とする。旧buildが未知の新版保存枠を見つけた場合は上書きせず停止する。新版原本を保持するlossless recoveryと、画像を除く確認付きlossy exportを同じ表現で扱わない。IndexedDB version upgrade、transaction失敗、容量不足、旧build再起動を含むrollback rehearsalをrelease gateにする。

## Required Verification if Approved

### Multi-candidate workspace

- 4辺のencode/project往復、正負half-away-from-zero、corner tie、奇偶寸法、全6向き、候補寸法変更、積荷編集、safe-integer境界・overflow・fallback、完全荷室外postcondition、初期grid安定性、1,000積荷性能。
- A→B→Aの退避距離・順序、他候補配置の除外、任意tabでの移動・回転、drag-out Undo/Redo、積荷・候補削除とUndo。
- 候補別camera、同一候補編集、candidate prune、新規CLP・import barrier、active候補だけのreset。
- tab/anchor/cameraが履歴・保存dirty・JSONへ入らず、placement操作だけが既存履歴へ入ること。
- 物理Workerの高速切替stale mask、自動提案がtab切替では生存し、Project変更ではstaleになること。
- tab semantics、keyboard、focus、長名・重複名、0/1/100候補、305 / 320 / 375 / 560 / 720 pxで非重複・非overflow。

### Cargo images

- signature、base64、pixel、per-image、合計、最終5 MiB境界と0.1.0 migration、欠落・重複cargo ref、strict atomic import。
- 積荷削除後の同一ID再作成、decode中の削除・置換・新規CLP・JSON読込・端末読込、遅延完了、generation不一致、孤児参照・byte、annex cleanup、採用した履歴方針のUndo/Redo。
- portrait/landscape/square/透明、EXIF向き、破損、SVG、animation、oversize、極端寸法、replace/remove、focus、keyboard、狭幅。
- IndexedDB、JSON、救出、容量不足、失敗時保持、network request 0、metadata除去。
- 0.2.x原本のlossless救出、別データへの確認付き0.1.0 downgrade、未知versionのno-overwrite、upgrade失敗、rollback rehearsal。
- sprite anchor、drag・回転・camera追従、pick・物理非影響、fallback、context loss、texture/object URL/ImageBitmap cleanup。
- 画像なし1,000積荷、承認画像budget、100回置換・履歴、Worker clone、renderer memory/frame time。

## Decisions Requiring Approval Before Implementation

1. 複数候補の退避関係を、推奨する4辺・絶対mm gap・2倍中心offsetとするか。自動提案後の候補切替を明示操作だけにするか。
2. 100候補を横scroll一行tablistとするか、別のcompact navigationを採るか。
3. 積荷画像を選択card＋選択中spriteの識別補助とするか、物理面へ結び付けるか。全1,000積荷への画像を必須とするか。session画像でもCLP identity・cargo ID・generationによる所有権とbarrier cleanupを必須とするか。
4. 永続画像を採用する場合のSchema形、対応形式、pixel/byte上限、追加・置換・削除のUndo/Redo、原子的annex cleanup、lossless救出・確認付きlossy downgradeをどうするか。

回答前は、本提案を仕様、ADR、実装の承認として扱わない。
