[CmdletBinding()]
param(
    [string]$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [int]$MaxAgentsBytes = 32768
)

$ErrorActionPreference = 'Stop'

function Get-NormalizedLfSha256 {
    param([Parameter(Mandatory = $true)][string]$Path)

    $sourceBytes = [IO.File]::ReadAllBytes($Path)
    $normalizedBytes = [IO.MemoryStream]::new()
    try {
        for ($index = 0; $index -lt $sourceBytes.Length; $index++) {
            if ($sourceBytes[$index] -eq 13) {
                if (($index + 1) -lt $sourceBytes.Length -and $sourceBytes[$index + 1] -eq 10) {
                    $index++
                }
                $normalizedBytes.WriteByte(10)
            } else {
                $normalizedBytes.WriteByte($sourceBytes[$index])
            }
        }

        $sha256 = [Security.Cryptography.SHA256]::Create()
        try {
            $hashBytes = $sha256.ComputeHash($normalizedBytes.ToArray())
            return ([BitConverter]::ToString($hashBytes)).Replace('-', '').ToLowerInvariant()
        } finally {
            $sha256.Dispose()
        }
    } finally {
        $normalizedBytes.Dispose()
    }
}

function Assert-ObjectProperties {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string[]]$Names,
        [Parameter(Mandatory = $true)][string]$Context
    )
    foreach ($name in $Names) {
        if ($Object.PSObject.Properties.Name -notcontains $name) {
            throw "$Context lacks required property: $name"
        }
    }
}

function Test-NonBlankStringArray {
    param(
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]]$Values,
        [switch]$AllowEmpty
    )
    if (-not $AllowEmpty -and $Values.Count -eq 0) {
        return $false
    }
    foreach ($value in $Values) {
        if ([string]::IsNullOrWhiteSpace([string]$value)) {
            return $false
        }
    }
    return $true
}

