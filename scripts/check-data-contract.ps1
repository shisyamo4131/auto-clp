[CmdletBinding()]
param(
    [string]$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
$resolvedProject = (Resolve-Path -LiteralPath $ProjectPath).Path
$schemaPath = Join-Path $resolvedProject 'schemas/project-0.1.0.schema.json'
$specificationPath = Join-Path $resolvedProject 'docs/specification.md'
$dataModelPath = Join-Path $resolvedProject 'docs/data-model.md'
$decisionPath = Join-Path $resolvedProject 'docs/decisions/0009-versioned-project-data-contract.md'
$coordinateDecisionPath = Join-Path $resolvedProject 'docs/decisions/0010-container-coordinate-and-placement-anchor.md'
$clearanceDecisionPath = Join-Path $resolvedProject 'docs/decisions/0011-axis-clearance-semantics.md'
$physicalValidationDecisionPath = Join-Path $resolvedProject 'docs/decisions/0012-independent-physical-validation-diagnostics.md'

foreach ($path in @(
    $schemaPath,
    $specificationPath,
    $dataModelPath,
    $decisionPath,
    $coordinateDecisionPath,
    $clearanceDecisionPath,
    $physicalValidationDecisionPath
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
$dataModelVersionMatch = [regex]::Match(
    $dataModel,
    '仕様版 `([0-9]+\.[0-9]+\.[0-9]+)`'
)
if (-not $dataModelVersionMatch.Success) {
    throw 'Data model does not contain a parseable specification version.'
}

$specificationVersion = $specificationVersionMatch.Groups[1].Value
$dataModelVersion = $dataModelVersionMatch.Groups[1].Value
Assert-Equal $specificationVersion '0.6.0' 'Approved specification version'
Assert-Equal $dataModelVersion $specificationVersion 'Data model specification version'

if (-not $dataModel.Contains('Project schema version: `0.1.0`') -or
    -not $dataModel.Contains('../schemas/project-0.1.0.schema.json') -or
    -not $dataModel.Contains('5 MiB（5,242,880 bytes）') -or
    -not $dataModel.Contains('decisions/0010-container-coordinate-and-placement-anchor.md') -or
    -not $dataModel.Contains('decisions/0011-axis-clearance-semantics.md') -or
    -not $dataModel.Contains('decisions/0012-independent-physical-validation-diagnostics.md')) {
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
}
