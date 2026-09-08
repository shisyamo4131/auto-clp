# 0008 Phase 1の支持と荷重判定

- Date: 2026-08-27
- Status: Accepted
- Related specification: Placement and Validation
- Supersedes: None
- Refines: 0003
- Partial supersession: ADR 0019 supersedes the multiple-support union rule and introduces single-support / support-conditions-unverified classification. ADR 0032 supersedes only the clause that excluded all center-of-gravity calculation, by adding cargo-only reference visualization; the payload and remaining uncalculated safety boundaries remain active.

## Context

段積み可否を判定するには、幾何学的な支持と、構造強度・重心・軸重・固縛を分ける必要がある。現時点では積荷別上載荷重や荷重分布の入力がなく、力学的安全性を計算できない。

## Decision

- 床にない積荷は、底面の100%が同じ高さの一つ以上の支持上面の和集合で覆われる場合だけ、幾何学的に支持される。
- 支持面とのZ方向接触は完全一致を要求し、支持接触に限りZ軸固定隙間の例外とする。X・Y軸の固定隙間は隣接する非支持面に適用する。
- 支持に使われる全積荷が段積み許可でなければならない。複数支持への橋渡しは、支持上面が同一高さで底面を隙間なく100%覆う場合だけ許可する。
- Phase 1で重量により不適合とするのは、全積荷の合計質量が候補の耐荷重を超える場合だけである。
- 積荷別上載荷重、荷重分布、支持面ごとの分担、重心、軸重、床面強度、荷崩れ、固縛、動荷重は計算しない。段積みが幾何判定に合格しても「構造・安定性未確認」を常に表示する。
- 判定結果は少なくとも `valid`、`invalid`、`unverified` を区別し、幾何合格を実積載の安全保証として表示しない。

## Rationale

100%支持は部分支持より保守的で、軸整列直方体の矩形和集合として決定的に検証できる。入力のない強度や安定性を推測せず、未確認を別状態で残すことで誤保証を避ける。

## Impact

- Users: 部分支持や特殊治具を使う配置はPhase 1では不適合または未確認になる。
- Data: 既存の段積み可否と質量、配置から幾何支持を計算する。積荷別上載荷重はPhase 1スキーマへ追加しない。
- Implementation: 支持矩形の和集合、同一高さ、段積み許可、総質量を独立した純粋関数で判定する。
- Tests: 床置き、完全支持、1 mm欠け、複数支持、異なる高さ、不許可支持、総耐荷重の等値と超過を検証する。

## Compatibility and Migration

アプリと永続データは未実装のため既存データ移行はない。将来、上載荷重や重心等を追加する場合は任意フィールドと新しい判定状態を導入し、既存データは未確認として維持する。

## Rollback

実装前は本ADRと対応仕様を戻せる。実装後に支持率を緩和する場合は、代表ケース、物理的根拠、受入基準を伴う後継ADRで本ADRをSupersededにする。

## Reconsider When

代表ケースで部分支持、パレット、治具、積荷別上載荷重、重心、軸重、床荷重、固縛または動荷重が必須になった場合。
