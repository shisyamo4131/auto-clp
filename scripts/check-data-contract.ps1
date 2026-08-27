[CmdletBinding()]
param(
    [string]$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
$resolvedProject = (Resolve-Path -LiteralPath $ProjectPath).Path
$schemaPath = Join-Path $resolvedProject 'schemas/project-0.1.0.schema.json'
$specificationPath = Join-Path $resolvedProject 'docs/specification.md'
$dataModelPath = Join-Path $resolvedProject 'docs/data-model.md'
$operationsPath = Join-Path $resolvedProject 'docs/operations.md'
$decisionPath = Join-Path $resolvedProject 'docs/decisions/0009-versioned-project-data-contract.md'
$coordinateDecisionPath = Join-Path $resolvedProject 'docs/decisions/0010-container-coordinate-and-placement-anchor.md'
$clearanceDecisionPath = Join-Path $resolvedProject 'docs/decisions/0011-axis-clearance-semantics.md'
$physicalValidationDecisionPath = Join-Path $resolvedProject 'docs/decisions/0012-independent-physical-validation-diagnostics.md'
$persistenceDecisionPath = Join-Path $resolvedProject 'docs/decisions/0013-manual-local-persistence-and-json-files.md'
$floorPenetrationDecisionPath = Join-Path $resolvedProject 'docs/decisions/0014-dedicated-floor-penetration-diagnostic.md'
$optimizationDecisionPath = Join-Path $resolvedProject 'docs/decisions/0004-optimization-objective.md'
$acceptancePath = Join-Path $resolvedProject 'docs/acceptance.md'
$automaticProposalPath = Join-Path $resolvedProject 'src/domain/automatic-proposal.ts'
$automaticProposalTestPath = Join-Path $resolvedProject 'src/domain/automatic-proposal.test.ts'
$automaticProposalProtocolPath = Join-Path $resolvedProject 'src/workers/automatic-proposal-worker-protocol.ts'
$automaticProposalEnginePath = Join-Path $resolvedProject 'src/workers/automatic-proposal-worker-engine.ts'
$automaticProposalWorkerPath = Join-Path $resolvedProject 'src/workers/automatic-proposal.worker.ts'
$automaticProposalClientPath = Join-Path $resolvedProject 'src/ui/automatic-proposal-worker-client.ts'
$automaticProposalSessionPath = Join-Path $resolvedProject 'src/ui/automatic-proposal-session.ts'
$automaticProposalViewPath = Join-Path $resolvedProject 'src/ui/automatic-proposal-view.ts'
$automaticProposalHookPath = Join-Path $resolvedProject 'src/ui/useAutomaticProposalSession.ts'
$automaticProposalPanelPath = Join-Path $resolvedProject 'src/ui/AutomaticProposalPanel.tsx'
$automaticProposalBrowserTestPath = Join-Path $resolvedProject 'tests/browser/automatic-proposal.spec.ts'
$appPath = Join-Path $resolvedProject 'src/App.tsx'

foreach ($path in @(
    $schemaPath,
    $specificationPath,
    $dataModelPath,
    $operationsPath,
    $decisionPath,
    $coordinateDecisionPath,
    $clearanceDecisionPath,
    $physicalValidationDecisionPath,
    $persistenceDecisionPath,
    $floorPenetrationDecisionPath,
    $optimizationDecisionPath,
    $acceptancePath,
    $automaticProposalPath,
    $automaticProposalTestPath,
    $automaticProposalProtocolPath,
    $automaticProposalEnginePath,
    $automaticProposalWorkerPath,
    $automaticProposalClientPath,
    $automaticProposalSessionPath,
    $automaticProposalViewPath,
    $automaticProposalHookPath,
    $automaticProposalPanelPath,
    $automaticProposalBrowserTestPath,
    $appPath
)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Required data-contract file is missing: $path"
    }
}

$schemaText = [IO.File]::ReadAllText($schemaPath)
$schema = $schemaText | ConvertFrom-Json -Depth 100