function Format-VerificationSummaryValue {
    param([AllowNull()][object]$Value)
    if ($null -eq $Value) { return '' }
    return ([string]$Value).Replace('\', '\\').Replace("`r", '\r').Replace("`n", '\n').Replace(';', '\;').Replace(',', '\,').Replace('[', '\[').Replace(']', '\]')
}

function Format-VerificationSummaryArray {
    param([AllowEmptyCollection()][object[]]$Values)
    return '[' + ((@($Values) | ForEach-Object { Format-VerificationSummaryValue -Value $_ }) -join ',') + ']'
}

function Get-VerificationPolicyDocumentationBlock {
    param([Parameter(Mandatory = $true)]$Policy)

    $lines = [Collections.Generic.List[string]]::new()
    $lines.Add('<!-- BEGIN GENERATED VERIFICATION POLICY SUMMARY -->')
    $lines.Add('- Root: schemaVersion=' + (Format-VerificationSummaryValue $Policy.schemaVersion) + '; comprehensiveGateIds=' + (Format-VerificationSummaryArray @($Policy.comprehensiveGateIds)) + '; unknownImpactGateIds=' + (Format-VerificationSummaryArray @($Policy.unknownImpactGateIds)))
    foreach ($changeClass in @($Policy.classes)) {
        $lines.Add('- Class: id=' + (Format-VerificationSummaryValue $changeClass.id) + '; triggers=' + (Format-VerificationSummaryArray @($changeClass.triggers)) + '; iterationGateIds=' + (Format-VerificationSummaryArray @($changeClass.iterationGateIds)) + '; targetedRegressionGateIds=' + (Format-VerificationSummaryArray @($changeClass.targetedRegressionGateIds)) + '; completionGateIds=' + (Format-VerificationSummaryArray @($changeClass.completionGateIds)) + '; releaseOnlyGateIds=' + (Format-VerificationSummaryArray @($changeClass.releaseOnlyGateIds)) + '; omittableGateIds=' + (Format-VerificationSummaryArray @($changeClass.omittableGateIds)) + '; omissionRecord=' + (Format-VerificationSummaryValue $changeClass.omissionRecord))
    }
    foreach ($gate in @($Policy.gates)) {
        $lines.Add('- Gate: id=' + (Format-VerificationSummaryValue $gate.id) + '; command=' + (Format-VerificationSummaryValue $gate.command) + '; stages=' + (Format-VerificationSummaryArray @($gate.stages)) + '; includes=' + (Format-VerificationSummaryArray @($gate.includes)) + '; invalidatedBy=' + (Format-VerificationSummaryArray @($gate.invalidatedBy)) + '; evidenceDestination=' + (Format-VerificationSummaryValue $gate.evidenceDestination))
    }
    $lines.Add('<!-- END GENERATED VERIFICATION POLICY SUMMARY -->')
    return ($lines -join "`n")
}

$resolvedProject = (Resolve-Path -LiteralPath $ProjectPath).Path
$governanceRoot = Join-Path $resolvedProject 'governance'
$lockPath = Join-Path $governanceRoot 'governance.lock.toml'
$commonPath = Join-Path $governanceRoot 'common-governance.md'
$projectRulesPath = Join-Path $governanceRoot 'project-rules.md'
$agentsPath = Join-Path $resolvedProject 'AGENTS.md'
$rendererPath = Join-Path $resolvedProject 'scripts\render-governance.ps1'
$validatorPath = Join-Path $resolvedProject 'scripts\check-governance.ps1'

foreach ($requiredPath in @($lockPath, $commonPath, $projectRulesPath, $agentsPath, $rendererPath, $validatorPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "Required governance file is missing: $requiredPath"
    }
}

function Get-LockValue {
    param([string]$Name)
    $pattern = '^%s\s*=\s*"([^"]+)"\s*$' -replace '%s', [regex]::Escape($Name)
    $match = Select-String -LiteralPath $lockPath -Pattern $pattern | Select-Object -First 1
    if (-not $match) {
        throw "Missing lock value: $Name"
    }
    return $match.Matches[0].Groups[1].Value.ToLowerInvariant()
}

$checks = [ordered]@{
    common_governance = @($commonPath, 'common_governance_sha256')
    renderer = @($rendererPath, 'renderer_sha256')
    validator = @($validatorPath, 'validator_sha256')
}

foreach ($entry in $checks.GetEnumerator()) {
    $actual = Get-NormalizedLfSha256 -Path $entry.Value[0]
    $expected = Get-LockValue -Name $entry.Value[1]
    if ($actual -ne $expected) {
        throw "Managed $($entry.Key) differs from governance.lock.toml. Restore it through the approved skill sync."
    }
}

$projectRules = [IO.File]::ReadAllText($projectRulesPath)
if ($projectRules -match '\[(Project Name|Purpose, users|Task-routed|Products, systems|Optional agents|Sensitive data|Verified commands|Roadmaps, weights|Task names)') {
    throw 'Project rules still contain template placeholders.'
}

$operationsPath = Join-Path $resolvedProject 'docs\operations.md'
$verificationPolicyPath = Join-Path $governanceRoot 'verification-policy.json'
foreach ($verificationPath in @($operationsPath, $verificationPolicyPath)) {
    if (-not (Test-Path -LiteralPath $verificationPath -PathType Leaf)) {
        throw "Project verification policy is missing: $verificationPath"
    }
}
$operationsText = [IO.File]::ReadAllText($operationsPath)
$policyText = [IO.File]::ReadAllText($verificationPolicyPath)
if ($policyText.Contains('REPLACE_')) {
    throw 'Project verification policy JSON still contains template placeholders.'
}
try {
    $verificationPolicy = $policyText | ConvertFrom-Json -ErrorAction Stop
} catch {
    throw "Project verification policy JSON is invalid: $($_.Exception.Message)"
}
Assert-ObjectProperties -Object $verificationPolicy -Names @('schemaVersion', 'comprehensiveGateIds', 'unknownImpactGateIds', 'classes', 'gates') -Context 'Verification policy root'
if ($verificationPolicy.schemaVersion -ne '1.0') {
    throw "Unsupported verification policy schemaVersion: $($verificationPolicy.schemaVersion)"
}
foreach ($requiredVerificationText in @('## Verification Matrix', 'Gate Catalog and Inclusion', 'Evidence Validity', 'governance/verification-policy.json')) {
    if (-not $operationsText.Contains($requiredVerificationText)) {
        throw "Project verification documentation is incomplete: $requiredVerificationText"
    }
}

$gateCatalog = @{}
$gateStages = @{}
$commandOwners = @{}
$allowedStages = @('iteration', 'targeted', 'completion', 'release')
foreach ($gate in @($verificationPolicy.gates)) {
    Assert-ObjectProperties -Object $gate -Names @('id', 'command', 'stages', 'includes', 'invalidatedBy', 'evidenceDestination') -Context 'Verification gate'
    $gateId = [string]$gate.id
    $command = [string]$gate.command
    $stages = @($gate.stages | ForEach-Object { [string]$_ })
    $includes = @($gate.includes | ForEach-Object { [string]$_ })
    $invalidatedBy = @($gate.invalidatedBy | ForEach-Object { [string]$_ })
    $evidenceDestination = [string]$gate.evidenceDestination
    if ([string]::IsNullOrWhiteSpace($gateId) -or [string]::IsNullOrWhiteSpace($command) -or
        -not (Test-NonBlankStringArray -Values $stages) -or
        -not (Test-NonBlankStringArray -Values $includes -AllowEmpty) -or
        -not (Test-NonBlankStringArray -Values $invalidatedBy) -or
        [string]::IsNullOrWhiteSpace($evidenceDestination)) {
        throw "Verification gate is incomplete: $gateId"
    }
    if ($gateCatalog.ContainsKey($gateId)) {
        throw "Duplicate verification gate ID: $gateId"
    }
    if ($commandOwners.ContainsKey($command)) {
        throw "Duplicate verification command for gate IDs $($commandOwners[$command]) and ${gateId}: $command"
    }
    foreach ($stage in $stages) {
        if ($allowedStages -notcontains $stage) {
            throw "Unknown verification stage for ${gateId}: $stage"
        }
    }
    $commandOwners[$command] = $gateId
    $gateCatalog[$gateId] = @($includes)
    $gateStages[$gateId] = @($stages)
}
if ($gateCatalog.Count -eq 0) {
    throw 'Project verification policy contains no stable gate IDs.'
}

$requiredClassIds = @(
    'documentation-only',
    'ui-css-layout',
    'application-logic',
    'data-contract-schema-migration',
    'governance-permissions-agents',
    'build-release-deploy'
)
$classCatalog = @{}
$classCompletionGateIds = @{}
$stageProperties = [ordered]@{
    iterationGateIds = 'iteration'
    targetedRegressionGateIds = 'targeted'
    completionGateIds = 'completion'
    releaseOnlyGateIds = 'release'
}
foreach ($changeClass in @($verificationPolicy.classes)) {
    Assert-ObjectProperties -Object $changeClass -Names @('id', 'triggers', 'iterationGateIds', 'targetedRegressionGateIds', 'completionGateIds', 'releaseOnlyGateIds', 'omittableGateIds', 'omissionRecord') -Context 'Verification class'
    $classId = [string]$changeClass.id
    if ([string]::IsNullOrWhiteSpace($classId) -or $classCatalog.ContainsKey($classId)) {
        throw "Missing or duplicate verification class ID: $classId"
    }
    if (-not (Test-NonBlankStringArray -Values @($changeClass.triggers)) -or [string]::IsNullOrWhiteSpace([string]$changeClass.omissionRecord)) {
        throw "Verification class lacks triggers or omission destination: $classId"
    }
    $classCatalog[$classId] = $true
    foreach ($entry in $stageProperties.GetEnumerator()) {
        $referencedGateIds = @($changeClass.($entry.Key) | ForEach-Object { [string]$_ })
        if (-not (Test-NonBlankStringArray -Values $referencedGateIds -AllowEmpty:($entry.Key -eq 'releaseOnlyGateIds'))) {
            throw "Verification class lacks $($entry.Key): $classId"
        }
        foreach ($referencedGateId in $referencedGateIds) {
            if (-not $gateCatalog.ContainsKey($referencedGateId)) {
                throw "Verification class $classId references unknown gate ID: $referencedGateId"
            }
            if ($gateStages[$referencedGateId] -notcontains $entry.Value) {
                throw "Verification class $classId uses gate $referencedGateId in unsupported stage $($entry.Value)"
            }
        }
    }
    $classCompletionGateIds[$classId] = @($changeClass.completionGateIds | ForEach-Object { [string]$_ })
    $omittableGateIds = @($changeClass.omittableGateIds | ForEach-Object { [string]$_ })
    if (-not (Test-NonBlankStringArray -Values $omittableGateIds -AllowEmpty)) {
        throw "Verification class has a blank omittable gate ID: $classId"
    }
    foreach ($omittableGateId in $omittableGateIds) {
        if (-not $gateCatalog.ContainsKey($omittableGateId)) {
            throw "Verification class $classId references unknown omittable gate ID: $omittableGateId"
        }
    }
}
foreach ($requiredClassId in $requiredClassIds) {
    if (-not $classCatalog.ContainsKey($requiredClassId)) {
        throw "Required verification class is missing: $requiredClassId"
    }
}
if ($classCatalog.Count -ne $requiredClassIds.Count) {
    throw 'Verification policy contains an unsupported change class.'
}
$comprehensiveGateIds = @($verificationPolicy.comprehensiveGateIds | ForEach-Object { [string]$_ })
if (-not (Test-NonBlankStringArray -Values $comprehensiveGateIds)) {
    throw 'Comprehensive verification gate IDs are missing or blank.'
}
foreach ($comprehensiveGateId in $comprehensiveGateIds) {
    if (-not $gateCatalog.ContainsKey($comprehensiveGateId) -or $gateStages[$comprehensiveGateId] -notcontains 'completion') {
        throw "Comprehensive verification gate is not a valid completion gate: $comprehensiveGateId"
    }
}
$unknownImpactGateIds = @($verificationPolicy.unknownImpactGateIds | ForEach-Object { [string]$_ })
if (-not (Test-NonBlankStringArray -Values $unknownImpactGateIds)) {
    throw 'Unknown-impact comprehensive fallback is missing or blank.'
}
foreach ($fallbackGateId in $unknownImpactGateIds) {
    if (-not $gateCatalog.ContainsKey($fallbackGateId) -or $gateStages[$fallbackGateId] -notcontains 'completion') {
        throw "Unknown-impact fallback is not a valid completion gate: $fallbackGateId"
    }
}

$verifiedGateIds = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
$visitingGateIds = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
function Test-GateInclusion {
    param([Parameter(Mandatory = $true)][string]$GateId)

    if (-not $gateCatalog.ContainsKey($GateId)) {
        throw "Unknown included verification gate ID: $GateId"
    }
    if ($visitingGateIds.Contains($GateId)) {
        throw "Cyclic verification gate inclusion: $GateId"
    }
    if ($verifiedGateIds.Contains($GateId)) {
        return
    }
    [void]$visitingGateIds.Add($GateId)
    foreach ($includedGateId in @($gateCatalog[$GateId])) {
        Test-GateInclusion -GateId $includedGateId
    }
    [void]$visitingGateIds.Remove($GateId)
    [void]$verifiedGateIds.Add($GateId)
}
foreach ($gateId in @($gateCatalog.Keys)) {
    Test-GateInclusion -GateId $gateId
}

function Get-GateClosure {
    param([Parameter(Mandatory = $true)][string[]]$GateIds)

    $closure = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    function Add-GateClosure {
        param([Parameter(Mandatory = $true)][string]$GateId)
        if ($closure.Add($GateId)) {
            foreach ($includedGateId in @($gateCatalog[$GateId])) {
                Add-GateClosure -GateId $includedGateId
            }
        }
    }
    foreach ($gateId in $GateIds) {
        Add-GateClosure -GateId $gateId
    }
    return $closure
}

function Assert-SelectionContainsComprehensiveGate {
    param(
        [Parameter(Mandatory = $true)][string[]]$GateIds,
        [Parameter(Mandatory = $true)][string]$Context
    )
    $closure = Get-GateClosure -GateIds $GateIds
    foreach ($comprehensiveGateId in $comprehensiveGateIds) {
        if (-not $closure.Contains($comprehensiveGateId)) {
            throw "$Context does not include comprehensive gate: $comprehensiveGateId"
        }
    }
}

Assert-SelectionContainsComprehensiveGate -GateIds $unknownImpactGateIds -Context 'Unknown-impact fallback'
Assert-SelectionContainsComprehensiveGate -GateIds $classCompletionGateIds['governance-permissions-agents'] -Context 'Governance completion'
Assert-SelectionContainsComprehensiveGate -GateIds $classCompletionGateIds['build-release-deploy'] -Context 'Build/release/deploy completion'

$expectedPolicySummary = (Get-VerificationPolicyDocumentationBlock -Policy $verificationPolicy).Replace("`r`n", "`n")
$normalizedOperationsText = $operationsText.Replace("`r`n", "`n")
if (-not $normalizedOperationsText.Contains($expectedPolicySummary)) {
    throw 'Generated verification-policy summary in docs/operations.md does not match governance/verification-policy.json.'
}

$rendererResult = & $rendererPath -ProjectPath $resolvedProject -Check

$agentsBytes = (Get-Item -LiteralPath $agentsPath).Length
if ($agentsBytes -gt $MaxAgentsBytes) {
    throw "Generated AGENTS.md is $agentsBytes bytes, above the configured maximum of $MaxAgentsBytes bytes."
}

[pscustomobject]@{
    project_path = $resolvedProject
    common_governance_version = (Get-LockValue -Name 'common_governance_version')
    agents_bytes = $agentsBytes
    max_agents_bytes = $MaxAgentsBytes
    managed_hashes_current = $true
    generated_agents_current = $true
    renderer_check_result = $rendererResult
    renderer_check_exit_status = 0
    project_rules_present = $true
    verification_policy_present = $true
    verification_gate_count = $gateCatalog.Count
    verification_class_count = $classCatalog.Count
    verification_inclusion_graph_valid = $true
    verification_documentation_aligned = $true
}
