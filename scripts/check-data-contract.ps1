[CmdletBinding()]
param(
    [string]$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
$resolvedProject = (Resolve-Path -LiteralPath $ProjectPath).Path
$schemaPath = Join-Path $resolvedProject 'schemas/project-0.1.0.schema.json'
$readmePath = Join-Path $resolvedProject 'README.md'
$specificationPath = Join-Path $resolvedProject 'docs/specification.md'
$dataModelPath = Join-Path $resolvedProject 'docs/data-model.md'
$operationsPath = Join-Path $resolvedProject 'docs/operations.md'
$decisionPath = Join-Path $resolvedProject 'docs/decisions/0009-versioned-project-data-contract.md'
$coordinateDecisionPath = Join-Path $resolvedProject 'docs/decisions/0010-container-coordinate-and-placement-anchor.md'
$clearanceDecisionPath = Join-Path $resolvedProject 'docs/decisions/0011-axis-clearance-semantics.md'
$physicalValidationDecisionPath = Join-Path $resolvedProject 'docs/decisions/0012-independent-physical-validation-diagnostics.md'
$persistenceDecisionPath = Join-Path $resolvedProject 'docs/decisions/0013-manual-local-persistence-and-json-files.md'
$floorPenetrationDecisionPath = Join-Path $resolvedProject 'docs/decisions/0014-dedicated-floor-penetration-diagnostic.md'
$sceneFeedbackDecisionPath = Join-Path $resolvedProject 'docs/decisions/0015-scene-wheel-drag-out-and-size-copy.md'
$sceneWorkbenchDecisionPath = Join-Path $resolvedProject 'docs/decisions/0017-scene-workbench-rotation-and-compact-controls.md'
$sceneCompactDecisionPath = Join-Path $resolvedProject 'docs/decisions/0018-scene-drag-classification-and-dialog-editors.md'
$supportSnapDecisionPath = Join-Path $resolvedProject 'docs/decisions/0019-support-surface-snap-and-conditional-support.md'
$actionableOpeningDecisionPath = Join-Path $resolvedProject 'docs/decisions/0020-actionable-opening-diagnostics-and-drag-focus.md'
$fixedRotationDecisionPath = Join-Path $resolvedProject 'docs/decisions/0021-fixed-rotation-toolbar-and-axis-icons.md'
$orientationPolicyDecisionPath = Join-Path $resolvedProject 'docs/decisions/0022-upright-only-orientation-policy.md'
$webglRequiredDecisionPath = Join-Path $resolvedProject 'docs/decisions/0023-webgl-required-operation-and-read-only-rescue.md'
$clpTerminologyDecisionPath = Join-Path $resolvedProject 'docs/decisions/0024-user-facing-clp-terminology.md'
$viewerFirstShellDecisionPath = Join-Path $resolvedProject 'docs/decisions/0025-viewer-first-application-shell.md'
$tabbedSceneDecisionPath = Join-Path $resolvedProject 'docs/decisions/0026-tabbed-scene-annotations-and-validation-dialog.md'
$drawerDeferralDecisionPath = Join-Path $resolvedProject 'docs/decisions/0029-phase1-drawer-entry-and-automatic-proposal-deferral.md'
$optimizationDecisionPath = Join-Path $resolvedProject 'docs/decisions/0004-optimization-objective.md'
$acceptancePath = Join-Path $resolvedProject 'docs/acceptance.md'
$automaticProposalPath = Join-Path $resolvedProject 'src/domain/automatic-proposal.ts'
$automaticProposalTestPath = Join-Path $resolvedProject 'src/domain/automatic-proposal.test.ts'
$automaticProposalApplyPath = Join-Path $resolvedProject 'src/application/automatic-proposal-apply.ts'
$automaticProposalApplyTestPath = Join-Path $resolvedProject 'src/application/automatic-proposal-apply.test.ts'
$automaticProposalProtocolPath = Join-Path $resolvedProject 'src/workers/automatic-proposal-worker-protocol.ts'
$automaticProposalEnginePath = Join-Path $resolvedProject 'src/workers/automatic-proposal-worker-engine.ts'
$automaticProposalWorkerPath = Join-Path $resolvedProject 'src/workers/automatic-proposal.worker.ts'
$automaticProposalClientPath = Join-Path $resolvedProject 'src/ui/automatic-proposal-worker-client.ts'
$automaticProposalSessionPath = Join-Path $resolvedProject 'src/ui/automatic-proposal-session.ts'
$automaticProposalViewPath = Join-Path $resolvedProject 'src/ui/automatic-proposal-view.ts'
$automaticProposalHookPath = Join-Path $resolvedProject 'src/ui/useAutomaticProposalSession.ts'
$automaticProposalPanelPath = Join-Path $resolvedProject 'src/ui/AutomaticProposalPanel.tsx'
$automaticProposalBrowserTestPath = Join-Path $resolvedProject 'tests/browser/automatic-proposal.future.ts'
$automaticProposalPerformanceTestPath = Join-Path $resolvedProject 'tests/browser/automatic-proposal-performance.future.ts'
$automaticProposalEvidenceIndexPath = Join-Path $resolvedProject 'docs/evidence/README.md'
$automaticProposalEvidencePath = Join-Path $resolvedProject 'docs/evidence/automatic-proposal-ap08-733b250.md'
$appPath = Join-Path $resolvedProject 'src/App.tsx'
$geometryPath = Join-Path $resolvedProject 'src/domain/geometry.ts'
$placementValidationPath = Join-Path $resolvedProject 'src/domain/validation.ts'
$sceneWorkspacePath = Join-Path $resolvedProject 'src/scene/SceneWorkspace.tsx'
$projectScenePath = Join-Path $resolvedProject 'src/scene/project-scene.ts'
$projectSceneTestPath = Join-Path $resolvedProject 'src/scene/project-scene.test.ts'
$threeViewportPath = Join-Path $resolvedProject 'src/scene/ThreeViewport.tsx'
$sceneBrowserTestPath = Join-Path $resolvedProject 'tests/browser/scene.spec.ts'
$stylesPath = Join-Path $resolvedProject 'src/styles.css'
$orientationPolicyPath = Join-Path $resolvedProject 'src/domain/orientation-policy.ts'
$cargoEditorPath = Join-Path $resolvedProject 'src/ui/CargoEditorDialog.tsx'
$projectWorkspacePath = Join-Path $resolvedProject 'src/ui/ProjectWorkspace.tsx'
$projectHistoryControlsPath = Join-Path $resolvedProject 'src/ui/ProjectHistoryControls.tsx'
$projectPersistencePanelPath = Join-Path $resolvedProject 'src/ui/ProjectPersistencePanel.tsx'
$projectPersistencePath = Join-Path $resolvedProject 'src/application/project-persistence.ts'

foreach ($path in @(
    $schemaPath,
    $readmePath,
    $specificationPath,
    $dataModelPath,
    $operationsPath,
    $decisionPath,
    $coordinateDecisionPath,
    $clearanceDecisionPath,
    $physicalValidationDecisionPath,
    $persistenceDecisionPath,
    $floorPenetrationDecisionPath,
    $sceneFeedbackDecisionPath,
    $sceneWorkbenchDecisionPath,
    $sceneCompactDecisionPath,
    $supportSnapDecisionPath,
    $actionableOpeningDecisionPath,
    $fixedRotationDecisionPath,
    $orientationPolicyDecisionPath,
    $webglRequiredDecisionPath,
    $clpTerminologyDecisionPath,
    $viewerFirstShellDecisionPath,
    $tabbedSceneDecisionPath,
    $drawerDeferralDecisionPath,
    $optimizationDecisionPath,
    $acceptancePath,
    $automaticProposalPath,
    $automaticProposalTestPath,
    $automaticProposalApplyPath,
    $automaticProposalApplyTestPath,
    $automaticProposalProtocolPath,
    $automaticProposalEnginePath,
    $automaticProposalWorkerPath,
    $automaticProposalClientPath,
    $automaticProposalSessionPath,
    $automaticProposalViewPath,
    $automaticProposalHookPath,
    $automaticProposalPanelPath,
    $automaticProposalBrowserTestPath,
    $automaticProposalPerformanceTestPath,
    $automaticProposalEvidenceIndexPath,
    $automaticProposalEvidencePath,
    $appPath,
    $geometryPath,
    $placementValidationPath,
    $sceneWorkspacePath,
    $projectScenePath,
    $projectSceneTestPath,
    $threeViewportPath,
    $sceneBrowserTestPath,
    $stylesPath,
    $orientationPolicyPath,
    $cargoEditorPath,
    $projectWorkspacePath,
    $projectHistoryControlsPath,
    $projectPersistencePanelPath,
    $projectPersistencePath
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
$readme = [IO.File]::ReadAllText($readmePath)
$specificationVersionMatch = [regex]::Match(
    $specification,
    '(?m)^- Specification version:\s*([0-9]+\.[0-9]+\.[0-9]+)\s*$'
)
if (-not $specificationVersionMatch.Success) {
    throw 'Specification does not contain a parseable specification version.'
}

foreach ($requiredText in @(
    'Phase 1の通常画面では自動配置提案を提供しません',
    '将来再開用の技術資産',
    '一般端末SLA、実務受入または安全保証ではありません'
)) {
    if (-not $readme.Contains($requiredText)) {
        throw "Root README does not contain the current automatic-proposal deferral marker: $requiredText"
    }
}
$productionSourceFiles = Get-ChildItem -LiteralPath (Join-Path $resolvedProject 'src') -Recurse -File |
    Where-Object { $_.Extension -in @('.ts', '.tsx') -and $_.Name -notmatch '\.test\.' }
foreach ($sourceFile in $productionSourceFiles) {
    $sourceText = [IO.File]::ReadAllText($sourceFile.FullName)
    if ($sourceText.Contains('案件')) {
        throw "Production source still contains the retired user-facing term: $($sourceFile.FullName)"
    }
}
$projectWorkspace = [IO.File]::ReadAllText($projectWorkspacePath)
$projectHistoryControls = [IO.File]::ReadAllText($projectHistoryControlsPath)
$projectPersistencePanel = [IO.File]::ReadAllText($projectPersistencePanelPath)
$sceneWorkspace = [IO.File]::ReadAllText($sceneWorkspacePath)
$automaticProposalPanel = [IO.File]::ReadAllText($automaticProposalPanelPath)
foreach ($contract in @(
    @{ Name = 'CLP settings'; Text = $projectWorkspace; Required = @('CLP INPUT', 'CLP設定', 'CLP名', 'CLPを保存') },
    @{ Name = 'CLP history'; Text = $projectHistoryControls; Required = @('CLP-WIDE HISTORY', 'CLP全体の操作') },
    @{ Name = 'CLP persistence'; Text = $projectPersistencePanel; Required = @('CLPメニュー', '新規CLP', 'CLP設定', '積荷を追加', '候補を追加', 'project-persistence__backdrop') },
    @{ Name = 'CLP scene'; Text = $sceneWorkspace; Required = @('3D積載作業', '操作する積荷', '積荷を検索') },
    @{ Name = 'Placement proposal'; Text = $automaticProposalPanel; Required = @('配置案を適用', '配置案（未適用）') }
)) {
    foreach ($requiredText in $contract.Required) {
        if (-not $contract.Text.Contains($requiredText)) {
            throw "$($contract.Name) does not contain the approved CLP-terminology marker: $requiredText"
        }
    }
}

foreach ($requiredText in @(
    '`xy-contained`、`partial`、`outside`',
    '`partial` は修正途中の境界不適合配置',
    '面・辺・点の接触を含め一方でも共通長0',
    '一回の `placement.delete`',
    'viewport上のwheel入力はページscroll',
    '非永続の作業スペース',
    'X軸またはZ軸を中心に90度回転',
    '寸法prefix `大きさ:` を表示しない',
    '同一候補のProject更新ではcamera位置と注視点を保持',
    'CLPの全積荷を対象',
    '共有modal shell上の別dialog',
    'drag中の操作通知は固定高またはoverlay領域'
    '操作対象以外の積荷は面をほぼ透明な中立色、辺を灰色の点線'
    '寸法上通る場合は積荷ごとの理由を生成せず'
    '同じviewport固定toolbarへ常時表示'
    '一本の軸線へ矢印が回り込む同じSVG'
    '回転前後でbutton位置を変えない'
    '積荷編集画面の向き設定は「天地無用」checkboxだけ'
    '床面回転を禁止する積荷設定は設けない'
    '紫色の塗り分けやopacity差だけに依存しない'
)) {
    if (-not $specification.Contains($requiredText)) {
        throw "Specification does not contain the approved scene-feedback contract text: $requiredText"
    }
}

if ($readme.Contains('AP-08代表規模の実Worker性能記録は未完了')) {
    throw 'Root README still reports AP-08 performance evidence as incomplete.'
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
Assert-Equal $specificationVersion '1.3.0' 'Approved specification version'
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
$viewerFirstShellDecision = [IO.File]::ReadAllText($viewerFirstShellDecisionPath)
if ($viewerFirstShellDecision -notmatch '(?m)^- Status:\s*Accepted\s*$') {
    throw 'ADR 0025 does not have Accepted status.'
}
$tabbedSceneDecision = [IO.File]::ReadAllText($tabbedSceneDecisionPath)
if ($tabbedSceneDecision -notmatch '(?m)^- Status:\s*Accepted\s*$') {
    throw 'ADR 0026 does not have Accepted status.'
}
$drawerDeferralDecision = [IO.File]::ReadAllText($drawerDeferralDecisionPath)
if ($drawerDeferralDecision -notmatch '(?m)^- Status:\s*Accepted\s*$') {
    throw 'ADR 0029 does not have Accepted status.'
}
foreach ($requiredText in @(
    '通常起動で自動提案Workerを開始しない',
    '`積荷を追加` と `候補を追加`',
    '背面のcontrol、scene、履歴は同じクリックで作動させない',
    'Schema `0.1.0`'
)) {
    if (-not $drawerDeferralDecision.Contains($requiredText)) {
        throw "ADR 0029 does not contain the approved Drawer/deferral marker: $requiredText"
    }
}
foreach ($requiredText in @(
    'semantic tablist',
    'side-relative anchor',
    'cameraは候補別に保存せず',
    '固定context action row',
    '`structure-stability-unverified`',
    '使用上の重要事項',
    'Schema `0.1.0`'
)) {
    if (-not $tabbedSceneDecision.Contains($requiredText)) {
        throw "ADR 0026 does not contain the approved tabbed-scene marker: $requiredText"
    }
}
foreach ($requiredText in @(
    'Application Bar',
    'Navigation Drawer',
    '全CLP積荷',
    'history barrier',
    '新しい衝突しない `projectId`',
    'JSON Schema `0.1.0`'
)) {
    if (-not $viewerFirstShellDecision.Contains($requiredText)) {
        throw "ADR 0025 does not contain the approved viewer-first shell marker: $requiredText"
    }
}
foreach ($requiredText in @(
    '### Application Shell and Primary Workflow',
    '3D viewportを通常画面の主作業面',
    'Navigation Drawer',
    '全CLP積荷',
    'history barrier',
    '### Planned Terms of Use',
    '`cube-outline`'
)) {
    if (-not $specification.Contains($requiredText)) {
        throw "Specification does not contain the approved viewer-first shell marker: $requiredText"
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
    '現在CLP、履歴、入力を保持'
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
    -not $dataModel.Contains('decisions/0014-dedicated-floor-penetration-diagnostic.md') -or
    -not $dataModel.Contains('decisions/0017-scene-workbench-rotation-and-compact-controls.md') -or
    -not $dataModel.Contains('decisions/0018-scene-drag-classification-and-dialog-editors.md') -or
    -not $dataModel.Contains('decisions/0019-support-surface-snap-and-conditional-support.md') -or
    -not $dataModel.Contains('decisions/0020-actionable-opening-diagnostics-and-drag-focus.md') -or
    -not $dataModel.Contains('decisions/0021-fixed-rotation-toolbar-and-axis-icons.md')) {
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

$sceneFeedbackDecision = [IO.File]::ReadAllText($sceneFeedbackDecisionPath)
if ($sceneFeedbackDecision -notmatch '(?m)^- Status:\s*Accepted\s*$') {
    throw 'ADR 0015 does not have Accepted status.'
}
foreach ($requiredText in @(
    'wheelをpreventせずpage scrollへ渡す',
    '正の共通長',
    '`placement.delete`',
    'Partial supersession: ADR 0019',
    'Project Schema `0.1.0`'
)) {
    if (-not $sceneFeedbackDecision.Contains($requiredText)) {
        throw "ADR 0015 does not contain the approved scene-feedback marker: $requiredText"
    }
}

$sceneWorkbenchDecision = [IO.File]::ReadAllText($sceneWorkbenchDecisionPath)
if ($sceneWorkbenchDecision -notmatch '(?m)^- Status:\s*Accepted\s*$' -or
    -not $sceneWorkbenchDecision.Contains('Partial supersession: ADR 0018')) {
    throw 'ADR 0017 does not identify its accepted status and partial ADR 0018 supersession.'
}

$sceneCompactDecision = [IO.File]::ReadAllText($sceneCompactDecisionPath)
if ($sceneCompactDecision -notmatch '(?m)^- Status:\s*Accepted\s*$') {
    throw 'ADR 0018 does not have Accepted status.'
}
foreach ($requiredText in @(
    '`xy-contained`',
    '`partial`',
    '`outside`',
    '全Project積荷',
    'focus trap',
    'Project Schema `0.1.0`'
)) {
    if (-not $sceneCompactDecision.Contains($requiredText)) {
        throw "ADR 0018 does not contain the approved compact-scene marker: $requiredText"
    }
}

$supportSnapDecision = [IO.File]::ReadAllText($supportSnapDecisionPath)
if ($supportSnapDecision -notmatch '(?m)^- Status:\s*Accepted\s*$') {
    throw 'ADR 0019 does not have Accepted status.'
}

$actionableOpeningDecision = [IO.File]::ReadAllText($actionableOpeningDecisionPath)
if ($actionableOpeningDecision -notmatch '(?m)^- Status:\s*Accepted\s*$') {
    throw 'ADR 0020 does not have Accepted status.'
}

$fixedRotationDecision = [IO.File]::ReadAllText($fixedRotationDecisionPath)
if ($fixedRotationDecision -notmatch '(?m)^- Status:\s*Accepted\s*$') {
    throw 'ADR 0021 does not have Accepted status.'
}
foreach ($requiredText in @(
    '同じviewport固定toolbar',
    '一本の軸線へ矢印が回り込む同じSVG glyph',
    'X軸glyphだけをZ軸glyphに対して90度回して',
    '積荷未選択時も常時表示',
    'Project、JSON、IndexedDB、Schema `0.1.0`',
    '回転前後でbutton位置は変えない'
)) {
    if (-not $fixedRotationDecision.Contains($requiredText)) {
        throw "ADR 0021 does not contain the approved fixed-rotation marker: $requiredText"
    }
}
$orientationPolicyDecision = [IO.File]::ReadAllText($orientationPolicyDecisionPath)
if ($orientationPolicyDecision -notmatch '(?m)^- Status:\s*Accepted\s*$') {
    throw 'ADR 0022 does not have Accepted status.'
}
$webglRequiredDecision = [IO.File]::ReadAllText($webglRequiredDecisionPath)
if ($webglRequiredDecision -notmatch '(?m)^- Status:\s*Accepted\s*$') {
    throw 'ADR 0023 does not have Accepted status.'
}
foreach ($requiredText in @(
    'WebGL 2能力確認と初回Three.js描画成功',
    '案件編集、3D配置、物理判定、自動提案、履歴',
    'auto-clp-device-rescue-0.1.0.json',
    '読み取り専用救出',
    'Project Schema `0.1.0`'
)) {
    if (-not $webglRequiredDecision.Contains($requiredText)) {
        throw "ADR 0023 does not contain the approved WebGL-required marker: $requiredText"
    }
}
$clpTerminologyDecision = [IO.File]::ReadAllText($clpTerminologyDecisionPath)
if ($clpTerminologyDecision -notmatch '(?m)^- Status:\s*Accepted\s*$') {
    throw 'ADR 0024 does not have Accepted status.'
}
foreach ($requiredText in @(
    '正規データ一式を「CLP」と呼ぶ',
    '未適用結果は「配置案」と呼ぶ',
    '「作業データ」を使う',
    '`Project`、`projectId`',
    'JSON Schema `0.1.0`',
    '過去のADR、証拠、handoffは当時の記録として書き換えない'
)) {
    if (-not $clpTerminologyDecision.Contains($requiredText)) {
        throw "ADR 0024 does not contain the approved CLP-terminology marker: $requiredText"
    }
}
foreach ($requiredText in @(
    '## User-facing terminology',
    '「CLP」と呼び',
    '「配置案」と呼ぶ',
    '「作業データ」と表現する',
    '`Project`、`projectId`',
    'JSON Schema `0.1.0`'
)) {
    if (-not $specification.Contains($requiredText)) {
        throw "Specification does not contain the approved CLP-terminology marker: $requiredText"
    }
}
foreach ($requiredText in @(
    '向き設定は「天地無用」checkboxだけ',
    'Z軸の床面回転',
    '常に利用できる',
    '旧JSONまたは端末保存を読込む時',
    '拡大・縮小buttonと同じ青緑の強調枠',
    'Schema `0.1.0`'
)) {
    if (-not $orientationPolicyDecision.Contains($requiredText)) {
        throw "ADR 0022 does not contain the approved orientation-policy marker: $requiredText"
    }
}
foreach ($requiredText in @(
    '`opening-no-fitting-orientation`',
    '`opening-path-unverified` を生成・保存・Worker転送・表示しない',
    '恒常的で簡潔な注意として維持',
    '面をほぼ透明な中立色、辺を灰色の点線',
    '単独支持候補を緑、支持条件未確認候補を黄の点線',
    'Project、JSON、Schema `0.1.0`、保存データ、進捗は変更しない'
)) {
    if (-not $actionableOpeningDecision.Contains($requiredText)) {
        throw "ADR 0020 does not contain the approved actionable-diagnostic marker: $requiredText"
    }
}
foreach ($requiredText in @(
    '単独支持成立',
    '`support-conditions-unverified`',
    '支持台間の隙間',
    '支持不可積荷だけに接触',
    '一回のdropを一回の配置履歴',
    '自動提案v1は床置きまたは単独支持成立だけ',
    'Project、JSON、Schema `0.1.0`は変更しない'
)) {
    if (-not $supportSnapDecision.Contains($requiredText)) {
        throw "ADR 0019 does not contain the approved support-snap marker: $requiredText"
    }
}

foreach ($requiredText in @(
    'UI session',
    'X軸90度回転',
    'Z軸90度回転',
    '天地無用',
    'camera positionとOrbitControls target',
    'Project Schema `0.1.0`'
)) {
    if (-not $sceneWorkbenchDecision.Contains($requiredText)) {
        throw "ADR 0017 does not contain the approved scene-workbench marker: $requiredText"
    }
}

$geometry = [IO.File]::ReadAllText($geometryPath)
$placementValidation = [IO.File]::ReadAllText($placementValidationPath)
$sceneWorkspace = [IO.File]::ReadAllText($sceneWorkspacePath)
$projectScene = [IO.File]::ReadAllText($projectScenePath)
$projectSceneTest = [IO.File]::ReadAllText($projectSceneTestPath)
$threeViewport = [IO.File]::ReadAllText($threeViewportPath)
$sceneBrowserTest = [IO.File]::ReadAllText($sceneBrowserTestPath)
$styles = [IO.File]::ReadAllText($stylesPath)
$orientationPolicy = [IO.File]::ReadAllText($orientationPolicyPath)
$cargoEditor = [IO.File]::ReadAllText($cargoEditorPath)
$projectPersistence = [IO.File]::ReadAllText($projectPersistencePath)
foreach ($implementationMarker in @(
    @{ Name = 'geometry'; Text = $geometry; Required = 'export function hasPositiveAreaOverlap' },
    @{ Name = 'geometric support'; Text = $geometry; Required = 'export function assessGeometricSupport' },
    @{ Name = 'scene workspace overlap'; Text = $sceneWorkspace; Required = 'placedFloorDragDisposition(' },
    @{ Name = 'scene workspace snap'; Text = $sceneWorkspace; Required = 'resolveSupportSnapPosition(' },
    @{ Name = 'scene workspace classifier'; Text = $sceneWorkspace; Required = 'classifyFloorFootprint(' },
    @{ Name = 'scene workspace deletion'; Text = $sceneWorkspace; Required = 'action: "placement.delete"' },
    @{ Name = 'rotation-stable staging grid'; Text = $projectScene; Required = 'layoutFootprint: cargo.allowedOrientations.reduce' },
    @{ Name = 'rotation-stable staging regression'; Text = $projectSceneTest; Required = 'keeps peer staging positions fixed when one cargo rotates on the floor' },
    @{ Name = 'viewport wheel policy'; Text = $threeViewport; Required = 'controls.enableZoom = false' },
    @{ Name = 'viewport dotted focus'; Text = $threeViewport; Required = 'new THREE.LineDashedMaterial' },
    @{ Name = 'viewport drag de-emphasis'; Text = $threeViewport; Required = 'visual.mesh.material.opacity = 0.08' },
    @{ Name = 'viewport fixed rotation toolbar'; Text = $threeViewport; Required = 'className="viewport__rotation-controls"' },
    @{ Name = 'viewport common axis rotation icon'; Text = $threeViewport; Required = 'M4 12a8 5 0 0 0 13.7 3.5' },
    @{ Name = 'viewport enabled rotation border'; Text = $styles; Required = 'border-color: rgba(114, 234, 220, 0.75)' },
    @{ Name = 'viewport disabled rotation border'; Text = $styles; Required = 'border-color: rgba(88, 112, 136, 0.48)' },
    @{ Name = 'orientation policy normalization'; Text = $orientationPolicy; Required = 'normalizeProjectOrientationPolicies' },
    @{ Name = 'cargo editor upright-only control'; Text = $cargoEditor; Required = '<strong>天地無用</strong>' },
    @{ Name = 'persistence orientation migration'; Text = $projectPersistence; Required = 'normalizeProjectOrientationPolicies(result.nextState.project)' },
    @{ Name = 'scene browser drag focus'; Text = $sceneBrowserTest; Required = 'renders drag focus and restores normal cargo rendering after cancel' },
    @{ Name = 'scene browser fixed rotation'; Text = $sceneBrowserTest; Required = 'keeps axis rotation controls fixed, always visible, and distinguishable by orientation' },
    @{ Name = 'scene browser drag-out'; Text = $sceneBrowserTest; Required = 'returns a fully dragged-out placement to staging as one undoable deletion' }
)) {
    if (-not $implementationMarker.Text.Contains($implementationMarker.Required)) {
        throw "$($implementationMarker.Name) does not contain the approved implementation marker: $($implementationMarker.Required)"
    }
}
if ($placementValidation.Contains('opening-path-unverified')) {
    throw 'Physical validation still generates or types the retired per-cargo opening-path reason.'
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
    'AC-02 Exact Single Support and 1 mm Conditional Overhang',
    'AC-03 Independent Floor Penetration Diagnostics',
    'AC-04 Recovery, Portability, and Required-WebGL Failure Gate',
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
    '将来再開用の検証済み技術資産として保持',
    'Phase 1の通常UIからは接続を外し',
    '通常起動でWorkerを開始しない',
    '非実行snapshotとして保持',
    '再実行できるとは扱わない',
    'preview、取消、cutoff、完全案なし、失敗、stale、積荷なし、候補なしでは現在CLPと履歴を保持',
    '実積載不能または安全性の証明として案内してはならない'
)) {
    if (-not $operations.Contains($requiredText)) {
        throw "Operations does not contain the approved automatic-proposal boundary text: $requiredText"
    }
}

$automaticProposalHook = [IO.File]::ReadAllText($automaticProposalHookPath)
$automaticProposalPanel = [IO.File]::ReadAllText($automaticProposalPanelPath)
$automaticProposalBrowserTest = [IO.File]::ReadAllText($automaticProposalBrowserTestPath)
$automaticProposalPerformanceTest = [IO.File]::ReadAllText($automaticProposalPerformanceTestPath)
$automaticProposalEvidenceIndex = [IO.File]::ReadAllText($automaticProposalEvidenceIndexPath)
$automaticProposalEvidence = [IO.File]::ReadAllText($automaticProposalEvidencePath)
$automaticProposalApply = [IO.File]::ReadAllText($automaticProposalApplyPath)
$automaticProposalApplyTest = [IO.File]::ReadAllText($automaticProposalApplyTestPath)
$app = [IO.File]::ReadAllText($appPath)
if (-not $app.Contains('const automaticProposalAvailable = false;') -or
    -not $app.Contains('{automaticProposalAvailable ? (')) {
    throw 'App does not keep the retained automatic-proposal panel behind the approved unavailable gate.'
}
foreach ($contract in @(
    @{ Name = 'Application apply'; Text = $automaticProposalApply; Required = @('prepareAutomaticProposalApply', 'validatePlacementSet', 'support-conditions-unverified', 'automatic-proposal.apply-unverified-mismatch') },
    @{ Name = 'Application apply test'; Text = $automaticProposalApplyTest; Required = @('expectFailurePreserves', 'toBe(frozenCurrent)', 'complete-with-cutoff') },
    @{ Name = 'React hook'; Text = $automaticProposalHook; Required = @('useSyncExternalStore', 'visibleSnapshot', 'interactionGeneration') },
    @{ Name = 'React panel'; Text = $automaticProposalPanel; Required = @('aria-live="polite"', '配置案を適用', '配置が変わる場合は、1回の取り消しで元へ戻せます。') },
    @{ Name = 'App integration'; Text = $app; Required = @('handleAutomaticProposalApply', 'automatic-proposal.apply', 'persistenceOperationRef.current') },
    @{ Name = 'Browser snapshot'; Text = $automaticProposalBrowserTest; Required = @('Future-only non-executable snapshot', '__cancelProposalFromBrowser', '自動提案の一括適用', '3D 利用可') }
    @{ Name = 'AP-08 performance snapshot'; Text = $automaticProposalPerformanceTest; Required = @('Future-only non-executable snapshot', 'automatic-proposal.worker.ts', 'cold-1', 'warm-${iteration - 1}', 'expectedAttemptCount = 210', 'AP08_EVIDENCE_JSON=', 'terminateLatencyMs', '/^[0-9a-f]{40}$/') }
)) {
    foreach ($requiredText in $contract.Required) {
        if (-not $contract.Text.Contains($requiredText)) {
            throw "$($contract.Name) does not contain the required automatic-proposal integration marker: $requiredText"
        }
    }
}

foreach ($requiredText in @(
    'automatic-proposal-ap08-733b250.md',
    '一般端末SLA、実務受入、安全保証ではない'
)) {
    if (-not $automaticProposalEvidenceIndex.Contains($requiredText)) {
        throw "Automatic-proposal evidence index does not contain the required AP-08 marker: $requiredText"
    }
}

foreach ($requiredText in @(
    'CP-AUTO-PROPOSAL-AP08-TEST-001',
    '733b250b188245e510183dca8e4930f0f8eafa87',
    'automatic-proposal-v2',
    '57.8 ms',
    '46.7 ms',
    '47.5 ms',
    '386d66e1cd8da39a51d1699a1305a5ca1bcf972c74fd7b8abb0ffe16084f4f39',
    'candidateAttemptCount',
    'requestAttemptCount',
    '"pass":true',
    '一般端末SLAではない'
)) {
    if (-not $automaticProposalEvidence.Contains($requiredText)) {
        throw "Automatic-proposal AP-08 evidence does not contain the required marker: $requiredText"
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
    scene_feedback_decision_0015_accepted = $true
    scene_workbench_decision_0017_accepted = $true
    scene_compact_decision_0018_accepted = $true
    support_snap_decision_0019_accepted = $true
    actionable_opening_decision_0020_accepted = $true
    fixed_rotation_decision_0021_accepted = $true
    orientation_policy_decision_0022_accepted = $true
    webgl_required_decision_0023_accepted = $true
    clp_terminology_decision_0024_accepted = $true
    viewer_first_shell_decision_0025_accepted = $true
    tabbed_scene_decision_0026_accepted = $true
    optimization_decision_0004_accepted = $true
    synthetic_acceptance_contract_current = $true
    automatic_proposal_domain_implemented = $true
    automatic_proposal_worker_transport_implemented = $true
    automatic_proposal_session_view_implemented = $true
    automatic_proposal_react_preview_retained_as_future_asset = $true
    automatic_proposal_future_browser_snapshot_retained = $true
    automatic_proposal_apply_implemented = $true
    automatic_proposal_apply_undo_tested = $true
    automatic_proposal_ap08_performance_tested = $true
    automatic_proposal_ap08_evidence_recorded = $true
    automatic_proposal_current_ui_available = $false
    drawer_deferral_decision_0029_accepted = $true
}