function Assert-Equal {
    param(
        [object]$Actual,
        [object]$Expected,
        [string]$Label
    )

    if ($Actual -ne $Expected) {
        throw "$Label expected '$Expected' but found '$Actual'."
    }
}

Assert-Equal $schema.'$schema' 'https://json-schema.org/draft/2020-12/schema' 'JSON Schema dialect'
Assert-Equal $schema.properties.schemaVersion.const '0.1.0' 'Project schema version'
Assert-Equal $schema.additionalProperties $false 'Root additionalProperties'
Assert-Equal $schema.properties.cargoes.maxItems 1000 'Cargo limit'
Assert-Equal $schema.properties.containers.maxItems 100 'Container limit'
Assert-Equal $schema.properties.placements.maxItems 1000 'Placement limit'
Assert-Equal $schema.'$defs'.dimensionMm.minimum 1 'Minimum dimension'
Assert-Equal $schema.'$defs'.dimensionMm.maximum 100000 'Maximum dimension'
Assert-Equal $schema.'$defs'.massGrams.maximum 100000000 'Maximum mass'
Assert-Equal $schema.'$defs'.clearanceMm.maximum 10000 'Maximum clearance'
Assert-Equal $schema.'$defs'.coordinateMm.minimum -1000000 'Minimum coordinate'
Assert-Equal $schema.'$defs'.coordinateMm.maximum 1000000 'Maximum coordinate'

$positionDescription = [string]$schema.'$defs'.position.description
foreach ($requiredText in @('Minimum X/Y/Z corner', 'container-local right-handed', '[0,L] x [0,W] x [0,H]', 'x=0', '+X inward', '+Y left', 'z=0', '+Z upward')) {
    if (-not $positionDescription.Contains($requiredText)) {
        throw "Position description does not contain the approved coordinate contract text: $requiredText"
    }
}

$expectedRootFields = @(
    'schemaVersion',
    'projectId',
    'name',
    'clearancesMm',
    'cargoes',
    'containers',
    'placements'
)
$rootFields = @($schema.required)
if (($rootFields.Count -ne $expectedRootFields.Count) -or
    (@(Compare-Object -ReferenceObject $expectedRootFields -DifferenceObject $rootFields).Count -ne 0)) {
    throw "Root required fields do not match: $($rootFields -join ', ')"
}

$expectedOrientations = @('LWH', 'WLH', 'LHW', 'HLW', 'WHL', 'HWL')
$orientations = @($schema.'$defs'.orientation.enum)
if (($orientations.Count -ne $expectedOrientations.Count) -or
    (@(Compare-Object -ReferenceObject $expectedOrientations -DifferenceObject $orientations).Count -ne 0)) {
    throw "Orientation values do not match: $($orientations -join ', ')"
}

$defaultOrientations = @($schema.'$defs'.cargo.properties.allowedOrientations.default)
if (($defaultOrientations.Count -ne 2) -or
    (@(Compare-Object -ReferenceObject @('LWH', 'WLH') -DifferenceObject $defaultOrientations).Count -ne 0)) {
    throw "Default orientations do not match: $($defaultOrientations -join ', ')"
}

$specification = [IO.File]::ReadAllText($specificationPath)
$specificationVersionMatch = [regex]::Match(
    $specification,
    '(?m)^- Specification version:\s*([0-9]+\.[0-9]+\.[0-9]+)\s*$'
)
if (-not $specificationVersionMatch.Success) {
    throw 'Specification does not contain a parseable specification version.'
}

$dataModel = [IO.File]::ReadAllText($dataModelPath)
$operations = [IO.File]::ReadAllText($operationsPath)
$dataModelVersionMatch = [regex]::Match(
    $dataModel,
    '仕様版 `([0-9]+\.[0-9]+\.[0-9]+)`'
)
if (-not $dataModelVersionMatch.Success) {
    throw 'Data model does not contain a parseable specification version.'
}

