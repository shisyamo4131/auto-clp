# AP-08 Automatic Proposal v2 Worker and Performance Evidence

- Status: Verified technical evidence
- Checkpoint: `CP-AUTO-PROPOSAL-AP08-TEST-001`
- Product baseline commit: `733b250b188245e510183dca8e4930f0f8eafa87`
- Recorded: 2026-08-31
- Schema version: `0.1.0`
- Algorithm version: `automatic-proposal-v2`
- Data classification: 匿名の合成データのみ
- Related acceptance: [AP-08 Worker and performance](../acceptance.md#automatic-proposal-synthetic-cases)
- Related roadmap: [Auto CLP roadmap](../roadmaps/auto-clp.md)

## Result

実装commit上の全browser回帰 `81/81` の一部として、production module Workerのcold 1回とwarm 3回はすべて5秒以内に完了した。4回とも候補・要求attemptは各210、配置20件、不適合0件、未確認0件、cutoffなしで、結果hash `386d66e1cd8da39a51d1699a1305a5ca1bcf972c74fd7b8abb0ffe16084f4f39` が一致した。

| Run | Elapsed | Main timer | rAF | Result hash |
| --- | ---: | ---: | ---: | --- |
| cold-1 | 57.8 ms | 17 | 3 | `386d66e1cd8da39a51d1699a1305a5ca1bcf972c74fd7b8abb0ffe16084f4f39` |
| warm-1 | 46.7 ms | 15 | 3 | 同上 |
| warm-2 | 46.6 ms | 15 | 3 | 同上 |
| warm-3 | 47.5 ms | 15 | 2 | 同上 |

別のfresh UI pageで、実running状態のWorkerを取消した。`terminate()` は1回、要求から終了まで0.2 ms、取消UI観測まで0.7 ms、応答・遅延ready・遅延応答は0、最終phaseは `cancelled`、`aria-busy=false` だった。console warning/errorは0件だった。

単独AP-08診断を2回行った際は、Worker開始前のPlaywright failure-trace JPEG snapshot境界でWindows Chromiumが `GPU stall due to ReadPixels` をdirect 1件・UI 3件出し、console 0 gateを満たさず各exit 1だった。警告はfilterせず、production/AP-08に `readPixels` またはscreenshot呼出がないことと、成功した全browser回帰では同じAP-08がconsole 0だったことを確認した。単独2回は成功証拠として扱わない。

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
- WebGL: forced `none`, native WebGL 2 available
- Battery API: available、charging=true、level=1

## Verification Commands

| Command | Result | Exit |
| --- | --- | ---: |
| `corepack pnpm run test:browser` | 81/81 passed。AP-08は下記JSONを出力 | 0 |
| `corepack pnpm run test:unit` | 28 files / 952 tests passed | 0 |
| `corepack pnpm run typecheck` | passed | 0 |
| `corepack pnpm run lint` | passed | 0 |
| `corepack pnpm run build` | passed。既存のlarge-chunk advisoryのみ | 0 |
| `git diff --check` | passed | 0 |

## Complete Successful Record

```json
{"checkpoint":"CP-AUTO-PROPOSAL-AP08-TEST-001","commitSha":"733b250b188245e510183dca8e4930f0f8eafa87","schemaVersion":"0.1.0","algorithmVersion":"automatic-proposal-v2","environment":{"nodeVersion":"v22.23.2","playwrightVersion":"1.62.1","browserName":"chromium","browserVersion":"151.0.7922.34","userAgent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.7922.34 Safari/537.36","headless":true,"os":{"platform":"win32","release":"10.0.26200","arch":"x64"},"cpu":"AMD Ryzen 9 9950X3D 16-Core Processor          ","logicalProcessors":32,"totalMemoryBytes":66155479040,"browserHardwareConcurrency":32,"browserDeviceMemoryGiB":32,"viewport":{"width":1280,"height":720},"devicePixelRatio":1,"webgl":{"forced":"none","nativeWebgl2":true},"power":{"available":true,"charging":true,"level":1}},"fixture":{"projectId":"ap08","cargoCount":20,"containerCount":1,"placementCount":0,"cargoDimensionsMm":{"lengthMm":200,"widthMm":200,"heightMm":200},"cargoMassGrams":1000,"orientation":"LWH","canSupportCargo":false,"containerId":"container-ap08","internalDimensionsMm":{"lengthMm":1000,"widthMm":800,"heightMm":1000},"openingMm":{"widthMm":800,"heightMm":1000},"payloadCapacityGrams":20000,"clearancesMm":{"xMm":0,"yMm":0,"zMm":0}},"observabilityBasis":{"timerBasisMs":0.09999999776482582,"rafBasisMs":6,"thresholdMs":6},"runs":[{"label":"cold-1","iteration":1,"timeOriginMs":1788155921932.6,"startedAtMs":444.3999999985099,"endedAtMs":502.19999999925494,"elapsedMs":57.80000000074506,"timerCount":17,"rafCount":3,"timerMaxGapMs":6,"rafMaxGapMs":16.80000000000001,"observability":"observable","observabilityThresholdMs":6,"resultHashSha256":"386d66e1cd8da39a51d1699a1305a5ca1bcf972c74fd7b8abb0ffe16084f4f39","result":{"status":"complete","algorithmVersion":"automatic-proposal-v2","selectedContainerId":"container-ap08","candidateAttemptCount":210,"requestAttemptCount":210,"placementCount":20,"invalidReasonCount":0,"unverifiedCount":0,"cutoffSource":null}},{"label":"warm-1","iteration":2,"timeOriginMs":1788155921932.6,"startedAtMs":502.5,"endedAtMs":549.1999999992549,"elapsedMs":46.69999999925494,"timerCount":15,"rafCount":3,"timerMaxGapMs":6.100000001490116,"rafMaxGapMs":16.700000000000045,"observability":"observable","observabilityThresholdMs":6,"resultHashSha256":"386d66e1cd8da39a51d1699a1305a5ca1bcf972c74fd7b8abb0ffe16084f4f39","result":{"status":"complete","algorithmVersion":"automatic-proposal-v2","selectedContainerId":"container-ap08","candidateAttemptCount":210,"requestAttemptCount":210,"placementCount":20,"invalidReasonCount":0,"unverifiedCount":0,"cutoffSource":null}},{"label":"warm-2","iteration":3,"timeOriginMs":1788155921932.6,"startedAtMs":549.2999999970198,"endedAtMs":595.8999999985099,"elapsedMs":46.600000001490116,"timerCount":15,"rafCount":3,"timerMaxGapMs":6.100000001490116,"rafMaxGapMs":16.700000000000045,"observability":"observable","observabilityThresholdMs":6,"resultHashSha256":"386d66e1cd8da39a51d1699a1305a5ca1bcf972c74fd7b8abb0ffe16084f4f39","result":{"status":"complete","algorithmVersion":"automatic-proposal-v2","selectedContainerId":"container-ap08","candidateAttemptCount":210,"requestAttemptCount":210,"placementCount":20,"invalidReasonCount":0,"unverifiedCount":0,"cutoffSource":null}},{"label":"warm-3","iteration":4,"timeOriginMs":1788155921932.6,"startedAtMs":595.8999999985099,"endedAtMs":643.3999999985099,"elapsedMs":47.5,"timerCount":15,"rafCount":2,"timerMaxGapMs":6,"rafMaxGapMs":16.700000000000045,"observability":"observable","observabilityThresholdMs":6,"resultHashSha256":"386d66e1cd8da39a51d1699a1305a5ca1bcf972c74fd7b8abb0ffe16084f4f39","result":{"status":"complete","algorithmVersion":"automatic-proposal-v2","selectedContainerId":"container-ap08","candidateAttemptCount":210,"requestAttemptCount":210,"placementCount":20,"invalidReasonCount":0,"unverifiedCount":0,"cutoffSource":null}}],"cancellation":{"workerConstructCount":1,"postMessageCount":1,"responseSeenCount":0,"responseSeenBeforeCancel":false,"responseSeenAfterCancel":0,"terminateCount":1,"lateReady":false,"lateResponse":false,"cancelRequestedAtMs":668.6000000014901,"terminatedAtMs":668.8000000007451,"terminateLatencyMs":0.19999999925494194,"cancelledObservedAtMs":669.3000000007451,"cancelledUiLatencyMs":0.6999999992549419,"phase":"cancelled","ariaBusy":"false"},"console":{"warningOrErrorCount":0,"direct":[],"ui":[]},"pass":true,"notes":["5秒/250msはこの記録環境の受入gateであり一般端末SLAではない。","browser battery API available","maximum timer/rAF gaps are observations, not SLA thresholds"]}
```

## Limits

- 5秒と250 msは、この記録環境の初期受入gateであり一般端末SLAではない。
- Battery API値以上に外部電源を独立確認していない。
- native WebGL 2能力はtrueで、WebGL必須の通常アプリ経路上で測定したがGPU性能の一般保証ではない。
- timer/rAFの最大間隔は観測値で、SLA閾値ではない。
- 技術証拠はheaded実行、他のGPU・端末、開発チーム内試用、実務利用者受入、実積載の安全性を証明しない。
