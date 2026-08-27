# AP-08 Automatic Proposal Worker and Performance Evidence

- Status: Verified technical evidence
- Checkpoint: `CP-AUTO-PROPOSAL-AP08-TEST-001`
- Product baseline commit: `1226b082a7bd20bc1e7fcf07af7f793f64163148`
- Recorded: 2026-08-28
- Schema version: `0.1.0`
- Algorithm version: `automatic-proposal-v1`
- Data classification: 匿名の合成データのみ
- Related acceptance: [AP-08 Worker and performance](../acceptance.md#automatic-proposal-synthetic-cases)
- Related roadmap: [Auto CLP roadmap](../roadmaps/auto-clp.md)

## Result

記録環境で、実production module Workerを使ったcold 1回とwarm 3回はすべて5秒以内に完了した。4回とも、候補・要求attemptは各210、配置20件、不適合0件、搬入経路未確認20件、cutoffなしで、決定的な結果hashが一致した。

| Run | Elapsed | Main timer | rAF | Result hash |
| --- | ---: | ---: | ---: | --- |
| cold-1 | 59.7 ms | 17 | 3 | `714e9806c35e5965de7a38850e86e950f5b94b4f9dc22aa72db203cb09f5f341` |
| warm-1 | 48.7 ms | 15 | 3 | 同上 |
| warm-2 | 49.2 ms | 15 | 3 | 同上 |
| warm-3 | 50.9 ms | 16 | 3 | 同上 |

別のfresh UI pageで、実Workerを置換・遅延しないpass-through監視を使い、最初の実running状態で取消した。`terminate()` は1回、要求からの記録遅延は0 ms、取消UIは0.5 ms、応答・遅延ready・遅延応答は0、最終phaseは `cancelled`、`aria-busy=false` だった。console warning/errorは0件だった。

修正後テストの独立再実行でも、cold 56.5 ms、warm 48.6 / 48.3 / 47.2 ms、同じ210 attempts・結果hash、Worker終了0 ms、取消UI 0.4 ms、console 0件で合格した。この再実行は最良値を選ぶための再試行ではなく、永続テストから可変commit SHAを合否条件から除いた後の回帰確認である。

## Fixture

- Project ID: `ap08`
- Clearance: X/Y/Zすべて0 mm
- Cargo: 20個、各 `200 × 200 × 200 mm`、1,000 g、`LWH`のみ、段積み支持不可
- Container: `1,000 × 800 × 1,000 mm`
- Opening: `800 × 1,000 mm`
- Payload capacity: 20,000 g
- Initial placements: 0

## Recorded Environment

- Node.js: `v22.23.2`
- Playwright: `1.62.1`
- Browser: Chromium `151.0.7922.34`, headless
- OS: Windows `10.0.26200`, x64
- CPU: AMD Ryzen 9 9950X3D 16-Core Processor
- Logical processors: 32
- RAM: 66,155,479,040 bytes
- Browser hardware concurrency / device memory: 32 / 32 GiB
- Viewport / device pixel ratio: 1280×720 / 1
- WebGL: native WebGL 2 available、アプリ経路は `unsupported` を強制
- Battery API: available、charging=true、level=1

## Verification Commands

| Command | Result | Exit |
| --- | --- | ---: |
| `node scripts/run-browser-tests.mjs automatic-proposal-performance.spec.ts` | 1/1 passed。下記JSONを出力 | 0 |
| 同commandのstability-only repeat | 1/1 passed。cold 58.6 ms、warm 49.1 / 50.3 / 49.5 ms、同一hash/attempt | 0 |
| `npm run test:browser` | 63/63 passed。AP-08はcold 56.1 ms、warm 49.8 / 48.5 / 48.6 ms、同一hash/attempt | 0 |
| `npm run test:unit` | 26 files / 839 tests passed | 0 |
| `npm run typecheck` | passed | 0 |
| `npm run lint` | passed | 0 |
| `git diff --check -- tests/browser/automatic-proposal-performance.spec.ts` | passed | 0 |

最初の成功前に、runnerの一時cwdをGit repositoryと仮定したテストハーネス不具合と、可変`requestId`をhash対象へ含めたテスト不具合が各1回検出された。どちらも製品不具合ではなく、repository rootを`import.meta.url`から解決し、決定的なresult/planだけをhashするよう修正した。独立レビューでさらに固定baseline SHAを将来の合否条件へ含めない修正を要求し、動的SHA記録と40桁hex形式検証だけを残した。性能閾値、fixture、attempt数、結果hash、取消条件は緩和していない。

## Complete First-success Record

```json
{"checkpoint":"CP-AUTO-PROPOSAL-AP08-TEST-001","commitSha":"1226b082a7bd20bc1e7fcf07af7f793f64163148","schemaVersion":"0.1.0","algorithmVersion":"automatic-proposal-v1","environment":{"nodeVersion":"v22.23.2","playwrightVersion":"1.62.1","browserName":"chromium","browserVersion":"151.0.7922.34","userAgent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.7922.34 Safari/537.36","headless":true,"os":{"platform":"win32","release":"10.0.26200","arch":"x64"},"cpu":"AMD Ryzen 9 9950X3D 16-Core Processor          ","logicalProcessors":32,"totalMemoryBytes":66155479040,"browserHardwareConcurrency":32,"browserDeviceMemoryGiB":32,"viewport":{"width":1280,"height":720},"devicePixelRatio":1,"webgl":{"forced":"unsupported","nativeWebgl2":true},"power":{"available":true,"charging":true,"level":1}},"fixture":{"projectId":"ap08","cargoCount":20,"containerCount":1,"placementCount":0,"cargoDimensionsMm":{"lengthMm":200,"widthMm":200,"heightMm":200},"cargoMassGrams":1000,"orientation":"LWH","canSupportCargo":false,"containerId":"container-ap08","internalDimensionsMm":{"lengthMm":1000,"widthMm":800,"heightMm":1000},"openingMm":{"widthMm":800,"heightMm":1000},"payloadCapacityGrams":20000,"clearancesMm":{"xMm":0,"yMm":0,"zMm":0}},"observabilityBasis":{"timerBasisMs":0.19999999552965164,"rafBasisMs":12.399999998509884,"thresholdMs":12.399999998509884},"runs":[{"label":"cold-1","iteration":1,"timeOriginMs":1787868311897.4,"startedAtMs":402.6000000014901,"endedAtMs":462.30000000447035,"elapsedMs":59.70000000298023,"timerCount":17,"rafCount":3,"timerMaxGapMs":6,"rafMaxGapMs":16.69999999999999,"observability":"observable","observabilityThresholdMs":12.399999998509884,"resultHashSha256":"714e9806c35e5965de7a38850e86e950f5b94b4f9dc22aa72db203cb09f5f341","result":{"status":"complete","algorithmVersion":"automatic-proposal-v1","selectedContainerId":"container-ap08","candidateAttemptCount":210,"requestAttemptCount":210,"placementCount":20,"invalidReasonCount":0,"unverifiedCount":20,"cutoffSource":null}},{"label":"warm-1","iteration":2,"timeOriginMs":1787868311897.4,"startedAtMs":462.70000000298023,"endedAtMs":511.3999999985099,"elapsedMs":48.69999999552965,"timerCount":15,"rafCount":3,"timerMaxGapMs":6,"rafMaxGapMs":16.69999999999999,"observability":"observable","observabilityThresholdMs":12.399999998509884,"resultHashSha256":"714e9806c35e5965de7a38850e86e950f5b94b4f9dc22aa72db203cb09f5f341","result":{"status":"complete","algorithmVersion":"automatic-proposal-v1","selectedContainerId":"container-ap08","candidateAttemptCount":210,"requestAttemptCount":210,"placementCount":20,"invalidReasonCount":0,"unverifiedCount":20,"cutoffSource":null}},{"label":"warm-2","iteration":3,"timeOriginMs":1787868311897.4,"startedAtMs":511.6000000014901,"endedAtMs":560.8000000044703,"elapsedMs":49.20000000298023,"timerCount":15,"rafCount":3,"timerMaxGapMs":6.100000001490116,"rafMaxGapMs":16.699999999999932,"observability":"observable","observabilityThresholdMs":12.399999998509884,"resultHashSha256":"714e9806c35e5965de7a38850e86e950f5b94b4f9dc22aa72db203cb09f5f341","result":{"status":"complete","algorithmVersion":"automatic-proposal-v1","selectedContainerId":"container-ap08","candidateAttemptCount":210,"requestAttemptCount":210,"placementCount":20,"invalidReasonCount":0,"unverifiedCount":20,"cutoffSource":null}},{"label":"warm-3","iteration":4,"timeOriginMs":1787868311897.4,"startedAtMs":560.8999999985099,"endedAtMs":611.8000000044703,"elapsedMs":50.900000005960464,"timerCount":16,"rafCount":3,"timerMaxGapMs":5,"rafMaxGapMs":16.699999999999932,"observability":"observable","observabilityThresholdMs":12.399999998509884,"resultHashSha256":"714e9806c35e5965de7a38850e86e950f5b94b4f9dc22aa72db203cb09f5f341","result":{"status":"complete","algorithmVersion":"automatic-proposal-v1","selectedContainerId":"container-ap08","candidateAttemptCount":210,"requestAttemptCount":210,"placementCount":20,"invalidReasonCount":0,"unverifiedCount":20,"cutoffSource":null}}],"cancellation":{"workerConstructCount":1,"postMessageCount":1,"responseSeenCount":0,"responseSeenBeforeCancel":false,"responseSeenAfterCancel":0,"terminateCount":1,"lateReady":false,"lateResponse":false,"cancelRequestedAtMs":499.30000000447035,"terminatedAtMs":499.30000000447035,"terminateLatencyMs":0,"cancelledObservedAtMs":499.80000000447035,"cancelledUiLatencyMs":0.5,"phase":"cancelled","ariaBusy":"false"},"console":{"warningOrErrorCount":0,"direct":[],"ui":[]},"pass":true,"notes":["5秒/250msはこの記録環境の受入gateであり一般端末SLAではない。","browser battery API available","maximum timer/rAF gaps are observations, not SLA thresholds"]}
```

## Limits

- 5秒と250 msは、この記録環境の初期受入gateであり一般端末SLAではない。
- Battery API値以上に外部電源を独立確認していない。
- native WebGL 2能力はtrueだったが、測定したアプリ経路はWebGL非対応fallbackでありGPU性能を示さない。
- timer/rAFの最大間隔は観測値で、SLA閾値ではない。
- 技術証拠は開発チーム内試用、実務利用者受入、実積載の安全性を証明しない。