$specificationVersion = $specificationVersionMatch.Groups[1].Value
$dataModelVersion = $dataModelVersionMatch.Groups[1].Value
Assert-Equal $specificationVersion '0.10.0' 'Approved specification version'
Assert-Equal $dataModelVersion $specificationVersion 'Data model specification version'

foreach ($staleText in @(
    '利用者向けJSON入出力UIと端末保存はまだ存在しない',
    '端末保存と利用者向けJSON入出力UIはまだ公開されていない',
    '将来の端末保存には含めない'
)) {
    if ($dataModel.Contains($staleText) -or
        $specification.Contains($staleText) -or
        $operations.Contains($staleText)) {
        throw "Current documentation still contains a retired persistence statement: $staleText"
    }
}

foreach ($requiredText in @(
    '最大100件まで取り消し・やり直し',
    '同一状態へのno-opを履歴へ追加しない',
    'その時点のやり直し履歴を破棄',
    '未保存のフォーム入力',
    '操作履歴は現在の実行セッションだけに保持'
)) {
    if (-not $specification.Contains($requiredText)) {
        throw "Specification does not contain the approved operation-history contract text: $requiredText"
    }
}

foreach ($requiredText in @(
    '全積荷をちょうど一度ずつ、一つの登録済み候補コンテナへ配置',
    '内部容積、内部床面積、内部長さ、内部幅、内部高さ、候補ID',
    '未探索の次attemptが上限を超える時だけcutoff',
    '目的関数上の最良とは未確認',
    'no-complete-plan',
    '取消、失敗、stale、適用前previewはProject、履歴、保存状態を変更しない',
    'no-cargo',
    'no-candidates'
)) {
    if (-not $specification.Contains($requiredText)) {
        throw "Specification does not contain the approved automatic-proposal contract text: $requiredText"
    }
}

foreach ($requiredText in @(
    'IndexedDBの単一手動枠 `current-project`',
    '自動保存と起動時自動読込を行わない',
    'auto-clp-project-0.1.0.json',
    '全候補の物理判定をmodule Workerで再計算',
    '現在案件、履歴、入力を保持'
)) {
    if (-not $specification.Contains($requiredText)) {
        throw "Specification does not contain the approved persistence contract text: $requiredText"
    }
}

if (-not $dataModel.Contains('Project schema version: `0.1.0`') -or
    -not $dataModel.Contains('../schemas/project-0.1.0.schema.json') -or
    -not $dataModel.Contains('5 MiB（5,242,880 bytes）') -or
    -not $dataModel.Contains('decisions/0010-container-coordinate-and-placement-anchor.md') -or
    -not $dataModel.Contains('decisions/0011-axis-clearance-semantics.md') -or
    -not $dataModel.Contains('decisions/0012-independent-physical-validation-diagnostics.md') -or
    -not $dataModel.Contains('decisions/0013-manual-local-persistence-and-json-files.md') -or
    -not $dataModel.Contains('decisions/0014-dedicated-floor-penetration-diagnostic.md')) {
    throw 'Data model does not identify the approved specification version, schema version, file, and size limit.'
}

$decision = [IO.File]::ReadAllText($decisionPath)
if ($decision -notmatch '(?m)^- Status:\s*Accepted\s*$' -or
    -not $decision.Contains('schemas/project-0.1.0.schema.json')) {
    throw 'ADR 0009 does not accept the approved schema file.'
}

$coordinateDecision = [IO.File]::ReadAllText($coordinateDecisionPath)
if ($coordinateDecision -notmatch '(?m)^- Status:\s*Accepted\s*$' -or
    -not $coordinateDecision.Contains('positionMm') -or
    -not $coordinateDecision.Contains('最小X・Y・Z角')) {
    throw 'ADR 0010 does not accept the approved placement coordinate contract.'
}

$clearanceDecision = [IO.File]::ReadAllText($clearanceDecisionPath)
if ($clearanceDecision -notmatch '(?m)^- Status:\s*Accepted\s*$') {
    throw 'ADR 0011 does not have Accepted status.'
}

