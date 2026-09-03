# Pure project-policy checks shared by the project gate and its synthetic regression.
function Assert-ProjectVerificationPolicy {
    param([Parameter(Mandatory = $true)][object]$Policy)
    $requiredClasses = @(
        'documentation-only', 'ui-css-layout', 'application-logic',
        'data-contract-schema-migration', 'project-guidance-metadata',
        'governance-permissions-agents', 'build-release-deploy'
    )
    $actualClasses = @($Policy.classes | ForEach-Object { [string]$_.id })
    if ($actualClasses.Count -ne 7 -or @($actualClasses | Select-Object -Unique).Count -ne 7 -or
        @($requiredClasses | Where-Object { $_ -notin $actualClasses }).Count -gt 0) {
        throw 'Verification policy must contain exactly the seven approved change classes.'
    }
    $profiles = @($Policy.runtimeProfiles)
    $required = @($profiles | Where-Object { $_.required -eq $true })
    if ($profiles.Count -ne 2 -or $required.Count -ne 1 -or
        $required[0].id -ne 'windows-pwsh7' -or $required[0].platform -ne 'windows' -or
        $required[0].edition -ne 'Core' -or $required[0].executable -ne 'pwsh' -or
        $required[0].versionRule -ne 'minimum-major=7' -or $required[0].supportStatus -ne 'supported') {
        throw 'Project runtime policy must require the approved Windows PowerShell 7 profile only.'
    }
    $legacy = @($profiles | Where-Object { $_.id -eq 'windows-powershell51' })
    if ($legacy.Count -ne 1 -or $legacy[0].required -isnot [bool] -or $legacy[0].required -ne $false -or
        $legacy[0].platform -ne 'windows' -or $legacy[0].edition -ne 'Desktop' -or
        $legacy[0].executable -ne 'powershell' -or $legacy[0].versionRule -ne 'major-minor=5.1' -or
        $legacy[0].supportStatus -ne 'unverified') {
        throw 'Windows PowerShell 5.1 must remain optional and unverified.'
    }
    if ($required[0].required -isnot [bool]) { throw 'Runtime required values must be booleans.' }
    $gateIds = @($Policy.gates | ForEach-Object { [string]$_.id })
    if (@($gateIds | Select-Object -Unique).Count -ne $gateIds.Count) {
        throw 'Verification gate IDs must be unique.'
    }
    $preservedGates = @(
        'diff-check', 'typecheck', 'lint', 'unit-tests', 'browser-tests', 'build',
        'data-contract-check', 'governance-check', 'project-check'
    )
    foreach ($gate in $preservedGates) {
        if ($gate -notin $gateIds -or $gate -notin @($Policy.comprehensiveGateIds) -or
            $gate -notin @($Policy.unknownImpactGateIds)) {
            throw "Existing comprehensive and unknown-impact gates must be preserved: $gate"
        }
    }
    $projectGate = @($Policy.gates | Where-Object { $_.id -eq 'project-check' })
    if ('project-governance-regression' -notin $gateIds -or
        'project-governance-regression' -notin @($projectGate[0].includes)) {
        throw 'Project check must include the project-governance regression gate.'
    }
}