foreach ($requiredText in @(
    '隣接する二つの表面間に必要な実距離',
    '積荷間で2倍にしない',
    'xMin >= cX',
    'xMax <= L - cX',
    'yMin >= cY',
    'yMax <= W - cY',
    'zMin >= 0',
    'zMax <= H - cZ',
    '少なくとも一つの分離軸',
    '支持上面との完全一致接触はZ隙間を要求しない',
    'cargoY + 2 × cY <= openingWidth',
    'cargoZ + cZ <= openingHeight'
)) {
    if (-not $clearanceDecision.Contains($requiredText)) {
        throw "ADR 0011 does not contain the approved clearance contract text: $requiredText"
    }
}

$physicalValidationDecision = [IO.File]::ReadAllText($physicalValidationDecisionPath)
if ($physicalValidationDecision -notmatch '(?m)^- Status:\s*Accepted\s*$') {
    throw 'ADR 0012 does not have Accepted status.'
}

$persistenceDecision = [IO.File]::ReadAllText($persistenceDecisionPath)
if ($persistenceDecision -notmatch '(?m)^- Status:\s*Accepted\s*$') {
    throw 'ADR 0013 does not have Accepted status.'
}

$floorPenetrationDecision = [IO.File]::ReadAllText($floorPenetrationDecisionPath)
if ($floorPenetrationDecision -notmatch '(?m)^- Status:\s*Accepted\s*$') {
    throw 'ADR 0014 does not have Accepted status.'
}

$optimizationDecision = [IO.File]::ReadAllText($optimizationDecisionPath)
if ($optimizationDecision -notmatch '(?m)^- Status:\s*Accepted\s*$') {
    throw 'ADR 0004 does not have Accepted status.'
}

foreach ($requiredText in @(
    '全積荷定義をちょうど一度ずつ、一つの登録済み候補コンテナへ配置',
    '内部容積、内部床面積、内部長さ、内部幅、内部高さ、候補ID',
    '最大2,048点',
    '最大10,000 placement attempt',
    '一要求最大1,000,000 attempt',
    'depth-first backtracking',
    'X={cX, L-cX-dx, 各配置maxX+cX}',
    '三重loopで直積を遅延列挙',
    '10億点規模の中間配列を生成・sortしない',
    '未探索の次attemptが存在して10,001回目または1,000,001回目を許可できない時だけcutoff',
    'complete-with-cutoff',
    '目的関数上の最良とは確認できません',
    'cutoff',
    'no-complete-plan',
    'no-cargo',
    'no-candidates',
    'Schema `0.1.0`',
    '移行不要'
)) {
    if (-not $optimizationDecision.Contains($requiredText)) {
        throw "ADR 0004 does not contain the approved automatic-proposal contract text: $requiredText"
    }
}

foreach ($requiredText in @(
    'floor-penetration',
    '最小Zが0 mm未満',
    'outside-container',
    '総耐荷重',
    '移行不要'
)) {
    if (-not $floorPenetrationDecision.Contains($requiredText)) {
        throw "ADR 0014 does not contain the approved floor-penetration contract text: $requiredText"
    }
}

$acceptance = [IO.File]::ReadAllText($acceptancePath)
foreach ($requiredText in @(
    'AC-01 Floor Layout and Manual Editing',
    'AC-02 Exact Stack and 1 mm Support Failure',
    'AC-03 Independent Floor Penetration Diagnostics',
    'AC-04 Recovery, Portability, and No-WebGL Fallback',
    'AP-01 Candidate objective',
    'small=200×100×100',
    '10,000回目で自然終了',
    'complete-with-cutoff',
    'no-complete-plan',
    'no-cargo',
    'no-candidates',
    'cold 1回とwarm 3回',
    '1,000配置相当',
    '直積全体を中間配列へ展開しない',
    'AP-08 Worker and performance',
    '実務利用者試用'
)) {
    if (-not $acceptance.Contains($requiredText)) {
        throw "Acceptance contract does not contain the approved case text: $requiredText"
    }
}


foreach ($requiredText in @(
    '自動提案の純粋domain探索、Worker transport、session/view、利用者向けReact panel',
    'Appでのbusy・generation配線、実Workerの開始・取消・retry、非永続preview DOMは実装済み',
    '適用は未実装',
    'preview、取消、cutoff、完全案なし、失敗、stale、積荷なし、候補なしでは現在案件と履歴を保持',
    '目的関数上の最良として案内してはならない'
)) {
    if (-not $operations.Contains($requiredText)) {
        throw "Operations does not contain the approved automatic-proposal boundary text: $requiredText"
    }
}

$automaticProposalHook = [IO.File]::ReadAllText($automaticProposalHookPath)
$automaticProposalPanel = [IO.File]::ReadAllText($automaticProposalPanelPath)
$automaticProposalBrowserTest = [IO.File]::ReadAllText($automaticProposalBrowserTestPath)
$app = [IO.File]::ReadAllText($appPath)
foreach ($contract in @(
    @{ Name = 'React hook'; Text = $automaticProposalHook; Required = @('useSyncExternalStore', 'visibleSnapshot', 'interactionGeneration') },
    @{ Name = 'React panel'; Text = $automaticProposalPanel; Required = @('aria-live="polite"', '探索を中止', '提案配置（未適用）') },
    @{ Name = 'App integration'; Text = $app; Required = @('readAutomaticProposalContext', '<AutomaticProposalPanel', 'persistenceOperationRef.current') },
    @{ Name = 'Browser integration'; Text = $automaticProposalBrowserTest; Required = @('__cancelProposalFromBrowser', '__proposalTerminatedCount', 'forceWebgl2=unsupported') }
)) {
    foreach ($requiredText in $contract.Required) {
        if (-not $contract.Text.Contains($requiredText)) {
            throw "$($contract.Name) does not contain the required automatic-proposal integration marker: $requiredText"
        }
    }
}

foreach ($requiredText in @(
    'current-project',
    '自動保存と起動時自動読込は行わない',
    'transaction完了後だけ成功',
    'auto-clp-project-0.1.0.json',
    'one-shot module Worker',
    '履歴barrier'
)) {
    if (-not $persistenceDecision.Contains($requiredText)) {
        throw "ADR 0013 does not contain the approved persistence contract text: $requiredText"
    }
}

foreach ($requiredText in @(
    '境界不適合を取り消さず',
    '支持不足または隙間不足を連鎖させない',
    '開口寸法と総耐荷重は配置座標境界から独立して評価',
    '不適合時も独立して得た未確認理由を削除しない',
    '判定結果は派生状態'
)) {
    if (-not $physicalValidationDecision.Contains($requiredText)) {
        throw "ADR 0012 does not contain the approved physical validation contract text: $requiredText"
    }
}

[pscustomobject]@{
    project_path = $resolvedProject
    schema_path = $schemaPath
    schema_parsed = $true
    schema_dialect = $schema.'$schema'
    project_schema_version = $schema.properties.schemaVersion.const
    specification_version = $specificationVersion
    root_required_fields = $rootFields.Count
    orientation_count = $orientations.Count
    cargo_limit = $schema.properties.cargoes.maxItems
    container_limit = $schema.properties.containers.maxItems
    placement_limit = $schema.properties.placements.maxItems
    documentation_current = $true
    decision_0009_accepted = $true
    coordinate_decision_0010_accepted = $true
    clearance_decision_0011_accepted = $true
    physical_validation_decision_0012_accepted = $true
    persistence_decision_0013_accepted = $true
    floor_penetration_decision_0014_accepted = $true
    optimization_decision_0004_accepted = $true
    synthetic_acceptance_contract_current = $true
    automatic_proposal_domain_implemented = $true
    automatic_proposal_worker_transport_implemented = $true
    automatic_proposal_session_view_implemented = $true
    automatic_proposal_react_preview_implemented = $true
    automatic_proposal_browser_integration_tested = $true
}
